"""
한국 주식 히트맵 데이터 로딩 유틸리티.

데이터 소스 (모두 ~/.cache/db/, 환경변수 CACHE_DB_DIR 로 재정의 가능):
  - rs/date=YYYY-MM-DD/part-0.parquet : RS 유니버스(약 2,400종목)의 최신 스냅샷.
        Code, Name, Market, Sector(10대 섹터), WICS(산업), 테마(콤마구분),
        Marcap(천억원), RS_Rating 컬럼을 사용. (프레임에서는 억원으로 변환)
  - stock_price.duckdb (stock_price 테이블) : 일별 종가. 기간 수익률 계산에 사용.

기간 수익률은 영업일 기준:
  1D=1, 5D=5, 1M=21, 3M=63, 6M=126, 12M=252 (rn = N+1, parquet 28DChange 와 검증됨)

참고: stock_price.duckdb 가 수집 중(write lock)이면 PriceDbLockedError 를 낸다.
      (대용량 임시 복사 폴백은 사용하지 않음)
"""

from __future__ import annotations

from functools import lru_cache
import math
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from zoneinfo import ZoneInfo

import duckdb

import sqlite3

PERIOD_TRADING_DAYS = {
    "1D": 1,
    "5D": 5,
    "1M": 21,
    "3M": 63,
    "6M": 126,
    "12M": 252,
}

VALID_GROUPINGS = ("sector", "industry", "theme", "theme2", "kospi", "kosdaq")
VALID_SIZE_BY = ("marcap", "trade_value")
VALID_COLOR_BY = ("return", "trade_value_growth")

# parquet Market 값 → 표시 라벨 (KQ → KOSDAQ)
_MARKET_LABELS = {
    "KOSPI": "KOSPI",
    "KOSDAQ": "KOSDAQ",
    "KQ": "KOSDAQ",
}

LOCK_MESSAGE = "주가 DB가 수집 중이라 잠겨 있습니다. 수집이 끝난 뒤 다시 시도해 주세요."


class PriceDbLockedError(RuntimeError):
    """stock_price.duckdb 가 다른 프로세스에 의해 write-only로 잠긴 상태."""

    def __init__(self, message: str = LOCK_MESSAGE):
        super().__init__(message)


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------


def get_cache_db_dir() -> Path:
    override = os.environ.get("CACHE_DB_DIR")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".cache" / "db"


def get_rs_dir() -> Path:
    override = os.environ.get("RS_PARQUET_DIR")
    if override:
        return Path(override).expanduser()
    return get_cache_db_dir() / "rs"


def get_stock_price_db_path() -> Path:
    override = os.environ.get("STOCK_PRICE_DB_PATH")
    if override:
        return Path(override).expanduser()
    return get_cache_db_dir() / "stock_price.duckdb"


def get_theme_db_path() -> Path:
    override = os.environ.get("THEME_DB_PATH")
    if override:
        return Path(override).expanduser()
    return get_cache_db_dir() / "theme.db"


def latest_rs_partition(rs_dir: Path) -> Optional[tuple[str, Path]]:
    """(date, parquet_path) of the newest date=YYYY-MM-DD partition, or None."""
    if not rs_dir.is_dir():
        return None
    best: Optional[tuple[str, Path]] = None
    for entry in rs_dir.iterdir():
        if not entry.is_dir() or not entry.name.startswith("date="):
            continue
        part = entry / "part-0.parquet"
        if not part.is_file():
            continue
        date_str = entry.name[len("date="):]
        if best is None or date_str > best[0]:
            best = (date_str, part)
    return best


def stock_heatmap_sources() -> list[Path]:
    """shape_heatmap 이 읽는 원본 파일 목록. 캐시 무효화 키(최신 mtime) 산출용."""
    rs_dir = get_rs_dir()
    price_db = get_stock_price_db_path()
    theme_db = get_theme_db_path()
    part = latest_rs_partition(rs_dir)
    sources: list[Path] = []
    if part and part[1].is_file():
        sources.append(part[1])
    if price_db.is_file():
        sources.append(price_db)
    if theme_db.is_file():
        sources.append(theme_db)
    return sources



# ---------------------------------------------------------------------------
# Base frame cache (all stocks × attributes × 6 period returns)
# ---------------------------------------------------------------------------

_cache_lock = threading.Lock()
_cache: Dict[str, Any] = {"key": None, "frame": None}


def _is_duckdb_lock_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "conflicting lock" in msg or "could not set lock" in msg


