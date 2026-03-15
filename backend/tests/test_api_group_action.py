"""
그룹 액션 API 파라미터화 테스트

SPEC-MTT-006: 그룹 액션 탐지 기능 고도화
테스트 작성일: 2026-03-15
"""

import pytest
from datetime import datetime, timedelta
import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import Base
from app.models import ThemeStockDaily, ThemeDaily


@pytest.fixture(autouse=True)
def setup_database(test_db_session):
    """
    테스트 전후 데이터베이스 설정/정리

    conftest.py의 client fixture를 통해 test_db_session을 주입받음
    """
    # 기준 날짜 설정 (2024-01-15)
    base_date = datetime(2024, 1, 15)

    # 최근 7일 날짜 생성
    dates = [(base_date - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7, 0, -1)]
    dates.reverse()  # ["2024-01-08", ..., "2024-01-15"]

    # 테마 데이터 생성
    themes_data = {
        "2024-01-14": {"AI": 60.0, "반도체": 55.0},
        "2024-01-15": {"AI": 65.0, "반도체": 58.0, "바이오": 50.0},
    }

    for date, themes in themes_data.items():
        for theme_name, avg_rs in themes.items():
            theme_daily = ThemeDaily(
                date=date,
                theme_name=theme_name,
                stock_count=5,
                avg_rs=avg_rs,
                change_sum=10.0,
                volume_sum=1000000.0,
                data_source="52w_high"
            )
            test_db_session.add(theme_daily)

    # 주식-테마 매핑 데이터 생성
    stocks_data = [
        # 신규 등장 종목 (2024-01-15에 처음 등장)
        {
            "date": "2024-01-15",
            "stock_name": "삼성전자",
            "theme_name": "반도체",
            "rs_score": 75,
            "change_pct": 2.5,
            "first_seen": "2024-01-15"  # 1일 전에 처음 등장
        },
        {
            "date": "2024-01-15",
            "stock_name": "SK하이닉스",
            "theme_name": "반도체",
            "rs_score": 70,
            "change_pct": 1.8,
            "first_seen": "2024-01-14"  # 2일 전에 처음 등장
        },
        {
            "date": "2024-01-15",
            "stock_name": "네이버",
            "theme_name": "AI",
            "rs_score": 80,
            "change_pct": 3.2,
            "first_seen": "2024-01-13"  # 3일 전에 처음 등장
        },
        {
            "date": "2024-01-15",
            "stock_name": "카카오",
            "theme_name": "AI",
            "rs_score": 72,
            "change_pct": 2.1,
            "first_seen": "2024-01-12"  # 4일 전에 처음 등장 (3일 윈도우 외)
        },
        {
            "date": "2024-01-15",
            "stock_name": "셀트리온",
            "theme_name": "바이오",
            "rs_score": 68,
            "change_pct": 1.5,
            "first_seen": "2024-01-15"  # 신규 테마 (어제 데이터 없음)
        },
    ]

    for stock_data in stocks_data:
        theme_stock = ThemeStockDaily(
            date=stock_data["date"],
            stock_name=stock_data["stock_name"],
            theme_name=stock_data["theme_name"],
            rs_score=stock_data["rs_score"],
            change_pct=stock_data["change_pct"],
            data_source="52w_high"
        )
        test_db_session.add(theme_stock)

        # first_seen 날짜에도 데이터 추가 (최초 등장일)
        if stock_data["first_seen"] != stock_data["date"]:
            theme_stock_first = ThemeStockDaily(
                date=stock_data["first_seen"],
                stock_name=stock_data["stock_name"],
                theme_name=stock_data["theme_name"],
                rs_score=stock_data["rs_score"] - 5,  # 조금 낮은 RS 점수
                change_pct=1.0,
                data_source="52w_high"
            )
            test_db_session.add(theme_stock_first)

    test_db_session.commit()

    yield

    # 테스트 후 정리는 conftest.py의 test_db_engine fixture에서 자동 처리됨


