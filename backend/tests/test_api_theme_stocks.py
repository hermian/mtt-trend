"""
/api/themes/{name}/stocks 엔드포인트 테스트

SPEC-MTT-013 F-01: 테마 종목 목록 API
- R-01-1: 테마별 종목 목록 반환
- R-01-2: RS 점수 내림차순 정렬
- R-01-3: 날짜 미지정 시 최신 날짜 반환
"""

import pytest
from pathlib import Path
import sys

# 프로젝트 루트를 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.models import ThemeStockDaily, ThemeDaily, SOURCE_52W, SOURCE_MTT


@pytest.fixture
def sample_theme_stocks(test_db_session):
    """테스트용 샘플 데이터 생성"""
    # ThemeDaily 데이터 (최신 날짜 확인용)
    test_db_session.add(ThemeDaily(
        date="2026-03-12",
        theme_name="AI테마",
        data_source=SOURCE_52W,
        stock_count=3,
        avg_rs=85.0,
    ))
    test_db_session.add(ThemeDaily(
        date="2026-03-11",
        theme_name="AI테마",
        data_source=SOURCE_52W,
        stock_count=2,
        avg_rs=80.0,
    ))

    # ThemeStockDaily 데이터
    stocks = [
        # 2026-03-12 AI테마 종목들
        ThemeStockDaily(
            date="2026-03-12",
            theme_name="AI테마",
            stock_name="삼성전자",
            data_source=SOURCE_52W,
            rs_score=95,
            change_pct=2.5,
        ),
        ThemeStockDaily(
            date="2026-03-12",
            theme_name="AI테마",
            stock_name="SK하이닉스",
            data_source=SOURCE_52W,
            rs_score=90,
            change_pct=1.8,
        ),
        ThemeStockDaily(
            date="2026-03-12",
            theme_name="AI테마",
            stock_name="NAVER",
            data_source=SOURCE_52W,
            rs_score=85,
            change_pct=1.2,
        ),
        # 2026-03-11 AI테마 종목들
        ThemeStockDaily(
            date="2026-03-11",
            theme_name="AI테마",
            stock_name="삼성전자",
            data_source=SOURCE_52W,
            rs_score=92,
            change_pct=2.0,
        ),
        ThemeStockDaily(
            date="2026-03-11",
            theme_name="AI테마",
            stock_name="SK하이닉스",
            data_source=SOURCE_52W,
            rs_score=88,
            change_pct=1.5,
        ),
    ]

    for stock in stocks:
        test_db_session.add(stock)

    test_db_session.commit()


