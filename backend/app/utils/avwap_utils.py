import logging
import os
import sqlite3
import duckdb
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd

from app.schemas import (
    AvwapPoint,
    AvwapAnchorValue,
    AvwapAnchorSeries,
    AvwapChartResponse,
    StockSearchResult,
)
from app.utils.chart_utils import _leverage_csv_dir, SYMBOL_MAP, normalize_chart_time
from app.utils.custom_anchor_utils import get_custom_anchors

logger = logging.getLogger(__name__)

# Interval configuration matching kospi_avwap_plot.py
INTERVAL_CONFIGS: Dict[str, Dict[str, Any]] = {
    "1D": {
        "ta_indicators": [("EMA_10", 10, "ema"), ("EMA_21", 21, "ema"), ("SMA_50", 50, "sma"), ("SMA_150", 150, "sma"), ("SMA_200", 200, "sma")],
        "vol_ma_length": 50,
        "bb_length": 75,
        "vwap_lookback": 252,
    },
    "1W": {
        "ta_indicators": [("SMA_10", 10, "sma"), ("SMA_30", 30, "sma"), ("SMA_40", 40, "sma")],
        "vol_ma_length": 10,
        "bb_length": 15,
        "vwap_lookback": 52,
    },
    "1M": {
        "ta_indicators": [("SMA_6", 6, "sma"), ("SMA_12", 12, "sma"), ("SMA_24", 24, "sma")],
        "vol_ma_length": 3,
        "bb_length": 15,
        "vwap_lookback": 12,
    },
    "1Y": {
        "ta_indicators": [("SMA_3", 3, "sma"), ("SMA_5", 5, "sma"), ("SMA_10", 10, "sma")],
        "vol_ma_length": 3,
        "bb_length": None,
        "vwap_lookback": None,
    },
}

PRESET_ANCHORS: Dict[str, Dict[str, List[str]]] = {
    "kospi": {
        "1D": [
            "2015-08-24", "2021-01-11", "2021-06-28", "2021-08-05", "2021-09-07",
            "2022-01-13", "2022-04-20", "2022-08-17", "2022-12-01", "2023-01-04",
            "2023-01-27", "2023-03-06", "2023-04-18", "2023-06-12", "2023-08-01",
            "2023-08-17", "2023-09-18", "2023-10-18", "2023-10-31"
        ],
        "1W": ["2015-08-24", "2021-06-28", "2022-08-17", "2023-01-04", "2023-10-31"],
        "1M": ["2015-08-24", "2021-06-28", "2022-08-17", "2023-01-04", "2023-10-31"],
        "1Y": ["2015-08-24", "2021-06-28"],
    },
    "kosdaq": {
        "1D": [
            "2015-08-24", "2021-01-11", "2021-06-28", "2021-08-05", "2021-09-07",
            "2022-01-13", "2022-04-20", "2022-08-17", "2022-12-01", "2023-01-04",
            "2023-01-27", "2023-03-06", "2023-04-20", "2023-05-15", "2023-06-12",
            "2023-07-28", "2023-08-01", "2023-09-12", "2023-10-13", "2023-10-31",
            "2024-01-09"
        ],
        "1W": ["2015-08-24", "2021-06-28", "2022-08-17", "2023-01-04", "2024-01-09"],
        "1M": ["2015-08-24", "2021-06-28", "2022-08-17", "2023-01-04", "2024-01-09"],
        "1Y": ["2015-08-24", "2021-06-28"],
    },
    "sp500": {
        "1D": [
            "2018-12-24", "2020-03-23", "2022-01-04", "2022-06-16", "2022-10-13",
            "2023-10-27", "2024-08-05", "2024-11-05", "2025-04-07"
        ],
        "1W": ["2018-12-24", "2020-03-23", "2022-01-04", "2022-10-13", "2023-10-27", "2024-08-05", "2025-04-07"],
        "1M": ["2018-12-24", "2020-03-23", "2022-01-04", "2022-10-13", "2023-10-27", "2025-04-07"],
        "1Y": ["2020-03-23", "2022-01-04"],
    },
    "nasdaq100": {
        "1D": [
            "2018-12-24", "2020-03-23", "2021-11-22", "2022-10-13", "2022-12-28",
            "2023-10-27", "2024-08-05", "2024-11-05", "2025-04-07"
        ],
        "1W": ["2018-12-24", "2020-03-23", "2021-11-22", "2022-10-13", "2023-10-27", "2024-08-05", "2025-04-07"],
        "1M": ["2018-12-24", "2020-03-23", "2021-11-22", "2022-10-13", "2023-10-27", "2025-04-07"],
        "1Y": ["2020-03-23", "2021-11-22"],
    },
    "dow30": {
        "1D": [
            "2018-12-24", "2020-03-23", "2022-01-05", "2022-09-30", "2022-10-13",
            "2023-10-27", "2024-08-05", "2024-11-05", "2025-04-07"
        ],
        "1W": ["2018-12-24", "2020-03-23", "2022-01-05", "2022-10-13", "2023-10-27", "2024-08-05", "2025-04-07"],
        "1M": ["2018-12-24", "2020-03-23", "2022-01-05", "2022-10-13", "2023-10-27", "2025-04-07"],
        "1Y": ["2020-03-23", "2022-01-05"],
    },
}

INDEX_MARKET_MAP: Dict[str, str] = {
    "kospi": "kospi",
    "kosdaq": "kosdaq",
    "sp500": "sp500",
    "s&p500": "sp500",
    "spx": "sp500",
    "snp500": "sp500",
    "nasdaq100": "nasdaq100",
    "nasdaq": "nasdaq100",
    "ndx": "nasdaq100",
    "dow": "dow30",
    "dow30": "dow30",
    "dji": "dow30",
}

