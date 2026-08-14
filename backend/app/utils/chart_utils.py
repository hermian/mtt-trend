import logging
import os
from pathlib import Path
from typing import Optional, Dict

import polars as pl
from app.schemas import ChartDataPoint, ChartDataResponse

logger = logging.getLogger(__name__)

def _leverage_csv_dir() -> Path:
    """KODEX/KOSDAQ 레버리지 CSV 디렉터리. MTT_LEVERAGE_CSV_DIR이 있으면 우선(테스트 등).

    기본은 ``~/.cache/db/kodex_leverage/``. 과거 커밋 오타 경로 ``kodex_levarage``는
    디렉터리가 존재할 때만 폴백합니다.
    """
    override = os.environ.get("MTT_LEVERAGE_CSV_DIR")
    if override:
        return Path(override).expanduser().resolve()
    base = Path.home() / ".cache" / "db"
    canonical = base / "kodex_leverage"
    legacy_typo = base / "kodex_levarage"
    if canonical.exists():
        return canonical
    if legacy_typo.exists():
        return legacy_typo
    return canonical

SYMBOL_MAP = {
    "kodex_leverage": "kodex_leverage.csv",
    "kosdaq_leverage": "kosdaq_leverage.csv",
    "kospi": "kospi_mtt.csv",
    "kospi200": "kospi200_mtt.csv",
    "kosdaq": "kosdaq_mtt.csv",
    "kosdaq150": "kosdaq150_mtt.csv"
}

_CHART_CACHE: Dict[str, dict] = {}


def normalize_chart_time(value) -> str:
    """lightweight-charts business day: YYYY-MM-DD.

    kospi_mtt.csv Date is often pandas datetime
    ``1995-05-02T00:00:00.000000000`` which crashes setVisibleRange/setData.
    """
    if value is None:
        return ""
    s = str(value).strip()
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return s


_MMT_CACHE = None

def _get_mmt_dict():
    global _MMT_CACHE
    if _MMT_CACHE is not None:
        return _MMT_CACHE
    mmt_path = Path("/Users/hosung/workspace/git/marcap/imarcap/mmt_all_count.log")
    res = {}
    if mmt_path.exists():
        try:
            mdf = pl.read_csv(mmt_path)
            for row in mdf.to_dicts():
                d = str(row.get("Date"))[:10]
                mmt_val = row.get("MMT")
                stocks_val = row.get("Stocks")
                if mmt_val is not None and stocks_val and float(stocks_val) > 0:
                    raw_mmt = float(mmt_val)
                    mmt_r_val = raw_mmt / float(stocks_val) * 100.0
                    res[d] = {
                        "mmt": min(raw_mmt, 200.0),
                        "mmt_r": round(mmt_r_val, 2)
                    }
        except Exception as e:
            logger.warning(f"Failed to load MMT log: {e}")
    _MMT_CACHE = res
    return res


_KOSDAQ_CACHE = None

