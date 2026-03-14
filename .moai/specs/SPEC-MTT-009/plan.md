---
id: SPEC-MTT-009
title: HTML 자동 감지 및 DB 동기화 시스템 - 구현 계획
version: 1.0.0
status: draft
created: 2026-03-15
updated: 2026-03-15
author: Hosung Kim
priority: medium
---

# SPEC-MTT-009: 구현 계획

## 1. 마일스톤

### Primary Goal: 백엔드 동기화 핵심 기능

기존 `ingest.py` 로직을 모듈화하고, 수동 동기화 API 엔드포인트를 구축한다.

| 단계 | 작업 내용 | 관련 요구사항 |
|------|-----------|---------------|
| 1-1 | `ingest.py`에서 파싱 로직을 함수로 추출하여 `backend/app/services/sync_service.py`로 분리 | REQ-MTT-009-07 |
| 1-2 | `backend/app/routers/sync.py` 라우터 생성 (`POST /api/sync`) | REQ-MTT-009-06, 08 |
| 1-3 | 동기화 중복 실행 방지 (threading.Lock 또는 asyncio.Lock) | REQ-MTT-009-09 |
| 1-4 | 미적재 파일 식별 로직 구현 (파일 목록 vs DB 레코드 비교) | REQ-MTT-009-07 |
| 1-5 | 개별 파일 오류 격리 및 오류 수집 | REQ-MTT-009-15, 16 |
| 1-6 | `backend/app/main.py`에 sync 라우터 등록 | REQ-MTT-009-06 |

### Secondary Goal: Watchdog 파일 감시 통합

Watchdog Observer를 FastAPI lifespan에 통합하여 자동 파일 감지를 구현한다.

| 단계 | 작업 내용 | 관련 요구사항 |
|------|-----------|---------------|
| 2-1 | `backend/requirements.txt`에 `watchdog>=4.0.0` 추가 | - |
| 2-2 | `backend/app/services/file_watcher.py` 생성 (FileSystemEventHandler 서브클래스) | REQ-MTT-009-02, 04, 05 |
| 2-3 | `.html` 확장자 필터링 및 파일명 패턴 매칭 로직 | REQ-MTT-009-04, 05 |
| 2-4 | `backend/app/main.py` lifespan에 Observer 시작/종료 통합 | REQ-MTT-009-01, 03 |
| 2-5 | 파일 이벤트 디바운싱 (같은 파일에 대한 연속 이벤트 병합) | REQ-MTT-009-02 |

### Tertiary Goal: 프론트엔드 동기화 UI

프론트엔드에 동기화 버튼 컴포넌트를 추가한다.

| 단계 | 작업 내용 | 관련 요구사항 |
|------|-----------|---------------|
| 3-1 | `SyncButton.tsx` 컴포넌트 생성 | REQ-MTT-009-10 |
| 3-2 | `POST /api/sync` API 호출 및 로딩 상태 관리 | REQ-MTT-009-11, 13 |
| 3-3 | 동기화 결과 토스트 알림 표시 | REQ-MTT-009-12 |
| 3-4 | 대시보드 레이아웃에 SyncButton 배치 | REQ-MTT-009-10 |

### Optional Goal: 동기화 상태 모니터링

동기화 상태 조회 API를 추가한다.

| 단계 | 작업 내용 | 관련 요구사항 |
|------|-----------|---------------|
| 4-1 | `GET /api/sync/status` 엔드포인트 추가 | REQ-MTT-009-17 |
| 4-2 | 마지막 동기화 결과 메모리 저장 | REQ-MTT-009-17 |
| 4-3 | Watchdog Observer 상태 조회 | REQ-MTT-009-17 |

---

## 2. 기술 결정

### 2.1 Watchdog 라이브러리 선택

- **선택**: `watchdog >= 4.0.0`
- **근거**: Python 파일 시스템 감시의 사실상 표준. 크로스 플랫폼(macOS FSEvents, Linux inotify, Windows ReadDirectoryChanges) 지원. 가볍고 안정적.
- **대안 검토**: `inotify` (Linux 전용), `polling` (CPU 비효율), `asyncinotify` (Linux 전용, async 지원)

### 2.2 FastAPI Lifespan 통합 패턴

- **선택**: 기존 `asynccontextmanager` lifespan에 Observer 시작/종료 로직 추가
- **근거**: FastAPI 공식 권장 패턴. 서버 시작/종료 시 리소스 관리가 자연스러움.
- **구현 방식**: lifespan의 `yield` 전에 Observer.start(), `yield` 후에 Observer.stop() + Observer.join()

### 2.3 기존 ingest.py 재사용 전략

- **선택**: `ingest.py`의 핵심 파싱 함수를 `app/services/sync_service.py`로 리팩터링
- **근거**: DRY 원칙. 기존 파싱 로직은 검증 완료 상태. CLI와 API 양쪽에서 공유 가능.
- **주의점**: `ingest.py`는 기존 CLI 사용도 유지해야 하므로, 공유 함수를 import하는 방식

### 2.4 동기화 락 메커니즘