INDEX_DISPLAY_NAMES: Dict[str, str] = {
    "kospi": "KOSPI 지수",
    "kosdaq": "KOSDAQ 지수",
    "sp500": "S&P 500 지수",
    "nasdaq100": "NDX 지수",
    "dow30": "DOW 지수",
}

INDEX_AMOUNT_UNITS: Dict[str, str] = {
    "kospi": "조원",
    "kosdaq": "조원",
    "sp500": "조$",
    "nasdaq100": "조$",
    "dow30": "조$",
}

ANCHOR_COLORS = [
    "#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
    "#6366f1", "#14b8a6", "#f97316", "#a855f7", "#0ea5e9",
    "#d946ef", "#84cc16", "#eab308", "#38bdf8", "#fb7185",
    "#2dd4bf", "#c084fc", "#f43f5e", "#4ade80", "#a78bfa"
]

_AVWAP_CACHE: Dict[str, Any] = {}


def invalidate_avwap_cache():
    """Clear in-memory AVWAP cache when custom anchors change."""
    global _AVWAP_CACHE
    _AVWAP_CACHE.clear()



def _get_macro_db_path() -> Path:
    override = os.environ.get("MTT_MACRO_DB_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return Path(os.path.expanduser("~/.cache/db/macro.db"))


def _load_index_raw_df(market_key: str) -> Optional[Tuple[pd.DataFrame, float]]:
    """
    KOSPI, KOSDAQ, S&P500, NASDAQ100, DOW30 지수의 raw OHLCV 데이터를 반환합니다.
    1. CSV 파일 존재 시 CSV 우선 로드 (kospi, kosdaq 등)
    2. macro.db (index_ohlcv 테이블)에서 로드
    반환값: (DataFrame, last_mtime)
    """
    file_name = SYMBOL_MAP.get(market_key)
    if file_name:
        csv_path = _leverage_csv_dir() / file_name
        if csv_path.exists():
            mtime = os.path.getmtime(csv_path)
            try:
                df = pd.read_csv(csv_path)
                return df, mtime
            except Exception as e:
                logger.warning(f"Failed to read CSV {csv_path}: {e}")

    db_path = _get_macro_db_path()
    if db_path.exists():
        mtime = os.path.getmtime(db_path)
        try:
            con = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True)
            try:
                df = pd.read_sql_query(
                    "SELECT date as Date, open as Open, high as High, low as Low, close as Close, volume as Volume, amount as Amount "
                    "FROM index_ohlcv WHERE index_name = ? ORDER BY date",
                    con,
                    params=(market_key,)
                )
            finally:
                con.close()
            if not df.empty:
                return df, mtime
        except Exception as e:
            logger.warning(f"Failed to read macro.db for {market_key}: {e}")

    return None, 0.0


def _calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/period, min_periods=1, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=1, adjust=False).mean()
    rs = avg_gain / (avg_loss + 1e-10)
    return 100 - (100 / (1 + rs))


def _calculate_drawdown(series: pd.Series) -> pd.Series:
    """Calculate Drawdown (MDD, %): (Close - CumMax) / CumMax * 100."""
    cum_max = series.cummax()
    dd = (series - cum_max) / cum_max.replace(0, np.nan) * 100.0
    return dd.fillna(0.0)


def _calculate_52w_high_change(df: pd.DataFrame) -> pd.Series:
    """52주(365일) 최고가 대비 하락률(%): (Close - 52W_High) / 52W_High * 100."""
    h52 = df["High"].rolling("365D", min_periods=1).max()
    chg = (df["Close"] - h52) / h52.replace(0, np.nan) * 100.0
    return chg.fillna(0.0)


def _calculate_vwap_series(df: pd.DataFrame, start_idx: Optional[int] = None) -> pd.Series:
    """Calculate VWAP: typical_price = (H + L + C + O) / 4."""
    if start_idx is not None and start_idx < len(df):
        sub = df.iloc[start_idx:].copy()
    else:
        sub = df.copy()
    
    tp = (sub["High"] + sub["Low"] + sub["Close"] + sub["Open"]) / 4.0
    vol = sub["Volume"]
    cum_vol = vol.cumsum().replace(0, np.nan)
    vwap_sub = (tp * vol).cumsum() / cum_vol
    
    full_series = pd.Series(index=df.index, dtype=float)
    full_series.iloc[start_idx if start_idx is not None else 0:] = vwap_sub
    return full_series


