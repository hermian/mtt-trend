"""
교집합 추천 API 테스트 (SPEC-MTT-012)

교집합 추천 기능: 52주 신고가(52w_high)와 MTT 두 데이터 소스에서
같은 날짜에 함께 등장하는 테마와 종목을 찾아 신뢰도 높은 추천을 제공합니다.

테스트 작성일: 2026-03-15
"""

import pytest
from pathlib import Path
import sys

# 프로젝트 루트를 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# ruff: noqa: E402
from app.models import ThemeDaily, ThemeStockDaily, SOURCE_52W, SOURCE_MTT


@pytest.fixture
def intersection_data(test_db_session):
    """
    교집합 테스트용 샘플 데이터 생성

    데이터 구조:
    - 2024-01-15: 두 소스 모두에 데이터가 있음 (교집합 존재)
      - 공통 테마: "AI", "반도체"
      - 공통 종목: "삼성전자", "SK하이닉스"
    - 2024-01-14: 52w_high만 데이터가 있음
    - 2024-01-16: MTT만 데이터가 있음
    """
    # 2024-01-15: 두 소스 모두 데이터 존재 (교집합 타겟)
    # ThemeDaily 데이터
    test_db_session.add(ThemeDaily(
        date="2024-01-15",
        theme_name="AI",
        data_source=SOURCE_52W,
        stock_count=5,
        avg_rs=85.0,
    ))
    test_db_session.add(ThemeDaily(
        date="2024-01-15",
        theme_name="AI",
        data_source=SOURCE_MTT,
        stock_count=3,
        avg_rs=82.0,
    ))
    test_db_session.add(ThemeDaily(
        date="2024-01-15",
        theme_name="반도체",
        data_source=SOURCE_52W,
        stock_count=4,
        avg_rs=78.0,
    ))
    test_db_session.add(ThemeDaily(
        date="2024-01-15",
        theme_name="반도체",
        data_source=SOURCE_MTT,
        stock_count=2,
        avg_rs=75.0,
    ))
    test_db_session.add(ThemeDaily(
        date="2024-01-15",
        theme_name="바이오",
        data_source=SOURCE_52W,
        stock_count=3,
        avg_rs=70.0,
    ))
    test_db_session.add(ThemeDaily(
        date="2024-01-15",
        theme_name="에너지",
        data_source=SOURCE_MTT,
        stock_count=2,
        avg_rs=72.0,
    ))

    # ThemeStockDaily 데이터 (AI 테마 - 교집합 종목)
    test_db_session.add(ThemeStockDaily(
        date="2024-01-15",
        theme_name="AI",
        stock_name="삼성전자",
        data_source=SOURCE_52W,
        rs_score=90,
        change_pct=2.5,
    ))
    test_db_session.add(ThemeStockDaily(
        date="2024-01-15",
        theme_name="AI",
        stock_name="삼성전자",
        data_source=SOURCE_MTT,
        rs_score=88,
        change_pct=2.3,
    ))
    test_db_session.add(ThemeStockDaily(
        date="2024-01-15",
        theme_name="AI",
        stock_name="SK하이닉스",
        data_source=SOURCE_52W,
        rs_score=85,
        change_pct=1.8,
    ))
    test_db_session.add(ThemeStockDaily(
        date="2024-01-15",
        theme_name="AI",
        stock_name="SK하이닉스",
        data_source=SOURCE_MTT,
        rs_score=83,
        change_pct=1.6,
    ))
    test_db_session.add(ThemeStockDaily(
        date="2024-01-15",
        theme_name="AI",
        stock_name="네이버",
        data_source=SOURCE_52W,
        rs_score=80,
        change_pct=1.2,
    ))
    test_db_session.add(ThemeStockDaily(
        date="2024-01-15",
        theme_name="AI",
        stock_name="카카오",
        data_source=SOURCE_MTT,
        rs_score=78,
        change_pct=1.0,
    ))

    # ThemeStockDaily 데이터 (반도체 테마 - 교집합 종목)
    test_db_session.add(ThemeStockDaily(
        date="2024-01-15",
        theme_name="반도체",
        stock_name="SK하이닉스",
        data_source=SOURCE_52W,
        rs_score=82,
        change_pct=1.5,
    ))
    test_db_session.add(ThemeStockDaily(
        date="2024-01-15",
        theme_name="반도체",
        stock_name="SK하이닉스",
        data_source=SOURCE_MTT,
        rs_score=80,
        change_pct=1.3,
    ))

    # 2024-01-14: 52w_high만 데이터 존재
    test_db_session.add(ThemeDaily(
        date="2024-01-14",
        theme_name="자동차",
        data_source=SOURCE_52W,
        stock_count=2,
        avg_rs=65.0,
    ))

    # 2024-01-16: MTT만 데이터 존재
    test_db_session.add(ThemeDaily(
        date="2024-01-16",
        theme_name="통신",
        data_source=SOURCE_MTT,
        stock_count=1,
        avg_rs=68.0,
    ))

    test_db_session.commit()