@lru_cache(maxsize=128)
def _compute_custom_period_returns_cached(
    price_db_str: str, price_db_mtime: float, start_date_str: str, end_date_str: str
) -> tuple[
    Optional[str],
    Optional[str],
    Dict[str, Optional[float]],
    Dict[str, Optional[float]],
    Dict[str, Optional[float]],
]:
    price_db = Path(price_db_str)
    if not price_db.is_file():
        return None, None, {}, {}, {}

    escaped = str(price_db.resolve()).replace("'", "''")
    con = duckdb.connect(":memory:")
    try:
        try:
            con.execute(f"ATTACH '{escaped}' AS sp (READ_ONLY)")
        except Exception as exc:  # noqa: BLE001
            if _is_duckdb_lock_error(exc):
                raise PriceDbLockedError() from exc
            raise

        eff_row = con.execute(
            """
            SELECT
                (SELECT MAX(날짜)::VARCHAR FROM sp.stock_price WHERE 날짜 <= ?) AS eff_end,
                (SELECT MAX(날짜)::VARCHAR FROM sp.stock_price WHERE 날짜 <= ?) AS eff_start
            """,
            [end_date_str, start_date_str],
        ).fetchone()

        if not eff_row or not eff_row[0] or not eff_row[1]:
            return None, None, {}, {}, {}

        eff_end, eff_start = str(eff_row[0]), str(eff_row[1])

        # CUSTOM 기간의 거래일 수 계산
        cnt_row = con.execute(
            "SELECT COUNT(DISTINCT 날짜) FROM sp.stock_price WHERE 날짜 >= ? AND 날짜 <= ?",
            [eff_start, eff_end],
        ).fetchone()
        n_days = int(cnt_row[0]) if (cnt_row and cnt_row[0]) else 1

        rows = con.execute(
            """
            WITH end_p AS (
                SELECT 종목코드 AS code, 종가 AS close_end,
                       ROW_NUMBER() OVER (PARTITION BY 종목코드 ORDER BY 날짜 DESC) AS rn
                FROM sp.stock_price
                WHERE 날짜 <= ?
            ),
            start_p AS (
                SELECT 종목코드 AS code, 종가 AS close_start,
                       ROW_NUMBER() OVER (PARTITION BY 종목코드 ORDER BY 날짜 DESC) AS rn
                FROM sp.stock_price
                WHERE 날짜 <= ?
            ),
            period_val AS (
                SELECT 종목코드 AS code,
                       AVG((종가 * 거래량) / 100000000.0) AS avg_tval
                FROM sp.stock_price
                WHERE 날짜 >= ? AND 날짜 <= ?
                GROUP BY 종목코드
            ),
            ranked_before AS (
                SELECT 종목코드 AS code,
                       (종가 * 거래량) / 100000000.0 AS tval,
                       ROW_NUMBER() OVER (PARTITION BY 종목코드 ORDER BY 날짜 DESC) AS rn
                FROM sp.stock_price
                WHERE 날짜 < ?
            ),
            prev_period_val AS (
                SELECT code, AVG(tval) AS avg_prev_tval
                FROM ranked_before
                WHERE rn <= ?
                GROUP BY code
            )
            SELECT e.code, s.close_start, e.close_end, pv.avg_tval, ppv.avg_prev_tval
            FROM (SELECT code, close_end FROM end_p WHERE rn = 1) e
            JOIN (SELECT code, close_start FROM start_p WHERE rn = 1) s ON e.code = s.code
            LEFT JOIN period_val pv ON e.code = pv.code
            LEFT JOIN prev_period_val ppv ON e.code = ppv.code
            """,
            [eff_end, eff_start, eff_start, eff_end, eff_start, n_days],
        ).fetchall()

        rets: Dict[str, Optional[float]] = {}
        tvals: Dict[str, Optional[float]] = {}
        growths: Dict[str, Optional[float]] = {}
        for code, c_start, c_end, avg_tval, avg_prev_tval in rows:
            if c_start and c_end and c_start > 0:
                rets[code] = round((c_end - c_start) / c_start * 100, 2)
            else:
                rets[code] = None
            tvals[code] = round(float(avg_tval), 1) if avg_tval is not None else None
            if avg_tval is not None and avg_prev_tval is not None and float(avg_prev_tval) > 0:
                growths[code] = round((float(avg_tval) - float(avg_prev_tval)) / float(avg_prev_tval) * 100, 2)
            else:
                growths[code] = None

        return eff_start, eff_end, rets, tvals, growths
    finally:
        con.close()


