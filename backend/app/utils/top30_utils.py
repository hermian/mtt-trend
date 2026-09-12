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

from datetime import datetime

PARTITION_NAME = "part-0.parquet"

# 파티션 인덱스 캐시: {rs_dir 경로: (디렉터리 mtime, 날짜 목록, {날짜: parquet 경로})}
# RS 파티션은 일별 갱신 데이터이므로 디렉터리 mtime 무효화로 충분하다.
_RS_INDEX_CACHE: dict[str, tuple[float, list[str], dict[str, Path]]] = {}


def _rs_index(rs_dir: Path) -> tuple[list[str], dict[str, Path]]:
    """RS 파티션 인덱스를 1회 디렉터리 스캔으로 구축하고 캐시한다.

    Returns:
        (모든 `date=YYYY-MM-DD` 디렉터리 날짜의 오름차순 목록,
         `part-0.parquet` 이 실제 존재하는 날짜 -> parquet 경로)

    @MX:NOTE: 기존 구현은 `available_dates()` 와 `resolve_partition()` 이 각각
        `iterdir()` 로 413개 디렉터리를 매 호출 재스캔했다.
    """
    try:
        mtime = rs_dir.stat().st_mtime
    except OSError:
        return [], {}

    key = str(rs_dir)
    cached = _RS_INDEX_CACHE.get(key)
    if cached is not None and cached[0] == mtime:
        return cached[1], cached[2]

    all_dates: list[str] = []
    parquet_paths: dict[str, Path] = {}
    if rs_dir.is_dir():
        for entry in rs_dir.iterdir():
            if not entry.is_dir() or not entry.name.startswith("date="):
                continue
            d = entry.name[len("date="):]
            all_dates.append(d)
            part = entry / PARTITION_NAME
            if part.is_file():
                parquet_paths[d] = part

    all_dates.sort()
    _RS_INDEX_CACHE[key] = (mtime, all_dates, parquet_paths)
    return all_dates, parquet_paths


def available_dates(rs_dir: Path) -> list[str]:
    """date=YYYY-MM-DD 파티션 디렉터리의 오름차순 날짜 목록."""
    return _rs_index(rs_dir)[0]


def available_periods(rs_dir: Path, timeframe: str = "daily") -> list[str]:
    """timeframe(daily/weekly/monthly)에 따른 가용 기간 목록."""
    dates = available_dates(rs_dir)
    if timeframe == "monthly":
        seen = set()
        months = []
        for d in dates:
            ym = d[:7]
            if ym not in seen:
                seen.add(ym)
                months.append(ym)
        return months
    elif timeframe == "weekly":
        seen = set()
        weeks = []
        for d in dates:
            dt = datetime.strptime(d, "%Y-%m-%d")
            yw = f"{dt.isocalendar().year}-W{dt.isocalendar().week:02d}"
            if yw not in seen:
                seen.add(yw)
                weeks.append(yw)
        return weeks
    return dates


def resolve_partition(rs_dir: Path, date_str: str) -> Optional[tuple[str, Path]]:
    """date <= date_str 인 파티션 중 가장 최신 (date, 경로). 없으면 None."""
    best: Optional[tuple[str, Path]] = None
    for d, part in _rs_index(rs_dir)[1].items():
        if d > date_str:
            continue
        if best is None or d > best[0]:
            best = (d, part)
    return best


def load_marcap_rows(partition: Path) -> list[dict]:
    """Code, Name, Market, Marcap(천억원), 업종명(sector) 행 로드 (Marcap null 제외)."""
    con = duckdb.connect(":memory:")
    try:
        cols = [c[0] for c in con.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(partition)]).fetchall()]
        has_sector = "업종명" in cols
        sector_expr = "업종명 AS sector" if has_sector else "NULL AS sector"
        rows = con.execute(
            f"SELECT Code, Name, Market, Marcap, {sector_expr} FROM read_parquet(?) WHERE Marcap IS NOT NULL",
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
            "sector": str(sector) if sector is not None and str(sector) != "--" else None,
        }
        for code, name, market, marcap, sector in rows
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
    rs_dir: Path,
    code: str,
    window_dates: list[str],
    market: str,
    top_n: int = 30,
    rank_map_cache: Optional[dict[str, dict[str, int]]] = None,
) -> list[Optional[int]]:
    """각 window 날짜에서 해당 종목의 TOP N 랭킹 (없으면 None).

    Args:
        rank_map_cache: {해석된 날짜: {code: rank}} 공유 캐시. 지정하면 파티션당
            1회만 로드·랭킹하고 이후 재사용한다. 미지정 시 날짜마다 새로 로드한다.
    """
    ranks: list[Optional[int]] = []
    for d in window_dates:
        resolved = resolve_partition(rs_dir, d)
        if resolved is None:
            ranks.append(None)
            continue
        r_date, part = resolved

        if rank_map_cache is None:
            ranks.append(
                _rank_map(rank_top(load_marcap_rows(part), market, top_n)).get(code)
            )
            continue

        rmap = rank_map_cache.get(r_date)
        if rmap is None:
            rmap = _rank_map(rank_top(load_marcap_rows(part), market, top_n))
            rank_map_cache[r_date] = rmap
        ranks.append(rmap.get(code))
    return ranks