class TestGetThemeStocksEndpoint:
    """
    /api/themes/{name}/stocks 엔드포인트 테스트

    SPEC-MTT-013 R-01-1: 테마별 종목 목록 반환
    WHEN 클라이언트가 `GET /api/themes/{name}/stocks?date={date}` 를 호출하면
    THE SYSTEM SHALL 해당 테마와 날짜의 종목 목록을 반환해야 한다.
    """

    def test_get_theme_stocks_returns_stocks_for_date(self, client, sample_theme_stocks):
        """
        지정된 날짜의 테마 종목 목록을 반환해야 한다
        """
        # when
        response = client.get("/api/themes/AI테마/stocks?date=2026-03-12")

        # then
        assert response.status_code == 200
        data = response.json()
        assert data["theme_name"] == "AI테마"
        assert data["date"] == "2026-03-12"
        assert len(data["stocks"]) == 3
        assert data["stocks"][0]["stock_name"] == "삼성전자"
        assert data["stocks"][0]["rs_score"] == 95

    def test_get_theme_stocks_sorted_by_rs_score_descending(self, client, sample_theme_stocks):
        """
        SPEC-MTT-013 R-01-2: RS 점수 내림차순 정렬
        종목 목록은 RS 점수 내림차순으로 정렬되어야 한다
        """
        # when
        response = client.get("/api/themes/AI테마/stocks?date=2026-03-12")

        # then
        assert response.status_code == 200
        data = response.json()
        stocks = data["stocks"]
        assert len(stocks) == 3
        assert stocks[0]["rs_score"] >= stocks[1]["rs_score"] >= stocks[2]["rs_score"]
        assert stocks[0]["stock_name"] == "삼성전자"  # RS 95
        assert stocks[1]["stock_name"] == "SK하이닉스"  # RS 90
        assert stocks[2]["stock_name"] == "NAVER"  # RS 85

    def test_get_theme_stocks_default_to_latest_date(self, client, sample_theme_stocks):
        """
        SPEC-MTT-013 R-01-3: 날짜 미지정 시 최신 날짜 반환
        date 파라미터를 생략하면 최신 날짜의 데이터를 반환해야 한다
        """
        # when
        response = client.get("/api/themes/AI테마/stocks")

        # then
        assert response.status_code == 200
        data = response.json()
        assert data["date"] == "2026-03-12"  # 최신 날짜
        assert len(data["stocks"]) == 3

    def test_get_theme_stocks_404_for_unknown_theme(self, client, sample_theme_stocks):
        """
        존재하지 않는 테마에 대해서는 404 에러를 반환해야 한다
        """
        # when
        response = client.get("/api/themes/알수없는테마/stocks?date=2026-03-12")

        # then
        assert response.status_code == 404
        assert "No stocks found for theme" in response.json()["detail"]

    def test_get_theme_stocks_404_for_unknown_date(self, client, sample_theme_stocks):
        """
        존재하지 않는 날짜에 대해서는 404 에러를 반환해야 한다
        """
        # when
        response = client.get("/api/themes/AI테마/stocks?date=2025-01-01")

        # then
        assert response.status_code == 404
        assert "No stocks found for theme" in response.json()["detail"]

    def test_get_theme_stocks_with_source_parameter(self, client, sample_theme_stocks, test_db_session):
        """
        source 파라미터로 데이터 소스를 필터링해야 한다
        """
        # given: mtt 소스 데이터 추가
        test_db_session.add(ThemeStockDaily(
            date="2026-03-12",
            theme_name="AI테마",
            stock_name="카카오",
            data_source=SOURCE_MTT,
            rs_score=80,
            change_pct=1.0,
        ))
        test_db_session.commit()

        # when: 52w_high 소스 조회
        response = client.get("/api/themes/AI테마/stocks?date=2026-03-12&source=52w_high")

        # then: mtt 소스 데이터는 제외되어야 함
        assert response.status_code == 200
        data = response.json()
        assert len(data["stocks"]) == 3
        stock_names = [s["stock_name"] for s in data["stocks"]]
        assert "카카오" not in stock_names

    def test_get_theme_stocks_handles_theme_name_with_special_chars(self, client, test_db_session):
        """
        테마 이름에 특수 문자가 포함된 경우에도 정상적으로 처리해야 한다
        """
        # given
        test_db_session.add(ThemeDaily(
            date="2026-03-12",
            theme_name="AI/반도체",
            data_source=SOURCE_52W,
            stock_count=1,
            avg_rs=85.0,
        ))
        test_db_session.add(ThemeStockDaily(
            date="2026-03-12",
            theme_name="AI/반도체",
            stock_name="삼성전자",
            data_source=SOURCE_52W,
            rs_score=95,
            change_pct=2.5,
        ))
        test_db_session.commit()

        # when
        response = client.get("/api/themes/AI/반도체/stocks?date=2026-03-12")

        # then
        assert response.status_code == 200
        data = response.json()
        assert data["theme_name"] == "AI/반도체"
        assert len(data["stocks"]) == 1

    def test_get_theme_stocks_returns_null_rs_score_last(self, client, test_db_session):
        """
        RS 점수가 없는 종목은 목록 마지막에 배치되어야 한다
        """
        # given
        test_db_session.add(ThemeDaily(
            date="2026-03-12",
            theme_name="테마X",
            data_source=SOURCE_52W,
            stock_count=3,
            avg_rs=85.0,
        ))
        test_db_session.add(ThemeStockDaily(
            date="2026-03-12",
            theme_name="테마X",
            stock_name="종목A",
            data_source=SOURCE_52W,
            rs_score=90,
            change_pct=2.0,
        ))
        test_db_session.add(ThemeStockDaily(
            date="2026-03-12",
            theme_name="테마X",
            stock_name="종목B",
            data_source=SOURCE_52W,
            rs_score=None,
            change_pct=1.0,
        ))
        test_db_session.add(ThemeStockDaily(
            date="2026-03-12",
            theme_name="테마X",
            stock_name="종목C",
            data_source=SOURCE_52W,
            rs_score=80,
            change_pct=1.5,
        ))
        test_db_session.commit()

        # when
        response = client.get("/api/themes/테마X/stocks?date=2026-03-12")

        # then
        assert response.status_code == 200
        data = response.json()
        stocks = data["stocks"]
        assert len(stocks) == 3
        assert stocks[0]["stock_name"] == "종목A"  # RS 90
        assert stocks[1]["stock_name"] == "종목C"  # RS 80
        assert stocks[2]["stock_name"] == "종목B"  # RS None (last)
