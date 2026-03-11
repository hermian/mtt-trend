# mtt-trend 모듈 카탈로그

## 백엔드 모듈 (Python + FastAPI)

### 1. app/main.py - FastAPI 애플리케이션 메인

**역할**: FastAPI 애플리케이션 초기화 및 라우터 통합

**책임**:
- FastAPI 인스턴스 생성
- CORS 미들웨어 설정
- 라이프사이클 관리 (데이터베이스 초기화)
- 라우터 마운트
- 상태 확인 엔드포인트 제공

**공개 인터페이스**:
- `app: FastAPI` - 메인 FastAPI 애플리케이션 인스턴스
- `lifespan(app)` - 비동기 컨텍스트 관리자 (시작/종료 처리)

**주요 함수**:
```python
lifespan(app: FastAPI) -> AsyncContextManager
  목적: 애플리케이션 시작/종료 시 데이터베이스 테이블 생성
  호출: FastAPI 초기화 시 자동 호출
  반환: None

get /health
  목적: 서버 상태 확인
  반환: {"status": "ok"}

get /api/dates
  목적: 수집된 모든 날짜 조회
  반환: DatesResponse (dates: string[])
```

**외부 의존성**:
- `app.database` (SessionLocal, create_tables)
- `app.routers.themes` (themes router)
- `app.routers.stocks` (stocks router)

---

### 2. app/database.py - 데이터베이스 설정

**역할**: SQLAlchemy 엔진 및 세션 관리

**책임**:
- SQLAlchemy 엔진 생성
- 세션 로컬 팩토리 정의
- Base 선언 정의
- 테이블 생성 함수 제공
- 데이터베이스 의존성 제공

**공개 인터페이스**:
- `Base: declarative_base` - ORM 모델 기본 클래스
- `engine: Engine` - SQLAlchemy 엔진
- `SessionLocal: sessionmaker` - 세션 팩토리
- `create_tables()` - 모든 테이블 생성 함수
- `get_db()` - 의존성 주입용 제너레이터

**주요 함수**:
```python
create_tables() -> None
  목적: 데이터베이스에 모든 ORM 모델 테이블 생성
  호출: 애플리케이션 시작 시
  부작용: 기존 테이블은 유지

get_db() -> Generator[Session]
  목적: FastAPI 의존성 주입으로 DB 세션 제공
  반환: SQLAlchemy Session
  정리: 요청 완료 후 자동 종료
```

**설정**:
- `DATABASE_URL`: "sqlite:///./data.db" (상대 경로)
- `connect_args`: {"check_same_thread": False} (SQLite용)
- `echo`: False (SQL 로깅 비활성화)

---

### 3. app/models.py - ORM 데이터 모델

**역할**: SQLAlchemy ORM 모델 정의

**책임**:
- 테이블 스키마 정의
- 제약조건 및 인덱스 설정
- 모델 직렬화 메서드 제공

**공개 인터페이스**:

#### ThemeDaily
```python
class ThemeDaily(Base):
  __tablename__: "theme_daily"

  필드:
    id: Integer (PK, 자동 증가)
    date: String (NOT NULL, 인덱스)
    theme_name: String (NOT NULL)
    stock_count: Integer (NULL)
    avg_rs: Float (NULL, 테마 평균 강도)
    change_sum: Float (NULL, 변화율 합계)
    volume_sum: Float (NULL, 거래량 합계)

  제약조건:
    UniqueConstraint(date, theme_name) - 일별 테마 중복 방지
    Index(date) - 날짜 검색 최적화
```

#### ThemeStockDaily
```python
class ThemeStockDaily(Base):
  __tablename__: "theme_stock_daily"

  필드:
    id: Integer (PK, 자동 증가)
    date: String (NOT NULL)
    theme_name: String (NOT NULL)
    stock_name: String (NOT NULL)
    rs_score: Integer (NULL, 개별 종목 강도)
    change_pct: Float (NULL, 변화율 %)

  제약조건:
    Index(stock_name, date) - 종목 검색 최적화
    Index(theme_name, date) - 테마 검색 최적화
```

**주요 메서드**:
```python
__repr__() -> str
  목적: 디버깅용 문자열 표현
  반환: "<ThemeDaily date=... theme=... avg_rs=...>"
```

---