def load_avwap_chart_data(
    market: str = "kospi",
    interval: str = "1D",
    symbol: Optional[str] = None
) -> Optional[AvwapChartResponse]:
    global _AVWAP_CACHE
    
    if symbol and symbol.strip():
        sym = symbol.strip()
        if market.lower() == "etf":
            return load_etf_avwap_chart_data(sym, interval)
        
        info = resolve_stock_info(sym)
        if info and info[2] == "ETF":
            return load_etf_avwap_chart_data(sym, interval)
        res = load_stock_avwap_chart_data(sym, interval)
        if res is not None:
            return res
        return load_etf_avwap_chart_data(sym, interval)

    raw_market_key = market.lower().strip()
    market_key = INDEX_MARKET_MAP.get(raw_market_key, "kospi")
        
    interval_key = interval.upper()
    if interval_key not in INTERVAL_CONFIGS:
        interval_key = "1D"
        
    df_raw_res = _load_index_raw_df(market_key)
    if not df_raw_res or df_raw_res[0] is None:
        logger.warning(f"AVWAP index data not found for {market_key}")
        return None

    df_raw, current_mtime = df_raw_res
    cache_key = f"{market_key}_{interval_key}"
    if cache_key in _AVWAP_CACHE:
        cached = _AVWAP_CACHE[cache_key]
        if cached["last_mtime"] == current_mtime:
            return cached["data"]

    try:
        if "Date" not in df_raw.columns:
            logger.error(f"Index data missing 'Date' column for {market_key}")
            return None
            
        df_raw["Date"] = pd.to_datetime(df_raw["Date"].astype(str).str[:10])
        df_raw = df_raw.sort_values("Date").drop_duplicates("Date").set_index("Date")
        df_raw = df_raw[df_raw.index >= "2000-01-01"]

        if "Amount" not in df_raw.columns or df_raw["Amount"].isnull().all():
            df_raw["Amount"] = df_raw["Close"] * df_raw["Volume"]
        else:
            raw_amt = pd.to_numeric(df_raw["Amount"], errors="coerce").replace(0, np.nan)
            df_raw["Amount"] = raw_amt.fillna(df_raw["Close"] * df_raw["Volume"])


        # 1. Resample to target interval

        if interval_key == "1D":
            df = df_raw[["Open", "High", "Low", "Close", "Volume", "Amount"]].copy()
        elif interval_key == "1W":
            df = df_raw[["Open", "High", "Low", "Close", "Volume", "Amount"]].resample("W-MON", label="left", closed="left").agg({
                "Open": "first",
                "High": "max",
                "Low": "min",
                "Close": "last",
                "Volume": "sum",
                "Amount": "sum",
            }).dropna(subset=["Close"])
        elif interval_key == "1M":
            df = df_raw[["Open", "High", "Low", "Close", "Volume", "Amount"]].resample("MS").agg({
                "Open": "first",
                "High": "max",
                "Low": "min",
                "Close": "last",
                "Volume": "sum",
                "Amount": "sum",
            }).dropna(subset=["Close"])
        elif interval_key == "1Y":
            df = df_raw[["Open", "High", "Low", "Close", "Volume", "Amount"]].resample("YS").agg({
                "Open": "first",
                "High": "max",
                "Low": "min",
                "Close": "last",
                "Volume": "sum",
                "Amount": "sum",
            }).dropna(subset=["Close"])
        else:
            df = df_raw[["Open", "High", "Low", "Close", "Volume", "Amount"]].copy()

        df = df.ffill()
        if df.empty:
            return None

        cfg = INTERVAL_CONFIGS[interval_key]

        # 2. Compute TA Indicator MAs
        ma_dict: Dict[str, pd.Series] = {}
        for ma_name, period, m_type in cfg["ta_indicators"]:
            if m_type == "ema":
                ma_dict[ma_name] = df["Close"].ewm(span=period, adjust=False).mean()
            else:
                ma_dict[ma_name] = df["Close"].rolling(window=period, min_periods=1).mean()

        # 3. Volume & Amount
        vol_ma_len = cfg["vol_ma_length"]
        vol_ma_series = df["Volume"].rolling(window=vol_ma_len, min_periods=1).mean()

        # Amount in Jo (조원 or 조$): Amount / 1e12
        amount_series = df["Amount"] / 1e12
        amt_ma_len = 50 if interval_key == "1D" else 10 if interval_key == "1W" else 12 if interval_key == "1M" else 3
        amount_sma50_series = amount_series.rolling(window=amt_ma_len, min_periods=1).mean()

        # 4. BB Upper (75 for 1D, 15 for 1W/1M)
        bb_upper_series: Optional[pd.Series] = None
        if cfg["bb_length"] is not None and len(df) >= cfg["bb_length"]:
            bb_len = cfg["bb_length"]
            bb_mid = df["Close"].rolling(window=bb_len).mean()
            bb_std = df["Close"].rolling(window=bb_len).std()
            bb_upper_series = bb_mid + (bb_std * 2.0)

        # 5. VIX Fix & RSI & Drawdown (MDD, %) & 52W High Change (%)
        vix_period = min(22, len(df))
        close_max22 = df["Close"].rolling(window=vix_period, min_periods=1).max()
        vix_fix_series = (close_max22 - df["Low"]) / close_max22.replace(0, np.nan) * 100.0
        rsi_series = _calculate_rsi(df["Close"], period=min(14, max(2, len(df) - 1)))
        mdd_series = _calculate_drawdown(df["Close"])
        h52_chg_series = _calculate_52w_high_change(df)

        # 6. Base VWAP, HVWAP, LVWAP
        vwap_lb = cfg["vwap_lookback"]
        vwap_start = max(0, len(df) - vwap_lb) if vwap_lb and len(df) > vwap_lb else 0
        vwap_series = _calculate_vwap_series(df, start_idx=vwap_start)

        window_df = df.iloc[vwap_start:]
        h_idx_loc = window_df["High"].argmax() + vwap_start
        l_idx_loc = window_df["Low"].argmin() + vwap_start
        hvwap_series = _calculate_vwap_series(df, start_idx=h_idx_loc)
        lvwap_series = _calculate_vwap_series(df, start_idx=l_idx_loc)

        # 7. Preset & Custom Anchors
        anchors_list: List[AvwapAnchorSeries] = []
        preset_dates = PRESET_ANCHORS.get(market_key, {}).get(interval_key, [])

        suppressed_dates = set()
        custom_anchors_active = []
        try:
            custom_anchors_all = get_custom_anchors(market_or_symbol=market_key, include_inactive=True)
            for ca in custom_anchors_all:
                if not ca.is_active:
                    suppressed_dates.add(ca.anchor_date)
                else:
                    custom_anchors_active.append(ca)
        except Exception as e:
            logger.warning(f"Failed to load custom/suppressed anchors for {market_key}: {e}")

        seen_dates = set()
        for idx, ad_str in enumerate(preset_dates):
            if ad_str in suppressed_dates:
                continue
            seen_dates.add(ad_str)
            valid_indices = df.index[df.index >= ad_str]
            if len(valid_indices) == 0:
                continue
            matched_dt = valid_indices[0]
            start_pos = df.index.get_loc(matched_dt)
            if isinstance(start_pos, slice):
                start_pos = start_pos.start
            a_series = _calculate_vwap_series(df, start_idx=start_pos)
            
            val_list: List[AvwapAnchorValue] = []
            for i in range(start_pos, len(df)):
                v = a_series.iloc[i]
                if pd.notna(v) and np.isfinite(v):
                    val_list.append(AvwapAnchorValue(
                        date=df.index[i].strftime("%Y-%m-%d"),
                        value=round(float(v), 2)
                    ))
                    
            anchors_list.append(AvwapAnchorSeries(
                id=f"anchor_{ad_str.replace('-', '')}",
                name=f"AVWAP ({ad_str})",
                anchor_date=ad_str,
                color=ANCHOR_COLORS[idx % len(ANCHOR_COLORS)],
                values=val_list
            ))

        # 7.1 Custom Anchors from DB
        for ca in custom_anchors_active:
            if ca.interval_mask and ca.interval_mask != "ALL" and ca.interval_mask != interval_key:
                continue
            ad_str = ca.anchor_date
            if ad_str in seen_dates:
                continue
            seen_dates.add(ad_str)
            valid_indices = df.index[df.index >= ad_str]
            if len(valid_indices) == 0:
                continue
            matched_dt = valid_indices[0]
            start_pos = df.index.get_loc(matched_dt)
            if isinstance(start_pos, slice):
                start_pos = start_pos.start
            a_series = _calculate_vwap_series(df, start_idx=start_pos)
            val_list: List[AvwapAnchorValue] = []
            for i in range(start_pos, len(df)):
                v = a_series.iloc[i]
                if pd.notna(v) and np.isfinite(v):
                    val_list.append(AvwapAnchorValue(
                        date=df.index[i].strftime("%Y-%m-%d"),
                        value=round(float(v), 2)
                    ))
            display_name_anc = ca.label if ca.label and ca.label.strip() else f"AVWAP ({ad_str})"
            anchors_list.append(AvwapAnchorSeries(
                id=ca.id,
                name=display_name_anc,
                anchor_date=ad_str,
                color=ca.color or "#ec4899",
                values=val_list
            ))


        # 8. Build response points
        points: List[AvwapPoint] = []
        for idx, dt in enumerate(df.index):
            d_str = dt.strftime("%Y-%m-%d")
            c = float(df["Close"].iloc[idx])
            o = float(df["Open"].iloc[idx])
            h = float(df["High"].iloc[idx])
            l = float(df["Low"].iloc[idx])
            v = float(df["Volume"].iloc[idx])
            
            chg: Optional[float] = None
            if idx > 0 and df["Close"].iloc[idx - 1] > 0:
                chg = round((c / df["Close"].iloc[idx - 1] - 1.0) * 100.0, 2)
                
            pt_ma: Dict[str, Optional[float]] = {}
            for ma_name, s in ma_dict.items():
                val = s.iloc[idx]
                pt_ma[ma_name] = round(float(val), 2) if pd.notna(val) and np.isfinite(val) else None
                
            v_ma = vol_ma_series.iloc[idx]
            amt_val = amount_series.iloc[idx]
            amt_sma = amount_sma50_series.iloc[idx]
            bb_u = bb_upper_series.iloc[idx] if bb_upper_series is not None else None
            vix = vix_fix_series.iloc[idx]
            rsi_val = rsi_series.iloc[idx]
            mdd_val = mdd_series.iloc[idx]
            h52_val = h52_chg_series.iloc[idx]
            
            vwap_val = vwap_series.iloc[idx]
            hvwap_val = hvwap_series.iloc[idx]
            lvwap_val = lvwap_series.iloc[idx]
            
            points.append(AvwapPoint(
                date=d_str,
                open=round(o, 2),
                high=round(h, 2),
                low=round(l, 2),
                close=round(c, 2),
                volume=round(v, 2),
                change_pct=chg,
                ma=pt_ma,
                vol_ma=round(float(v_ma), 2) if pd.notna(v_ma) and np.isfinite(v_ma) else None,
                amount=round(float(amt_val), 2) if pd.notna(amt_val) and np.isfinite(amt_val) else None,
                amount_sma50=round(float(amt_sma), 2) if pd.notna(amt_sma) and np.isfinite(amt_sma) else None,
                bb_upper=round(float(bb_u), 2) if pd.notna(bb_u) and np.isfinite(bb_u) else None,
                vix_fix=round(float(vix), 2) if pd.notna(vix) and np.isfinite(vix) else None,
                rsi=round(float(rsi_val), 2) if pd.notna(rsi_val) and np.isfinite(rsi_val) else None,
                mdd=round(float(mdd_val), 2) if pd.notna(mdd_val) and np.isfinite(mdd_val) else None,
                h52_chg=round(float(h52_val), 2) if pd.notna(h52_val) and np.isfinite(h52_val) else None,
                vwap=round(float(vwap_val), 2) if pd.notna(vwap_val) and np.isfinite(vwap_val) else None,
                hvwap=round(float(hvwap_val), 2) if pd.notna(hvwap_val) and np.isfinite(hvwap_val) else None,
                lvwap=round(float(lvwap_val), 2) if pd.notna(lvwap_val) and np.isfinite(lvwap_val) else None,
            ))
            
        display_name = INDEX_DISPLAY_NAMES.get(market_key, f"{market_key.upper()} 지수")
        amount_unit = INDEX_AMOUNT_UNITS.get(market_key, "조원")
        response = AvwapChartResponse(
            market=market_key,
            symbol=None,
            name=display_name,
            interval=interval_key,
            amount_unit=amount_unit,
            points=points,
            anchors=anchors_list,
            preset_dates=preset_dates
        )
        
        _AVWAP_CACHE[cache_key] = {"data": response, "last_mtime": current_mtime}
        return response

    except Exception as e:
        logger.error(f"Error computing AVWAP chart data for {market} ({interval}): {e}", exc_info=True)
        return None