def compute_top30(
    rs_dir: Path,
    reference_date: str,
    compare_date: Optional[str],
    market: str,
    window_dates: Optional[list[str]] = None,
    top_n: int = 30,
) -> dict:
    """기준일 TOP N 각 종목에 previous_rank/rank_delta/new_entrant 부여.

    @MX:NOTE: 파티션(parquet)은 **해석된 날짜당 정확히 1회만** 로드한다.
    @MX:REASON: 이전 구현은 종목마다 build_series()를 호출해
        30 종목 × 6 기간 = 180회 같은 파일을 재읽기했다 (실측 1.42s).
        파티션당 1회 로드로 줄이면 0.009s 수준이다.
    """
    ref_part = resolve_partition(rs_dir, reference_date)
    if ref_part is None:
        raise FileNotFoundError(f"RS partition missing for {reference_date}")
    ref_date, ref_part_path = ref_part

    if window_dates is None:
        window_dates = [reference_date] if reference_date else []

    # 해석된 날짜 -> 랭킹 리스트 (파티션당 1회 로드 후 재사용)
    ranked_by_date: dict[str, list[dict]] = {}

    def ranked_for(resolved_date: str, part_path: Path) -> list[dict]:
        ranked = ranked_by_date.get(resolved_date)
        if ranked is None:
            ranked = rank_top(load_marcap_rows(part_path), market, top_n)
            ranked_by_date[resolved_date] = ranked
        return ranked

    ref_ranked = ranked_for(ref_date, ref_part_path)

    comp_rank_map: dict[str, int] = {}
    comp_available = compare_date is not None
    if compare_date is not None:
        comp_part = resolve_partition(rs_dir, compare_date)
        if comp_part is not None:
            comp_date, comp_part_path = comp_part
            comp_rank_map = _rank_map(ranked_for(comp_date, comp_part_path))
        else:
            comp_available = False

    # window_dates 해석은 순서를 유지한 채 1회만 수행 (중복 해석 방지)
    window_resolved: list[Optional[str]] = []
    for d in window_dates:
        resolved = resolve_partition(rs_dir, d)
        if resolved is None:
            window_resolved.append(None)
            continue
        r_date, part = resolved
        window_resolved.append(r_date)
        ranked_for(r_date, part)

    window_rank_maps: dict[str, dict[str, int]] = {
        r_date: _rank_map(ranked) for r_date, ranked in ranked_by_date.items()
    }

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
                "series": [
                    window_rank_maps[r_date].get(s["code"]) if r_date is not None else None
                    for r_date in window_resolved
                ],
            }
        )

    return {
        "reference_date": reference_date,
        "compare_date": compare_date,
        "compare_available": comp_available,
        "window_dates": window_dates,
        "stocks": stocks,
    }


