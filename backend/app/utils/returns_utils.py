# backend/app/utils/returns_utils.py
"""
수익률 비교(Return Comparison) 연산 유틸리티
- KR 주식/ETF, US 주식/ETF 가격 데이터 로드
- 기준일 대비 누적 수익률(%) 시계열 생성
- 1W, 1M, 3M, 6M, 1Y, YTD 및 기간내 기술 통계(최고/최저/평균/변동성) 계산
- 다중 자산간 기간별(3M/6M/12M/3Y) 상관계수 매트릭스 및 30일 롤링 상관계수 추세선 계산
"""

import os
import sqlite3
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
import logging
import duckdb
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

from app.schemas import (
    ReturnComparisonItem,
    ReturnComparisonRequest,
    ReturnComparisonResponse,
    ReturnSeries,
    ReturnDataPoint,
    ReturnStatistics,
    CorrelationMatrix,
    RollingCorrelationPair,
    RollingCorrelationPoint,
)
from app.utils.avwap_utils import (
    resolve_stock_info,
    _get_stock_us_price_path,
    _get_etf_us_price_path,
    _get_us_etf_master_list,
    _get_us_stock_master_list,
)

PALETTE_COLORS = [
    "#3b82f6",  # Blue
    "#f97316",  # Orange
    "#10b981",  # Emerald
    "#ec4899",  # Pink
    "#8b5cf6",  # Violet
    "#06b6d4",  # Cyan
    "#eab308",  # Yellow
    "#ef4444",  # Red
    "#14b8a6",  # Teal
    "#a855f7",  # Purple
]


