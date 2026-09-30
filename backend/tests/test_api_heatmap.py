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
            ('000010', '에이', 'KOSPI', 'IT', '소프트웨어', 'AI,반도체', 2.0, 80, 0),
            ('000020', '비',   'KOSPI', 'IT', '소프트웨어', 'AI',       10.0, 60, 1),
            ('000030', '씨',   'KOSDAQ', '금융', '은행',     '',          0.5, 40, -2)
        ) AS t(Code, Name, Market, Sector, WICS, "테마", Marcap, RS_Rating, MMT)
    """
    con.execute(
        f"COPY ({attrs_sql}) TO '{part_latest / 'part-0.parquet'}' (FORMAT PARQUET)"
    )
    con.execute(
        f"""COPY (
            SELECT * FROM (VALUES
                ('999999', '옛날', 'KOSPI', 'IT', '소프트웨어', '', 1.0, 50, 0)
            ) AS t(Code, Name, Market, Sector, WICS, "테마", Marcap, RS_Rating, MMT)
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

    theme_db = tmp_path / "theme.db"
    import sqlite3

    scon = sqlite3.connect(str(theme_db))
    scon.execute(
        """
        CREATE TABLE custom_themes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    scon.execute(
        """
        CREATE TABLE custom_theme_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            theme_id INTEGER NOT NULL REFERENCES custom_themes(id) ON DELETE CASCADE,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            added_date TEXT NOT NULL,
            memo TEXT,
            updated_at TEXT,
            UNIQUE(theme_id, code)
        )
        """
    )
    # 테마 1: AI (종목 A, B 포함)
    # 테마 2: 배당 (종목 B만 포함)
    scon.execute("INSERT INTO custom_themes (id, name, created_at) VALUES (1, '커스텀AI', '2026-07-29')")
    scon.execute("INSERT INTO custom_themes (id, name, created_at) VALUES (2, '커스텀배당', '2026-07-29')")
    scon.execute("INSERT INTO custom_theme_items (theme_id, code, name, added_date) VALUES (1, '000010', '에이', '2026-07-29')")
    scon.execute("INSERT INTO custom_theme_items (theme_id, code, name, added_date) VALUES (1, '000020', '비', '2026-07-29')")
    scon.execute("INSERT INTO custom_theme_items (theme_id, code, name, added_date) VALUES (2, '000020', '비', '2026-07-29')")
    scon.commit()
    scon.close()

    monkeypatch.setenv("RS_PARQUET_DIR", str(rs_dir))
    monkeypatch.setenv("STOCK_PRICE_DB_PATH", str(price_db))
    monkeypatch.setenv("THEME_DB_PATH", str(theme_db))

    import app.utils.stock_heatmap_utils as mod

    monkeypatch.setattr(mod, "_cache", {"key": None, "frame": None})
    return {"rs_dir": rs_dir, "price_db": price_db, "theme_db": theme_db}


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


def test_kospi_grouping(client, heatmap_env):
    body = client.get("/api/heatmap/stocks?grouping=kospi&period=1D").json()
    assert body["stock_count"] == 2
    assert len(body["groups"]) == 1
    g = body["groups"][0]
    assert g["name"] == "KOSPI"
    assert {s["code"] for s in g["stocks"]} == {"000010", "000020"}
    assert all(s["market"] == "KOSPI" for s in g["stocks"])


def test_kosdaq_grouping_normalizes_kq(client, heatmap_env, monkeypatch, tmp_path):
    """parquet Market='KQ' 도 KOSDAQ 그룹으로 정규화한다."""
    rs_dir = tmp_path / "rs_kq"
    part = rs_dir / f"date={AS_OF}"
    part.mkdir(parents=True)
    con = duckdb.connect()
    con.execute(
        f"""COPY (
            SELECT * FROM (VALUES
                ('000010', '에이', 'KOSPI', 'IT', '소프트웨어', '', 2.0, 80, 0),
                ('000030', '씨',   'KQ',    '금융', '은행',     '', 0.5, 40, -2)
            ) AS t(Code, Name, Market, Sector, WICS, "테마", Marcap, RS_Rating, MMT)
        ) TO '{part / "part-0.parquet"}' (FORMAT PARQUET)"""
    )
    con.close()

    # 기존 fixture 가격 DB 재사용
    monkeypatch.setenv("RS_PARQUET_DIR", str(rs_dir))
    import app.utils.stock_heatmap_utils as mod

    monkeypatch.setattr(mod, "_cache", {"key": None, "frame": None})

    body = client.get("/api/heatmap/stocks?grouping=kosdaq&period=1D").json()
    assert body["stock_count"] == 1
    assert len(body["groups"]) == 1
    g = body["groups"][0]
    assert g["name"] == "KOSDAQ"
    assert g["stocks"][0]["code"] == "000030"
    assert g["stocks"][0]["market"] == "KOSDAQ"


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


def test_price_db_locked_returns_503(client, heatmap_env, monkeypatch):
    import app.utils.stock_heatmap_utils as mod

    monkeypatch.setattr(mod, "_cache", {"key": None, "frame": None})

    def boom(*_a, **_k):
        raise mod.PriceDbLockedError()

    monkeypatch.setattr(mod, "_build_base_frame", boom)
    res = client.get("/api/heatmap/stocks?grouping=sector&period=1D")
    assert res.status_code == 503
    assert "잠겨" in res.json()["detail"]


def test_min_ret_filter(client, heatmap_env):
    # min_ret=4.0 필터링 테스트
    body = client.get("/api/heatmap/stocks?grouping=sector&period=1D&min_ret=4.0").json()
    for group in body["groups"]:
        for stock in group["stocks"]:
            assert stock["ret"] is not None and stock["ret"] >= 4.0


def test_custom_date_range(client, heatmap_env):
    # 시작일과 종료일 직접 지정 테스트 (10일 전 ~ AS_OF)
    from datetime import datetime, timedelta

    as_of_dt = datetime.strptime(AS_OF, "%Y-%m-%d")
    start_str = (as_of_dt - timedelta(days=10)).strftime("%Y-%m-%d")

    res = client.get(f"/api/heatmap/stocks?grouping=sector&start_date={start_str}&end_date={AS_OF}")
    assert res.status_code == 200
    body = res.json()

    assert body["period"] == "CUSTOM"
    assert body["start_date"] == start_str
    assert body["end_date"] == AS_OF
    assert body["effective_start_date"] is not None
    assert body["effective_end_date"] is not None

    stocks = _stocks_by_code(body)
    assert stocks["000010"]["ret"] == 0.0
    assert stocks["000020"]["ret"] is not None


def test_min_rs_filter(client, heatmap_env):
    # RS rating 필터링 테스트 (예: min_rs=80)
    body = client.get("/api/heatmap/stocks?grouping=sector&period=1D&min_rs=80").json()
    assert body["min_rs"] == 80
    for group in body["groups"]:
        for stock in group["stocks"]:
            assert stock["rs"] is not None and stock["rs"] >= 80


def test_mmt_filter(client, heatmap_env):
    # MMT 단일 필터링 테스트 (예: mmt=1)
    body = client.get("/api/heatmap/stocks?grouping=sector&period=1D&mmt=1").json()
    assert body["mmt"] == "1"
    assert body["stock_count"] == 1
    stocks = _stocks_by_code(body)
    assert set(stocks.keys()) == {"000020"}
    assert stocks["000020"]["mmt"] == 1

    # MMT=-2 필터링 테스트
    body_neg = client.get("/api/heatmap/stocks?grouping=sector&period=1D&mmt=-2").json()
    assert body_neg["mmt"] == "-2"
    assert body_neg["stock_count"] == 1
    stocks_neg = _stocks_by_code(body_neg)
    assert set(stocks_neg.keys()) == {"000030"}
    assert stocks_neg["000030"]["mmt"] == -2

    # MMT 복수 선택 필터링 테스트 (예: mmt=1,-2)
    body_multi = client.get("/api/heatmap/stocks?grouping=sector&period=1D&mmt=1,-2").json()
    assert body_multi["mmt"] == "1,-2"
    assert body_multi["stock_count"] == 2
    stocks_multi = _stocks_by_code(body_multi)
    assert set(stocks_multi.keys()) == {"000020", "000030"}


def test_theme2_grouping(client, heatmap_env):
    """테마2(custom themes from theme.db) 그룹화 테스트."""
    res = client.get("/api/heatmap/stocks?grouping=theme2&period=1M")
    assert res.status_code == 200
    body = res.json()
    assert body["grouping"] == "theme2"

    groups = {g["name"]: g for g in body["groups"]}
    # '커스텀AI', '커스텀배당' 테마 존재
    assert set(groups.keys()) == {"커스텀AI", "커스텀배당"}

    # 커스텀AI: 종목 A('000010'), 종목 B('000020')
    ai_stocks = {s["code"]: s for s in groups["커스텀AI"]["stocks"]}
    assert set(ai_stocks.keys()) == {"000010", "000020"}

    # 커스텀배당: 종목 B('000020')
    div_stocks = {s["code"]: s for s in groups["커스텀배당"]["stocks"]}
    assert set(div_stocks.keys()) == {"000020"}

    # 종목 C('000030')는 어떤 커스텀 테마에도 속하지 않으므로 어떤 그룹에도 나타나지 않음
    all_codes = {s["code"] for g in body["groups"] for s in g["stocks"]}
    assert "000030" not in all_codes


def test_theme2_dynamic_invalidation(client, heatmap_env):
    """theme.db 파일이 갱신(새 테마/종목 추가)되었을 때 캐시가 자동으로 무효화되는지 검증."""
    theme_db = heatmap_env["theme_db"]

    import sqlite3
    import time
    time.sleep(0.01)

    scon = sqlite3.connect(str(theme_db))
    scon.execute("INSERT INTO custom_themes (id, name, created_at) VALUES (3, '신규로봇', '2026-07-29')")
    scon.execute("INSERT INTO custom_theme_items (theme_id, code, name, added_date) VALUES (3, '000030', '씨', '2026-07-29')")
    scon.commit()
    scon.close()

    # mtime 확실히 변경
    new_mtime = theme_db.stat().st_mtime + 5
    import os
    os.utime(str(theme_db), (new_mtime, new_mtime))

    res = client.get("/api/heatmap/stocks?grouping=theme2&period=1M")
    assert res.status_code == 200
    body = res.json()

    groups = {g["name"]: g for g in body["groups"]}
    assert "신규로봇" in groups
    robot_stocks = {s["code"]: s for s in groups["신규로봇"]["stocks"]}
    assert "000030" in robot_stocks


def test_size_by_trade_value_and_min_filter(client, heatmap_env):
    """size_by=trade_value 및 trade_value_min 필터 동작 검증."""
    # 1. 기본 size_by=marcap
    res = client.get("/api/heatmap/stocks?grouping=sector&period=1D")
    assert res.status_code == 200
    body = res.json()
    assert body["size_by"] == "marcap"
    stock_a = next(s for g in body["groups"] for s in g["stocks"] if s["code"] == "000010")
    assert stock_a["trade_value"] is not None
    assert stock_a["trade_value_1d"] is not None

    # 2. size_by=trade_value
    res_tv = client.get("/api/heatmap/stocks?grouping=sector&period=1D&size_by=trade_value")
    assert res_tv.status_code == 200
    body_tv = res_tv.json()
    assert body_tv["size_by"] == "trade_value"

    # 3. trade_value_min filter
    res_filtered = client.get("/api/heatmap/stocks?grouping=sector&period=1D&trade_value_min=999999999")
    assert res_filtered.status_code == 200
    body_filtered = res_filtered.json()
    assert body_filtered["stock_count"] == 0

    # 4. invalid size_by
    res_invalid = client.get("/api/heatmap/stocks?grouping=sector&size_by=invalid_value")
    assert res_invalid.status_code == 400


def test_color_by_and_growth_filter(client, heatmap_env):
    """color_by 및 min_trade_value_growth 파라미터와 trade_value_growth 계산 검증."""
    # 1. 기본 color_by=return
    res = client.get("/api/heatmap/stocks?grouping=sector&period=1D")
    assert res.status_code == 200
    body = res.json()
    assert body["color_by"] == "return"
    stock_a = next(s for g in body["groups"] for s in g["stocks"] if s["code"] == "000010")
    # trade_value_growth 필드가 응답에 포함되어 있는지 확인
    assert "trade_value_growth" in stock_a

    # 2. color_by=trade_value_growth
    res_growth = client.get("/api/heatmap/stocks?grouping=sector&period=1D&color_by=trade_value_growth")
    assert res_growth.status_code == 200
    body_growth = res_growth.json()
    assert body_growth["color_by"] == "trade_value_growth"

    # 3. min_trade_value_growth 필터
    res_filtered = client.get("/api/heatmap/stocks?grouping=sector&period=1D&min_trade_value_growth=999999")
    assert res_filtered.status_code == 200
    body_filtered = res_filtered.json()
    assert body_filtered["stock_count"] == 0

    # 4. invalid color_by
    res_invalid = client.get("/api/heatmap/stocks?grouping=sector&color_by=invalid_color")
    assert res_invalid.status_code == 400

