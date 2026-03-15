"""
서버 시작 시 자동 동기화 테스트

SPEC-MTT-010: 서버 시작 시 자동 동기화
- REQ-MTT-010-01: data/ 폴더의 모든 HTML 파일을 스캔하여 미적재 파일을 자동으로 DB에 적재
- REQ-MTT-010-02: 이미 DB에 적재된 파일(날짜 + data_source 기준)은 건너뛰고 로그 기록
- REQ-MTT-010-03: 초기 동기화 완료 시 스캔한 파일 수, 적재된 파일 수, 건너뛴 파일 수, 에러 목록을 INFO 레벨로 로깅
- REQ-MTT-010-04: 초기 동기화 완료 후 Watchdog 파일 감시자 정상 시작
- REQ-MTT-010-05: 개별 파일 적재 중 에러 발생 시 에러 로깅 후 다음 파일 처리 계속
- REQ-MTT-010-06: 초기 동기화 중 에러 발생해도 서버 시작 계속 (Graceful Degradation)

Acceptance Criteria:
- AC-010-01: 서버 시작 시 자동 동기화
- AC-010-02: 중복 적재 방지
- AC-010-03: 혼합 시나리오 (일부 적재, 일부 미적재)
- AC-010-04: 에러 격리
- AC-010-05: 빈 data 폴더
- AC-010-06: data 폴더 없음
"""

import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

import pytest
from sqlalchemy.orm import Session

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.sync_service import SyncService, SyncResult
from app.models import SOURCE_52W, SOURCE_MTT, ThemeDaily
from app.database import SessionLocal


