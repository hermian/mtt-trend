"""
FastAPI application entry point for the 52-week high theme trend dashboard.

Startup:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import create_tables, SessionLocal
from app.models import ThemeDaily
from app.routers import themes, stocks, sync, charts
from app.file_watcher import create_file_watcher, set_watchdog_active


# 파일 감시자 전역 변수
_file_observer = None
_file_watcher_handler = None


def perform_initial_sync(data_dir: Path, logger: logging.Logger) -> None:
    """
    서버 시작 시 초기 동기화 수행

    SPEC-MTT-010: 서버 시작 시 자동 동기화
    - REQ-MTT-010-01: data/ 폴더의 모든 HTML 파일을 스캔하여 미적재 파일을 자동으로 DB에 적재
    - REQ-MTT-010-02: 이미 DB에 적재된 파일(날짜 + data_source 기준)은 건너뛰고 로그 기록
    - REQ-MTT-010-03: 초기 동기화 완료 시 스캔한 파일 수, 적재된 파일 수, 건너뛴 파일 수, 에러 목록을 INFO 레벨로 로깅
    - REQ-MTT-010-05: 개별 파일 적재 중 에러 발생 시 에러 로깅 후 다음 파일 처리 계속
    - REQ-MTT-010-06: 초기 동기화 중 에러 발생해도 서버 시작 계속 (Graceful Degradation)

    Args:
        data_dir: 데이터 디렉토리 경로
        logger: 로거 인스턴스

    @MX:ANCHOR: 초기 동기화 함수
    @MX:REASON: lifespan 함수에서 호출되며, 서버 시작 시 기존 파일들을 DB에 적재하는 핵심 로직
    """
    if not data_dir.exists() or not data_dir.is_dir():
        logger.warning(f"Data directory not found: {data_dir}")
        return

    try:
        from app.sync_service import sync_service
        db = SessionLocal()
        try:
            result = sync_service.sync_files(data_dir, db)
            if result:
                # REQ-MTT-010-03: 초기 동기화 완료 로그
                logger.info(
                    f"Initial sync completed: {result.files_processed} files processed, "
                    f"{result.files_skipped} skipped, {len(result.errors)} errors"
                )
                if result.errors:
                    logger.warning(f"Initial sync errors: {result.errors}")
        finally:
            db.close()
    except Exception as e:
        # REQ-MTT-010-06: 초기 동기화 실패해도 서버 시작 계속
        logger.error(f"Initial sync failed: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    서버 수명 주기 관리

    - 시작 시: DB 테이블 생성 + 초기 동기화 + Watchdog 시작
    - 종료 시: Watchdog 정상 종료 (ACC-01 시나리오 1-3)

    SPEC-MTT-010: 서버 시작 시 자동 동기화
    - REQ-MTT-010-04: 초기 동기화 완료 후 Watchdog 파일 감시자 정상 시작
    """
    global _file_observer, _file_watcher_handler

    import logging
    logger = logging.getLogger(__name__)

    # 데이터베이스 테이블 생성
    create_tables()

    # data 디렉토리 경로 확인
    data_dir = Path(__file__).resolve().parent.parent / "data"

    # 초기 동기화 실행 (REQ-MTT-010-01 ~ REQ-MTT-010-06)
    # @MX:NOTE: 초기 동기화는 Watchdog 시작 전에 수행되어야 함
    # @MX:REASON: 서버 시작 시 기존 파일들을 먼저 적재한 후, 새로운 파일만 Watchdog가 감시해야 함
    perform_initial_sync(data_dir, logger)

    # Watchdog 파일 감시자 시작 (REQ-MTT-009-01, REQ-MTT-010-04)
    # 초기 동기화 완료 후 Watchdog 시작
    if data_dir.exists() and data_dir.is_dir():
        try:
            _file_observer, _file_watcher_handler = create_file_watcher(data_dir)
            set_watchdog_active(True, str(data_dir))
            logger.info("File watcher started successfully")
        except Exception as e:
            # Watchdog 시작 실패는 서버 시작을 막지 않음
            logger.error(f"Failed to start file watcher: {e}", exc_info=True)
            set_watchdog_active(False)
    else:
        set_watchdog_active(False)
        logger.warning(f"Data directory not found: {data_dir}")

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
        "http://192.168.1.150:3000",  # 서버 IP
        "http://hermian.duckdns.org:30000",  # DuckDNS 도메인 (30000 포트)
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
app.include_router(charts.router, prefix="/api")


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