class TestIntersectionReturnsCommonThemes:
    """
    REQ-MTT-012-02: 교집합 테마 응답 스키마

    WHEN 사용자가 특정 날짜의 교집합을 요청하면
    THE SYSTEM SHALL 두 데이터 소스(52w_high, mtt)에 모두 존재하는 테마와 종목을 반환해야 한다.
    """

    def test_intersection_returns_only_themes_in_both_sources(self, client, intersection_data):
        """
        두 소스 모두에 존재하는 테마만 반환해야 한다

        given: 2024-01-15에
          - AI, 반도체: 두 소스 모두 존재
          - 바이오: 52w_high만 존재
          - 에너지: MTT만 존재
        when: 교집합 API 호출
        then: AI, 반도체만 반환 (바이오, 에너지 제외)
        """
        # when
        response = client.get("/api/stocks/intersection?date=2024-01-15")

        # then
        assert response.status_code == 200
        data = response.json()

        # 응답 구조 검증
        assert "date" in data
        assert "theme_count" in data
        assert "total_stock_count" in data
        assert "themes" in data

        # 교집합 테마만 포함되어야 함
        theme_names = [theme["theme_name"] for theme in data["themes"]]
        assert "AI" in theme_names
        assert "반도체" in theme_names
        assert "바이오" not in theme_names  # 52w_high만 존재
        assert "에너지" not in theme_names  # MTT만 존재

        # 테마 수는 2개여야 함
        assert data["theme_count"] == 2

    def test_intersection_includes_common_stocks_for_each_theme(self, client, intersection_data):
        """
        각 테마에 대해 두 소스 모두에 존재하는 종목만 포함해야 한다

        given: AI 테마의 경우
          - 삼성전자, SK하이닉스: 두 소스 모두 존재
          - 네이버: 52w_high만 존재
          - 카카오: MTT만 존재
        when: 교집합 API 호출
        then: intersection_stocks에 삼성전자, SK하이닉스만 포함
        """
        # when
        response = client.get("/api/stocks/intersection?date=2024-01-15")

        # then
        assert response.status_code == 200
        data = response.json()

        # AI 테마 찾기
        ai_theme = next((t for t in data["themes"] if t["theme_name"] == "AI"), None)
        assert ai_theme is not None

        # 교집합 종목 검증
        assert "intersection_stocks" in ai_theme
        stock_names = [stock["stock_name"] for stock in ai_theme["intersection_stocks"]]
        assert "삼성전자" in stock_names
        assert "SK하이닉스" in stock_names
        assert "네이버" not in stock_names  # 52w_high만 존재
        assert "카카오" not in stock_names  # MTT만 존재

        # 교집합 종목 수
        assert ai_theme["intersection_stock_count"] == 2

    def test_intersection_includes_rs_scores_from_both_sources(self, client, intersection_data):
        """
        각 교집합 종목에 대해 두 소스의 RS 점수를 모두 포함해야 한다

        given: 삼성전자의 경우
          - 52w_high: rs_score=90
          - MTT: rs_score=88
        when: 교집합 API 호출
        then: rs_score_52w=90, rs_score_mtt=88 포함
        """
        # when
        response = client.get("/api/stocks/intersection?date=2024-01-15")

        # then
        assert response.status_code == 200
        data = response.json()

        # AI 테마 찾기
        ai_theme = next((t for t in data["themes"] if t["theme_name"] == "AI"), None)
        assert ai_theme is not None

        # 삼성전자 찾기
        samsung = next(
            (s for s in ai_theme["intersection_stocks"] if s["stock_name"] == "삼성전자"),
            None
        )
        assert samsung is not None

        # RS 점수 검증
        assert "rs_score_52w" in samsung
        assert "rs_score_mtt" in samsung
        assert samsung["rs_score_52w"] == 90
        assert samsung["rs_score_mtt"] == 88

        # change_pct도 포함되어야 함
        assert "change_pct_52w" in samsung
        assert "change_pct_mtt" in samsung
        assert samsung["change_pct_52w"] == 2.5
        assert samsung["change_pct_mtt"] == 2.3

    def test_intersection_calculates_average_rs_scores(self, client, intersection_data):
        """
        각 테마에 대해 교집합 종목들의 평균 RS 점수를 계산해야 한다

        given: AI 테마의 교집합 종목
          - 삼성전자: 52w=90, MTT=88
          - SK하이닉스: 52w=85, MTT=83
        when: 교집합 API 호출
        then: avg_rs_52w=(90+85)/2=87.5, avg_rs_mtt=(88+83)/2=85.5
        """
        # when
        response = client.get("/api/stocks/intersection?date=2024-01-15")

        # then
        assert response.status_code == 200
        data = response.json()

        # AI 테마 찾기
        ai_theme = next((t for t in data["themes"] if t["theme_name"] == "AI"), None)
        assert ai_theme is not None

        # 평균 RS 점수 검증
        assert "avg_rs_52w" in ai_theme
        assert "avg_rs_mtt" in ai_theme
        assert ai_theme["avg_rs_52w"] == 87.5
        assert ai_theme["avg_rs_mtt"] == 85.5

    def test_intersection_includes_stock_counts_from_both_sources(self, client, intersection_data):
        """
        각 테마에 대해 두 소스의 전체 종목 수를 포함해야 한다

        given: AI 테마의 경우
          - 52w_high: 3개 종목 (삼성전자, SK하이닉스, 네이버)
          - MTT: 3개 종목 (삼성전자, SK하이닉스, 카카오)
        when: 교집합 API 호출
        then: stock_count_52w=3, stock_count_mtt=3
        """
        # when
        response = client.get("/api/stocks/intersection?date=2024-01-15")

        # then
        assert response.status_code == 200
        data = response.json()

        # AI 테마 찾기
        ai_theme = next((t for t in data["themes"] if t["theme_name"] == "AI"), None)
        assert ai_theme is not None

        # 종목 수 검증
        assert "stock_count_52w" in ai_theme
        assert "stock_count_mtt" in ai_theme
        assert ai_theme["stock_count_52w"] == 3
        assert ai_theme["stock_count_mtt"] == 3


