---
id: SPEC-MTT-009
title: HTML 자동 감지 및 DB 동기화 시스템
version: 1.0.0
status: Completed
created: 2026-03-15
updated: 2026-03-15
author: Hosung Kim
priority: medium
issue_number: 0
tags: [watchdog, sync, ingestion, automation]
---

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-03-15 | Hosung Kim | 최초 작성 |

---

# SPEC-MTT-009: HTML 자동 감지 및 DB 동기화 시스템

## 1. 개요

`backend/data/` 폴더에 새로운 HTML 리포트 파일이 추가되면 자동으로 감지하여 데이터베이스에 적재하고, 수동 동기화 API와 프론트엔드 동기화 버튼을 통해 사용자가 직접 동기화를 트리거할 수 있는 시스템을 구축한다.

### 배경

현재 HTML 리포트 파일의 DB 적재는 `backend/scripts/ingest.py` CLI 스크립트를 수동으로 실행해야 한다. 이는 데이터 적재 지연과 운영 부담을 초래한다. 본 SPEC은 파일 시스템 감시(Watchdog)를 통한 자동 감지와 REST API를 통한 수동 동기화를 통합하여 데이터 파이프라인을 자동화한다.

### 범위

- Python Watchdog 라이브러리를 이용한 파일 시스템 감시
- FastAPI lifespan 통합
- 수동 동기화 REST API 엔드포인트
- 프론트엔드 동기화 버튼 UI 컴포넌트
- 중복 방지 및 오류 처리

### 범위 외

- 외부 파일 저장소(S3, GCS) 연동
- 스케줄러 기반 주기적 동기화 (cron)
- 파일 업로드 API (파일은 직접 폴더에 복사)

---

## 2. 환경 (Environment)

| 항목 | 내용 |
|------|------|
| 백엔드 런타임 | Python 3.11+ |
| 웹 프레임워크 | FastAPI >= 0.109.2 |
| ORM | SQLAlchemy >= 2.0.28 |
| 파일 감시 | watchdog >= 4.0.0 |
| 데이터베이스 | SQLite 3.40+ |
| 프론트엔드 | Next.js 16 + React + TypeScript |
| 기존 스크립트 | `backend/scripts/ingest.py` |
| 데이터 폴더 | `backend/data/` |

---

## 3. 가정 (Assumptions)

- A1: HTML 파일은 기존 파일명 패턴(`★52Week_High_...YYYY-MM-DD.html`, `★Themes_With_7_...YYYY-MM-DD.html`)을 따른다
- A2: 파일은 `backend/data/` 폴더에 직접 복사/이동 방식으로 추가된다
- A3: 기존 `ingest.py`의 파싱 로직은 안정적이며 재사용 가능하다
- A4: SQLite의 UNIQUE 제약 조건 `(date, theme_name, data_source)`이 중복 방지를 보장한다
- A5: 동시에 여러 파일이 추가될 수 있으나, 동시 동기화 요청은 순차 처리한다
- A6: FastAPI 서버가 실행 중일 때만 Watchdog 감시가 활성화된다

---

## 4. 요구사항 (Requirements)

### 모듈 1: 자동 파일 감지 (Watchdog)

**REQ-MTT-009-01** [Ubiquitous]
시스템은 **항상** FastAPI 서버 시작 시 Watchdog Observer를 생성하여 `backend/data/` 폴더를 감시해야 한다.

**REQ-MTT-009-02** [Event-Driven]
**WHEN** `backend/data/` 폴더에 `.html` 확장자의 새 파일이 생성(created) 또는 이동(moved)되면, **THEN** 시스템은 해당 파일을 자동으로 파싱하여 데이터베이스에 적재해야 한다.

**REQ-MTT-009-03** [Event-Driven]
**WHEN** FastAPI 서버가 종료되면, **THEN** 시스템은 Watchdog Observer를 정상적으로 중지(stop)하고 리소스를 해제해야 한다.

**REQ-MTT-009-04** [Unwanted]
시스템은 `.html` 확장자가 아닌 파일의 생성/수정 이벤트에 대해 적재 작업을 수행**하지 않아야 한다**.

