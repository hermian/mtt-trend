"""
Stock-related API endpoints.

Routes:
    GET /api/stocks/persistent?days=5&min=3
    GET /api/stocks/group-action?date=YYYY-MM-DD
"""

from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import ThemeDaily, ThemeStockDaily, SOURCE_52W, SOURCE_MTT
from app.schemas import (
    GroupActionItem,
    GroupActionResponse,
    IntersectionResponse,
    IntersectionThemeItem,
    IntersectionStockItem,
    PersistentStockItem,
    PersistentStocksResponse,
)

router = APIRouter(prefix="/stocks", tags=["stocks"])


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _latest_date(db: Session, source: str = SOURCE_52W) -> Optional[str]:
    row = db.query(func.max(ThemeDaily.date)).filter(ThemeDaily.data_source == source).scalar()
    return row


def _recent_dates(db: Session, before_date: Optional[str], n: int, source: str = SOURCE_52W) -> List[str]:
    """Return the N most recent distinct dates that are <= before_date."""
    q = db.query(ThemeStockDaily.date).distinct().filter(ThemeStockDaily.data_source == source)
    if before_date:
        q = q.filter(ThemeStockDaily.date <= before_date)
    results = q.order_by(ThemeStockDaily.date.desc()).limit(n).all()
    return [r[0] for r in results]


def _find_latest_common_date(db: Session) -> Optional[str]:
    """
    Find the latest date where both 52w_high and MTT sources have data.

    Returns:
        The earlier of the two latest dates (ensures both sources have data)
        None if either source has no data
    """
    latest_52w = db.query(func.max(ThemeDaily.date)).filter(
        ThemeDaily.data_source == SOURCE_52W
    ).scalar()
    latest_mtt = db.query(func.max(ThemeDaily.date)).filter(
        ThemeDaily.data_source == SOURCE_MTT
    ).scalar()

    if latest_52w is None or latest_mtt is None:
        return None

    # Use the earlier date to ensure both sources have data
    return min(latest_52w, latest_mtt)


# ---------------------------------------------------------------------------
# GET /api/stocks/persistent
# ---------------------------------------------------------------------------

@router.get("/persistent", response_model=PersistentStocksResponse)
def get_persistent_stocks(
    days: int = Query(5, ge=1, le=60, description="Look-back window in trading days"),
    min: int = Query(3, ge=1, description="Minimum number of appearances required"),
    source: str = Query(SOURCE_52W, description="Data source: '52w_high' or 'mtt'"),
    db: Session = Depends(get_db),
):
    """Return stocks that appeared in the top RS list at least `min` times in the last `days` days."""
    recent = _recent_dates(db, None, days, source)
    if not recent:
        raise HTTPException(status_code=404, detail="No stock data available")

    rows = (
        db.query(
            ThemeStockDaily.stock_name,
            func.count(ThemeStockDaily.date.distinct()).label("cnt"),
            func.avg(ThemeStockDaily.rs_score).label("avg_rs"),
        )
        .filter(ThemeStockDaily.date.in_(recent), ThemeStockDaily.data_source == source)
        .group_by(ThemeStockDaily.stock_name)
        .having(func.count(ThemeStockDaily.date.distinct()) >= min)
        .order_by(func.count(ThemeStockDaily.date.distinct()).desc())
        .all()
    )

    if not rows:
        return PersistentStocksResponse(
            days=days, min_appearances=min, stocks=[]
        )

    # Collect all themes per stock within the window
    stock_names = [r[0] for r in rows]
    theme_rows = (
        db.query(ThemeStockDaily.stock_name, ThemeStockDaily.theme_name)
        .filter(
            ThemeStockDaily.date.in_(recent),
            ThemeStockDaily.stock_name.in_(stock_names),
            ThemeStockDaily.data_source == source,
        )
        .distinct()
        .all()
    )
    themes_map: dict[str, list[str]] = defaultdict(list)
    for stock, theme in theme_rows:
        themes_map[stock].append(theme)

    stocks = [
        PersistentStockItem(
            stock_name=r[0],
            appearance_count=r[1],
            avg_rs=round(r[2], 2) if r[2] is not None else None,
            themes=themes_map.get(r[0], []),
        )
        for r in rows
    ]

    return PersistentStocksResponse(days=days, min_appearances=min, stocks=stocks)


# ---------------------------------------------------------------------------
# GET /api/stocks/group-action
# ---------------------------------------------------------------------------