class TestIntersectionUsesLatestCommonDate:
    """
    REQ-MTT-012-04: 기본 날짜 처리

    WHEN 사용자가 날짜를 지정하지 않으면
    THE SYSTEM SHALL 두 소스 모두에 데이터가 있는 가장 최신 날짜를 사용해야 한다.
    """

    def test_intersection_uses_latest_date_with_data_in_both_sources(self, client, intersection_data):
        """
        날짜 파라미터 없이 호출하면 두 소스 모두에 데이터가 있는 가장 최신 날짜를 사용해야 한다

        given:
          - 2024-01-14: 52w_high만 데이터 존재
          - 2024-01-15: 두 소스 모두 데이터 존재
          - 2024-01-16: MTT만 데이터 존재
        when: 날짜 없이 교집합 API 호출
        then: 2024-01-15 사용 (두 소스 모두에 데이터가 있는 가장 최신 날짜)
        """
        # when
        response = client.get("/api/stocks/intersection")

        # then
        assert response.status_code == 200
        data = response.json()

        # 2024-01-15 사용되어야 함
        assert data["date"] == "2024-01-15"
        assert data["theme_count"] == 2  # AI, 반도체


class TestIntersectionSortedByStockCount:
    """
    REQ-MTT-012-03: 정렬 순서

    WHEN 교집합 테마를 반환할 때
    THE SYSTEM SHALL 교집합 종목 수 내림차순으로 정렬해야 한다.
    """

    def test_intersection_sorted_by_intersection_stock_count_descending(self, client, intersection_data):
        """
        교집합 종목 수가 많은 순서대로 정렬되어야 한다

        given:
          - AI 테마: 교집합 2개 (삼성전자, SK하이닉스)
          - 반도체 테마: 교집합 1개 (SK하이닉스)
        when: 교집합 API 호출
        then: AI(2개) → 반도체(1개) 순서
        """
        # when
        response = client.get("/api/stocks/intersection?date=2024-01-15")

        # then
        assert response.status_code == 200
        data = response.json()

        # 정렬 순서 검증
        theme_names = [theme["theme_name"] for theme in data["themes"]]
        assert theme_names == ["AI", "반도체"]

        # 교집합 종목 수 검증
        assert data["themes"][0]["intersection_stock_count"] == 2
        assert data["themes"][1]["intersection_stock_count"] == 1


