# SPEC-MTT-002: 데이터 파이프라인 완성 및 트렌드 대시보드 MVP

| 항목 | 값 |
|------|-----|
| SPEC-ID | SPEC-MTT-002 |
| 제목 | 데이터 파이프라인 완성 및 트렌드 대시보드 MVP |
| 상태 | Completed |
| 작성일 | 2026-03-14 |
| 완료일 | 2026-03-14 |
| 우선순위 | High |
| 의존 SPEC | SPEC-MTT-001 (Multi Data Source Support) |

---

## 배경 (Background)

MTT-Trend 프로젝트는 주식 테마 트렌드를 분석하는 도구다. `backend/data/` 디렉토리에 77개의 HTML 파일(2026-01-02 ~ 2026-03-13)이 존재하지만, 아직 SQLite DB에 수집되지 않은 상태다. 또한 프론트엔드 훅(useThemes.ts, useStocks.ts)은 스캐폴딩만 완료되었고 실제 API 연동이 불완전하다.

SPEC-MTT-001을 통해 다중 데이터 소스(`52w_high`, `mtt`) 지원 아키텍처가 구현되었다. 이번 SPEC은 그 위에서:
1. 77개 HTML 파일을 DB에 수집하고,
2. 프론트엔드가 데이터를 올바르게 조회 및 시각화하는 MVP를 완성한다.

### 현재 데이터 파일 현황

| 타입 | 파일 패턴 | 개수 | 데이터 소스 |
|------|-----------|------|-------------|
| 52주 신고가 | `52Week_High_Stocks_By_Theme_With_RS_Scores_YYYY-MM-DD.html` | ~38개 | `52w_high` |
| MTT 종목 | `Themes_With_7_or_More_MTT_Stocks-Top7_YYYY-MM-DD.html` | ~39개 | `mtt` |

---

## 목표 (Goals)

1. **데이터 수집 완료**: ingest.py를 통해 77개 HTML 파일 전량을 SQLite DB에 수집한다.
2. **날짜 조회 API 검증**: `GET /api/dates`가 소스별 날짜 목록을 올바르게 반환한다.
3. **테마 트렌드 화면 완성**: 날짜 선택 → 상위 테마 바차트가 정상 렌더링된다.
4. **급등 테마 화면 완성**: surging threshold 기준 급등 테마 목록이 조회된다.
5. **지속 강세 종목 화면 완성**: 일정 기간 반복 등장하는 종목 테이블이 표시된다.

---

## 사용자 스토리 (User Stories)

**US-01**: 분석가로서 특정 날짜의 상위 테마 현황을 바차트로 한눈에 보고 싶다. 그래야 당일 시장의 주도 테마를 파악할 수 있다.

**US-02**: 분석가로서 최근 N일 동안 급등한 테마 목록을 필터링하여 보고 싶다. 그래야 모멘텀이 강한 테마를 빠르게 발견할 수 있다.

**US-03**: 분석가로서 여러 날짜에 걸쳐 반복 등장하는 종목(지속 강세 종목)을 테이블로 확인하고 싶다. 그래야 꾸준히 강세를 보이는 종목을 찾을 수 있다.

**US-04**: 분석가로서 데이터 소스(52주 신고가 / MTT)를 전환하여 각 기준의 테마 트렌드를 비교하고 싶다. 그래야 서로 다른 필터링 기준의 시각을 동시에 활용할 수 있다.

---

## 요구사항 (EARS 형식)

### F-01: 데이터 수집 (Data Ingestion)

**R-01-1: 전체 파일 일괄 수집**

WHEN 운영자가 `python scripts/ingest.py --dir backend/data/` 명령을 실행하면
THE SYSTEM SHALL `backend/data/` 디렉토리 내 모든 HTML 파일을 순서대로 파싱하여 SQLite DB에 수집해야 한다.

- 파일 처리 순서: 날짜 오름차순 (파일명 기준)
- 소스 자동 감지: SPEC-MTT-001 R-01 규칙 적용 (파일명 패턴으로 `52w_high` / `mtt` 결정)
- 처리 결과 출력: 성공/실패 카운트와 실패한 파일명 목록

**R-01-2: 중복 방지**

WHEN 이미 수집된 날짜·테마·소스 조합의 데이터를 재수집하면
THE SYSTEM SHALL 기존 레코드를 덮어쓰거나(UPSERT), 중복 삽입 오류 없이 건너뛰어야 한다.

