import logging
import os
from pathlib import Path
from typing import Optional

import polars as pl
from app.schemas import ChartDataPoint, ChartDataResponse

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
KODEX_LEVERAGE_CSV_PATH = _DATA_DIR / "charts" / "kodex_leverage.csv"

_CHART_CACHE = {
    "data": None,
    "last_mtime": 0
}

def load_kodex_leverage_data(
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None
) -> Optional[ChartDataResponse]:
    """
    모든 지표의 데이터 길이를 주가와 1:1로 일치시켜 차트 동기화 밀림을 방지합니다.
    """
    global _CHART_CACHE
    if not KODEX_LEVERAGE_CSV_PATH.exists(): return None

    try:
        current_mtime = os.path.getmtime(KODEX_LEVERAGE_CSV_PATH)
        if _CHART_CACHE["data"] is None or current_mtime > _CHART_CACHE["last_mtime"]:
            # 1. 데이터 로드 및 정렬
            df = pl.read_csv(KODEX_LEVERAGE_CSV_PATH).sort("Date")
            
            # 2. RSI 계산 (초기값 50으로 채움)
            delta = df["Close"].diff()
            gain = delta.clip(0, None)
            loss = -delta.clip(None, 0)
            avg_gain = gain.ewm_mean(alpha=1/14, min_samples=14, adjust=False)
            avg_loss = loss.ewm_mean(alpha=1/14, min_samples=14, adjust=False)
            rsi = (100 - (100 / (1 + (avg_gain / avg_loss)))).fill_null(50.0)
            
            # 3. MACD 계산 (초기값 0으로 채움)
            ema12 = df["Close"].ewm_mean(span=12, adjust=False)
            ema26 = df["Close"].ewm_mean(span=26, adjust=False)
            macd_line = (ema12 - ema26).fill_null(0.0)
            signal_line = macd_line.ewm_mean(span=9, adjust=False).fill_null(0.0)
            
            # 4. 주가 SMA 계산 (초기값은 해당 시점의 주가로 채워 길이 유지)
            price_sma50 = df["Close"].rolling_mean(window_size=50).fill_null(df["Close"])
            price_sma200 = df["Close"].rolling_mean(window_size=200).fill_null(df["Close"])
            
            # 모든 컬럼 결합 (데이터 길이를 CSV 행 개수와 완벽히 일치시킴)
            df = df.with_columns([
                rsi.alias("rsi"),
                macd_line.alias("macd"),
                signal_line.alias("macd_signal"),
                price_sma50.alias("price_sma50"),
                price_sma200.alias("price_sma200"),
                # 기존 CSV 지표들도 Null 처리
                pl.col("SMA10_pct").fill_null(0.0),
                pl.col("ADR14").fill_null(100.0)
            ])
            
            new_data_points = []
            for row in df.to_dicts():
                # 모든 지표를 None 없이 0.0이라도 채워서 보냄 (프론트엔드 필터링 방지)
                indicators = {
                    "sma10": row.get("SMA10_pct") or 0.0,
                    "sma20": row.get("SMA20_pct") or 0.0,
                    "sma50": row.get("SMA50_pct") or 0.0,
                    "sma200": row.get("SMA200_pct") or 0.0,
                    "adr14": row.get("ADR14") or 100.0,
                    "adr20": row.get("ADR20") or 100.0,
                    "rsi": row.get("rsi") or 50.0,
                    "macd": row.get("macd") or 0.0,
                    "macd_signal": row.get("macd_signal") or 0.0,
                    "price_sma50": row.get("price_sma50") or row["Close"],
                    "price_sma200": row.get("price_sma200") or row["Close"],
                }
                new_data_points.append(ChartDataPoint(
                    time=row["Date"],
                    open=row["Open"], high=row["High"], low=row["Low"], close=row["Close"],
                    indicators={k: round(v, 2) for k, v in indicators.items()}
                ))
            
            _CHART_CACHE["data"] = new_data_points
            _CHART_CACHE["last_mtime"] = current_mtime
            logger.info(f"Fixed alignment. All {len(new_data_points)} points have full indicators.")

        all_points = _CHART_CACHE["data"]
        filtered_points = [p for p in all_points if (not start_date or p.time >= start_date) and (not end_date or p.time <= end_date)]
        return ChartDataResponse(symbol="kodex_leverage", data=filtered_points)
    except Exception as e:
        logger.error(f"Polars engine error: {e}")
        return None
