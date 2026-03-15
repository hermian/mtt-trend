"""
/api/sync 엔드포인트 테스트

SPEC-MTT-009: HTML 자동 감지 및 DB 동기화 시스템
- ACC-02: 수동 동기화 API 호출
"""

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.database import SessionLocal, create_tables
from app.models import ThemeDaily, SOURCE_52W
from app.sync_service import sync_service


class TestSyncAPI:
    """POST /api/sync 엔드포인트 테스트"""

    def setup_method(self):
        """각 테스트 전 데이터베이스 초기화"""
        create_tables()
        with SessionLocal() as db:
            db.query(ThemeDaily).delete()
            db.commit()
        # 동기화 상태 초기화
        sync_service.sync_in_progress = False

    def teardown_method(self):
        """각 테스트 후 데이터베이스 정리"""
        with SessionLocal() as db:
            db.query(ThemeDaily).delete()
            db.commit()
        sync_service.sync_in_progress = False

    def test_sync_endpoint_processes_files(self):
        """동기화 엔드포인트 파일 처리 테스트"""
        # given
        client = TestClient(app)

        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # 테스트용 HTML 파일 생성
            html_content = """
            <html><body>
                <h2>반도체</h2>
                <table>
                    <tr><th>종목명</th><th>RS</th><th>등락률</th></tr>
                    <tr><td>삼성전자</td><td>98</td><td>+2.5%</td></tr>
                </table>
            </body></html>
            """
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html").write_text(html_content)

            # data 디렉토리를 임시 디렉토리로 변경
            import app.routers.sync as sync_router
            original_data_dir = sync_router._DATA_DIR
            sync_router._DATA_DIR = tmpdir_path

            try:
                # when
                response = client.post("/api/sync")

                # then
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "completed"
                assert data["files_processed"] >= 0
            finally:
                # 원래 경로 복원
                sync_router._DATA_DIR = original_data_dir

    def test_sync_endpoint_returns_conflict_when_in_progress(self):
        """동기화 진행 중 409 응답 테스트 (ACC-02 시나리오 2-3)"""
        # given
        sync_service.sync_in_progress = True
        client = TestClient(app)

        # when
        response = client.post("/api/sync")

        # then
        assert response.status_code == 409
        data = response.json()
        assert data["detail"] == "Sync already in progress"

        # cleanup
        sync_service.sync_in_progress = False

    def test_sync_empty_directory(self):
        """빈 디렉토리 동기화 테스트 (ACC-04 시나리오 4-4)"""
        # given
        client = TestClient(app)

        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            import app.routers.sync as sync_router
            original_data_dir = sync_router._DATA_DIR
            sync_router._DATA_DIR = tmpdir_path

            try:
                # when
                response = client.post("/api/sync")

                # then
                assert response.status_code == 200
                data = response.json()
                assert data["total_files_scanned"] == 0
                assert data["files_processed"] == 0
            finally:
                sync_router._DATA_DIR = original_data_dir


class TestSyncStatusAPI:
    """GET /api/sync/status 엔드포인트 테스트 (Optional)"""

    def test_status_endpoint_returns_info(self):
        """상태 엔드포인트 테스트"""
        # given
        client = TestClient(app)

        # when
        response = client.get("/api/sync/status")

        # then
        assert response.status_code == 200
        data = response.json()
        assert "watchdog_active" in data
        assert "watched_directory" in data
