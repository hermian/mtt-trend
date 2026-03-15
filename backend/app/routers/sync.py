"""
동기화 API 라우터

SPEC-MTT-009: HTML 자동 감지 및 DB 동기화 시스템
- POST /api/sync: 수동 동기화
- GET /api/sync/status: 동기화 상태 조회
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.sync_service import sync_service
from app.file_watcher import get_watchdog_state

logger = logging.getLogger(__name__)

router = APIRouter()

# data 디렉토리 경로
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


class SyncResponse(BaseModel):
    """동기화 응답 모델"""
    status: str
    total_files_scanned: int
    files_processed: int
    files_skipped: int
    records_created: int
    errors: list[dict]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class StatusResponse(BaseModel):
    """상태 응답 모델"""
    watchdog_active: bool
    watched_directory: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    last_sync_result: Optional[dict] = None


from pydantic import BaseModel


@router.post("/sync", response_model=SyncResponse, tags=["sync"])
def sync_database(db: Session = Depends(get_db)) -> SyncResponse:
    """
    수동 동기화 API

    data/ 폴더의 모든 HTML 파일을 스캔하여 미적재 파일을 DB에 적재합니다.

    Returns:
        SyncResponse: 동기화 결과

    Raises:
        HTTPException 409: 이미 동기화가 진행 중인 경우
    """
    # 동시 실행 방지 확인 (ACC-02 시나리오 2-3)
    if sync_service.sync_in_progress:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sync already in progress"
        )

    logger.info("Manual sync requested")

    # 동기화 실행
    result = sync_service.sync_files(_DATA_DIR, db)

    if result is None:
        # 이것은 동시 실행 방지가 작동했음을 의미
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sync already in progress"
        )

    return SyncResponse(
        status="completed",
        total_files_scanned=result.total_files_scanned,
        files_processed=result.files_processed,
        files_skipped=result.files_skipped,
        records_created=result.records_created,
        errors=result.errors,
        started_at=result.started_at,
        completed_at=result.completed_at,
    )


@router.get("/sync/status", response_model=StatusResponse, tags=["sync"])
def get_sync_status() -> StatusResponse:
    """
    동기화 상태 조회 API

    현재 Watchdog 상태와 마지막 동기화 결과를 반환합니다.

    Returns:
        StatusResponse: 상태 정보
    """
    last_result = sync_service.last_sync_result

    last_sync_result_dict = None
    if last_result:
        last_sync_result_dict = {
            "files_processed": last_result.files_processed,
            "errors": last_result.errors,
        }

    state = get_watchdog_state()

    return StatusResponse(
        watchdog_active=state["active"],
        watched_directory=state["directory"],
        last_sync_at=sync_service.last_sync_at,
        last_sync_result=last_sync_result_dict,
    )