def load_raw_price_series(
    code: str,
    asset_type: Optional[str] = None,
    market: Optional[str] = None,
) -> Optional[Tuple[pd.DataFrame, str, str, str]]:
    """
    종목 코드 및 자산 유형에 맞춰 원시 가격 데이터(Date, Close)를 로드합니다.
    
    Returns:
        (df[Date, Close], resolved_name, resolved_market, currency)
    """
    code_clean = code.strip()
    type_hint = (asset_type or "").lower()
    market_hint = (market or "").upper()

    # 1. US ETF
    if type_hint == "us_etf" or market_hint in ("US_ETF", "ETF_US"):
        ep_path = _get_etf_us_price_path()
        if ep_path.exists():
            try:
                conn = sqlite3.connect(f"file:{ep_path.resolve()}?mode=ro", uri=True)
                candidates = [code_clean, f"{code_clean}.O", f"{code_clean}.K", f"{code_clean}.N"]
                raw_df = pd.DataFrame()
                for cand in candidates:
                    df_cand = pd.read_sql_query(
                        "SELECT Date, Close FROM etf_us_price WHERE Code = ? ORDER BY Date ASC",
                        conn,
                        params=(cand,),
                    )
                    if not df_cand.empty:
                        raw_df = df_cand
                        break
                if raw_df.empty:
                    raw_df = pd.read_sql_query(
                        "SELECT Date, Close FROM etf_us_price WHERE Code LIKE ? ORDER BY Date ASC LIMIT 5000",
                        conn,
                        params=(f"{code_clean}%",),
                    )
                conn.close()
                if not raw_df.empty:
                    name = code_clean
                    for sym, n, ex, u in _get_us_etf_master_list():
                        if sym.upper() == code_clean.upper():
                            name = n or sym
                            break
                    return raw_df, name, "US_ETF", "USD"
            except Exception as e:
                logger.warning(f"Error loading US ETF price for {code_clean}: {e}")

    # 2. US Stock
    if type_hint == "us_stock" or market_hint in ("US", "NASDAQ", "NYSE", "AMEX"):
        sp_path = _get_stock_us_price_path()
        if sp_path.exists():
            try:
                conn = sqlite3.connect(f"file:{sp_path.resolve()}?mode=ro", uri=True)
                raw_df = pd.read_sql_query(
                    "SELECT Date, Close FROM stock_us_price WHERE Code = ? ORDER BY Date ASC",
                    conn,
                    params=(code_clean.upper(),),
                )
                if raw_df.empty and ("." in code_clean or "-" in code_clean):
                    alt_code = code_clean.replace(".", "-") if "." in code_clean else code_clean.replace("-", ".")
                    raw_df = pd.read_sql_query(
                        "SELECT Date, Close FROM stock_us_price WHERE Code = ? ORDER BY Date ASC",
                        conn,
                        params=(alt_code.upper(),),
                    )
                conn.close()
                if not raw_df.empty:
                    name = code_clean
                    for sym, hname, n, exch in _get_us_stock_master_list():
                        if sym.upper() == code_clean.upper():
                            name = f"{hname} ({n})" if hname and n and hname != n else (hname or n or sym)
                            break
                    return raw_df, name, "US", "USD"
            except Exception as e:
                logger.warning(f"Error loading US stock price for {code_clean}: {e}")

    # 3. KR ETF
    if type_hint == "etf" or market_hint == "ETF" or (code_clean.isdigit() and len(code_clean) == 6 and type_hint == "etf"):
        e_path = os.path.expanduser("~/.cache/db/etf_price.db")
        if os.path.exists(e_path):
            try:
                conn = sqlite3.connect(e_path)
                raw_df = pd.read_sql_query(
                    "SELECT 날짜 as Date, 종가 as Close FROM etf_price WHERE 종목코드 = ? ORDER BY 날짜 ASC",
                    conn,
                    params=(code_clean.zfill(6),),
                )
                conn.close()
                if not raw_df.empty:
                    info = resolve_stock_info(code_clean, asset_type="etf")
                    name = info[1] if info else code_clean
                    return raw_df, name, "ETF", "KRW"
            except Exception as e:
                logger.warning(f"Error loading KR ETF price for {code_clean}: {e}")

    # 4. KR Stock (marcap.duckdb)
    if code_clean.isdigit() or type_hint == "stock" or market_hint in ("KOSPI", "KOSDAQ"):
        m_path = os.path.expanduser("~/.cache/db/marcap.duckdb")
        if os.path.exists(m_path):
            try:
                con = duckdb.connect(m_path, read_only=True)
                raw_df = con.execute(
                    "SELECT Date, Close FROM marcap_adj WHERE Code = ? ORDER BY Date ASC",
                    [code_clean.zfill(6)],
                ).fetchdf()
                if not raw_df.empty:
                    info = resolve_stock_info(code_clean, asset_type="stock")
                    name = info[1] if info else code_clean
                    m_type = info[2] if info else "KOSPI"
                    return raw_df, name, m_type, "KRW"
            except Exception as e:
                logger.warning(f"Error loading KR stock price for {code_clean}: {e}")

    # 5. Fallback auto-detection through resolve_stock_info
    # Try Stock first, then ETF
    stock_info = resolve_stock_info(code_clean, asset_type="stock")
    if stock_info:
        sc, sn, sm = stock_info
        if sm in ("NASDAQ", "NYSE", "AMEX", "US"):
            return load_raw_price_series(sc, asset_type="us_stock", market="US")
        else:
            return load_raw_price_series(sc, asset_type="stock", market=sm)

    etf_info = resolve_stock_info(code_clean, asset_type="etf")
    if etf_info:
        ec, en, em = etf_info
        if em in ("US_ETF", "ETF_US"):
            return load_raw_price_series(ec, asset_type="us_etf", market="US_ETF")
        else:
            return load_raw_price_series(ec, asset_type="etf", market="ETF")

    return None


def calculate_multi_period_stats(
    df: pd.DataFrame,
    ref_end_date: pd.Timestamp,
) -> Dict[str, Optional[float]]:
    """
    기준 종료일(ref_end_date)을 기준으로 1W, 1M, 3M, 6M, 1Y, YTD 수익률을 계산합니다.
    """
    if df.empty or "Close" not in df.columns:
        return {}

    # filter up to ref_end_date
    df_upto = df[df["Date"] <= ref_end_date]
    if df_upto.empty:
        return {}

    current_close = float(df_upto["Close"].iloc[-1])
    data_start = df_upto["Date"].min()

    periods = {
        "1W": ref_end_date - pd.DateOffset(days=7),
        "1M": ref_end_date - pd.DateOffset(months=1),
        "3M": ref_end_date - pd.DateOffset(months=3),
        "6M": ref_end_date - pd.DateOffset(months=6),
        "1Y": ref_end_date - pd.DateOffset(years=1),
        "YTD": pd.Timestamp(year=ref_end_date.year, month=1, day=1),
    }

    results = {}
    for period_name, p_start in periods.items():
        if p_start < data_start:
            results[period_name] = None
            continue

        p_df = df_upto[df_upto["Date"] >= p_start]
        if not p_df.empty:
            start_price = float(p_df["Close"].iloc[0])
            if start_price > 0:
                ret = ((current_close - start_price) / start_price) * 100.0
                results[period_name] = round(ret, 2)
            else:
                results[period_name] = None
        else:
            results[period_name] = None

    return results


