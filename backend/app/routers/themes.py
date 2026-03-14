"""
Theme-related API endpoints.

Routes:
    GET /api/themes/daily?date=YYYY-MM-DD
    GET /api/themes/surging?date=YYYY-MM-DD&threshold=10
    GET /api/themes/{name}/history?days=30
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.database import get_db
from app.models import ThemeDaily, ThemeStockDaily, SOURCE_52W
from app.schemas import (
    ThemeDailyItem,
    ThemeDailyResponse,
    ThemeSurgingItem,
    ThemeSurgingResponse,
    ThemeHistoryItem,
    ThemeHistoryResponse,
)

router = APIRouter(prefix="/themes", tags=["themes"])


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _latest_date(db: Session, source: str = SOURCE_52W) -> Optional[str]:
    row = db.query(func.max(ThemeDaily.date)).filter(ThemeDaily.data_source == source).scalar()
    return row


# ---------------------------------------------------------------------------
# GET /api/themes/daily
# ---------------------------------------------------------------------------

@router.get("/daily", response_model=ThemeDailyResponse)
def get_themes_daily(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    source: str = Query(SOURCE_52W, description="Data source: '52w_high' or 'mtt'"),
    db: Session = Depends(get_db),
):
    """Return all themes for the given date sorted by avg_rs descending."""
    if date is None:
        date = _latest_date(db, source)
        if date is None:
            raise HTTPException(status_code=404, detail="No data available")

    rows = (
        db.query(ThemeDaily)
        .filter(ThemeDaily.date == date, ThemeDaily.data_source == source)
        .order_by(ThemeDaily.avg_rs.desc().nullslast())
        .all()
    )

    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No theme data found for date {date}"
        )

    return ThemeDailyResponse(
        date=date,
        themes=[ThemeDailyItem.model_validate(r) for r in rows],
    )


# ---------------------------------------------------------------------------
# GET /api/themes/surging
# ---------------------------------------------------------------------------

@router.get("/surging", response_model=ThemeSurgingResponse)
def get_themes_surging(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    threshold: float = Query(10.0, description="RS increase threshold vs 5-day avg"),
    source: str = Query(SOURCE_52W, description="Data source: '52w_high' or 'mtt'"),
    db: Session = Depends(get_db),
):
    """Return themes whose avg_rs increased by more than `threshold` vs the 5-day rolling average."""
    if date is None:
        date = _latest_date(db, source)
        if date is None:
            raise HTTPException(status_code=404, detail="No data available")

    # Fetch current day's themes
    current_rows = (
        db.query(ThemeDaily)
        .filter(ThemeDaily.date == date, ThemeDaily.data_source == source)
        .all()
    )
    if not current_rows:
        raise HTTPException(
            status_code=404, detail=f"No theme data found for date {date}"
        )

    # Fetch all dates to find the 5 days prior to `date`
    all_dates: List[str] = [
        r[0]
        for r in db.query(ThemeDaily.date)
        .filter(ThemeDaily.date < date, ThemeDaily.data_source == source)
        .distinct()
        .order_by(ThemeDaily.date.desc())
        .limit(5)
        .all()
    ]

    # Build 5-day avg per theme
    avg_5d: dict[str, float] = {}
    if all_dates:
        rows_5d = (
            db.query(ThemeDaily.theme_name, func.avg(ThemeDaily.avg_rs))
            .filter(ThemeDaily.date.in_(all_dates), ThemeDaily.data_source == source)
            .group_by(ThemeDaily.theme_name)
            .all()
        )
        avg_5d = {r[0]: r[1] for r in rows_5d if r[1] is not None}

    surging: List[ThemeSurgingItem] = []
    for row in current_rows:
        if row.avg_rs is None:
            continue
        baseline = avg_5d.get(row.theme_name)
        if baseline is None:
            # No prior data -> treat as new theme, always surging
            rs_change = row.avg_rs
        else:
            rs_change = row.avg_rs - baseline

        if rs_change > threshold:
            surging.append(
                ThemeSurgingItem(
                    date=row.date,
                    theme_name=row.theme_name,
                    stock_count=row.stock_count,
                    avg_rs=row.avg_rs,
                    avg_rs_5d=baseline,
                    rs_change=rs_change,
                    change_sum=row.change_sum,
                    volume_sum=row.volume_sum,
                )
            )

    surging.sort(key=lambda x: x.rs_change or 0, reverse=True)

    return ThemeSurgingResponse(date=date, threshold=threshold, themes=surging)


# ---------------------------------------------------------------------------
# GET /api/themes/{name}/history
# ---------------------------------------------------------------------------

@router.get("/{name:path}/history", response_model=ThemeHistoryResponse)
def get_theme_history(
    name: str,
    days: int = Query(30, ge=1, le=365, description="Number of recent days to return"),
    source: str = Query(SOURCE_52W, description="Data source: '52w_high' or 'mtt'"),
    db: Session = Depends(get_db),
):
    """Return time-series RS data for a specific theme over the last N days."""
    rows = (
        db.query(ThemeDaily)
        .filter(ThemeDaily.theme_name == name, ThemeDaily.data_source == source)
        .order_by(ThemeDaily.date.desc())
        .limit(days)
        .all()
    )

    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No data found for theme '{name}'"
        )

    # Return in chronological order
    rows_sorted = sorted(rows, key=lambda r: r.date)

    return ThemeHistoryResponse(
        theme_name=name,
        days=days,
        history=[ThemeHistoryItem.model_validate(r) for r in rows_sorted],
    )
