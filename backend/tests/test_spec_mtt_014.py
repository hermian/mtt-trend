"""
SPEC-MTT-014: 마지막 날짜 HTML 파일 덮어쓰기 처리 테스트

ACC-01: sync_files가 마지막 날짜 파일을 재적재하는 경우
ACC-02: sync_files가 이전 날짜 파일을 건너뛰는 경우
ACC-03: 파일 감시자가 수정된 파일을 감지하는 경우
"""

import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from app.sync_service import SyncService
from app.models import SOURCE_52W, SOURCE_MTT, ThemeDaily
from app.database import SessionLocal


class TestSpecMTT014_ACC01_LastDateReingestion:
    """ACC-01: sync_files가 마지막 날짜 파일을 재적재하는 경우"""

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

    def test_last_date_file_is_reingested(self):
        """
        ACC-01 시나리오 1-1: 마지막 날짜 파일 재적재

        Given DB에 "52w_high" 소스의 데이터가 2024-01-13, 2024-01-14, 2024-01-15 날짜로 존재하고
          And data 폴더에 2024-01-15 날짜의 HTML 파일이 새로운 내용으로 덮어쓰기되었을 때
        When sync_files()가 실행되면
        Then 2024-01-15 파일은 건너뛰지 않고 재적재(re-ingest)되어야 하고
          And DB의 2024-01-15 데이터가 새 파일 내용으로 업데이트되어야 하고
          And 로그에 "Re-ingesting last date file" 메시지가 기록되어야 한다
        """
        # given
        service = SyncService()

        # DB에 기존 데이터 적재 (2024-01-13, 2024-01-14, 2024-01-15)
        with SessionLocal() as db:
            db.add(ThemeDaily(
                date="2024-01-13",
                theme_name="테마1",
                data_source=SOURCE_52W,
                stock_count=10,
                avg_rs=80.0,
            ))
            db.add(ThemeDaily(
                date="2024-01-14",
                theme_name="테마2",
                data_source=SOURCE_52W,
                stock_count=15,
                avg_rs=85.0,
            ))
            db.add(ThemeDaily(
                date="2024-01-15",
                theme_name="구테마",  # 업데이트 전 데이터
                data_source=SOURCE_52W,
                stock_count=20,
                avg_rs=90.0,
            ))
            db.commit()

        # 업데이트된 HTML 파일 생성
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # 2024-01-15 파일 (업데이트된 내용)
            updated_html = """
            <html><body>
                <h2>신규테마</h2>
                <table>
                    <tr><td>삼성전자</td><td>98</td><td>+2.5%</td></tr>
                </table>
            </body></html>
            """
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html").write_text(updated_html)

            with SessionLocal() as db:
                # when
                with patch('app.sync_service.logger') as mock_logger:
                    result = service.sync_files(tmpdir_path, db)

                    # then: 2024-01-15 파일이 재적재되어야 함
                    assert result.files_processed == 1
                    assert result.files_skipped == 0

                    # DB 데이터 확인 (업데이트된 내용)
                    # ingest_file()은 theme_name을 기준으로 upsert하므로,
                    # "구테마"는 유지되고 "신규테마"가 새로 추가됨
                    themes = db.query(ThemeDaily).filter(
                        ThemeDaily.date == "2024-01-15",
                        ThemeDaily.data_source == SOURCE_52W,
                    ).all()

                    assert len(themes) == 2  # "구테마" + "신규테마"

                    # 새로운 테마가 추가되었는지 확인
                    new_theme = next((t for t in themes if t.theme_name == "신규테마"), None)
                    assert new_theme is not None

                    # 로그 메시지 확인
                    mock_logger.info.assert_any_call(
                        "Re-ingesting last date file: ★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html"
                    )

    def test_source_specific_last_date_reingestion(self):
        """
        ACC-01 시나리오 1-2: 소스별 독립적 마지막 날짜 처리

        Given DB에 "52w_high" 소스의 마지막 날짜가 2024-01-15이고
          And DB에 "mtt" 소스의 마지막 날짜가 2024-01-14일 때
        When sync_files()가 실행되면
        Then "52w_high" 소스의 2024-01-15 파일은 재적재되어야 하고
          And "mtt" 소스의 2024-01-14 파일은 재적재되어야 하고
          And "52w_high" 소스의 2024-01-14 파일은 건너뛰어야 한다
        """
        # given
        service = SyncService()

        # DB에 각 소스별 데이터 적재
        with SessionLocal() as db:
            # 52w_high: 2024-01-14, 2024-01-15
            db.add(ThemeDaily(
                date="2024-01-14",
                theme_name="테마1",
                data_source=SOURCE_52W,
                stock_count=10,
                avg_rs=80.0,
            ))
            db.add(ThemeDaily(
                date="2024-01-15",
                theme_name="테마2",
                data_source=SOURCE_52W,
                stock_count=15,
                avg_rs=85.0,
            ))

            # mtt: 2024-01-14만 존재
            db.add(ThemeDaily(
                date="2024-01-14",
                theme_name="테마3",
                data_source=SOURCE_MTT,
                stock_count=20,
                avg_rs=90.0,
            ))
            db.commit()

        # HTML 파일 생성
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            html_52w_14 = """
            <html><body><h2>테마1</h2><table><tr><th>종목명</th></tr><tr><td>종목1</td></tr></table></body></html>
            """
            html_52w_15 = """
            <html><body><h2>테마2</h2><table><tr><th>종목명</th></tr><tr><td>종목2</td></tr></table></body></html>
            """
            html_mtt_14 = """
            <html><body><h2>테마3</h2><table><tr><th>종목명</th></tr><tr><td>종목3</td></tr></table></body></html>
            """

            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-14.html").write_text(html_52w_14)
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html").write_text(html_52w_15)
            (tmpdir_path / "★Themes_With_7_or_More_MTT_Stocks-Top7_2024-01-14.html").write_text(html_mtt_14)

            with SessionLocal() as db:
                # when
                result = service.sync_files(tmpdir_path, db)

                # then: 52w_high의 2024-01-15는 재적재, mtt의 2024-01-14는 재적재, 52w_high의 2024-01-14는 건너뜀
                assert result.files_processed == 2  # 52w_high 2024-01-15, mtt 2024-01-14
                assert result.files_skipped == 1  # 52w_high 2024-01-14

    def test_empty_db_all_files_ingested(self):
        """
        ACC-01 시나리오 1-3: DB가 비어있는 경우

        Given DB에 어떤 소스의 데이터도 존재하지 않을 때
        When sync_files()가 실행되면
        Then 모든 HTML 파일이 정상 적재되어야 한다 (마지막 날짜 없음 = 모두 신규)
        """
        # given
        service = SyncService()

        # DB는 비어있음

        # HTML 파일 생성
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            html_content = """
            <html><body><h2>테마</h2><table><tr><th>종목명</th></tr><tr><td>종목</td></tr></table></body></html>
            """
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html").write_text(html_content)

            with SessionLocal() as db:
                # when
                result = service.sync_files(tmpdir_path, db)

                # then: 모든 파일이 정상 적재되어야 함
                assert result.files_processed == 1
                assert result.files_skipped == 0