class TestIntersectionEmptyWhenNoCommonData:
    """
    REQ-MTT-012-05: 빈 결과 처리

    WHEN 교집합 데이터가 없으면
    THE SYSTEM SHALL 빈 배열과 theme_count=0를 반환해야 한다 (status 200).
    """

    def test_intersection_returns_empty_when_no_common_themes(self, test_db_session, client):
        """
        두 소스에 공통 테마가 없으면 빈 결과를 반환해야 한다

        given:
          - 2024-01-14: 52w_high만 데이터 (자동차 테마)
          - 2024-01-16: MTT만 데이터 (통신 테마)
        when: 2024-01-14 날짜로 교집합 API 호출
        then: 빈 themes 배열, theme_count=0
        """
        # when: 존재하지 않는 날짜로 호출
        response = client.get("/api/stocks/intersection?date=2024-01-14")

        # then
        assert response.status_code == 200
        data = response.json()

        assert data["date"] == "2024-01-14"
        assert data["theme_count"] == 0
        assert data["total_stock_count"] == 0
        assert data["themes"] == []

    def test_intersection_returns_empty_for_nonexistent_date(self, client, intersection_data):
        """
        데이터가 없는 날짜로 호출하면 빈 결과를 반환해야 한다

        when: 존재하지 않는 날짜 (2025-01-01)로 호출
        then: 빈 themes 배열, theme_count=0
        """
        # when
        response = client.get("/api/stocks/intersection?date=2025-01-01")

        # then
        assert response.status_code == 200
        data = response.json()

        assert data["date"] == "2025-01-01"
        assert data["theme_count"] == 0
        assert data["total_stock_count"] == 0
        assert data["themes"] == []


class TestIntersectionResponseSchema:
    """
    REQ-MTT-012-02: 응답 스키마 검증

    WHEN 교집합 API를 호출하면
    THE SYSTEM SHALL 정의된 스키마를 준수하는 응답을 반환해야 한다.
    """

    def test_intersection_response_schema_compliance(self, client, intersection_data):
        """
        응답 스키마가 정의된 형식을 준수해야 한다

        IntersectionResponse:
          - date: str
          - theme_count: int
          - total_stock_count: int
          - themes: List[IntersectionThemeItem]

        IntersectionThemeItem:
          - theme_name: str
          - intersection_stock_count: int
          - avg_rs_52w: float
          - avg_rs_mtt: float
          - stock_count_52w: int
          - stock_count_mtt: int
          - intersection_stocks: List[IntersectionStockItem]

        IntersectionStockItem:
          - stock_name: str
          - rs_score_52w: int
          - rs_score_mtt: int
          - change_pct_52w: float
          - change_pct_mtt: float
        """
        # when
        response = client.get("/api/stocks/intersection?date=2024-01-15")

        # then
        assert response.status_code == 200
        data = response.json()

        # 최상위 응답 필드
        assert isinstance(data["date"], str)
        assert isinstance(data["theme_count"], int)
        assert isinstance(data["total_stock_count"], int)
        assert isinstance(data["themes"], list)

        # 테마 아이템 필드
        for theme in data["themes"]:
            assert isinstance(theme["theme_name"], str)
            assert isinstance(theme["intersection_stock_count"], int)
            assert isinstance(theme["avg_rs_52w"], float)
            assert isinstance(theme["avg_rs_mtt"], float)
            assert isinstance(theme["stock_count_52w"], int)
            assert isinstance(theme["stock_count_mtt"], int)
            assert isinstance(theme["intersection_stocks"], list)

            # 종목 아이템 필드
            for stock in theme["intersection_stocks"]:
                assert isinstance(stock["stock_name"], str)
                assert isinstance(stock["rs_score_52w"], int)
                assert isinstance(stock["rs_score_mtt"], int)
                assert isinstance(stock["change_pct_52w"], float)
                assert isinstance(stock["change_pct_mtt"], float)

    def test_intersection_calculates_total_stock_count(self, client, intersection_data):
        """
        total_stock_count는 모든 테마의 교집합 종목 수 합계여야 한다

        given:
          - AI 테마: 교집합 2개
          - 반도체 테마: 교집합 1개 (SK하이닉스 중복 제외)
        when: 교집합 API 호출
        then: total_stock_count = 2 + 1 = 3
        """
        # when
        response = client.get("/api/stocks/intersection?date=2024-01-15")

        # then
        assert response.status_code == 200
        data = response.json()

        # 전체 종목 수는 각 테마의 교집합 종목 수 합계
        expected_total = sum(t["intersection_stock_count"] for t in data["themes"])
        assert data["total_stock_count"] == expected_total