def compute_correlation_matrix(
    returns_dict: Dict[str, pd.Series],
    months: int,
    years: int,
    ref_end_date: pd.Timestamp,
    min_trading_days: int = 20,
) -> Optional[CorrelationMatrix]:
    """
    지정된 기간 동안의 종목간 상관계수 매트릭스를 계산합니다.
    """
    if len(returns_dict) < 2:
        return None

    try:
        # inner join to align common trading dates across KR/US
        merged = pd.concat(returns_dict.values(), axis=1, join="inner")
        merged.columns = list(returns_dict.keys())
    except Exception:
        return None

    p_start = ref_end_date - pd.DateOffset(months=months, years=years)
    p_data = merged[merged.index >= p_start]

    if len(p_data) < min_trading_days:
        return None

    corr_df = p_data.corr()
    labels = list(corr_df.columns)
    matrix: List[List[Optional[float]]] = []

    for row in corr_df.values:
        matrix.append([round(float(v), 2) if not np.isnan(v) else None for v in row])

    return CorrelationMatrix(labels=labels, matrix=matrix)


def compute_rolling_correlations(
    returns_dict: Dict[str, pd.Series],
    months: int,
    years: int,
    ref_end_date: pd.Timestamp,
    window_days: int = 30,
    min_trading_days: int = 15,
) -> List[RollingCorrelationPair]:
    """
    지정된 기간 동안의 종목 쌍별 30일 롤링 상관계수를 계산합니다.
    """
    if len(returns_dict) < 2:
        return []

    try:
        merged = pd.concat(returns_dict.values(), axis=1, join="inner")
        merged.columns = list(returns_dict.keys())
    except Exception:
        return []

    p_start = ref_end_date - pd.DateOffset(months=months, years=years)
    p_data = merged[merged.index >= p_start]

    if len(p_data) < min_trading_days:
        return []

    keys = list(p_data.columns)
    results: List[RollingCorrelationPair] = []

    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            k1 = keys[i]
            k2 = keys[j]
            pair_name = f"{k1} vs {k2}"

            r1 = p_data[k1]
            r2 = p_data[k2]
            rolling_corr = r1.rolling(window=window_days, min_periods=min_trading_days).corr(r2).dropna()

            points = [
                RollingCorrelationPoint(
                    date=d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10],
                    corr=round(float(v), 2),
                )
                for d, v in zip(rolling_corr.index, rolling_corr.values)
                if not np.isnan(v)
            ]
            if points:
                results.append(RollingCorrelationPair(pair=pair_name, data=points))

    return results