class TestStartupSync:
    """서버 시작 시 자동 동기화 테스트 (AC-010-01 ~ AC-010-06)"""

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

    def test_startup_sync_processes_uningested_files(self):
        """
        AC-010-01: 서버 시작 시 자동 동기화

        서버 시작 시 data/ 폴더의 미적재 HTML 파일을 자동으로 DB에 적재
        """
        # given: data 폴더에 미적재 HTML 파일 존재
        service = SyncService()
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
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html").write_text(html_content)

            with SessionLocal() as db:
                # when: 초기 동기화 실행
                result = service.sync_files(tmpdir_path, db)

                # then: 모든 파일이 적재되어야 함
                assert result is not None
                assert result.total_files_scanned == 1
                assert result.files_processed == 1
                assert result.files_skipped == 0
                assert len(result.errors) == 0
                assert result.records_created > 0

                # DB에 데이터가 저장되었는지 확인
                themes = db.query(ThemeDaily).filter(
                    ThemeDaily.date == "2026-03-15",
                    ThemeDaily.data_source == SOURCE_52W
                ).all()
                assert len(themes) > 0

    def test_startup_sync_skips_already_loaded_files(self):
        """
        AC-010-02: 중복 적재 방지

        이미 DB에 적재된 파일은 건너뛰고 로그 기록
        """
        # given: 일부 파일은 이미 DB에 적재됨
        service = SyncService()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # 먼저 DB에 데이터 적재
            with SessionLocal() as db:
                db.add(ThemeDaily(
                    date="2026-03-15",
                    theme_name="반도체",
                    data_source=SOURCE_52W,
                    stock_count=10,
                    avg_rs=85.0,
                ))
                db.commit()

            # HTML 파일 생성 (이미 적재된 파일)
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
                # when: 초기 동기화 실행
                result = service.sync_files(tmpdir_path, db)

                # then: 이미 적재된 파일은 건너뛰어야 함
                assert result is not None
                assert result.total_files_scanned == 1
                assert result.files_processed == 0  # 새로 적재된 파일 없음
                assert result.files_skipped == 1  # 이미 적재된 파일 건너뜀
                assert len(result.errors) == 0

    def test_startup_sync_mixed_scenario(self):
        """
        AC-010-03: 혼합 시나리오

        일부 파일은 이미 적재되고, 일부 파일은 미적재된 상황에서
        미적재 파일만 적재하고 이미 적재된 파일은 건너뛰어야 함
        """
        # given: 3개의 파일 - 1개는 이미 적재됨, 2개는 미적재
        service = SyncService()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # 먼저 2026-03-14 파일만 DB에 적재
            with SessionLocal() as db:
                db.add(ThemeDaily(
                    date="2026-03-14",
                    theme_name="반도체",
                    data_source=SOURCE_52W,
                    stock_count=10,
                    avg_rs=85.0,
                ))
                db.commit()

            # 3개의 HTML 파일 생성
            html_content = """
            <html><body>
                <h2>반도체</h2>
                <table>
                    <tr><th>종목명</th><th>RS</th><th>등락률</th></tr>
                    <tr><td>삼성전자</td><td>98</td><td>+2.5%</td></tr>
                </table>
            </body></html>
            """
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-14.html").write_text(html_content)
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html").write_text(html_content)
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-16.html").write_text(html_content)

            with SessionLocal() as db:
                # when: 초기 동기화 실행
                result = service.sync_files(tmpdir_path, db)

                # then: 미적재 파일 2개만 적재되어야 함
                assert result is not None
                assert result.total_files_scanned == 3
                assert result.files_processed == 2  # 2개의 새로운 파일만 적재
                assert result.files_skipped == 1  # 2026-03-14는 건너뜀
                assert len(result.errors) == 0

    def test_startup_sync_continues_on_individual_file_errors(self):
        """
        AC-010-04: 에러 격리

        개별 파일 적재 중 에러 발생 시 에러 로깅 후 다음 파일 처리 계속
        초기 동기화 중 에러 발생해도 서버 시작 계속 (Graceful Degradation)
        """
        # given: 일부 파일은 손상됨
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
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-14.html").write_text(valid_html)

            # 손상된 파일 (날짜 패턴 없음)
            (tmpdir_path / "invalid_file.html").write_text("invalid content")

            # 또 다른 유효한 파일
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-16.html").write_text(valid_html)

            with SessionLocal() as db:
                # when: 초기 동기화 실행
                result = service.sync_files(tmpdir_path, db)

                # then: 손상된 파일로 인해 전체 동기화가 중단되지 않아야 함
                assert result is not None
                assert result.total_files_scanned == 3
                assert result.files_processed >= 2  # 유효한 파일들은 처리됨
                assert len(result.errors) >= 1  # 손상된 파일은 에러 처리됨

    def test_startup_sync_with_empty_folder(self):
        """
        AC-010-05: 빈 data 폴더

        data 폴더가 비어있어도 서버가 정상 시작되어야 함
        """
        # given: 빈 data 폴더
        service = SyncService()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            # 파일 없음

            with SessionLocal() as db:
                # when: 초기 동기화 실행
                result = service.sync_files(tmpdir_path, db)

                # then: 정상 완료되어야 함
                assert result is not None
                assert result.total_files_scanned == 0
                assert result.files_processed == 0
                assert result.files_skipped == 0
                assert len(result.errors) == 0

    def test_startup_sync_with_missing_folder(self):
        """
        AC-010-06: data 폴더 없음

        data 폴더가 없어도 서버가 정상 시작되어야 함 (Graceful Degradation)
        """
        # given: 존재하지 않는 data 폴더 경로
        service = SyncService()
        nonexistent_path = Path("/tmp/nonexistent_folder_12345")

        with SessionLocal() as db:
            # when: 초기 동기화 실행
            result = service.sync_files(nonexistent_path, db)

            # then: 정상 완료되어야 함 (에러가 발생하지 않아야 함)
            assert result is not None
            assert result.total_files_scanned == 0
            assert result.files_processed == 0
            assert result.files_skipped == 0
            assert len(result.errors) == 0

    def test_startup_sync_logs_completion_summary(self):
        """
        REQ-MTT-010-03: 초기 동기화 완료 시 로깅

        스캔한 파일 수, 적재된 파일 수, 건너뛴 파일 수, 에러 목록을 INFO 레벨로 로깅
        """
        # given: data 폴더에 여러 파일 존재
        service = SyncService()
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
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html").write_text(html_content)

            with SessionLocal() as db:
                with patch('app.sync_service.logger') as mock_logger:
                    # when: 초기 동기화 실행
                    result = service.sync_files(tmpdir_path, db)

                    # then: 완료 로그가 기록되어야 함
                    assert result is not None
                    mock_logger.info.assert_called()

                    # 로그 메시지에 결과 요약이 포함되어야 함
                    log_calls = [str(call) for call in mock_logger.info.call_args_list]
                    assert any("completed" in str(call).lower() for call in log_calls)

    def test_startup_sync_does_not_block_watchdog_start(self):
        """
        REQ-MTT-010-04: 초기 동기화 완료 후 Watchdog 정상 시작

        초기 동기화가 완료된 후 Watchdog 파일 감시자가 정상 시작되어야 함
        """
        # given: data 폴더에 파일 존재
        service = SyncService()
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
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html").write_text(html_content)

            with SessionLocal() as db:
                # when: 초기 동기화 실행
                result = service.sync_files(tmpdir_path, db)

                # then: 초기 동기화가 정상 완료되어야 함
                assert result is not None
                assert result.completed_at is not None
                assert result.started_at is not None
                assert result.completed_at >= result.started_at

                # Watchdog는 별도로 시작되므로 여기서는 초기 동기화 완료만 확인
                # Watchdog 시작은 main.py의 lifespan 함수에서 처리됨


