"""Trend-up Breadth (추세 상승 종목 비율 및 확산도) 계산 및 조회 유틸리티."""

from __future__ import annotations

import bisect
import logging
import os
import pickle
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import numpy as np
import polars as pl
from app.schemas import (
    ChartDataPoint,
    DistributionStats,
    HistogramBin,
    TrendUpBreadthPoint,
    TrendUpBreadthResponse,
)

logger = logging.getLogger(__name__)

UNIVERSE_DISPLAY_NAMES = {
    "krx300": "KRX 300",
    "kospi": "KOSPI",
    "kosdaq": "KOSDAQ",
    "all": "전체 (KOSPI + KOSDAQ)",
}


def _get_db_dir() -> Path:
    override = os.environ.get("DB_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".cache" / "db"


def _compute_distribution_stats(
    values: np.ndarray,
    num_bins: int = 25,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> DistributionStats:
    """수치 배열에 대한 기술통계, 백분위수 및 히스토그램 빈 생성."""
    clean_vals = values[~np.isnan(values)]
    if len(clean_vals) == 0:
        return DistributionStats(start_date=start_date, end_date=end_date)

    latest_val = float(clean_vals[-1])
    median_val = float(np.median(clean_vals))
    mean_val = float(np.mean(clean_vals))
    min_val = float(np.min(clean_vals))
    max_val = float(np.max(clean_vals))
    total_days = int(len(clean_vals))

    # 백분위수 (percentile: latest_val 이하 값의 비율 %)
    pctile = float((clean_vals <= latest_val).mean() * 100.0)

    # 히스토그램 빈 범위: 0 ~ max(80.0, max_val * 1.05)
    bin_min = 0.0
    bin_max = max(10.0, float(np.ceil(max_val / 5.0) * 5.0))
    counts, bin_edges = np.histogram(clean_vals, bins=num_bins, range=(bin_min, bin_max))

    bins_list: List[HistogramBin] = []
    for i in range(len(counts)):
        x_start = float(round(bin_edges[i], 1))
        x_end = float(round(bin_edges[i + 1], 1))
        x_label = f"{x_start:.1f}%-{x_end:.1f}%"
        is_latest = (x_start <= latest_val <= x_end) if i == len(counts) - 1 else (x_start <= latest_val < x_end)
        bins_list.append(
            HistogramBin(
                x_start=x_start,
                x_end=x_end,
                x_label=x_label,
                count=int(counts[i]),
                is_latest_bin=is_latest,
            )
        )

    return DistributionStats(
        latest=round(latest_val, 1),
        percentile=round(pctile, 1),
        median=round(median_val, 1),
        mean=round(mean_val, 1),
        min=round(min_val, 1),
        max=round(max_val, 1),
        total_days=total_days,
        start_date=start_date,
        end_date=end_date,
        bins=bins_list,
    )


def _load_index_data(universe: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[ChartDataPoint]:
    """해당 Universe에 해당하는 지수 주가(OHLCV) 및 이동평균선 데이터를 로드."""
    db_dir = _get_db_dir()
    macro_db = db_dir / "macro.db"
    etf_krx_parquet = db_dir / "etf_krx.parquet"

    rows: List[Dict] = []

    if universe == "krx300" and etf_krx_parquet.exists():
        # KODEX KRX300 (292190) from etf_krx.parquet
        try:
            df_etf = pl.read_parquet(etf_krx_parquet)
            df_k300 = (
                df_etf.filter(pl.col("종목코드") == "292190")
                .select([
                    pl.col("날짜").dt.strftime("%Y-%m-%d").alias("time"),
                    pl.col("시가").alias("open"),
                    pl.col("고가").alias("high"),
                    pl.col("저가").alias("low"),
                    pl.col("종가").alias("close"),
                    pl.col("거래량").alias("volume"),
                ])
                .sort("time")
            )
            if len(df_k300) > 0:
                rows = df_k300.to_dicts()
        except Exception as e:
            logger.warning(f"etf_krx.parquet에서 KRX300 로드 실패: {e}")

    # Fallback 또는 KOSPI / KOSDAQ / ALL -> macro.db index_ohlcv
    if not rows and macro_db.exists():
        index_name = "kospi" if universe in ("krx300", "kospi", "all") else "kosdaq"
        try:
            con = sqlite3.connect(f"file:{macro_db.resolve()}?mode=ro", uri=True)
            cur = con.cursor()
            cur.execute(
                """
                SELECT date, open, high, low, close, volume
                FROM index_ohlcv
                WHERE index_name = ?
                ORDER BY date ASC
                """,
                (index_name,),
            )
            for r in cur.fetchall():
                try:
                    c_val = float(r[4]) if r[4] is not None else None
                    if c_val is not None:
                        rows.append({
                            "time": str(r[0])[:10],
                            "open": float(r[1]) if r[1] is not None else c_val,
                            "high": float(r[2]) if r[2] is not None else c_val,
                            "low": float(r[3]) if r[3] is not None else c_val,
                            "close": c_val,
                            "volume": float(r[5]) if r[5] is not None else 0.0,
                        })
                except (ValueError, TypeError):
                    continue
            con.close()
        except Exception as e:
            logger.warning(f"macro.db에서 {universe} 지수 로드 실패: {e}")

    if not rows:
        return []

    # Polars로 이동평균 계산 (SMA 10, 20, 50, 150, 200)
    df_index = pl.DataFrame(rows).sort("time")
    df_index = df_index.with_columns([
        pl.col("close").rolling_mean(window_size=10).alias("sma10"),
        pl.col("close").rolling_mean(window_size=20).alias("sma20"),
        pl.col("close").rolling_mean(window_size=50).alias("sma50"),
        pl.col("close").rolling_mean(window_size=150).alias("sma150"),
        pl.col("close").rolling_mean(window_size=200).alias("sma200"),
    ])

    if start_date:
        df_index = df_index.filter(pl.col("time") >= start_date)
    if end_date:
        df_index = df_index.filter(pl.col("time") <= end_date)

    points: List[ChartDataPoint] = []
    for row in df_index.iter_rows(named=True):
        indicators = {
            "sma10": round(row["sma10"], 2) if row.get("sma10") is not None else None,
            "sma20": round(row["sma20"], 2) if row.get("sma20") is not None else None,
            "sma50": round(row["sma50"], 2) if row.get("sma50") is not None else None,
            "sma150": round(row["sma150"], 2) if row.get("sma150") is not None else None,
            "sma200": round(row["sma200"], 2) if row.get("sma200") is not None else None,
        }
        points.append(
            ChartDataPoint(
                time=str(row["time"])[:10],
                open=round(float(row["open"]), 2) if row.get("open") is not None else None,
                high=round(float(row["high"]), 2) if row.get("high") is not None else None,
                low=round(float(row["low"]), 2) if row.get("low") is not None else None,
                close=round(float(row["close"]), 2) if row.get("close") is not None else None,
                volume=round(float(row["volume"]), 2) if row.get("volume") is not None else 0,
                indicators=indicators,
            )
        )
    return points


def _compute_universe_full_data(universe_key: str) -> Tuple[TrendUpBreadthResponse, List[str]]:
    """유니버스 전체 기간에 대한 Trend-up Breadth 및 Index 데이터를 1회 전량 계산."""
    universe_name = UNIVERSE_DISPLAY_NAMES.get(universe_key, "KRX 300")
    db_dir = _get_db_dir()
    marcap_path = db_dir / "marcap_adj.parquet"
    if not marcap_path.exists():
        logger.error(f"marcap_adj.parquet가 존재하지 않습니다: {marcap_path}")
        empty_resp = TrendUpBreadthResponse(
            universe=universe_key,
            universe_name=universe_name,
            index_data=[],
            breadth_data=[],
            distribution_daily=DistributionStats(),
            distribution_5ma=DistributionStats(),
        )
        return empty_resp, []

    # 1. Base prices scan
    df_scan = pl.scan_parquet(marcap_path)

    # KRX 300 universe filtering
    if universe_key == "krx300":
        krx300_pdf_path = db_dir / "krx300_pdf.parquet"
        krx300_pkl_path = db_dir / "krx300_pdf.pkl"
        
        pdf_pairs_df: Optional[pl.DataFrame] = None
        latest_codes: Set[str] = set()

        if krx300_pdf_path.exists():
            try:
                pdf_raw = pl.read_parquet(krx300_pdf_path)
                if len(pdf_raw) > 0:
                    pdf_pairs_df = pdf_raw.select([
                        pl.col("기준일").dt.date().alias("Date"),
                        pl.col("종목코드").alias("Code"),
                    ])
                    max_d = pdf_raw["기준일"].max()
                    latest_codes = set(pdf_raw.filter(pl.col("기준일") == max_d)["종목코드"].to_list())
            except Exception as e:
                logger.warning(f"krx300_pdf.parquet 파싱 실패: {e}")

        if not latest_codes and krx300_pkl_path.exists():
            try:
                with open(krx300_pkl_path, "rb") as f:
                    latest_codes = set(pickle.load(f))
            except Exception:
                pass

        # 2018-02-05 이후 주가 데이터 로드
        df_all_krx = df_scan.filter(pl.col("Date") >= pl.date(2018, 2, 5)).select(["Date", "Code", "Close"]).collect()

        if pdf_pairs_df is not None and len(pdf_pairs_df) > 0:
            pdf_dates = set(pdf_pairs_df["Date"].unique().to_list())
            part_exact = df_all_krx.join(pdf_pairs_df, on=["Date", "Code"], how="inner")
            if latest_codes:
                part_recent = df_all_krx.filter(
                    (~pl.col("Date").is_in(list(pdf_dates))) & pl.col("Code").is_in(list(latest_codes))
                )
                df_filtered = pl.concat([part_exact, part_recent])
            else:
                df_filtered = part_exact
        elif latest_codes:
            df_filtered = df_all_krx.filter(pl.col("Code").is_in(list(latest_codes)))
        else:
            df_filtered = df_all_krx
    elif universe_key == "kospi":
        df_filtered = df_scan.filter(pl.col("Market") == "KOSPI").select(["Date", "Code", "Close"]).collect()
    elif universe_key == "kosdaq":
        df_filtered = df_scan.filter(pl.col("Market") == "KOSDAQ").select(["Date", "Code", "Close"]).collect()
    else:  # "all"
        df_filtered = df_scan.select(["Date", "Code", "Close"]).collect()

    if len(df_filtered) == 0:
        empty_resp = TrendUpBreadthResponse(
            universe=universe_key,
            universe_name=universe_name,
            index_data=[],
            breadth_data=[],
            distribution_daily=DistributionStats(),
            distribution_5ma=DistributionStats(),
        )
        return empty_resp, []

    # 2. Sort by Code, Date and Calculate MA20 and MA40
    df_sorted = df_filtered.sort(["Code", "Date"])
    df_calc = df_sorted.with_columns([
        pl.col("Close").rolling_mean(window_size=20).over("Code").alias("ma20"),
        pl.col("Close").rolling_mean(window_size=40).over("Code").alias("ma40"),
    ])
    df_calc = df_calc.with_columns([
        pl.col("ma20").shift(1).over("Code").alias("prev_ma20"),
        pl.col("ma40").shift(1).over("Code").alias("prev_ma40"),
    ])

    # Trend-up 판정: ma20 > ma40 and ma20 > prev_ma20 and ma40 > prev_ma40
    df_trend = df_calc.with_columns(
        (
            (pl.col("ma20") > pl.col("ma40")) &
            (pl.col("ma20") > pl.col("prev_ma20")) &
            (pl.col("ma40") > pl.col("prev_ma40"))
        ).alias("is_trend_up")
    )

    # 3. 일자별 집계 (Trend-up 종목 수 및 비율)
    summary = (
        df_trend.group_by("Date")
        .agg([
            pl.len().alias("total_stocks"),
            pl.col("is_trend_up").sum().alias("trend_up_stocks"),
            (pl.col("is_trend_up").sum() / pl.len() * 100.0).alias("trend_up_ratio"),
        ])
        .sort("Date")
    )

    # 5일 이동평균 (5-day MA of Trend-up ratio)
    summary = summary.with_columns(
        pl.col("trend_up_ratio").rolling_mean(window_size=5).alias("trend_up_ratio_5ma")
    )

    # 전체 기간에 대한 분포 통계 산출 (충분한 시계열 표본 확보)
    daily_arr = summary["trend_up_ratio"].drop_nulls().to_numpy()
    ma5_arr = summary["trend_up_ratio_5ma"].drop_nulls().to_numpy()

    first_date = str(summary["Date"].min())[:10] if len(summary) > 0 else None
    last_date = str(summary["Date"].max())[:10] if len(summary) > 0 else None

    distribution_daily = _compute_distribution_stats(daily_arr, start_date=first_date, end_date=last_date)
    distribution_5ma = _compute_distribution_stats(ma5_arr, start_date=first_date, end_date=last_date)

    dates_str = [str(d)[:10] for d in summary["Date"].to_list()]
    r_list = [round(float(v), 2) if v is not None else None for v in summary["trend_up_ratio"].to_list()]
    r5_list = [round(float(v), 2) if v is not None else None for v in summary["trend_up_ratio_5ma"].to_list()]
    up_list = [int(v) if v is not None else None for v in summary["trend_up_stocks"].to_list()]
    tot_list = [int(v) if v is not None else None for v in summary["total_stocks"].to_list()]

    breadth_points = [
        TrendUpBreadthPoint(
            time=d,
            trend_up_ratio=r,
            trend_up_ratio_5ma=r5,
            trend_up_stocks=up,
            total_stocks=tot,
        )
        for d, r, r5, up, tot in zip(dates_str, r_list, r5_list, up_list, tot_list)
    ]

    # 4. Index OHLCV 데이터 로드 (전체 기간)
    raw_index_points = _load_index_data(universe_key, start_date=None, end_date=None)

    # 5. 상하단 차트 X축 1:1 완벽 정렬을 위한 공통 일자(Date Alignment) 동기화
    index_dates = {p.time for p in raw_index_points}
    breadth_dates = {p.time for p in breadth_points}
    common_dates = index_dates & breadth_dates

    if common_dates:
        aligned_index_points = sorted([p for p in raw_index_points if p.time in common_dates], key=lambda x: x.time)
        aligned_breadth_points = sorted([p for p in breadth_points if p.time in common_dates], key=lambda x: x.time)
    else:
        aligned_index_points = raw_index_points
        aligned_breadth_points = breadth_points

    full_dates = [p.time for p in aligned_breadth_points]

    full_response = TrendUpBreadthResponse(
        universe=universe_key,
        universe_name=universe_name,
        index_data=aligned_index_points,
        breadth_data=aligned_breadth_points,
        distribution_daily=distribution_daily,
        distribution_5ma=distribution_5ma,
    )
    return full_response, full_dates


# 이 응답이 의존하는 데이터 파일들. 하나라도 갱신되면 캐시를 무효화한다.
_TREND_UP_BREADTH_SOURCES = (
    "marcap_adj.parquet",
    "krx300_pdf.parquet",
    "krx300_pdf.pkl",
    "etf_krx.parquet",
    "macro.db",
)


def _trend_up_breadth_mtime() -> float:
    """의존 데이터 파일들 중 가장 최근 mtime. 없으면 0.0."""
    db_dir = _get_db_dir()
    newest = 0.0
    for name in _TREND_UP_BREADTH_SOURCES:
        try:
            newest = max(newest, (db_dir / name).stat().st_mtime)
        except OSError:
            continue
    return newest


# 유니버스별 전체 계산 결과 캐시: universe -> (mtime, full_response, full_dates)
_UNIVERSE_FULL_CACHE: Dict[str, Tuple[float, TrendUpBreadthResponse, List[str]]] = {}

# 기간 슬라이스 결과 쿼리 캐시: (universe, start_date, end_date) -> (mtime, response)
_TREND_UP_BREADTH_QUERY_CACHE: Dict[Tuple[str, Optional[str], Optional[str]], Tuple[float, TrendUpBreadthResponse]] = {}
_TREND_UP_BREADTH_QUERY_CACHE_MAX = 32


def _get_or_compute_universe_data(universe_key: str) -> Tuple[TrendUpBreadthResponse, List[str]]:
    """유니버스 전체 집계 데이터를 캐시에서 조회하거나 새로 계산."""
    mtime = _trend_up_breadth_mtime()
    cached = _UNIVERSE_FULL_CACHE.get(universe_key)
    if cached is not None and cached[0] == mtime:
        return cached[1], cached[2]

    full_response, full_dates = _compute_universe_full_data(universe_key)
    _UNIVERSE_FULL_CACHE[universe_key] = (mtime, full_response, full_dates)
    return full_response, full_dates


def _load_trend_up_breadth_data_impl(
    universe: str = "krx300",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> TrendUpBreadthResponse:
    """호환성 유지용 내부 진입점."""
    return load_trend_up_breadth_data(universe, start_date, end_date)


def load_trend_up_breadth_data(
    universe: str = "krx300",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> TrendUpBreadthResponse:
    """
    mtime 기반 유니버스 캐시와 O(log N) bisect 슬라이싱을 적용한 고성능 진입점.
    전체 유니버스 집계(7,500일)는 메모리에 1회 캐싱되며,
    기간 변경(1y, 3y, 5y, all) 시 0.1ms 이내로 슬라이스하여 반환합니다.
    """
    universe_key = universe.lower().strip()
    if universe_key not in UNIVERSE_DISPLAY_NAMES:
        universe_key = "krx300"

    key = (universe_key, start_date, end_date)
    mtime = _trend_up_breadth_mtime()
    cached = _TREND_UP_BREADTH_QUERY_CACHE.get(key)
    if cached is not None and cached[0] == mtime:
        return cached[1]

    full_response, full_dates = _get_or_compute_universe_data(universe_key)

    if not full_dates or (not start_date and not end_date):
        response = full_response
    else:
        i_start = bisect.bisect_left(full_dates, start_date) if start_date else 0
        i_end = bisect.bisect_right(full_dates, end_date) if end_date else len(full_dates)

        response = TrendUpBreadthResponse(
            universe=full_response.universe,
            universe_name=full_response.universe_name,
            index_data=full_response.index_data[i_start:i_end],
            breadth_data=full_response.breadth_data[i_start:i_end],
            distribution_daily=full_response.distribution_daily,
            distribution_5ma=full_response.distribution_5ma,
        )

    if len(_TREND_UP_BREADTH_QUERY_CACHE) >= _TREND_UP_BREADTH_QUERY_CACHE_MAX:
        _TREND_UP_BREADTH_QUERY_CACHE.pop(next(iter(_TREND_UP_BREADTH_QUERY_CACHE)))
    _TREND_UP_BREADTH_QUERY_CACHE[key] = (mtime, response)
    return response


def prewarm_trend_up_breadth_cache() -> None:
    """서버 시작 시 4대 유니버스의 전체 집계 데이터를 백그라운드에서 사전 계산 및 캐싱."""
    for universe in ("krx300", "kospi", "kosdaq", "all"):
        try:
            _get_or_compute_universe_data(universe)
        except Exception as e:
            logger.warning(f"Trend-up breadth prewarm failed for {universe}: {e}")

