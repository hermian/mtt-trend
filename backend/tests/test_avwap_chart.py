import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_avwap_kospi_1d():
    response = client.get("/api/charts/avwap?market=kospi&interval=1D")
    assert response.status_code == 200
    data = response.json()
    assert data["market"] == "kospi"
    assert data["interval"] == "1D"
    assert len(data["points"]) > 0
    
    first_pt = data["points"][0]
    last_pt = data["points"][-1]
    assert "date" in first_pt
    assert "open" in first_pt
    assert "high" in first_pt
    assert "low" in first_pt
    assert "close" in first_pt
    assert "volume" in first_pt
    assert "ma" in last_pt
    assert "EMA_10" in last_pt["ma"]
    assert "SMA_50" in last_pt["ma"]
    assert "vwap" in last_pt
    assert "hvwap" in last_pt
    assert "lvwap" in last_pt
    assert "amount" in last_pt
    assert "amount_sma50" in last_pt
    assert last_pt["amount"] is not None
    assert last_pt["amount_sma50"] is not None
    assert "rsi" in last_pt
    assert "vix_fix" in last_pt
    assert len(data["anchors"]) > 0


def test_avwap_kospi_1w():
    response = client.get("/api/charts/avwap?market=kospi&interval=1W")
    assert response.status_code == 200
    data = response.json()
    assert data["interval"] == "1W"
    assert len(data["points"]) > 0
    last_pt = data["points"][-1]
    assert "SMA_10" in last_pt["ma"]
    assert "SMA_30" in last_pt["ma"]


def test_avwap_kospi_1m():
    response = client.get("/api/charts/avwap?market=kospi&interval=1M")
    assert response.status_code == 200
    data = response.json()
    assert data["interval"] == "1M"
    assert len(data["points"]) > 0
    last_pt = data["points"][-1]
    assert "SMA_6" in last_pt["ma"]
    assert "SMA_12" in last_pt["ma"]


def test_avwap_kospi_1y():
    response = client.get("/api/charts/avwap?market=kospi&interval=1Y")
    assert response.status_code == 200
    data = response.json()
    assert data["interval"] == "1Y"
    assert len(data["points"]) > 0
    last_pt = data["points"][-1]
    assert "SMA_3" in last_pt["ma"]
    assert "SMA_5" in last_pt["ma"]
    assert "SMA_10" in last_pt["ma"]


def test_avwap_kosdaq():
    for interval in ["1D", "1W", "1M", "1Y"]:
        response = client.get(f"/api/charts/avwap?market=kosdaq&interval={interval}")
        assert response.status_code == 200
        data = response.json()
        assert data["market"] == "kosdaq"
        assert data["interval"] == interval
        assert len(data["points"]) > 0
