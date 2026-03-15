# SPEC-MTT-014: 구현 계획

## 메타데이터

| 항목 | 값 |
|------|-----|
| SPEC ID | SPEC-MTT-014 |
| 우선순위 | Medium |
| 영향 파일 수 | 2개 (sync_service.py, file_watcher.py) |
| 위험도 | 낮음 (기존 upsert 로직 변경 없음) |

---

## 마일스톤

### 1차 목표 (Primary Goal): sync_files 마지막 날짜 재적재

**우선순위: High**

변경 대상: `backend/app/sync_service.py`

**작업 1-1: DB 최대 날짜 조회 헬퍼 추가**

- 새 메서드 `get_last_date_by_source(self, source: str, db: Session) -> Optional[str]` 추가
- `ThemeDaily` 테이블에서 해당 `data_source`의 `MAX(date)` 조회
- 결과를 문자열(YYYY-MM-DD) 또는 None으로 반환

**작업 1-2: `is_file_already_loaded()` 수정**

- 새 매개변수 추가: `last_db_date: Optional[str] = None`
- 기존 로직 전에 조건 추가:
  - 파일 날짜 추출 후, `date == last_db_date`이면 `False` 반환 (재적재 허용)
- 기존 호출부(`_process_file` 등)는 `last_db_date=None`으로 기존 동작 유지

**작업 1-3: `sync_files()` 수정**

- 파일 루프 진입 전, 소스별 마지막 날짜 딕셔너리 구성:
  ```
  last_dates = {
      "52w_high": self.get_last_date_by_source("52w_high", db),
      "mtt": self.get_last_date_by_source("mtt", db),
  }
  ```
- 루프 내 `is_file_already_loaded()` 호출 시 해당 소스의 `last_db_date` 전달
- 재적재 시 로그: `"Re-ingesting last date file: {file_path.name}"`

### 2차 목표 (Secondary Goal): FileWatcher on_modified 지원

**우선순위: Medium**

변경 대상: `backend/app/file_watcher.py`

**작업 2-1: `on_modified()` 핸들러 추가**

- `FileWatcherHandler` 클래스에 `on_modified()` 메서드 추가
- `on_created()`와 동일한 로직 적용:
  1. 디렉토리 이벤트 무시
  2. `.html` 확장자 확인
  3. `is_valid_html_pattern()` 패턴 확인
  4. `_process_file()` 호출
- 로그 메시지: `"Processing modified file: {file_path.name}"`

---

## 기술적 접근

### 아키텍처 설계 방향

- **최소 변경 원칙**: 기존 `ingest_file()` upsert 로직을 그대로 활용
- **하위 호환성**: `is_file_already_loaded()`의 새 매개변수는 기본값 `None`으로 기존 호출부 영향 없음
- **성능 최적화**: DB 최대 날짜 조회는 `sync_files()` 시작 시 소스당 1회만 수행

### 변경 영향 분석

| 파일 | 변경 유형 | 영향 범위 |
|------|----------|----------|
| `sync_service.py` | 메서드 수정 + 신규 메서드 | `sync_files`, `is_file_already_loaded` |
| `file_watcher.py` | 메서드 추가 | `FileWatcherHandler` 클래스 |

### 의존성

- `sync_service.py` 변경이 선행되어야 함 (1차 목표)
- `file_watcher.py` 변경은 독립적으로 수행 가능 (2차 목표)
- `ingest.py`는 변경 불요

---

## 위험 및 대응

| 위험 | 발생 가능성 | 대응 방안 |
|------|-----------|----------|
| 마지막 날짜 파일 반복 재적재로 성능 저하 | 낮음 | `ingest_file()` upsert가 이미 효율적; 마지막 날짜 파일은 소스당 최대 1개 |
| `on_modified` 이벤트 중복 발사 | 중간 | watchdog이 단일 파일 수정에 여러 이벤트를 발사할 수 있음; `_process_file()`의 기존 에러 핸들링으로 대응 |
| DB 최대 날짜 조회 시점과 파일 처리 시점 차이 | 낮음 | `sync_files()`는 단일 세션 내에서 순차 처리하므로 문제 없음 |

---

## 추적성

