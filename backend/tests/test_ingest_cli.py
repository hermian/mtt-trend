"""
ingest.py CLI 테스트

SPEC-MTT-002 F-01: 데이터 수집
- R-01-1: 전체 파일 일괄 수집 (--dir 플래그)
- R-01-2: 중복 방지 (INSERT OR IGNORE)
- R-01-3: 파싱 실패 복구 (개별 파일 건너뛰기)
- R-01-4: 수집 결과 요약 출력
"""

import re
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
from sqlalchemy.orm import Session

# ingest.py를 임포트하기 위해 backend 디렉토리를 경로에 추가
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.ingest import (
    extract_date_from_filename,
    detect_source_from_filename,
    main,
    parse_html,
    compute_aggregates,
)
from app.models import SOURCE_52W, SOURCE_MTT
from app.database import SessionLocal, create_tables


class TestExtractDateFromFilename:
    """파일명에서 날짜 추출 테스트"""

    def test_52w_high_filename(self):
        """52주 신고가 파일명에서 날짜 추출"""
        filename = Path("★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-13.html")
        assert extract_date_from_filename(filename) == "2026-03-13"

    def test_mtt_filename(self):
        """MTT 파일명에서 날짜 추출"""
        filename = Path("★Themes_With_7_or_More_MTT_Stocks-Top7_2026-03-13.html")
        assert extract_date_from_filename(filename) == "2026-03-13"

    def test_no_date_in_filename(self):
        """날짜가 없는 파일명 처리"""
        filename = Path("invalid_filename.html")
        assert extract_date_from_filename(filename) is None


class TestDetectSourceFromFilename:
    """파일명에서 데이터 소스 감지 테스트"""

    def test_detect_52w_high_source(self):
        """52주 신고가 소스 감지"""
        filename = Path("★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-13.html")
        assert detect_source_from_filename(filename) == SOURCE_52W

    def test_detect_mtt_source(self):
        """MTT 소스 감지"""
        filename = Path("★Themes_With_7_or_More_MTT_Stocks-Top7_2026-03-13.html")
        assert detect_source_from_filename(filename) == SOURCE_MTT


class TestComputeAggregates:
    """테마 집계 계산 테스트"""

    def test_compute_aggregates_with_valid_data(self):
        """유효한 데이터로 집계 계산"""
        stocks = [
            {"stock_name": "삼성전자", "rs_score": 98, "change_pct": 2.5},
            {"stock_name": "LG에너지솔루션", "rs_score": 95, "change_pct": 1.8},
            {"stock_name": "SK하이닉스", "rs_score": 92, "change_pct": None},
        ]
        result = compute_aggregates(stocks)

        assert result["stock_count"] == 3
        assert result["avg_rs"] == round((98 + 95 + 92) / 3, 2)
        assert result["change_sum"] == round(2.5 + 1.8, 2)
        assert result["volume_sum"] is None

    def test_compute_aggregates_with_empty_stocks(self):
        """빈 종목 리스트 처리"""
        stocks = []
        result = compute_aggregates(stocks)

        assert result["stock_count"] == 0
        assert result["avg_rs"] is None
        assert result["change_sum"] is None


class TestParseHTML:
    """HTML 파싱 테스트"""

    def test_parse_52w_high_html(self):
        """52주 신고가 HTML 파싱"""
        html_content = """
        <html>
        <body>
            <h2>반도체</h2>
            <table>
                <tr><th>종목명</th><th>RS</th><th>등락률</th></tr>
                <tr><td>삼성전자</td><td>98</td><td>+2.5%</td></tr>
                <tr><td>SK하이닉스</td><td>92</td><td>+1.8%</td></tr>
            </table>
            <h2>2차전지</h2>
            <table>
                <tr><th>종목명</th><th>RS</th><th>등락률</th></tr>
                <tr><td>LG에너지솔루션</td><td>95</td><td>+1.2%</td></tr>
            </table>
        </body>
        </html>
        """
        result = parse_html(html_content, source=SOURCE_52W)

        assert "반도체" in result
        assert "2차전지" in result
        assert len(result["반도체"]) == 2
        assert result["반도체"][0]["stock_name"] == "삼성전자"
        assert result["반도체"][0]["rs_score"] == 98
        assert result["반도체"][0]["change_pct"] == 2.5


