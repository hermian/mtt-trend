import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.utils.avwap_utils import invalidate_avwap_cache

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolate_user_anchors(monkeypatch, tmp_path):
    test_db = tmp_path / "test_user_anchors.db"
    monkeypatch.setenv("MTT_USER_ANCHORS_DB_PATH", str(test_db))
    invalidate_avwap_cache()
    yield
    invalidate_avwap_cache()


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
            assert last_pt["amount"] is not None and last_pt["amount"] > 0
            assert last_pt["amount_sma50"] is not None and last_pt["amount_sma50"] > 0
            # Verify no 0 amount points in the 2024-08-12 ~ 2026-08-04 range
            if interval == "1D" and market in ("sp500", "nasdaq100"):
                sub_pts = [p for p in data["points"] if "2024-08-12" <= p["date"] <= "2026-08-04"]
                assert len(sub_pts) > 0
                assert all(p["amount"] is not None and p["amount"] > 0 for p in sub_pts)



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
def test_us_stock_search_and_avwap():
    # 1. US Stock search by ticker (AAPL) and Korean name (애플, 테슬라)
    res_ticker = client.get("/api/charts/stocks/search?q=AAPL&type=stock")
    assert res_ticker.status_code == 200
    data_ticker = res_ticker.json()
    assert len(data_ticker) > 0
    assert any(item["code"] == "AAPL" for item in data_ticker)

    res_ko = client.get("/api/charts/stocks/search?q=애플&type=stock")
    assert res_ko.status_code == 200
    data_ko = res_ko.json()
    assert len(data_ko) > 0
    assert any(item["code"] == "AAPL" for item in data_ko)

    # 2. AVWAP chart data for AAPL across intervals
    for interval in ["1D", "1W", "1M", "1Y"]:
        res = client.get(f"/api/charts/avwap?symbol=AAPL&interval={interval}")
        assert res.status_code == 200
        data = res.json()
        assert data["symbol"] == "AAPL"
        assert data["interval"] == interval
        assert data["amount_unit"] == "백만$"
        assert len(data["points"]) > 0
        assert len(data["anchors"]) > 0
        last_pt = data["points"][-1]
        assert "amount" in last_pt
        assert "amount_sma50" in last_pt
        assert "vwap" in last_pt
        assert "rsi" in last_pt
        assert "mdd" in last_pt
        assert "h52_chg" in last_pt

    # 3. AVWAP chart data by Korean name (엔비디아)
    res_nvda = client.get("/api/charts/avwap?symbol=엔비디아&interval=1D")
    assert res_nvda.status_code == 200
    data_nvda = res_nvda.json()
    assert data_nvda["symbol"] == "NVDA"
    assert data_nvda["amount_unit"] == "백만$"
    assert len(data_nvda["points"]) > 0


def test_us_etf_search_and_avwap():
    # 1. US ETF search (QQQ, SPY, SOXX, TQQQ)
    res_qqq = client.get("/api/charts/stocks/search?q=QQQ&type=etf")
    assert res_qqq.status_code == 200
    data_qqq = res_qqq.json()
    assert len(data_qqq) > 0
    assert any(item["code"] == "QQQ" for item in data_qqq)
    assert any(item["market"] == "US_ETF" for item in data_qqq)

    # 2. AVWAP chart data for QQQ across intervals
    for interval in ["1D", "1W", "1M", "1Y"]:
        res = client.get(f"/api/charts/avwap?market=etf&symbol=QQQ&interval={interval}")
        assert res.status_code == 200
        data = res.json()
        assert data["market"] == "US_ETF"
        assert data["interval"] == interval
        assert data["amount_unit"] == "백만$"
        assert len(data["points"]) > 0
        assert len(data["anchors"]) > 0

    # 3. AVWAP chart data for SPY
    res_spy = client.get("/api/charts/avwap?symbol=SPY&interval=1D")
    assert res_spy.status_code == 200
    data_spy = res_spy.json()
    assert data_spy["market"] == "US_ETF"
    assert len(data_spy["points"]) > 0


def test_search_all_asset_types():
    res_all = client.get("/api/charts/stocks/search?q=SPY&type=all")
    assert res_all.status_code == 200
    data = res_all.json()
    assert len(data) > 0
    assert any(item["code"] == "SPY" and item["market"] == "US_ETF" for item in data)


def test_search_by_market_kr_and_us():
    # 1. KR Stock search should only return KR stocks
    res_kr_stock = client.get("/api/charts/stocks/search?q=삼성&type=stock&market=kr")
    assert res_kr_stock.status_code == 200
    data_kr_stk = res_kr_stock.json()
    assert len(data_kr_stk) > 0
    assert all(item["market"] in ("KOSPI", "KOSDAQ", "KONEX") for item in data_kr_stk)

    # KR stock search for US ticker should return nothing
    res_kr_no_us = client.get("/api/charts/stocks/search?q=AAPL&type=stock&market=kr")
    assert res_kr_no_us.status_code == 200
    assert len(res_kr_no_us.json()) == 0

    # 2. US Stock search should only return US stocks
    res_us_stock = client.get("/api/charts/stocks/search?q=AAPL&type=stock&market=us")
    assert res_us_stock.status_code == 200
    data_us_stk = res_us_stock.json()
    assert len(data_us_stk) > 0
    assert all(item["market"] in ("NASDAQ", "NYSE", "AMEX", "US") for item in data_us_stk)
    assert any(item["code"] == "AAPL" for item in data_us_stk)

    # 3. KR ETF search should only return KR ETFs
    res_kr_etf = client.get("/api/charts/stocks/search?q=KODEX&type=etf&market=kr")
    assert res_kr_etf.status_code == 200
    data_kr_etf = res_kr_etf.json()
    assert len(data_kr_etf) > 0
    assert all(item["market"] == "ETF" for item in data_kr_etf)

    # KR ETF search for US ETF should return nothing
    res_kr_no_us_etf = client.get("/api/charts/stocks/search?q=QQQ&type=etf&market=kr")
    assert res_kr_no_us_etf.status_code == 200
    assert len(res_kr_no_us_etf.json()) == 0

    # 4. US ETF search should only return US ETFs
    res_us_etf = client.get("/api/charts/stocks/search?q=QQQ&type=etf&market=us")
    assert res_us_etf.status_code == 200
    data_us_etf = res_us_etf.json()
    assert len(data_us_etf) > 0
    assert all(item["market"] == "US_ETF" for item in data_us_etf)
    assert any(item["code"] == "QQQ" for item in data_us_etf)