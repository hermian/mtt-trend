# SPEC-MTT-011: 테스트 DB 분리

**TAG**: SPEC-MTT-011
**Status**: Completed
**Priority**: High
**Created**: 2026-03-15
**Completed**: 2026-03-15
**Domain**: Testing

---

## Problem Analysis

### Current Issue

현재 프로덕션과 테스트가 같은 DB(`backend/db/trends.sqlite`)를 사용하고 있다. 테스트 실행 시 프로덕션 데이터가 삭제되거나 `rm -f db/trends.sqlite` 명령으로 실 데이터가 삭제되는 문제가 발생한다.

### Root Cause Analysis

1. **Surface Problem**: 테스트 실행 시 프로덕션 데이터 삭제됨
2. **Immediate Cause**: 테스트와 프로덕션이 동일한 DB 파일 사용
3. **Underlying Cause**: `database.py`에서 DB 경로가 고정되어 있음
4. **Systemic Factor**: 테스트 격리를 위한 DB 구성 메커니즘 부재
5. **Root Cause**: 테스트 환경 구성을 위한 의존성 주입 패턴 미적용

### Impact

- 테스트 실행 시 실제 데이터 손실 위험
- 개발자의 로컬 데이터가 테스트마다 삭제됨
- CI/CD 환경에서 테스트 격리 불가
- 데이터 무결성 테스트 어려움

---

## Environment

### System Context

- **Runtime**: Python 3.11+, pytest 7.4+
- **Database**: SQLite (in-memory 또는 temp file)
- **Test Framework**: pytest with fixtures
- **Existing Components**:
  - `app/database.py`: DB 엔진 및 세션 관리
  - `tests/conftest.py`: pytest fixture 정의

### Constraints

- [HARD] 테스트 DB는 프로덕션 DB와 완전히 분리되어야 함
- [HARD] 테스트 실행 후 자동 정리되어야 함
- [HARD] 기존 테스트 코드 수정 최소화
- [SOFT] 테스트 속도 저하 방지 (in-memory DB 권장)

---

## Assumptions

1. **SQLite In-Memory**: `sqlite:///:memory:` 사용 가능
2. **Pytest Fixtures**: `conftest.py`에서 DB fixture 관리
3. **Session Scope**: 테스트 세션별 독립적인 DB 사용
4. **Thread Safety**: SQLite in-memory DB는 같은 커넥션에서만 공유됨

---

## Requirements

### REQ-MTT-011-01: 테스트 DB 격리

**WHEN** 테스트가 실행될 때
**THEN** 시스템은 프로덕션 DB(`backend/db/trends.sqlite`)와 별도의 테스트용 DB를 사용해야 한다.

### REQ-MTT-011-02: 테스트 DB 자동 생성

**WHEN** pytest가 시작될 때
**THEN** 시스템은 테스트용 DB를 자동으로 생성해야 한다.

### REQ-MTT-011-03: 테스트 DB 자동 정리

**WHEN** 테스트 세션이 종료될 때
**THEN** 시스템은 테스트용 DB를 자동으로 정리(삭제)해야 한다.

### REQ-MTT-011-04: 기존 테스트 호환성

**WHEN** 기존 테스트 코드를 실행할 때
**THEN** 테스트 코드 수정 없이 새로운 테스트 DB를 사용해야 한다.

### REQ-MTT-011-05: 병렬 테스트 지원

**IF** 여러 테스트가 병렬로 실행되면
**THEN** 각 테스트는 독립적인 DB 세션을 사용해야 한다.

### REQ-MTT-011-06: 프로덕션 DB 보호

**IF** 테스트 실행 중 에러가 발생해도
**THEN** 프로덕션 DB는 절대 수정되지 않아야 한다.

---

## Specifications

### Implementation Approach

#### Option A: In-Memory SQLite with Override Fixture (Recommended)

`sqlite:///:memory:` URL을 사용하고 pytest fixture로 엔진을 오버라이드.

**장점**:
- 가장 빠른 테스트 속도
- 디스크 I/O 없음
- 테스트 종료 시 자동 정리

**단점**:
- DB 파일 기반 기능 테스트 불가 (백업 등)

#### Option B: Temporary File DB

`tempfile.NamedTemporaryFile`로 임시 DB 파일 생성.

**장점**:
- 실제 파일 기반 기능 테스트 가능
- DB 상태 검증 가능

**단점**:
- 디스크 I/O로 인한 속도 저하
- 파일 정리 로직 필요

**Decision**: Option A 선택 (In-Memory SQLite)
- 대부분의 테스트는 in-memory로 충분
- 파일 기반 테스트가 필요한 경우 별도 fixture로 처리

### Technical Design

```python
# tests/conftest.py

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import ThemeDaily, ThemeStockDaily  # 모델 등록

# 테스트용 In-Memory DB 엔진
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="function")
def test_db_engine():
    """각 테스트 함수별 독립적인 DB 엔진 생성"""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def test_db_session(test_db_engine):
    """각 테스트 함수별 독립적인 DB 세션"""
    Session = sessionmaker(bind=test_db_engine)
    session = Session()
    yield session
    session.close()

@pytest.fixture(scope="function")
def client(test_db_session):
    """테스트 DB를 사용하는 FastAPI 테스트 클라이언트"""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database import get_db

    def override_get_db():
        try:
            yield test_db_session
        finally:
            pass  # 세션 정리는 test_db_session fixture에서 처리

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
```

### File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `tests/conftest.py` | Modify | 테스트 DB fixture 추가 |
| `app/database.py` | None | 기존 코드 유지 (프로덕션용) |
| `tests/test_*.py` | Modify | 기존 fixture 사용 방식으로 변경 |

---

## Traceability

| Requirement | Source | Verification |
|-------------|--------|--------------|
| REQ-MTT-011-01 | User Request | Integration Test |
| REQ-MTT-011-02 | User Request | Unit Test |
| REQ-MTT-011-03 | User Request | Integration Test |
| REQ-MTT-011-04 | Best Practice | Regression Test |
| REQ-MTT-011-05 | Best Practice | Parallel Test |
| REQ-MTT-011-06 | Security | Integration Test |

---

## Related SPECs

- **SPEC-MTT-009**: HTML 자동 감지 및 DB 동기화 (테스트 대상)
- **SPEC-MTT-010**: 서버 시작 시 자동 동기화 (테스트 대상)

---

## References

- pytest fixtures: https://docs.pytest.org/en/stable/explanation/fixtures.html
- SQLAlchemy Testing: https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction
- FastAPI Testing: https://fastapi.tiangolo.com/tutorial/testing/
