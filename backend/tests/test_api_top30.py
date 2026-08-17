"""
/api/trend/top30 엔드포인트 테스트.

합성 RS 파티션(date=YYYY-MM-DD/part-0.parquet, 컬럼 Code/Name/Market/Marcap)을
임시 RS_PARQUET_DIR 에 만들고 시장 필터/신규 진입/순위 변동/경계를 검증한다.

합성:
- 2026-07-20 (최초): i0, i1 만 존재 → compare_days=5 가 데이터 시작 이전이 됨
- 2026-07-22 (비교일): KOSPI i0..i4, Marcap 재배열(i4=10000,i3=9000,i2=8000,i1=7000,i0=6000)
- 2026-07-29 (기준일): DQT(20000,KOSDAQ) + KOSPI i0..i34(Marcap 10000-i, i34는 NULL)
"""

from pathlib import Path

import duckdb
import pytest

REF_DATE = "2026-07-29"
COMPARE_DATE = "2026-07-24"
FIRST_DATE = "2026-07-20"

# 거래일(파티션 날짜) 10일: compare_days=5 가 07-24(비교일)에 걸리도록
_TRADING_DATES = [
    "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24",
    "2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29",
]

_KOSPI_MARCAP = {f"i{i}": 10000 - i for i in range(35)}  # i34 는 9966 (비결측)


def _write_partition(rs_dir: Path, date: str, rows: list[tuple]):
    part_dir = rs_dir / f"date={date}"
    part_dir.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    values = ",\n".join(
        f"('{c}', '{n}', '{m}', {v if v is not None else 'NULL'})"
        for c, n, m, v in rows
    )
    sql = f"SELECT * FROM (VALUES {values}) AS t(Code, Name, Market, Marcap)"
    con.execute(
        f"COPY ({sql}) TO '{part_dir / 'part-0.parquet'}' (FORMAT PARQUET)"
    )
    con.close()


@pytest.fixture()
def top30_env(tmp_path, monkeypatch):
    rs_dir = tmp_path / "rs"

    # 최초 파티션: i0, i1 만
    _write_partition(rs_dir, FIRST_DATE, [("i0", "에이", "KOSPI", 50.0), ("i1", "비", "KOSPI", 40.0)])

    # 비교일 파티션: i0..i4 (DQT 없음), Marcap 재배열
    compare_rows = [
        ("i4", "디", "KOSPI", 10000.0),
        ("i3", "씨", "KOSPI", 9000.0),
        ("i2", "시", "KOSPI", 8000.0),
        ("i1", "비", "KOSPI", 7000.0),
        ("i0", "에이", "KOSPI", 6000.0),
    ]
    _write_partition(rs_dir, COMPARE_DATE, compare_rows)

    # 그 외 중간 거래일: 최소 행(i0, i1) 추가로 파티션 수 확보
    for d in _TRADING_DATES:
        if d in (FIRST_DATE, COMPARE_DATE, REF_DATE):
            continue
        _write_partition(rs_dir, d, [("i0", "에이", "KOSPI", 50.0), ("i1", "비", "KOSPI", 40.0)])

    # 기준일 파티션: DQT(KOSDAQ) + KOSPI i0..i34 (i34 는 NULL Marcap)
    ref_rows = [("DQT", "디큐티", "KQ", 20000.0)]
    for c, m in _KOSPI_MARCAP.items():
        if c == "i34":
            ref_rows.append((c, c.upper(), "KOSPI", None))
        else:
            ref_rows.append((c, c.upper(), "KOSPI", float(m)))
    _write_partition(rs_dir, REF_DATE, ref_rows)

    monkeypatch.setenv("RS_PARQUET_DIR", str(rs_dir))
    return rs_dir


def _stocks(body):
    return {s["code"]: s for s in body["stocks"]}


def test_top30_returns_exactly_30_ordered_by_marcap(client, top30_env):
    res = client.get(f"/api/trend/top30?date={REF_DATE}&market=kospi&compare_days=5")
    assert res.status_code == 200
    body = res.json()
    stocks = body["stocks"]
    assert len(stocks) == 30
    # 시가총액 내림차순 (DQT 는 KOSPI 필터에서 제외)
    marcaps = [s["marcap"] for s in stocks]
    assert marcaps == sorted(marcaps, reverse=True)
    assert stocks[0]["code"] == "i0" and stocks[0]["rank"] == 1


def test_market_all_includes_kosdaq(client, top30_env):
    res = client.get(f"/api/trend/top30?date={REF_DATE}&market=all&compare_days=5")
    assert res.status_code == 200
    stocks = _stocks(res.json())
    assert stocks["DQT"]["rank"] == 1  # KOSDAQ 최대 시총


def test_market_kosdaq_returns_only_kosdaq(client, top30_env):
    res = client.get(f"/api/trend/top30?date={REF_DATE}&market=kosdaq&compare_days=5")
    stocks = res.json()["stocks"]
    assert len(stocks) == 1
    assert stocks[0]["code"] == "DQT"


def test_rank_delta_sign(client, top30_env):
    res = client.get(f"/api/trend/top30?date={REF_DATE}&market=kospi&compare_days=5")
    stocks = _stocks(res.json())
    # 비교일(2026-07-24) 재배열: i4=r1,i3=r2,i2=r3,i1=r4,i0=r5
    # 기준일(2026-07-29) 내림차순: i0=r1,...,i29=r30
    assert stocks["i0"]["rank_delta"] == 5 - 1  # 상승(+4)
    assert stocks["i4"]["rank_delta"] == 1 - 5  # 하락(-4)
    assert stocks["i0"]["previous_rank"] == 5
    assert stocks["i0"]["new_entrant"] is False


def test_new_entrant(client, top30_env):
    res = client.get(f"/api/trend/top30?date={REF_DATE}&market=kospi&compare_days=5")
    stocks = _stocks(res.json())
    # i5 는 비교일 TOP30 에 없음 → 신규 진입, previous_rank None, rank_delta None
    assert stocks["i5"]["new_entrant"] is True
    assert stocks["i5"]["previous_rank"] is None
    assert stocks["i5"]["rank_delta"] is None


def test_null_marcap_excluded(client, top30_env):
    res = client.get(f"/api/trend/top30?date={REF_DATE}&market=kospi&compare_days=5")
    stocks = _stocks(res.json())
    assert "i34" not in stocks  # NULL Marcap 제외


def test_invalid_market_422(client, top30_env):
    res = client.get(f"/api/trend/top30?date={REF_DATE}&market=nasdaq&compare_days=5")
    assert res.status_code == 422


def test_invalid_compare_days_422(client, top30_env):
    res = client.get(f"/api/trend/top30?date={REF_DATE}&market=all&compare_days=7")
    assert res.status_code == 422


def test_compare_before_data_start_graceful(client, top30_env):
    # 기준일이 최초 파티션이고 compare_days=5 → 비교 데이터 없음, graceful
    res = client.get(f"/api/trend/top30?date={FIRST_DATE}&market=all&compare_days=5")
    assert res.status_code == 200
    body = res.json()
    assert body["compare_available"] is False
    assert body["compare_date"] is None
    for s in body["stocks"]:
        assert s["rank_delta"] is None
        assert s["new_entrant"] is False


def test_dates_endpoint_top30_env(client, top30_env):
    res = client.get("/api/trend/top30/dates")
    assert res.status_code == 200
    assert res.json()["dates"] == _TRADING_DATES