# SPEC-MTT-010: Implementation Plan

**TAG**: SPEC-MTT-010
**Parent SPEC**: spec.md

---

## Milestones

### Primary Goal: 서버 시작 시 자동 동기화 구현

- [ ] `app/main.py` lifespan 함수 수정
- [ ] 초기 동기화 로직 추가
- [ ] 로깅 메시지 추가
- [ ] 에러 핸들링 구현

### Secondary Goal: 테스트 코드 작성

- [ ] 서버 시작 시 자동 동기화 통합 테스트
- [ ] 중복 적재 방지 테스트
- [ ] 에러 격리 테스트

---

## Technical Approach

### Step 1: lifespan 함수 수정

**File**: `app/main.py`

1. `SessionLocal` import 추가 (이미 `get_db` 의존성 있음)
2. `sync_service` import 추가
3. Watchdog 시작 전 초기 동기화 로직 추가
4. try-except-finally 블록으로 DB 세션 관리

### Step 2: 로깅 구현

**File**: `app/main.py`

1. `logging` 모듈 사용 (이미 다른 곳에서 사용 중)
2. INFO 레벨로 동기화 결과 출력
3. ERROR 레벨로 실패 시 로깅

### Step 3: 테스트 코드 작성

**File**: `tests/test_startup_sync.py`

1. 기존 HTML 파일이 있는 상태에서 서버 시작 테스트
2. 이미 적재된 파일 건너뛰기 테스트
3. 에러 파일 존재 시에도 서버 시작 테스트

---

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 대량 파일로 인한 시작 지연 | Medium | Medium | 파일 수 제한 또는 백그라운드 처리 고려 |
| DB 세션 누수 | Low | High | try-finally로 세션 정리 보장 |
| Watchdog과 충돌 | Low | Medium | 초기 동기화 완료 후 Watchdog 시작 순서 유지 |

---

## Dependencies

- `app/sync_service.py`: SyncService 클래스
- `app/database.py`: SessionLocal
- `app/file_watcher.py`: 기존 Watchdog 로직

---

## Definition of Done

- [ ] 모든 요구사항 구현 완료
- [ ] 단위 테스트 통과 (coverage >= 85%)
- [ ] 통합 테스트 통과
- [ ] 코드 리뷰 완료
- [ ] 로그 메시지가 올바르게 출력됨
