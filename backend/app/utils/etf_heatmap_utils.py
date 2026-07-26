from __future__ import annotations
import sqlite3
import datetime
from pathlib import Path
import pandas as pd

from app.utils.etf_heatmap_config import ETF_HEATMAP_LAYOUT

def get_db_paths():
    db_dir = Path.home() / ".cache" / "db"
    return db_dir / "etf_price.db", db_dir / "macro.db"

def get_index_close_price(conn: sqlite3.Connection, index_name: str, target_date_str: str) -> float | None:
    """Find the close price of the closest trading date <= target_date_str for a specific index.
    Fallback to the earliest available price if listed after target_date_str."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT close FROM index_ohlcv WHERE index_name = ? AND date <= ? ORDER BY date DESC LIMIT 1",
        (index_name, target_date_str)
    )
    row = cursor.fetchone()
    if row:
        return row[0]
    
    # Fallback for newly created indexes
    cursor.execute(
        "SELECT close FROM index_ohlcv WHERE index_name = ? ORDER BY date ASC LIMIT 1",
        (index_name,)
    )
    row_earliest = cursor.fetchone()
    return row_earliest[0] if row_earliest else None

def get_etf_close_price(conn: sqlite3.Connection, etf_code: str, target_date_str: str) -> float | None:
    """Find the close price of the closest trading date <= target_date_str for a specific ETF code.
    Fallback to the earliest available price (listing price) if listed after target_date_str."""
    cursor = conn.cursor()
    target_dt_prefix = target_date_str.split(" ")[0]
    cursor.execute(
        "SELECT 종가 FROM etf_price WHERE 종목코드 = ? AND (날짜 <= ? OR 날짜 <= ?) ORDER BY 날짜 DESC LIMIT 1",
        (etf_code, f"{target_dt_prefix} 23:59:59", target_dt_prefix)
    )
    row = cursor.fetchone()
    if row:
        return row[0]

    # Fallback for newly listed ETFs (use initial listing price)
    cursor.execute(
        "SELECT 종가 FROM etf_price WHERE 종목코드 = ? ORDER BY 날짜 ASC LIMIT 1",
        (etf_code,)
    )
    row_earliest = cursor.fetchone()
    return row_earliest[0] if row_earliest else None


def calculate_return(close_now: float | None, close_then: float | None) -> float | None:
    if close_now is None or close_then is None or close_then == 0:
        return None
    return round(((close_now - close_then) / close_then) * 100, 2)

def load_etf_heatmap_data(target_date_str: str | None = None) -> dict:
    etf_price_db, macro_db = get_db_paths()
    
    conn_etf = sqlite3.connect(str(etf_price_db))
    conn_macro = sqlite3.connect(str(macro_db))

    try:
        # Determine target date
        if not target_date_str:
            cursor = conn_etf.cursor()
            cursor.execute("SELECT MAX(날짜) FROM etf_price")
            row = cursor.fetchone()
            if row and row[0]:
                target_date_str = row[0].split(" ")[0]
            else:
                target_date_str = datetime.date.today().strftime("%Y-%m-%d")

        target_date_str = target_date_str.split(" ")[0]
        target_dt = datetime.datetime.strptime(target_date_str, "%Y-%m-%d")

        # Period Target Dates
        d_1d = (target_dt - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        d_mtd = (target_dt.replace(day=1) - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        d_ytd = (target_dt.replace(month=1, day=1) - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        d_3m = (target_dt - datetime.timedelta(days=90)).strftime("%Y-%m-%d")
        d_6m = (target_dt - datetime.timedelta(days=180)).strftime("%Y-%m-%d")
        d_1y = (target_dt - datetime.timedelta(days=365)).strftime("%Y-%m-%d")
        d_3y = (target_dt - datetime.timedelta(days=3*365)).strftime("%Y-%m-%d")
        d_5y = (target_dt - datetime.timedelta(days=5*365)).strftime("%Y-%m-%d")

        # Fetch Indexes
        indexes_data = []
        for idx in ETF_HEATMAP_LAYOUT["KR"]["indexes"]:
            name_lower = idx["code"].lower()
            
            c_now = get_index_close_price(conn_macro, name_lower, target_date_str)
            c_1d = get_index_close_price(conn_macro, name_lower, d_1d)
            c_mtd = get_index_close_price(conn_macro, name_lower, d_mtd)
            c_ytd = get_index_close_price(conn_macro, name_lower, d_ytd)
            c_3m = get_index_close_price(conn_macro, name_lower, d_3m)
            c_6m = get_index_close_price(conn_macro, name_lower, d_6m)
            c_1y = get_index_close_price(conn_macro, name_lower, d_1y)
            c_3y = get_index_close_price(conn_macro, name_lower, d_3y)
            c_5y = get_index_close_price(conn_macro, name_lower, d_5y)

            indexes_data.append({
                "code": idx["code"],
                "name": idx["name"],
                "returns": {
                    "1D": calculate_return(c_now, c_1d),
                    "MTD": calculate_return(c_now, c_mtd),
                    "YTD": calculate_return(c_now, c_ytd),
                    "3M": calculate_return(c_now, c_3m),
                    "6M": calculate_return(c_now, c_6m),
                    "1Y": calculate_return(c_now, c_1y),
                    "3Y": calculate_return(c_now, c_3y),
                    "5Y": calculate_return(c_now, c_5y),
                }
            })

        # Construct Groups Structure
        groups_data = []
        for g in ETF_HEATMAP_LAYOUT["KR"]["groups"]:
            group_etfs = []
            for etf in g.get("etfs", []):
                code = etf["code"]
                
                c_now = get_etf_close_price(conn_etf, code, target_date_str)
                c_1d = get_etf_close_price(conn_etf, code, d_1d)
                c_mtd = get_etf_close_price(conn_etf, code, d_mtd)
                c_ytd = get_etf_close_price(conn_etf, code, d_ytd)
                c_3m = get_etf_close_price(conn_etf, code, d_3m)
                c_6m = get_etf_close_price(conn_etf, code, d_6m)
                c_1y = get_etf_close_price(conn_etf, code, d_1y)
                c_3y = get_etf_close_price(conn_etf, code, d_3y)
                c_5y = get_etf_close_price(conn_etf, code, d_5y)

                group_etfs.append({
                    "code": code,
                    "name": etf["name"],
                    "returns": {
                        "1D": calculate_return(c_now, c_1d),
                        "MTD": calculate_return(c_now, c_mtd),
                        "YTD": calculate_return(c_now, c_ytd),
                        "3M": calculate_return(c_now, c_3m),
                        "6M": calculate_return(c_now, c_6m),
                        "1Y": calculate_return(c_now, c_1y),
                        "3Y": calculate_return(c_now, c_3y),
                        "5Y": calculate_return(c_now, c_5y),
                    }
                })
            groups_data.append({
                "category": g["category"],
                "etfs": group_etfs
            })

        return {
            "market": "KR",
            "as_of_date": target_date_str,
            "indexes": indexes_data,
            "groups": groups_data
        }
    finally:
        conn_etf.close()
        conn_macro.close()