### 4. app/schemas.py - Pydantic 응답 스키마

**역할**: API 요청/응답 검증 및 직렬화

**책임**:
- Pydantic v2 스키마 정의
- 타입 검증
- API 문서 자동 생성
- ORM 모델 → JSON 변환

**공개 인터페이스**:

| 스키마 | 용도 | 필드 |
|--------|------|------|
| `DatesResponse` | /api/dates | dates: List[str] |
| `ThemeDailyItem` | 테마 일일 데이터 | date, theme_name, stock_count, avg_rs, change_sum, volume_sum |
| `ThemeDailyResponse` | /api/themes/daily | date: str, themes: List[ThemeDailyItem] |
| `ThemeSurgingItem` | 급등 테마 | date, theme_name, stock_count, avg_rs, avg_rs_5d, rs_change |
| `ThemeSurgingResponse` | /api/themes/surging | date, threshold, themes |
| `ThemeHistoryItem` | 테마 이력 | date, theme_name, avg_rs, stock_count, change_sum |
| `ThemeHistoryResponse` | /api/themes/{name}/history | theme_name, days, history |
| `PersistentStockItem` | 지속 종목 | stock_name, appearance_count, avg_rs, themes |
| `PersistentStocksResponse` | /api/stocks/persistent | days, min_appearances, stocks |
| `GroupActionItem` | 그룹액션 | stock_name, rs_score, change_pct, theme_name |
| `GroupActionResponse` | /api/stocks/group-action | date, stocks |

**설정**:
```python
_Base(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  목적: SQLAlchemy ORM 모델 직접 변환 가능
```

---

### 5. app/routers/themes.py - 테마 엔드포인트

**역할**: 테마 관련 API 엔드포인트 제공

**책임**:
- 테마 일일 데이터 조회
- 급등 테마 필터링 및 반환
- 테마 이력 조회

**공개 인터페이스**:

```python
@router.get("/daily")
def get_themes_daily(
  date: Optional[str] = Query(None),
  db: Session = Depends(get_db)
) -> ThemeDailyResponse:
  목적: 특정 날짜의 모든 테마 조회
  기본값: 최신 날짜
  반환: 테마 목록 (avg_rs 내림차순)

@router.get("/surging")
def get_themes_surging(
  date: Optional[str] = Query(None),
  threshold: float = Query(10.0),
  db: Session = Depends(get_db)
) -> ThemeSurgingResponse:
  목적: 급등 테마 필터링 (5일 이동평균 대비 변화율)
  필터링: avg_rs_5d 기준 threshold 이상만
  반환: 급등 테마 목록

@router.get("/{name}/history")
def get_theme_history(
  name: str,
  days: int = Query(30),
  db: Session = Depends(get_db)
) -> ThemeHistoryResponse:
  목적: 특정 테마의 과거 days일 조회
  기간: 최근 N일 이력
  반환: 테마 이력 목록
```

**주요 쿼리 로직**:
- 날짜별 테마 집계 (GROUP BY)
- 5일 이동평균 계산
- 변화율 필터링 (threshold 비교)
- 날짜 범위 필터링

---

### 6. app/routers/stocks.py - 종목 엔드포인트

**역할**: 종목 관련 API 엔드포인트 제공

**책임**:
- 지속적으로 나타나는 종목 조회
- 그룹액션 종목 조회

**공개 인터페이스**:

```python
@router.get("/persistent")
def get_stocks_persistent(
  days: int = Query(5),
  min: int = Query(3),
  db: Session = Depends(get_db)
) -> PersistentStocksResponse:
  목적: 최근 days일에 min번 이상 나타난 종목
  필터링: 지속성 있는 주가 강세 종목
  반환: 지속 종목 목록 (appearance_count, 관련 테마)

@router.get("/group-action")
def get_stocks_group_action(
  date: Optional[str] = Query(None),
  db: Session = Depends(get_db)
) -> GroupActionResponse:
  목적: 특정 날짜의 그룹액션 (테마 기반 관련 종목)
  기본값: 최신 날짜
  반환: 그룹액션 종목 목록
```

**주요 쿼리 로직**:
- 종목별 출현 횟수 집계
- 테마 그룹핑
- 평균 강도 계산
- 날짜 범위 필터링

---

### 7. backend/scripts/ingest.py - 데이터 수집 CLI

