"""GET /api/charts/stockbee-mm 테스트."""

import os
import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def temp_stockbee_mm_db():
    fd, db_path_str = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_path = Path(db_path_str)

    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE stockbee_mm (
            date TEXT PRIMARY KEY,
            bo_up REAL, bo_dn REAL,
            five_d_r REAL, ten_d_r REAL,
            q_up_25p REAL, q_dn_25p REAL,
            m_up_25p REAL, m_dn_25p REAL,
            m_up_50p REAL, m_dn_50p REAL,
            d34_up_13p REAL, d34_dn_13p REAL,
            t2108 REAL, stock_count REAL, kospi REAL
        )
        """
    )
    conn.executemany(
        """
        INSERT INTO stockbee_mm (
            date, bo_up, bo_dn, five_d_r, ten_d_r,
            q_up_25p, q_dn_25p, m_up_25p, m_dn_25p, m_up_50p, m_dn_50p,
            d34_up_13p, d34_dn_13p, t2108, stock_count, kospi
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("2024-12-30", 1, 2, 0.1, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 10.0, 1000, 2400.0),
            ("2025-09-02", 5, 6, 0.3, 0.4, 0, 0, 0, 0, 0, 0, 0, 0, 20.0, 1001, 2410.0),
            ("2026-08-04", 10, 20, 0.4, 0.5, 1, 2, 3, 4, 0, 1, 5, 6, 45.0, 2000, 2500.0),
            ("2026-08-05", 30, 15, 2.1, 1.8, 5, 1, 8, 2, 2, 0, 10, 3, 55.0, 2001, 2550.0),
            ("2026-08-06", 40, 10, 2.5, 2.0, 6, 1, 9, 1, 3, 0, 12, 2, 60.0, 2002, 2600.0),
        ],
    )
    conn.commit()
    conn.close()

    old = os.environ.get("STOCKBEE_MM_DB_PATH")
    os.environ["STOCKBEE_MM_DB_PATH"] = db_path_str
    yield db_path_str
    if old:
        os.environ["STOCKBEE_MM_DB_PATH"] = old
    else:
        del os.environ["STOCKBEE_MM_DB_PATH"]
    db_path.unlink(missing_ok=True)


def test_stockbee_mm_default_one_year(temp_stockbee_mm_db):
    """최신일(2026-08-06) 기준 1년 → 2025-08-06 이후만 (2024 제외)."""
    res = client.get("/api/charts/stockbee-mm")
    assert res.status_code == 200
    body = res.json()
    data = body["data"]
    assert body["years"] == [2026, 2025, 2024]
    dates = [r["date"] for r in data]
    assert "2024-12-30" not in dates
    assert dates[0] == "2026-08-06"
    assert "2025-09-02" in dates
    assert data[0]["bo_up"] == 40
    assert data[0]["five_d_r"] == 2.5
    assert data[0]["kospi"] == 2600.0


def test_stockbee_mm_year_filter(temp_stockbee_mm_db):
    res = client.get("/api/charts/stockbee-mm?year=2025")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 1
    assert data[0]["date"] == "2025-09-02"


def test_stockbee_mm_limit(temp_stockbee_mm_db):
    res = client.get("/api/charts/stockbee-mm?limit=2")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 2
    assert data[0]["date"] == "2026-08-06"


def test_stockbee_mm_missing_db(monkeypatch, tmp_path):
    monkeypatch.setenv("STOCKBEE_MM_DB_PATH", str(tmp_path / "missing.db"))
    res = client.get("/api/charts/stockbee-mm")
    assert res.status_code == 200
    assert res.json()["data"] == []
    assert res.json()["years"] == []
