# SPEC-MTT-010: 서버 시작 시 자동 동기화

**TAG**: SPEC-MTT-010
**Status**: 완료 (Completed)
**Priority**: High
**Created**: 2026-03-15
**Domain**: Backend

---

## Problem Analysis

### Current Issue

현재 Watchdog 파일 감시자는 새로 추가되는 파일(on_created, on_moved)만 감지한다. 서버가 재기동될 때 이미 존재하는 HTML 파일들은 자동으로 적재되지 않는 문제가 있다.

### Root Cause Analysis

1. **Surface Problem**: 서버 재기동 후 기존 HTML 파일이 자동 적재되지 않음
2. **Immediate Cause**: lifespan 함수에서 Watchdog 시작만 하고 초기 스캔을 수행하지 않음
3. **Underlying Cause**: Watchdog은 파일 시스템 이벤트만 감지, 기존 파일에 대한 초기화 로직 부재
4. **Systemic Factor**: data/ 폴더의 상태와 DB 상태 간 동기화 메커니즘 미흡
5. **Root Cause**: 서버 시작 시점에 data/ 폴더와 DB의 일관성을 보장하는 초기화 프로세스 없음

### Impact

- 사용자가 매번 수동으로 `python scripts/ingest.py`를 실행해야 함
- 서버 재기동 후 데이터 누락 발생 가능
- 운영 편의성 저하

---

## Environment

### System Context

- **Runtime**: Python 3.11+, FastAPI 0.109.2
- **Database**: SQLite 3.40+
- **File System**: POSIX compliant (macOS, Linux)
- **Existing Components**:
  - `app/main.py`: FastAPI lifespan 관리
  - `app/sync_service.py`: 파일 동기화 서비스 (SyncService)
  - `app/file_watcher.py`: Watchdog 파일 감시자

### Constraints

- [HARD] 서버 시작 시간을 과도하게 지연시키지 않아야 함 (권장 5초 이내)
- [HARD] 기존 Watchdog 기능과 충돌하지 않아야 함
- [HARD] DB 트랜잭션 무결성 보장
- [SOFT] 대량 파일 존재 시 진행 상황 표시 권장

---

## Assumptions

1. **Data Directory**: `data/` 폴더가 프로젝트 루트에 존재
2. **File Naming**: HTML 파일명에서 날짜 추출 가능 (기존 로직 활용)
3. **DB Schema**: `data_source` 컬럼이 이미 존재 (SPEC-MTT-006)
4. **SyncService**: `sync_files()` 메서드가 이미 적재된 파일을 건너뛰는 로직 구현됨

---

## Requirements

### REQ-MTT-010-01: 서버 시작 시 자동 스캔

**WHEN** FastAPI 서버가 시작될 때 (lifespan startup)
**THEN** 시스템은 data/ 폴더의 모든 HTML 파일을 스캔하여 미적재 파일을 자동으로 DB에 적재해야 한다.

### REQ-MTT-010-02: 중복 적재 방지

**IF** 파일이 이미 DB에 적재되어 있는 경우 (날짜 + data_source 기준)
**THEN** 시스템은 해당 파일을 건너뛰고 로그에 기록해야 한다.

### REQ-MTT-010-03: 적재 결과 로깅

**WHEN** 초기 동기화가 완료될 때
**THEN** 시스템은 다음 정보를 INFO 레벨로 로깅해야 한다:
- 스캔한 파일 수
- 적재된 파일 수
- 건너뛴 파일 수
- 에러 발생 시 에러 목록

### REQ-MTT-010-04: Watchdog과의 통합

**WHEN** 초기 동기화가 완료된 후
**THEN** Watchdog 파일 감시자가 정상적으로 시작되어야 한다.

### REQ-MTT-010-05: 에러 격리

**IF** 개별 파일 적재 중 에러가 발생하면
**THEN** 시스템은 해당 파일의 에러를 로깅하고 다음 파일 처리를 계속해야 한다.

### REQ-MTT-010-06: 서버 시작 실패 방지

**IF** 초기 동기화 중 에러가 발생해도
**THEN** 서버 시작은 계속되어야 한다 (Graceful Degradation).

---

## Specifications

### Implementation Approach

#### Option A: SyncService 재사용 (Recommended)

기존 `SyncService.sync_files()` 메서드를 활용하여 서버 시작 시 자동 동기화 수행.

**장점**:
- 기존 코드 재사용으로 일관성 유지
- 중복 적재 방지 로직 이미 구현됨
- 에러 격리 로직 이미 구현됨

**단점**:
- SyncService가 동기 함수로 작성되어 있어 비동기 lifespan에서 호출 시 주의 필요

#### Option B: 별도 초기화 함수 작성

새로운 초기화 전용 함수 작성.

**장점**:
- 초기화 로직 독립 관리

**단점**:
- 코드 중복 발생 가능
- 유지보수 오버헤드

**Decision**: Option A 선택 (SyncService 재사용)

### Technical Design

```python
# app/main.py lifespan 함수 수정

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _file_observer, _file_watcher_handler

    # 데이터베이스 테이블 생성
    create_tables()

    # 초기 동기화 수행 (NEW: REQ-MTT-010-01)
    data_dir = Path(__file__).resolve().parent.parent.parent / "data"
    if data_dir.exists() and data_dir.is_dir():
        try:
            from app.sync_service import sync_service
            db = SessionLocal()
            try:
                result = sync_service.sync_files(data_dir, db)
                if result:
                    logger.info(
                        f"Initial sync completed: {result.files_processed} files processed, "
                        f"{result.files_skipped} skipped, {len(result.errors)} errors"
                    )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Initial sync failed: {e}")

    # Watchdog 파일 감시자 시작 (기존 로직 유지)
    ...
```

### File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `app/main.py` | Modify | lifespan 함수에 초기 동기화 로직 추가 |
| `app/sync_service.py` | None | 기존 코드 재사용 |

---

## Traceability

| Requirement | Source | Verification |
|-------------|--------|--------------|
| REQ-MTT-010-01 | User Request | Integration Test |
| REQ-MTT-010-02 | User Request | Unit Test |
| REQ-MTT-010-03 | User Request | Integration Test |
| REQ-MTT-010-04 | System Design | Integration Test |
| REQ-MTT-010-05 | Best Practice | Unit Test |
| REQ-MTT-010-06 | Best Practice | Integration Test |

---

## Related SPECs

- **SPEC-MTT-009**: HTML 자동 감지 및 DB 동기화 시스템 (기반 인프라)
- **SPEC-MTT-006**: 데이터 소스 분리 (data_source 컬럼)

---

## References

- FastAPI Lifspan Events: https://fastapi.tiangolo.com/advanced/events/
- SQLAlchemy Session Management: https://docs.sqlalchemy.org/en/20/orm/session.html
