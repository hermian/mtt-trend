---
id: SPEC-MTT-009
title: HTML 자동 감지 및 DB 동기화 시스템 - 인수 기준
version: 1.0.0
status: draft
created: 2026-03-15
updated: 2026-03-15
author: Hosung Kim
priority: medium
---

# SPEC-MTT-009: 인수 기준 (Acceptance Criteria)

## 시나리오 목록

| ID | 시나리오 | 관련 요구사항 |
|----|----------|---------------|
| ACC-01 | 신규 HTML 파일 자동 감지 및 적재 | REQ-MTT-009-01, 02, 03, 18 |
| ACC-02 | 수동 동기화 API 호출 | REQ-MTT-009-06, 07, 08, 09 |
| ACC-03 | 중복 파일 처리 (UPSERT) | REQ-MTT-009-14 |
| ACC-04 | 오류 파일 및 비정상 파일 처리 | REQ-MTT-009-04, 05, 15, 16 |
| ACC-05 | 프론트엔드 동기화 버튼 동작 | REQ-MTT-009-10, 11, 12, 13 |

---

## ACC-01: 신규 HTML 파일 자동 감지 및 적재

### 시나리오 1-1: 52주 신고가 HTML 파일 자동 감지

```gherkin
Given FastAPI 서버가 실행 중이고 Watchdog Observer가 활성 상태일 때
  And backend/data/ 폴더에 "★52Week_High_Stocks_By_Theme_With_RS_Scores_2026-03-15.html" 파일이 존재하지 않을 때
When 해당 파일을 backend/data/ 폴더에 복사하면
Then 시스템은 파일을 자동으로 감지하여 파싱한다
  And theme_daily 테이블에 date="2026-03-15", data_source="52w_high" 레코드가 생성된다
  And theme_stock_daily 테이블에 해당 날짜의 종목 데이터가 생성된다
  And INFO 로그에 파일명, 적재된 테마 수, 적재된 종목 수가 기록된다
```

### 시나리오 1-2: MTT 템플릿 HTML 파일 자동 감지

```gherkin
Given FastAPI 서버가 실행 중이고 Watchdog Observer가 활성 상태일 때
When "★Themes_With_7_or_More_MTT_Stocks-Top7_2026-03-15.html" 파일을 backend/data/ 폴더에 복사하면
Then 시스템은 파일을 자동으로 감지하여 파싱한다
  And theme_daily 테이블에 date="2026-03-15", data_source="mtt" 레코드가 생성된다
  And theme_stock_daily 테이블에 해당 날짜의 종목 데이터가 생성된다
```

### 시나리오 1-3: 서버 종료 시 Watchdog 정상 종료

```gherkin
Given FastAPI 서버가 실행 중이고 Watchdog Observer가 활성 상태일 때
When FastAPI 서버가 종료(shutdown)되면
Then Watchdog Observer가 stop() 및 join()으로 정상 종료된다
  And 관련 리소스가 해제된다
  And 오류 없이 프로세스가 종료된다
```

---

## ACC-02: 수동 동기화 API 호출

### 시나리오 2-1: 미적재 파일이 있을 때 수동 동기화

```gherkin
Given backend/data/ 폴더에 3개의 HTML 파일이 존재하고
  And 그 중 2개는 이미 DB에 적재되어 있고
  And 1개는 아직 적재되지 않았을 때
When POST /api/sync 요청을 보내면
Then 응답 상태 코드는 200이다
  And 응답 JSON의 total_files_scanned는 3이다
  And 응답 JSON의 files_processed는 1이다
  And 응답 JSON의 files_skipped는 2이다
  And 응답 JSON의 errors는 빈 배열이다
  And 미적재 파일의 데이터가 DB에 생성된다
```

### 시나리오 2-2: 모든 파일이 이미 적재된 경우

```gherkin
Given backend/data/ 폴더의 모든 HTML 파일이 이미 DB에 적재되어 있을 때
When POST /api/sync 요청을 보내면
Then 응답 상태 코드는 200이다
  And 응답 JSON의 files_processed는 0이다
  And 응답 JSON의 files_skipped가 전체 파일 수와 같다
```

### 시나리오 2-3: 동시 동기화 요청 차단

```gherkin
Given 동기화 작업이 현재 진행 중일 때
When 추가 POST /api/sync 요청을 보내면
Then 응답 상태 코드는 409 (Conflict)이다
  And 응답 JSON의 detail은 "Sync already in progress"이다
  And 기존 동기화 작업은 영향 없이 계속 진행된다
```

---

## ACC-03: 중복 파일 처리 (UPSERT)

### 시나리오 3-1: 동일 날짜/소스의 데이터 재적재

```gherkin
Given theme_daily 테이블에 date="2026-03-15", theme_name="AI", data_source="52w_high" 레코드가 이미 존재하고
  And 해당 레코드의 avg_rs가 45.0일 때
When 같은 날짜의 HTML 파일을 POST /api/sync로 다시 적재하면
Then 기존 레코드가 새 데이터로 업데이트된다 (INSERT OR REPLACE)
  And UNIQUE 제약 조건 위반 오류가 발생하지 않는다
  And 응답 JSON의 errors는 빈 배열이다
```

### 시나리오 3-2: 서로 다른 data_source의 같은 날짜 데이터

```gherkin
Given theme_daily 테이블에 date="2026-03-15", data_source="52w_high" 데이터가 존재할 때
When date="2026-03-15", data_source="mtt"인 HTML 파일을 적재하면
Then 새로운 레코드가 생성된다 (다른 data_source이므로 중복 아님)
  And 기존 52w_high 데이터는 영향받지 않는다
```

---

## ACC-04: 오류 파일 및 비정상 파일 처리