def compute_return_comparison(req: ReturnComparisonRequest) -> ReturnComparisonResponse:
    """
    ReturnComparisonRequest를 받아 각 종목의 가격 데이터 로드,
    누적 수익률 시계열, 기간별 통계, 상관계수 매트릭스 및 롤링 추세를 계산합니다.
    """
    if not req.items:
        today_str = datetime.now().strftime("%Y-%m-%d")
        return ReturnComparisonResponse(start_date=today_str, end_date=today_str)

    # 1. Date Range setup
    today = datetime.now().date()
    if req.end_date:
        try:
            end_d = datetime.strptime(req.end_date, "%Y-%m-%d").date()
        except Exception:
            end_d = today
    else:
        end_d = today

    if req.start_date:
        try:
            start_d = datetime.strptime(req.start_date, "%Y-%m-%d").date()
        except Exception:
            start_d = end_d - timedelta(days=365)
    else:
        start_d = end_d - timedelta(days=365)

    if start_d >= end_d:
        start_d = end_d - timedelta(days=30)

    start_ts = pd.Timestamp(start_d)
    end_ts = pd.Timestamp(end_d)

    loaded_assets: List[Dict[str, Any]] = []
    daily_returns_dict: Dict[str, pd.Series] = {}

    # Extended start date for stats (at least 3.5 years for 3Y correlation / 1Y returns)
    extended_start_ts = end_ts - pd.DateOffset(years=4)

    for idx, item in enumerate(req.items):
        res = load_raw_price_series(item.code, asset_type=item.type, market=item.market)
        if not res:
            continue
        raw_df, resolved_name, resolved_market, currency = res
        if raw_df.empty:
            continue

        raw_df["Date"] = pd.to_datetime(raw_df["Date"])
        raw_df = raw_df.sort_values("Date").reset_index(drop=True)
        raw_df["Close"] = pd.to_numeric(raw_df["Close"], errors="coerce")
        raw_df = raw_df.dropna(subset=["Date", "Close"])

        display_name = item.name or resolved_name or item.code
        display_label = f"{display_name} ({item.code})"
        color = PALETTE_COLORS[idx % len(PALETTE_COLORS)]

        # Prepare daily returns for correlation
        ext_df = raw_df[raw_df["Date"] >= extended_start_ts].copy()
        if len(ext_df) > 1:
            ext_df["daily_ret"] = ext_df["Close"].pct_change()
            daily_series = ext_df.dropna(subset=["daily_ret"]).set_index("Date")["daily_ret"]
            daily_returns_dict[display_name] = daily_series

        # Filter for requested range
        period_df = raw_df[(raw_df["Date"] >= start_ts) & (raw_df["Date"] <= end_ts)].copy()
        if period_df.empty:
            continue

        start_price = float(period_df["Close"].iloc[0])
        end_price = float(period_df["Close"].iloc[-1])

        # Compute cumulative returns (%)
        if start_price > 0:
            returns_pct = ((period_df["Close"] / start_price) - 1.0) * 100.0
        else:
            returns_pct = pd.Series([0.0] * len(period_df))

        points = [
            ReturnDataPoint(
                date=d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10],
                close=round(float(c), 2),
                return_pct=round(float(r), 2),
            )
            for d, c, r in zip(period_df["Date"], period_df["Close"], returns_pct)
        ]

        # Multi-period returns (1W, 1M, 3M, 6M, 1Y, YTD)
        mp_stats = calculate_multi_period_stats(raw_df, end_ts)

        ret_values = returns_pct.values
        period_return = round(float(ret_values[-1]), 2) if len(ret_values) > 0 else 0.0
        max_return = round(float(ret_values.max()), 2) if len(ret_values) > 0 else 0.0
        min_return = round(float(ret_values.min()), 2) if len(ret_values) > 0 else 0.0
        mean_return = round(float(ret_values.mean()), 2) if len(ret_values) > 0 else 0.0
        volatility = round(float(ret_values.std()), 2) if len(ret_values) > 1 else 0.0

        stat = ReturnStatistics(
            code=item.code,
            name=display_name,
            start_price=round(start_price, 2),
            end_price=round(end_price, 2),
            currency=currency,
            return_1w=mp_stats.get("1W"),
            return_1m=mp_stats.get("1M"),
            return_3m=mp_stats.get("3M"),
            return_6m=mp_stats.get("6M"),
            return_1y=mp_stats.get("1Y"),
            return_ytd=mp_stats.get("YTD"),
            period_return=period_return,
            max_return=max_return,
            min_return=min_return,
            mean_return=mean_return,
            volatility=volatility,
        )

        series = ReturnSeries(
            code=item.code,
            name=display_name,
            market=resolved_market,
            type=item.type or "stock",
            currency=currency,
            color=color,
            data=points,
        )

        loaded_assets.append({"series": series, "stat": stat})

    all_series = [a["series"] for a in loaded_assets]
    all_stats = [a["stat"] for a in loaded_assets]

    # Correlations across 3M, 6M, 12M, 3Y
    corr_periods = {
        "3M": (3, 0),
        "6M": (6, 0),
        "12M": (0, 1),
        "3Y": (0, 3),
    }

    correlations: Dict[str, Optional[CorrelationMatrix]] = {}
    rolling_correlations: Dict[str, List[RollingCorrelationPair]] = {}

    for p_name, (m, y) in corr_periods.items():
        correlations[p_name] = compute_correlation_matrix(
            daily_returns_dict, months=m, years=y, ref_end_date=end_ts
        )
        rolling_correlations[p_name] = compute_rolling_correlations(
            daily_returns_dict, months=m, years=y, ref_end_date=end_ts
        )

    return ReturnComparisonResponse(
        start_date=start_d.strftime("%Y-%m-%d"),
        end_date=end_d.strftime("%Y-%m-%d"),
        series=all_series,
        statistics=all_stats,
        correlations=correlations,
        rolling_correlations=rolling_correlations,
    )