_ETF_MASTER_CACHE: Optional[List[Tuple[str, str]]] = None


def _get_etf_master_list() -> List[Tuple[str, str]]:
    """
    etf_price.db에서 고유한 (종목코드, 종목명) 목록을 인메모리에 캐싱하여 반환합니다.
    """
    global _ETF_MASTER_CACHE
    if _ETF_MASTER_CACHE is not None:
        return _ETF_MASTER_CACHE

    e_path = os.path.expanduser("~/.cache/db/etf_price.db")
    if not os.path.exists(e_path):
        return []

    try:
        conn = sqlite3.connect(e_path)
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT 종목코드, 종목명 FROM etf_price")
        _ETF_MASTER_CACHE = cur.fetchall()
        conn.close()
    except Exception as e:
        logger.warning(f"Error loading ETF master list from etf_price.db: {e}")
        _ETF_MASTER_CACHE = []

    return _ETF_MASTER_CACHE


def resolve_stock_info(query: str, asset_type: Optional[str] = None) -> Optional[Tuple[str, str, str]]:
    """
    종목코드 또는 종목명으로 (종목코드, 종목명, 시장구분)을 조회합니다.
    asset_type: 'stock' | 'etf' | None (None이면 stock -> etf 순으로 조회)
    """
    q = query.strip()
    if not q:
        return None

    # 1. ETF 모드인 경우 etf_price.db 우선 조회
    if asset_type == "etf":
        etfs = _get_etf_master_list()
        q_upper = q.upper()
        if q.isdigit() or len(q) == 6:
            code_target = q.zfill(6).upper()
            for code, name in etfs:
                if code.upper() == code_target:
                    return code, name, "ETF"
        for code, name in etfs:
            if name.lower() == q.lower():
                return code, name, "ETF"
        for code, name in etfs:
            if q.lower() in name.lower() or q.lower() in code.lower():
                return code, name, "ETF"
        return None

    # 2. 일반 주식 stock_master.db 우선 조회
    sm_path = os.path.expanduser("~/.cache/db/stock_master.db")
    if os.path.exists(sm_path):
        try:
            conn = sqlite3.connect(sm_path)
            cur = conn.cursor()
            if q.isdigit():
                code = q.zfill(6)
                cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목코드 = ?", (code,))
                row = cur.fetchone()
                if row:
                    conn.close()
                    return row[0], row[1], row[2]
            
            # 정확한 종목명 일치
            cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목명 = ?", (q,))
            row = cur.fetchone()
            if row:
                conn.close()
                return row[0], row[1], row[2]
                
            # 부분 일치
            cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목명 LIKE ? OR 종목코드 LIKE ? LIMIT 1", (f"%{q}%", f"%{q}%"))
            row = cur.fetchone()
            conn.close()
            if row:
                return row[0], row[1], row[2]
        except Exception as e:
            logger.warning(f"Error querying stock_master.db for {query}: {e}")

    # 3. marcap.duckdb 폴백
    m_path = os.path.expanduser("~/.cache/db/marcap.duckdb")
    if os.path.exists(m_path):
        try:
            con = duckdb.connect(m_path, read_only=True)
            if q.isdigit():
                code = q.zfill(6)
                row = con.execute("SELECT Code, Name, Market FROM marcap_adj WHERE Code = ? ORDER BY Date DESC LIMIT 1", [code]).fetchone()
                if row:
                    return row[0], row[1], row[2] or "KOSPI"
            row = con.execute("SELECT Code, Name, Market FROM marcap_adj WHERE Name = ? ORDER BY Date DESC LIMIT 1", [q]).fetchone()
            if row:
                return row[0], row[1], row[2] or "KOSPI"
            row = con.execute("SELECT Code, Name, Market FROM marcap_adj WHERE Name LIKE ? ORDER BY Date DESC LIMIT 1", [f"%{q}%"]).fetchone()
            if row:
                return row[0], row[1], row[2] or "KOSPI"
        except Exception as e:
            logger.warning(f"Error querying marcap.duckdb for {query}: {e}")

    # 4. 일반 주식에서 찾지 못했고 asset_type이 'stock'으로 고정되지 않았다면 ETF에서 조회
    if asset_type != "stock":
        etfs = _get_etf_master_list()
        q_upper = q.upper()
        if q.isdigit() or len(q) == 6:
            code_target = q.zfill(6).upper()
            for code, name in etfs:
                if code.upper() == code_target:
                    return code, name, "ETF"
        for code, name in etfs:
            if name.lower() == q.lower():
                return code, name, "ETF"
        for code, name in etfs:
            if q.lower() in name.lower() or q.lower() in code.lower():
                return code, name, "ETF"

    return None


