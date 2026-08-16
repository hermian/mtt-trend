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
    assert "mdd" in last_pt
    assert "vix_fix" in last_pt
    assert last_pt["mdd"] is not None
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


def test_stock_search():
    response = client.get("/api/charts/stocks/search?q=삼성")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first = data[0]
    assert "code" in first
    assert "name" in first
    assert "market" in first


def test_avwap_stock_by_code_and_name():
    # By code (Samsung Electronics)
    res_code = client.get("/api/charts/avwap?symbol=005930&interval=1D")
    assert res_code.status_code == 200
    data = res_code.json()
    assert data["symbol"] == "005930"
    assert "삼성전자" in data["name"]
    assert data["amount_unit"] == "억원"
    assert len(data["points"]) > 0
    assert len(data["anchors"]) > 0
    last_pt = data["points"][-1]
    assert "amount" in last_pt
    assert "amount_sma50" in last_pt
    assert "mdd" in last_pt
    assert last_pt["mdd"] is not None

    # By name (SK Hynix)
    res_name = client.get("/api/charts/avwap?symbol=SK하이닉스&interval=1W")
    assert res_name.status_code == 200
    data_name = res_name.json()
    assert data_name["symbol"] == "000660"
    assert "SK하이닉스" in data_name["name"]
    assert data_name["interval"] == "1W"

    # Non-existent stock returns 404
    res_404 = client.get("/api/charts/avwap?symbol=999999&interval=1D")
    assert res_404.status_code == 404
