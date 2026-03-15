# SPEC-MTT-011: Implementation Plan

**TAG**: SPEC-MTT-011
**Parent SPEC**: spec.md

---

## Milestones

### Primary Goal: 테스트 DB 격리 구현

- [ ] `tests/conftest.py`에 테스트 DB fixture 추가
- [ ] In-Memory SQLite 엔진 생성
- [ ] 세션 fixture 구현
- [ ] FastAPI 의존성 오버라이드 구현

### Secondary Goal: 기존 테스트 마이그레이션

- [ ] 기존 테스트 파일 분석
- [ ] 프로덕션 DB 참조 제거
- [ ] 테스트별 fixture 적용

### Final Goal: 검증 및 정리

- [ ] 모든 테스트 통과 확인
- [ ] 프로덕션 DB 미사용 확인
- [ ] 병렬 테스트 동작 확인

---

## Technical Approach

### Step 1: conftest.py 수정

**File**: `tests/conftest.py`

1. 기존 `setup_database` fixture 제거 또는 수정
2. `test_db_engine` fixture 추가 (function scope)
3. `test_db_session` fixture 추가
4. `client` fixture에 의존성 오버라이드 적용

### Step 2: 기존 테스트 분석

**Files**: `tests/test_*.py`

현재 테스트 파일들의 DB 사용 패턴 분석:
- `conftest.py`의 `setup_database` 사용 여부
- 직접 `SessionLocal` 사용 여부
- `get_db` 의존성 사용 여부

### Step 3: 테스트 마이그레이션

각 테스트 파일을 새로운 fixture 사용으로 변경:
- `db` 파라미터 → `test_db_session` 사용
- `client` 파라미터 → 새로운 `client` fixture 사용

### Step 4: 프로덕션 DB 보호 확인

- 테스트 실행 전후 `backend/db/trends.sqlite` 파일 존재/변경 확인
- 테스트 실행 중 DB 파일 접근 없음 확인

---

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 기존 테스트 호환성 문제 | Medium | Medium | 점진적 마이그레이션 |
| In-Memory DB 제약사항 | Low | Low | 파일 기반 테스트는 별도 fixture |
| 병렬 테스트 충돌 | Low | Medium | function scope로 격리 |

---

## Dependencies

- pytest
- SQLAlchemy
- FastAPI TestClient
- 기존 `app/models.py`

---

## Definition of Done

- [ ] 테스트 DB fixture 구현 완료
- [ ] 모든 기존 테스트 통과
- [ ] 프로덕션 DB 미사용 확인
- [ ] 테스트 커버리지 >= 85%
- [ ] 병렬 테스트(`pytest -n auto`) 통과