**역할**: HTML 파싱 및 데이터 수집

**책임**:
- HTML 파싱 (BeautifulSoup)
- 테마 및 종목 데이터 추출
- 데이터베이스 삽입/업데이트
- 중복 처리

**공개 인터페이스**:

```python
CLI 사용법:
  python ingest.py --date YYYY-MM-DD --source <html_file>

주요 파서 전략:
  1. 정규 표현식 기반 파싱
  2. BeautifulSoup 트리 탐색
  3. 커스텀 규칙 기반 추출

처리 단계:
  1. HTML 읽기
  2. 테마 및 종목 데이터 추출
  3. Pydantic 검증
  4. 데이터베이스 UPSERT
  5. 진행 상황 로깅
```

**주요 함수**:
- `parse_html(html_content: str) -> List[ThemeData]`
- `insert_data(date: str, theme_data: List[ThemeData])`
- `main(date: str, source: str)`

---

## 프론트엔드 모듈 (TypeScript + React)

### 1. src/lib/api.ts - API 클라이언트 및 타입

**역할**: 백엔드 API와의 통신 중앙화

**책임**:
- Axios 클라이언트 설정
- TypeScript 인터페이스 정의
- API 함수 구현
- 에러 처리

**공개 인터페이스**:

```typescript
// 타입 인터페이스
interface ThemeDaily {
  date: string
  theme_name: string
  stock_count: number | null
  avg_rs: number | null
  change_sum: number | null
  volume_sum: number | null
}

interface ThemeHistory { ... }
interface PersistentStock { ... }
interface GroupActionStock { ... }
interface SurgingTheme { ... }

// API 함수
const api = {
  getDates(): Promise<string[]>
  getThemesDaily(date: string): Promise<ThemeDaily[]>
  getThemesSurging(date: string, threshold?: number): Promise<SurgingTheme[]>
  getThemeHistory(name: string, days?: number): Promise<ThemeHistory[]>
  getStocksPersistent(days?: number, min?: number): Promise<PersistentStock[]>
  getStocksGroupAction(date: string): Promise<GroupActionStock[]>
}

const apiClient: AxiosInstance
  목적: Axios 인스턴스 (baseURL, timeout 설정)
```

**설정**:
- `baseURL`: `process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`
- `timeout`: 10000ms
- `Content-Type`: application/json

---

### 2. src/hooks/useThemes.ts - 테마 React Query 훅

**역할**: 테마 데이터 페칭 및 상태 관리

**책임**:
- 날짜 조회
- 일일 테마 조회
- 급등 테마 조회
- 테마 이력 조회
- 로딩/에러 상태 관리

**공개 인터페이스**:

```typescript
useThemes() -> UseQueryResult<ThemeDaily[], Error>
  목적: 현재 날짜 테마 조회
  반환: { data, isLoading, error, ... }

useDates() -> UseQueryResult<string[], Error>
  목적: 수집된 모든 날짜 조회
  반환: { data: string[], isLoading, error, ... }

useThemesSurging(date: string, threshold?: number)
  -> UseQueryResult<SurgingTheme[], Error>
  목적: 급등 테마 조회
  필터링: 임계값 기반

useThemeHistory(name: string, days?: number)
  -> UseQueryResult<ThemeHistory[], Error>
  목적: 테마 이력 조회
  캐싱: 테마명 기준
```

**캐싱 전략**:
- staleTime: 60000ms (1분)
- gcTime: 300000ms (5분)
- refetchOnWindowFocus: true

---

### 3. src/hooks/useStocks.ts - 종목 React Query 훅

**역할**: 종목 데이터 페칭 및 상태 관리

**책임**:
- 지속 종목 조회
- 그룹액션 조회
- 로딩/에러 상태 관리

**공개 인터페이스**:

```typescript
useStocksPersistent(days?: number, min?: number)
  -> UseQueryResult<PersistentStock[], Error>
  목적: 지속성 있는 종목 조회
  필터링: appearance_count >= min

useStocksGroupAction(date: string)
  -> UseQueryResult<GroupActionStock[], Error>
  목적: 그룹액션 종목 조회
  캐싱: 날짜 기준
```

**캐싱 전략**:
- staleTime: 60000ms
- gcTime: 300000ms
- 자동 백그라운드 새로고침

---