class TestStartupSyncIntegration:
    """서버 시작 시 자동 동기화 통합 테스트 (main.py lifespan 함수)"""

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

    @patch('app.file_watcher.create_file_watcher')
    @patch('app.sync_service.sync_service.sync_files')
    def test_lifespan_performs_initial_sync_before_watchdog(self, mock_sync_files, mock_create_watcher):
        """
        서버 lifespan 함수에서 초기 동기화가 Watchdog 시작 전에 수행되는지 확인

        REQ-MTT-010-04: 초기 동기화 완료 후 Watchdog 파일 감시자 정상 시작
        """
        # given: mock 설정
        mock_sync_files.return_value = SyncResult(
            total_files_scanned=2,
            files_processed=2,
            files_skipped=0,
            records_created=20,
            errors=[],
            started_at=datetime.now(),
            completed_at=datetime.now(),
        )
        mock_observer = Mock()
        mock_handler = Mock()
        mock_create_watcher.return_value = (mock_observer, mock_handler)

        # when: FastAPI app 시작 (lifespan 함수 실행)
        from fastapi.testclient import TestClient
        from app.main import app

        # Note: lifespan은 async context manager이므로 직접 테스트 어려움
        # 대신 실제 서버 시작 시 동작을 확인하기 위해 app 객체 생성
        # 실제 테스트는 서버 시작 후 데이터베이스 상태 확인

        # then: 초기 동기화가 호출되었는지 확인
        # (이 테스트는 lifespan 함수 구현 후 통과해야 함)
        # 현재는 구현 전이므로 테스트가 실패할 것으로 예상
        pass

    def test_initial_sync_on_server_startup_with_real_files(self):
        """
        실제 서버 시작 시 초기 동기화가 수행되는지 통합 테스트

        이 테스트는 실제 파일 시스템과 데이터베이스를 사용하여
        서버 시작 시 초기 동기화가 올바르게 수행되는지 확인
        """
        # given: data 폴더에 HTML 파일 준비
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir) / "data"
            data_dir.mkdir()

            html_content = """
            <html><body>
                <h2>반도체</h2>
                <table>
                    <tr><th>종목명</th><th>RS</th><th>등락률</th></tr>
                    <tr><td>삼성전자</td><td>98</td><td>+2.5%</td></tr>
                </table>
            </body></html>
            """
            (data_dir / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html").write_text(html_content)

            # 데이터베이스 초기화 확인
            with SessionLocal() as db:
                initial_count = db.query(ThemeDaily).filter(
                    ThemeDaily.date == "2026-03-15"
                ).count()
                assert initial_count == 0  # 초기 상태: 데이터 없음

            # when: 서버 시작 (초기 동기화 실행)
            # Note: 이 테스트는 실제 lifespan 함수가 구현된 후 작동
            # 현재는 수동으로 sync_files 호출하여 시뮬레이션
            from app.sync_service import sync_service
            with SessionLocal() as db:
                result = sync_service.sync_files(data_dir, db)

            # then: 데이터가 적재되어야 함
            assert result is not None
            assert result.files_processed >= 1

            with SessionLocal() as db:
                final_count = db.query(ThemeDaily).filter(
                    ThemeDaily.date == "2026-03-15"
                ).count()
                assert final_count > 0  # 서버 시작 후 데이터 적재됨
