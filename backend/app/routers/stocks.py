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
from app.models import ThemeDaily, ThemeStockDaily, SOURCE_52W
from app.schemas import (
    GroupActionItem,
    GroupActionResponse,
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

@router.get("/group-action", response_model=GroupActionResponse)
def get_group_action(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    source: str = Query(SOURCE_52W, description="Data source: '52w_high' or 'mtt'"),
    db: Session = Depends(get_db),
):
    """
    Detect group-action stocks.

    Conditions:
    - Stock first appeared today OR first appeared within the last 3 days
    - Their theme's avg_rs increased vs yesterday
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

    # Find the 3 most recent dates up to and including `date`
    recent_3: List[str] = _recent_dates(db, date, 3, source)

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
        is_new = first_seen in recent_3 if first_seen else False
        if not is_new:
            continue

        theme_rs_today = today_rs.get(stock.theme_name)
        theme_rs_yesterday = yesterday_rs.get(stock.theme_name)

        if theme_rs_today is None:
            continue
        if theme_rs_yesterday is not None and theme_rs_today <= theme_rs_yesterday:
            continue

        theme_rs_change = (
            round(theme_rs_today - theme_rs_yesterday, 2)
            if theme_rs_yesterday is not None
            else None
        )

        result.append(
            GroupActionItem(
                stock_name=stock.stock_name,
                rs_score=stock.rs_score,
                change_pct=stock.change_pct,
                theme_name=stock.theme_name,
                theme_rs_change=theme_rs_change,
                first_seen_date=first_seen,
            )
        )

    # Sort by theme_rs_change descending
    result.sort(key=lambda x: x.theme_rs_change or 0, reverse=True)

    return GroupActionResponse(date=date, stocks=result)
