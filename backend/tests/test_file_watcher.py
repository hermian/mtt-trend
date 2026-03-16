"""
file_watcher 모듈 테스트

SPEC-MTT-009: HTML 자동 감지 및 DB 동기화 시스템
- ACC-01: 신규 HTML 파일 자동 감지 및 적재
- ACC-04: 오류 파일 및 비정상 파일 처리
"""

import tempfile
from pathlib import Path
from unittest.mock import Mock, patch


import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.file_watcher import FileWatcherHandler, is_valid_html_pattern
from app.models import ThemeDaily


class TestIsValidHtmlPattern:
    """파일명 패턴 검증 테스트"""

    def test_valid_52w_high_pattern(self):
        """유효한 52주 신고가 파일명 패턴"""
        assert is_valid_html_pattern("★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html") is True

    def test_valid_mtt_pattern(self):
        """유효한 MTT 파일명 패턴"""
        assert is_valid_html_pattern("★Themes_With_7_or_More_MTT_Stocks-FullList_2026-03-15.html") is True

    def test_invalid_html_pattern(self):
        """유효하지 않은 HTML 파일명 패턴 (ACC-04 시나리오 4-2)"""
        assert is_valid_html_pattern("custom_report_2026-03-15.html") is False
        assert is_valid_html_pattern("report.html") is False

    def test_non_html_files(self):
        """HTML 파일 아님 (ACC-04 시나리오 4-1)"""
        assert is_valid_html_pattern("report.txt") is False
        assert is_valid_html_pattern("data.csv") is False
        assert is_valid_html_pattern("image.png") is False


class TestFileWatcherHandler:
    """FileWatcherHandler 테스트"""

    def setup_method(self):
        """각 테스트 전 데이터베이스 초기화"""
        from app.database import create_tables
        create_tables()
        from app.database import SessionLocal
        with SessionLocal() as db:
            db.query(ThemeDaily).delete()
            db.commit()

    def teardown_method(self):
        """각 테스트 후 데이터베이스 정리"""
        from app.database import SessionLocal
        with SessionLocal() as db:
            db.query(ThemeDaily).delete()
            db.commit()

    @patch('app.file_watcher.sync_service')
    def test_on_created_processes_valid_html(self, mock_sync_service):
        """유효한 HTML 파일 생성 시 처리 테스트 (ACC-01 시나리오 1-1, 1-2)"""
        # given
        handler = FileWatcherHandler()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # 유효한 HTML 파일 생성
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

            # when: 파일 생성 이벤트 시뮬레이션
            event = Mock()
            event.src_path = str(file_path)
            event.is_directory = False

            handler.on_created(event)

            # then: ingest_file이 호출되어야 함
            assert mock_sync_service.ingest_single_file.called

    @patch('app.file_watcher.sync_service')
    def test_on_created_ignores_non_html_files(self, mock_sync_service):
        """비-HTML 파일 무시 테스트 (ACC-04 시나리오 4-1)"""
        # given
        handler = FileWatcherHandler()
        with tempfile.TemporaryDirectory() as tmpdir:
            # 비-HTML 파일 생성
            file_path = Path(tmpdir) / "report.txt"
            file_path.write_text("text content")

            # when: 파일 생성 이벤트
            event = Mock()
            event.src_path = str(file_path)
            event.is_directory = False

            handler.on_created(event)

            # then: ingest_file이 호출되지 않아야 함
            assert not mock_sync_service.ingest_single_file.called

    @patch('app.file_watcher.sync_service')
    def test_on_created_ignores_invalid_html_pattern(self, mock_sync_service):
        """유효하지 않은 패턴의 HTML 파일 무시 테스트 (ACC-04 시나리오 4-2)"""
        # given
        handler = FileWatcherHandler()
        with tempfile.TemporaryDirectory() as tmpdir:
            # 패턴 불일치 HTML 파일
            file_path = Path(tmpdir) / "custom_report_2026-03-15.html"
            file_path.write_text("<html></html>")

            # when
            event = Mock()
            event.src_path = str(file_path)
            event.is_directory = False

            handler.on_created(event)

            # then: 처리되지 않아야 함
            assert not mock_sync_service.ingest_single_file.called

    @patch('app.file_watcher.sync_service')
    def test_on_moved_processes_valid_html(self, mock_sync_service):
        """파일 이동 시 처리 테스트"""
        # given
        handler = FileWatcherHandler()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # 파일을 감시 폴더로 이동
            html_content = "<html><body><h2>테마</h2></body></html>"
            file_path = tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html"
            file_path.write_text(html_content)

            # when: 파일 이동 이벤트
            event = Mock()
            event.src_path = str(file_path)
            event.dest_path = str(file_path)
            event.is_directory = False

            handler.on_moved(event)

            # then: ingest_file이 호출되어야 함
            assert mock_sync_service.ingest_single_file.called

    def test_stop_and_cleanup(self):
        """Watchdog 정상 종료 테스트 (ACC-01 시나리오 1-3)"""
        # given
        handler = FileWatcherHandler()

        # when & then: stop 메서드가 예외 없이 실행되어야 함
        handler.stop()  # Should not raise

    @patch('app.file_watcher.sync_service')
    def test_logs_warning_on_invalid_pattern(self, mock_sync_service, caplog):
        """유효하지 않은 패턴 경고 로그 테스트"""
        # given
        import logging
        caplog.set_level(logging.WARNING)

        handler = FileWatcherHandler()
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "custom_report_2026-03-15.html"
            file_path.write_text("<html></html>")

            # when
            event = Mock()
            event.src_path = str(file_path)
            event.is_directory = False

            handler.on_created(event)

            # then: WARNING 로그가 기록되어야 함
            assert any("Unrecognized HTML file pattern" in record.message for record in caplog.records)
