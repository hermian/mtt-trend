# mtt-trend 의존성 그래프

## 백엔드 모듈 의존성 맵

### 1. 백엔드 모듈 간 관계도

```
┌─────────────────────────────────────────────────────────────┐
│                    app/main.py                              │
│          (FastAPI 앱 진입점, 라우터 마운트)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  database.py │ │themes.router │ │stocks.router │
│   (DB 설정)   │ │ (테마 API)   │ │ (종목 API)   │
└──────────────┘ └──────────────┘ └──────────────┘
        │              │              │
        │         ┌────┴──────────────┤
        │         ▼                   ▼
        │    ┌──────────────────────────────┐
        │    │     models.py                │
        │    │  (ORM 모델 정의)              │
        │    │ • ThemeDaily                 │
        │    │ • ThemeStockDaily            │
        │    └──────────────────────────────┘
        │         │                   │
        │         └────┬──────────────┤
        │              ▼              ▼
        │         ┌──────────────┐ ┌──────────────┐
        │         │ schemas.py   │ │ schemas.py   │
        │         │(테마 응답)    │ │ (종목 응답)   │
        │         └──────────────┘ └──────────────┘
        │
        └────► Base (선언 기본 클래스)
              SessionLocal (세션 팩토리)
              create_tables() (테이블 생성)
              get_db() (의존성 주입)
```

### 2. 백엔드 외부 패키지 의존성

| 패키지 | 용도 | 버전 |
|--------|------|------|
| **fastapi** | REST API 프레임워크 | >=0.104.0 |
| **sqlalchemy** | ORM (데이터베이스 추상화) | >=2.0 |
| **sqlite3** | 데이터베이스 드라이버 | 내장 |
| **pydantic** | 데이터 검증 및 직렬화 | >=2.0 |
| **uvicorn** | ASGI 서버 | >=0.24.0 |
| **beautifulsoup4** | HTML 파싱 | >=4.12.0 |
| **requests** | HTTP 클라이언트 (데이터 수집) | >=2.31.0 |
| **python-multipart** | 폼 데이터 처리 | >=0.0.6 |

### 3. 데이터베이스 스키마 의존성

```
theme_daily 테이블
│
├── 외부키 없음 (단독 저장)
├── 인덱스:
│   ├── idx_td_date (date 컬럼)
│   └── uq_theme_daily_date_name (date + theme_name 복합)
│
└── 읽기 의존:
    ├── app/routers/themes.py (daily, surging, history)
    ├── app/main.py (/api/dates 엔드포인트)
    └── app/routers/stocks.py (그룹액션)

theme_stock_daily 테이블
│
├── 외부키 없음
├── 인덱스:
│   ├── idx_tsd_stock (stock_name + date)
│   └── idx_tsd_theme_date (theme_name + date)
│
└── 읽기 의존:
    ├── app/routers/themes.py (이력, 5일 이동평균)
    ├── app/routers/stocks.py (persistent, group-action)
    └── backend/scripts/ingest.py (쓰기)
```

### 4. 엔드포인트 간 데이터 흐름

```
/api/dates (main.py)
├── 읽기: SELECT DISTINCT date FROM theme_daily
└── 의존: ThemeDaily 모델

/api/themes/daily (themes.py)
├── 읽기: SELECT * FROM theme_daily WHERE date = ?
├── 정렬: avg_rs DESC
└── 응답: ThemeDailyResponse(date, themes[])

/api/themes/surging (themes.py)
├── 읽기: theme_daily + 5일 이동평균 계산
├── 필터: avg_rs_5d 변화율 >= threshold
└── 응답: ThemeSurgingResponse(date, threshold, themes[])

/api/themes/{name}/history (themes.py)
├── 읽기: WHERE theme_name = ? AND date >= ?
├── 범위: 최근 N일 (days 파라미터)
└── 응답: ThemeHistoryResponse(theme_name, days, history[])

/api/stocks/persistent (stocks.py)
├── 읽기: GROUP BY stock_name, HAVING COUNT(*) >= min
├── 범위: 최근 N일 (days 파라미터)
└── 응답: PersistentStocksResponse(days, min_appearances, stocks[])

/api/stocks/group-action (stocks.py)
├── 읽기: theme_stock_daily WHERE date = ?
├── 처리: 테마별 관련 종목 그룹핑
└── 응답: GroupActionResponse(date, stocks[])

/health (main.py)
├── 읽기: 없음 (정적 응답)
└── 응답: {"status": "ok"}
```

---

## 프론트엔드 컴포넌트 트리

### 1. 컴포넌트 계층 구조