def search_stocks_db(query: str, limit: int = 10, asset_type: str = "stock") -> List[StockSearchResult]:
    """
    종목코드 또는 종목명 검색 자동완성 목록을 반환합니다.
    asset_type: 'stock' | 'etf' | 'all'
    """
    q = query.strip()
    if not q:
        return []

    results: List[StockSearchResult] = []
    seen: set = set()
    q_lower = q.lower()

    # 1. ETF 검색
    if asset_type in ("etf", "all"):
        etfs = _get_etf_master_list()
        exact: List[StockSearchResult] = []
        prefix: List[StockSearchResult] = []
        contains: List[StockSearchResult] = []

        for code, name in etfs:
            c_low = code.lower()
            n_low = name.lower()
            if c_low == q_lower or n_low == q_lower:
                exact.append(StockSearchResult(code=code, name=name, market="ETF"))
            elif n_low.startswith(q_lower) or c_low.startswith(q_lower):
                prefix.append(StockSearchResult(code=code, name=name, market="ETF"))
            elif q_lower in n_low or q_lower in c_low:
                contains.append(StockSearchResult(code=code, name=name, market="ETF"))

        for item in exact + prefix + contains:
            if item.code not in seen:
                seen.add(item.code)
                results.append(item)
            if len(results) >= limit:
                break

    # 2. 일반 주식 검색
    if asset_type in ("stock", "all") and len(results) < limit:
        sm_path = os.path.expanduser("~/.cache/db/stock_master.db")
        if os.path.exists(sm_path):
            try:
                conn = sqlite3.connect(sm_path)
                cur = conn.cursor()
                if q.isdigit():
                    cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목코드 LIKE ? LIMIT ?", (f"{q}%", limit - len(results)))
                    for row in cur.fetchall():
                        if row[0] not in seen:
                            seen.add(row[0])
                            results.append(StockSearchResult(code=row[0], name=row[1], market=row[2] or "KOSPI"))

                # 접두사 일치
                if len(results) < limit:
                    cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목명 LIKE ? LIMIT ?", (f"{q}%", limit - len(results)))
                    for row in cur.fetchall():
                        if row[0] not in seen:
                            seen.add(row[0])
                            results.append(StockSearchResult(code=row[0], name=row[1], market=row[2] or "KOSPI"))

                # 부분 일치
                if len(results) < limit:
                    cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목명 LIKE ? OR 종목코드 LIKE ? LIMIT ?", (f"%{q}%", f"%{q}%", limit - len(results)))
                    for row in cur.fetchall():
                        if row[0] not in seen:
                            seen.add(row[0])
                            results.append(StockSearchResult(code=row[0], name=row[1], market=row[2] or "KOSPI"))
                conn.close()
            except Exception as e:
                logger.warning(f"Error searching stock_master.db for {query}: {e}")

    return results[:limit]