def _load_custom_themes(theme_db_path: Path) -> Dict[str, List[str]]:
    """~/.cache/db/theme.db 에서 종목별 커스텀 테마 목록을 읽어온다 (Read-Only)."""
    if not theme_db_path.is_file():
        return {}
    res: Dict[str, List[str]] = {}
    try:
        # SQLite Read-Only URI 연결
        con = sqlite3.connect(f"file:{theme_db_path.resolve()}?mode=ro", uri=True)
        try:
            cur = con.cursor()
            rows = cur.execute(
                """
                SELECT i.code, t.name
                FROM custom_theme_items i
                JOIN custom_themes t ON i.theme_id = t.id
                ORDER BY t.name, i.code
                """
            ).fetchall()
            for code, theme_name in rows:
                if code and theme_name:
                    code_clean = str(code).strip()
                    res.setdefault(code_clean, []).append(str(theme_name).strip())
        finally:
            con.close()
    except Exception:
        # DB가 아직 없거나 잠겨있거나 스키마가 다르면 빈 딕셔너리 반환
        return {}
    return res


def _build_base_frame(rs_dir: Path, price_db: Path, theme_db: Path) -> Dict[str, Any]:
    """Read latest RS snapshot + compute 6 period returns from the price DB."""
    part = latest_rs_partition(rs_dir)
    if part is None:
        return {"as_of_date": None, "as_of_time": None, "rows": []}
    as_of, part_path = part

    as_of_time: Optional[str] = None
    if part_path and part_path.is_file():
        mtime = part_path.stat().st_mtime
        if price_db.is_file():
            mtime = max(mtime, price_db.stat().st_mtime)
        if theme_db.is_file():
            mtime = max(mtime, theme_db.stat().st_mtime)
        try:
            dt = datetime.fromtimestamp(mtime, tz=ZoneInfo("Asia/Seoul"))
        except Exception:
            dt = datetime.fromtimestamp(mtime)
        as_of_time = dt.strftime("%H:%M")

    custom_themes_by_code = _load_custom_themes(theme_db)

    con = duckdb.connect(":memory:")
    try:
        parquet_cols = [col[0] for col in con.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(part_path)]).fetchall()]
        mmt_col_sql = "MMT" if "MMT" in parquet_cols else "NULL AS MMT"
        tval_col_sql = '"거래대금" AS TradeValue' if "거래대금" in parquet_cols else "NULL AS TradeValue"

        attrs = con.execute(
            f"""
            SELECT Code, Name, Market, Sector, WICS,
                   "테마" AS Themes, Marcap, RS_Rating, {mmt_col_sql}, {tval_col_sql}
            FROM read_parquet(?)
            """,
            [str(part_path)],
        ).fetchall()

        rets_by_code: Dict[str, Dict[str, Optional[float]]] = {}
        trade_values_by_code: Dict[str, Dict[str, Optional[float]]] = {}
        trade_value_growths_by_code: Dict[str, Dict[str, Optional[float]]] = {}
        if price_db.is_file():
            escaped = str(Path(price_db).resolve()).replace("'", "''")
            try:
                con.execute(f"ATTACH '{escaped}' AS sp (READ_ONLY)")
            except Exception as exc:  # noqa: BLE001
                if _is_duckdb_lock_error(exc):
                    raise PriceDbLockedError() from exc
                raise
            # rn = N+1 → close N trading days ago (검증: parquet 28DChange == rn=29)
            offsets = ",\n".join(
                f"MAX(CASE WHEN rn={days + 1} THEN close END) AS c_{key}"
                for key, days in PERIOD_TRADING_DAYS.items()
            )
            tv_cols = ",\n".join(
                (
                    f"MAX(CASE WHEN rn=1 THEN tval END) AS tv_1D"
                    if key == "1D"
                    else f"AVG(CASE WHEN rn<={days} THEN tval END) AS tv_{key}"
                )
                for key, days in PERIOD_TRADING_DAYS.items()
            )
            tv_prev_cols = ",\n".join(
                (
                    f"AVG(CASE WHEN rn>=2 AND rn<=21 THEN tval END) AS tv_prev_1D"
                    if key == "1D"
                    else f"AVG(CASE WHEN rn>={days + 1} AND rn<={days * 2} THEN tval END) AS tv_prev_{key}"
                )
                for key, days in PERIOD_TRADING_DAYS.items()
            )
            rows = con.execute(
                f"""
                WITH ranked AS (
                    SELECT 종목코드 AS code, 종가 AS close,
                           (종가 * 거래량) / 100000000.0 AS tval,
                           ROW_NUMBER() OVER (
                                PARTITION BY 종목코드 ORDER BY 날짜 DESC
                           ) AS rn
                    FROM sp.stock_price
                    WHERE 날짜 <= ?
                )
                SELECT code,
                       MAX(CASE WHEN rn=1 THEN close END) AS c0,
                       {offsets},
                       {tv_cols},
                       {tv_prev_cols}
                FROM ranked
                WHERE rn <= 505
                GROUP BY code
                """,
                [as_of],
            ).fetchall()
            n_p = len(PERIOD_TRADING_DAYS)
            for row in rows:
                code, c0 = row[0], row[1]
                if not c0:
                    continue
                rets: Dict[str, Optional[float]] = {}
                for i, key in enumerate(PERIOD_TRADING_DAYS):
                    cn = row[2 + i]
                    rets[key] = round((c0 - cn) / cn * 100, 2) if cn else None
                rets_by_code[code] = rets

                tvals: Dict[str, Optional[float]] = {}
                tval_growths: Dict[str, Optional[float]] = {}
                for i, key in enumerate(PERIOD_TRADING_DAYS):
                    tvn = row[2 + n_p + i]
                    tv_prev = row[2 + 2 * n_p + i]
                    tvals[key] = round(float(tvn), 1) if tvn is not None else None
                    if tvn is not None and tv_prev is not None and float(tv_prev) > 0:
                        tval_growths[key] = round((float(tvn) - float(tv_prev)) / float(tv_prev) * 100, 2)
                    else:
                        tval_growths[key] = None
                trade_values_by_code[code] = tvals
                trade_value_growths_by_code[code] = tval_growths
    finally:
        con.close()

    frame_rows: List[Dict[str, Any]] = []
    for code, name, market, sector, wics, themes, marcap, rs_rating, mmt_val, trade_val_parquet in attrs:
        themes_list = (
            [t.strip() for t in str(themes).split(",") if t.strip()] if themes else []
        )
        custom_themes_list = custom_themes_by_code.get(code, [])
        market_raw = (str(market).strip().upper() if market else "") or None
        mmt_int = int(round(mmt_val)) if mmt_val is not None and not (isinstance(mmt_val, float) and math.isnan(mmt_val)) else None
        tvals_stock = trade_values_by_code.get(code, {})
        if "1D" not in tvals_stock and trade_val_parquet is not None:
            tvals_stock["1D"] = round(float(trade_val_parquet), 1)
        tv_1d = tvals_stock.get("1D")
        tv_5d = tvals_stock.get("5D")
        tv_20d = tvals_stock.get("1M")
        frame_rows.append(
            {
                "code": code,
                "name": name,
                "market": market_raw,
                "market_label": _MARKET_LABELS.get(market_raw or "", market_raw),
                "sector": sector or "미분류",
                "wics": wics or "미분류",
                "themes": themes_list,
                "custom_themes": custom_themes_list,
                "marcap": round(float(marcap) * 1000, 1) if marcap is not None else 0.0,  # 천억원→억원
                "rs": int(round(rs_rating)) if rs_rating is not None else None,
                "mmt": mmt_int,
                "rets": rets_by_code.get(code, {}),
                "trade_values": tvals_stock,
                "trade_value_growths": trade_value_growths_by_code.get(code, {}),
                "trade_value_1d": tv_1d,
                "trade_value_5d": tv_5d,
                "trade_value_20d": tv_20d,
            }
        )

    return {"as_of_date": as_of, "as_of_time": as_of_time, "rows": frame_rows}


