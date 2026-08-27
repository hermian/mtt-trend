"""GET /api/charts/trend-up-breadth API 및 유틸리티 단위 테스트."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.trend_up_breadth_utils import load_trend_up_breadth_data

client = TestClient(app)


def test_get_trend_up_breadth_endpoint_defaults():
    """기본 파라미터로 호출 시 정상 응답 (KRX 300 기본)."""
    response = client.get("/api/charts/trend-up-breadth")
    assert response.status_code == 200
    data = response.json()
    assert data["universe"] == "krx300"
    assert data["universe_name"] == "KRX 300"
    assert "breadth_data" in data
    assert "index_data" in data
    assert "distribution_daily" in data
    assert "distribution_5ma" in data

    dist_daily = data["distribution_daily"]
    assert "latest" in dist_daily
    assert "median" in dist_daily
    assert "percentile" in dist_daily
    assert "bins" in dist_daily
    assert len(dist_daily["bins"]) > 0


@pytest.mark.parametrize("universe,expected_name", [
    ("krx300", "KRX 300"),
    ("kospi", "KOSPI"),
    ("kosdaq", "KOSDAQ"),
    ("all", "전체 (KOSPI + KOSDAQ)"),
])
def test_get_trend_up_breadth_all_universes(universe, expected_name):
    """모든 유니버스(krx300, kospi, kosdaq, all)에 대한 응답 검증."""
    response = client.get(f"/api/charts/trend-up-breadth?universe={universe}&start_date=2024-01-01")
    assert response.status_code == 200
    data = response.json()
    assert data["universe"] == universe
    assert data["universe_name"] == expected_name
    assert len(data["breadth_data"]) > 0
    assert len(data["index_data"]) > 0

    first_point = data["breadth_data"][0]
    assert "time" in first_point
    assert "trend_up_ratio" in first_point
    assert "trend_up_ratio_5ma" in first_point
    assert "trend_up_stocks" in first_point
    assert "total_stocks" in first_point

    # 5일 이동평균 유효성
    last_point = data["breadth_data"][-1]
    assert last_point["trend_up_ratio"] is not None
    assert last_point["trend_up_ratio_5ma"] is not None


def test_get_trend_up_breadth_date_filtering():
    """날짜 필터링 (start_date, end_date) 작동 검증."""
    start_date = "2024-06-01"
    end_date = "2024-08-01"
    response = client.get(f"/api/charts/trend-up-breadth?universe=kospi&start_date={start_date}&end_date={end_date}")
    assert response.status_code == 200
    data = response.json()
    for pt in data["breadth_data"]:
        assert pt["time"] >= start_date
        assert pt["time"] <= end_date


def test_invalid_universe_fallback():
    """유효하지 않은 유니버스 입력 시 기본값(krx300)으로 대체 처리."""
    response = client.get("/api/charts/trend-up-breadth?universe=invalid_universe")
    assert response.status_code == 200
    data = response.json()
    assert data["universe"] == "krx300"
    assert data["universe_name"] == "KRX 300"