```
layout.tsx (루트 레이아웃)
│
├── providers.tsx (QueryClientProvider)
│   └── 내용
│       ├── <Sidebar />
│       └── {children}
│
├── page.tsx (루트 페이지)
│   └── → /trend 리다이렉트
│
└── trend/page.tsx (메인 대시보드)
    │
    ├── <TopThemesBar />
    │   ├── useThemesDaily() 훅
    │   ├── <BarChart /> (Recharts)
    │   └── 데이터: ThemeDaily[]
    │
    ├── <ThemeTrendChart />
    │   ├── useThemeHistory() 훅 (다중 테마)
    │   ├── <LineChart /> (Recharts)
    │   └── 데이터: ThemeHistory[] (테마명별)
    │
    └── <StockAnalysisTabs />
        │
        ├── Tab: "지속 종목"
        │   └── <StrongStocksTable />
        │       ├── useStocksPersistent() 훅
        │       ├── <Table /> (데이터 테이블)
        │       └── 데이터: PersistentStock[]
        │
        └── Tab: "그룹액션"
            └── <GroupActionTable />
                ├── useStocksGroupAction() 훅
                ├── <Table /> (데이터 테이블)
                └── 데이터: GroupActionStock[]
```

### 2. 프론트엔드 상태 계층

```
React Query (서버 상태)
│
├── 캐시 키: "dates"
│   └── useDates() 훅
│       ├── api.getDates()
│       └── 캐시: string[]
│
├── 캐시 키: "themes-daily-{date}"
│   └── useThemesDaily(date) 훅
│       ├── api.getThemesDaily(date)
│       └── 캐시: ThemeDaily[]
│
├── 캐시 키: "themes-surging-{date}-{threshold}"
│   └── useThemesSurging(date, threshold) 훅
│       ├── api.getThemesSurging(date, threshold)
│       └── 캐시: SurgingTheme[]
│
├── 캐시 키: "theme-history-{name}-{days}"
│   └── useThemeHistory(name, days) 훅
│       ├── api.getThemeHistory(name, days)
│       └── 캐시: ThemeHistory[]
│
├── 캐시 키: "stocks-persistent-{days}-{min}"
│   └── useStocksPersistent(days, min) 훅
│       ├── api.getStocksPersistent(days, min)
│       └── 캐시: PersistentStock[]
│
└── 캐시 키: "stocks-group-action-{date}"
    └── useStocksGroupAction(date) 훅
        ├── api.getStocksGroupAction(date)
        └── 캐시: GroupActionStock[]

로컬 상태 (UI 상태)
│
└── trend/page.tsx
    ├── selectedDate: useState<string | null>
    ├── selectedThemes: useState<string[]> (ThemeTrendChart)
    └── 기타 UI 상태
```

### 3. 프론트엔드 외부 패키지 의존성

| 패키지 | 용도 | 버전 |
|--------|------|------|
| **next** | React 프레임워크 | >=14.0.0 |
| **react** | UI 라이브러리 | >=18.0.0 |
| **@tanstack/react-query** | 서버 상태 관리 | >=4.0.0 |
| **axios** | HTTP 클라이언트 | >=1.6.0 |
| **recharts** | 차트 라이브러리 | >=2.10.0 |
| **tailwindcss** | 유틸리티 CSS | >=3.3.0 |
| **@headlessui/react** | 접근성 UI 컴포넌트 | >=1.7.0 |
| **typescript** | 타입 시스템 | >=5.3.0 |

### 4. 데이터 흐름 (상향식)

```
UI 컴포넌트
    ▲
    │ (렌더링)
    │
React Query 캐시
    ▲
    │ (캐시 미스 시)
    │
API 훅 (useThemes, useStocks)
    ▲
    │
api.ts 함수 (getDates, getThemesDaily, ...)
    ▲
    │
Axios 클라이언트
    │ HTTP GET 요청
    ▼
FastAPI 백엔드
    │ SQL 쿼리
    ▼
SQLite 데이터베이스
    │ JSON 응답
    ▼
프론트엔드 (Axios 응답)
    │ TypeScript 타입 검증
    ▼
React Query 캐시 업데이트
    │
    ▼
UI 컴포넌트 재렌더링
```

---

## 내부 모듈 관계 다이어그램

### 1. 백엔드 모듈 의존성 강도

```
main.py
  │
  ├─→ database.py (강함: 필수 의존)
  ├─→ routers/themes.py (강함: 마운트)
  └─→ routers/stocks.py (강함: 마운트)

routers/themes.py
  │
  ├─→ models.py (강함: ORM 쿼리)
  ├─→ schemas.py (강함: 응답 변환)
  ├─→ database.py (강함: 의존성)
  └─→ routers/stocks.py (약함: 공유 쿼리)

routers/stocks.py
  │
  ├─→ models.py (강함: ORM 쿼리)
  ├─→ schemas.py (강함: 응답 변환)
  ├─→ database.py (강함: 의존성)
  └─→ routers/themes.py (약함: 공유 쿼리)

models.py
  │
  └─→ database.py (강함: Base 상속)

schemas.py
  │
  └─→ 모델 없음 (독립적)

database.py
  │
  └─→ models.py (순환 의존성: 테이블 생성)
```

### 2. 프론트엔드 컴포넌트 의존성 강도