def _compute_asset_avwap_chart(
    raw_df: pd.DataFrame,
    code: str,
    name: str,
    market_type: str,
    interval_key: str
) -> Optional[AvwapChartResponse]:
    """
    주식 또는 ETF의 raw OHLCV DataFrame으로부터 다중 주기 AVWAP 및 지표를 계산하여 AvwapChartResponse를 생성합니다.
    """
    if raw_df.empty:
        return None

    raw_df["Date"] = pd.to_datetime(raw_df["Date"])
    raw_df = raw_df.sort_values("Date").drop_duplicates("Date").set_index("Date")
    raw_df = raw_df[raw_df.index >= "2000-01-01"]

    if "Amount" not in raw_df.columns:
        raw_df["Amount"] = raw_df["Close"] * raw_df["Volume"]
    else:
        raw_amt = pd.to_numeric(raw_df["Amount"], errors="coerce").replace(0, np.nan)
        raw_df["Amount"] = raw_amt.fillna(raw_df["Close"] * raw_df["Volume"])


    # 1. Resample
    if interval_key == "1D":
        df = raw_df[["Open", "High", "Low", "Close", "Volume", "Amount"]].copy()
    elif interval_key == "1W":
        df = raw_df[["Open", "High", "Low", "Close", "Volume", "Amount"]].resample("W-MON", label="left", closed="left").agg({
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
            "Amount": "sum",
        }).dropna(subset=["Close"])
    elif interval_key == "1M":
        df = raw_df[["Open", "High", "Low", "Close", "Volume", "Amount"]].resample("MS").agg({
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
            "Amount": "sum",
        }).dropna(subset=["Close"])
    elif interval_key == "1Y":
        df = raw_df[["Open", "High", "Low", "Close", "Volume", "Amount"]].resample("YS").agg({
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
            "Amount": "sum",
        }).dropna(subset=["Close"])
    else:
        df = raw_df[["Open", "High", "Low", "Close", "Volume", "Amount"]].copy()

    df = df.ffill()
    if df.empty:
        return None

    cfg = INTERVAL_CONFIGS[interval_key]

    # 2. Compute MA overlays
    ma_dict: Dict[str, pd.Series] = {}
    for ma_name, period, m_type in cfg["ta_indicators"]:
        if m_type == "ema":
            ma_dict[ma_name] = df["Close"].ewm(span=period, adjust=False).mean()
        else:
            ma_dict[ma_name] = df["Close"].rolling(window=period, min_periods=1).mean()

    # 3. Volume & Amount (개별 종목/ETF는 억원 단위: Amount / 1e8)
    vol_ma_len = cfg["vol_ma_length"]
    vol_ma_series = df["Volume"].rolling(window=vol_ma_len, min_periods=1).mean()

    amount_series = df["Amount"] / 1e8
    amt_ma_len = 50 if interval_key == "1D" else 10 if interval_key == "1W" else 12 if interval_key == "1M" else 3
    amount_sma50_series = amount_series.rolling(window=amt_ma_len, min_periods=1).mean()

    # 4. BB Upper
    bb_upper_series: Optional[pd.Series] = None
    if cfg["bb_length"] is not None and len(df) >= cfg["bb_length"]:
        bb_len = cfg["bb_length"]
        bb_mid = df["Close"].rolling(window=bb_len).mean()
        bb_std = df["Close"].rolling(window=bb_len).std()
        bb_upper_series = bb_mid + (bb_std * 2.0)

    # 5. VIX Fix & RSI & Drawdown (MDD, %) & 52W High Change (%)
    vix_period = min(22, len(df))
    close_max22 = df["Close"].rolling(window=vix_period, min_periods=1).max()
    vix_fix_series = (close_max22 - df["Low"]) / close_max22.replace(0, np.nan) * 100.0
    rsi_series = _calculate_rsi(df["Close"], period=min(14, max(2, len(df) - 1)))
    mdd_series = _calculate_drawdown(df["Close"])
    h52_chg_series = _calculate_52w_high_change(df)

    # 6. Base VWAP, HVWAP, LVWAP
    vwap_lb = cfg["vwap_lookback"]
    vwap_start = max(0, len(df) - vwap_lb) if vwap_lb and len(df) > vwap_lb else 0
    vwap_series = _calculate_vwap_series(df, start_idx=vwap_start)

    window_df = df.iloc[vwap_start:]
    h_idx_loc = window_df["High"].argmax() + vwap_start
    l_idx_loc = window_df["Low"].argmin() + vwap_start
    hvwap_series = _calculate_vwap_series(df, start_idx=h_idx_loc)
    lvwap_series = _calculate_vwap_series(df, start_idx=l_idx_loc)

    # 7. Dynamic Anchors (YTD, 52W High, 52W Low, ATH, ATL)
    anchors_list: List[AvwapAnchorSeries] = []
    preset_dates: List[str] = []

    ath_dt = df["High"].idxmax()
    atl_dt = df["Low"].idxmin()
    recent_1y = df[df.index >= (df.index.max() - pd.Timedelta(days=365))]
    h52_dt = recent_1y["High"].idxmax() if not recent_1y.empty else ath_dt
    l52_dt = recent_1y["Low"].idxmin() if not recent_1y.empty else atl_dt
    ytd_candidates = df[df.index >= f"{df.index.max().year}-01-01"]
    ytd_dt = ytd_candidates.index.min() if not ytd_candidates.empty else None

    raw_anchors = [
        ("ytd", "YTD", ytd_dt),
        ("h52", "52주 최고", h52_dt),
        ("l52", "52주 최저", l52_dt),
        ("ath", "역대 최고(ATH)", ath_dt),
        ("atl", "역대 최저(ATL)", atl_dt),
    ]

    suppressed_dates = set()
    custom_anchors_active = []
    try:
        custom_anchors_all = get_custom_anchors(market_or_symbol=code, include_inactive=True)
        for ca in custom_anchors_all:
            if not ca.is_active:
                suppressed_dates.add(ca.anchor_date)
            else:
                custom_anchors_active.append(ca)
    except Exception as e:
        logger.warning(f"Failed to load custom/suppressed anchors for asset {code}: {e}")

    seen_dates: set = set()
    color_idx = 0
    for a_id, a_label, a_dt in raw_anchors:
        if a_dt is None:
            continue
        valid_indices = df.index[df.index >= a_dt]
        if len(valid_indices) == 0:
            continue
        matched_dt = valid_indices[0]
        d_str = matched_dt.strftime("%Y-%m-%d")
        if d_str in suppressed_dates or d_str in seen_dates:
            continue
        seen_dates.add(d_str)
        preset_dates.append(d_str)

        start_pos = df.index.get_loc(matched_dt)
        if isinstance(start_pos, slice):
            start_pos = start_pos.start
        a_series = _calculate_vwap_series(df, start_idx=start_pos)

        vals: List[AvwapAnchorValue] = []
        for i in range(start_pos, len(df)):
            v = a_series.iloc[i]
            if pd.notna(v) and np.isfinite(v):
                vals.append(AvwapAnchorValue(date=df.index[i].strftime("%Y-%m-%d"), value=round(float(v), 2)))

        anchors_list.append(AvwapAnchorSeries(
            id=f"anchor_{a_id}_{d_str.replace('-', '')}",
            name=f"{a_label} ({d_str})",
            anchor_date=d_str,
            color=ANCHOR_COLORS[color_idx % len(ANCHOR_COLORS)],
            values=vals
        ))
        color_idx += 1

    # 7.1 Custom Anchors from DB for individual stock/ETF
    for ca in custom_anchors_active:
        if ca.interval_mask and ca.interval_mask != "ALL" and ca.interval_mask != interval_key:
            continue
        ad_str = ca.anchor_date
        if ad_str in seen_dates:
            continue
        seen_dates.add(ad_str)
        valid_indices = df.index[df.index >= ad_str]
        if len(valid_indices) == 0:
            continue
        matched_dt = valid_indices[0]
        start_pos = df.index.get_loc(matched_dt)
        if isinstance(start_pos, slice):
            start_pos = start_pos.start
        a_series = _calculate_vwap_series(df, start_idx=start_pos)
        vals_custom: List[AvwapAnchorValue] = []
        for i in range(start_pos, len(df)):
            v = a_series.iloc[i]
            if pd.notna(v) and np.isfinite(v):
                vals_custom.append(AvwapAnchorValue(date=df.index[i].strftime("%Y-%m-%d"), value=round(float(v), 2)))
        display_name_anc = ca.label if ca.label and ca.label.strip() else f"AVWAP ({ad_str})"
        anchors_list.append(AvwapAnchorSeries(
            id=ca.id,
            name=display_name_anc,
            anchor_date=ad_str,
            color=ca.color or "#ec4899",
            values=vals_custom
        ))


    # 8. Build points list
    points: List[AvwapPoint] = []
    for idx, dt in enumerate(df.index):
        d_str = dt.strftime("%Y-%m-%d")
        c = float(df["Close"].iloc[idx])
        o = float(df["Open"].iloc[idx])
        h = float(df["High"].iloc[idx])
        l = float(df["Low"].iloc[idx])
        v = float(df["Volume"].iloc[idx])

        chg: Optional[float] = None
        if idx > 0 and df["Close"].iloc[idx - 1] > 0:
            chg = round((c / df["Close"].iloc[idx - 1] - 1.0) * 100.0, 2)

        pt_ma: Dict[str, Optional[float]] = {}
        for ma_name, s in ma_dict.items():
            val = s.iloc[idx]
            pt_ma[ma_name] = round(float(val), 2) if pd.notna(val) and np.isfinite(val) else None

        v_ma = vol_ma_series.iloc[idx]
        amt_val = amount_series.iloc[idx]
        amt_sma = amount_sma50_series.iloc[idx]
        bb_u = bb_upper_series.iloc[idx] if bb_upper_series is not None else None
        vix = vix_fix_series.iloc[idx]
        rsi_val = rsi_series.iloc[idx]
        mdd_val = mdd_series.iloc[idx]
        h52_val = h52_chg_series.iloc[idx]

        vwap_val = vwap_series.iloc[idx]
        hvwap_val = hvwap_series.iloc[idx]
        lvwap_val = lvwap_series.iloc[idx]

        points.append(AvwapPoint(
            date=d_str,
            open=round(o, 2),
            high=round(h, 2),
            low=round(l, 2),
            close=round(c, 2),
            volume=round(v, 2),
            change_pct=chg,
            ma=pt_ma,
            vol_ma=round(float(v_ma), 2) if pd.notna(v_ma) and np.isfinite(v_ma) else None,
            amount=round(float(amt_val), 2) if pd.notna(amt_val) and np.isfinite(amt_val) else None,
            amount_sma50=round(float(amt_sma), 2) if pd.notna(amt_sma) and np.isfinite(amt_sma) else None,
            bb_upper=round(float(bb_u), 2) if pd.notna(bb_u) and np.isfinite(bb_u) else None,
            vix_fix=round(float(vix), 2) if pd.notna(vix) and np.isfinite(vix) else None,
            rsi=round(float(rsi_val), 2) if pd.notna(rsi_val) and np.isfinite(rsi_val) else None,
            mdd=round(float(mdd_val), 2) if pd.notna(mdd_val) and np.isfinite(mdd_val) else None,
            h52_chg=round(float(h52_val), 2) if pd.notna(h52_val) and np.isfinite(h52_val) else None,
            vwap=round(float(vwap_val), 2) if pd.notna(vwap_val) and np.isfinite(vwap_val) else None,
            hvwap=round(float(hvwap_val), 2) if pd.notna(hvwap_val) and np.isfinite(hvwap_val) else None,
            lvwap=round(float(lvwap_val), 2) if pd.notna(lvwap_val) and np.isfinite(lvwap_val) else None,
        ))

    return AvwapChartResponse(
        market=market_type,
        symbol=code,
        name=name,
        interval=interval_key,
        amount_unit="억원",
        points=points,
        anchors=anchors_list,
        preset_dates=preset_dates
    )


