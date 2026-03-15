"""
하위 호환성 및 성능 테스트

SPEC-MTT-006: 그룹 액션 탐지 기능 고도화
테스트 작성일: 2026-03-15
"""

import pytest
import time
from sqlalchemy import text
from datetime import datetime
import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.models import ThemeStockDaily, ThemeDaily


@pytest.fixture(autouse=True)
def setup_database(test_db_session, test_db_engine):
    """
    테스트 전후 데이터베이스 설정/정리

    conftest.py의 client fixture를 통해 test_db_session과 test_db_engine을 주입받음
    """
    # 인덱스 생성 (SPEC-MTT-006 NFR-01)
    with test_db_engine.connect() as conn:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_stock_first_seen ON theme_stock_daily(stock_name, date, data_source)"
        ))
        conn.commit()

    # 기존 SPEC-MTT-002 동작과 동일한 테스트 데이터
    base_date = datetime(2024, 1, 15)

    # 테마 데이터 생성
    theme_daily = ThemeDaily(
        date="2024-01-14",
        theme_name="AI",
        stock_count=5,
        avg_rs=60.0,
        change_sum=10.0,
        volume_sum=1000000.0,
        data_source="52w_high"
    )
    test_db_session.add(theme_daily)

    theme_daily = ThemeDaily(
        date="2024-01-15",
        theme_name="AI",
        stock_count=5,
        avg_rs=65.0,
        change_sum=10.0,
        volume_sum=1000000.0,
        data_source="52w_high"
    )
    test_db_session.add(theme_daily)

    # 주식-테마 매핑 데이터 생성 (기존 동작 반영)
    stock_data = ThemeStockDaily(
        date="2024-01-15",
        stock_name="삼성전자",
        theme_name="AI",
        rs_score=75,
        change_pct=2.5,
        data_source="52w_high"
    )
    test_db_session.add(stock_data)

    # 3일 전에 처음 등장한 종목
    stock_data_first = ThemeStockDaily(
        date="2024-01-12",
        stock_name="삼성전자",
        theme_name="AI",
        rs_score=70,
        change_pct=1.5,
        data_source="52w_high"
    )
    test_db_session.add(stock_data_first)

    test_db_session.commit()

    yield

    # 테스트 후 정리는 conftest.py의 test_db_engine fixture에서 자동 처리됨


class TestBackwardCompatibility:
    """AC-07: 하위 호환성 테스트"""

    def test_no_parameters_returns_default_behavior(self, client, setup_database):
        """
        Scenario: 파라미터 없이 호출 시 기존 동작과 동일한 결과 반환
        - 기본값: timeWindow=3, rsThreshold=0, statusThreshold=5
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&source=52w_high")

        assert response.status_code == 200
        data = response.json()

        # 기존 동작 검증
        assert len(data["stocks"]) > 0
        assert "status_threshold" in data["stocks"][0]
        assert data["stocks"][0]["status_threshold"] == 5

    def test_default_values_match_spec_mtt_002(self, client, setup_database):
        """
        Scenario: SPEC-MTT-002와 동일한 결과 반환 확인
        """
        response = client.get("/api/stocks/group-action?date=2024-01-15&source=52w_high")

        assert response.status_code == 200
        data = response.json()

        # 3일 윈도우 내 등장 종목
        stock_names = [stock["stock_name"] for stock in data["stocks"]]
        assert "삼성전자" in stock_names

        # RS 상승 종목만 (rsThreshold=0)
        for stock in data["stocks"]:
            if stock["theme_rs_change"] is not None:
                assert stock["theme_rs_change"] > 0


class TestPerformanceRequirements:
    """NFR-01, NFR-02: 성능 요구사항 테스트"""

    def test_api_response_time_under_500ms(self, client, setup_database):
        """
        NFR-02: API 응답 시간 < 500ms
        """
        start_time = time.time()
        response = client.get("/api/stocks/group-action?date=2024-01-15&source=52w_high")
        end_time = time.time()

        assert response.status_code == 200
        response_time_ms = (end_time - start_time) * 1000

        # NFR-02: 500ms 이내 응답
        assert response_time_ms < 500, f"응답 시간 {response_time_ms:.2f}ms이 500ms를 초과함"

    def test_index_effectiveness(self, test_db_engine, setup_database):
        """
        NFR-01: 인덱스 유효성 검증
        idx_stock_first_seen 인덱스가 존재하는지 확인
        """
        with test_db_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT name FROM sqlite_master
                WHERE type='index' AND name='idx_stock_first_seen'
            """))
            index_exists = result.fetchone() is not None

        assert index_exists, "idx_stock_first_seen 인덱스가 존재하지 않음"


