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
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import duckdb

PERIOD_TRADING_DAYS = {
    "1D": 1,
    "5D": 5,
    "1M": 21,
    "3M": 63,
    "6M": 126,
    "12M": 252,
}

VALID_GROUPINGS = ("sector", "industry", "theme", "kospi", "kosdaq")

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
) -> tuple[Optional[str], Optional[str], Dict[str, Optional[float]]]:
    price_db = Path(price_db_str)
    if not price_db.is_file():
        return None, None, {}

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
            return None, None, {}

        eff_end, eff_start = str(eff_row[0]), str(eff_row[1])

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
            )
            SELECT e.code, s.close_start, e.close_end
            FROM (SELECT code, close_end FROM end_p WHERE rn = 1) e
            JOIN (SELECT code, close_start FROM start_p WHERE rn = 1) s ON e.code = s.code
            """,
            [eff_end, eff_start],
        ).fetchall()

        rets: Dict[str, Optional[float]] = {}
        for code, c_start, c_end in rows:
            if c_start and c_end and c_start > 0:
                rets[code] = round((c_end - c_start) / c_start * 100, 2)
            else:
                rets[code] = None

        return eff_start, eff_end, rets
    finally:
        con.close()


def _build_base_frame(rs_dir: Path, price_db: Path) -> Dict[str, Any]:
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
        try:
            dt = datetime.fromtimestamp(mtime, tz=ZoneInfo("Asia/Seoul"))
        except Exception:
            dt = datetime.fromtimestamp(mtime)
        as_of_time = dt.strftime("%H:%M")

    con = duckdb.connect(":memory:")
    try:
        attrs = con.execute(
            """
            SELECT Code, Name, Market, Sector, WICS,
                   "테마" AS Themes, Marcap, RS_Rating
            FROM read_parquet(?)
            """,
            [str(part_path)],
        ).fetchall()

        rets_by_code: Dict[str, Dict[str, Optional[float]]] = {}
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
            rows = con.execute(
                f"""
                WITH ranked AS (
                    SELECT 종목코드 AS code, 종가 AS close,
                           ROW_NUMBER() OVER (
                               PARTITION BY 종목코드 ORDER BY 날짜 DESC
                           ) AS rn
                    FROM sp.stock_price
                    WHERE 날짜 <= ?
                )
                SELECT code,
                       MAX(CASE WHEN rn=1 THEN close END) AS c0,
                       {offsets}
                FROM ranked
                WHERE rn <= 253
                GROUP BY code
                """,
                [as_of],
            ).fetchall()
            for row in rows:
                code, c0 = row[0], row[1]
                if not c0:
                    continue
                rets: Dict[str, Optional[float]] = {}
                for i, key in enumerate(PERIOD_TRADING_DAYS):
                    cn = row[2 + i]
                    rets[key] = round((c0 - cn) / cn * 100, 2) if cn else None
                rets_by_code[code] = rets
    finally:
        con.close()

    frame_rows: List[Dict[str, Any]] = []
    for code, name, market, sector, wics, themes, marcap, rs_rating in attrs:
        themes_list = (
            [t.strip() for t in str(themes).split(",") if t.strip()] if themes else []
        )
        market_raw = (str(market).strip().upper() if market else "") or None
        frame_rows.append(
            {
                "code": code,
                "name": name,
                "market": market_raw,
                "market_label": _MARKET_LABELS.get(market_raw or "", market_raw),
                "sector": sector or "미분류",
                "wics": wics or "미분류",
                "themes": themes_list,
                "marcap": round(float(marcap) * 1000, 1) if marcap is not None else 0.0,  # 천억원→억원
                "rs": int(round(rs_rating)) if rs_rating is not None else None,
                "rets": rets_by_code.get(code, {}),
            }
        )

    return {"as_of_date": as_of, "as_of_time": as_of_time, "rows": frame_rows}


def get_base_frame() -> Dict[str, Any]:
    """Cached base frame; invalidated when the partition date or price DB changes."""
    rs_dir = get_rs_dir()
    price_db = get_stock_price_db_path()
    part = latest_rs_partition(rs_dir)
    price_mtime = price_db.stat().st_mtime if price_db.is_file() else None
    key = (part[0] if part else None, price_mtime)

    with _cache_lock:
        if _cache["key"] == key and _cache["frame"] is not None:
            return _cache["frame"]
        frame = _build_base_frame(rs_dir, price_db)
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
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    marcap_min: Optional[float] = None,
    marcap_max: Optional[float] = None,
    min_ret: Optional[float] = None,
    limit: int = 0,
) -> Dict[str, Any]:
    """
    Build the heatmap payload.

    marcap_min/marcap_max are in 억원 (100M KRW). limit=0 means all stocks;
    otherwise the top-N by market cap (applied before grouping).
    """
    if grouping not in VALID_GROUPINGS:
        raise ValueError(f"invalid grouping: {grouping}")
    if period != "CUSTOM" and period not in PERIOD_TRADING_DAYS:
        raise ValueError(f"invalid period: {period}")

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

        eff_start, eff_end, custom_rets = _compute_custom_period_returns_cached(
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
    if min_ret is not None:
        rows = [
            r
            for r in rows
            if r["rets"].get(period) is not None and r["rets"].get(period) >= min_ret
        ]
    if limit and limit > 0:
        rows = sorted(rows, key=lambda r: r["marcap"], reverse=True)[:limit]

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
        for m in members:
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
                    "weight": round(weight, 3),
                }
            )
        stocks.sort(key=lambda s: s["weight"], reverse=True)
        group_payloads.append(
            {
                "name": name,
                "stock_count": len(members),
                "avg_return": (
                    round(sum(valid_rets) / len(valid_rets), 2) if valid_rets else None
                ),
                "rs": int(round(sum(rs_vals) / len(rs_vals))) if rs_vals else None,
                "weight": round(weight_sum, 3),
                "stocks": stocks,
            }
        )

    group_payloads.sort(key=lambda g: g["weight"], reverse=True)

    return {
        "as_of_date": frame["as_of_date"],
        "as_of_time": frame.get("as_of_time"),
        "grouping": grouping,
        "period": period,
        "start_date": start_date,
        "end_date": end_date,
        "effective_start_date": effective_start_date,
        "effective_end_date": effective_end_date,
        "marcap_min": marcap_min,
        "marcap_max": marcap_max,
        "min_ret": min_ret,
        "limit": limit,
        "stock_count": len(rows),
        "groups": group_payloads,
    }