def load_stock_avwap_chart_data(
    symbol_or_name: str,
    interval: str = "1D"
) -> Optional[AvwapChartResponse]:
    """
    개별 종목의 1D, 1W, 1M, 1Y AVWAP 및 기술 지표 차트 데이터를 생성합니다.
    """
    global _AVWAP_CACHE

    stock_info = resolve_stock_info(symbol_or_name, asset_type="stock")
    if not stock_info:
        logger.warning(f"Stock not resolved for: {symbol_or_name}")
        return None

    code, name, market_type = stock_info
    interval_key = interval.upper()
    if interval_key not in INTERVAL_CONFIGS:
        interval_key = "1D"

    m_path = os.path.expanduser("~/.cache/db/marcap.duckdb")
    if not os.path.exists(m_path):
        logger.warning(f"marcap.duckdb not found: {m_path}")
        return None

    current_mtime = os.path.getmtime(m_path)
    cache_key = f"stock_{code}_{interval_key}"
    if cache_key in _AVWAP_CACHE:
        cached = _AVWAP_CACHE[cache_key]
        if cached["last_mtime"] == current_mtime:
            return cached["data"]

    try:
        con = duckdb.connect(m_path, read_only=True)
        raw_df = con.execute(
            "SELECT Date, Open, High, Low, Close, Volume, Amount FROM marcap_adj WHERE Code = ? ORDER BY Date ASC",
            [code]
        ).fetchdf()

        if raw_df.empty:
            logger.warning(f"No price data for stock code: {code}")
            return None

        response = _compute_asset_avwap_chart(raw_df, code, name, market_type, interval_key)
        if response:
            _AVWAP_CACHE[cache_key] = {"data": response, "last_mtime": current_mtime}
        return response

    except Exception as e:
        logger.error(f"Error computing stock AVWAP chart data for {symbol_or_name} ({interval}): {e}", exc_info=True)
        return None


