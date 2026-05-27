import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_kodex_leverage_chart_data():
    """
    KODEX 레버리지 CSV(~/.cache/db/kodex_leverage/kodex_leverage.csv) 데이터가 올바르게 반환되는지 테스트합니다.
    """
    response = client.get("/api/charts/data?symbol=kodex_leverage")
    assert response.status_code == 200
    
    data = response.json()
    assert data["symbol"] == "KODEX_LEVERAGE"
    assert len(data["data"]) > 0
    
    # 첫 번째 데이터 포인트 검증
    first_point = data["data"][0]
    assert "time" in first_point
    assert "open" in first_point
    assert "close" in first_point
    assert "indicators" in first_point
    
    indicators = first_point["indicators"]
    assert "above_sma10" in indicators
    assert "adr14" in indicators
    assert "above_sma200" in indicators
    assert "disparity_sma50" in indicators

def test_get_kodex_leverage_with_filtering():
    """
    날짜 필터링이 올바르게 동작하는지 테스트합니다.
    """
    # 2026년 데이터만 요청
    response = client.get("/api/charts/data?symbol=kodex_leverage&start_date=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    
    for point in data["data"]:
        assert point["time"] >= "2026-01-01"

def test_get_unknown_symbol_returns_empty_chart_data():
    """
    레버리지 CSV에 없는 종목은 빈 data 배열을 반환합니다 (routers/charts.py).
    """
    response = client.get("/api/charts/data?symbol=unknown_index")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "UNKNOWN_INDEX"
    assert data["data"] == []

def test_get_new_indices_chart_data():
    """
    새로 추가된 시장 지수들(KOSPI, KOSDAQ 등)의 실제 데이터가 올바르게 반환되는지 테스트합니다.
    """
    for symbol in ["kospi", "kospi200", "kosdaq", "kosdaq150"]:
        response = client.get(f"/api/charts/data?symbol={symbol}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["symbol"] == symbol.upper()
        assert len(data["data"]) > 0
        
        # 첫 번째 데이터 포인트 검증
        first_point = data["data"][0]
        assert "time" in first_point
        assert "open" in first_point
        assert "close" in first_point
        assert "indicators" in first_point
        
        indicators = first_point["indicators"]
        assert "above_sma10" in indicators
        assert "adr14" in indicators
        assert "disparity_sma50" in indicators