class TestSpecMTT014_ACC02_PastDateSkip:
    """ACC-02: sync_files가 이전 날짜 파일을 건너뛰는 경우"""

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

    def test_past_date_files_are_skipped(self):
        """
        ACC-02 시나리오 2-1: 과거 날짜 파일 건너뛰기

        Given DB에 "52w_high" 소스의 데이터가 2024-01-13, 2024-01-14, 2024-01-15 날짜로 존재하고
          And data 폴더에 2024-01-13, 2024-01-14 날짜의 HTML 파일이 있을 때
        When sync_files()가 실행되면
        Then 2024-01-13 파일은 건너뛰어야 하고
          And 2024-01-14 파일은 건너뛰어야 하고
          And 로그에 "Skipped already loaded file" 메시지가 기록되어야 한다
        """
        # given
        service = SyncService()

        # DB에 데이터 적재 (2024-01-13, 2024-01-14, 2024-01-15)
        with SessionLocal() as db:
            for date in ["2024-01-13", "2024-01-14", "2024-01-15"]:
                db.add(ThemeDaily(
                    date=date,
                    theme_name=f"테마{date}",
                    data_source=SOURCE_52W,
                    stock_count=10,
                    avg_rs=80.0,
                ))
            db.commit()

        # HTML 파일 생성
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            html_content = """
            <html><body><h2>테마</h2><table><tr><th>종목명</th></tr><tr><td>종목</td></tr></table></body></html>
            """
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-13.html").write_text(html_content)
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-14.html").write_text(html_content)

            with SessionLocal() as db:
                # when
                with patch('app.sync_service.logger') as mock_logger:
                    result = service.sync_files(tmpdir_path, db)

                    # then: 과거 날짜 파일들은 모두 건너뛰어야 함
                    assert result.files_processed == 0
                    assert result.files_skipped == 2

                    # 로그 메시지 확인
                    assert mock_logger.info.call_count >= 2

    def test_new_date_file_is_ingested(self):
        """
        ACC-02 시나리오 2-2: 신규 날짜 파일 적재

        Given DB에 "52w_high" 소스의 마지막 날짜가 2024-01-15이고
          And data 폴더에 2024-01-16 날짜의 새 HTML 파일이 있을 때
        When sync_files()가 실행되면
        Then 2024-01-16 파일은 정상 적재되어야 한다
        """
        # given
        service = SyncService()

        # DB에 데이터 적재 (마지막 날짜: 2024-01-15)
        with SessionLocal() as db:
            db.add(ThemeDaily(
                date="2024-01-15",
                theme_name="테마",
                data_source=SOURCE_52W,
                stock_count=10,
                avg_rs=80.0,
            ))
            db.commit()

        # 신규 HTML 파일 생성 (2024-01-16)
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            html_content = """
            <html><body><h2>신규테마</h2><table><tr><td>삼성전자</td><td>98</td><td>+2.5%</td></tr></table></body></html>
            """
            (tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-16.html").write_text(html_content)

            with SessionLocal() as db:
                # when
                result = service.sync_files(tmpdir_path, db)

                # then: 신규 날짜 파일이 정상 적재되어야 함
                assert result.files_processed == 1
                assert result.files_skipped == 0

                # DB 데이터 확인
                new_theme = db.query(ThemeDaily).filter(
                    ThemeDaily.date == "2024-01-16",
                    ThemeDaily.data_source == SOURCE_52W,
                ).first()

                assert new_theme is not None
                assert new_theme.theme_name == "신규테마"


class TestSpecMTT014_ACC03_FileWatcherModified:
    """ACC-03: 파일 감시자가 수정된 파일을 감지하는 경우"""

    def test_on_modified_processes_valid_html_file(self):
        """
        ACC-03 시나리오 3-1: on_modified 이벤트로 유효한 HTML 파일 재적재

        Given FileWatcherHandler가 data 폴더를 감시 중이고
          And 유효한 HTML 패턴의 파일이 존재할 때
        When 해당 파일이 제자리 수정(overwrite)되면
        Then on_modified 이벤트가 트리거되어야 하고
          And _process_file()이 호출되어 파일이 재적재되어야 한다
        """
        # given
        from app.file_watcher import FileWatcherHandler
        from watchdog.events import FileModifiedEvent

        handler = FileWatcherHandler()

        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # 유효한 HTML 파일 생성
            html_content = """
            <html><body><h2>테마</h2><table><tr><th>종목명</th></tr><tr><td>종목</td></tr></table></body></html>
            """
            file_path = tmpdir_path / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html"
            file_path.write_text(html_content)

            # when: 파일 수정 이벤트 발생
            event = FileModifiedEvent(str(file_path))
            with patch.object(handler, '_process_file') as mock_process:
                handler.on_modified(event)

                # then: _process_file이 호출되어야 함
                mock_process.assert_called_once()
                mock_process.assert_called_with(file_path)

    def test_on_modified_ignores_invalid_html_file(self):
        """
        ACC-03 시나리오 3-2: 비유효 파일 수정 무시

        Given FileWatcherHandler가 data 폴더를 감시 중이고
          And 유효하지 않은 패턴의 파일(예: readme.html)이 있을 때
        When 해당 파일이 수정되면
        Then on_modified 이벤트는 해당 파일을 무시해야 하고
          And _process_file()이 호출되지 않아야 한다
        """
        # given
        from app.file_watcher import FileWatcherHandler
        from watchdog.events import FileModifiedEvent

        handler = FileWatcherHandler()

        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # 유효하지 않은 HTML 파일 생성
            file_path = tmpdir_path / "readme.html"
            file_path.write_text("<html></html>")

            # when: 파일 수정 이벤트 발생
            event = FileModifiedEvent(str(file_path))
            with patch.object(handler, '_process_file') as mock_process:
                handler.on_modified(event)

                # then: _process_file이 호출되지 않아야 함
                mock_process.assert_not_called()

    def test_on_modified_ignores_directory_events(self):
        """
        ACC-03 시나리오 3-3: 디렉토리 수정 이벤트 무시

        Given FileWatcherHandler가 data 폴더를 감시 중일 때
        When 디렉토리 수정 이벤트가 발생하면
        Then 이벤트를 무시하고 아무 작업도 수행하지 않아야 한다
        """
        # given
        from app.file_watcher import FileWatcherHandler
        from watchdog.events import FileModifiedEvent

        handler = FileWatcherHandler()

        with tempfile.TemporaryDirectory() as tmpdir:
            # when: 디렉토리 수정 이벤트 발생
            event = FileModifiedEvent(str(tmpdir))
            event.is_directory = True

            with patch.object(handler, '_process_file') as mock_process:
                handler.on_modified(event)

                # then: _process_file이 호출되지 않아야 함
                mock_process.assert_not_called()
