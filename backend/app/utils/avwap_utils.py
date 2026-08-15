import logging
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

from app.schemas import (
    AvwapPoint,
    AvwapAnchorValue,
    AvwapAnchorSeries,
    AvwapChartResponse,
)
from app.utils.chart_utils import _leverage_csv_dir, SYMBOL_MAP, normalize_chart_time

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
    }
}

ANCHOR_COLORS = [
    "#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
    "#6366f1", "#14b8a6", "#f97316", "#a855f7", "#0ea5e9",
    "#d946ef", "#84cc16", "#eab308", "#38bdf8", "#fb7185",
    "#2dd4bf", "#c084fc", "#f43f5e", "#4ade80", "#a78bfa"
]

_AVWAP_CACHE: Dict[str, Any] = {}


def _calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/period, min_periods=1, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=1, adjust=False).mean()
    rs = avg_gain / (avg_loss + 1e-10)
    return 100 - (100 / (1 + rs))


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
    interval: str = "1D"
) -> Optional[AvwapChartResponse]:
    global _AVWAP_CACHE
    
    market_key = market.lower()
    if market_key not in ("kospi", "kosdaq"):
        market_key = "kospi"
        
    interval_key = interval.upper()
    if interval_key not in INTERVAL_CONFIGS:
        interval_key = "1D"
        
    file_name = SYMBOL_MAP.get(market_key)
    if not file_name:
        return None
        
    csv_path = _leverage_csv_dir() / file_name
    if not csv_path.exists():
        logger.warning(f"AVWAP csv not found: {csv_path}")
        return None

    current_mtime = os.path.getmtime(csv_path)
    cache_key = f"{market_key}_{interval_key}"
    if cache_key in _AVWAP_CACHE:
        cached = _AVWAP_CACHE[cache_key]
        if cached["last_mtime"] == current_mtime:
            return cached["data"]

    try:
        raw_df = pd.read_csv(csv_path)
        raw_df["Date"] = pd.to_datetime(raw_df["Date"].astype(str).str[:10])
        raw_df = raw_df.sort_values("Date").drop_duplicates("Date").set_index("Date")
        raw_df = raw_df[raw_df.index >= "2000-01-01"]
        
        if "Amount" not in raw_df.columns:
            raw_df["Amount"] = 0.0
        else:
            raw_df["Amount"] = pd.to_numeric(raw_df["Amount"], errors="coerce").fillna(0.0)

        # 1. Resample to requested interval
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
        cfg = INTERVAL_CONFIGS[interval_key]
        
        # 2. Compute MA overlays
        ma_dict: Dict[str, pd.Series] = {}
        for name, period, m_type in cfg["ta_indicators"]:
            if m_type == "ema":
                ma_dict[name] = df["Close"].ewm(span=period, adjust=False).mean()
            else:
                ma_dict[name] = df["Close"].rolling(window=period, min_periods=1).mean()

        # 3. Volume MA
        vol_ma_len = cfg["vol_ma_length"]
        vol_ma_series = df["Volume"].rolling(window=vol_ma_len, min_periods=1).mean()

        # 3-1. Trading Amount (거래대금, 조원) & Amount SMA (일봉 50일선, 주봉 10/50주선, 월봉 12개월선, 년봉 3년선)
        amount_series = df["Amount"] / 1e12
        amt_ma_len = 50 if interval_key == "1D" else 10 if interval_key == "1W" else 12 if interval_key == "1M" else 3
        amount_sma50_series = amount_series.rolling(window=amt_ma_len, min_periods=1).mean()

        # 4. BB Upper
        bb_upper_series: Optional[pd.Series] = None
        if cfg["bb_length"] is not None and len(df) >= cfg["bb_length"]:
            bb_len = cfg["bb_length"]
            bb_mid = df["Close"].rolling(window=bb_len).mean()
            bb_std = df["Close"].rolling(window=bb_len).std()
            bb_upper_series = bb_mid + (bb_std * 2.0)

        # 5. VIX Fix (Williams VIX Fix: (22-period Close Max - Low) / Close Max * 100)
        vix_period = min(22, len(df))
        close_max22 = df["Close"].rolling(window=vix_period, min_periods=1).max()
        vix_fix_series = (close_max22 - df["Low"]) / close_max22.replace(0, np.nan) * 100.0

        # 6. RSI (14)
        rsi_series = _calculate_rsi(df["Close"], period=min(14, max(2, len(df) - 1)))

        # 7. VWAP (Base lookback), HVWAP (Peak), LVWAP (Trough)
        vwap_lb = cfg["vwap_lookback"]
        if vwap_lb and len(df) > vwap_lb:
            vwap_start = len(df) - vwap_lb
        else:
            vwap_start = 0
        vwap_series = _calculate_vwap_series(df, start_idx=vwap_start)

        # High/Low VWAP within the lookback window
        window_df = df.iloc[vwap_start:]
        h_idx_loc = window_df["High"].argmax() + vwap_start
        l_idx_loc = window_df["Low"].argmin() + vwap_start
        hvwap_series = _calculate_vwap_series(df, start_idx=h_idx_loc)
        lvwap_series = _calculate_vwap_series(df, start_idx=l_idx_loc)

        # 8. Preset Anchors
        market_presets = PRESET_ANCHORS.get(market_key, {}).get(interval_key, [])
        anchors_list: List[AvwapAnchorSeries] = []
        for i, ad_str in enumerate(market_presets):
            ad_ts = pd.Timestamp(ad_str)
            # Find the first bar matching or containing the anchor date
            matching_indices = np.where(df.index >= (ad_ts - pd.Timedelta(days=6) if interval_key == "1W" else ad_ts))[0]
            if len(matching_indices) == 0:
                continue
            first_idx = int(matching_indices[0])
            anchor_series = _calculate_vwap_series(df, start_idx=first_idx)
            
            val_list: List[AvwapAnchorValue] = []
            for d_idx, val in zip(df.index[first_idx:], anchor_series.iloc[first_idx:]):
                if pd.notna(val) and np.isfinite(val):
                    val_list.append(AvwapAnchorValue(
                        date=d_idx.strftime("%Y-%m-%d"),
                        value=round(float(val), 2)
                    ))
            
            color = ANCHOR_COLORS[i % len(ANCHOR_COLORS)]
            anchors_list.append(AvwapAnchorSeries(
                id=f"anchor_{ad_str.replace('-', '')}",
                name=f"AVWAP ({ad_str})",
                anchor_date=ad_str,
                color=color,
                values=val_list
            ))

        # 9. Build points list
        points: List[AvwapPoint] = []
        for idx, dt in enumerate(df.index):
            d_str = dt.strftime("%Y-%m-%d")
            c = float(df["Close"].iloc[idx])
            o = float(df["Open"].iloc[idx])
            h = float(df["High"].iloc[idx])
            l = float(df["Low"].iloc[idx])
            v = float(df["Volume"].iloc[idx])
            
            # Change % vs prev close
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
                vwap=round(float(vwap_val), 2) if pd.notna(vwap_val) and np.isfinite(vwap_val) else None,
                hvwap=round(float(hvwap_val), 2) if pd.notna(hvwap_val) and np.isfinite(hvwap_val) else None,
                lvwap=round(float(lvwap_val), 2) if pd.notna(lvwap_val) and np.isfinite(lvwap_val) else None,
            ))

        response = AvwapChartResponse(
            market=market_key,
            interval=interval_key,
            points=points,
            anchors=anchors_list,
            preset_dates=market_presets
        )

        _AVWAP_CACHE[cache_key] = {"data": response, "last_mtime": current_mtime}
        return response

    except Exception as e:
        logger.error(f"Error computing AVWAP chart data for {market} ({interval}): {e}", exc_info=True)
        return None
