import logging
import os
import re
import gzip
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
        "ta_indicators": [("SMA_10", 10, "sma"), ("SMA_20", 20, "sma"), ("SMA_30", 30, "sma"), ("SMA_40", 40, "sma")],
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
    "sox": {
        "1D": [
            "2018-12-24", "2020-03-23", "2022-01-04", "2022-10-13",
            "2023-10-27", "2024-08-05", "2024-11-05", "2025-04-07"
        ],
        "1W": ["2018-12-24", "2020-03-23", "2022-01-04", "2022-10-13", "2023-10-27", "2024-08-05", "2025-04-07"],
        "1M": ["2018-12-24", "2020-03-23", "2022-01-04", "2022-10-13", "2023-10-27", "2025-04-07"],
        "1Y": ["2020-03-23", "2022-01-04"],
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
    "sox": "sox",
    "^sox": "sox",
}

INDEX_DISPLAY_NAMES: Dict[str, str] = {
    "kospi": "KOSPI 지수",
    "kosdaq": "KOSDAQ 지수",
    "sp500": "S&P 500 지수",
    "nasdaq100": "NDX 지수",
    "dow30": "DOW 지수",
    "sox": "SOX 지수",
}

INDEX_AMOUNT_UNITS: Dict[str, str] = {
    "kospi": "조원",
    "kosdaq": "조원",
    "sp500": "조$",
    "nasdaq100": "조$",
    "dow30": "조$",
    "sox": "억$",
}

ANCHOR_COLORS = [
    "#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
    "#6366f1", "#14b8a6", "#f97316", "#a855f7", "#0ea5e9",
    "#d946ef", "#84cc16", "#eab308", "#38bdf8", "#fb7185",
    "#2dd4bf", "#c084fc", "#f43f5e", "#4ade80", "#a78bfa"
]

_AVWAP_CACHE: Dict[str, Any] = {}
_ETF_MASTER_CACHE: Optional[List[Tuple[str, str]]] = None
_US_STOCK_MASTER_CACHE: Optional[List[Tuple[str, str, str, str]]] = None
_US_ETF_MASTER_CACHE: Optional[List[Tuple[str, str, str, str]]] = None
_MARCAP_DUCKDB_CON: Optional[Any] = None
_MARCAP_DUCKDB_CON_MTIME: float = 0.0

# AVWAP 계산에 쓰는 최소 날짜. `marcap_adj` 는 1995-05-02 부터 있지만 2000년 이전 행이
# 전체의 9.5%(1,296,263건)를 차지하고, AVWAP 출력에는 쓰이지 않는다. 이 컷은 리팩터링
# 이전부터 있던 동작이며(당시엔 pandas 인덱스 슬라이싱 2곳), SQL 술어로 밀어내면
# DuckDB Zone Map pruning 으로 조회가 264ms → 26ms 로 줄어든다. 세 곳이 같은 값을 써야
# 하므로 상수로 둔다(경로마다 다른 컷을 쓰면 같은 종목이 경로에 따라 다른 길이가 된다).
_AVWAP_MIN_DATE = "2000-01-01"


def _get_marcap_duckdb_con():
    """marcap.duckdb 읽기 전용 커넥션을 반환합니다 (연결 생성 비용 제거).

    커넥션은 최초 오픈 시점의 파일에 고정되므로, 수집기가 파일을 교체(rename)하면
    재시작 전까지 옛 데이터를 계속 읽는다. 파일 mtime 이 바뀌면 재오픈해 이를 막는다.
    """
    global _MARCAP_DUCKDB_CON, _MARCAP_DUCKDB_CON_MTIME
    m_path = os.path.expanduser("~/.cache/db/marcap.duckdb")
    if not os.path.exists(m_path):
        return None
    try:
        mtime = os.path.getmtime(m_path)
    except OSError:
        mtime = 0.0

    if _MARCAP_DUCKDB_CON is not None and _MARCAP_DUCKDB_CON_MTIME == mtime:
        return _MARCAP_DUCKDB_CON

    if _MARCAP_DUCKDB_CON is not None:
        try:
            _MARCAP_DUCKDB_CON.close()
        except Exception:
            pass
        _MARCAP_DUCKDB_CON = None

    try:
        _MARCAP_DUCKDB_CON = duckdb.connect(m_path, read_only=True)
    except Exception as e:
        logger.warning(f"Failed to open read-only duckdb connection: {e}")
        _MARCAP_DUCKDB_CON_MTIME = 0.0
        return None
    _MARCAP_DUCKDB_CON_MTIME = mtime
    return _MARCAP_DUCKDB_CON


def _marcap_query_df(sql: str, params: list):
    """marcap.duckdb 에서 읽기 전용 조회 후 DataFrame 을 반환합니다.

    공유 커넥션을 그대로 쓰면 안 된다: `con.execute()` 는 self 를 반환하고 `fetchdf()` 는
    그 커넥션의 '가장 최근 쿼리' 결과를 가져오므로, sync 핸들러가 threadpool 에서 동시에
    돌면 execute→fetch 사이에 다른 스레드의 쿼리가 끼어들어 다른 결과나 None 을 받는다
    (8스레드 실측 오염 30.3%, None 반환 61/320). 스레드마다 `cursor()` 로 분리한다.
    """
    con = _get_marcap_duckdb_con()
    if con is None:
        return None
    cur = con.cursor()
    try:
        return cur.execute(sql, params).fetchdf()
    finally:
        cur.close()


def invalidate_avwap_cache():
    """Clear in-memory AVWAP cache when custom anchors change.

    marcap.duckdb 커넥션은 닫지 않는다. 앵커 변경은 sqlite 쪽 데이터이고, 여기서 닫으면
    threadpool 에서 조회 중인 다른 요청의 커서가 깨진다. 데이터 갱신은 mtime 재오픈이 처리한다.
    """
    global _AVWAP_CACHE, _ETF_MASTER_CACHE, _US_STOCK_MASTER_CACHE, _US_ETF_MASTER_CACHE
    _AVWAP_CACHE.clear()
    _ETF_MASTER_CACHE = None
    _US_STOCK_MASTER_CACHE = None
    _US_ETF_MASTER_CACHE = None


