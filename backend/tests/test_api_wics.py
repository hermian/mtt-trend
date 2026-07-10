import os
import sqlite3
import tempfile
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture
def temp_stock_master_db(monkeypatch):
    # Create temp DB file
    fd, db_path_str = tempfile.mkstemp(suffix=".db")
    conn = sqlite3.connect(db_path_str)
    cursor = conn.cursor()

    # Create table
    cursor.execute("""
        CREATE TABLE wics_monthly_rankings (
            date TEXT,
            YearMonth TEXT,
            WICS TEXT,
            EW_12m_Return REAL,
            MC_12m_Return REAL,
            Rank_EW INTEGER,
            Rank_MC INTEGER,
            Top2_Share REAL,
            Display_EW TEXT,
            Display_MC TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE wics_monthly_rankings_top_stocks (
            date TEXT,
            YearMonth TEXT,
            WICS TEXT,
            stock_code TEXT,
            stock_name TEXT,
            stock_12m_return REAL,
            sector_weight REAL,
            marcap REAL,
            rank_in_sector INTEGER
        )
    """)
    cursor.execute("""
        CREATE TABLE wics_weekly_rankings (
            date TEXT,
            YearWeek TEXT,
            WICS TEXT,
            EW_12m_Return REAL,
            MC_12m_Return REAL,
            Rank_EW INTEGER,
            Rank_MC INTEGER,
            Top2_Share REAL,
            Display_EW TEXT,
            Display_MC TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE wics_weekly_rankings_top_stocks (
            date TEXT,
            YearWeek TEXT,
            WICS TEXT,
            stock_code TEXT,
            stock_name TEXT,
            stock_12m_return REAL,
            sector_weight REAL,
            marcap REAL,
            rank_in_sector INTEGER
        )
    """)

    # Insert dummy data
    dummy_data = [
        ("2026-06-30", "2026-06", "IT서비스", 0.1, 0.2, 2, 1, 0.5, "IT서비스 (10%)", "IT서비스 (20%)"),
        ("2026-06-30", "2026-06", "가구", -0.1, -0.2, 1, 2, 0.6, "가구 (-10%)", "가구 (-20%)"),
        ("2026-07-06", "2026-07", "IT서비스", 0.15, 0.25, 1, 2, 0.5, "IT서비스 (15%)", "IT서비스 (25%)"),
        ("2026-07-06", "2026-07", "가구", 0.2, 0.3, 2, 1, 0.6, "가구 (20%)", "가구 (30%)")
    ]
    cursor.executemany("""
        INSERT INTO wics_monthly_rankings (date, YearMonth, WICS, EW_12m_Return, MC_12m_Return, Rank_EW, Rank_MC, Top2_Share, Display_EW, Display_MC)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, dummy_data)

    dummy_weekly_data = [
        ("2026-06-26", "2026-W26", "IT서비스", 0.11, 0.21, 2, 1, 0.51, "IT서비스 (11%)", "IT서비스 (21%)"),
        ("2026-06-26", "2026-W26", "가구", -0.11, -0.21, 1, 2, 0.61, "가구 (-11%)", "가구 (-21%)"),
        ("2026-07-03", "2026-W27", "IT서비스", 0.16, 0.26, 1, 2, 0.52, "IT서비스 (16%)", "IT서비스 (26%)"),
        ("2026-07-03", "2026-W27", "가구", 0.21, 0.31, 2, 1, 0.62, "가구 (21%)", "가구 (31%)")
    ]
    cursor.executemany("""
        INSERT INTO wics_weekly_rankings (date, YearWeek, WICS, EW_12m_Return, MC_12m_Return, Rank_EW, Rank_MC, Top2_Share, Display_EW, Display_MC)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, dummy_weekly_data)

    dummy_top_stocks = [
        ("2026-06-30", "2026-06", "IT서비스", "005930", "삼성전자", 0.05, 0.4, 300000.0, 1),
        ("2026-06-30", "2026-06", "IT서비스", "000660", "SK하이닉스", 0.1, 0.1, 80000.0, 2)
    ]
    cursor.executemany("""
        INSERT INTO wics_monthly_rankings_top_stocks (date, YearMonth, WICS, stock_code, stock_name, stock_12m_return, sector_weight, marcap, rank_in_sector)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, dummy_top_stocks)

    dummy_weekly_top_stocks = [
        ("2026-06-26", "2026-W26", "IT서비스", "005930", "삼성전자", 0.06, 0.41, 301000.0, 1),
        ("2026-06-26", "2026-W26", "IT서비스", "000660", "SK하이닉스", 0.11, 0.11, 81000.0, 2)
    ]
    cursor.executemany("""
        INSERT INTO wics_weekly_rankings_top_stocks (date, YearWeek, WICS, stock_code, stock_name, stock_12m_return, sector_weight, marcap, rank_in_sector)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, dummy_weekly_top_stocks)

    conn.commit()
    conn.close()
    os.close(fd)

    # Mock environment variable or helper method
    monkeypatch.setenv("STOCK_MASTER_DB_PATH", db_path_str)

    yield db_path_str

    try:
        os.remove(db_path_str)
    except OSError:
        pass