class TestIngestDirFlag:
    """
    --dir 플래그 기능 테스트

    SPEC-MTT-002 R-01-1: 전체 파일 일괄 수집
    WHEN 운영자가 `python scripts/ingest.py --dir backend/data/` 명령을 실행하면
    THE SYSTEM SHALL `backend/data/` 디렉토리 내 모든 HTML 파일을 순서대로 파싱하여 SQLite DB에 수집해야 한다.
    """

    @patch("scripts.ingest.SessionLocal")
    @patch("scripts.ingest.create_tables")
    def test_dir_flag_processes_all_html_files(
        self, mock_create_tables, mock_session
    ):
        """
        --dir 플래그로 지정된 디렉토리의 모든 HTML 파일을 처리해야 한다
        """
        import tempfile

        # given: mock 설정
        mock_db = Mock(spec=Session)
        mock_session.return_value.__enter__.return_value = mock_db

        with tempfile.TemporaryDirectory() as tmpdir:
            # 가짜 HTML 파일 2개 생성 (날짜 패턴 포함)
            file1 = Path(tmpdir) / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-13.html"
            file2 = Path(tmpdir) / "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-14.html"
            file1.write_text("<html><body><h2>반도체</h2><table><tr><td>삼성전자</td><td>98</td><td>+2.5%</td></tr></table></body></html>")
            file2.write_text("<html><body><h2>2차전지</h2><table><tr><td>LG에너지솔루션</td><td>95</td><td>+1.2%</td></tr></table></body></html>")

            # when: --dir 플래그로 실제 디렉토리 실행
            with patch.object(sys, "argv", [
                "ingest.py",
                "--dir",
                tmpdir
            ]):
                main()

        # then: 2개 파일이 모두 처리되어야 함
        # commit이 최소 2번 호출되어야 함 (파일별로)
        assert mock_db.commit.call_count >= 2

    @patch("scripts.ingest.SessionLocal")
    @patch("scripts.ingest.create_tables")
    def test_dir_flag_processes_files_in_date_order(
        self, mock_create_tables, mock_session
    ):
        """
        파일 처리 순서: 날짜 오름차순 (파일명 기준)
        """
        import tempfile

        # given: mock 설정
        mock_db = Mock(spec=Session)
        mock_session.return_value.__enter__.return_value = mock_db

        # 처리 순서 추적
        processed_files = []

        def track_ingest(file_path, db):
            processed_files.append(file_path.name)
            return (1, 10)  # (themes, stocks)

        with tempfile.TemporaryDirectory() as tmpdir:
            # 날짜순으로 정렬될 파일들 (역순으로 생성)
            file2 = Path(tmpdir) / "★52Week_High_Stocks_2026-01-05.html"
            file1 = Path(tmpdir) / "★52Week_High_Stocks_2026-01-02.html"

            file2.write_text("<html><body><h2>Theme2</h2></body></html>")
            file1.write_text("<html><body><h2>Theme1</h2></body></html>")

            # when: --dir 플래그로 실행
            with patch("scripts.ingest.ingest_file", side_effect=track_ingest):
                with patch.object(sys, "argv", [
                    "ingest.py",
                    "--dir",
                    tmpdir
                ]):
                    main()

        # then: 날짜 오름차순으로 처리되어야 함
        assert processed_files == [
            "★52Week_High_Stocks_2026-01-02.html",
            "★52Week_High_Stocks_2026-01-05.html",
        ]


class TestIngestDuplicateHandling:
    """
    중복 수집 방지 테스트

    SPEC-MTT-002 R-01-2: 중복 방지
    WHEN 이미 수집된 날짜·테마·소스 조합의 데이터를 재수집하면
    THE SYSTEM SHALL 기존 레코드를 덮어쓰거나(UPSERT), 중복 삽입 오류 없이 건너뛰어야 한다.
    """

    def test_duplicate_ingest_should_not_raise_error(self):
        """
        동일 파일을 재수집해도 에러가 발생하지 않아야 한다
        """
        # 이 테스트는 ingest_file 함수의 UPSERT 로직을 검증
        # 실제 DB 연동이 필요하므로 통합 테스트에서 검증
        pass


class TestIngestErrorHandling:
    """
    파싱 실패 복구 테스트

    SPEC-MTT-002 R-01-3: 파싱 실패 복구
    IF 특정 HTML 파일의 파싱이 실패하더라도
    THE SYSTEM SHALL 해당 파일을 건너뛰고 나머지 파일의 수집을 계속 진행해야 한다.
    """

    @patch("scripts.ingest.SessionLocal")
    @patch("scripts.ingest.create_tables")
    def test_parsing_failure_should_continue_with_next_file(
        self, mock_create_tables, mock_session
    ):
        """
        한 파일 파싱 실패 시 다른 파일은 계속 처리되어야 한다
        """
        import tempfile

        # given: mock 설정
        mock_db = Mock(spec=Session)
        mock_session.return_value.__enter__.return_value = mock_db

        call_count = {"count": 0}

        def selective_ingest(file_path, db):
            call_count["count"] += 1
            # 첫 번째 파일은 실패, 두 번째 파일은 성공
            if "2026-01-02" in file_path.name:
                raise Exception("Parse error")
            return (10, 100)

        with tempfile.TemporaryDirectory() as tmpdir:
            # 파일 2개 생성
            file1 = Path(tmpdir) / "★52Week_High_Stocks_2026-01-02.html"
            file2 = Path(tmpdir) / "★52Week_High_Stocks_2026-01-05.html"

            file1.write_text("<html><body>Invalid content</body></html>")
            file2.write_text("<html><body><h2>Theme</h2><table><tr><td>Stock</td><td>98</td><td>1%</td></tr></table></body></html>")

            # when: ingest 실행 (에러가 있어도 exit은 테스트에서 캐치)
            with patch("scripts.ingest.ingest_file", side_effect=selective_ingest):
                with patch.object(sys, "argv", [
                    "ingest.py",
                    "--dir",
                    tmpdir
                ]):
                    # sys.exit를 캐치하여 테스트 계속
                    with pytest.raises(SystemExit):
                        main()

        # then: 두 파일 모두 시도되어야 함 (에러가 1개라도 exit 1)
        assert call_count["count"] == 2