# AVWAP 응답은 엔트리당 실측 ~7.9MB(모델 7.2 + gz 0.67)로 매우 크다. 키가
# `stock_{code}_{interval}` 이라 심볼 열람 수에 비례해 무한 증가하므로 상한을 둔다.
# 10개면 pre-warm 6건 + 사용자가 열어본 종목 몇 건을 담을 수 있다(~79MB).
_AVWAP_CACHE_MAX = 10


def _avwap_cache_get(cache_key: str, mtime: float) -> Optional[Any]:
    """mtime 이 일치하면 캐시된 응답을 반환한다. 조회 시 순서를 갱신해 LRU 로 동작한다.

    (FIFO 로 두면 pre-warm 한 지수들이 가장 먼저 밀려나 재방문이 잦은 항목이 손실된다.)
    """
    cached = _AVWAP_CACHE.get(cache_key)
    if cached is None or cached["last_mtime"] != mtime:
        return None
    _AVWAP_CACHE.pop(cache_key)
    _AVWAP_CACHE[cache_key] = cached
    return cached["data"]


def _avwap_cache_put(cache_key: str, response: Any, mtime: float) -> None:
    """캐시에 저장한다. 상한을 넘으면 가장 오래전에 쓰이거나 조회된 항목을 버린다."""
    _AVWAP_CACHE.pop(cache_key, None)
    if len(_AVWAP_CACHE) >= _AVWAP_CACHE_MAX:
        _AVWAP_CACHE.pop(next(iter(_AVWAP_CACHE)))
    _AVWAP_CACHE[cache_key] = {"data": response, "last_mtime": mtime}


