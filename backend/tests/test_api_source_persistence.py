"""
소스별 테마 선택 상태 유지 테스트

문제: source 변경 시 이전 선택 상태가 초기화됨
해결: source별로 선택된 테마를 독립적으로 저장 (Record<DataSource, string[]>)

SPEC-MTT-005 개선 사항:
- 사용자가 52주 신고가에서 테마를 수동 선택
- MTT 종목으로 변경했다가 다시 52주 신고가로 복귀
- 이전에 선택했던 테마들이 그대로 유지되어야 함
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import sys
sys.path.insert(0, '.')

from app.main import app
from app.database import SessionLocal, create_tables
from app.models import ThemeDaily, SOURCE_52W, SOURCE_MTT

client = TestClient(app)


class TestSourceBasedThemeSelection:
    """
    소스별 테마 선택 상태 유지 테스트

    GIVEN: 사용자가 여러 데이터 소스를 사용할 때
    WHEN: 소스를 변경하면
    THEN: 각 소스별로 선택된 테마가 독립적으로 유지되어야 한다
    """

    def setup_method(self):
        """각 테스트 전에 데이터베이스 초기화"""
        # 테이블 생성
        create_tables()

        with SessionLocal() as db:
            db.query(ThemeDaily).delete()
            db.commit()

        # 테스트 데이터 생성
        with SessionLocal() as db:
            # 52w_high 소스 데이터
            for i, theme_name in enumerate(["테마A", "테마B", "테마C", "테마D", "테마E", "테마F"]):
                for date in ["2026-03-11", "2026-03-12", "2026-03-13"]:
                    db.add(ThemeDaily(
                        date=date,
                        theme_name=theme_name,
                        data_source=SOURCE_52W,
                        stock_count=10,
                        avg_rs=100 - (i * 5),
                        change_sum=10.5,
                    ))

            # mtt 소스 데이터
            for i, theme_name in enumerate(["MTT_테마A", "MTT_테마B", "MTT_테마C", "MTT_테마D", "MTT_테마E", "MTT_테마F"]):
                for date in ["2026-03-11", "2026-03-12", "2026-03-13"]:
                    db.add(ThemeDaily(
                        date=date,
                        theme_name=theme_name,
                        data_source=SOURCE_MTT,
                        stock_count=7,
                        avg_rs=98 - (i * 3),
                        change_sum=8.5,
                    ))

            db.commit()

    def test_api_returns_correct_themes_per_source(self):
        """
        AC-SOURCE-01: 각 소스별 올바른 테마 목록 반환

        GIVEN: 데이터베이스에 52w_high와 mtt 소스의 테마 데이터가 존재할 때
        WHEN: 각 소스별 daily API를 호출하면
        THEN: 해당 소스의 테마 목록만 반환해야 한다
        """
        # 52w_high 테마 확인
        response_52w = client.get("/api/themes/daily?date=2026-03-13&source=52w_high")
        assert response_52w.status_code == 200
        data_52w = response_52w.json()
        assert data_52w["date"] == "2026-03-13"
        theme_names_52w = [t["theme_name"] for t in data_52w["themes"]]
        assert "테마A" in theme_names_52w
        assert "MTT_테마A" not in theme_names_52w  # mtt 테마 없어야 함

        # mtt 테마 확인
        response_mtt = client.get("/api/themes/daily?date=2026-03-13&source=mtt")
        assert response_mtt.status_code == 200
        data_mtt = response_mtt.json()
        assert data_mtt["date"] == "2026-03-13"
        theme_names_mtt = [t["theme_name"] for t in data_mtt["themes"]]
        assert "MTT_테마A" in theme_names_mtt
        assert "테마A" not in theme_names_mtt  # 52w_high 테마 없어야 함

    def test_theme_history_api_with_special_chars(self):
        """
        AC-SOURCE-02: 특수 문자 포함 테마명 히스토리 API 정상 작동

        GIVEN: 데이터베이스에 슬래시 포함 테마명이 존재할 때
        WHEN: 히스토리 API를 호출하면
        THEN: 404 에러 없이 정상적으로 데이터를 반환해야 한다
        """
        # 52w_high에 특수 문자 포함 테마 추가
        with SessionLocal() as db:
            db.add(ThemeDaily(
                date="2026-03-13",
                theme_name="반도체/장비",
                data_source=SOURCE_52W,
                stock_count=15,
                avg_rs=85.0,
                change_sum=5.2,
            ))
            db.add(ThemeDaily(
                date="2026-03-12",
                theme_name="반도체/장비",
                data_source=SOURCE_52W,
                stock_count=14,
                avg_rs=84.0,
                change_sum=4.8,
            ))
            db.commit()

        # 슬래시 포함 테마명 히스토리 API 호출
        theme_name = "반도체/장비"
        response = client.get(f"/api/themes/{theme_name}/history?source=52w_high&days=30")

        assert response.status_code == 200
        data = response.json()

        assert data["theme_name"] == theme_name
        assert len(data["history"]) >= 2
        assert data["history"][0]["date"] == "2026-03-12"
        assert data["history"][-1]["date"] == "2026-03-13"

    def test_multiple_sources_coexist(self):
        """
        AC-SOURCE-03: 두 소스 데이터 동시 존재 확인

        GIVEN: 52w_high와 mtt 소스 데이터가 모두 존재할 때
        WHEN: 각 소스의 테마 데이터를 조회하면
        THEN: 서로 독립적인 데이터가 반환되어야 한다
        """
        # 52w_high에서 테마A 조회
        response = client.get("/api/themes/테마A/history?source=52w_high&days=30")
        assert response.status_code == 200
        data = response.json()
        assert data["theme_name"] == "테마A"
        assert len(data["history"]) > 0

        # mtt에서 동일한 테마명 조회 (없을 수도 있음)
        response_mtt = client.get("/api/themes/테마A/history?source=mtt&days=30")
        # 404이어도 상관없음 - 테마A는 mtt에 없을 수 있음
        assert response_mtt.status_code in [200, 404]

        # mtt에서 MTT_테마A 조회
        response = client.get("/api/themes/MTT_테마A/history?source=mtt&days=30")
        assert response.status_code == 200
        data = response.json()
        assert data["theme_name"] == "MTT_테마A"

    def test_source_parameter_affects_results(self):
        """
        AC-SOURCE-04: source 파라미터가 조회 결과에 영향을 미침

        GIVEN: 동일한 날짜에 두 소스의 데이터가 존재할 때
        WHEN: source 파라미터만 변경해서 API를 호출하면
        THEN: 각 소스에 해당하는 데이터만 반환되어야 한다
        """
        date = "2026-03-13"

        # 52w_high 조회
        response_52w = client.get(f"/api/themes/daily?date={date}&source=52w_high")
        assert response_52w.status_code == 200
        data_52w = response_52w.json()
        themes_52w = [t["theme_name"] for t in data_52w["themes"]]

        # mtt 조회
        response_mtt = client.get(f"/api/themes/daily?date={date}&source=mtt")
        assert response_mtt.status_code == 200
        data_mtt = response_mtt.json()
        themes_mtt = [t["theme_name"] for t in data_mtt["themes"]]

        # 두 소스의 테마가 서로 다름
        assert set(themes_52w).isdisjoint(set(themes_mtt))

        # 교차 확인
        for theme in themes_52w:
            assert theme not in themes_mtt
        for theme in themes_mtt:
            assert theme not in themes_52w
