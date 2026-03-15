"""
테마명 특수 문자 처리 테스트

문제: 테마명에 슬래시(/), 괄호() 등 특수 문자 포함 시 404 에러 발생
해결: FastAPI path parameter 타입을 {name} → {name:path}로 변경

버그 리포트: MTT 종목 선택 시 "방위산업/전쟁 및 테러" 등의 테마명이 404 반환
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import sys
sys.path.insert(0, '.')

from app.main import app
from app.database import SessionLocal, create_tables
from app.models import ThemeDaily, SOURCE_52W, SOURCE_MTT

client = TestClient(app)


class TestThemeNameSpecialCharacters:
    """
    테마명 특수 문자 처리 테스트

    GIVEN: 데이터베이스에 특수 문자가 포함된 테마명이 존재할 때
    WHEN: 클라이언트가 테마 히스토리 API를 호출하면
    THEN: 404 에러 없이 정상적으로 데이터를 반환해야 한다
    """

    def setup_method(self):
        """각 테스트 전에 데이터베이스 초기화 및 테스트 데이터 생성"""
        # 테이블 생성
        create_tables()

        # 기존 데이터 정리
        with SessionLocal() as db:
            db.query(ThemeDaily).delete()
            db.commit()

        # 테스트 데이터 생성 - 특수 문자 포함 테마명
        with SessionLocal() as db:
            test_themes = [
                # 슬래시 포함
                ("방위산업/전쟁 및 테러", "2026-03-13", 98.43),
                ("광통신(광케이블/광섬유 등)", "2026-03-13", 97.43),
                # 괄호 포함
                ("우주항공산업(누리호/인공위성 등)", "2026-03-13", 97.57),
                # 특수문자 조합
                ("반도체 장비(제조)", "2026-03-12", 89.78),
                ("통신", "2026-03-13", 98.43),  # 일반 테마명 (비교용)
            ]

            for theme_name, date, avg_rs in test_themes:
                db.add(ThemeDaily(
                    date=date,
                    theme_name=theme_name,
                    data_source=SOURCE_MTT,
                    stock_count=7,
                    avg_rs=avg_rs,
                    change_sum=10.5,
                ))

                # 히스토리 데이터 생성 (최근 30일)
                for i in range(30):
                    history_date = f"2026-02-{(12 - i):02d}"
                    if i < 28:  # 2026-02-12부터 2026-03-12까지
                        db.add(ThemeDaily(
                            date=history_date,
                            theme_name=theme_name,
                            data_source=SOURCE_MTT,
                            stock_count=7,
                            avg_rs=avg_rs - (i * 0.1),
                            change_sum=10.5,
                        ))

            db.commit()

    def test_theme_name_with_slash(self):
        """
        AC-SPECIAL-01: 슬래시(/) 포함 테마명 처리

        GIVEN: 테마명 "방위산업/전쟁 및 테러"가 데이터베이스에 존재할 때
        WHEN: GET /api/themes/방위산업/전쟁 및 테러/history?source=mtt 를 호출하면
        THEN: 404 에러 없이 200 OK와 히스토리 데이터를 반환해야 한다
        """
        theme_name = "방위산업/전쟁 및 테러"
        response = client.get(f"/api/themes/{theme_name}/history?source=mtt&days=30")

        assert response.status_code == 200
        data = response.json()

        assert data["theme_name"] == theme_name
        assert data["days"] == 30
        assert len(data["history"]) > 0
        assert "date" in data["history"][0]
        assert "avg_rs" in data["history"][0]

    def test_theme_name_with_parentheses(self):
        """
        AC-SPECIAL-02: 괄호(()) 포함 테마명 처리

        GIVEN: 테마명 "우주항공산업(누리호/인공위성 등)"가 데이터베이스에 존재할 때
        WHEN: GET /api/themes/우주항공산업(누리호/인공위성 등)/history 를 호출하면
        THEN: 404 에러 없이 200 OK와 히스토리 데이터를 반환해야 한다
        """
        theme_name = "우주항공산업(누리호/인공위성 등)"
        response = client.get(f"/api/themes/{theme_name}/history?source=mtt&days=30")

        assert response.status_code == 200
        data = response.json()

        assert data["theme_name"] == theme_name
        assert len(data["history"]) > 0

    def test_theme_name_with_multiple_special_chars(self):
        """
        AC-SPECIAL-03: 복합 특수 문자 포함 테마명 처리

        GIVEN: 테마명 "광통신(광케이블/광섬유 등)"가 존재할 때
        WHEN: 히스토리 API를 호출하면
        THEN: 정상적으로 데이터를 반환해야 한다
        """
        theme_name = "광통신(광케이블/광섬유 등)"
        response = client.get(f"/api/themes/{theme_name}/history?source=mtt&days=30")

        assert response.status_code == 200
        data = response.json()

        assert data["theme_name"] == theme_name
        assert len(data["history"]) > 0

    def test_normal_theme_name_still_works(self):
        """
        AC-SPECIAL-04: 일반 테마명 정상 작동 확인

        GIVEN: 특수 문자가 없는 일반 테마명 "통신"이 존재할 때
        WHEN: 히스토리 API를 호출하면
        THEN: 정상적으로 데이터를 반환해야 한다 (회귀 없음 확인)
        """
        theme_name = "통신"
        response = client.get(f"/api/themes/{theme_name}/history?source=mtt&days=30")

        assert response.status_code == 200
        data = response.json()

        assert data["theme_name"] == theme_name
        assert len(data["history"]) > 0

    def test_url_encoded_theme_name(self):
        """
        AC-SPECIAL-05: URL 인코딩된 테마명 처리

        GIVEN: 테마명이 URL 인코딩되어 전달될 때
        WHEN: 인코딩된 형태로 API를 호출하면
        THEN: 서버가 올바르게 디코딩하여 처리해야 한다
        """
        theme_name = "방위산업/전쟁 및 테러"
        # URL 인코딩된 형태: %EB%B0%A9%EC%9C%84%EC%82%B0%EC%97%85%2F%EC%A0%84%EC%9F%81%20%EB%B0%8F%20%ED%85%8C%EB%9F%AC
        # urllib.parse.quote로 인코딩하면 슬래시가 %2F로 변환됨
        from urllib.parse import quote
        encoded_name = quote(theme_name, safe='')

        response = client.get(f"/api/themes/{encoded_name}/history?source=mtt&days=30")

        assert response.status_code == 200
        data = response.json()

        assert data["theme_name"] == theme_name
        assert len(data["history"]) > 0

    def test_nonexistent_theme_with_special_chars(self):
        """
        AC-SPECIAL-06: 존재하지 않는 특수 문자 포함 테마명 처리

        GIVEN: 데이터베이스에 존재하지 않는 테마명
        WHEN: 히스토리 API를 호출하면
        THEN: 404 Not Found 에러를 반환해야 한다
        """
        theme_name = "존재하지않는/테마명"
        response = client.get(f"/api/themes/{theme_name}/history?source=mtt&days=30")

        assert response.status_code == 404
        assert "detail" in response.json()
