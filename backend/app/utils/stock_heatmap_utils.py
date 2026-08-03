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

import math
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

import duckdb

PERIOD_TRADING_DAYS = {
    "1D": 1,
    "5D": 5,
    "1M": 21,
    "3M": 63,
    "6M": 126,
    "12M": 252,
}

VALID_GROUPINGS = ("sector", "industry", "theme")

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


def _build_base_frame(rs_dir: Path, price_db: Path) -> Dict[str, Any]:
    """Read latest RS snapshot + compute 6 period returns from the price DB."""
    part = latest_rs_partition(rs_dir)
    if part is None:
        return {"as_of_date": None, "rows": []}
    as_of, part_path = part

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
        frame_rows.append(
            {
                "code": code,
                "name": name,
                "market": market,
                "sector": sector or "미분류",
                "wics": wics or "미분류",
                "themes": themes_list,
                "marcap": round(float(marcap) * 1000, 1) if marcap is not None else 0.0,  # 천억원→억원
                "rs": int(round(rs_rating)) if rs_rating is not None else None,
                "rets": rets_by_code.get(code, {}),
            }
        )

    return {"as_of_date": as_of, "rows": frame_rows}


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
    return stock["themes"]  # theme: a stock can belong to several groups


def shape_heatmap(
    grouping: str,
    period: str,
    marcap_min: Optional[float] = None,
    marcap_max: Optional[float] = None,
    limit: int = 0,
) -> Dict[str, Any]:
    """
    Build the heatmap payload.

    marcap_min/marcap_max are in 억원 (100M KRW). limit=0 means all stocks;
    otherwise the top-N by market cap (applied before grouping).
    """
    if grouping not in VALID_GROUPINGS:
        raise ValueError(f"invalid grouping: {grouping}")
    if period not in PERIOD_TRADING_DAYS:
        raise ValueError(f"invalid period: {period}")

    frame = get_base_frame()
    rows = frame["rows"]

    if marcap_min is not None:
        rows = [r for r in rows if r["marcap"] >= marcap_min]
    if marcap_max is not None:
        rows = [r for r in rows if r["marcap"] <= marcap_max]
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
                    "market": m["market"],
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
        "grouping": grouping,
        "period": period,
        "marcap_min": marcap_min,
        "marcap_max": marcap_max,
        "limit": limit,
        "stock_count": len(rows),
        "groups": group_payloads,
    }
