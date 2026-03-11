"""
FastAPI application entry point for the 52-week high theme trend dashboard.

Startup:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import create_tables, SessionLocal
from app.models import ThemeDaily
from app.routers import themes, stocks


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    create_tables()
    yield


app = FastAPI(
    title="52-Week High Theme Trend Dashboard API",
    description="Backend API for tracking 52-week high theme trends in Korean stock market",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS – allow frontend dev server at localhost:3000
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(themes.router, prefix="/api")
app.include_router(stocks.router, prefix="/api")


# ---------------------------------------------------------------------------
# /api/dates
# ---------------------------------------------------------------------------
from fastapi import Depends, Query
from app.database import get_db
from app.models import SOURCE_52W
from app.schemas import DatesResponse


@app.get("/api/dates", response_model=DatesResponse, tags=["dates"])
def list_dates(
    source: str = Query(SOURCE_52W, description="Data source: '52w_high' or 'mtt'"),
    db: Session = Depends(get_db),
):
    """Return all ingested dates in ascending order for the given source."""
    rows = (
        db.query(ThemeDaily.date)
        .filter(ThemeDaily.data_source == source)
        .distinct()
        .order_by(ThemeDaily.date.asc())
        .all()
    )
    return DatesResponse(dates=[r[0] for r in rows])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
