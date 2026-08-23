"""KR 종목 수급 분석 — sugeub.sqlite + marcap.duckdb (stock_analyzer 포팅)."""

from __future__ import annotations

import logging
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

import duckdb
import pandas as pd

from app.utils.avwap_utils import resolve_stock_info

logger = logging.getLogger(__name__)

DB_FILE = os.environ.get("SUGEUB_DB") or str(Path.home() / ".cache" / "db" / "sugeub.sqlite")
TABLE = "종목별투자자_수량"
MARCAP_DB = str(Path.home() / ".cache" / "db" / "marcap.duckdb")

ALL_TIME_START = datetime(1900, 1, 1)

CUMSUM_COLS = [
    "개인", "외국인", "기관계", "금융투자", "보험", "투신",
    "기타금융", "은행", "연기금", "사모", "기타법인", "기타외국인",
]
INDICATOR_COLS = ["세력"] + CUMSUM_COLS
DISPLAY_COLS = [
    "개인", "세력", "외국인", "기관계", "금융투자", "보험", "투신",
    "기타금융", "은행", "연기금", "사모", "기타법인", "기타외국인",
]
TABLE_BASE_COLS = ["종가", "거래량"] + DISPLAY_COLS
MA_TARGETS = ["종가", "거래량"]
MA_WINDOWS = [5, 20, 60, 240]
SUM_WINDOWS = [5, 20, 60, 240]
LDS_PERIODS = [5, 20, 60, 90, 120, 150, 180, 210, 240, 300, 360, 420, 600, 720]
SUM_PRESETS = {"1m": 31, "3m": 91, "6m": 182, "12m": 365}
DEFAULT_SUM_PERIOD = "3m"
NORM_COLS = ["세력", "외국인", "기관계", "개인"]
ACCUM_MA_COLS = ["세력", "외국인", "기관계", "개인"]

# ---------------------------------------------------------------------------
# 인메모리 캐시 — 키: ("analysis"|"period_sums", code, sum_period, sum_start, sum_end)
# 값: (sugeub.sqlite mtime, marcap.duckdb mtime, 응답 dict)
# DB 파일이 갱신되면(장마감 후 수집) mtime 불일치로 자동 재계산.
# ---------------------------------------------------------------------------
_SUGEUB_CACHE: dict[tuple[str, str, str, str, str], tuple[float, float, Any]] = {}


def _db_mtimes() -> tuple[float, float]:
    def _mtime(path: str) -> float:
        try:
            return Path(path).stat().st_mtime
        except OSError:
            return 0.0

    return _mtime(DB_FILE), _mtime(MARCAP_DB)


def invalidate_sugeub_cache() -> None:
    """수급 분석 인메모리 캐시 전체 무효화."""
    _SUGEUB_CACHE.clear()


def _cached_result(
    key: tuple[str, str, str, str, str],
) -> Optional[Any]:
    sugeub_mtime, marcap_mtime = _db_mtimes()
    cached = _SUGEUB_CACHE.get(key)
    if cached is not None and cached[0] == sugeub_mtime and cached[1] == marcap_mtime:
        return cached[2]
    return None


def _store_result(key: tuple[str, str, str, str, str], result: Any) -> None:
    _SUGEUB_CACHE[key] = (*_db_mtimes(), result)


def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def resolve_sum_window(
    sum_period: str,
    start_str: str,
    end_str: str,
    data_first: datetime,
    data_last: datetime,
) -> tuple[datetime, datetime, dict[str, str]]:
    sel = {"preset": sum_period or DEFAULT_SUM_PERIOD, "start": "", "end": ""}

    end = _parse_date(end_str)
    if end is not None and end_str:
        sel["end"] = end_str.strip()
    end = min(end or data_last, data_last)

    start = _parse_date(start_str)
    if start is not None and start_str and start < end:
        sel["start"] = start_str.strip()
    else:
        days = SUM_PRESETS.get(sum_period)
        if days is not None:
            sel["preset"] = sum_period
            start = end - timedelta(days=days)
        else:
            days = SUM_PRESETS[DEFAULT_SUM_PERIOD]
            sel["preset"] = DEFAULT_SUM_PERIOD
            start = end - timedelta(days=days)

    start = max(start, data_first)
    return start, end, sel


def load_supply_demand_raw(code: str, start: datetime, end: datetime) -> pd.DataFrame:
    if not Path(DB_FILE).is_file():
        return pd.DataFrame()
    with sqlite3.connect(DB_FILE) as conn:
        return pd.read_sql_query(
            f'SELECT * FROM "{TABLE}" WHERE "단축코드" = ? AND "일자" BETWEEN ? AND ?',
            conn,
            params=(code, str(start), str(end)),
        )


