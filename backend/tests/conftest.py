"""
pytest 설정 및 공통 fixture

SPEC-MTT-009: 테스트 DB 초기화 자동화
"""

import sys
from pathlib import Path

import pytest

# 프로젝트 루트를 경로에 추가
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))


@pytest.fixture(autouse=True)
def setup_database():
    """모든 테스트 전에 데이터베이스 테이블 생성"""
    from app.database import create_tables
    create_tables()
    yield
    # 테스트 후 정리는 각 테스트 클래스의 teardown_method에서 수행