- 구현 방식: `INSERT OR IGNORE` 또는 `INSERT OR REPLACE`

**R-01-3: 파싱 실패 복구**

IF 특정 HTML 파일의 파싱이 실패하더라도
THE SYSTEM SHALL 해당 파일을 건너뛰고 나머지 파일의 수집을 계속 진행해야 한다.

- 실패 파일은 stderr에 경고 메시지와 함께 기록

**R-01-4: 수집 결과 요약 출력**

WHEN 일괄 수집이 완료되면
THE SYSTEM SHALL 처리된 총 파일 수, 성공 수, 실패 수를 콘솔에 출력해야 한다.

---

### F-02: 날짜 목록 API (Date List API)

**R-02-1: 소스별 날짜 목록 반환**

WHEN 클라이언트가 `GET /api/dates?source={source}` 를 호출하면
THE SYSTEM SHALL 해당 소스에 수집된 날짜 목록을 내림차순(최신순)으로 반환해야 한다.

- 응답 형식: `{ "dates": ["2026-03-13", "2026-03-12", ...] }`
- source 기본값: `52w_high` (파라미터 생략 시)
- 데이터가 없을 경우: 빈 배열 반환

**R-02-2: 프론트엔드 날짜 초기화**

WHEN 페이지가 처음 로드되거나 소스를 전환하면
THE SYSTEM SHALL `/api/dates` 를 호출하여 최신 날짜를 자동으로 선택해야 한다.

---

### F-03: 테마 트렌드 화면 (Theme Trend View)

**R-03-1: 일별 상위 테마 바차트**

WHEN 사용자가 날짜를 선택하면
THE SYSTEM SHALL `GET /api/themes/daily?date={date}&source={source}` 를 호출하고,
반환된 테마 목록을 종목수 기준 내림차순으로 정렬하여 바차트(TopThemesBar)로 표시해야 한다.

- 표시 항목: 테마명, 해당 테마의 종목 수
- 최대 표시 개수: 상위 20개 테마
- 차트 없음 상태: 데이터가 없을 경우 "데이터가 없습니다" 메시지 표시

**R-03-2: 테마 히스토리 차트**

WHEN 사용자가 TopThemesBar에서 특정 테마를 클릭하면
THE SYSTEM SHALL `GET /api/themes/{name}/history?source={source}` 를 호출하고
선택된 테마의 날짜별 종목수 추이를 라인 차트(ThemeTrendChart)로 표시해야 한다.

- 표시 항목: 날짜(x축), 종목 수(y축)
- 날짜 범위: 수집된 전체 기간

---

### F-04: 급등 테마 화면 (Surging Themes View)

**R-04-1: 급등 테마 목록 조회**

WHEN 사용자가 급등 테마 탭을 선택하면
THE SYSTEM SHALL `GET /api/themes/surging?source={source}&threshold={threshold}` 를 호출하고
급등 테마 목록을 테이블로 표시해야 한다.

- threshold 기본값: `10` (10% 이상 증가)
- 표시 항목: 테마명, 현재 종목 수, 이전 대비 증가율(%)
- 정렬: 증가율 내림차순

**R-04-2: Threshold 조절 UI**

WHEN 사용자가 Threshold 값을 변경하면
THE SYSTEM SHALL 즉시 API를 재호출하여 목록을 갱신해야 한다.

- UI: 슬라이더 또는 숫자 입력 (범위: 5 ~ 50, 기본값: 10)

---

### F-05: 지속 강세 종목 화면 (Persistent Strong Stocks View)

**R-05-1: 지속 강세 종목 테이블**

WHEN 사용자가 지속 강세 종목 탭을 선택하면
THE SYSTEM SHALL `GET /api/stocks/persistent?source={source}` 를 호출하고
반복 등장 종목을 테이블(StrongStocksTable)로 표시해야 한다.

- 표시 항목: 종목명, 등장 횟수, 마지막 등장 날짜, 평균 RS 점수
- 정렬: 등장 횟수 내림차순

**R-05-2: 그룹 동시 행동 테이블**

WHEN 사용자가 그룹 동시 행동 탭을 선택하면
THE SYSTEM SHALL `GET /api/stocks/group-action?source={source}` 를 호출하고
GroupActionTable 컴포넌트로 결과를 표시해야 한다.

