"""외국인 현선물 동향 API / 유틸 테스트 (#12)."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils import foreign_flow_utils as ff


client = TestClient(app)


def _write_investor(path: Path, dates: list[str], foreigner: list[float]) -> None:
    df = pd.DataFrame(
        {"외국인": foreigner},
        index=pd.to_datetime(dates),
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path)


def _write_kospi(path: Path, dates: list[str], closes: list[float]) -> None:
    df = pd.DataFrame(
        {"Close": closes},
        index=pd.to_datetime(dates),
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path)


def test_load_foreign_flow_empty_when_missing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(ff, "_CACHE_DIR", tmp_path)
    monkeypatch.setattr(
        ff,
        "_SPOT_PATHS",
        {False: tmp_path / "kospi_investor.parquet", True: tmp_path / "kospi_investor_etf.parquet"},
    )
    monkeypatch.setattr(ff, "_FUTURE_PATH", tmp_path / "kospi200_future.parquet")
    monkeypatch.setattr(ff, "_KOSPI_CANDIDATES", [tmp_path / "kospi.csv"])

    assert ff.load_foreign_flow_data() == []


def test_load_foreign_flow_computes_ma_and_units(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(ff, "_CACHE_DIR", tmp_path)
    monkeypatch.setattr(ff, "_MACRO_DB", tmp_path / "missing.db")  # CSV 폴백 강제
    spot = tmp_path / "kospi_investor.parquet"
    future = tmp_path / "kospi200_future.parquet"
    kospi = tmp_path / "kospi.csv"
    monkeypatch.setattr(ff, "_SPOT_PATHS", {False: spot, True: tmp_path / "etf.parquet"})
    monkeypatch.setattr(ff, "_FUTURE_PATH", future)
    monkeypatch.setattr(ff, "_KOSPI_CANDIDATES", [kospi])

    # 150 거래일: 1억씩 현물+선물 → net=2억원/일 고정이면 MA=2
    dates = pd.bdate_range("2024-01-01", periods=150).strftime("%Y-%m-%d").tolist()
    # 원 단위: 1억 = 1e8
    vals = [1e8] * len(dates)
    _write_investor(spot, dates, vals)
    _write_investor(future, dates, vals)
    _write_kospi(kospi, dates, [3000.0 + i for i in range(len(dates))])

    rows = ff.load_foreign_flow_data(start_date="2024-06-01", end_date=dates[-1], etf=False)
    assert len(rows) > 0
    # 워밍업 이후 ma20/ma60/ma120 존재
    last = rows[-1]
    assert last["net"] == pytest.approx(2.0)
    assert last["ma20"] == pytest.approx(2.0)
    assert last["ma60"] == pytest.approx(2.0)
    assert last["ma120"] == pytest.approx(2.0)
    assert last["kospi"] is not None


def test_foreign_flow_api_ok(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(ff, "_CACHE_DIR", tmp_path)
    monkeypatch.setattr(ff, "_MACRO_DB", tmp_path / "missing.db")
    spot = tmp_path / "kospi_investor.parquet"
    future = tmp_path / "kospi200_future.parquet"
    kospi = tmp_path / "kospi.csv"
    monkeypatch.setattr(ff, "_SPOT_PATHS", {False: spot, True: tmp_path / "etf.parquet"})
    monkeypatch.setattr(ff, "_FUTURE_PATH", future)
    monkeypatch.setattr(ff, "_KOSPI_CANDIDATES", [kospi])

    dates = pd.bdate_range("2025-01-01", periods=30).strftime("%Y-%m-%d").tolist()
    _write_investor(spot, dates, [1e8] * len(dates))
    _write_investor(future, dates, [1e8] * len(dates))
    _write_kospi(kospi, dates, [2500.0] * len(dates))

    # monkeypatch the router import path
    monkeypatch.setattr(
        "app.routers.charts.load_foreign_flow_data",
        lambda start_date=None, end_date=None, etf=False: ff.load_foreign_flow_data(
            start_date, end_date, etf
        ),
    )

    res = client.get("/api/charts/foreign-flow", params={"etf": "false"})
    assert res.status_code == 200
    body = res.json()
    assert body["etf"] is False
    assert len(body["data"]) == 30


def test_read_kospi_prefers_macro_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """CSV보다 macro.db index_ohlcv 를 우선한다."""
    import sqlite3

    db = tmp_path / "macro.db"
    con = sqlite3.connect(db)
    con.execute(
        "CREATE TABLE index_ohlcv (date TEXT, index_name TEXT, close REAL, PRIMARY KEY(date, index_name))"
    )
    con.executemany(
        "INSERT INTO index_ohlcv VALUES (?, 'kospi', ?)",
        [("2026-08-01", 6200.0), ("2026-08-03", 6257.45)],
    )
    con.commit()
    con.close()

    stale_csv = tmp_path / "kospi.csv"
    _write_kospi(stale_csv, ["2026-06-01"], [100.0])

    monkeypatch.setattr(ff, "_MACRO_DB", db)
    monkeypatch.setattr(ff, "_KOSPI_CANDIDATES", [stale_csv])

    s = ff._read_kospi()
    assert float(s.loc["2026-08-03"]) == pytest.approx(6257.45)
    assert 100.0 not in set(s.astype(float).tolist())
