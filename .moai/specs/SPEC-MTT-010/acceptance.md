# SPEC-MTT-010: Acceptance Criteria

**TAG**: SPEC-MTT-010
**Parent SPEC**: spec.md

---

## Acceptance Criteria

### AC-010-01: 서버 시작 시 자동 동기화

**Given** data/ 폴더에 적재되지 않은 HTML 파일이 존재한다
**When** FastAPI 서버를 시작한다
**Then** 미적재 HTML 파일들이 자동으로 DB에 적재된다
**And** 로그에 적재 결과가 INFO 레벨로 출력된다

### AC-010-02: 중복 적재 방지

**Given** data/ 폴더에 이미 DB에 적재된 HTML 파일이 존재한다
**When** FastAPI 서버를 시작한다
**Then** 이미 적재된 파일은 건너뛴다
**And** 로그에 "skipped" 메시지가 출력된다

### AC-010-03: 혼합 시나리오

**Given** data/ 폴더에 적재된 파일 3개와 미적재 파일 2개가 존재한다
**When** FastAPI 서버를 시작한다
**Then** 미적재 파일 2개만 적재된다
**And** 적재된 파일 3개는 건너뛴다
**And** 로그에 "2 files processed, 3 skipped" 메시지가 출력된다

### AC-010-04: 에러 격리

**Given** data/ 폴더에 정상 파일 2개와 손상된 HTML 파일 1개가 존재한다
**When** FastAPI 서버를 시작한다
**Then** 정상 파일 2개는 적재된다
**And** 손상된 파일은 에러로 로깅된다
**And** 서버는 정상적으로 시작된다

### AC-010-05: 빈 data 폴더

**Given** data/ 폴더가 비어있다
**When** FastAPI 서버를 시작한다
**Then** 서버가 정상적으로 시작된다
**And** Watchdog이 정상적으로 시작된다

### AC-010-06: data 폴더 없음

**Given** data/ 폴더가 존재하지 않는다
**When** FastAPI 서버를 시작한다
**Then** 서버가 정상적으로 시작된다
**And** 에러 없이 Watchdog 시작 로직을 건너뛴다

---

## Test Scenarios

### Test Case 1: 초기 동기화 통합 테스트

```python
def test_startup_sync_processes_uningested_files(client, sample_html_files):
    """
    Given: data/ 폴더에 미적재 HTML 파일 존재
    When: 서버 시작
    Then: 파일들이 자동으로 적재됨
    """
    # Setup: data 폴더에 테스트 파일 배치
    # Action: lifespan 컨텍스트 진입 (서버 시작 시뮬레이션)
    # Assert: DB에 데이터 존재 확인
    # Assert: 로그에 적재 결과 출력 확인
```

### Test Case 2: 중복 방지 테스트

```python
def test_startup_sync_skips_already_loaded_files(client, db_session):
    """
    Given: DB에 이미 적재된 날짜의 파일이 data/ 폴더에 존재
    When: 서버 시작
    Then: 해당 파일은 건너뛰어짐
    """
    # Setup: DB에 미리 데이터 적재
    # Action: lifespan 컨텍스트 진입
    # Assert: DB 레코드 수 변화 없음
```

### Test Case 3: 에러 격리 테스트

```python
def test_startup_sync_continues_on_error(client, corrupted_html_file):
    """
    Given: 손상된 HTML 파일과 정상 파일이 혼재
    When: 서버 시작
    Then: 정상 파일만 적재되고 서버는 시작됨
    """
    # Setup: 손상된 파일과 정상 파일 배치
    # Action: lifespan 컨텍스트 진입
    # Assert: 정상 파일 적재 확인
    # Assert: 서버 시작 성공 확인
```

### Test Case 4: Watchdog 통합 테스트

```python
def test_watchdog_starts_after_initial_sync(client):
    """
    Given: 초기 동기화 완료
    When: Watchdog 시작
    Then: Watchdog이 정상적으로 파일 감시 시작
    """
    # Action: lifespan 컨텍스트 진입 후 파일 추가
    # Assert: Watchdog이 새 파일 감지 및 적재
```

---

## Quality Gates

### Coverage Requirements

- Branch Coverage: >= 85%
- Line Coverage: >= 90% for `app/main.py` lifespan function

### Linting

- ruff: No errors
- mypy: No type errors

### Performance

- 서버 시작 시간: 5초 이내 (파일 100개 기준)

---

## Verification Checklist

- [x] AC-010-01: 서버 시작 시 자동 동기화 동작 확인
- [x] AC-010-02: 중복 적재 방지 확인
- [x] AC-010-03: 혼합 시나리오 확인
- [x] AC-010-04: 에러 격리 확인
- [x] AC-010-05: 빈 폴더 처리 확인
- [x] AC-010-06: 폴더 없음 처리 확인
- [x] 로그 메시지 포맷 확인
- [x] Watchdog 정상 동작 확인
