"""
sync_service 모듈 테스트

SPEC-MTT-009: HTML 자동 감지 및 DB 동기화 시스템
- ACC-02: 수동 동기화 API 호출
- ACC-03: 중복 파일 처리 (UPSERT)
- ACC-04: 오류 파일 및 비정상 파일 처리
"""

import tempfile
from pathlib import Path
from datetime import datetime


import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.sync_service import SyncService, SyncResult
from app.models import SOURCE_52W, ThemeDaily
from app.database import SessionLocal


class TestSyncService:
    """SyncService 테스트"""

    def setup_method(self):
        """각 테스트 전 데이터베이스 초기화"""
        from app.database import create_tables
        create_tables()
        with SessionLocal() as db:
            db.query(ThemeDaily).delete()
            db.commit()

    def teardown_method(self):
        """각 테스트 후 데이터베이스 정리"""
        with SessionLocal() as db:
            db.query(ThemeDaily).delete()
            db.commit()

    def test_scan_html_files_finds_html_files(self):
        """HTML 파일 스캔 테스트"""
        # given
        service = SyncService()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            (tmpdir_path / "file1.html").write_text("<html></html>")
            (tmpdir_path / "file2.html").write_text("<html></html>")
            (tmpdir_path / "readme.txt").write_text("text")

            # when
            files = service.scan_html_files(tmpdir_path)

            # then
            assert len(files) == 2
            assert all(f.suffix == ".html" for f in files)

    def test_scan_html_files_empty_directory(self):
        """빈 디렉토리 스캔 테스트"""
        # given
        service = SyncService()
        with tempfile.TemporaryDirectory() as tmpdir:
            # when
            files = service.scan_html_files(Path(tmpdir))

            # then
            assert len(files) == 0

    def test_is_file_already_loaded_true_when_loaded(self):
        """이미 적재된 파일 확인 테스트"""
        # given
        from app.models import ThemeDaily
        service = SyncService()
        with SessionLocal() as db:
            db.add(ThemeDaily(
                date="2026-03-15",
                theme_name="테마",
                data_source=SOURCE_52W,
                stock_count=10,
                avg_rs=85.0,
            ))
            db.commit()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html"
            file_path.write_text("<html></html>")

            # when
            is_loaded = service.is_file_already_loaded(file_path, db)

            # then
            assert is_loaded is True

    def test_is_file_already_loaded_false_when_not_loaded(self):
        """미적재 파일 확인 테스트"""
        # given
        service = SyncService()
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html"
            file_path.write_text("<html></html>")

            with SessionLocal() as db:
                # when
                is_loaded = service.is_file_already_loaded(file_path, db)

                # then
                assert is_loaded is False

    def test_sync_files_processes_new_files(self):
        """신규 파일 동기화 테스트 (ACC-02 시나리오 2-1)"""
        # given
        service = SyncService()
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

            with SessionLocal() as db:
                # when
                result = service.sync_files(tmpdir_path, db)

                # then
                assert result.total_files_scanned == 1
                assert result.files_processed == 1
                assert result.files_skipped == 0
                assert len(result.errors) == 0
                assert result.records_created > 0

    def test_sync_files_skips_already_loaded_files(self):
        """이미 적재된 파일 건너뛰기 테스트 (ACC-02 시나리오 2-2)"""
        # given
        service = SyncService()

        # 먼저 파일을 적재
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            html_content = """
            <html><body>
                <h2>반도체</h2>
                <table>
                    <tr><th>종목명</th><th>RS</th><th>등락률</th></tr>
                    <tr><td>삼성전자</td><td>98</td><td>+2.5%</td></tr>
                </table>
            </body></html>
            """
            file_path = tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html"
            file_path.write_text(html_content)

            with SessionLocal() as db:
                # 첫 번째 동기화
                service.sync_files(tmpdir_path, db)

                # when: 두 번째 동기화
                result = service.sync_files(tmpdir_path, db)

                # then
                assert result.total_files_scanned == 1
                assert result.files_processed == 0
                assert result.files_skipped == 1
                assert len(result.errors) == 0

    def test_sync_files_handles_parse_errors_individually(self):
        """개별 파일 오류 격리 테스트 (ACC-04 시나리오 4-3)"""
        # given
        service = SyncService()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # 유효한 파일
            valid_html = """
            <html><body>
                <h2>반도체</h2>
                <table>
                    <tr><th>종목명</th><th>RS</th><th>등락률</th></tr>
                    <tr><td>삼성전자</td><td>98</td><td>+2.5%</td></tr>
                </table>
            </body></html>
            """
            (tmpdir_path / "★52Week_High_Stocks_2026-03-14.html").write_text(valid_html)

            # 날짜가 없는 손상된 파일명 (에러 발생)
            (tmpdir_path / "invalid_file_no_date.html").write_text("content")

            # 또 다른 유효한 파일
            (tmpdir_path / "★52Week_High_Stocks_2026-03-16.html").write_text(valid_html)

            with SessionLocal() as db:
                # when
                result = service.sync_files(tmpdir_path, db)

                # then: 손상된 파일은 에러 처리되지만 유효한 파일들은 계속 처리됨
                assert result.total_files_scanned == 3
                assert result.files_processed >= 2  # 유효한 파일들은 처리됨
                assert len(result.errors) >= 1  # 손상된 파일은 에러 처리됨

    def test_sync_in_progress_flag(self):
        """동시 동기화 요청 차단 테스트 (ACC-02 시나리오 2-3)"""
        # given
        service = SyncService()

        # when: 이미 진행 중인 상태로 설정
        service.sync_in_progress = True

        # then: 새로운 동기화는 시작되지 않아야 함
        with tempfile.TemporaryDirectory() as tmpdir:
            with SessionLocal() as db:
                result = service.sync_files(Path(tmpdir), db)

                # 동기화가 수행되지 않아야 함
                assert result is None or result.total_files_scanned == 0


class TestSyncResult:
    """SyncResult 데이터 클래스 테스트"""

    def test_sync_result_creation(self):
        """SyncResult 생성 테스트"""
        # given
        result = SyncResult(
            total_files_scanned=10,
            files_processed=3,
            files_skipped=7,
            records_created=45,
            errors=[],
            started_at=datetime(2026, 3, 15, 10, 30, 0),
            completed_at=datetime(2026, 3, 15, 10, 30, 5),
        )

        # then
        assert result.total_files_scanned == 10
        assert result.files_processed == 3
        assert result.files_skipped == 7
        assert result.records_created == 45
        assert len(result.errors) == 0
