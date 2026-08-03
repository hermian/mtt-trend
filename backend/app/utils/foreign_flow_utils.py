"""외국인 현선물 동향 — finance_krx 캐시 읽기 전용 유틸 (#12)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

import pandas as pd

_CACHE_DIR = Path(os.path.expanduser("~/.cache/finance_krx"))
_SPOT_PATHS = {
    False: _CACHE_DIR / "kospi_investor.parquet",
    True: _CACHE_DIR / "kospi_investor_etf.parquet",
}
_FUTURE_PATH = _CACHE_DIR / "kospi200_future.parquet"
_KOSPI_CANDIDATES = [
    _CACHE_DIR / "kospi.csv",
    Path(os.path.expanduser("~/.cache/db/kospi.csv")),
]

# KRX 금액(원) → 억원
_WON_TO_EOK = 1e8


def _read_parquet(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    df = pd.read_parquet(path)
    if not isinstance(df.index, pd.DatetimeIndex):
        df.index = pd.to_datetime(df.index)
    return df.sort_index()


def _read_kospi() -> pd.Series:
    for path in _KOSPI_CANDIDATES:
        if not path.exists():
            continue
        df = pd.read_csv(path, index_col=0, parse_dates=True)
        col = "Close" if "Close" in df.columns else df.columns[0]
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        s.name = "kospi"
        return s.sort_index()
    return pd.Series(dtype=float, name="kospi")


def _foreigner_series(df: pd.DataFrame) -> pd.Series:
    if df.empty or "외국인" not in df.columns:
        return pd.Series(dtype=float)
    return pd.to_numeric(df["외국인"], errors="coerce")


def load_foreign_flow_data(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    etf: bool = False,
) -> list[dict[str, Any]]:
    """현물+선물 외국인 순매수 MA와 KOSPI를 일별로 반환한다.

    Returns:
        [{date, net, ma20, ma60, ma120, kospi}, ...] (금액 단위: 억원)
    """
    spot = _read_parquet(_SPOT_PATHS[bool(etf)])
    future = _read_parquet(_FUTURE_PATH)
    kospi = _read_kospi()

    spot_f = _foreigner_series(spot) / _WON_TO_EOK
    fut_f = _foreigner_series(future) / _WON_TO_EOK

    if spot_f.empty and fut_f.empty:
        return []

    net = spot_f.add(fut_f, fill_value=0.0)
    net = net.sort_index()
    net.name = "net"

    ma20 = net.rolling(20, min_periods=20).mean()
    ma60 = ma20.rolling(60, min_periods=60).mean()
    ma120 = ma20.rolling(120, min_periods=120).mean()

    frame = pd.DataFrame(
        {
            "net": net,
            "ma20": ma20,
            "ma60": ma60,
            "ma120": ma120,
            "kospi": kospi.reindex(net.index),
        }
    ).sort_index()

    if end_date:
        end_ts = pd.Timestamp(end_date)
        frame = frame.loc[:end_ts]
    if start_date:
        start_ts = pd.Timestamp(start_date)
        # 응답은 start~end만, MA는 이미 전체에서 계산됨
        frame = frame.loc[start_ts:]

    # MA 미완성 행은 ma 필드를 null로 두고 날짜·kospi는 유지
    out: list[dict[str, Any]] = []
    for ts, row in frame.iterrows():
        out.append(
            {
                "date": ts.strftime("%Y-%m-%d"),
                "net": None if pd.isna(row["net"]) else float(row["net"]),
                "ma20": None if pd.isna(row["ma20"]) else float(row["ma20"]),
                "ma60": None if pd.isna(row["ma60"]) else float(row["ma60"]),
                "ma120": None if pd.isna(row["ma120"]) else float(row["ma120"]),
                "kospi": None if pd.isna(row["kospi"]) else float(row["kospi"]),
            }
        )
    return out