def fetch_price(code: str, start: datetime, end: datetime) -> pd.DataFrame:
    """marcap.duckdb 일별 시세 — index=일자(datetime), 컬럼 한글."""
    if not Path(MARCAP_DB).is_file():
        return pd.DataFrame()
    try:
        con = duckdb.connect(MARCAP_DB, read_only=True)
        df = con.execute(
            """
            SELECT Date AS 일자, Open AS 시가, High AS 고가, Low AS 저가,
                   Close AS 종가, Volume AS 거래량
            FROM marcap_adj
            WHERE Code = ? AND Date >= ? AND Date <= ?
            ORDER BY Date ASC
            """,
            [code, start.date(), end.date()],
        ).fetchdf()
        con.close()
    except Exception as exc:
        logger.warning("marcap price fetch failed for %s: %s", code, exc)
        return pd.DataFrame()

    if df.empty:
        return df

    df["일자"] = pd.to_datetime(df["일자"])
    df = df.set_index("일자")
    if "등락률" not in df.columns:
        df["등락률"] = df["종가"].pct_change() * 100
    return df


def build_dataset(raw_df: pd.DataFrame, price_df: pd.DataFrame) -> pd.DataFrame:
    df = raw_df.copy()
    df["일자"] = pd.to_datetime(df["일자"])
    df = df.set_index("일자")
    df.fillna(0, inplace=True)
    df.sort_index(ascending=True, inplace=True)
    if "국가" in df.columns:
        df = df.drop(columns=["국가"])
    df = pd.merge(df, price_df, how="left", left_index=True, right_index=True)
    return df.dropna()


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    cols: dict[str, pd.Series] = {}
    cols["세력"] = df["외국인"] + df["기관계"]

    for c in CUMSUM_COLS:
        cols[c + "누적"] = df[c].cumsum()
    cols["세력누적"] = cols["외국인누적"] + cols["기관계누적"]

    for c in INDICATOR_COLS:
        peak_low = cols[c + "누적"].cummin()
        accum = cols[c + "누적"] - peak_low
        cols[c + "최고저점"] = peak_low
        cols[c + "매집수량"] = accum
        cols[c + "매집고점"] = accum.cummax()
        cols[c + "분산비율"] = accum / cols[c + "매집고점"]

    for col in MA_TARGETS:
        for w in MA_WINDOWS:
            cols[f"{col}{w}MA"] = df[col].rolling(window=w, min_periods=1).mean()

    def src(c: str) -> pd.Series:
        return cols[c] if c in cols else df[c]

    for c in INDICATOR_COLS:
        for w in SUM_WINDOWS:
            cols[f"{c}{w}SUM"] = src(c).rolling(window=w, min_periods=1).sum()

    return pd.concat([df, pd.DataFrame(cols, index=df.index)], axis=1)


def _비율행(label: str, values_row: list) -> list:
    vals = values_row[3:]
    total = sum(v for i, v in enumerate(vals) if i not in (1, 3))
    return [
        label,
        0,
        0,
        *(0 if i == 1 else (v / total * 100 if total else 0) for i, v in enumerate(vals)),
    ]