# @MX:ANCHOR: 그룹 액션 탐지 API 엔드포인트
# @MX:REASON: 이 함수는 프론트엔드(useStocks 훅, 페이지)에서 호출되는 핵심 비즈니스 로직입니다.
#            SPEC-MTT-006에 의해 파라미터화되었습니다 (timeWindow, rsThreshold).
@router.get("/group-action", response_model=GroupActionResponse)
def get_group_action(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    source: str = Query(SOURCE_52W, description="Data source: '52w_high' or 'mtt'"),
    timeWindow: int = Query(3, ge=1, le=7, description="Time window for detecting new appearances (1-7 days)"),
    rsThreshold: int = Query(0, ge=-10, le=20, description="RS change threshold (-10 to 20)"),
    db: Session = Depends(get_db),
):
    """
    Detect group-action stocks.

    Conditions:
    - Stock first appeared today OR first appeared within the last timeWindow days
    - Their theme's avg_rs increased vs yesterday by more than rsThreshold

    Parameters:
    - timeWindow: Number of days to look back for new appearances (default: 3, range: 1-7)
    - rsThreshold: Minimum RS change to consider as increasing (default: 0, range: -10 to 20)
    """
    if date is None:
        date = _latest_date(db, source)
        if date is None:
            raise HTTPException(status_code=404, detail="No data available")

    # Stocks that appeared on the given date
    today_stocks = (
        db.query(ThemeStockDaily)
        .filter(ThemeStockDaily.date == date, ThemeStockDaily.data_source == source)
        .all()
    )
    if not today_stocks:
        raise HTTPException(
            status_code=404, detail=f"No stock data found for date {date}"
        )

    # Find the timeWindow most recent dates up to and including `date`
    recent_dates: List[str] = _recent_dates(db, date, timeWindow, source)

    # Determine first-seen date for each stock (across all history for this source)
    first_seen_subq = (
        db.query(
            ThemeStockDaily.stock_name,
            func.min(ThemeStockDaily.date).label("first_seen"),
        )
        .filter(ThemeStockDaily.data_source == source)
        .group_by(ThemeStockDaily.stock_name)
        .subquery()
    )
    first_seen_rows = db.query(
        first_seen_subq.c.stock_name,
        first_seen_subq.c.first_seen,
    ).all()
    first_seen_map: dict[str, str] = {r[0]: r[1] for r in first_seen_rows}

    # Yesterday's theme avg_rs
    yesterday_dates = (
        db.query(ThemeDaily.date)
        .filter(ThemeDaily.date < date, ThemeDaily.data_source == source)
        .distinct()
        .order_by(ThemeDaily.date.desc())
        .limit(1)
        .all()
    )
    yesterday = yesterday_dates[0][0] if yesterday_dates else None

    yesterday_rs: dict[str, float] = {}
    if yesterday:
        yday_rows = (
            db.query(ThemeDaily.theme_name, ThemeDaily.avg_rs)
            .filter(ThemeDaily.date == yesterday, ThemeDaily.data_source == source)
            .all()
        )
        yesterday_rs = {r[0]: r[1] for r in yday_rows if r[1] is not None}

    # Today's theme avg_rs
    today_theme_rows = (
        db.query(ThemeDaily.theme_name, ThemeDaily.avg_rs)
        .filter(ThemeDaily.date == date, ThemeDaily.data_source == source)
        .all()
    )
    today_rs: dict[str, float] = {
        r[0]: r[1] for r in today_theme_rows if r[1] is not None
    }

    result: List[GroupActionItem] = []
    for stock in today_stocks:
        first_seen = first_seen_map.get(stock.stock_name)
        is_new = first_seen in recent_dates if first_seen else False
        if not is_new:
            continue

        theme_rs_today = today_rs.get(stock.theme_name)
        theme_rs_yesterday = yesterday_rs.get(stock.theme_name)

        if theme_rs_today is None:
            continue

        # @MX:NOTE: RS 변화량 임계값 필터링 로직 (rsThreshold 파라미터)
        # theme_rs_change가 rsThreshold보다 커야 탐지
        theme_rs_change = (
            round(theme_rs_today - theme_rs_yesterday, 2)
            if theme_rs_yesterday is not None
            else None
        )

        # RS 임계값 필터링: 어제 데이터가 있고, RS 변화량이 임계값 이하이면 제외
        if theme_rs_yesterday is not None:
            if theme_rs_change is not None and theme_rs_change <= rsThreshold:
                continue

        result.append(
            GroupActionItem(
                stock_name=stock.stock_name,
                rs_score=stock.rs_score,
                change_pct=stock.change_pct,
                theme_name=stock.theme_name,
                theme_rs_change=theme_rs_change,
                first_seen_date=first_seen,
                status_threshold=5,  # @MX:NOTE: 상태 분류 임계값 (현재 하드코딩, 향후 파라미터화 가능)
            )
        )

    # Sort by theme_rs_change descending
    result.sort(key=lambda x: x.theme_rs_change or 0, reverse=True)

    return GroupActionResponse(date=date, stocks=result)


# ---------------------------------------------------------------------------
# GET /api/intersection
# ---------------------------------------------------------------------------