- **선택**: `threading.Lock` (단일 프로세스 환경)
- **근거**: SQLite는 단일 프로세스 접근에 최적화. Watchdog와 API 동기화 간 경합 방지.
- **대안**: `asyncio.Lock` (async 컨텍스트에서만 유효), 파일 락 (불필요한 복잡성)

### 2.5 미적재 파일 식별 방식

- **선택**: 파일명에서 날짜 추출 후 DB의 `(date, data_source)` 조합으로 존재 여부 확인
- **근거**: 기존 UNIQUE 제약 조건 활용. 추가 메타데이터 테이블 불필요.
- **UPSERT 동작**: 이미 존재하는 데이터는 INSERT OR REPLACE로 덮어쓰기 (데이터 갱신 지원)

---

## 3. 아키텍처 설계 방향

### 3.1 컴포넌트 구조

```
backend/
├── app/
│   ├── main.py                    # lifespan에 Watchdog 통합
│   ├── routers/
│   │   ├── sync.py                # [신규] /api/sync 엔드포인트
│   │   ├── themes.py
│   │   └── stocks.py
│   └── services/
│       └── sync_service.py        # [신규] 동기화 비즈니스 로직
├── scripts/
│   └── ingest.py                  # 기존 CLI (sync_service 활용)
└── requirements.txt               # watchdog 추가

frontend/
└── src/app/
    └── _components/
        └── SyncButton.tsx         # [신규] 동기화 버튼
```

### 3.2 데이터 흐름

```
[파일 추가] → [Watchdog FileSystemEventHandler]
                    │
                    ├─ .html 확장자 확인
                    ├─ 파일명 패턴 매칭
                    └─ sync_service.ingest_file() 호출
                           │
                           ├─ HTML 파싱 (BeautifulSoup)
                           ├─ 데이터 추출 (date, themes, stocks)
                           └─ DB UPSERT (SQLAlchemy)

[사용자 버튼 클릭] → [POST /api/sync]
                          │
                          ├─ Lock 획득 (중복 방지)
                          ├─ 폴더 스캔
                          ├─ 미적재 파일 식별
                          ├─ sync_service.ingest_file() 루프
                          └─ 결과 JSON 반환
```

---

## 4. 리스크 분석

### Risk 1: 파일 쓰기 중 감지 (파일 잠금)

- **위험도**: 중간
- **설명**: 대용량 HTML 파일 복사 중 Watchdog가 이벤트를 발행하면, 불완전한 파일을 읽을 수 있다
- **대응**: 파일 이벤트 발생 후 짧은 지연(1~2초) 후 파일 크기 안정화 확인. `on_closed` 이벤트 우선 사용 (Watchdog 4.0+ 지원)

### Risk 2: 동시 동기화 요청 경합

- **위험도**: 낮음
- **설명**: Watchdog 자동 감지와 수동 `POST /api/sync`가 동시에 같은 파일을 처리
- **대응**: `threading.Lock`으로 동기화 작업 직렬화. UPSERT로 데이터 일관성 보장.

### Risk 3: 대량 파일 배치 처리 시 응답 지연

- **위험도**: 중간
- **설명**: `POST /api/sync`에서 수십 개 파일 처리 시 HTTP 응답이 지연될 수 있다
- **대응**: 동기 처리 유지하되, 파일당 처리 시간 로깅. 향후 필요 시 백그라운드 태스크로 전환 가능.

### Risk 4: Watchdog macOS FSEvents 지연

- **위험도**: 낮음
- **설명**: macOS에서 FSEvents는 이벤트 전달에 약간의 지연이 있을 수 있다
- **대응**: 개발 환경 특성으로 허용 가능. 프로덕션 Linux 환경에서는 inotify로 즉시 감지.

### Risk 5: ingest.py 리팩터링 시 기존 CLI 호환성

- **위험도**: 낮음
- **설명**: 파싱 로직 추출 시 기존 `ingest.py` CLI 동작이 깨질 수 있다
- **대응**: `sync_service.py`에 핵심 함수를 두고, `ingest.py`가 이를 import. 기존 테스트로 회귀 검증.

---

## 5. 의존성

| 의존성 | 유형 | 설명 |
|--------|------|------|
| `watchdog >= 4.0.0` | 외부 라이브러리 | 파일 시스템 감시 |
| `ingest.py` 파싱 로직 | 내부 코드 | HTML 파싱 및 DB 적재 핵심 로직 재사용 |
| SQLAlchemy SessionLocal | 내부 코드 | DB 세션 관리 |
| `backend/data/` 폴더 | 파일 시스템 | 감시 대상 디렉토리 |
| UNIQUE constraint | DB 스키마 | `(date, theme_name, data_source)` 중복 방지 |

---

## 6. 추적성

| 마일스톤 | 관련 요구사항 |
|----------|---------------|
| Primary Goal | REQ-MTT-009-06 ~ 09, 14 ~ 16 |
| Secondary Goal | REQ-MTT-009-01 ~ 05 |
| Tertiary Goal | REQ-MTT-009-10 ~ 13 |
| Optional Goal | REQ-MTT-009-17, 18 |
