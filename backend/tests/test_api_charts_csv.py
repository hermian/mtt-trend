import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_kodex_leverage_chart_data():
    """
    KODEX 레버리지 CSV 데이터가 올바르게 반환되는지 테스트합니다.
    """
    response = client.get("/api/charts/data?symbol=kodex_leverage")
    assert response.status_code == 200
    
    data = response.json()
    assert data["symbol"] == "kodex_leverage"
    assert len(data["data"]) > 0
    
    # 첫 번째 데이터 포인트 검증
    first_point = data["data"][0]
    assert "time" in first_point
    assert "open" in first_point
    assert "close" in first_point
    assert "indicators" in first_point
    
    indicators = first_point["indicators"]
    assert "sma10" in indicators
    assert "adr14" in indicators
    assert "sma200" in indicators

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

def test_get_dummy_chart_data():
    """
    일반 종목에 대해 더미 데이터가 반환되는지 테스트합니다.
    """
    response = client.get("/api/charts/data?symbol=KOSPI")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "KOSPI"
    # 더미 데이터는 기본적으로 100개를 반환함 (routers/charts.py 참고)
    assert len(data["data"]) == 100
