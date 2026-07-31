"""
/api/heatmap/stocks 엔드포인트 테스트.

합성 RS parquet(파티션 2개) + 합성 stock_price.duckdb 를 임시 디렉터리에 만들고
환경변수(RS_PARQUET_DIR, STOCK_PRICE_DB_PATH)로 경로를 주입한다.

합성 데이터:
  종목 A(000010): 종가 항상 10000 → 모든 기간 수익률 0
  종목 B(000020): 종가 4990 - 10*i (i=며칠 전) → ret(N일) = 10N/(4990-10N)*100
  종목 C(000030): 최근 10일치만 존재 → 1M 이상 수익률 None
"""

from pathlib import Path

import duckdb
import pytest

AS_OF = "2026-07-29"
N_DAYS = 300


def _b_ret(n: int) -> float:
    return round(10 * n / (4990 - 10 * n) * 100, 2)


@pytest.fixture()
def heatmap_env(tmp_path, monkeypatch):
    rs_dir = tmp_path / "rs"
    part_latest = rs_dir / f"date={AS_OF}"
    part_old = rs_dir / "date=2026-07-28"
    part_latest.mkdir(parents=True)
    part_old.mkdir(parents=True)

    con = duckdb.connect()
    attrs_sql = """
        SELECT * FROM (VALUES
            ('000010', '에이', 'KOSPI', 'IT', '소프트웨어', 'AI,반도체', 2.0, 80),
            ('000020', '비',   'KOSPI', 'IT', '소프트웨어', 'AI',       10.0, 60),
            ('000030', '씨',   'KOSDAQ', '금융', '은행',     '',          0.5, 40)
        ) AS t(Code, Name, Market, Sector, WICS, "테마", Marcap, RS_Rating)
    """
    con.execute(
        f"COPY ({attrs_sql}) TO '{part_latest / 'part-0.parquet'}' (FORMAT PARQUET)"
    )
    con.execute(
        f"""COPY (
            SELECT * FROM (VALUES
                ('999999', '옛날', 'KOSPI', 'IT', '소프트웨어', '', 1.0, 50)
            ) AS t(Code, Name, Market, Sector, WICS, "테마", Marcap, RS_Rating)
        ) TO '{part_old / "part-0.parquet"}' (FORMAT PARQUET)"""
    )

    price_db = tmp_path / "stock_price.duckdb"
    pcon = duckdb.connect(str(price_db))
    pcon.execute(
        """
        CREATE TABLE stock_price (
            날짜 DATE, 종목코드 VARCHAR, 종목명 VARCHAR, 시장구분 VARCHAR,
            시가 BIGINT, 고가 BIGINT, 저가 BIGINT, 종가 BIGINT, 거래량 BIGINT,
            PRIMARY KEY (날짜, 종목코드)
        )
        """
    )
    # A: 항상 10000, B: 4990-10*i (i=며칠 전), 둘 다 300일
    pcon.execute(
        f"""
        INSERT INTO stock_price
        SELECT CAST('{AS_OF}' AS DATE) - INTERVAL (i) DAY, '000010', '에이', 'KOSPI',
               0, 0, 0, 10000, 0
        FROM generate_series(0, {N_DAYS - 1}) t(i)
        """
    )
    pcon.execute(
        f"""
        INSERT INTO stock_price
        SELECT CAST('{AS_OF}' AS DATE) - INTERVAL (i) DAY, '000020', '비', 'KOSPI',
               0, 0, 0, 4990 - 10 * i, 0
        FROM generate_series(0, {N_DAYS - 1}) t(i)
        """
    )
    # C: 최근 10일만, 종가 5000 고정
    pcon.execute(
        f"""
        INSERT INTO stock_price
        SELECT CAST('{AS_OF}' AS DATE) - INTERVAL (i) DAY, '000030', '씨', 'KOSDAQ',
               0, 0, 0, 5000, 0
        FROM generate_series(0, 9) t(i)
        """
    )
    pcon.close()
    con.close()

    monkeypatch.setenv("RS_PARQUET_DIR", str(rs_dir))
    monkeypatch.setenv("STOCK_PRICE_DB_PATH", str(price_db))

    import app.utils.stock_heatmap_utils as mod

    monkeypatch.setattr(mod, "_cache", {"key": None, "frame": None})
    return {"rs_dir": rs_dir, "price_db": price_db}


def _stocks_by_code(payload):
    out = {}
    for g in payload["groups"]:
        for s in g["stocks"]:
            out[s["code"]] = s
    return out


