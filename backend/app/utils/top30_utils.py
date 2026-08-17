"""
시총 TOP 30 랭킹 계산 유틸.

~/.cache/db/rs/date=YYYY-MM-DD/part-0.parquet (또는 RS_PARQUET_DIR) 의
Marcap(천억원, DOUBLE) 컬럼을 읽어 시장 필터(전체/KOSPI/KOSDAQ) 상위 N 종목의
랭킹과, 비교일 대비 순위 변동/신규 진입 여부를 계산한다.

신호 정의 (심층 인터뷰 round 4 확정):
- new_entrant: 비교일 TOP N 밖 → 기준일 TOP N 안 (재진입 포함)
- rank_delta: previous_rank - rank (양수 = 순위 상승), 신규 진입 시 None
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import duckdb

from app.utils.stock_heatmap_utils import get_rs_dir

PARTITION_NAME = "part-0.parquet"


def available_dates(rs_dir: Path) -> list[str]:
    """date=YYYY-MM-DD 파티션 디렉터리의 오름차순 날짜 목록."""
    if not rs_dir.is_dir():
        return []
    dates: list[str] = []
    for entry in rs_dir.iterdir():
        if entry.is_dir() and entry.name.startswith("date="):
            dates.append(entry.name[len("date="):])
    return sorted(dates)


def resolve_partition(rs_dir: Path, date_str: str) -> Optional[tuple[str, Path]]:
    """date <= date_str 인 파티션 중 가장 최신 (date, 경로). 없으면 None."""
    if not rs_dir.is_dir():
        return None
    best: Optional[tuple[str, Path]] = None
    for entry in rs_dir.iterdir():
        if not entry.is_dir() or not entry.name.startswith("date="):
            continue
        d = entry.name[len("date="):]
        if d > date_str:
            continue
        part = entry / PARTITION_NAME
        if part.is_file() and (best is None or d > best[0]):
            best = (d, part)
    return best


def load_marcap_rows(partition: Path) -> list[dict]:
    """Code, Name, Market, Marcap(천억원) 행 로드 (Marcap null 제외)."""
    con = duckdb.connect(":memory:")
    try:
        rows = con.execute(
            "SELECT Code, Name, Market, Marcap FROM read_parquet(?) WHERE Marcap IS NOT NULL",
            [str(partition)],
        ).fetchall()
    finally:
        con.close()
    return [
        {
            "code": str(code),
            "name": str(name),
            "market": str(market),
            "marcap": float(marcap),
        }
        for code, name, market, marcap in rows
    ]


def rank_top(rows: list[dict], market: str, top_n: int = 30) -> list[dict]:
    """시장 필터 후 Marcap 내림차순 랭킹, 항목에 rank 부여."""
    if market == "kospi":
        rows = [r for r in rows if r["market"] == "KOSPI"]
    elif market == "kosdaq":
        rows = [r for r in rows if r["market"] in ("KQ", "KOSDAQ")]
    rows = sorted(rows, key=lambda r: r["marcap"], reverse=True)
    return [{**r, "rank": idx + 1} for idx, r in enumerate(rows[:top_n])]


def _rank_map(ranked: list[dict]) -> dict[str, int]:
    return {r["code"]: r["rank"] for r in ranked}


def build_series(
    rs_dir: Path, code: str, window_dates: list[str], market: str, top_n: int = 30
) -> list[Optional[int]]:
    """각 window 날짜에서 해당 종목의 TOP N 랭킹 (없으면 None)."""
    ranks: list[Optional[int]] = []
    for d in window_dates:
        resolved = resolve_partition(rs_dir, d)
        if resolved is None:
            ranks.append(None)
            continue
        _date, part = resolved
        top = rank_top(load_marcap_rows(part), market, top_n)
        ranks.append(_rank_map(top).get(code))
    return ranks


def compute_top30(
    rs_dir: Path,
    reference_date: str,
    compare_date: Optional[str],
    market: str,
    window_dates: Optional[list[str]] = None,
    top_n: int = 30,
) -> dict:
    """기준일 TOP N 각 종목에 previous_rank/rank_delta/new_entrant 부여."""
    ref_part = resolve_partition(rs_dir, reference_date)
    if ref_part is None:
        raise FileNotFoundError(f"RS partition missing for {reference_date}")
    _ref_date, ref_part_path = ref_part
    ref_ranked = rank_top(load_marcap_rows(ref_part_path), market, top_n)

    comp_rank_map: dict[str, int] = {}
    comp_available = compare_date is not None
    if compare_date is not None:
        comp_part = resolve_partition(rs_dir, compare_date)
        if comp_part is not None:
            _d, comp_part_path = comp_part
            comp_rank_map = _rank_map(rank_top(load_marcap_rows(comp_part_path), market, top_n))
        else:
            comp_available = False

    if window_dates is None:
        window_dates = [reference_date] if reference_date else []

    stocks = []
    for s in ref_ranked:
        previous_rank = comp_rank_map.get(s["code"])
        new_entrant = comp_available and previous_rank is None
        rank_delta = (previous_rank - s["rank"]) if (comp_available and previous_rank is not None) else None
        stocks.append(
            {
                **s,
                "previous_rank": previous_rank,
                "rank_delta": rank_delta,
                "new_entrant": new_entrant,
                "series": build_series(rs_dir, s["code"], window_dates, market, top_n),
            }
        )

    return {
        "reference_date": reference_date,
        "compare_date": compare_date,
        "compare_available": comp_available,
        "window_dates": window_dates,
        "stocks": stocks,
    }