**REQ-MTT-009-05** [Complex]
**IF** Watchdog Observer가 실행 중인 상태에서 **AND WHEN** 파일명이 기존 패턴(`★52Week_High_...` 또는 `★Themes_With_7_...`)과 일치하지 않는 `.html` 파일이 감지되면, **THEN** 시스템은 해당 파일을 무시하고 경고 로그를 기록해야 한다.

### 모듈 2: 수동 동기화 API

**REQ-MTT-009-06** [Ubiquitous]
시스템은 **항상** `POST /api/sync` 엔드포인트를 제공하여 수동 동기화를 지원해야 한다.

**REQ-MTT-009-07** [Event-Driven]
**WHEN** `POST /api/sync` 요청이 수신되면, **THEN** 시스템은 `backend/data/` 폴더의 모든 HTML 파일을 스캔하여 아직 DB에 적재되지 않은 파일을 식별하고 적재해야 한다.

**REQ-MTT-009-08** [Event-Driven]
**WHEN** 수동 동기화가 완료되면, **THEN** 시스템은 처리된 파일 수, 새로 적재된 레코드 수, 건너뛴 파일 수, 오류 목록을 포함한 JSON 응답을 반환해야 한다.

**REQ-MTT-009-09** [Unwanted]
시스템은 이미 진행 중인 동기화 작업이 있을 때 추가 `POST /api/sync` 요청에 대해 중복 실행을 수행**하지 않아야 한다** (409 Conflict 응답 반환).

### 모듈 3: 프론트엔드 동기화 버튼

**REQ-MTT-009-10** [Ubiquitous]
프론트엔드는 **항상** 대시보드 UI에 동기화 버튼을 표시해야 한다.

**REQ-MTT-009-11** [Event-Driven]
**WHEN** 사용자가 동기화 버튼을 클릭하면, **THEN** 프론트엔드는 `POST /api/sync` API를 호출하고 로딩 상태를 표시해야 한다.

**REQ-MTT-009-12** [Event-Driven]
**WHEN** 동기화 API 응답이 수신되면, **THEN** 프론트엔드는 처리 결과(처리된 파일 수, 오류 여부)를 토스트 알림으로 표시해야 한다.

**REQ-MTT-009-13** [State-Driven]
**IF** 동기화가 진행 중인 상태이면, **THEN** 동기화 버튼은 비활성화(disabled) 상태로 전환되고 로딩 스피너를 표시해야 한다.

### 모듈 4: 중복 방지 및 오류 처리

**REQ-MTT-009-14** [Ubiquitous]
시스템은 **항상** 기존 DB의 UNIQUE 제약 조건 `(date, theme_name, data_source)`을 활용하여 UPSERT(INSERT OR REPLACE) 동작으로 중복 데이터를 방지해야 한다.

**REQ-MTT-009-15** [Unwanted]
시스템은 파싱 실패한 파일로 인해 전체 동기화 작업이 중단되는 상황이 발생**하지 않아야 한다** (개별 파일 단위 오류 격리).

**REQ-MTT-009-16** [Event-Driven]
**WHEN** 특정 HTML 파일의 파싱 중 오류가 발생하면, **THEN** 시스템은 해당 파일명과 오류 내용을 로그에 기록하고 다음 파일 처리를 계속해야 한다.

### 모듈 5: 동기화 상태 피드백

**REQ-MTT-009-17** [Optional]
**가능하면** 시스템은 `GET /api/sync/status` 엔드포인트를 제공하여 마지막 동기화 시각, 감시 중인 폴더 경로, Watchdog Observer 상태 정보를 반환해야 한다.

**REQ-MTT-009-18** [Event-Driven]
**WHEN** 자동 감지에 의해 파일이 성공적으로 적재되면, **THEN** 시스템은 INFO 레벨 로그에 파일명, 적재된 테마 수, 적재된 종목 수를 기록해야 한다.

---

## 5. 사양 (Specifications)

### 5.1 API 사양

#### POST /api/sync

- **요청**: Body 없음
- **응답 (200 OK)**:

