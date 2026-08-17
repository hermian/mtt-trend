# backend/tests/test_api_returns_compare.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_compare_returns_empty():
    payload = {"items": [], "start_date": "2025-08-01", "end_date": "2026-08-01"}
    response = client.post("/api/charts/returns/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["series"] == []
    assert data["statistics"] == []


def test_compare_returns_kr_stock_and_us_stock():
    payload = {
        "items": [
            {"code": "005930", "market": "KOSPI", "type": "stock", "name": "삼성전자"},
            {"code": "NVDA", "market": "US", "type": "us_stock", "name": "NVIDIA"},
        ],
        "start_date": "2025-08-01",
        "end_date": "2026-08-14",
    }
    response = client.post("/api/charts/returns/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["series"]) == 2
    assert len(data["statistics"]) == 2

    # Check series
    samsung_s = next((s for s in data["series"] if s["code"] == "005930"), None)
    nvda_s = next((s for s in data["series"] if s["code"] == "NVDA"), None)
    assert samsung_s is not None
    assert nvda_s is not None
    assert len(samsung_s["data"]) > 0
    assert len(nvda_s["data"]) > 0

    # First point return_pct should be 0.0
    assert samsung_s["data"][0]["return_pct"] == 0.0
    assert nvda_s["data"][0]["return_pct"] == 0.0

    # Check statistics
    samsung_st = next((s for s in data["statistics"] if s["code"] == "005930"), None)
    nvda_st = next((s for s in data["statistics"] if s["code"] == "NVDA"), None)
    assert samsung_st is not None
    assert nvda_st is not None
    assert samsung_st["currency"] == "KRW"
    assert nvda_st["currency"] == "USD"
    assert samsung_st["start_price"] > 0
    assert nvda_st["start_price"] > 0

    # Check correlations
    corrs = data["correlations"]
    assert "3M" in corrs
    assert "6M" in corrs


def test_compare_returns_kr_etf_and_us_etf():
    payload = {
        "items": [
            {"code": "069500", "market": "ETF", "type": "etf", "name": "KODEX 200"},
            {"code": "SPY", "market": "US_ETF", "type": "us_etf", "name": "SPDR S&P 500"},
        ],
        "start_date": "2025-08-01",
        "end_date": "2026-08-14",
    }
    response = client.post("/api/charts/returns/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["series"]) == 2
    assert len(data["statistics"]) == 2
    assert len(data["rolling_correlations"]["3M"]) > 0
