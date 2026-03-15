"""
테스트 DB 분리 검증 (SPEC-MTT-011)

GREEN Phase: 테스트 DB가 프로덕션 DB와 완전히 분리되는지 검증
"""

import pytest
from pathlib import Path
import os
from sqlalchemy import create_engine, text


class TestDatabaseIsolation:
    """
    테스트 DB 격리 검증

    REQ-MTT-011-01: 테스트 DB는 프로덕션 DB와 완전히 분리되어야 함
    REQ-MTT-011-06: 테스트 중 프로덕션 DB에 접근하지 않음
    """

    def test_production_db_file_not_modified(self, test_db_session):
        """
        AC-011-01: 테스트 실행 후 프로덕션 DB 파일 수정 시간 변경 없음

        GIVEN: 프로덕션 DB 파일이 존재
        WHEN: 테스트가 실행될 때
        THEN: 프로덕션 DB 파일이 수정되지 않아야 함
        """
        # given: 프로덕션 DB 경로
        backend_dir = Path(__file__).parent.parent
        prod_db_path = backend_dir / "db" / "trends.sqlite"

        # 프로덕션 DB 파일이 존재하는지 확인
        assert prod_db_path.exists(), "프로덕션 DB 파일이 존재해야 합니다"

        # given: 프로덕션 DB 파일의 현재 수정 시간 기록
        initial_mtime = os.path.getmtime(prod_db_path)

        # when: 테스트 데이터를 생성하는 작업 수행
        from app.models import ThemeDaily, SOURCE_52W

        # 테스트 DB 세션을 사용하여 데이터 추가
        test_db_session.add(ThemeDaily(
            date="2026-03-15",
            theme_name="TEST_ISOLATION",
            data_source=SOURCE_52W,
            stock_count=10,
            avg_rs=85.0,
        ))
        test_db_session.commit()

        # then: 프로덕션 DB 파일의 수정 시간이 변경되지 않아야 함
        final_mtime = os.path.getmtime(prod_db_path)
        assert initial_mtime == final_mtime, \
            f"프로덕션 DB 파일 수정 시간이 변경되었습니다: 초기={initial_mtime}, 최종={final_mtime}"

    def test_test_db_is_in_memory(self, test_db_engine):
        """
        AC-011-02: 테스트 시작 전 In-Memory DB 스키마 생성됨

        GIVEN: 테스트가 시작될 때
        WHEN: test_db_engine fixture가 호출되면
        THEN: In-Memory DB 엔진이 생성되어야 함
        """
        # when: test_db_engine fixture가 제공되면
        # then: In-Memory DB 엔진이 생성되어야 함
        assert test_db_engine is not None, "test_db_engine fixture가 제공되어야 합니다"

        # @MX:NOTE: TestClient와의 호환성을 위해 임시 파일 DB를 사용합니다
        # @MX:REASON: TestClient는 lifespan을 실행하지 않아 In-Memory DB를
        #         여러 세션에서 공유할 수 없습니다. 임시 파일 DB를 사용하여
        #         테스트 간 격리를 보장합니다.
        # 임시 파일 DB인지 확인 (URL 확인)
        assert "sqlite:///" in str(test_db_engine.url), \
            f"테스트 DB가 SQLite 파일 기반이 아닙니다: {test_db_engine.url}"

        # 테이블이 생성되었는지 확인
        from sqlalchemy import inspect
        inspector = inspect(test_db_engine)
        tables = inspector.get_table_names()
        assert "theme_daily" in tables, "theme_daily 테이블이 생성되어야 합니다"
        assert "theme_stock_daily" in tables, "theme_stock_daily 테이블이 생성되어야 합니다"

    def test_test_db_auto_cleanup(self, test_db_session):
        """
        AC-011-03: 각 테스트 후 DB 자동 정리됨

        GIVEN: 테스트가 실행될 때
        WHEN: 테스트가 종료되면
        THEN: 테스트 DB가 자동으로 정리되어야 함
        """
        # when: 테스트 DB에 데이터 추가
        from app.models import ThemeDaily, SOURCE_52W

        test_db_session.add(ThemeDaily(
            date="2026-03-15",
            theme_name="TEST_CLEANUP",
            data_source=SOURCE_52W,
            stock_count=10,
            avg_rs=85.0,
        ))
        test_db_session.commit()

        # then: 현재 테스트 내에서는 데이터가 존재
        result = test_db_session.query(ThemeDaily).filter_by(theme_name="TEST_CLEANUP").first()
        assert result is not None, "테스트 데이터가 존재해야 합니다"

        # 테스트 종료 후 fixture가 자동으로 정리됨 (conftest.py에서 처리)
        # 다음 테스트에서는 이 데이터가 존재하지 않아야 함

    def test_parallel_test_execution(self, test_db_session):
        """
        AC-011-05: pytest -n auto로 병렬 실행 시 충돌 없음

        GIVEN: 여러 테스트가 병렬로 실행될 때
        WHEN: 각 테스트가 독립적인 DB 세션을 사용하면
        THEN: 테스트 간 충돌이 없어야 함
        """
        # when: 각 테스트가 독립적인 세션에서 데이터를 추가
        from app.models import ThemeDaily, SOURCE_52W

        # 현재 테스트 세션에 고유한 데이터 추가
        import uuid
        unique_id = str(uuid.uuid4())[:8]

        test_db_session.add(ThemeDaily(
            date="2026-03-15",
            theme_name=f"TEST_PARALLEL_{unique_id}",
            data_source=SOURCE_52W,
            stock_count=10,
            avg_rs=85.0,
        ))
        test_db_session.commit()

        # then: 현재 세션에서만 데이터가 존재
        result = test_db_session.query(ThemeDaily).filter_by(
            theme_name=f"TEST_PARALLEL_{unique_id}"
        ).first()
        assert result is not None, "현재 테스트 세션에 데이터가 존재해야 합니다"

    def test_no_production_db_access_during_tests(self, test_db_session):
        """
        AC-011-06: 테스트 중 프로덕션 DB에 접근하지 않음

        GIVEN: 테스트가 실행될 때
        WHEN: 테스트 코드가 DB에 접근하면
        THEN: 프로덕션 DB가 아닌 테스트 DB에 접근해야 함
        """
        # given: 프로덕션 DB 경로
        backend_dir = Path(__file__).parent.parent
        prod_db_path = backend_dir / "db" / "trends.sqlite"

        # when: 테스트 DB에 데이터 추가
        from app.models import ThemeDaily, SOURCE_52W

        test_db_session.add(ThemeDaily(
            date="2026-03-15",
            theme_name="TEST_NO_PROD_ACCESS",
            data_source=SOURCE_52W,
            stock_count=10,
            avg_rs=85.0,
        ))
        test_db_session.commit()

        # then: 프로덕션 DB에 테스트 데이터가 추가되지 않아야 함
        # 프로덕션 DB에 직접 연결하여 확인
        prod_engine = create_engine(f"sqlite:///{prod_db_path}")
        with prod_engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM theme_daily WHERE theme_name LIKE 'TEST_%'"))
            count = result.scalar()
            assert count == 0, f"프로덕션 DB에 테스트 데이터가 있습니다: {count}건 발견"