def compute_top30_matrix(
    rs_dir: Path,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    market: str = "all",
    timeframe: str = "daily",
    top_n: int = 30,
) -> dict:
    """start_date부터 end_date까지 각 거래일/주차/월별 TOP N 랭킹 매트릭스 계산 (DuckDB 단일 쿼리 고속 처리)."""
    dates = available_dates(rs_dir)
    if not dates:
        return {"market": market, "timeframe": timeframe, "dates": []}

    # Timeframe grouping
    if timeframe == "monthly":
        months_map: dict[str, str] = {}
        for d in dates:
            months_map[d[:7]] = d
        all_periods = [(k, v) for k, v in months_map.items()]
        default_count = 12
    elif timeframe == "weekly":
        weeks_map: dict[str, str] = {}
        for d in dates:
            dt = datetime.strptime(d, "%Y-%m-%d")
            yw = f"{dt.isocalendar().year}-W{dt.isocalendar().week:02d}"
            weeks_map[yw] = d
        all_periods = [(k, v) for k, v in weeks_map.items()]
        default_count = 24
    else:
        all_periods = [(d, d) for d in dates]
        default_count = 20

    period_keys = [p[0] for p in all_periods]

    if end_date is None or end_date not in period_keys:
        end_idx = len(all_periods) - 1
    else:
        end_idx = period_keys.index(end_date)

    if start_date is None or start_date not in period_keys:
        start_idx = max(0, end_idx - default_count + 1)
    else:
        start_idx = period_keys.index(start_date)

    if start_idx > end_idx:
        start_idx, end_idx = end_idx, start_idx

    selected_periods = all_periods[start_idx : end_idx + 1]
    needed_periods = all_periods[max(0, start_idx - 1) : end_idx + 1]

    date_to_file: dict[str, str] = {}
    date_to_period: dict[str, str] = {}
    for p_label, p_date in needed_periods:
        resolved = resolve_partition(rs_dir, p_date)
        if resolved:
            _d, part = resolved
            date_to_file[_d] = str(part)
            date_to_period[_d] = p_label

    file_paths = list(date_to_file.values())
    if not file_paths:
        return {"market": market, "timeframe": timeframe, "dates": []}

    con = duckdb.connect(":memory:")
    try:
        cols = [c[0] for c in con.execute("DESCRIBE SELECT * FROM read_parquet(?, filename=true, union_by_name=true)", [file_paths]).fetchall()]
        has_sector = "업종명" in cols
        sector_expr = "TRY_CAST(업종명 AS VARCHAR) AS sector" if has_sector else "NULL AS sector"

        query = f"""
        WITH raw AS (
          SELECT 
            regexp_extract(filename, 'date=([0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}})', 1) AS dt,
            TRY_CAST(Code AS VARCHAR) AS code,
            TRY_CAST(Name AS VARCHAR) AS name,
            TRY_CAST(Market AS VARCHAR) AS market,
            TRY_CAST(Marcap AS DOUBLE) AS marcap,
            {sector_expr}
          FROM read_parquet(?, filename=true, union_by_name=true)
          WHERE Marcap IS NOT NULL
        ),
        filtered AS (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY dt ORDER BY marcap DESC) AS rk
          FROM raw
          WHERE (? = 'all') 
             OR (? = 'kospi' AND market = 'KOSPI') 
             OR (? = 'kosdaq' AND market IN ('KQ', 'KOSDAQ'))
        )
        SELECT dt, code, name, market, marcap, sector, rk
        FROM filtered
        WHERE rk <= ? AND marcap IS NOT NULL
        ORDER BY dt ASC, rk ASC
        """
        rows = con.execute(query, [file_paths, market, market, market, top_n]).fetchall()
    finally:
        con.close()



    period_rank_lists: dict[str, list[dict]] = {}
    period_rank_maps: dict[str, dict[str, int]] = {}
    for dt, code, name, market_val, marcap, sector, rk in rows:
        p_label = date_to_period.get(dt, dt)
        if p_label not in period_rank_lists:
            period_rank_lists[p_label] = []
            period_rank_maps[p_label] = {}
        item = {
            "code": str(code),
            "name": str(name),
            "market": str(market_val),
            "marcap": float(marcap) if marcap is not None else None,
            "sector": str(sector) if sector is not None and str(sector) != "--" else None,
            "rank": int(rk),
        }
        period_rank_lists[p_label].append(item)
        period_rank_maps[p_label][str(code)] = int(rk)

    dates_output = []
    for p_label, _p_date in selected_periods:
        actual_idx = period_keys.index(p_label)
        prev_p_label = period_keys[actual_idx - 1] if actual_idx > 0 else None
        prev_map = period_rank_maps.get(prev_p_label) if prev_p_label else None

        ranked_items = []
        for s in period_rank_lists.get(p_label, []):
            prev_rk = prev_map.get(s["code"]) if prev_map is not None else None
            new_entrant = prev_map is not None and prev_rk is None
            rank_delta = (prev_rk - s["rank"]) if (prev_map is not None and prev_rk is not None) else None
            ranked_items.append({
                **s,
                "previous_rank": prev_rk,
                "rank_delta": rank_delta,
                "new_entrant": new_entrant,
            })
        dates_output.append({"date": p_label, "rankings": ranked_items})

    return {
        "market": market,
        "timeframe": timeframe,
        "dates": dates_output,
    }