"""
파일 감시자 모듈

SPEC-MTT-009: HTML 자동 감지 및 DB 동기화 시스템
- Watchdog를 사용한 파일 시스템 감시
- 유효한 패턴의 HTML 파일만 처리
"""

import logging
import re
from pathlib import Path
from typing import Optional

from watchdog.events import FileSystemEventHandler, FileSystemEvent
from sqlalchemy.orm import Session

from app.sync_service import sync_service
from app.database import SessionLocal

logger = logging.getLogger(__name__)

# 파일명 패턴 정의
_52W_PATTERN = re.compile(r"★52Week_High_Stocks_By_Theme_With_RS_Scores_\d{4}-\d{2}-\d{2}\.html", re.IGNORECASE)
_MTT_PATTERN = re.compile(r"★Themes_With_7_or_More_MTT_Stocks-Top7_\d{4}-\d{2}-\d{2}\.html", re.IGNORECASE)


def is_valid_html_pattern(filename: str) -> bool:
    """
    파일명이 유효한 HTML 패턴인지 확인

    Args:
        filename: 확인할 파일명

    Returns:
        유효한 패턴이면 True, 아니면 False
    """
    # 확장자 확인
    if not filename.lower().endswith(".html"):
        return False

    # 패턴 매칭
    if _52W_PATTERN.match(filename) or _MTT_PATTERN.match(filename):
        return True

    return False


class FileWatcherHandler(FileSystemEventHandler):
    """
    Watchdog 이벤트 핸들러

    - 파일 생성/이동 시 자동 적재
    - 유효한 패턴의 HTML 파일만 처리
    - 오류 발생 시 로그만 남기고 계속 실행
    """

    def __init__(self):
        super().__init__()
        self._observer: Optional["Observer"] = None
        self._watched_directory: Optional[Path] = None

    def on_created(self, event: FileSystemEvent) -> None:
        """
        파일 생성 이벤트 처리

        Args:
            event: Watchdog 파일 시스템 이벤트
        """
        if event.is_directory:
            return

        file_path = Path(event.src_path)

        # HTML 파일 확인 (ACC-04 시나리오 4-1)
        if not file_path.suffix.lower() == ".html":
            return

        # 패턴 확인 (ACC-04 시나리오 4-2)
        if not is_valid_html_pattern(file_path.name):
            logger.warning(f"Unrecognized HTML file pattern: {file_path.name}")
            return

        # 파일 적재
        self._process_file(file_path)

    def on_moved(self, event: FileSystemEvent) -> None:
        """
        파일 이동 이벤트 처리

        Args:
            event: Watchdog 파일 시스템 이벤트
        """
        if event.is_directory:
            return

        # dest_path가 없는 경우 (일부 운영체제)
        if not hasattr(event, 'dest_path') or event.dest_path is None:
            file_path = Path(event.src_path)
        else:
            file_path = Path(event.dest_path)

        # HTML 파일 확인
        if not file_path.suffix.lower() == ".html":
            return

        # 패턴 확인
        if not is_valid_html_pattern(file_path.name):
            logger.warning(f"Unrecognized HTML file pattern: {file_path.name}")
            return

        # 파일 적재
        self._process_file(file_path)

    def _process_file(self, file_path: Path) -> None:
        """
        파일을 비동기적으로 적재

        Args:
            file_path: 적재할 파일 경로
        """
        logger.info(f"Processing new file: {file_path.name}")

        try:
            with SessionLocal() as db:
                sync_service.ingest_single_file(file_path, db)
                logger.info(f"Successfully loaded {file_path.name}")
        except Exception as e:
            logger.error(f"Failed to process {file_path.name}: {e}", exc_info=True)

    def stop(self) -> None:
        """
        감시자 정리

        ACC-01 시나리오 1-3: 서버 종료 시 Watchdog 정상 종료
        """
        if self._observer:
            try:
                self._observer.stop()
                self._observer.join(timeout=5)
                logger.info("File watcher stopped successfully")
            except Exception as e:
                logger.error(f"Error stopping file watcher: {e}")


def create_file_watcher(data_dir: Path) -> tuple["Observer", FileWatcherHandler]:
    """
    파일 감시자 생성 및 시작

    Args:
        data_dir: 감시할 디렉토리 경로

    Returns:
        (Observer, Handler) 튜플
    """
    from watchdog.observers import Observer

    handler = FileWatcherHandler()
    handler._watched_directory = data_dir

    observer = Observer()
    observer.schedule(handler, str(data_dir), recursive=False)
    observer.start()

    logger.info(f"File watcher started for directory: {data_dir}")

    handler._observer = observer
    return observer, handler


# 전역 상태 변수 (GET /api/sync/status 용)
# mutable list로 감싸서 main.py에서 수정 가능하게 함
_watchdog_state = {"active": False, "directory": None}


def get_watchdog_state() -> dict:
    """Watchdog 상태 반환"""
    return _watchdog_state.copy()


def set_watchdog_active(active: bool, directory: Optional[str] = None) -> None:
    """Watchdog 상태 설정"""
    _watchdog_state["active"] = active
    if directory is not None:
        _watchdog_state["directory"] = directory


# 하위 호환성을 위한 속성
watchdog_active = property(lambda self: _watchdog_state["active"])
watched_directory = property(lambda self: _watchdog_state["directory"])
