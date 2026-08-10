import pytest
import sqlite3
import datetime
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
import app.utils.etf_heatmap_utils as mod

client = TestClient(app)

@pytest.fixture
def mock_etf_db(tmp_path, monkeypatch):
    etf_db_path = tmp_path / "etf_price.db"
    macro_db_path = tmp_path / "macro.db"
    us_price_db_path = tmp_path / "etf_us_price.db"
    us_master_db_path = tmp_path / "etf_us_master.db"

    # KR ETF db
    conn = sqlite3.connect(str(etf_db_path))
    conn.execute("CREATE TABLE etf_price (종목코드 TEXT, 날짜 TEXT, 종가 REAL)")
    # Sample ETF data: target date = 2026-08-10 (Monday)
    # 1W ago = 2026-08-03
    conn.execute("INSERT INTO etf_price VALUES ('069500', '2026-08-10 15:30:00', 110.0)")
    conn.execute("INSERT INTO etf_price VALUES ('069500', '2026-08-09 15:30:00', 108.0)")
    conn.execute("INSERT INTO etf_price VALUES ('069500', '2026-08-03 15:30:00', 100.0)")
    conn.commit()
    conn.close()

    # Macro db
    conn = sqlite3.connect(str(macro_db_path))
    conn.execute("CREATE TABLE index_ohlcv (index_name TEXT, date TEXT, close REAL)")
    conn.execute("INSERT INTO index_ohlcv VALUES ('kospi', '2026-08-10', 2500.0)")
    conn.execute("INSERT INTO index_ohlcv VALUES ('kospi', '2026-08-03', 2400.0)")
    conn.commit()
    conn.close()

    # US ETF price db
    conn = sqlite3.connect(str(us_price_db_path))
    conn.execute("CREATE TABLE etf_us_price (Code TEXT, Date TEXT, Close REAL)")
    conn.execute("INSERT INTO etf_us_price VALUES ('QQQ.O', '2026-08-10 16:00:00', 500.0)")
    conn.execute("INSERT INTO etf_us_price VALUES ('QQQ.O', '2026-08-03 16:00:00', 450.0)")
    conn.commit()
    conn.close()

    # US master db
    conn = sqlite3.connect(str(us_master_db_path))
    conn.execute("CREATE TABLE etf_master (Symbol TEXT, url TEXT)")
    conn.execute("INSERT INTO etf_master VALUES ('QQQ', 'QQQ.O')")
    conn.commit()
    conn.close()

    def mock_get_db_paths():
        return etf_db_path, macro_db_path

    monkeypatch.setattr(mod, "get_db_paths", mock_get_db_paths)

    orig_load = mod.load_etf_heatmap_data
    def patched_load(market="KR", target_date_str=None):
        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        cache_db = tmp_path / ".cache" / "db"
        cache_db.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.copy(etf_db_path, cache_db / "etf_price.db")
        shutil.copy(macro_db_path, cache_db / "macro.db")
        shutil.copy(us_price_db_path, cache_db / "etf_us_price.db")
        shutil.copy(us_master_db_path, cache_db / "etf_us_master.db")
        return orig_load(market=market, target_date_str=target_date_str)

    monkeypatch.setattr(mod, "load_etf_heatmap_data", patched_load)

def test_etf_heatmap_1w_return(mock_etf_db):
    res = client.get("/api/etf/heatmap?market=KR&date=2026-08-10")
    assert res.status_code == 200
    data = res.json()
    assert data["market"] == "KR"
    assert data["as_of_date"] == "2026-08-10"

    found_etf = None
    for group in data["groups"]:
        for etf in group["etfs"]:
            if etf["code"] == "069500":
                found_etf = etf
                break
        if found_etf:
            break

    assert found_etf is not None
    # 1W return: (110.0 - 100.0) / 100.0 * 100 = 10.0%
    assert found_etf["returns"]["1W"] == 10.0
