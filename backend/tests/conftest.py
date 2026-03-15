"""
pytest 설정 및 공통 fixture

SPEC-MTT-009: 테스트 DB 초기화 자동화
SPEC-MTT-011: 테스트 DB 분리 (In-Memory SQLite)
"""

import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 프로젝트 루트를 경로에 추가
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# 테스트용 임시 파일 DB URL
# @MX:NOTE: In-Memory DB는 여러 세션에서 공유되지 않으므로 파일 기반 사용
# @MX:REASON: TestClient는 lifespan을 실행하지 않아 별도의 테이블 생성 필요
import tempfile
import os
_temp_db_path = tempfile.mktemp(suffix=".db")
TEST_DATABASE_URL = f"sqlite:///{_temp_db_path}"


@pytest.fixture(scope="function")
def test_db_engine():
    """
    각 테스트 함수별 독립적인 테스트 DB 엔진 생성

    SPEC-MTT-011 REQ-MTT-011-01: 테스트 DB는 프로덕션 DB와 완전히 분리
    SPEC-MTT-011 REQ-MTT-011-02: 테스트용 DB 자동 생성
    """
    from app.database import Base
    from app.models import ThemeDaily, ThemeStockDaily  # noqa: F401 - 모델 등록
    from sqlalchemy import text

    # 테스트용 임시 파일 DB 엔진 생성
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

    # 테이블 생성
    Base.metadata.create_all(bind=engine)

    # 인덱스 생성 (프로덕션과 동일하게)
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_td_date ON theme_daily(date)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_tsd_stock ON theme_stock_daily(stock_name, date)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_tsd_theme_date ON theme_stock_daily(theme_name, date)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_stock_first_seen ON theme_stock_daily(stock_name, date, data_source)"
        ))
        conn.commit()

    yield engine

    # 정리: 테이블 삭제 및 임시 파일 삭제
    Base.metadata.drop_all(bind=engine)
    if os.path.exists(_temp_db_path):
        os.remove(_temp_db_path)


@pytest.fixture(scope="function")
def test_db_session(test_db_engine):
    """
    각 테스트 함수별 독립적인 DB 세션

    SPEC-MTT-011 REQ-MTT-011-05: 병렬 테스트 지원 (각 테스트가 독립적인 세션 사용)
    """

    Session = sessionmaker(bind=test_db_engine)
    session = Session()

    yield session

    session.close()


@pytest.fixture(scope="function")
def client(test_db_session, test_db_engine, monkeypatch):
    """
    테스트 DB를 사용하는 FastAPI 테스트 클라이언트

    SPEC-MTT-011 REQ-MTT-011-04: 기존 테스트 코드 수정 최소화 (호환성 유지)
    SPEC-MTT-011: TestClient 사용 시 테스트 DB 테이블 보장

    @MX:NOTE: monkeypatch로 전역 engine과 DB_PATH를 테스트 DB로 교체
    @MX:REASON: TestClient는 lifespan을 실행하지 않으므로 전역 engine을 테스트 엔진으로 교체 필요
    """
    from fastapi.testclient import TestClient
    from app.main import app as fastapi_app
    from app.database import get_db
    import app.database

    # @MX:ANCHOR: 전역 engine, DB_PATH, SessionLocal을 테스트 DB로 교체
    # @MX:REASON: 모든 DB 쿼리가 테스트 DB(파일 기반)를 사용하도록 보장
    monkeypatch.setattr(app.database, "engine", test_db_engine)
    monkeypatch.setattr(app.database, "DB_PATH", _temp_db_path)

    # SessionLocal도 테스트 엔진을 사용하도록 교체
    from sqlalchemy.orm import sessionmaker
    test_session_local = sessionmaker(
        autocommit=False, autoflush=False, bind=test_db_engine
    )
    monkeypatch.setattr(app.database, "SessionLocal", test_session_local)

    # DATABASE_URL도 업데이트
    monkeypatch.setattr(app.database, "DATABASE_URL", TEST_DATABASE_URL)

    # FastAPI의 get_db 의존성을 테스트 세션으로 오버라이드
    def override_get_db():
        try:
            yield test_db_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db

    with TestClient(fastapi_app) as test_client:
        yield test_client

    # 오버라이드 정리 (monkeypatch는 자동으로 원래대로 복구됨)
    fastapi_app.dependency_overrides.clear()