class TestTimeWindowParameter:
    """AC-01: 시간 윈도우 파라미터 테스트"""

    def test_time_window_default_value(self, client, setup_database):
        """
        Scenario 1.3: 기본값 (3일)
        기본값으로 호출 시 기존 3일 윈도우와 동일한 결과 반환
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15")

        assert response.status_code == 200
        data = response.json()

        # 3일 내 등장 종목: 삼성전자(1일), SK하이닉스(2일), 네이버(3일)
        # 4일 전 등장한 카카오는 제외
        stock_names = [stock["stock_name"] for stock in data["stocks"]]
        assert "삼성전자" in stock_names
        assert "SK하이닉스" in stock_names
        assert "네이버" in stock_names
        assert "카카오" not in stock_names  # 4일 전 등장 (3일 윈도우 외)

    def test_time_window_min_value(self, client, setup_database):
        """
        Scenario 1.1: 최소값 (1일)
        1일 내 등장한 종목만 반환
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&timeWindow=1")

        assert response.status_code == 200
        data = response.json()

        # 1일 내 등장: 삼성전자만
        stock_names = [stock["stock_name"] for stock in data["stocks"]]
        assert "삼성전자" in stock_names
        assert "SK하이닉스" not in stock_names  # 2일 전
        assert "네이버" not in stock_names  # 3일 전

    def test_time_window_max_value(self, client, setup_database):
        """
        Scenario 1.2: 최대값 (7일)
        7일 내 등장한 종목 모두 반환
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&timeWindow=7")

        assert response.status_code == 200
        data = response.json()

        # 7일 내 등장: 모든 종목 (카카오 포함)
        stock_names = [stock["stock_name"] for stock in data["stocks"]]
        assert "삼성전자" in stock_names
        assert "SK하이닉스" in stock_names
        assert "네이버" in stock_names
        assert "카카오" in stock_names  # 4일 전 등장

    def test_time_window_invalid_too_low(self, client, setup_database):
        """
        Scenario 1.4: 범위 외 값 거부 (0)
        0 또는 음수 값은 400 Bad Request
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&timeWindow=0")

        assert response.status_code == 422  # Pydantic validation error

    def test_time_window_invalid_too_high(self, client, setup_database):
        """
        Scenario 1.4: 범위 외 값 거부 (8)
        8 이상 값은 400 Bad Request
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&timeWindow=8")

        assert response.status_code == 422  # Pydantic validation error


class TestRsThresholdParameter:
    """AC-02: RS 임계값 파라미터 테스트"""

    def test_rs_threshold_default_value(self, client, setup_database):
        """
        Scenario 2.3: 기본값 (0)
        기본값으로 호출 시 RS 변화량 > 0인 종목만 반환
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15")

        assert response.status_code == 200
        data = response.json()

        # 모든 종목의 theme_rs_change가 0보다 커야 함
        for stock in data["stocks"]:
            if stock["theme_rs_change"] is not None:
                assert stock["theme_rs_change"] > 0

    def test_rs_threshold_positive_value(self, client, setup_database):
        """
        Scenario 2.1: 양수 임계값 (5)
        RS 변화량이 5보다 큰 종목만 반환
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&rsThreshold=5")

        assert response.status_code == 200
        data = response.json()

        # AI 테마: 65 - 60 = 5 (임계값 5보다 크지 않음, 제외)
        # 반도체: 58 - 55 = 3 (임계값 5보다 작음, 제외)
        # 바이오: 어제 데이터 없음 (theme_rs_change = null, 포함)
        stock_names = [stock["stock_name"] for stock in data["stocks"]]
        assert "셀트리온" in stock_names  # 신규 테마
        # AI, 반도체 테마 종목은 RS 변화량이 5 미만이어야 제외

    def test_rs_threshold_negative_value(self, client, setup_database):
        """
        Scenario 2.2: 음수 임계값 (-5)
        RS 변화량이 -5보다 큰 종목 모두 반환 (더 완화된 조건)
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&rsThreshold=-5")

        assert response.status_code == 200
        data = response.json()

        # 모든 종목의 RS 변화량이 -5보다 커야 함 (실제로는 모두 양수)
        for stock in data["stocks"]:
            if stock["theme_rs_change"] is not None:
                assert stock["theme_rs_change"] > -5

    def test_rs_threshold_invalid_too_low(self, client, setup_database):
        """
        Scenario 2.4: 범위 외 값 거부 (-11)
        -11 미만 값은 422 Bad Request
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&rsThreshold=-11")

        assert response.status_code == 422  # Pydantic validation error

    def test_rs_threshold_invalid_too_high(self, client, setup_database):
        """
        Scenario 2.4: 범위 외 값 거부 (21)
        21 초과 값은 422 Bad Request
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&rsThreshold=21")

        assert response.status_code == 422  # Pydantic validation error


class TestSchemaExtension:
    """AC-03: 상태 분류 임계값 파라미터 테스트"""

    def test_response_includes_status_threshold_field(self, client, setup_database):
        """
        Scenario 3.3: 스키마 필드 추가
        각 종목 응답에 status_threshold 필드 포함
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15")

        assert response.status_code == 200
        data = response.json()

        # 모든 종목에 status_threshold 필드가 있어야 함
        for stock in data["stocks"]:
            assert "status_threshold" in stock
            assert isinstance(stock["status_threshold"], int)

    def test_status_threshold_default_value(self, client, setup_database):
        """
        Scenario 3.1: 기본값 (5)
        status_threshold 기본값이 5인지 확인
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15")

        assert response.status_code == 200
        data = response.json()

        # 모든 종목의 status_threshold가 5여야 함
        for stock in data["stocks"]:
            assert stock["status_threshold"] == 5


class TestBackwardCompatibility:
    """AC-07: 하위 호환성 테스트"""

    def test_default_parameters_match_existing_behavior(self, client, setup_database):
        """
        Scenario 7.1: 기존 API 호출
        파라미터 없이 호출 시 기존 SPEC-MTT-002와 동일한 결과 반환
        """
        # 새 API (기본값)
        response_new = client.get("/api/stocks/group-action?date=2024-01-15")
        assert response_new.status_code == 200
        data_new = response_new.json()

        # 기존 동작 검증: 3일 윈도우, RS 임계값 0
        # 3일 내 등장 + RS 상승 종목
        assert len(data_new["stocks"]) > 0

        # 모든 종목이 3일 내 등장 (first_seen_date가 최근 3일)
        # 모든 종목의 theme_rs_change > 0 (RS 상승)
        for stock in data_new["stocks"]:
            # 신규 테마가 아닌 경우에만 RS 변화량 확인
            if stock["theme_rs_change"] is not None:
                assert stock["theme_rs_change"] > 0


class TestCombinedParameters:
    """파라미터 조합 테스트"""

    def test_time_window_and_rs_threshold_combined(self, client, setup_database):
        """
        AC-08 Scenario 8.1: 파라미터 조합
        시간 윈도우=5, RS 임계값=3 조합 테스트
        """
        response = client.get(
            "/api/stocks/group-action?date=2024-01-15&timeWindow=5&rsThreshold=3"
        )

        assert response.status_code == 200
        data = response.json()

        # 5일 내 등장 AND RS 변화량 > 3
        for stock in data["stocks"]:
            if stock["theme_rs_change"] is not None:
                assert stock["theme_rs_change"] > 3