def build_supply_demand_frame(df: pd.DataFrame) -> pd.DataFrame:
    df_table = df[TABLE_BASE_COLS].tail(10).copy()
    df_table.sort_index(ascending=False, inplace=True)
    df_table.reset_index(level=0, inplace=True)
    df_table["일자"] = df_table["일자"].dt.strftime("%m-%d").astype(str)

    last = df.iloc[-1]
    n = len(df)

    def append_step_rows(step: int, heads: list[str]) -> None:
        for i, heading in enumerate(heads):
            offset = i * step
            row = df.iloc[-1 - offset]
            df_table.loc[len(df_table)] = [
                heading,
                row[f"종가{step}MA"],
                row[f"거래량{step}MA"],
                *(row[f"{c}{step}SUM"] for c in DISPLAY_COLS),
            ]

    append_step_rows(5, ["1주", "2주", "3주", "4주"])
    append_step_rows(20, [f"{x}달" for x in range(1, min(n // 20, 3) + 1)])
    append_step_rows(60, [f"{x}분기" for x in range(1, min(n // 60, 4) + 1)])
    append_step_rows(240, [f"{x}년" for x in range(1, min(n // 240, 10) + 1)])

    현재보유량 = ["현재보유량", 0, 0, *(last[f"{c}매집수량"] for c in DISPLAY_COLS)]
    최대보유량 = ["최대보유량", 0, 0, *(last[f"{c}매집고점"] for c in DISPLAY_COLS)]
    df_table.loc[len(df_table)] = 현재보유량
    df_table.loc[len(df_table)] = _비율행("보유비중", 현재보유량)
    df_table.loc[len(df_table)] = 최대보유량
    df_table.loc[len(df_table)] = _비율행("지수선도", 최대보유량)
    df_table.loc[len(df_table)] = [
        "분산추이",
        0,
        0,
        *(last[f"{c}분산비율"] * 100 for c in DISPLAY_COLS),
    ]
    return df_table.set_index("일자")


def build_lds_frame(df: pd.DataFrame) -> pd.DataFrame:
    lines = []
    for p in LDS_PERIODS:
        if len(df) < p:
            lines.append(pd.Series([0] * len(TABLE_BASE_COLS), index=TABLE_BASE_COLS))
        else:
            s1 = df[["종가", "거래량"]].tail(p).mean()
            s2 = df[DISPLAY_COLS].tail(p).sum()
            lines.append(pd.concat([s1, s2]))
    out = pd.concat(lines, axis=1).T
    out.index = [f"{p}일" for p in LDS_PERIODS]
    return out


def _norm(s: pd.Series) -> pd.Series:
    rng = s.max() - s.min()
    return (s - s.mean()) / rng if rng else s * 0


def _frame_to_rows(df: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for idx, row in df.iterrows():
        entry: dict[str, Any] = {"label": str(idx)}
        for col in df.columns:
            val = row[col]
            if pd.isna(val):
                entry[col] = None
            elif isinstance(val, (int, float)):
                entry[col] = float(val)
            else:
                entry[col] = val
        rows.append(entry)
    return rows


def _dispersion_frame_to_rows(df: pd.DataFrame, index_name: str = "label") -> list[dict[str, Any]]:
    frame = df.fillna(0).copy()
    frame.index.name = index_name
    renamed = frame.copy()
    if list(renamed.columns) != DISPLAY_COLS and len(renamed.columns) == len(DISPLAY_COLS):
        renamed.columns = DISPLAY_COLS
    rows: list[dict[str, Any]] = []
    for idx, row in renamed.iterrows():
        entry: dict[str, Any] = {index_name: str(idx)}
        for col in DISPLAY_COLS:
            if col in row.index:
                entry[col] = float(row[col]) if pd.notna(row[col]) else None
        rows.append(entry)
    return rows


def _build_series(df: pd.DataFrame) -> list[dict[str, Any]]:
    """시계열 JSON — rolling/norm은 행마다 재계산하지 않고 컬럼 단위로 1회만 산출."""
    force_osc = df["세력"].rolling(5).mean() - df["세력"].rolling(20).mean()
    accum_3ma_cols = {
        c: df[f"{c}매집수량"].rolling(3).mean() for c in ACCUM_MA_COLS if f"{c}매집수량" in df.columns
    }
    norm_cols = {
        c: _norm(df[f"{c}매집수량"]) for c in NORM_COLS if f"{c}매집수량" in df.columns
    }

    series: list[dict[str, Any]] = []
    for dt, row in df.iterrows():
        accum_3ma = {
            c: float(v) if pd.notna(v := accum_3ma_cols[c].loc[dt]) else None
            for c in accum_3ma_cols
        }
        dispersion = {
            c: float(v * 100) if pd.notna(v := row.get(f"{c}분산비율")) else None
            for c in DISPLAY_COLS
            if f"{c}분산비율" in df.columns
        }
        norm_acc = {
            c: float(v) if pd.notna(v := norm_cols[c].loc[dt]) else None
            for c in norm_cols
        }
        osc_val = force_osc.loc[dt]
        series.append(
            {
                "date": dt.strftime("%Y-%m-%d"),
                "close": float(row["종가"]),
                "force_oscillator": float(osc_val) if pd.notna(osc_val) else None,
                "accumulation_3ma": accum_3ma,
                "dispersion_pct": dispersion,
                "norm_accumulation": norm_acc,
            }
        )
    return series


def _compute_period_sums(df: pd.DataFrame, sum_from: datetime, sum_to: datetime) -> list[dict[str, float]]:
    period_df = df.loc[sum_from:sum_to]
    return [
        {"investor": c, "value": float(period_df[c].sum()) if c in period_df.columns else 0.0}
        for c in DISPLAY_COLS
    ]


def _build_period_sums_by_preset(
    df: pd.DataFrame, data_first: datetime, data_last: datetime
) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for preset_key in SUM_PRESETS:
        sum_from, sum_to, sel = resolve_sum_window(preset_key, "", "", data_first, data_last)
        label = f"{sum_from:%Y-%m-%d} ~ {sum_to:%Y-%m-%d}"
        out[preset_key] = {
            "sum_period": {
                "preset": sel["preset"],
                "start": sum_from.strftime("%Y-%m-%d"),
                "end": sum_to.strftime("%Y-%m-%d"),
                "label": label,
            },
            "period_sums": _compute_period_sums(df, sum_from, sum_to),
        }
    return out


def load_supply_demand_period_sums(
    code_or_name: str,
    sum_start: str = "",
    sum_end: str = "",
) -> Optional[dict[str, Any]]:
    """순매수 합계만 재계산 (커스텀 기간). 시계열/테이블은 포함하지 않음."""
    info = resolve_stock_info(code_or_name, asset_type="stock")
    if not info:
        return None
    code, name, market = info
    if market not in ("KOSPI", "KOSDAQ", "KONEX", "KR") and not (code.isdigit() and len(code) == 6):
        return None

    cache_key = ("period_sums", code, "", sum_start or "", sum_end or "")
    cached = _cached_result(cache_key)
    if cached is not None:
        return cached

    raw_df = load_supply_demand_raw(code, ALL_TIME_START, datetime.now())
    if raw_df.empty:
        return None
    price_df = fetch_price(code, pd.to_datetime(raw_df["일자"]).min(), datetime.now())
    if price_df.empty:
        return None
    df = compute_indicators(build_dataset(raw_df, price_df))
    if df.empty:
        return None

    data_first, data_last = df.index.min(), df.index.max()
    sum_from, sum_to, sel = resolve_sum_window("", sum_start, sum_end, data_first, data_last)
    label = f"{sum_from:%Y-%m-%d} ~ {sum_to:%Y-%m-%d}"
    result = {
        "code": code,
        "name": name,
        "sum_period": {
            "preset": sel["preset"],
            "start": sum_from.strftime("%Y-%m-%d"),
            "end": sum_to.strftime("%Y-%m-%d"),
            "label": label,
        },
        "period_sums": _compute_period_sums(df, sum_from, sum_to),
    }
    _store_result(cache_key, result)
    return result


def load_supply_demand_analysis(
    code_or_name: str,
    sum_period: str = DEFAULT_SUM_PERIOD,
    sum_start: str = "",
    sum_end: str = "",
) -> Optional[dict[str, Any]]:
    info = resolve_stock_info(code_or_name, asset_type="stock")
    if not info:
        return None
    code, name, market = info
    if market not in ("KOSPI", "KOSDAQ", "KONEX", "KR"):
        # KR stock only — resolve_stock_info returns KOSPI/KOSDAQ for domestic
        if not code.isdigit() or len(code) != 6:
            return None

    cache_key = ("analysis", code, sum_period or "", sum_start or "", sum_end or "")
    cached = _cached_result(cache_key)
    if cached is not None:
        return cached

    raw_df = load_supply_demand_raw(code, ALL_TIME_START, datetime.now())
    if raw_df.empty:
        return None

    price_df = fetch_price(code, pd.to_datetime(raw_df["일자"]).min(), datetime.now())
    if price_df.empty:
        return None

    df = compute_indicators(build_dataset(raw_df, price_df))
    if df.empty:
        return None

    data_first, data_last = df.index.min(), df.index.max()
    sum_from, sum_to, sel = resolve_sum_window(sum_period, sum_start, sum_end, data_first, data_last)
    label = f"{sum_from:%Y-%m-%d} ~ {sum_to:%Y-%m-%d}"

    supply_table = build_supply_demand_frame(df)
    lds_table = build_lds_frame(df)

    ratio_cols = [c + "분산비율" for c in DISPLAY_COLS]
    stats = df[ratio_cols].describe().loc[["mean", "std", "min", "25%", "50%", "75%", "max"]]
    stats.columns = DISPLAY_COLS

    recent = df[ratio_cols].tail(5).copy()
    recent.index = recent.index.strftime("%m-%d")
    recent.columns = DISPLAY_COLS

    peak_idx = df["종가"].idxmax()
    peak = df.loc[[peak_idx], ratio_cols].copy()
    peak.index = [peak_idx.strftime("%Y-%m-%d")]
    peak.columns = DISPLAY_COLS

    period_df = df.loc[sum_from:sum_to]
    period_sums = _compute_period_sums(df, sum_from, sum_to)
    period_sums_by_preset = _build_period_sums_by_preset(df, data_first, data_last)

    result = {
        "code": code,
        "name": name,
        "data_first": data_first.strftime("%Y-%m-%d"),
        "data_last": data_last.strftime("%Y-%m-%d"),
        "sum_period": {
            "preset": sel["preset"],
            "start": sum_from.strftime("%Y-%m-%d"),
            "end": sum_to.strftime("%Y-%m-%d"),
            "label": label,
        },
        "series": _build_series(df),
        "table_supply": _frame_to_rows(supply_table),
        "table_lds": _frame_to_rows(lds_table),
        "table_dispersion_stats": _dispersion_frame_to_rows(stats, "stat"),
        "table_dispersion_recent": _dispersion_frame_to_rows(recent, "date"),
        "table_dispersion_peak": _dispersion_frame_to_rows(peak, "date"),
        "period_sums": period_sums,
        "period_sums_by_preset": period_sums_by_preset,
        "columns": TABLE_BASE_COLS,
    }
    _store_result(cache_key, result)
    return result
