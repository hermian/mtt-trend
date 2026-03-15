"""
FastAPI application entry point for the 52-week high theme trend dashboard.

Startup:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import create_tables, SessionLocal
from app.models import ThemeDaily
from app.routers import themes, stocks, sync
from app.file_watcher import create_file_watcher, set_watchdog_active


# 파일 감시자 전역 변수
_file_observer = None
_file_watcher_handler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    서버 수명 주기 관리

    - 시작 시: DB 테이블 생성 + Watchdog 시작
    - 종료 시: Watchdog 정상 종료 (ACC-01 시나리오 1-3)
    """
    global _file_observer, _file_watcher_handler

    # 데이터베이스 테이블 생성
    create_tables()

    # Watchdog 파일 감시자 시작 (REQ-MTT-009-01)
    data_dir = Path(__file__).resolve().parent.parent.parent / "data"
    if data_dir.exists() and data_dir.is_dir():
        try:
            _file_observer, _file_watcher_handler = create_file_watcher(data_dir)
            set_watchdog_active(True, str(data_dir))
        except Exception as e:
            # Watchdog 시작 실패는 서버 시작을 막지 않음
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to start file watcher: {e}")
            set_watchdog_active(False)
    else:
        set_watchdog_active(False)

    yield

    # 서버 종료 시 Watchdog 정상 종료 (REQ-MTT-009-03)
    if _file_watcher_handler:
        _file_watcher_handler.stop()
    if _file_observer:
        try:
            _file_observer.stop()
            _file_observer.join(timeout=5)
        except Exception:
            pass


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
app.include_router(sync.router, prefix="/api")


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
