"""
/api/dates 엔드포인트 테스트

SPEC-MTT-002 F-02: 날짜 목록 API
- R-02-1: 소스별 날짜 목록 반환
- R-02-2: 프론트엔드 날짜 초기화
"""

import pytest
from pathlib import Path
import sys

# 프로젝트 루트를 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.models import ThemeDaily, SOURCE_52W, SOURCE_MTT


@pytest.fixture
def sample_data(test_db_session):
    """테스트용 샘플 데이터 생성"""
    # 52w_high 소스 데이터
    for date in ["2026-03-10", "2026-03-11", "2026-03-12"]:
        test_db_session.add(ThemeDaily(
            date=date,
            theme_name=f"테마_{date}",
            data_source=SOURCE_52W,
            stock_count=10,
            avg_rs=85.0,
        ))

    # mtt 소스 데이터
    for date in ["2026-03-11", "2026-03-12", "2026-03-13"]:
        test_db_session.add(ThemeDaily(
            date=date,
            theme_name=f"테마_{date}",
            data_source=SOURCE_MTT,
            stock_count=5,
            avg_rs=80.0,
        ))

    test_db_session.commit()


class TestListDatesEndpoint:
    """
    /api/dates 엔드포인트 테스트

    SPEC-MTT-002 R-02-1: 소스별 날짜 목록 반환
    WHEN 클라이언트가 `GET /api/dates?source={source}` 를 호출하면
    THE SYSTEM SHALL 해당 소스에 수집된 날짜 목록을 내림차순(최신순)으로 반환해야 한다.
    """

    def test_list_dates_returns_52w_high_dates(self, client, sample_data):
        """
        52w_high 소스의 날짜 목록을 반환해야 한다
        """
        # when
        response = client.get("/api/dates?source=52w_high")

        # then
        assert response.status_code == 200
        data = response.json()
        assert "dates" in data
        assert len(data["dates"]) == 3
        assert data["dates"] == ["2026-03-10", "2026-03-11", "2026-03-12"]

    def test_list_dates_returns_mtt_dates(self, client, sample_data):
        """
        mtt 소스의 날짜 목록을 반환해야 한다
        """
        # when
        response = client.get("/api/dates?source=mtt")

        # then
        assert response.status_code == 200
        data = response.json()
        assert "dates" in data
        assert len(data["dates"]) == 3
        assert data["dates"] == ["2026-03-11", "2026-03-12", "2026-03-13"]

    def test_list_dates_default_to_52w_high(self, client, sample_data):
        """
        source 파라미터를 생략하면 기본값으로 52w_high를 사용해야 한다
        """
        # when
        response = client.get("/api/dates")

        # then
        assert response.status_code == 200
        data = response.json()
        assert data["dates"] == ["2026-03-10", "2026-03-11", "2026-03-12"]

    def test_list_dates_empty_for_unknown_source(self, client, sample_data):
        """
        알 수 없는 소스에 대해서는 빈 배열을 반환해야 한다
        """
        # when
        response = client.get("/api/dates?source=unknown")

        # then
        assert response.status_code == 200
        data = response.json()
        assert data["dates"] == []

    def test_list_dates_returns_dates_in_ascending_order(self, client, test_db_session, sample_data):
        """
        날짜 목록은 오름차순(과거→미래)으로 정렬되어야 한다
        """
        # given: 데이터가 무작위 순서로 입력됨
        test_db_session.add(ThemeDaily(
            date="2026-03-15",
            theme_name="미래테마",
            data_source=SOURCE_52W,
            stock_count=10,
            avg_rs=85.0,
        ))
        test_db_session.commit()

        # when
        response = client.get("/api/dates?source=52w_high")

        # then: 마지막에 추가된 데이터가 정렬되어 포함되어야 함
        assert response.status_code == 200
        data = response.json()
        assert data["dates"] == ["2026-03-10", "2026-03-11", "2026-03-12", "2026-03-15"]
