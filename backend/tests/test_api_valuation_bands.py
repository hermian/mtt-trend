"""지수 PER/PBR 밴드 유틸·API 테스트."""

from __future__ import annotations

import os
import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.valuation_band_utils import (
    DEFAULT_PBR_MULTIPLES,
    DEFAULT_PER_MULTIPLES,
    compute_band_levels,
    parse_multiples,
)

client = TestClient(app)


def test_parse_multiples_defaults():
    assert parse_multiples(None, "pbr") == list(DEFAULT_PBR_MULTIPLES)
    assert parse_multiples("", "per") == list(DEFAULT_PER_MULTIPLES)


def test_parse_multiples_custom_sorted_unique():
    assert parse_multiples("1.5, 0.8, 1.5, 1", "pbr") == [0.8, 1.0, 1.5]


def test_parse_multiples_rejects_non_positive():
    with pytest.raises(ValueError, match="> 0"):
        parse_multiples("0,1", "pbr")


def test_compute_band_levels_pbr():
    # close=3000, pbr=1.2 → BPS=2500 → 1x=2500, 1.2x=3000
    bands = compute_band_levels(3000.0, None, 1.2, "pbr", [1.0, 1.2])
    assert bands["1"] == pytest.approx(2500.0)
    assert bands["1.2"] == pytest.approx(3000.0)


def test_compute_band_levels_per():
    # close=3000, per=15 → EPS=200 → 10x=2000, 15x=3000
    bands = compute_band_levels(3000.0, 15.0, None, "per", [10.0, 15.0])
    assert bands["10"] == pytest.approx(2000.0)
    assert bands["15"] == pytest.approx(3000.0)


def test_compute_band_levels_null_ratio():
    bands = compute_band_levels(3000.0, None, None, "pbr", [1.0])
    assert bands["1"] is None


@pytest.fixture
def temp_fundamental_db(monkeypatch):
    fd, db_path_str = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_path = Path(db_path_str)

    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE index_fundamental (
            date TEXT NOT NULL,
            index_name TEXT NOT NULL,
            close REAL,
            change_rate REAL,
            per REAL,
            pbr REAL,
            div_yd REAL,
            PRIMARY KEY (date, index_name)
        )
        """
    )
    conn.executemany(
        """
        INSERT INTO index_fundamental
        (date, index_name, close, change_rate, per, pbr, div_yd)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("2024-01-02", "kospi", 2500.0, 0.5, 12.5, 1.0, 1.8),
            ("2024-01-03", "kospi", 2600.0, 1.0, None, 1.0, 1.8),  # PER 결측
            ("2024-01-04", "kospi", 2700.0, 0.2, 13.5, 0.9, 1.9),
            ("2024-01-02", "kosdaq", 800.0, 0.1, 20.0, 2.0, 0.5),
        ],
    )
    conn.commit()
    conn.close()

    real_expanduser = os.path.expanduser

    def fake_expanduser(path: str) -> str:
        if path == "~/.cache/db/macro.db":
            return str(db_path)
        return real_expanduser(path)

    monkeypatch.setattr(os.path, "expanduser", fake_expanduser)
    yield db_path
    db_path.unlink(missing_ok=True)


def test_valuation_bands_pbr(temp_fundamental_db):
    r = client.get(
        "/api/charts/valuation-bands",
        params={"index": "kospi", "mode": "pbr", "multiples": "1.0,1.2"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["index_name"] == "kospi"
    assert body["mode"] == "pbr"
    assert body["multiples"] == [1.0, 1.2]
    assert len(body["data"]) == 3
    first = body["data"][0]
    assert first["date"] == "2024-01-02"
    assert first["bands"]["1"] == pytest.approx(2500.0)
    assert first["bands"]["1.2"] == pytest.approx(3000.0)


def test_valuation_bands_per_null_day(temp_fundamental_db):
    r = client.get(
        "/api/charts/valuation-bands",
        params={"index": "kospi", "mode": "per", "multiples": "10,15"},
    )
    assert r.status_code == 200
    by_date = {p["date"]: p for p in r.json()["data"]}
    assert by_date["2024-01-03"]["bands"]["10"] is None
    # close=2500, per=12.5 → EPS=200 → 10x=2000
    assert by_date["2024-01-02"]["bands"]["10"] == pytest.approx(2000.0)


def test_valuation_bands_date_filter(temp_fundamental_db):
    r = client.get(
        "/api/charts/valuation-bands",
        params={
            "index": "kospi",
            "mode": "pbr",
            "start_date": "2024-01-03",
            "end_date": "2024-01-03",
        },
    )
    assert r.status_code == 200
    assert len(r.json()["data"]) == 1
    assert r.json()["data"][0]["date"] == "2024-01-03"


def test_valuation_bands_bad_index():
    r = client.get("/api/charts/valuation-bands", params={"index": "sp500"})
    assert r.status_code == 400


def test_valuation_bands_bad_mode(temp_fundamental_db):
    r = client.get(
        "/api/charts/valuation-bands",
        params={"index": "kospi", "mode": "ev"},
    )
    assert r.status_code == 400