### 4. src/app/layout.tsx - 루트 레이아웃

**역할**: 모든 페이지의 기본 레이아웃 제공

**책임**:
- QueryClient 제공자 설정
- 사이드바 포함
- 글로벌 스타일 적용
- 메타데이터 설정

**구조**:
```
html
└── body
    ├── Sidebar (네비게이션)
    └── children (페이지 콘텐츠)
```

**제공자 (Providers)**:
- `QueryClientProvider` (React Query)
- 글로벌 CSS (Tailwind)

---

### 5. src/app/page.tsx - 루트 페이지

**역할**: 진입점 페이지

**책임**:
- `/trend`로 리다이렉트

---

### 6. src/app/trend/page.tsx - 메인 대시보드

**역할**: 52주 고점 테마 트렌드 분석 대시보드

**책임**:
- 날짜 선택 UI
- 테마 바 차트 표시
- 테마 트렌드 차트 표시
- 종목 분석 탭 표시

**구성 요소**:
```
TrendPage
├── Header (제목, 날짜 선택)
├── TopThemesBar (일일 테마 순위)
├── ThemeTrendChart (시계열 테마 비교)
└── StockAnalysisTabs
    ├── StrongStocksTable (지속 종목)
    └── GroupActionTable (그룹액션)
```

**상태 관리**:
- `selectedDate`: 선택된 분석 날짜
- `dates`: 사용 가능한 날짜 목록

---

### 7. src/app/trend/_components/TopThemesBar.tsx - 테마 순위 차트

**역할**: 수평 막대 차트로 테마 순위 표시

**책임**:
- ThemeDaily 데이터 시각화
- avg_rs 기준 정렬
- 상위 N개 테마 표시

**차트 라이브러리**: Recharts (BarChart)

---

### 8. src/app/trend/_components/ThemeTrendChart.tsx - 테마 추세 차트

**역할**: 다중선 차트로 테마 추세 비교

**책임**:
- 다중 테마 선택 (체크박스)
- 시계열 데이터 표시
- 테마별 선 색상 구분

**차트 라이브러리**: Recharts (LineChart)

---

### 9. src/app/trend/_components/StockAnalysisTabs.tsx - 종목 분석 탭

**역할**: 종목 분석 탭 컨테이너

**책임**:
- Tab UI 제공
- StrongStocksTable, GroupActionTable 포함

---

### 10. src/app/trend/_components/StrongStocksTable.tsx - 지속 종목 표

**역할**: 지속성 있는 종목 테이블

**책임**:
- PersistentStock 데이터 표시
- 종목명, 강도, 관련 테마 표시

---

### 11. src/app/trend/_components/GroupActionTable.tsx - 그룹액션 표

**역할**: 그룹액션 종목 테이블

**책임**:
- GroupActionStock 데이터 표시
- 종목명, 테마, 강도 표시

---

## 모듈 의존성 요약

### 백엔드 의존성 흐름
```
main.py
├── database.py (Base, SessionLocal, create_tables)
├── routers/themes.py
│   ├── models.py (ThemeDaily, ThemeStockDaily)
│   ├── schemas.py (Theme* 스키마)
│   └── database.py (get_db)
└── routers/stocks.py
    ├── models.py
    ├── schemas.py
    └── database.py
```

### 프론트엔드 의존성 흐름
```
layout.tsx
├── providers.tsx (QueryClientProvider)
└── trend/page.tsx (Main Dashboard)
    ├── lib/api.ts (API 클라이언트)
    ├── hooks/useThemes.ts
    ├── hooks/useStocks.ts
    └── _components/
        ├── TopThemesBar.tsx
        ├── ThemeTrendChart.tsx
        └── StockAnalysisTabs.tsx
            ├── StrongStocksTable.tsx
            └── GroupActionTable.tsx
```

### 크로스 계층 의존성
```
프론트엔드 컴포넌트
    ↓
React Query 훅 (useThemes, useStocks)
    ↓
api.ts (API 클라이언트 함수)
    ↓
Axios HTTP
    ↓
FastAPI 라우터 (themes.router, stocks.router)
    ↓
비즈니스 로직 (SQLAlchemy 쿼리)
    ↓
ORM 모델 (ThemeDaily, ThemeStockDaily)
    ↓
SQLite 데이터베이스
```