def load_etf_avwap_chart_data(
    symbol_or_name: str,
    interval: str = "1D"
) -> Optional[AvwapChartResponse]:
    """
    국내 ETF의 1D, 1W, 1M, 1Y AVWAP 및 기술 지표 차트 데이터를 생성합니다.
    """
    global _AVWAP_CACHE

    etf_info = resolve_stock_info(symbol_or_name, asset_type="etf")
    if not etf_info:
        logger.warning(f"ETF not resolved for: {symbol_or_name}")
        return None

    code, name, market_type = etf_info
    interval_key = interval.upper()
    if interval_key not in INTERVAL_CONFIGS:
        interval_key = "1D"

    e_path = os.path.expanduser("~/.cache/db/etf_price.db")
    if not os.path.exists(e_path):
        logger.warning(f"etf_price.db not found: {e_path}")
        return None

    current_mtime = os.path.getmtime(e_path)
    cache_key = f"etf_{code}_{interval_key}"
    if cache_key in _AVWAP_CACHE:
        cached = _AVWAP_CACHE[cache_key]
        if cached["last_mtime"] == current_mtime:
            return cached["data"]

    try:
        conn = sqlite3.connect(e_path)
        raw_df = pd.read_sql_query(
            "SELECT 날짜 as Date, 시가 as Open, 고가 as High, 저가 as Low, 종가 as Close, 거래량 as Volume FROM etf_price WHERE 종목코드 = ? ORDER BY 날짜 ASC",
            conn,
            params=(code,)
        )
        conn.close()

        if raw_df.empty:
            logger.warning(f"No price data for ETF code: {code}")
            return None

        # Amount = Close * Volume
        raw_df["Amount"] = raw_df["Close"] * raw_df["Volume"]

        response = _compute_asset_avwap_chart(raw_df, code, name, "ETF", interval_key)
        if response:
            _AVWAP_CACHE[cache_key] = {"data": response, "last_mtime": current_mtime}
        return response

    except Exception as e:
        logger.error(f"Error computing ETF AVWAP chart data for {symbol_or_name} ({interval}): {e}", exc_info=True)
        return None

