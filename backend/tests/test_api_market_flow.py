"""수급 및 E-mini Nasdaq100 데이터 API 테스트 (#41)."""

import os
import sqlite3
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def mock_macro_db(tmp_path, monkeypatch):
    """임시 SQLite DB 생성 및 market_flow 테이블 모킹."""
    db_path = tmp_path / "macro.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE market_flow (
            date TEXT,
            time TEXT,
            kospi_price REAL,
            kospi200_price REAL,
            kosdaq_price REAL,
            kq150_price REAL,
            kospi_foreigner REAL,
            kospi_institution REAL,
            kospi_individual REAL,
            kospi_program REAL,
            kosdaq_foreigner REAL,
            kosdaq_institution REAL,
            kosdaq_individual REAL,
            future_foreigner REAL,
            future_institution REAL,
            future_individual REAL,
            emini_nasdaq_price REAL,
            PRIMARY KEY (date, time)
        )
    """)
    cursor.execute("""
        INSERT INTO market_flow VALUES (
            '2026-08-18', '09:00', 6800.0, 1070.0, 830.0, 14000.0,
            100.0, -50.0, -50.0, 30.0,
            20.0, -10.0, -10.0,
            200.0, -100.0, -100.0,
            29500.0
        ), (
            '2026-08-18', '09:05', 6810.0, 1072.0, 832.0, 14050.0,
            250.0, -120.0, -130.0, 80.0,
            40.0, -20.0, -20.0,
            350.0, -200.0, -150.0,
            29550.5
        ), (
            '2026-08-19', '09:00', 6850.0, 1078.0, 835.0, 14100.0,
            300.0, -100.0, -200.0, 100.0,
            50.0, -30.0, -20.0,
            500.0, -300.0, -200.0,
            29600.0
        )
    """)
    conn.commit()
    conn.close()

    orig_expanduser = os.path.expanduser

    def fake_expanduser(path):
        if path == "~/.cache/db/macro.db":
            return str(db_path)
        return orig_expanduser(path)

    monkeypatch.setattr(os.path, "expanduser", fake_expanduser)
    return db_path


def test_get_market_flow_dates(mock_macro_db):
    """market-flow/dates 엔드포인트가 고유 날짜 리스트를 반환하는지 테스트."""
    response = client.get("/api/charts/market-flow/dates")
    assert response.status_code == 200
    data = response.json()
    assert data == ["2026-08-18", "2026-08-19"]


def test_get_market_flow_data_with_emini(mock_macro_db):
    """market-flow 엔드포인트가 emini_nasdaq_price를 포함하여 반환하는지 테스트."""
    response = client.get("/api/charts/market-flow?start_date=2026-08-18&end_date=2026-08-18")
    assert response.status_code == 200
    res = response.json()
    assert "data" in res
    assert len(res["data"]) == 2

    p0 = res["data"][0]
    assert p0["date"] == "2026-08-18"
    assert p0["time"] == "09:00"
    assert p0["kospi_price"] == 6800.0
    assert p0["kospi200_price"] == 1070.0
    assert p0["kospi_foreigner"] == 100.0
    assert p0["emini_nasdaq_price"] == 29500.0

    p1 = res["data"][1]
    assert p1["time"] == "09:05"
    assert p1["emini_nasdaq_price"] == 29550.5


def test_get_market_flow_missing_db(monkeypatch, tmp_path):
    """DB 파일이 없을 때 빈 리스트를 반환하는지 테스트."""
    missing_path = tmp_path / "non_existent.db"
    monkeypatch.setattr(os.path, "expanduser", lambda p: str(missing_path) if "macro.db" in p else p)

    response = client.get("/api/charts/market-flow")
    assert response.status_code == 200
    assert response.json() == {"data": []}

    response_dates = client.get("/api/charts/market-flow/dates")
    assert response_dates.status_code == 200
    assert response_dates.json() == []