### 시나리오 4-1: 비-HTML 파일 무시

```gherkin
Given Watchdog Observer가 활성 상태일 때
When backend/data/ 폴더에 "report.txt" 파일이 추가되면
Then 시스템은 해당 파일을 무시한다
  And 파싱이나 DB 적재 시도를 하지 않는다
  And 로그에 처리 관련 기록이 남지 않는다
```

### 시나리오 4-2: 패턴 불일치 HTML 파일 경고

```gherkin
Given Watchdog Observer가 활성 상태일 때
When backend/data/ 폴더에 "custom_report_2026-03-15.html" 파일이 추가되면
Then 시스템은 해당 파일의 적재를 시도하지 않는다
  And WARNING 로그에 "Unrecognized HTML file pattern: custom_report_2026-03-15.html" 형태의 경고가 기록된다
```

### 시나리오 4-3: 손상된 HTML 파일의 개별 오류 격리

```gherkin
Given backend/data/ 폴더에 3개의 HTML 파일이 존재하고
  And 그 중 1개(file_B)의 HTML 내용이 손상되어 파싱이 불가능할 때
When POST /api/sync 요청을 보내면
Then file_B를 제외한 2개 파일은 정상적으로 적재된다
  And 응답 JSON의 files_processed는 2이다
  And 응답 JSON의 errors에 file_B의 파일명과 오류 메시지가 포함된다
  And 전체 동기화 작업이 중단되지 않는다
```

### 시나리오 4-4: data/ 폴더에 파일이 없는 경우

```gherkin
Given backend/data/ 폴더에 HTML 파일이 하나도 없을 때
When POST /api/sync 요청을 보내면
Then 응답 상태 코드는 200이다
  And 응답 JSON의 total_files_scanned는 0이다
  And 응답 JSON의 files_processed는 0이다
```

---

## ACC-05: 프론트엔드 동기화 버튼 동작

### 시나리오 5-1: 동기화 버튼 클릭 및 성공 표시

```gherkin
Given 대시보드 페이지가 로드되어 있고
  And 동기화 버튼이 활성(enabled) 상태일 때
When 사용자가 동기화 버튼을 클릭하면
Then 버튼이 비활성화(disabled) 상태로 변경된다
  And 로딩 스피너가 표시된다
  And POST /api/sync API가 호출된다
  And API 응답 수신 후 성공 토스트 알림이 표시된다
  And 토스트에 "N개 파일 처리 완료" 형태의 메시지가 포함된다
  And 버튼이 다시 활성(enabled) 상태로 복원된다
```

### 시나리오 5-2: 동기화 중 버튼 비활성화

```gherkin
Given 동기화 요청이 진행 중일 때
When 사용자가 동기화 버튼 영역을 클릭하면
Then 버튼은 비활성화 상태이므로 추가 API 호출이 발생하지 않는다
  And 로딩 스피너가 계속 표시된다
```

### 시나리오 5-3: 동기화 실패 시 오류 표시

```gherkin
Given 대시보드 페이지가 로드되어 있을 때
When 사용자가 동기화 버튼을 클릭하고
  And API 응답의 errors 배열에 오류가 포함되어 있으면
Then 경고 토스트 알림이 표시된다
  And 토스트에 "N개 파일 처리 완료, M개 오류 발생" 형태의 메시지가 포함된다
  And 버튼이 다시 활성 상태로 복원된다
```

### 시나리오 5-4: 네트워크 오류 시 처리

```gherkin
Given 대시보드 페이지가 로드되어 있고
  And 백엔드 서버가 응답하지 않을 때
When 사용자가 동기화 버튼을 클릭하면
Then 네트워크 오류 토스트 알림이 표시된다
  And 버튼이 다시 활성 상태로 복원된다
```

---

## 품질 게이트 (Quality Gates)

### 테스트 커버리지

| 영역 | 최소 커버리지 |
|------|--------------|
| `sync_service.py` | 85% |
| `routers/sync.py` | 85% |
| `file_watcher.py` | 80% |
| `SyncButton.tsx` | 80% |

### 검증 방법

| 검증 항목 | 도구 | 기준 |
|-----------|------|------|
| 단위 테스트 | pytest | 모든 시나리오 통과 |
| 타입 검사 | mypy | 오류 0건 |
| 코드 포맷 | black | 포맷 일치 |
| API 테스트 | httpx (TestClient) | 모든 엔드포인트 검증 |
| 프론트엔드 테스트 | React Testing Library | 버튼 상태 전환 검증 |

### Definition of Done

- [ ] 모든 인수 기준(ACC-01 ~ ACC-05) 시나리오 통과
- [ ] 백엔드 테스트 커버리지 85% 이상
- [ ] 프론트엔드 SyncButton 컴포넌트 테스트 작성
- [ ] `watchdog>=4.0.0` 의존성 추가 완료
- [ ] 기존 `ingest.py` CLI 기능 회귀 테스트 통과
- [ ] API 문서(Swagger) 자동 생성 확인
- [ ] INFO/WARNING 로그 출력 확인
- [ ] 중복 실행 방지(409 Conflict) 동작 확인

---

## 추적성

| 시나리오 | 관련 요구사항 | 관련 마일스톤 |
|----------|---------------|---------------|
| ACC-01 | REQ-MTT-009-01, 02, 03, 18 | Secondary Goal |
| ACC-02 | REQ-MTT-009-06, 07, 08, 09 | Primary Goal |
| ACC-03 | REQ-MTT-009-14 | Primary Goal |
| ACC-04 | REQ-MTT-009-04, 05, 15, 16 | Primary Goal, Secondary Goal |
| ACC-05 | REQ-MTT-009-10, 11, 12, 13 | Tertiary Goal |