def test_get_wics_months(temp_stock_master_db):
    response = client.get("/api/charts/wics-months")
    assert response.status_code == 200
    data = response.json()
    assert "months" in data
    assert data["months"] == ["2026-06", "2026-07"]

def test_get_wics_rankings(temp_stock_master_db):
    response = client.get("/api/charts/wics-rankings")
    assert response.status_code == 200
    data = response.json()
    assert "months" in data
    assert len(data["months"]) == 2

    # Check first month
    m1 = data["months"][0]
    assert m1["YearMonth"] == "2026-06"
    assert len(m1["rankings"]) == 2
    
    # Check that top_stocks are attached for IT서비스
    it_service = [r for r in m1["rankings"] if r["WICS"] == "IT서비스"][0]
    assert "top_stocks" in it_service
    assert len(it_service["top_stocks"]) == 2
    assert it_service["top_stocks"][0]["stock_name"] == "삼성전자"
    assert it_service["top_stocks"][0]["stock_code"] == "005930"
    assert it_service["top_stocks"][0]["stock_12m_return"] == 0.05
    assert it_service["top_stocks"][0]["sector_weight"] == 0.4
    assert it_service["top_stocks"][0]["marcap"] == 300000.0

    wics_names = [r["WICS"] for r in m1["rankings"]]
    assert "IT서비스" in wics_names
    assert "가구" in wics_names

    # Check filter
    response_filtered = client.get("/api/charts/wics-rankings?start_month=2026-07&end_month=2026-07")
    assert response_filtered.status_code == 200
    data_filtered = response_filtered.json()
    assert len(data_filtered["months"]) == 1
    assert data_filtered["months"][0]["YearMonth"] == "2026-07"
    assert data_filtered["months"][0]["YearMonth"] == "2026-07"

def test_get_wics_weeks(temp_stock_master_db):
    response = client.get("/api/charts/wics-weeks")
    assert response.status_code == 200
    data = response.json()
    assert "weeks" in data
    assert data["weeks"] == ["2026-W26", "2026-W27"]

def test_get_wics_weekly_rankings(temp_stock_master_db):
    response = client.get("/api/charts/wics-rankings/weekly")
    assert response.status_code == 200
    data = response.json()
    assert "months" in data
    assert len(data["months"]) == 2

    w1 = data["months"][0]
    assert w1["YearMonth"] == "2026-W26"
    assert len(w1["rankings"]) == 2

    it_service = [r for r in w1["rankings"] if r["WICS"] == "IT서비스"][0]
    assert "top_stocks" in it_service
    assert len(it_service["top_stocks"]) == 2
    assert it_service["top_stocks"][0]["stock_name"] == "삼성전자"
    assert it_service["top_stocks"][0]["stock_code"] == "005930"

    # Check filter
    response_filtered = client.get("/api/charts/wics-rankings/weekly?start_week=2026-W27&end_week=2026-W27")
    assert response_filtered.status_code == 200
    data_filtered = response_filtered.json()
    assert len(data_filtered["months"]) == 1
    assert data_filtered["months"][0]["YearMonth"] == "2026-W27"