def get_base_frame() -> Dict[str, Any]:
    """Cached base frame; invalidated when partition date, price DB, or theme DB changes."""
    rs_dir = get_rs_dir()
    price_db = get_stock_price_db_path()
    theme_db = get_theme_db_path()
    part = latest_rs_partition(rs_dir)
    price_mtime = price_db.stat().st_mtime if price_db.is_file() else None
    theme_mtime = theme_db.stat().st_mtime if theme_db.is_file() else None
    key = (part[0] if part else None, price_mtime, theme_mtime)

    with _cache_lock:
        if _cache["key"] == key and _cache["frame"] is not None:
            return _cache["frame"]
        frame = _build_base_frame(rs_dir, price_db, theme_db)
        _cache["key"] = key
        _cache["frame"] = frame
        return frame


# ---------------------------------------------------------------------------
# Request-level shaping (filters + grouping)
# ---------------------------------------------------------------------------


def _group_key(stock: Dict[str, Any], grouping: str) -> List[str]:
    if grouping == "sector":
        return [stock["sector"]]
    if grouping == "industry":
        return [stock["wics"]]
    if grouping == "theme":
        return stock["themes"]  # theme: a stock can belong to several groups
    if grouping == "theme2":
        return stock.get("custom_themes", [])  # theme2: custom themes from theme.db
    # kospi / kosdaq: 해당 시장만 단일 그룹 (그 외는 제외)
    label = stock.get("market_label")
    if grouping == "kospi" and label == "KOSPI":
        return ["KOSPI"]
    if grouping == "kosdaq" and label == "KOSDAQ":
        return ["KOSDAQ"]
    return []