- spec.md: REQ-014-01 ~ REQ-014-05
- acceptance.md: ACC-01 ~ ACC-03

---

## 동작 방식: Watchdog vs sync_files()

### 핵심 차이

| 구분 | Watchdog (`on_created`/`on_modified`) | `sync_files()` |
|------|--------------------------------------|----------------|
| **과거 파일 복사** | ✅ 무조건 upsert | ❌ 건너뜀 |
| **과거 파일 수정** | ✅ 무조건 upsert | ❌ 건너뜀 |
| **마지막 파일** | ✅ 무조건 upsert | ✅ upsert |
| **신규 파일** | ✅ insert | ✅ insert |
| **DB 상태 체크** | ❌ 없음 (이벤트 기반) | ✅ 있음 (`is_file_already_loaded`) |

### Watchdog 동작 방식

```python
# file_watcher.py
def on_created(self, event):
    if not self._validate_html_file(file_path):
        return
    # 조건 없이 바로 처리
    self._process_file(file_path)  # → ingest_file() → 무조건 upsert

def on_modified(self, event):
    if not self._validate_html_file(file_path):
        return
    # 조건 없이 바로 처리
    self._process_file(file_path)  # → ingest_file() → 무조건 upsert
```

**특징:**
- 파일 시스템 이벤트만 감지
- DB 상태 체크 없음
- 유효한 패턴이면 무조건 처리

### sync_files() 동작 방식

```python
# sync_service.py
def sync_files(self, data_dir, db):
    # 소스별 마지막 날짜 조회
    last_dates = {
        SOURCE_52W: self.get_last_date_by_source(SOURCE_52W, db),
        SOURCE_MTT: self.get_last_date_by_source(SOURCE_MTT, db),
    }

    for file_path in html_files:
        # DB 상태 체크
        if self.is_file_already_loaded(file_path, db, last_db_date):
            result.files_skipped += 1
            continue  # 건너뜀

        # 처리
        self.ingest_single_file(file_path, db)
```

**특징:**
- DB 상태 체크 (`is_file_already_loaded`)
- 마지막 날짜 파일만 재적재 (SPEC-MTT-014 REQ-014-01)
- 과거 날짜 파일은 건너뜀 (REQ-014-02)

### 실제 시나리오

#### 시나리오 1: Backend Restart
```
서버 시작 → perform_initial_sync() → sync_files()
→ 2026-03-11 (과거): "Skipped already loaded file"
→ 2026-03-12 (과거): "Skipped already loaded file"
→ 2026-03-13 (마지막): "Re-ingesting last date file"
```

#### 시나리오 2: 과거 파일 복사 (Watchdog 실행 중)
```
cp 2026-03-11.html backend/data/
→ on_created() 감지 → "Processing new file"
→ 무조건 upsert
```

#### 시나리오 3: 과거 파일 수정 (Watchdog 실행 중)
```
# 파일 편집기로 열고 저장
→ on_modified() 감지 → "Processing modified file"
→ 무조건 upsert
```

### 설계 이유

| 구분 | 이유 |
|------|------|
| **Watchdog 무조건 처리** | 사용자가 파일을 복사/수정하는 명시적 행위는 재적재 의도로 간주 |
| **sync_files() 선택 처리** | 서버 시작 시 불필요한 재적재 방지, 마지막 날짜만 확정되지 않았을 수 있음 |

### ingest_file() 공통 로직

모든 경로에서 `ingest_file()`는 동일한 upsert 로직을 사용:

```python
# ThemeDaily: 존재하면 업데이트, 없으면 INSERT
existing = db.query(ThemeDaily).filter(...).first()
if existing:
    existing.stock_count = new_value
    existing.avg_rs = new_value
else:
    db.add(ThemeDaily(...))

# ThemeStockDaily: 무조건 삭제 후 재삽입
db.query(ThemeStockDaily).filter(...).delete()
for stock in stocks:
    db.add(ThemeStockDaily(...))
```

### 요약

- **Watchdog**: 파일 이벤트 = 사용자 의도 → 무조건 처리
- **sync_files()**: 서버 시작 = 자동 프로세스 → 최적화로 마지막만 처리
- **ingest_file()**: 호출되면 무조건 upsert (공통 로직)
