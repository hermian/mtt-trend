# SPEC-MTT-014: 마지막 날짜 HTML 파일 덮어쓰기 처리

## 메타데이터

| 항목 | 값 |
|------|-----|
| ID | SPEC-MTT-014 |
| 제목 | 마지막 날짜 HTML 파일 덮어쓰기 처리 (Last Date HTML File Overwrite Handling) |
| 도메인 | FIX/UPDATE |
| 우선순위 | Medium |
| 상태 | Completed |
| 작성자 | Hosung Kim |
| 이슈 번호 | 0 |

---

## 환경 (Environment)

- **프로젝트**: mtt-trend (테마/종목 트렌드 분석 시스템)
- **영향 범위**: `backend/app/sync_service.py`, `backend/app/file_watcher.py`
- **데이터 소스**: `52w_high` (52주 신고가), `mtt` (MTT 종목) HTML 파일
- **DB**: SQLite/PostgreSQL - `ThemeDaily`, `ThemeStockDaily` 테이블
- **기존 동작**: `ingest_file()` 함수는 이미 upsert를 올바르게 처리함 (ThemeDaily 업데이트, ThemeStockDaily 삭제 후 재삽입)

---

## 가정 (Assumptions)

1. DB에 저장된 **마지막 날짜**(최대 날짜)의 데이터는 아직 확정되지 않았을 수 있다 (같은 날 파일이 여러 번 업데이트될 수 있음)
2. 마지막 날짜 이전의 과거 데이터는 확정된 것으로 간주하여 재적재하지 않는다
3. `ingest_file()` 함수의 upsert 로직은 이미 정상 동작하므로 수정 불요
4. 데이터 소스(`52w_high`, `mtt`)별로 마지막 날짜가 다를 수 있다
5. 파일 덮어쓰기(overwrite)는 watchdog의 `on_modified` 이벤트로 감지 가능하다

---

## 요구사항 (Requirements)

### 모듈 1: 마지막 날짜 재적재 허용 (sync_files 개선)

**REQ-014-01**: 마지막 날짜 파일 재적재

> **WHEN** `sync_files()`가 HTML 파일을 스캔하고 **AND** 해당 파일의 날짜가 해당 소스의 DB 최대 날짜와 동일한 경우, **THEN** 시스템은 해당 파일을 재적재(re-ingest)해야 한다 (건너뛰지 않음).

**REQ-014-02**: 과거 날짜 파일 건너뛰기 (기존 동작 유지)

> **WHEN** `sync_files()`가 HTML 파일을 스캔하고 **AND** 해당 파일의 날짜가 해당 소스의 DB 최대 날짜보다 이전인 경우, **THEN** 시스템은 해당 파일을 건너뛰어야 한다.

**REQ-014-03**: 신규 날짜 파일 적재 (기존 동작 유지)

> **WHERE** 해당 파일의 날짜에 대한 DB 데이터가 존재하지 않는 경우, 시스템은 해당 파일을 정상 적재해야 한다.

### 모듈 2: 파일 감시 on_modified 처리 (FileWatcher 개선)

**REQ-014-04**: 파일 수정 이벤트 감지

> **WHEN** data 폴더에서 파일이 제자리 수정(overwrite)되고 **AND** 해당 파일이 알려진 HTML 패턴과 일치하는 경우, **THEN** 시스템은 해당 파일의 재적재를 트리거해야 한다.

**REQ-014-05**: 비유효 파일 수정 무시

> 시스템은 알려진 HTML 패턴과 일치하지 않는 파일의 수정 이벤트를 **무시해야 한다**.

---

## 명세 (Specifications)

### SPEC-014-01: `is_file_already_loaded()` 메서드 수정

- 새 매개변수 추가: `last_db_date: Optional[str]`
- 파일 날짜 == `last_db_date`인 경우 `False` 반환 (재적재 허용)
- 그 외의 경우 기존 로직 유지 (날짜+소스 존재 시 `True` 반환)

### SPEC-014-02: `sync_files()` 메서드 수정

- 파일 루프 진입 전, 각 소스별(`52w_high`, `mtt`) DB 최대 날짜를 1회 조회
- `is_file_already_loaded()` 호출 시 해당 소스의 `last_db_date`를 전달
- 마지막 날짜 파일 재적재 시 로그 메시지에 "re-ingesting last date" 명시

### SPEC-014-03: `FileWatcherHandler`에 `on_modified()` 추가

- `on_modified()` 핸들러를 `on_created()`와 동일한 패턴 검증 로직으로 구현
- 유효한 HTML 파일인 경우 `_process_file()` 호출
- 디렉토리 이벤트는 무시

---

## 제약사항 (Constraints)

1. 과거 날짜(마지막 날짜 이전) 데이터의 재적재를 허용해서는 안 된다
2. `ingest_file()` 함수 자체는 수정하지 않는다 (이미 upsert 정상 동작)
3. 기존 sync 동작(과거 날짜 건너뛰기, 신규 날짜 적재)을 깨뜨리지 않아야 한다
4. 성능: DB 최대 날짜 조회는 소스당 1회만 수행한다 (`sync_files` 시작 시)

---

## 추적성 (Traceability)

| 요구사항 | 구현 파일 | 테스트 시나리오 |
|----------|----------|--------------|
| REQ-014-01 | `sync_service.py` | ACC-01 |
| REQ-014-02 | `sync_service.py` | ACC-02 |
| REQ-014-03 | `sync_service.py` | ACC-02 (기존 동작) |
| REQ-014-04 | `file_watcher.py` | ACC-03 |
| REQ-014-05 | `file_watcher.py` | ACC-03 |