def shape_heatmap(
    grouping: str,
    period: str = "1M",
    size_by: str = "marcap",
    color_by: str = "return",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    marcap_min: Optional[float] = None,
    marcap_max: Optional[float] = None,
    trade_value_min: Optional[float] = None,
    min_trade_value_growth: Optional[float] = None,
    min_ret: Optional[float] = None,
    min_rs: Optional[int] = None,
    mmt: Optional[Union[str, List[int], int]] = None,
    limit: int = 0,
) -> Dict[str, Any]:
    """
    Build the heatmap payload.

    marcap_min/marcap_max/trade_value_min are in 억원 (100M KRW). limit=0 means all stocks;
    otherwise the top-N (applied before grouping).
    """
    if grouping not in VALID_GROUPINGS:
        raise ValueError(f"invalid grouping: {grouping}")
    if period != "CUSTOM" and period not in PERIOD_TRADING_DAYS:
        raise ValueError(f"invalid period: {period}")
    if size_by not in VALID_SIZE_BY:
        raise ValueError(f"invalid size_by: {size_by}")
    if color_by not in VALID_COLOR_BY:
        raise ValueError(f"invalid color_by: {color_by}")

    frame = get_base_frame()
    rows = frame["rows"]

    effective_start_date: Optional[str] = None
    effective_end_date: Optional[str] = None

    if start_date or period == "CUSTOM":
        period = "CUSTOM"
        as_of = frame["as_of_date"] or datetime.now().strftime("%Y-%m-%d")
        req_start = start_date or as_of
        req_end = end_date or as_of

        price_db = get_stock_price_db_path()
        price_mtime = price_db.stat().st_mtime if price_db.is_file() else 0.0

        eff_start, eff_end, custom_rets, custom_tvals, custom_growths = _compute_custom_period_returns_cached(
            str(price_db), price_mtime, req_start, req_end
        )
        effective_start_date = eff_start
        effective_end_date = eff_end

        new_rows = []
        for r in rows:
            r_copy = dict(r)
            rets_copy = dict(r["rets"])
            rets_copy["CUSTOM"] = custom_rets.get(r["code"])
            r_copy["rets"] = rets_copy

            tvals_copy = dict(r.get("trade_values", {}))
            tvals_copy["CUSTOM"] = custom_tvals.get(r["code"])
            r_copy["trade_values"] = tvals_copy

            growths_copy = dict(r.get("trade_value_growths", {}))
            growths_copy["CUSTOM"] = custom_growths.get(r["code"])
            r_copy["trade_value_growths"] = growths_copy
            new_rows.append(r_copy)
        rows = new_rows

    # 시장 그룹: 해당 Market만 남겨 stock_count·필터가 화면과 일치하도록
    if grouping == "kospi":
        rows = [r for r in rows if r.get("market_label") == "KOSPI"]
    elif grouping == "kosdaq":
        rows = [r for r in rows if r.get("market_label") == "KOSDAQ"]

    if marcap_min is not None:
        rows = [r for r in rows if r["marcap"] >= marcap_min]
    if marcap_max is not None:
        rows = [r for r in rows if r["marcap"] <= marcap_max]
    if trade_value_min is not None:
        rows = [
            r
            for r in rows
            if (r.get("trade_values", {}).get(period) or r.get("trade_value_1d") or 0.0) >= trade_value_min
        ]
    if min_trade_value_growth is not None:
        rows = [
            r
            for r in rows
            if r.get("trade_value_growths", {}).get(period) is not None
            and r["trade_value_growths"][period] >= min_trade_value_growth
        ]
    if min_ret is not None:
        rows = [
            r
            for r in rows
            if r["rets"].get(period) is not None and r["rets"].get(period) >= min_ret
        ]
    if min_rs is not None:
        rows = [
            r
            for r in rows
            if r.get("rs") is not None and r["rs"] >= min_rs
        ]

    mmt_set: Optional[set[int]] = None
    if mmt is not None:
        if isinstance(mmt, (list, tuple, set)):
            mmt_set = {int(x) for x in mmt}
        elif isinstance(mmt, int):
            mmt_set = {mmt}
        elif isinstance(mmt, str) and mmt.strip():
            parsed_set = set()
            for part in mmt.split(","):
                part = part.strip()
                if part:
                    try:
                        parsed_set.add(int(part))
                    except ValueError:
                        pass
            if parsed_set:
                mmt_set = parsed_set

    if mmt_set is not None:
        rows = [
            r
            for r in rows
            if r.get("mmt") is not None and r["mmt"] in mmt_set
        ]

    if limit and limit > 0:
        sort_key = (
            (lambda r: r.get("trade_values", {}).get(period) or r.get("trade_value_1d") or 0.0)
            if size_by == "trade_value"
            else (lambda r: r["marcap"])
        )
        rows = sorted(rows, key=sort_key, reverse=True)[:limit]

    groups: Dict[str, List[Dict[str, Any]]] = {}
    for stock in rows:
        for key in _group_key(stock, grouping):
            groups.setdefault(key, []).append(stock)

    group_payloads = []
    for name, members in groups.items():
        rets = [m["rets"].get(period) for m in members]
        valid_rets = [r for r in rets if r is not None]
        rs_vals = [m["rs"] for m in members if m["rs"] is not None]
        stocks = []
        weight_sum = 0.0
        total_trade_val = 0.0
        for m in members:
            # 선택 기간 거래대금
            tval = m.get("trade_values", {}).get(period)
            if tval is None:
                tval = m.get("trade_value_1d")
            if tval:
                total_trade_val += tval

            tv_growth = m.get("trade_value_growths", {}).get(period)

            if size_by == "trade_value":
                val = tval if (tval and tval > 0) else 0.0
                weight = math.cbrt(val) if val > 0 else 0.0
            else:
                weight = math.cbrt(m["marcap"]) if m["marcap"] > 0 else 0.0

            weight_sum += weight
            stocks.append(
                {
                    "code": m["code"],
                    "name": m["name"],
                    "market": m.get("market_label") or m["market"],
                    "marcap": round(m["marcap"], 1),
                    "ret": m["rets"].get(period),
                    "rs": m["rs"],
                    "mmt": m.get("mmt"),
                    "weight": round(weight, 3),
                    "trade_value": round(tval, 1) if tval is not None else None,
                    "trade_value_1d": m.get("trade_value_1d"),
                    "trade_value_5d": m.get("trade_value_5d"),
                    "trade_value_20d": m.get("trade_value_20d"),
                    "trade_value_growth": round(tv_growth, 2) if tv_growth is not None else None,
                }
            )
        stocks.sort(key=lambda s: s["weight"], reverse=True)
        growths = [m.get("trade_value_growths", {}).get(period) for m in members]
        valid_growths = [g for g in growths if g is not None]
        avg_tv_growth = round(sum(valid_growths) / len(valid_growths), 2) if valid_growths else None

        group_payloads.append(
            {
                "name": name,
                "stock_count": len(members),
                "avg_return": (
                    round(sum(valid_rets) / len(valid_rets), 2) if valid_rets else None
                ),
                "rs": int(round(sum(rs_vals) / len(rs_vals))) if rs_vals else None,
                "weight": round(weight_sum, 3),
                "total_trade_value": round(total_trade_val, 1) if total_trade_val > 0 else None,
                "avg_trade_value_growth": avg_tv_growth,
                "stocks": stocks,
            }
        )

    group_payloads.sort(key=lambda g: g["weight"], reverse=True)

    return {
        "as_of_date": frame["as_of_date"],
        "as_of_time": frame.get("as_of_time"),
        "grouping": grouping,
        "period": period,
        "size_by": size_by,
        "color_by": color_by,
        "start_date": start_date,
        "end_date": end_date,
        "effective_start_date": effective_start_date,
        "effective_end_date": effective_end_date,
        "marcap_min": marcap_min,
        "marcap_max": marcap_max,
        "trade_value_min": trade_value_min,
        "min_trade_value_growth": min_trade_value_growth,
        "min_ret": min_ret,
        "min_rs": min_rs,
        "mmt": mmt,
        "limit": limit,
        "stock_count": len(rows),
        "groups": group_payloads,
    }