def test_latest_partition_selected(client, heatmap_env):
    res = client.get("/api/heatmap/stocks?grouping=sector&period=1D")
    assert res.status_code == 200
    body = res.json()
    assert body["as_of_date"] == AS_OF
    assert body["stock_count"] == 3  # 최신 파티션의 3종목 (옛날 파티션 무시)


def test_period_returns(client, heatmap_env):
    res = client.get("/api/heatmap/stocks?grouping=sector&period=1M")
    body = res.json()
    stocks = _stocks_by_code(body)
    assert stocks["000010"]["ret"] == 0.0
    assert stocks["000020"]["ret"] == _b_ret(21)
    assert stocks["000030"]["ret"] is None  # 10일치뿐 → 1M 없음

    res = client.get("/api/heatmap/stocks?grouping=sector&period=12M")
    stocks = _stocks_by_code(res.json())
    assert stocks["000020"]["ret"] == _b_ret(252)

    res = client.get("/api/heatmap/stocks?grouping=sector&period=5D")
    stocks = _stocks_by_code(res.json())
    assert stocks["000020"]["ret"] == _b_ret(5)
    assert stocks["000030"]["ret"] == 0.0  # 5일치는 있음 (고정 종가)


def test_sector_group_stats(client, heatmap_env):
    body = client.get("/api/heatmap/stocks?grouping=sector&period=1M").json()
    groups = {g["name"]: g for g in body["groups"]}
    assert set(groups) == {"IT", "금융"}
    it = groups["IT"]
    assert it["stock_count"] == 2
    assert it["rs"] == 70  # (80+60)/2
    expected_avg = round((0.0 + _b_ret(21)) / 2, 2)
    assert it["avg_return"] == expected_avg
    # 그룹 정렬: weight 합 큰 순 (IT: ∛2000+∛10000 > 금융: ∛500)
    assert body["groups"][0]["name"] == "IT"
    # 금융 그룹: 유일한 종목 수익률 None → avg_return None
    assert groups["금융"]["avg_return"] is None


def test_theme_explosion(client, heatmap_env):
    body = client.get("/api/heatmap/stocks?grouping=theme&period=1D").json()
    groups = {g["name"]: g for g in body["groups"]}
    assert set(groups) == {"AI", "반도체"}  # 테마 없는 C 제외
    assert {s["code"] for s in groups["AI"]["stocks"]} == {"000010", "000020"}
    assert {s["code"] for s in groups["반도체"]["stocks"]} == {"000010"}


def test_industry_grouping(client, heatmap_env):
    body = client.get("/api/heatmap/stocks?grouping=industry&period=1D").json()
    groups = {g["name"]: g for g in body["groups"]}
    assert set(groups) == {"소프트웨어", "은행"}


def test_marcap_filter_uses_eok_unit(client, heatmap_env):
    # Marcap parquet 값 2.0(천억원) → 2000억원으로 노출
    body = client.get("/api/heatmap/stocks?grouping=sector&period=1D").json()
    stocks = _stocks_by_code(body)
    assert stocks["000010"]["marcap"] == 2000.0
    assert stocks["000020"]["marcap"] == 10000.0

    # 1000억 이상: A(2000), B(10000)
    body = client.get(
        "/api/heatmap/stocks?grouping=sector&period=1D&marcap_min=1000"
    ).json()
    assert body["stock_count"] == 2
    assert set(_stocks_by_code(body)) == {"000010", "000020"}

    # 1500억 이하: C(500)만
    body = client.get(
        "/api/heatmap/stocks?grouping=sector&period=1D&marcap_max=1500"
    ).json()
    assert set(_stocks_by_code(body)) == {"000030"}

    # 구간: 1000~5000억 → A만
    body = client.get(
        "/api/heatmap/stocks?grouping=sector&period=1D&marcap_min=1000&marcap_max=5000"
    ).json()
    assert set(_stocks_by_code(body)) == {"000010"}


def test_limit_top_n_by_marcap(client, heatmap_env):
    body = client.get("/api/heatmap/stocks?grouping=sector&period=1D&limit=2").json()
    assert body["stock_count"] == 2
    assert set(_stocks_by_code(body)) == {"000010", "000020"}  # 시총 상위 2


def test_invalid_params(client, heatmap_env):
    assert (
        client.get("/api/heatmap/stocks?grouping=bogus").status_code == 400
    )
    assert client.get("/api/heatmap/stocks?period=2M").status_code == 400