```json
{
  "status": "completed",
  "total_files_scanned": 10,
  "files_processed": 3,
  "files_skipped": 7,
  "records_created": 45,
  "errors": [],
  "started_at": "2026-03-15T10:30:00Z",
  "completed_at": "2026-03-15T10:30:05Z"
}
```

- **응답 (409 Conflict)**:

```json
{
  "detail": "Sync already in progress"
}
```

#### GET /api/sync/status (Optional)

- **응답 (200 OK)**:

```json
{
  "watchdog_active": true,
  "watched_directory": "backend/data/",
  "last_sync_at": "2026-03-15T10:30:05Z",
  "last_sync_result": {
    "files_processed": 3,
    "errors": []
  }
}
```

### 5.2 파일 감지 규칙

| 파일명 패턴 | data_source | 처리 방식 |
|-------------|-------------|-----------|
| `★52Week_High_Stocks_By_Theme_With_RS_Scores_YYYY-MM-DD.html` | `52w_high` | 자동 파싱 및 적재 |
| `★Themes_With_7_or_More_MTT_Stocks-Top7_YYYY-MM-DD.html` | `mtt` | 자동 파싱 및 적재 |
| 기타 `.html` 파일 | - | 무시 (경고 로그) |
| `.html` 외 파일 | - | 완전 무시 |

### 5.3 동기화 로직

```
1. backend/data/ 폴더의 모든 .html 파일 목록 획득
2. 각 파일에 대해:
   a. 파일명 패턴 매칭으로 date와 data_source 추출
   b. DB에서 해당 (date, data_source)의 레코드 존재 여부 확인
   c. 미적재 파일인 경우 ingest.py 로직으로 파싱 및 적재
   d. 오류 발생 시 오류 목록에 추가하고 다음 파일로 이동
3. 결과 요약 반환
```

### 5.4 수정 대상 파일

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `backend/requirements.txt` | 수정 | `watchdog>=4.0.0` 추가 |
| `backend/app/main.py` | 수정 | lifespan에 Watchdog Observer 통합 |
| `backend/app/routers/sync.py` | 신규 | `/api/sync` 엔드포인트 라우터 |
| `frontend/src/app/_components/SyncButton.tsx` | 신규 | 동기화 버튼 컴포넌트 |
| `frontend/src/app/page.tsx` 또는 레이아웃 | 수정 | SyncButton 배치 |

---

## 6. 추적성 (Traceability)

| 요구사항 ID | 관련 파일 | 테스트 시나리오 |
|-------------|-----------|-----------------|
| REQ-MTT-009-01 | `backend/app/main.py` | ACC-01 |
| REQ-MTT-009-02 | `backend/app/main.py` | ACC-01 |
| REQ-MTT-009-03 | `backend/app/main.py` | ACC-01 |
| REQ-MTT-009-04 | `backend/app/main.py` | ACC-04 |
| REQ-MTT-009-05 | `backend/app/main.py` | ACC-04 |
| REQ-MTT-009-06 | `backend/app/routers/sync.py` | ACC-02 |
| REQ-MTT-009-07 | `backend/app/routers/sync.py` | ACC-02 |
| REQ-MTT-009-08 | `backend/app/routers/sync.py` | ACC-02 |
| REQ-MTT-009-09 | `backend/app/routers/sync.py` | ACC-02 |
| REQ-MTT-009-10 | `frontend/.../SyncButton.tsx` | ACC-05 |
| REQ-MTT-009-11 | `frontend/.../SyncButton.tsx` | ACC-05 |
| REQ-MTT-009-12 | `frontend/.../SyncButton.tsx` | ACC-05 |
| REQ-MTT-009-13 | `frontend/.../SyncButton.tsx` | ACC-05 |
| REQ-MTT-009-14 | `backend/app/routers/sync.py` | ACC-03 |
| REQ-MTT-009-15 | `backend/app/routers/sync.py` | ACC-04 |
| REQ-MTT-009-16 | `backend/app/routers/sync.py` | ACC-04 |
| REQ-MTT-009-17 | `backend/app/routers/sync.py` | ACC-02 |
| REQ-MTT-009-18 | `backend/app/main.py` | ACC-01 |
