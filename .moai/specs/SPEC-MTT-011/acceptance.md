# SPEC-MTT-011: Acceptance Criteria

**TAG**: SPEC-MTT-011
**Parent SPEC**: spec.md
**Status**: Completed

---

## Acceptance Criteria

### AC-011-01: 테스트 DB 격리

**Given** 프로덕션 DB에 데이터가 존재한다
**When** 테스트를 실행한다
**Then** 테스트는 프로덕션 DB와 별도의 DB를 사용한다
**And** 테스트 후 프로덕션 DB는 변경되지 않는다

### AC-011-02: 테스트 DB 자동 생성

**Given** pytest 환경이 준비되어 있다
**When** 테스트를 실행한다
**Then** 테스트용 DB가 자동으로 생성된다
**And** 테스트 시작 전 DB 스키마가 생성된다

### AC-011-03: 테스트 DB 자동 정리

**Given** 테스트가 실행 중이다
**When** 테스트가 완료된다
**Then** 테스트용 DB가 자동으로 정리된다
**And** 다음 테스트는 깨끗한 DB에서 시작된다

### AC-011-04: 기존 테스트 호환성

**Given** 기존 테스트 코드가 존재한다
**When** 새로운 fixture를 적용한다
**Then** 테스트 코드 수정 없이(또는 최소 수정으로) 테스트가 통과한다

### AC-011-05: 병렬 테스트 지원

**Given** pytest-xdist가 설치되어 있다
**When** `pytest -n auto`로 병렬 테스트를 실행한다
**Then** 모든 테스트가 독립적으로 실행된다
**And** 테스트 간 DB 충돌이 발생하지 않는다

### AC-011-06: 프로덕션 DB 보호

**Given** 테스트 실행 전 프로덕션 DB에 N개의 레코드가 있다
**When** 테스트를 실행한다
**Then** 테스트 실행 후에도 프로덕션 DB에는 여전히 N개의 레코드가 있다
**And** 프로덕션 DB 파일의 수정 시간이 변경되지 않는다

---

## Test Scenarios

### Test Case 1: DB 격리 검증

```python
def test_database_isolation(test_db_session, production_db_path):
    """
    Given: 프로덕션 DB에 데이터 존재
    When: 테스트 DB에 데이터 추가
    Then: 프로덕션 DB는 변경되지 않음
    """
    # Setup: 프로덕션 DB 레코드 수 기록
    # Action: 테스트 DB에 새 레코드 추가
    # Assert: 테스트 DB에 레코드 존재
    # Assert: 프로덕션 DB 레코드 수 변화 없음
```

### Test Case 2: 자동 정리 검증

```python
def test_automatic_cleanup(test_db_session):
    """
    Given: 테스트에서 DB에 데이터 추가
    When: 다음 테스트 실행
    Then: 이전 테스트의 데이터가 존재하지 않음
    """
    # Action: 테스트 DB에 레코드 추가
    # Assert: 레코드 존재 확인
    # (다음 테스트에서)
    # Assert: 레코드가 존재하지 않음 (깨끗한 DB)
```

### Test Case 3: FastAPI 의존성 오버라이드

```python
def test_client_uses_test_db(client, test_db_session):
    """
    Given: FastAPI 테스트 클라이언트
    When: API 호출로 데이터 생성
    Then: 테스트 DB에만 데이터가 저장됨
    """
    # Action: client.post("/api/themes/daily", ...)
    # Assert: test_db_session에서 데이터 조회 가능
    # Assert: 프로덕션 DB에서 데이터 조회 불가
```

### Test Case 4: 병렬 테스트

```python
# pytest -n auto로 실행
def test_parallel_safe_1(test_db_session):
    """병렬 테스트 1 - 독립적인 DB 세션 사용"""
    # 각 테스트는 function scope fixture 사용
    pass

def test_parallel_safe_2(test_db_session):
    """병렬 테스트 2 - 독립적인 DB 세션 사용"""
    # 서로 다른 DB 인스턴스 사용
    pass
```

### Test Case 5: 프로덕션 DB 미접근

```python
def test_no_production_db_access():
    """
    Given: 테스트 환경
    When: 테스트 실행
    Then: 프로덕션 DB 파일에 접근하지 않음
    """
    # Setup: 파일 접근 모니터링
    # Action: 테스트 실행
    # Assert: backend/db/trends.sqlite 접근 없음
```

---

## Quality Gates

### Coverage Requirements

- Branch Coverage: >= 85%
- Line Coverage: >= 90% for `tests/conftest.py`

### Linting

- ruff: No errors
- mypy: No type errors

### Performance

- 전체 테스트 스위트 실행 시간: 10초 이내 (현재 수준 유지)
- In-Memory DB 사용으로 디스크 I/O 제거

---

## Verification Checklist

- [ ] AC-011-01: 테스트 DB 격리 확인
- [ ] AC-011-02: 자동 생성 확인
- [ ] AC-011-03: 자동 정리 확인
- [ ] AC-011-04: 기존 테스트 호환성 확인
- [ ] AC-011-05: 병렬 테스트 확인
- [ ] AC-011-06: 프로덕션 DB 보호 확인
- [ ] 모든 기존 테스트 통과
- [ ] 커버리지 >= 85%
