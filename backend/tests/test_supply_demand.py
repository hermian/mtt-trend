"""수급 분석 API 테스트 (#43)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture()
def sugeub_available():
    from pathlib import Path

    db = Path.home() / ".cache" / "db" / "sugeub.sqlite"
    marcap = Path.home() / ".cache" / "db" / "marcap.duckdb"
    if not db.is_file() or not marcap.is_file():
        pytest.skip("sugeub.sqlite or marcap.duckdb not available")
    return True


def test_supply_demand_api_kr_stock(sugeub_available):
    response = client.get("/api/charts/supply-demand?code=039490")
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "039490"
    assert data["name"]
    assert len(data["series"]) > 0
    assert len(data["table_supply"]) > 0
    assert len(data["table_lds"]) > 0
    assert len(data["period_sums"]) == 13

    pt = data["series"][-1]
    assert "date" in pt
    assert "close" in pt
    assert "force_oscillator" in pt
    assert "accumulation_3ma" in pt
    assert "dispersion_pct" in pt
    assert "norm_accumulation" in pt
    assert "period_sums_by_preset" in data
    assert "1m" in data["period_sums_by_preset"]
    assert "3m" in data["period_sums_by_preset"]


def test_supply_demand_sum_period_presets(sugeub_available):
    for preset in ("1m", "3m", "6m", "12m"):
        response = client.get(f"/api/charts/supply-demand?code=005930&sum={preset}")
        assert response.status_code == 200
        data = response.json()
        assert data["sum_period"]["preset"] == preset
        assert len(data["period_sums"]) > 0


def test_supply_demand_api_invalid_code():
    response = client.get("/api/charts/supply-demand?code=INVALID_XYZ_999")
    assert response.status_code == 404


def test_supply_demand_api_missing_code():
    response = client.get("/api/charts/supply-demand")
    assert response.status_code == 422


def test_supply_demand_price_profile_1y_default(sugeub_available):
    response = client.get("/api/charts/supply-demand/price-profile?code=005930")
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "005930"
    assert data["name"]
    assert data["preset"] == "1y"
    assert len(data["bins"]) >= 3
    assert "개인" in data["investors"]
    assert "외국인" in data["investors"]
    assert "금융투자" in data["investors"]
    assert "연기금" in data["investors"]
    for b in data["bins"]:
        assert "price_low" in b
        assert "price_high" in b
        assert "price_label" in b
        assert "개인" in b
        assert "외국인" in b
        assert "금융투자" in b
        assert "연기금" in b


def test_supply_demand_price_profile_custom_dates(sugeub_available):
    response = client.get(
        "/api/charts/supply-demand/price-profile?code=222800&start=2026-01-02&end=2026-08-28&bins=7"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "222800"
    assert data["start"] == "2026-01-02"
    assert data["end"] == "2026-08-28"
    assert len(data["bins"]) >= 5


def test_supply_demand_price_profile_invalid_code():
    response = client.get("/api/charts/supply-demand/price-profile?code=INVALID_CODE_999")
    assert response.status_code == 404

