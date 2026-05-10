import logging
import os
from pathlib import Path
from typing import Optional, Dict

import polars as pl
from app.schemas import ChartDataPoint, ChartDataResponse

logger = logging.getLogger(__name__)

def _leverage_csv_dir() -> Path:
    """KODEX/KOSDAQ 레버리지 CSV 디렉터리. MTT_LEVERAGE_CSV_DIR이 있으면 우선(테스트 등)."""
    override = os.environ.get("MTT_LEVERAGE_CSV_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".cache" / "db" / "kodex_levarage"

SYMBOL_MAP = {
    "kodex_leverage": "kodex_leverage.csv",
    "kosdaq_leverage": "kosdaq_leverage.csv"
}

_CHART_CACHE: Dict[str, dict] = {}

def load_chart_data(
    symbol: str,
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None
) -> Optional[ChartDataResponse]:
    """
    CSV 데이터와 Polars 엔진 계산 지표를 통합하여 반환합니다.
    Volume 데이터를 누락 없이 포함합니다.
    """
    global _CHART_CACHE
    
    file_name = SYMBOL_MAP.get(symbol)
    if not file_name: return None
    csv_path = _leverage_csv_dir() / file_name
    if not csv_path.exists(): return None

    try:
        current_mtime = os.path.getmtime(csv_path)
        if symbol not in _CHART_CACHE:
            _CHART_CACHE[symbol] = {"data": None, "last_mtime": 0}
            
        cache = _CHART_CACHE[symbol]
        
        if cache["data"] is None or current_mtime > cache["last_mtime"]:
            df = pl.read_csv(csv_path).unique("Date").sort("Date")
            close = df["Close"]
            
            # 1. Polars 엔진 지표 계산
            rsi = (100 - (100 / (1 + (close.diff().clip(0, None).ewm_mean(alpha=1/14, min_samples=1, adjust=False) / 
                                    (close.diff().clip(None, 0).abs().ewm_mean(alpha=1/14, min_samples=1, adjust=False) + 1e-10))))).fill_null(50.0)
            
            ema12 = close.ewm_mean(span=12, adjust=False)
            ema26 = close.ewm_mean(span=26, adjust=False)
            macd_line = (ema12 - ema26).fill_null(0.0)
            signal_line = macd_line.ewm_mean(span=9, adjust=False).fill_null(0.0)
            
            low_5 = df["Low"].rolling_min(window_size=5)
            high_5 = df["High"].rolling_max(window_size=5)
            stoch_range = (high_5 - low_5).clip(1e-10, None)
            slow_k = ((close - low_5) / stoch_range * 100).rolling_mean(window_size=3).fill_null(50.0)
            slow_d = slow_k.rolling_mean(window_size=3).fill_null(50.0)
            
            price_sma50 = close.rolling_mean(window_size=50).fill_null(close)
            price_sma200 = close.rolling_mean(window_size=200).fill_null(close)
            
            # 2. 데이터 통합 및 행 단위 추출
            raw_data = df.to_dicts()
            calculated_rsi = rsi.to_list()
            calculated_macd = macd_line.to_list()
            calculated_sig = signal_line.to_list()
            calculated_sk = slow_k.to_list()
            calculated_sd = slow_d.to_list()
            calculated_ma50 = price_sma50.to_list()
            calculated_ma200 = price_sma200.to_list()
            
            new_data_points = []
            for i, row in enumerate(raw_data):
                indicators = {
                    "rsi": calculated_rsi[i],
                    "macd": calculated_macd[i],
                    "macd_signal": calculated_sig[i],
                    "stoch_k": calculated_sk[i],
                    "stoch_d": calculated_sd[i],
                    "price_sma50": calculated_ma50[i],
                    "price_sma200": calculated_ma200[i],
                    "sma10": row.get("SMA10_pct"),
                    "sma20": row.get("SMA20_pct"),
                    "sma50": row.get("SMA50_pct"),
                    "sma200": row.get("SMA200_pct"),
                    "adr14": row.get("ADR14"),
                    "adr20": row.get("ADR20"),
                }
                
                new_data_points.append(ChartDataPoint(
                    time=row["Date"],
                    open=row["Open"], high=row["High"], low=row["Low"], close=row["Close"],
                    volume=row.get("Volume", 0),  # 거래량 데이터 추가!
                    indicators={k: round(float(v), 2) if v is not None else 0.0 for k, v in indicators.items()}
                ))
            
            cache["data"] = new_data_points
            cache["last_mtime"] = current_mtime
            logger.info(f"Sync Completed with Volume for {symbol}.")

        all_points = cache["data"]
        filtered_points = [p for p in all_points if (not start_date or p.time >= start_date) and (not end_date or p.time <= end_date)]
        return ChartDataResponse(symbol=symbol.upper(), data=filtered_points)
    except Exception as e:
        logger.error(f"Engine error: {e}")
        return None