```
layout.tsx
  │
  ├─→ providers.tsx (강함: QueryClientProvider)
  ├─→ Sidebar 컴포넌트 (강함: 렌더링)
  └─→ trend/page.tsx (강함: 라우팅)

trend/page.tsx
  │
  ├─→ useThemes 훅 (강함: 날짜 조회)
  ├─→ TopThemesBar 컴포넌트 (강함: 렌더링)
  ├─→ ThemeTrendChart 컴포넌트 (강함: 렌더링)
  └─→ StockAnalysisTabs 컴포넌트 (강함: 렌더링)

TopThemesBar
  │
  ├─→ useThemesDaily 훅 (강함: 데이터)
  ├─→ Recharts BarChart (강함: 시각화)
  └─→ api.ts (약함: 간접)

ThemeTrendChart
  │
  ├─→ useThemeHistory 훅 (강함: 데이터)
  ├─→ Recharts LineChart (강함: 시각화)
  └─→ api.ts (약함: 간접)

StockAnalysisTabs
  │
  ├─→ StrongStocksTable (강함: 렌더링)
  ├─→ GroupActionTable (강함: 렌더링)
  └─→ useStocks 훅 (강함: 데이터)

StrongStocksTable
  │
  └─→ useStocksPersistent 훅 (강함: 데이터)

GroupActionTable
  │
  └─→ useStocksGroupAction 훅 (강함: 데이터)

useThemes, useStocks 훅
  │
  ├─→ api.ts (강함: API 호출)
  └─→ @tanstack/react-query (강함: 상태 관리)

api.ts
  │
  └─→ axios (강함: HTTP 통신)
```

---

## 크로스 계층 의존성 매트릭스

| 계층 1 | 계층 2 | 관계 | 설명 |
|--------|--------|------|------|
| 프론트엔드 | 백엔드 | HTTP REST | Axios로 API 호출 |
| React Query 훅 | api.ts | 함수 호출 | 데이터 페칭 |
| 컴포넌트 | React Query | 훅 사용 | 상태 구독 |
| 라우터 | 스키마 | Pydantic | 응답 검증 |
| 라우터 | 모델 | ORM | 데이터 조회 |
| 모델 | 데이터베이스 | SQLAlchemy | 테이블 매핑 |

---

## 순환 의존성 분석

### 1. 데이터베이스 - 모델 (순환)

```
database.py (Base 정의)
    ↓
models.py (Base 상속)
    ↓
database.py (create_tables() 실행)

해결:
- create_tables() 호출 시점 지연 (앱 시작 시)
- main.py lifespan에서만 호출
```

### 2. 테마/종목 라우터 (잠재적 순환)

```
routers/themes.py
    ↓
routers/stocks.py (그룹액션에서 테마 필터링)
    ↓
routers/themes.py

해결:
- 각 라우터는 독립적 인터페이스 제공
- 공유 함수 없음 (각자 쿼리 작성)
```

### 3. 프론트엔드 컴포넌트 (비순환)

```
모든 컴포넌트 → api.ts → axios
모든 훅 → @tanstack/react-query

- 단방향 의존성
- 계층 구조 명확
```

---

## 의존성 안정성 평가

### 백엔드

| 모듈 | 의존성 수 | 피의존성 수 | 안정성 |
|------|---------|-----------|--------|
| main.py | 3 | 0 | 낮음 (변경 영향 큼) |
| database.py | 1 | 3 | 높음 (외부 변경 영향 적음) |
| models.py | 1 | 4 | 높음 |
| schemas.py | 0 | 2 | 높음 (독립적) |
| routers/themes.py | 3 | 1 | 중간 |
| routers/stocks.py | 3 | 1 | 중간 |

### 프론트엔드

| 모듈 | 의존성 수 | 피의존성 수 | 안정성 |
|------|---------|-----------|--------|
| api.ts | 1 | 6 | 높음 (중앙 집중) |
| useThemes.ts | 2 | 2 | 중간 |
| useStocks.ts | 2 | 2 | 중간 |
| layout.tsx | 2 | 0 | 낮음 |
| trend/page.tsx | 4 | 0 | 낮음 |
| 컴포넌트 | 1-2 | 1 | 높음 (격리) |

---

## 외부 패키지 안정성 평가

### 백엔드 패키지

| 패키지 | 성숙도 | 위험도 | 대체 가능 |
|--------|--------|--------|---------|
| fastapi | 높음 | 낮음 | starlette |
| sqlalchemy | 높음 | 낮음 | Django ORM |
| pydantic | 높음 | 낮음 | marshmallow |
| uvicorn | 높음 | 낮음 | gunicorn |
| beautifulsoup4 | 높음 | 낮음 | lxml |

### 프론트엔드 패키지

| 패키지 | 성숙도 | 위험도 | 대체 가능 |
|--------|--------|--------|---------|
| next | 높음 | 낮음 | React + Remix |
| react-query | 높음 | 낮음 | SWR |
| axios | 높음 | 낮음 | fetch API |
| recharts | 중간 | 중간 | Plotly, Chart.js |
| tailwindcss | 높음 | 낮음 | Bootstrap |
