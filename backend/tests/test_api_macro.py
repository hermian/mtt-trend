import pytest
import sqlite3
import os
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture
def temp_macro_db(monkeypatch):
    # 임시 DB 파일 생성
    fd, db_path_str = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_path = Path(db_path_str)
    
    # DB 초기화 및 테스트 데이터 적재
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE index_ohlcv (
            date TEXT NOT NULL,
            index_name TEXT NOT NULL,
            close REAL,
            PRIMARY KEY (date, index_name)
        )
    """)
    cursor.execute("""
        CREATE TABLE fred_macro (
            date TEXT NOT NULL,
            series_id TEXT NOT NULL,
            value REAL,
            PRIMARY KEY (date, series_id)
        )
    """)
    cursor.execute("""
        CREATE TABLE cnn_fear_greed (
            date TEXT NOT NULL,
            value REAL,
            rating TEXT,
            PRIMARY KEY (date)
        )
    """)
    
    # Mock data 추가
    cursor.executemany("""
        INSERT INTO index_ohlcv (date, index_name, close) VALUES (?, ?, ?)
    """, [
        ("2026-06-24", "sp500", 5000.0),
        ("2026-06-25", "sp500", 5010.0),
        ("2026-06-26", "sp500", 5020.0),
    ])
    
    cursor.executemany("""
        INSERT INTO fred_macro (date, series_id, value) VALUES (?, ?, ?)
    """, [
        ("2026-06-24", "BAMLH0A0HYM2", 3.1),
        ("2026-06-25", "BAMLH0A0HYM2", 3.2),
        ("2026-06-26", "BAMLH0A0HYM2", 3.3),
    ])
    
    cursor.executemany("""
        INSERT INTO cnn_fear_greed (date, value, rating) VALUES (?, ?, ?)
    """, [
        ("2026-06-24", 45.0, "FEAR"),
        ("2026-06-25", 50.0, "NEUTRAL"),
        ("2026-06-26", 55.0, "GREED"),
    ])
    
    conn.commit()
    conn.close()
    
    # os.path.expanduser 모킹
    monkeypatch.setattr(os.path, "expanduser", lambda path: db_path_str if "macro.db" in path else path)
    
    yield db_path_str
    
    if os.path.exists(db_path_str):
        os.remove(db_path_str)

def test_get_macro_chart_data(temp_macro_db):
    response = client.get("/api/charts/macro")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert len(data["data"]) == 3
    
    pt = data["data"][0]
    assert pt["date"] == "2026-06-24"
    assert pt["sp500"] == 5000.0
    assert pt["high_yield"] == 3.1
    assert pt["cnn_fgi"] == 45.0
    
    # 날짜 필터 테스트
    response_filtered = client.get("/api/charts/macro?start_date=2026-06-25&end_date=2026-06-25")
    assert response_filtered.status_code == 200
    data_filtered = response_filtered.json()
    assert len(data_filtered["data"]) == 1
    assert data_filtered["data"][0]["date"] == "2026-06-25"