---

### F-06: 공통 품질 요구사항 (Non-Functional Requirements)

**R-06-1: API 응답 시간**

THE SYSTEM SHALL 모든 API 엔드포인트가 정상 DB 상태에서 2초 이내에 응답해야 한다.

**R-06-2: 에러 처리**

IF API 호출이 실패하면
THE SYSTEM SHALL 사용자에게 에러 메시지를 표시하고 재시도 버튼을 제공해야 한다.

**R-06-3: 로딩 상태 표시**

WHILE API 호출이 진행 중이면
THE SYSTEM SHALL 스피너 또는 스켈레톤 UI를 표시해야 한다.

**R-06-4: 소스 전환 시 데이터 초기화**

WHEN 사용자가 데이터 소스(52w_high ↔ mtt)를 전환하면
THE SYSTEM SHALL 현재 선택된 날짜를 초기화하고 새 소스의 최신 날짜를 자동 선택해야 한다.

---

## 기술 설계 개요 (Technical Design Overview)

### 데이터 수집 흐름

```
backend/data/*.html
        │
        ▼
  ingest.py (CLI)
        │  파일명 → 소스 감지 (R-01-1)
        │  HTML → 테마/종목 파싱 (SPEC-MTT-001 파서)
        │  INSERT OR IGNORE (R-01-2)
        ▼
  backend/db/trends.sqlite
  ├── theme_daily (date, theme_name, stock_count, avg_rs, data_source)
  └── theme_stock_daily (date, theme_name, stock_name, rs_score, change_pct, data_source)
```

### API 계층

| 엔드포인트 | 담당 Router | 주요 변경 |
|-----------|-------------|----------|
| `GET /api/dates` | main.py | source 파라미터 검증 추가 |
| `GET /api/themes/daily` | routers/themes.py | 정상 동작 확인 |
| `GET /api/themes/surging` | routers/themes.py | threshold 파라미터 검증 |
| `GET /api/themes/{name}/history` | routers/themes.py | 정상 동작 확인 |
| `GET /api/stocks/persistent` | routers/stocks.py | 정상 동작 확인 |
| `GET /api/stocks/group-action` | routers/stocks.py | 정상 동작 확인 |

### 프론트엔드 컴포넌트 연동

```
app/trend/page.tsx
  ├── state: selectedDate, selectedSource, dates[]
  ├── useEffect: /api/dates → dates 초기화 → selectedDate 자동 선택
  │
  ├── TopThemesBar
  │     └── useThemes(selectedDate, selectedSource)
  │           └── GET /api/themes/daily
  │
  ├── ThemeTrendChart
  │     └── useThemeHistory(selectedTheme, selectedSource)
  │           └── GET /api/themes/{name}/history
  │
  └── StockAnalysisTabs
        ├── StrongStocksTable
        │     └── useStocks.persistent(selectedSource)
        │           └── GET /api/stocks/persistent
        ├── GroupActionTable
        │     └── useStocks.groupAction(selectedSource)
        │           └── GET /api/stocks/group-action
        └── (Surging Themes Tab)
              └── useThemes.surging(threshold, selectedSource)
                    └── GET /api/themes/surging
```

### 기술 스택 (고정)

| 영역 | 기술 |
|------|------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite |
| Frontend | Next.js 14+, TypeScript, TanStack Query v5, Axios, Recharts |
| DB | SQLite (`backend/db/trends.sqlite`) |

---

## 범위 외 (Out of Scope)

다음 항목은 이번 SPEC에 포함하지 않는다:

1. **자동화 수집 스케줄러**: cron/celery 기반 자동 데이터 수집 — 현재는 수동 CLI 실행
2. **테스트 커버리지**: 단위 테스트 / 통합 테스트 작성 — 별도 SPEC으로 관리
3. **Docker 배포 검증**: docker-compose end-to-end 테스트 — 별도 작업
4. **실시간 데이터 연동**: 증권사 API를 통한 실시간 데이터 수집 — 미래 기능
5. **모바일 반응형 최적화**: 모바일 전용 레이아웃 조정
6. **소스 간 비교 뷰**: 두 소스를 나란히 비교하는 차트 — SPEC-MTT-001 Out of Scope에서 이어짐
7. **데이터 내보내기**: CSV/Excel 다운로드 기능
8. **사용자 인증**: 로그인/권한 관리