def _get_kosdaq_dict():
    global _KOSDAQ_CACHE
    if _KOSDAQ_CACHE is not None:
        return _KOSDAQ_CACHE
    kq_path = _leverage_csv_dir() / "kosdaq_mtt.csv"
    res = {}
    if kq_path.exists():
        try:
            kdf = pl.read_csv(kq_path)
            for row in kdf.to_dicts():
                d = str(row.get("Date"))[:10]
                v = row.get("Volume")
                c = row.get("Close")
                amt = row.get("Amount")
                if v is not None:
                    v_val = float(v) / 1e7
                    if amt is not None:
                        a_val = float(amt) / 1e11
                    elif c is not None:
                        a_val = (float(c) * float(v)) / 1e11
                    else:
                        a_val = None
                    res[d] = {
                        "kosdaq_volume": round(v_val, 2),
                        "kosdaq_amount": round(a_val, 2) if a_val is not None else None
                    }
        except Exception as e:
            logger.warning(f"Failed to load KOSDAQ csv: {e}")
    _KOSDAQ_CACHE = res
    return res


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
            
            price_sma50_raw = close.rolling_mean(window_size=50)
            price_sma50 = price_sma50_raw.fill_null(close)
            price_sma100 = close.rolling_mean(window_size=100).fill_null(close)
            price_sma150 = close.rolling_mean(window_size=150).fill_null(close)
            price_sma200 = close.rolling_mean(window_size=200).fill_null(close)

            # disparity_sma50: 종가 대비 50일선 이격도 (100 = 50일 이동평균과 동일)
            disparity_sma50 = (close / price_sma50_raw.clip(1e-10, None) * 100).fill_null(100.0)

            # VIX Fix (Williams): 22일 종가 최고값 대비 당일 저가 낙폭 (%)
            close_max22 = close.rolling_max(window_size=22)
            vix_fix = (close_max22 - df["Low"]) / close_max22.clip(1e-10, None) * 100
            # Fear: VIX Fix가 자신의 22일 볼린저 상단(평균+2σ)을 돌파한 날만 값 유지, 그 외 0
            vix_fix_upper = vix_fix.rolling_mean(window_size=22) + vix_fix.rolling_std(window_size=22) * 2
            vix_fix_fear = vix_fix * (vix_fix > vix_fix_upper).cast(pl.Float64)
            
            # 2. 데이터 통합 및 행 단위 추출
            raw_data = df.to_dicts()
            calculated_rsi = rsi.to_list()
            calculated_macd = macd_line.to_list()
            calculated_sig = signal_line.to_list()
            calculated_sk = slow_k.to_list()
            calculated_sd = slow_d.to_list()
            calculated_ma50 = price_sma50.to_list()
            calculated_ma100 = price_sma100.to_list()
            calculated_ma150 = price_sma150.to_list()
            calculated_ma200 = price_sma200.to_list()
            calculated_disparity_sma50 = disparity_sma50.to_list()
            calculated_vix_fix = vix_fix.to_list()
            calculated_vix_fix_fear = vix_fix_fear.to_list()
            
            new_data_points = []
            for i, row in enumerate(raw_data):
                h52 = row.get("high52sum")
                l52 = row.get("low52sum")
                try:
                    h52_l52 = float(h52) - float(l52) if h52 is not None and l52 is not None else None
                except (TypeError, ValueError):
                    h52_l52 = None

                indicators = {
                    "rsi": calculated_rsi[i],
                    "macd": calculated_macd[i],
                    "macd_signal": calculated_sig[i],
                    "stoch_k": calculated_sk[i],
                    "stoch_d": calculated_sd[i],
                    "price_sma50": calculated_ma50[i],
                    "price_sma100": calculated_ma100[i],
                    "price_sma150": calculated_ma150[i],
                    "price_sma200": calculated_ma200[i],
                    # CSV SMA*_pct: 시장 breadth (해당 이평 위 종목 비율)
                    "above_sma10": row.get("SMA10_pct") if row.get("SMA10_pct") is not None else row.get("above10ma_pct"),
                    "above_sma20": row.get("SMA20_pct") if row.get("SMA20_pct") is not None else row.get("above20ma_pct"),
                    "above_sma50": row.get("SMA50_pct") if row.get("SMA50_pct") is not None else row.get("above50ma_pct"),
                    "above_sma200": row.get("SMA200_pct") if row.get("SMA200_pct") is not None else row.get("above200ma_pct"),
                    "disparity_sma50": calculated_disparity_sma50[i],
                    "adr14": row.get("ADR14") if row.get("ADR14") is not None else row.get("adr14"),
                    "adr20": row.get("ADR20") if row.get("ADR20") is not None else (row.get("adr20") if row.get("adr20") is not None else row.get("ADR14")),
                    "vix_fix": calculated_vix_fix[i],
                    "vix_fix_fear": calculated_vix_fix_fear[i],
                    "price_sma150": row.get("SMA150"),
                    "stockbee_mm": row.get("stockbee_mm"),
                    "above_sma40": row.get("above40ma_pct") if row.get("above40ma_pct") is not None else row.get("SMA40_pct"),
                    "high52sum": h52,
                    "low52sum": l52,
                    "high52_low52": h52_l52,
                    "bam": row.get("bam"),
                    "adl": row.get("adl"),
                    "mcclellan_oscilator": row.get("mcclellan_oscilator"),
                    "mcclellan_summation_indicator": row.get("mcclellan_summation_indicator"),
                    "mcclellan_summation": row.get("mcclellan_summation_indicator"),
                    "saito_ratio": row.get("saito_ratio"),
                    "zbt": row.get("ZBT") if row.get("ZBT") is not None else row.get("zbt"),
                    "mmt": _get_mmt_dict().get(str(row.get("Date"))[:10], {}).get("mmt", row.get("MMT") if row.get("MMT") is not None else row.get("mmt")),
                    "mmt_r": _get_mmt_dict().get(str(row.get("Date"))[:10], {}).get("mmt_r", row.get("MMT_R") if row.get("MMT_R") is not None else row.get("mmt_r")),
                    "usdkrw": row.get("USD/KRW") if row.get("USD/KRW") is not None else row.get("usdkrw"),
                    "kospi_amount": round(float(row.get("Amount")) / 1e11, 2) if row.get("Amount") is not None else None,
                    "kosdaq_amount": _get_kosdaq_dict().get(str(row.get("Date"))[:10], {}).get("kosdaq_amount"),
                    "kospi_volume": round(float(row.get("Volume")) / 1e7, 2) if row.get("Volume") is not None else None,
                    "kosdaq_volume": _get_kosdaq_dict().get(str(row.get("Date"))[:10], {}).get("kosdaq_volume"),
                    "macd_hist": row.get("MACDh_12_26_9"),
                }
                
                def _to_float(val):
                    if val is None or val == "" or str(val).lower() == "none":
                        return 0.0
                    try:
                        return round(float(val), 2)
                    except Exception:
                        return 0.0

                new_data_points.append(ChartDataPoint(
                    time=normalize_chart_time(row["Date"]),
                    open=row["Open"], high=row["High"], low=row["Low"], close=row["Close"],
                    volume=row.get("Volume", 0),
                    indicators={k: _to_float(v) for k, v in indicators.items()}
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