def _get_macro_db_path() -> Path:
    override = os.environ.get("MTT_MACRO_DB_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return Path(os.path.expanduser("~/.cache/db/macro.db"))


def _get_stock_us_master_path() -> Path:
    override = os.environ.get("MTT_STOCK_US_MASTER_DB_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return Path(os.path.expanduser("~/.cache/db/stock_us_master.db"))


def _get_stock_us_price_path() -> Path:
    override = os.environ.get("MTT_STOCK_US_PRICE_DB_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return Path(os.path.expanduser("~/.cache/db/stock_us_price.db"))


def _get_etf_us_master_path() -> Path:
    override = os.environ.get("MTT_ETF_US_MASTER_DB_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return Path(os.path.expanduser("~/.cache/db/etf_us_master.db"))


def _get_etf_us_price_path() -> Path:
    override = os.environ.get("MTT_ETF_US_PRICE_DB_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return Path(os.path.expanduser("~/.cache/db/etf_us_price.db"))

def _load_index_raw_df(market_key: str) -> Optional[Tuple[pd.DataFrame, float]]:
    """
    KOSPI, KOSDAQ, S&P500, NASDAQ100, DOW30, SOX 지수의 raw OHLCV 데이터를 반환합니다.
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
                if not df.empty and market_key == "sox":
                    try:
                        # SOX 지수는 Yahoo Finance API에서 volume=0으로 제공되므로,
                        # 1:1 추종 대표 ETF인 SOXX의 volume 및 amount를 결합합니다.
                        soxx_df = pd.read_sql_query(
                            "SELECT date as Date, volume as ProxyVolume, amount as ProxyAmount "
                            "FROM index_ohlcv WHERE index_name = 'soxx' ORDER BY date",
                            con
                        )
                        if not soxx_df.empty:
                            df = df.merge(soxx_df, on="Date", how="left")
                            df["Volume"] = df["ProxyVolume"].fillna(df["Volume"])
                            df["Amount"] = df["ProxyAmount"].fillna(df["Amount"])
                            df.drop(columns=["ProxyVolume", "ProxyAmount"], inplace=True)
                        else:
                            # macro.db에 soxx가 없을 경우 etf_us_price.db SOXX.O 폴백
                            etf_db = db_path.parent / "etf_us_price.db"
                            if etf_db.exists():
                                con_etf = sqlite3.connect(f"file:{etf_db.resolve()}?mode=ro", uri=True)
                                try:
                                    fallback_df = pd.read_sql_query(
                                        "SELECT Date, Volume as ProxyVolume, (Close * Volume) as ProxyAmount "
                                        "FROM etf_us_price WHERE Code = 'SOXX.O' ORDER BY Date",
                                        con_etf
                                    )
                                    if not fallback_df.empty:
                                        fallback_df["Date"] = fallback_df["Date"].astype(str).str[:10]
                                        df = df.merge(fallback_df, on="Date", how="left")
                                        df["Volume"] = df["ProxyVolume"].fillna(df["Volume"])
                                        df["Amount"] = df["ProxyAmount"].fillna(df["Amount"])
                                        df.drop(columns=["ProxyVolume", "ProxyAmount"], inplace=True)
                                finally:
                                    con_etf.close()
                    except Exception as pe:
                        logger.warning(f"Failed to merge SOXX proxy volume into SOX: {pe}")
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


def _calculate_3y_high_change(df: pd.DataFrame) -> pd.Series:
    """3년(1095일) 최고가 대비 하락률(%): (Close - 3Y_High) / 3Y_High * 100."""
    h3y = df["High"].rolling("1095D", min_periods=1).max()
    chg = (df["Close"] - h3y) / h3y.replace(0, np.nan) * 100.0
    return chg.fillna(0.0)



def _calculate_vwap_series(df: pd.DataFrame, start_idx: Optional[int] = None) -> pd.Series:
    """Calculate VWAP: typical_price = (H + L + C + O) / 4."""
    if start_idx is not None and start_idx < len(df):
        sub = df.iloc[start_idx:].copy()
    else:
        sub = df.copy()
    
    tp = (sub["High"] + sub["Low"] + sub["Close"] + sub["Open"]) / 4.0
    vol = sub["Volume"]
    if "Volume" not in sub.columns or vol.fillna(0).sum() == 0:
        vol = pd.Series(1.0, index=sub.index)
    cum_vol = vol.cumsum().replace(0, np.nan)
    vwap_sub = (tp * vol).cumsum() / cum_vol
    
    full_series = pd.Series(index=df.index, dtype=float)
    full_series.iloc[start_idx if start_idx is not None else 0:] = vwap_sub
    return full_series


def _build_anchor_values_fast(dates_str: List[str], a_series: pd.Series, start_pos: int) -> List[AvwapAnchorValue]:
    """고속 앵커 VWAP 포인트 리스트 생성 (NumPy 1D 배열 및 model_construct 활용)."""
    a_vals = a_series.to_numpy(dtype=float)
    n = len(dates_str)
    val_list: List[AvwapAnchorValue] = []
    for i in range(start_pos, n):
        v = a_vals[i]
        if not np.isnan(v) and np.isfinite(v):
            val_list.append(AvwapAnchorValue.model_construct(
                date=dates_str[i],
                value=round(float(v), 2)
            ))
    return val_list


def _build_avwap_points_fast(
    df: pd.DataFrame,
    dates_str: List[str],
    ma_dict: Dict[str, pd.Series],
    vol_ma_series: pd.Series,
    amount_series: pd.Series,
    amount_sma50_series: pd.Series,
    bb_upper_series: Optional[pd.Series],
    vix_fix_series: pd.Series,
    rsi_series: pd.Series,
    mdd_series: pd.Series,
    h52_chg_series: pd.Series,
    dd_3y_series: pd.Series,
    vwap_series: pd.Series,
    hvwap_series: pd.Series,
    lvwap_series: pd.Series,
) -> List[AvwapPoint]:
    """고속 AVWAP 일별/주기별 포인트 리스트 생성 (NumPy 1D 배열 직접 인덱싱 및 model_construct)."""
    n = len(df)
    if n == 0:
        return []

    c_arr = df["Close"].to_numpy(dtype=float)
    o_arr = df["Open"].to_numpy(dtype=float)
    h_arr = df["High"].to_numpy(dtype=float)
    l_arr = df["Low"].to_numpy(dtype=float)
    v_arr = df["Volume"].to_numpy(dtype=float)

    ma_arrs = {k: s.to_numpy(dtype=float) for k, s in ma_dict.items()}
    vol_ma_arr = vol_ma_series.to_numpy(dtype=float)
    amt_arr = amount_series.to_numpy(dtype=float)
    amt_sma_arr = amount_sma50_series.to_numpy(dtype=float)
    bb_u_arr = bb_upper_series.to_numpy(dtype=float) if bb_upper_series is not None else None
    vix_arr = vix_fix_series.to_numpy(dtype=float)
    rsi_arr = rsi_series.to_numpy(dtype=float)
    mdd_arr = mdd_series.to_numpy(dtype=float)
    h52_arr = h52_chg_series.to_numpy(dtype=float)
    dd_3y_arr = dd_3y_series.to_numpy(dtype=float)
    vwap_arr = vwap_series.to_numpy(dtype=float)
    hvwap_arr = hvwap_series.to_numpy(dtype=float)
    lvwap_arr = lvwap_series.to_numpy(dtype=float)

    points: List[AvwapPoint] = []
    for i in range(n):
        c = c_arr[i]
        chg = round((c / c_arr[i - 1] - 1.0) * 100.0, 2) if i > 0 and c_arr[i - 1] > 0 else None
        pt_ma = {k: round(float(arr[i]), 2) if not np.isnan(arr[i]) else None for k, arr in ma_arrs.items()}

        points.append(AvwapPoint.model_construct(
            date=dates_str[i],
            open=round(float(o_arr[i]), 2),
            high=round(float(h_arr[i]), 2),
            low=round(float(l_arr[i]), 2),
            close=round(float(c), 2),
            volume=round(float(v_arr[i]), 2),
            change_pct=chg,
            ma=pt_ma,
            vol_ma=round(float(vol_ma_arr[i]), 2) if not np.isnan(vol_ma_arr[i]) else None,
            amount=round(float(amt_arr[i]), 2) if not np.isnan(amt_arr[i]) else None,
            amount_sma50=round(float(amt_sma_arr[i]), 2) if not np.isnan(amt_sma_arr[i]) else None,
            bb_upper=round(float(bb_u_arr[i]), 2) if bb_u_arr is not None and not np.isnan(bb_u_arr[i]) else None,
            vix_fix=round(float(vix_arr[i]), 2) if not np.isnan(vix_arr[i]) else None,
            rsi=round(float(rsi_arr[i]), 2) if not np.isnan(rsi_arr[i]) else None,
            mdd=round(float(mdd_arr[i]), 2) if not np.isnan(mdd_arr[i]) else None,
            h52_chg=round(float(h52_arr[i]), 2) if not np.isnan(h52_arr[i]) else None,
            dd_52w=round(float(h52_arr[i]), 2) if not np.isnan(h52_arr[i]) else None,
            dd_3y=round(float(dd_3y_arr[i]), 2) if not np.isnan(dd_3y_arr[i]) else None,
            vwap=round(float(vwap_arr[i]), 2) if not np.isnan(vwap_arr[i]) else None,
            hvwap=round(float(hvwap_arr[i]), 2) if not np.isnan(hvwap_arr[i]) else None,
            lvwap=round(float(lvwap_arr[i]), 2) if not np.isnan(lvwap_arr[i]) else None,
        ))
    return points


def load_avwap_chart_bytes(
    market: str = "kospi",
    interval: str = "1D",
    symbol: Optional[str] = None,
    *,
    need_raw: bool = True,
) -> Tuple[Optional[bytes], Optional[bytes]]:
    """
    AVWAP 차트 응답 데이터를 (raw_bytes, gz_bytes) 형태로 반환합니다.
    캐시된 데이터 모델에 압축 바이트를 메모이제이션하여 웜 요청 시 수 ms 이내로 응답합니다.

    gz 바이트만 모델에 보관한다. raw 는 엔트리당 ~3.3MB 로, 브라우저가 항상
    `Accept-Encoding: gzip` 을 보내므로 실사용 경로가 없는 사망분이다.
    비압축 클라이언트(curl 등)만 `need_raw=True` 로 호출해 그때 직렬화한다.
    """
    data = load_avwap_chart_data(market=market, interval=interval, symbol=symbol)
    if data is None:
        return None, None

    gz_bytes = getattr(data, "_cached_gz_bytes", None)
    if gz_bytes is None:
        gz_bytes = gzip.compress(
            data.model_dump_json(by_alias=True).encode("utf-8"), compresslevel=6
        )
        try:
            object.__setattr__(data, "_cached_gz_bytes", gz_bytes)
        except Exception:
            pass

    raw_bytes = data.model_dump_json(by_alias=True).encode("utf-8") if need_raw else None
    return raw_bytes, gz_bytes


def load_avwap_chart_data(
    market: str = "kospi",
    interval: str = "1D",
    symbol: Optional[str] = None
) -> Optional[AvwapChartResponse]:
    global _AVWAP_CACHE
    
    if symbol and symbol.strip():
        sym = symbol.strip()
        raw_m = market.lower().strip()
        if raw_m in ("etf", "us_etf"):
            res = load_etf_avwap_chart_data(sym, interval)
            if res is not None:
                return res
            return load_us_etf_avwap_chart_data(sym, interval)
        
        info = resolve_stock_info(sym)
        if info:
            code, name, m_type = info
            if m_type == "ETF":
                return load_etf_avwap_chart_data(code, interval)
            elif m_type in ("US_ETF", "ETF_US"):
                return load_us_etf_avwap_chart_data(code, interval)
            elif m_type in ("NASDAQ", "NYSE", "AMEX", "US"):
                return load_us_stock_avwap_chart_data(code, interval)
            else:
                res = load_stock_avwap_chart_data(code, interval)
                if res is not None:
                    return res

        for loader in (load_stock_avwap_chart_data, load_etf_avwap_chart_data, load_us_stock_avwap_chart_data, load_us_etf_avwap_chart_data):
            res = loader(sym, interval)
            if res is not None:
                return res
        return None
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
    cached_data = _avwap_cache_get(cache_key, current_mtime)
    if cached_data is not None:
        return cached_data

    try:
        if "Date" not in df_raw.columns:
            logger.error(f"Index data missing 'Date' column for {market_key}")
            return None
            
        df_raw["Date"] = pd.to_datetime(df_raw["Date"].astype(str).str[:10])
        df_raw = df_raw.sort_values("Date").drop_duplicates("Date").set_index("Date")
        df_raw = df_raw[df_raw.index >= _AVWAP_MIN_DATE]

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

        # Amount: Jo (조원/조$: 1e12), Eok (억$: 1e8), Million (백만$: 1e6)
        amount_unit = INDEX_AMOUNT_UNITS.get(market_key, "조원")
        amount_divisor = 1e8 if amount_unit == "억$" else (1e6 if amount_unit == "백만$" else 1e12)
        amount_series = df["Amount"] / amount_divisor
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
        dd_3y_series = _calculate_3y_high_change(df)


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
        dates_str = df.index.strftime("%Y-%m-%d").tolist()

        # Dynamic YTD Anchor for index (first trading bar of current year)
        ytd_candidates = df[df.index >= f"{df.index.max().year}-01-01"]
        ytd_dt = ytd_candidates.index.min() if not ytd_candidates.empty else None
        if ytd_dt is not None:
            valid_ytd = df.index[df.index >= ytd_dt]
            if len(valid_ytd) > 0:
                ytd_matched_dt = valid_ytd[0]
                ytd_str = ytd_matched_dt.strftime("%Y-%m-%d")
                if ytd_str not in suppressed_dates and ytd_str not in seen_dates:
                    seen_dates.add(ytd_str)
                    start_pos = df.index.get_loc(ytd_matched_dt)
                    if isinstance(start_pos, slice):
                        start_pos = start_pos.start
                    a_series = _calculate_vwap_series(df, start_idx=start_pos)
                    val_list = _build_anchor_values_fast(dates_str, a_series, start_pos)
                    anchors_list.append(AvwapAnchorSeries(
                        id=f"anchor_ytd_{ytd_str.replace('-', '')}",
                        name=f"YTD ({ytd_str})",
                        anchor_date=ytd_str,
                        color="#10b981",
                        values=val_list
                    ))

        for idx, ad_str in enumerate(preset_dates):
            if ad_str in suppressed_dates or ad_str in seen_dates:
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
            val_list = _build_anchor_values_fast(dates_str, a_series, start_pos)
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
            val_list = _build_anchor_values_fast(dates_str, a_series, start_pos)
            display_name_anc = ca.label if ca.label and ca.label.strip() else f"AVWAP ({ad_str})"
            anchors_list.append(AvwapAnchorSeries(
                id=ca.id,
                name=display_name_anc,
                anchor_date=ad_str,
                color=ca.color or "#ec4899",
                values=val_list
            ))

        # 8. Build response points
        points = _build_avwap_points_fast(
            df=df,
            dates_str=dates_str,
            ma_dict=ma_dict,
            vol_ma_series=vol_ma_series,
            amount_series=amount_series,
            amount_sma50_series=amount_sma50_series,
            bb_upper_series=bb_upper_series,
            vix_fix_series=vix_fix_series,
            rsi_series=rsi_series,
            mdd_series=mdd_series,
            h52_chg_series=h52_chg_series,
            dd_3y_series=dd_3y_series,
            vwap_series=vwap_series,
            hvwap_series=hvwap_series,
            lvwap_series=lvwap_series,
        )
            
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
        
        _avwap_cache_put(cache_key, response, current_mtime)
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
        conn = sqlite3.connect(f"file:{Path(e_path).resolve()}?mode=ro", uri=True)
        cur = conn.cursor()
        cur.execute("SELECT 종목코드, 종목명 FROM etf_price WHERE 날짜 = (SELECT MAX(날짜) FROM etf_price)")
        _ETF_MASTER_CACHE = cur.fetchall()
        conn.close()
    except Exception as e:
        logger.warning(f"Error loading ETF master list from etf_price.db: {e}")
        _ETF_MASTER_CACHE = []

    return _ETF_MASTER_CACHE


def _get_us_stock_master_list() -> List[Tuple[str, str, str, str]]:
    """
    stock_us_master.db에서 고유한 (symbol, hname, name, primary_exchange_name) 목록을 반환합니다.
    """
    global _US_STOCK_MASTER_CACHE
    if _US_STOCK_MASTER_CACHE is not None:
        return _US_STOCK_MASTER_CACHE

    db_path = _get_stock_us_master_path()
    if not db_path.exists():
        return []

    try:
        conn = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True)
        cur = conn.cursor()
        cur.execute("SELECT symbol, hname, name, primary_exchange_name FROM stock_master")
        rows = cur.fetchall()
        conn.close()
        _US_STOCK_MASTER_CACHE = [(r[0] or "", r[1] or "", r[2] or "", r[3] or "US") for r in rows if r[0]]
    except Exception as e:
        logger.warning(f"Error loading US stock master list: {e}")
        _US_STOCK_MASTER_CACHE = []

    return _US_STOCK_MASTER_CACHE


def _get_us_etf_master_list() -> List[Tuple[str, str, str, str]]:
    """
    etf_us_master.db에서 고유한 (Symbol, Name, Exchange, url) 목록을 반환합니다.
    """
    global _US_ETF_MASTER_CACHE
    if _US_ETF_MASTER_CACHE is not None:
        return _US_ETF_MASTER_CACHE

    db_path = _get_etf_us_master_path()
    if not db_path.exists():
        return []

    try:
        conn = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True)
        cur = conn.cursor()
        cur.execute("SELECT Symbol, Name, Exchange, url FROM etf_master")
        rows = cur.fetchall()
        conn.close()
        _US_ETF_MASTER_CACHE = [(r[0] or "", r[1] or "", r[2] or "US_ETF", r[3] or r[0] or "") for r in rows if r[0]]
    except Exception as e:
        logger.warning(f"Error loading US ETF master list: {e}")
        _US_ETF_MASTER_CACHE = []

    return _US_ETF_MASTER_CACHE


def resolve_stock_info(query: str, asset_type: Optional[str] = None) -> Optional[Tuple[str, str, str]]:
    """
    종목코드 또는 종목명으로 (종목코드, 종목명, 시장구분)을 조회합니다.
    asset_type: 'stock' | 'etf' | None (None이면 stock -> etf -> us_stock -> us_etf 순으로 조회)
    """
    q = query.strip()
    if not q:
        return None

    # '애플 (AAPL)' 또는 '삼성전자 (005930)' 형태처럼 괄호 안에 종목코드가 포함된 경우 코드 우선 추출
    match = re.search(r'\(([0-9a-zA-Z\.\-_]{1,10})\)', q)
    if match:
        extracted = match.group(1)
        res = resolve_stock_info(extracted, asset_type)
        if res:
            return res

    q_lower = q.lower()
    q_upper = q.upper()

    # 1. ETF 모드인 경우
    if asset_type == "etf":
        # 1-1. Exact match (KR ETF -> US ETF)
        etfs = _get_etf_master_list()
        if q.isdigit() or len(q) == 6:
            code_target = q.zfill(6).upper()
            for code, name in etfs:
                if code.upper() == code_target:
                    return code, name, "ETF"
        for code, name in etfs:
            if code.lower() == q_lower or name.lower() == q_lower:
                return code, name, "ETF"

        us_etfs = _get_us_etf_master_list()
        for sym, name, exch, url in us_etfs:
            if sym.upper() == q_upper:
                return sym, name, "US_ETF"
        for sym, name, exch, url in us_etfs:
            if name.lower() == q_lower:
                return sym, name, "US_ETF"

        # 1-2. Substring match
        for code, name in etfs:
            if q_lower in name.lower() or q_lower in code.lower():
                return code, name, "ETF"

        for sym, name, exch, url in us_etfs:
            if q_lower in name.lower() or q_lower in sym.lower():
                return sym, name, "US_ETF"
        return None

    # 2. 일반 주식 모드인 경우
    if asset_type == "stock":
        # 2-1. KR stock exact
        sm_path = os.path.expanduser("~/.cache/db/stock_master.db")
        if os.path.exists(sm_path):
            try:
                conn = sqlite3.connect(f"file:{Path(sm_path).resolve()}?mode=ro", uri=True)
                cur = conn.cursor()
                if q.isdigit():
                    code = q.zfill(6)
                    cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목코드 = ?", (code,))
                    row = cur.fetchone()
                    if row:
                        conn.close()
                        return row[0], row[1], row[2] or "KOSPI"

                cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목명 = ?", (q,))
                row = cur.fetchone()
                if row:
                    conn.close()
                    return row[0], row[1], row[2] or "KOSPI"
                conn.close()
            except Exception as e:
                logger.warning(f"Error querying stock_master.db for {query}: {e}")

        # 2-2. US Stock exact (symbol or name)
        us_stocks = _get_us_stock_master_list()
        for sym, hname, name, exch in us_stocks:
            if sym.upper() == q_upper:
                display_name = f"{hname} ({name})" if hname and name and hname != name else (hname or name or sym)
                return sym, display_name, exch or "US"
        for sym, hname, name, exch in us_stocks:
            if (hname and hname.lower() == q_lower) or (name and name.lower() == q_lower):
                display_name = f"{hname} ({name})" if hname and name and hname != name else (hname or name or sym)
                return sym, display_name, exch or "US"

        # 2-3. KR stock partial
        if os.path.exists(sm_path):
            try:
                conn = sqlite3.connect(f"file:{Path(sm_path).resolve()}?mode=ro", uri=True)
                cur = conn.cursor()
                cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목명 LIKE ? OR 종목코드 LIKE ? LIMIT 1", (f"%{q}%", f"%{q}%"))
                row = cur.fetchone()
                conn.close()
                if row:
                    return row[0], row[1], row[2] or "KOSPI"
            except Exception as e:
                logger.warning(f"Error querying stock_master.db for {query}: {e}")

        # 2-4. US Stock partial
        for sym, hname, name, exch in us_stocks:
            if (hname and q_lower in hname.lower()) or (name and q_lower in name.lower()) or q_lower in sym.lower():
                display_name = f"{hname} ({name})" if hname and name and hname != name else (hname or name or sym)
                return sym, display_name, exch or "US"

        # 2-5. marcap.duckdb fallback
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

        return None

    # 3. asset_type is None or "all":
    # 3-1. 6-digit numeric -> fast exact check on KR stock and KR ETF
    if q.isdigit() and len(q) <= 6:
        code_6 = q.zfill(6)
        sm_path = os.path.expanduser("~/.cache/db/stock_master.db")
        if os.path.exists(sm_path):
            try:
                conn = sqlite3.connect(f"file:{Path(sm_path).resolve()}?mode=ro", uri=True)
                cur = conn.cursor()
                cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목코드 = ?", (code_6,))
                row = cur.fetchone()
                conn.close()
                if row:
                    return row[0], row[1], row[2] or "KOSPI"
            except Exception:
                pass
        for code, name in _get_etf_master_list():
            if code == code_6:
                return code, name, "ETF"

    # 3-2. Exact Symbol/Ticker match (US Stock vs US ETF)
    us_stocks = _get_us_stock_master_list()
    for sym, hname, name, exch in us_stocks:
        if sym.upper() == q_upper:
            display_name = f"{hname} ({name})" if hname and name and hname != name else (hname or name or sym)
            return sym, display_name, exch or "US"

    us_etfs = _get_us_etf_master_list()
    for sym, name, exch, url in us_etfs:
        if sym.upper() == q_upper:
            return sym, name, "US_ETF"

    # 3-3. Exact Korean/English Name match across KR Stock, KR ETF, US Stock, US ETF
    kr_stock = resolve_stock_info(q, asset_type="stock")
    if kr_stock and kr_stock[1].lower() == q_lower:
        return kr_stock

    kr_etf = resolve_stock_info(q, asset_type="etf")
    if kr_etf and kr_etf[1].lower() == q_lower:
        return kr_etf

    for sym, hname, name, exch in us_stocks:
        if (hname and hname.lower() == q_lower) or (name and name.lower() == q_lower):
            display_name = f"{hname} ({name})" if hname and name and hname != name else (hname or name or sym)
            return sym, display_name, exch or "US"

    for sym, name, exch, url in us_etfs:
        if name.lower() == q_lower:
            return sym, name, "US_ETF"

    # 3-4. Fallback in order: KR stock -> KR etf -> US stock -> US etf
    if kr_stock:
        return kr_stock
    if kr_etf:
        return kr_etf

    us_stock = resolve_stock_info(q, asset_type="stock")
    if us_stock:
        return us_stock

    us_etf = resolve_stock_info(q, asset_type="etf")
    if us_etf:
        return us_etf

    return None

def search_stocks_db(
    query: str,
    limit: int = 10,
    asset_type: str = "stock",
    market: Optional[str] = None
) -> List[StockSearchResult]:
    """
    종목코드 또는 종목명 검색 자동완성 목록을 반환합니다.
    asset_type: 'stock' | 'etf' | 'all'
    market: 'kr' | 'us' | 'all' | None
    """
    q = query.strip()
    if not q:
        return []

    results: List[StockSearchResult] = []
    seen: set = set()
    q_lower = q.lower()
    m_lower = market.lower().strip() if market else None

    include_kr = m_lower is None or m_lower in ("kr", "korea", "kospi", "kosdaq", "all")
    include_us = m_lower is None or m_lower in ("us", "usa", "all")

    exact: List[StockSearchResult] = []
    prefix: List[StockSearchResult] = []
    contains: List[StockSearchResult] = []

    def _add_item(item: StockSearchResult, bucket: List[StockSearchResult]):
        if item.code not in seen:
            seen.add(item.code)
            bucket.append(item)

    # 1. ETF 검색 (KR ETF + US ETF)
    if asset_type in ("etf", "all"):
        # 1-1. KR ETF
        if include_kr:
            etfs = _get_etf_master_list()
            for code, name in etfs:
                c_low = code.lower()
                n_low = name.lower()
                item = StockSearchResult(code=code, name=name, market="ETF")
                if c_low == q_lower or n_low == q_lower:
                    _add_item(item, exact)
                elif n_low.startswith(q_lower) or c_low.startswith(q_lower):
                    _add_item(item, prefix)
                elif q_lower in n_low or q_lower in c_low:
                    _add_item(item, contains)

        # 1-2. US ETF
        if include_us:
            us_etfs = _get_us_etf_master_list()
            for sym, name, exch, url in us_etfs:
                s_low = sym.lower()
                n_low = name.lower()
                item = StockSearchResult(code=sym, name=name, market="US_ETF")
                if s_low == q_lower or n_low == q_lower:
                    _add_item(item, exact)
                elif s_low.startswith(q_lower) or n_low.startswith(q_lower):
                    _add_item(item, prefix)
                elif q_lower in s_low or q_lower in n_low:
                    _add_item(item, contains)

    # 2. 일반 주식 검색 (KR Stock + US Stock)
    if asset_type in ("stock", "all"):
        # 2-1. KR Stock
        if include_kr:
            sm_path = os.path.expanduser("~/.cache/db/stock_master.db")
            if os.path.exists(sm_path):
                try:
                    conn = sqlite3.connect(f"file:{Path(sm_path).resolve()}?mode=ro", uri=True)
                    cur = conn.cursor()
                    if q.isdigit():
                        cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목코드 LIKE ?", (f"{q}%",))
                        for row in cur.fetchall():
                            item = StockSearchResult(code=row[0], name=row[1], market=row[2] or "KOSPI")
                            if row[0].lower() == q_lower:
                                _add_item(item, exact)
                            elif row[0].lower().startswith(q_lower):
                                _add_item(item, prefix)
                            else:
                                _add_item(item, contains)
                    else:
                        cur.execute("SELECT 종목코드, 종목명, 시장구분 FROM stock_master WHERE 종목명 LIKE ? OR 종목코드 LIKE ?", (f"%{q}%", f"%{q}%"))
                        for row in cur.fetchall():
                            item = StockSearchResult(code=row[0], name=row[1], market=row[2] or "KOSPI")
                            if row[1].lower() == q_lower or row[0].lower() == q_lower:
                                _add_item(item, exact)
                            elif row[1].lower().startswith(q_lower) or row[0].lower().startswith(q_lower):
                                _add_item(item, prefix)
                            else:
                                _add_item(item, contains)
                    conn.close()
                except Exception as e:
                    logger.warning(f"Error searching stock_master.db for {query}: {e}")

        # 2-2. US Stock
        if include_us:
            us_stocks = _get_us_stock_master_list()
            for sym, hname, name, exch in us_stocks:
                s_low = sym.lower()
                h_low = hname.lower() if hname else ""
                n_low = name.lower() if name else ""
                display_name = f"{hname} ({name})" if hname and name and hname != name else (hname or name or sym)
                item = StockSearchResult(code=sym, name=display_name, market=exch or "US")

                if s_low == q_lower or h_low == q_lower or n_low == q_lower:
                    _add_item(item, exact)
                elif s_low.startswith(q_lower) or h_low.startswith(q_lower) or n_low.startswith(q_lower):
                    _add_item(item, prefix)
                elif q_lower in s_low or q_lower in h_low or q_lower in n_low:
                    _add_item(item, contains)

    all_ordered = exact + prefix + contains
    return all_ordered[:limit]

def _compute_asset_avwap_chart(
    raw_df: pd.DataFrame,
    code: str,
    name: str,
    market_type: str,
    interval_key: str,
    amount_unit: str = "억원",
    amount_divisor: float = 1e8,
) -> Optional[AvwapChartResponse]:
    """
    주식 또는 ETF의 raw OHLCV DataFrame으로부터 다중 주기 AVWAP 및 지표를 계산하여 AvwapChartResponse를 생성합니다.
    """
    if raw_df.empty:
        return None

    raw_df["Date"] = pd.to_datetime(raw_df["Date"])
    raw_df = raw_df.sort_values("Date").drop_duplicates("Date").set_index("Date")
    raw_df = raw_df[raw_df.index >= _AVWAP_MIN_DATE]

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

    amount_series = df["Amount"] / amount_divisor
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
    dd_3y_series = _calculate_3y_high_change(df)


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
        ("ytd", "YTD", ytd_dt, "#10b981"),
        ("h52", "52주 최고", h52_dt, "#ec4899"),
        ("l52", "52주 최저", l52_dt, "#06b6d4"),
        ("ath", "역대 최고(ATH)", ath_dt, "#f59e0b"),
        ("atl", "역대 최저(ATL)", atl_dt, "#8b5cf6"),
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
    dates_str = df.index.strftime("%Y-%m-%d").tolist()
    for a_id, a_label, a_dt, a_color in raw_anchors:
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
        vals = _build_anchor_values_fast(dates_str, a_series, start_pos)

        anchors_list.append(AvwapAnchorSeries(
            id=f"anchor_{a_id}_{d_str.replace('-', '')}",
            name=f"{a_label} ({d_str})",
            anchor_date=d_str,
            color=a_color,
            values=vals
        ))

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
        vals_custom = _build_anchor_values_fast(dates_str, a_series, start_pos)
        display_name_anc = ca.label if ca.label and ca.label.strip() else f"AVWAP ({ad_str})"
        anchors_list.append(AvwapAnchorSeries(
            id=ca.id,
            name=display_name_anc,
            anchor_date=ad_str,
            color=ca.color or "#ec4899",
            values=vals_custom
        ))

    # 8. Build points list
    points = _build_avwap_points_fast(
        df=df,
        dates_str=dates_str,
        ma_dict=ma_dict,
        vol_ma_series=vol_ma_series,
        amount_series=amount_series,
        amount_sma50_series=amount_sma50_series,
        bb_upper_series=bb_upper_series,
        vix_fix_series=vix_fix_series,
        rsi_series=rsi_series,
        mdd_series=mdd_series,
        h52_chg_series=h52_chg_series,
        dd_3y_series=dd_3y_series,
        vwap_series=vwap_series,
        hvwap_series=hvwap_series,
        lvwap_series=lvwap_series,
    )

    return AvwapChartResponse(
        market=market_type,
        symbol=code,
        name=name,
        interval=interval_key,
        amount_unit=amount_unit,
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
    cached_data = _avwap_cache_get(cache_key, current_mtime)
    if cached_data is not None:
        return cached_data

    try:
        raw_df = _marcap_query_df(
            "SELECT Date, Open, High, Low, Close, Volume, Amount FROM marcap_adj "
            # 값을 bind 파라미터로 넘기지 않고 리터럴로 박아 넣는다. 파라미터로 바꾸면
            # DuckDB 의 Zone Map pruning 이 걸리지 않아 이 술어의 이득(264ms → 26ms)이 사라진다.
            # 상수는 모듈 내부 리터럴이라 주입 위험은 없다.
            f"WHERE Date >= '{_AVWAP_MIN_DATE}' AND Code = ? ORDER BY Date ASC",
            [code],
        )
        if raw_df is None:
            return None

        if raw_df.empty:
            logger.warning(f"No price data for stock code: {code}")
            return None

        response = _compute_asset_avwap_chart(raw_df, code, name, market_type, interval_key)
        if response:
            _avwap_cache_put(cache_key, response, current_mtime)
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
    cached_data = _avwap_cache_get(cache_key, current_mtime)
    if cached_data is not None:
        return cached_data

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
            _avwap_cache_put(cache_key, response, current_mtime)
        return response
    except Exception as e:
        logger.error(f"Error computing ETF AVWAP chart data for {symbol_or_name} ({interval}): {e}", exc_info=True)
        return None


def load_us_stock_avwap_chart_data(
    symbol_or_name: str,
    interval: str = "1D"
) -> Optional[AvwapChartResponse]:
    """
    미국 개별 종목(US Stock)의 1D, 1W, 1M, 1Y AVWAP 및 기술 지표 차트 데이터를 생성합니다.
    """
    global _AVWAP_CACHE

    stock_info = resolve_stock_info(symbol_or_name, asset_type="stock")
    if stock_info and stock_info[2] in ("NASDAQ", "NYSE", "AMEX", "US"):
        code, name, market_type = stock_info
    else:
        code = symbol_or_name.strip().upper()
        name = code
        market_type = "US"

    interval_key = interval.upper()
    if interval_key not in INTERVAL_CONFIGS:
        interval_key = "1D"

    sp_path = _get_stock_us_price_path()
    if not sp_path.exists():
        logger.warning(f"stock_us_price.db not found: {sp_path}")
        return None

    current_mtime = os.path.getmtime(sp_path)
    cache_key = f"us_stock_{code}_{interval_key}"
    cached_data = _avwap_cache_get(cache_key, current_mtime)
    if cached_data is not None:
        return cached_data

    try:
        conn = sqlite3.connect(f"file:{sp_path.resolve()}?mode=ro", uri=True)
        raw_df = pd.read_sql_query(
            "SELECT Date, Open, High, Low, Close, Volume FROM stock_us_price WHERE Code = ? ORDER BY Date ASC",
            conn,
            params=(code,)
        )
        if raw_df.empty:
            alt_code = code.replace(".", "-") if "." in code else code.replace("-", ".")
            raw_df = pd.read_sql_query(
                "SELECT Date, Open, High, Low, Close, Volume FROM stock_us_price WHERE Code = ? ORDER BY Date ASC",
                conn,
                params=(alt_code,)
            )
        conn.close()

        if raw_df.empty:
            logger.warning(f"No price data for US stock code: {code}")
            return None

        raw_df["Amount"] = raw_df["Close"] * raw_df["Volume"]

        response = _compute_asset_avwap_chart(
            raw_df, code, name, market_type, interval_key, amount_unit="백만$", amount_divisor=1e6
        )
        if response:
            _avwap_cache_put(cache_key, response, current_mtime)
        return response

    except Exception as e:
        logger.error(f"Error computing US stock AVWAP chart data for {symbol_or_name} ({interval}): {e}", exc_info=True)
        return None


def load_us_etf_avwap_chart_data(
    symbol_or_name: str,
    interval: str = "1D"
) -> Optional[AvwapChartResponse]:
    """
    미국 ETF(US ETF)의 1D, 1W, 1M, 1Y AVWAP 및 기술 지표 차트 데이터를 생성합니다.
    """
    global _AVWAP_CACHE

    sym_clean = symbol_or_name.strip().upper()
    etf_info = resolve_stock_info(symbol_or_name, asset_type="etf")
    if etf_info and etf_info[2] in ("US_ETF", "ETF_US"):
        code, name, market_type = etf_info
    else:
        code = sym_clean
        name = sym_clean
        market_type = "US_ETF"

    interval_key = interval.upper()
    if interval_key not in INTERVAL_CONFIGS:
        interval_key = "1D"

    ep_path = _get_etf_us_price_path()
    if not ep_path.exists():
        logger.warning(f"etf_us_price.db not found: {ep_path}")
        return None

    current_mtime = os.path.getmtime(ep_path)
    cache_key = f"us_etf_{code}_{interval_key}"
    cached_data = _avwap_cache_get(cache_key, current_mtime)
    if cached_data is not None:
        return cached_data

    candidates = []
    us_etfs = _get_us_etf_master_list()
    for s, n, ex, url in us_etfs:
        if s.upper() == code.upper():
            if url and url not in candidates:
                candidates.append(url)
            break
    for c in [code, f"{code}.O", f"{code}.K", f"{code}.N"]:
        if c not in candidates:
            candidates.append(c)

    try:
        conn = sqlite3.connect(f"file:{ep_path.resolve()}?mode=ro", uri=True)
        raw_df = pd.DataFrame()
        for cand in candidates:
            df_cand = pd.read_sql_query(
                "SELECT Date, Open, High, Low, Close, Volume FROM etf_us_price WHERE Code = ? ORDER BY Date ASC",
                conn,
                params=(cand,)
            )
            if not df_cand.empty:
                raw_df = df_cand
                break

        if raw_df.empty:
            raw_df = pd.read_sql_query(
                "SELECT Date, Open, High, Low, Close, Volume FROM etf_us_price WHERE Code LIKE ? ORDER BY Date ASC LIMIT 2000",
                conn,
                params=(f"{code}%",)
            )
        conn.close()

        if raw_df.empty:
            logger.warning(f"No price data for US ETF code: {code}")
            return None

        raw_df["Amount"] = raw_df["Close"] * raw_df["Volume"]

        response = _compute_asset_avwap_chart(
            raw_df, code, name, "US_ETF", interval_key, amount_unit="백만$", amount_divisor=1e6
        )
        if response:
            _avwap_cache_put(cache_key, response, current_mtime)
        return response

    except Exception as e:
        logger.error(f"Error computing US ETF AVWAP chart data for {symbol_or_name} ({interval}): {e}", exc_info=True)
        return None