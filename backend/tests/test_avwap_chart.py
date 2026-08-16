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
    assert "h52_chg" in last_pt
    assert "vix_fix" in last_pt
    assert last_pt["mdd"] is not None
    assert last_pt["h52_chg"] is not None
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
    assert "h52_chg" in last_pt
    assert last_pt["mdd"] is not None
    assert last_pt["h52_chg"] is not None

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


def test_etf_search():
    # ETF search
    res = client.get("/api/charts/stocks/search?q=KODEX&type=etf")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]["market"] == "ETF"

    # Search with type=stock should only return non-ETF
    res_stk = client.get("/api/charts/stocks/search?q=삼성&type=stock")
    assert res_stk.status_code == 200
    data_stk = res_stk.json()
    assert len(data_stk) > 0
    assert all(item["market"] in ("KOSPI", "KOSDAQ") for item in data_stk)


def test_avwap_etf_by_code_and_name():
    # By code (069500: KODEX 200)
    res_code = client.get("/api/charts/avwap?market=etf&symbol=069500&interval=1D")
    assert res_code.status_code == 200
    data = res_code.json()
    assert data["symbol"] == "069500"
    assert data["market"] == "ETF"
    assert "KODEX 200" in data["name"]
    assert data["amount_unit"] == "억원"
    assert len(data["points"]) > 0
    assert len(data["anchors"]) > 0
    last_pt = data["points"][-1]
    assert "amount" in last_pt
    assert "amount_sma50" in last_pt
    assert "mdd" in last_pt
    assert "h52_chg" in last_pt
    assert last_pt["mdd"] is not None
    assert last_pt["h52_chg"] is not None

    # By name (KODEX 200)
    res_name = client.get("/api/charts/avwap?symbol=KODEX 200&interval=1W")
    assert res_name.status_code == 200
    data_name = res_name.json()
    assert data_name["symbol"] == "069500"
    assert data_name["market"] == "ETF"
    assert "KODEX 200" in data_name["name"]
    assert data_name["interval"] == "1W"


def test_avwap_us_indices():
    for market in ["sp500", "nasdaq100", "dow"]:
        for interval in ["1D", "1W", "1M", "1Y"]:
            res = client.get(f"/api/charts/avwap?market={market}&interval={interval}")
            assert res.status_code == 200
            data = res.json()
            assert data["interval"] == interval
            assert data["amount_unit"] == "조$"
            assert len(data["points"]) > 0
            assert len(data["anchors"]) > 0
            last_pt = data["points"][-1]
            assert "close" in last_pt
            assert "vwap" in last_pt
            assert "hvwap" in last_pt
            assert "lvwap" in last_pt
            assert "rsi" in last_pt
            assert "mdd" in last_pt
            assert "h52_chg" in last_pt
            assert "vix_fix" in last_pt
            assert "amount" in last_pt
            assert "amount_sma50" in last_pt


def test_custom_avwap_anchor_crud(monkeypatch, tmp_path):
    test_db = tmp_path / "user_anchors.db"
    monkeypatch.setenv("MTT_USER_ANCHORS_DB_PATH", str(test_db))

    from app.utils.avwap_utils import invalidate_avwap_cache
    invalidate_avwap_cache()

    # 1. Create custom anchor for sp500
    create_res = client.post(
        "/api/charts/avwap/anchors",
        json={
            "market_or_symbol": "sp500",
            "anchor_date": "2025-01-15",
            "label": "2025년 1월 변곡점",
            "color": "#10b981",
            "interval_mask": "ALL"
        }
    )
    assert create_res.status_code == 200
    created = create_res.json()
    anchor_id = created["id"]
    assert created["market_or_symbol"] == "sp500"
    assert created["anchor_date"] == "2025-01-15"
    assert created["label"] == "2025년 1월 변곡점"
    assert created["color"] == "#10b981"

    # 2. List custom anchors
    list_res = client.get("/api/charts/avwap/anchors?target=sp500")
    assert list_res.status_code == 200
    anchors = list_res.json()
    assert any(a["id"] == anchor_id for a in anchors)

    # 3. Verify that the created anchor is included in avwap chart response
    chart_res = client.get("/api/charts/avwap?market=sp500&interval=1D")
    assert chart_res.status_code == 200
    chart_data = chart_res.json()
    assert any(a["id"] == anchor_id for a in chart_data["anchors"])

    # 4. Update custom anchor
    update_res = client.put(
        f"/api/charts/avwap/anchors/{anchor_id}",
        json={
            "label": "2025년 1월 수정 라벨",
            "color": "#3b82f6"
        }
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["label"] == "2025년 1월 수정 라벨"
    assert updated["color"] == "#3b82f6"

    # 5. Delete custom anchor
    del_res = client.delete(f"/api/charts/avwap/anchors/{anchor_id}")
    assert del_res.status_code == 200

    # 6. Verify deleted
    list_after = client.get("/api/charts/avwap/anchors?target=sp500").json()
    assert not any(a["id"] == anchor_id for a in list_after)

    # 7. Delete (suppress) a system preset anchor (e.g. 2018-12-24 for sp500)
    chart_before = client.get("/api/charts/avwap?market=sp500&interval=1D").json()
    assert any(a["anchor_date"] == "2018-12-24" for a in chart_before["anchors"])

    del_sys_res = client.delete("/api/charts/avwap/anchors/anchor_20181224?target=sp500&anchor_date=2018-12-24")
    assert del_sys_res.status_code == 200

    chart_after_sys_del = client.get("/api/charts/avwap?market=sp500&interval=1D").json()
    assert not any(a["anchor_date"] == "2018-12-24" for a in chart_after_sys_del["anchors"])

    # 8. Reset all anchors back to system defaults
    reset_res = client.post("/api/charts/avwap/anchors/reset?target=sp500")
    assert reset_res.status_code == 200

    chart_after_reset = client.get("/api/charts/avwap?market=sp500&interval=1D").json()
    assert any(a["anchor_date"] == "2018-12-24" for a in chart_after_reset["anchors"])