# @MX:ANCHOR: 교집합 추천 API 엔드포인트
# @MX:REASON: 이 함수는 프론트엔드(useIntersection 훅)에서 호출되는 핵심 비즈니스 로직입니다.
#            SPEC-MTT-012에 의해 정의됨 (52주 신고가 × MTT 교집합 추천).
@router.get("/intersection", response_model=IntersectionResponse)
def get_intersection(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
):
    """
    Find themes and stocks that appear in BOTH data sources (52w_high and MTT) on the same date.

    Query Logic:
    - Level 1: Find themes existing in both sources on same date (ThemeDaily self-JOIN)
    - Level 2: Find stocks existing in both sources for each theme (ThemeStockDaily self-JOIN)
    - Sort by intersection_stock_count DESC

    Parameters:
    - date: Target date (if not specified, finds latest date where BOTH sources have data)

    Returns:
    - IntersectionResponse with themes that have common stocks in both sources
    """
    # Find latest common date if not specified
    if date is None:
        date = _find_latest_common_date(db)
        if date is None:
            # No data in at least one source
            return IntersectionResponse(
                date="",
                theme_count=0,
                total_stock_count=0,
                themes=[],
            )

    # Level 1: Find themes that exist in BOTH sources on the given date
    # Strategy: Group by theme_name and filter for themes with data from both sources
    # This uses ThemeDaily self-JOIN via GROUP BY + HAVING COUNT(DISTINCT data_source) = 2
    common_themes_query = (
        db.query(
            ThemeDaily.theme_name,
            func.sum(ThemeDaily.stock_count).label("total_stocks"),
        )
        .filter(ThemeDaily.date == date)
        .filter(ThemeDaily.data_source.in_([SOURCE_52W, SOURCE_MTT]))
        .group_by(ThemeDaily.theme_name)
        .having(func.count(ThemeDaily.data_source.distinct()) == 2)
        .all()
    )

    if not common_themes_query:
        return IntersectionResponse(
            date=date,
            theme_count=0,
            total_stock_count=0,
            themes=[],
        )

    theme_names = [row[0] for row in common_themes_query]

    # Level 2: For each common theme, find stocks that exist in BOTH sources
    # Strategy: For each theme, fetch stocks from both sources and compute set intersection
    themes_result: List[IntersectionThemeItem] = []
    total_stock_count = 0

    for theme_name in theme_names:
        # Get all stocks for this theme from both sources
        stocks_52w = db.query(ThemeStockDaily).filter(
            ThemeStockDaily.date == date,
            ThemeStockDaily.theme_name == theme_name,
            ThemeStockDaily.data_source == SOURCE_52W,
        ).all()

        stocks_mtt = db.query(ThemeStockDaily).filter(
            ThemeStockDaily.date == date,
            ThemeStockDaily.theme_name == theme_name,
            ThemeStockDaily.data_source == SOURCE_MTT,
        ).all()

        # Find common stocks by stock_name
        stocks_52w_map = {s.stock_name: s for s in stocks_52w}
        stocks_mtt_map = {s.stock_name: s for s in stocks_mtt}

        common_stock_names = set(stocks_52w_map.keys()) & set(stocks_mtt_map.keys())

        if not common_stock_names:
            continue  # Skip themes with no common stocks

        # Build intersection stocks list
        intersection_stocks: List[IntersectionStockItem] = []
        for stock_name in common_stock_names:
            stock_52w = stocks_52w_map[stock_name]
            stock_mtt = stocks_mtt_map[stock_name]

            intersection_stocks.append(
                IntersectionStockItem(
                    stock_name=stock_name,
                    rs_score_52w=stock_52w.rs_score,
                    rs_score_mtt=stock_mtt.rs_score,
                    change_pct_52w=stock_52w.change_pct,
                    change_pct_mtt=stock_mtt.change_pct,
                )
            )

        # Calculate average RS scores for common stocks only (intersection)
        if intersection_stocks:
            avg_rs_52w = sum(s.rs_score_52w for s in intersection_stocks if s.rs_score_52w is not None) / len(intersection_stocks)
            avg_rs_mtt = sum(s.rs_score_mtt for s in intersection_stocks if s.rs_score_mtt is not None) / len(intersection_stocks)
        else:
            avg_rs_52w = None
            avg_rs_mtt = None

        themes_result.append(
            IntersectionThemeItem(
                theme_name=theme_name,
                intersection_stock_count=len(intersection_stocks),
                avg_rs_52w=round(avg_rs_52w, 2) if avg_rs_52w is not None else None,
                avg_rs_mtt=round(avg_rs_mtt, 2) if avg_rs_mtt is not None else None,
                stock_count_52w=len(stocks_52w),
                stock_count_mtt=len(stocks_mtt),
                intersection_stocks=intersection_stocks,
            )
        )

        total_stock_count += len(intersection_stocks)

    # Sort by intersection_stock_count DESC
    themes_result.sort(key=lambda x: x.intersection_stock_count, reverse=True)

    return IntersectionResponse(
        date=date,
        theme_count=len(themes_result),
        total_stock_count=total_stock_count,
        themes=themes_result,
    )
