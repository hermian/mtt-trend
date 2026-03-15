"""
동기화 서비스 모듈

SPEC-MTT-009: HTML 자동 감지 및 DB 동기화 시스템
- 수동 동기화 API를 위한 서비스 로직
- 파일 스캔, 중복 확인, 일괄 적재 기능
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

# scripts/ingest.py 모듈 재사용
import sys
_SCRIPT_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(_SCRIPT_DIR))

from ingest import (
    extract_date_from_filename,
    detect_source_from_filename,
    ingest_file,
)
from app.models import ThemeDaily

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    """동기화 결과"""
    total_files_scanned: int
    files_processed: int
    files_skipped: int
    records_created: int
    errors: list[dict] = field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class SyncService:
    """
    동기화 서비스

    - data/ 폴더의 HTML 파일 스캔
    - 미적재 파일 필터링
    - 일괄 적재 실행
    - 동시 실행 방지
    """

    def __init__(self):
        self.sync_in_progress: bool = False
        self._results: Optional[SyncResult] = None

    def scan_html_files(self, data_dir: Path) -> list[Path]:
        """
        data_dir 폴더에서 모든 HTML 파일 스캔

        Args:
            data_dir: 스캔할 디렉토리 경로

        Returns:
            HTML 파일 경로 리스트 (정렬됨)
        """
        if not data_dir.exists() or not data_dir.is_dir():
            logger.warning(f"Data directory not found: {data_dir}")
            return []

        html_files = sorted(data_dir.glob("*.html"))
        logger.info(f"Scanned {len(html_files)} HTML files in {data_dir}")
        return html_files

    def is_file_already_loaded(self, file_path: Path, db: Session) -> bool:
        """
        파일이 이미 DB에 적재되었는지 확인

        Args:
            file_path: 확인할 파일 경로
            db: 데이터베이스 세션

        Returns:
            이미 적재된 경우 True
        """
        date = extract_date_from_filename(file_path)
        if not date:
            return False

        source = detect_source_from_filename(file_path)

        # 해당 날짜와 소스의 데이터가 존재하는지 확인
        existing = db.query(ThemeDaily).filter(
            ThemeDaily.date == date,
            ThemeDaily.data_source == source,
        ).first()

        return existing is not None

    def ingest_single_file(self, file_path: Path, db: Session) -> tuple[int, int]:
        """
        단일 파일 적재

        Args:
            file_path: 파일 경로
            db: 데이터베이스 세션

        Returns:
            (테마 수, 종목 수) 튜플
        """
        try:
            themes_count, stocks_count = ingest_file(file_path, db)
            logger.info(f"Ingested {file_path.name}: {themes_count} themes, {stocks_count} stocks")
            return themes_count, stocks_count
        except Exception as e:
            logger.error(f"Failed to ingest {file_path.name}: {e}")
            raise

    def sync_files(self, data_dir: Path, db: Session) -> Optional[SyncResult]:
        """
        data_dir의 모든 HTML 파일을 동기화

        Args:
            data_dir: 데이터 디렉토리 경로
            db: 데이터베이스 세션

        Returns:
            SyncResult 또는 None (이미 진행 중인 경우)
        """
        # 동시 실행 방지 (ACC-02 시나리오 2-3)
        if self.sync_in_progress:
            logger.warning("Sync already in progress, skipping request")
            return None

        self.sync_in_progress = True
        started_at = datetime.now()

        try:
            html_files = self.scan_html_files(data_dir)

            result = SyncResult(
                total_files_scanned=len(html_files),
                files_processed=0,
                files_skipped=0,
                records_created=0,
                errors=[],
                started_at=started_at,
            )

            for file_path in html_files:
                try:
                    # 이미 적재된 파일인지 확인
                    if self.is_file_already_loaded(file_path, db):
                        result.files_skipped += 1
                        logger.info(f"Skipped already loaded file: {file_path.name}")
                        continue

                    # 파일 적재
                    themes_count, stocks_count = self.ingest_single_file(file_path, db)
                    result.files_processed += 1
                    result.records_created += themes_count + stocks_count

                except Exception as e:
                    # 개별 파일 오류 격리 (ACC-04 시나리오 4-3)
                    error_entry = {
                        "file": file_path.name,
                        "error": str(e),
                    }
                    result.errors.append(error_entry)
                    logger.error(f"Error processing {file_path.name}: {e}")

            result.completed_at = datetime.now()
            self._results = result

            # 결과 로그
            logger.info(
                f"Sync completed: {result.files_processed} processed, "
                f"{result.files_skipped} skipped, {len(result.errors)} errors"
            )

            return result

        finally:
            self.sync_in_progress = False

    @property
    def last_sync_result(self) -> Optional[SyncResult]:
        """마지막 동기화 결과 반환"""
        return self._results

    @property
    def last_sync_at(self) -> Optional[datetime]:
        """마지막 동기화 시각 반환"""
        return self._results.completed_at if self._results else None


# 전역 싱글톤 인스턴스
sync_service = SyncService()
