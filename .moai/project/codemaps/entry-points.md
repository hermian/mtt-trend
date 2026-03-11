# mtt-trend 진입점 및 엔드포인트

## 애플리케이션 진입점

### 1. 백엔드 진입점

#### app/main.py - FastAPI 애플리케이션

```python
# 진입점: uvicorn 서버 실행

명령어:
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

매개변수:
  --reload: 개발 중 파일 변경 시 자동 재시작
  --host: 바인드할 호스트 (기본 127.0.0.1)
  --port: 바인드할 포트 (기본 8000)

시작 순서:
  1. Uvicorn ASGI 서버 시작
  2. FastAPI 앱 인스턴스 생성
  3. lifespan 컨텍스트 마니저 진입
     → database.create_tables() 호출
     → 모든 ORM 테이블 생성
  4. CORS 미들웨어 초기화
  5. 라우터 마운트
     → themes.router (/api/themes/...)
     → stocks.router (/api/stocks/...)
  6. 서버 준비 완료

환경 변수:
  DATABASE_URL: SQLite 경로 (기본 sqlite:///./data.db)
```

#### backend/scripts/ingest.py - 데이터 수집 CLI

```python
# 진입점: Python 스크립트 직접 실행

명령어:
  python ingest.py --date YYYY-MM-DD --source <html_file_path>

매개변수:
  --date: 분석할 데이터 날짜 (필수)
  --source: HTML 파일 경로 (필수)
  --parser: 파서 전략 선택 (기본 auto)
    - regex: 정규표현식 기반
    - beautifulsoup: BeautifulSoup 기반
    - custom: 커스텀 규칙 기반

시작 순서:
  1. 커맨드라인 인수 파싱
  2. HTML 파일 읽기
  3. 선택된 파서로 테마/종목 데이터 추출
  4. Pydantic 스키마로 검증
  5. SQLAlchemy로 데이터베이스 UPSERT
     → 중복 데이터 자동 업데이트
  6. 처리 결과 로깅

예시:
  python backend/scripts/ingest.py \
    --date 2024-01-15 \
    --source ./data/raw/market_data.html \
    --parser beautifulsoup

반환값:
  Success: 삽입/업데이트된 레코드 수
  Error: 실패 이유 및 스택 트레이스
```

---

### 2. 프론트엔드 진입점

#### src/app/layout.tsx - 루트 레이아웃

```typescript
// 진입점: Next.js 서버 시작

명령어:
  npm run dev       # 개발 서버 (http://localhost:3000)
  npm run build     # 프로덕션 빌드
  npm run start     # 프로덕션 서버

시작 순서:
  1. Node.js 프로세스 시작
  2. Next.js 서버 초기화
  3. 라우트 컴파일 (app/ 디렉토리)
  4. layout.tsx 로드
     → providers.tsx 마운트
     → QueryClientProvider 초기화
     → Sidebar 컴포넌트 마운트
  5. 개발 서버 리스닝 (localhost:3000)

환경 변수:
  NEXT_PUBLIC_API_URL: 백엔드 API URL
    기본: http://localhost:8000
    프로덕션: https://api.example.com
```

#### src/app/page.tsx - 루트 페이지

```typescript
// 진입점: http://localhost:3000/

리다이렉트:
  / → /trend

목적:
  - 사용자를 대시보드로 자동 이동
```

#### src/app/trend/page.tsx - 메인 대시보드

```typescript
// 진입점: http://localhost:3000/trend

시작 순서:
  1. 페이지 로드
  2. useDates() 훅 실행
     → React Query 캐시 확인
     → 캐시 미스 시 api.getDates() 호출
     → 백엔드 /api/dates 요청
  3. useState로 selectedDate 초기화 (null)
  4. useEffect로 날짜 선택 (최신 날짜)
  5. 컴포넌트 렌더링
     → TopThemesBar (useThemesDaily)
     → ThemeTrendChart (useThemeHistory)
     → StockAnalysisTabs (useStocks)

사용자 상호작용:
  - 날짜 선택 (select dropdown)
    → selectedDate 상태 변경
    → 자식 컴포넌트에 prop 전달
    → 각 훅이 새로운 쿼리 실행
```

---

## REST API 엔드포인트 전체 목록

### 1. 날짜 엔드포인트

#### GET /api/dates
```
엔드포인트: http://localhost:8000/api/dates

설명: 데이터베이스에 수집된 모든 날짜 목록 조회

요청:
  GET /api/dates
  Content-Type: application/json

응답 (200 OK):
  {
    "dates": [
      "2024-01-08",
      "2024-01-09",
      "2024-01-10",
      ...
    ]
  }

응답 스키마:
  DatesResponse {
    dates: string[] (ISO 8601 날짜 형식)
  }

캐싱:
  React Query: staleTime 60s, gcTime 300s

구현:
  파일: app/main.py (line 63-72)
  쿼리: SELECT DISTINCT date FROM theme_daily ORDER BY date ASC
  의존: ThemeDaily 모델
```

---

### 2. 테마 엔드포인트

#### GET /api/themes/daily
```
엔드포인트: http://localhost:8000/api/themes/daily

설명: 특정 날짜의 모든 테마 일일 데이터 조회

요청:
  GET /api/themes/daily?date=2024-01-15
  Content-Type: application/json

쿼리 파라미터:
  date (optional): YYYY-MM-DD 형식
    - 생략 시: 최신 날짜 자동 선택
    - 형식: ISO 8601 날짜

응답 (200 OK):
  {
    "date": "2024-01-15",
    "themes": [
      {
        "date": "2024-01-15",
        "theme_name": "AI",
        "stock_count": 45,
        "avg_rs": 82.5,
        "change_sum": 150.3,
        "volume_sum": 1000000
      },
      {
        "date": "2024-01-15",
        "theme_name": "전기차",
        "stock_count": 38,
        "avg_rs": 75.2,
        "change_sum": 120.5,
        "volume_sum": 800000
      }
    ]
  }

응답 스키마:
  ThemeDailyResponse {
    date: string
    themes: ThemeDailyItem[] (avg_rs 내림차순)
  }

  ThemeDailyItem {
    date: string
    theme_name: string
    stock_count: int | null
    avg_rs: float | null
    change_sum: float | null
    volume_sum: float | null
  }

캐싱:
  React Query: staleTime 60s, gcTime 300s
  키: "themes-daily-{date}"

구현:
  파일: app/routers/themes.py (line 42-60)
  쿼리: SELECT * FROM theme_daily WHERE date = ?
       ORDER BY avg_rs DESC
  의존: ThemeDaily, ThemeDailyItem, ThemeDailyResponse
```

#### GET /api/themes/surging
```
엔드포인트: http://localhost:8000/api/themes/surging

설명: 급등 테마 필터링 (5일 이동평균 대비 변화율)

요청:
  GET /api/themes/surging?date=2024-01-15&threshold=10
  Content-Type: application/json

쿼리 파라미터:
  date (optional): YYYY-MM-DD 형식 (생략 시 최신)
  threshold (optional): 임계값 (기본 10)
    - avg_rs 변화율이 threshold 이상인 테마만 포함

응답 (200 OK):
  {
    "date": "2024-01-15",
    "threshold": 10,
    "themes": [
      {
        "date": "2024-01-15",
        "theme_name": "AI",
        "stock_count": 45,
        "avg_rs": 82.5,
        "avg_rs_5d": 70.0,
        "rs_change": 12.5,
        "change_sum": 150.3,
        "volume_sum": 1000000
      }
    ]
  }

응답 스키마:
  ThemeSurgingResponse {
    date: string
    threshold: float
    themes: ThemeSurgingItem[]
  }

  ThemeSurgingItem {
    date: string
    theme_name: string
    stock_count: int | null
    avg_rs: float | null
    avg_rs_5d: float | null (5일 이동평균)
    rs_change: float | null (변화율)
    change_sum: float | null
    volume_sum: float | null
  }

캐싱:
  React Query: staleTime 60s, gcTime 300s
  키: "themes-surging-{date}-{threshold}"

구현:
  파일: app/routers/themes.py (line 63-90)
  계산: 5일 이동평균, 변화율 필터링
  의존: ThemeDaily, ThemeSurgingItem, ThemeSurgingResponse
```

#### GET /api/themes/{name}/history
```
엔드포인트: http://localhost:8000/api/themes/{name}/history

설명: 특정 테마의 과거 이력 조회

요청:
  GET /api/themes/AI/history?days=30
  Content-Type: application/json

경로 파라미터:
  name (required): 테마명 (URL 인코딩)

쿼리 파라미터:
  days (optional): 조회 기간 (기본 30)

응답 (200 OK):
  {
    "theme_name": "AI",
    "days": 30,
    "history": [
      {
        "date": "2023-12-20",
        "theme_name": "AI",
        "avg_rs": 65.5,
        "stock_count": 35,
        "change_sum": 100.0
      },
      {
        "date": "2023-12-21",
        "theme_name": "AI",
        "avg_rs": 68.2,
        "stock_count": 37,
        "change_sum": 115.5
      },
      ...
    ]
  }

응답 스키마:
  ThemeHistoryResponse {
    theme_name: string
    days: int
    history: ThemeHistoryItem[]
  }

  ThemeHistoryItem {
    date: string
    theme_name: string
    avg_rs: float | null
    stock_count: int | null
    change_sum: float | null
  }

캐싱:
  React Query: staleTime 60s, gcTime 300s
  키: "theme-history-{name}-{days}"

구현:
  파일: app/routers/themes.py (line 93-120)
  쿼리: SELECT * FROM theme_daily
        WHERE theme_name = ? AND date >= DATE(?, '-N days')
        ORDER BY date ASC
  의존: ThemeDaily, ThemeHistoryItem, ThemeHistoryResponse
```

---

### 3. 종목 엔드포인트

#### GET /api/stocks/persistent
```
엔드포인트: http://localhost:8000/api/stocks/persistent

설명: 최근 N일에 M번 이상 나타난 지속 종목 조회

요청:
  GET /api/stocks/persistent?days=5&min=3
  Content-Type: application/json

쿼리 파라미터:
  days (optional): 조회 기간 (기본 5)
  min (optional): 최소 출현 횟수 (기본 3)

응답 (200 OK):
  {
    "days": 5,
    "min_appearances": 3,
    "stocks": [
      {
        "stock_name": "AAPL",
        "appearance_count": 5,
        "avg_rs": 78.5,
        "themes": ["AI", "테크"]
      },
      {
        "stock_name": "MSFT",
        "appearance_count": 4,
        "avg_rs": 82.0,
        "themes": ["AI", "클라우드"]
      }
    ]
  }

응답 스키마:
  PersistentStocksResponse {
    days: int
    min_appearances: int
    stocks: PersistentStockItem[]
  }

  PersistentStockItem {
    stock_name: string
    appearance_count: int
    avg_rs: float | null
    themes: string[]
  }

캐싱:
  React Query: staleTime 60s, gcTime 300s
  키: "stocks-persistent-{days}-{min}"

구현:
  파일: app/routers/stocks.py (line 30-65)
  쿼리: SELECT stock_name, COUNT(*) AS appearance_count,
              AVG(rs_score) AS avg_rs
        FROM theme_stock_daily
        WHERE date >= DATE(CURRENT_DATE, '-N days')
        GROUP BY stock_name
        HAVING COUNT(*) >= min_appearances
  의존: ThemeStockDaily, PersistentStockItem, PersistentStocksResponse
```

#### GET /api/stocks/group-action
```
엔드포인트: http://localhost:8000/api/stocks/group-action

설명: 그룹액션 (테마 기반 관련 종목 그룹화)

요청:
  GET /api/stocks/group-action?date=2024-01-15
  Content-Type: application/json

쿼리 파라미터:
  date (optional): YYYY-MM-DD 형식 (생략 시 최신)

응답 (200 OK):
  {
    "date": "2024-01-15",
    "stocks": [
      {
        "stock_name": "AAPL",
        "rs_score": 85,
        "change_pct": 2.5,
        "theme_name": "AI",
        "theme_rs_change": 12.3,
        "first_seen_date": "2024-01-10"
      },
      {
        "stock_name": "MSFT",
        "rs_score": 90,
        "change_pct": 3.1,
        "theme_name": "클라우드",
        "theme_rs_change": 8.5,
        "first_seen_date": "2024-01-08"
      }
    ]
  }

응답 스키마:
  GroupActionResponse {
    date: string
    stocks: GroupActionItem[]
  }

  GroupActionItem {
    stock_name: string
    rs_score: int | null
    change_pct: float | null
    theme_name: string
    theme_rs_change: float | null
    first_seen_date: string | null
  }

캐싱:
  React Query: staleTime 60s, gcTime 300s
  키: "stocks-group-action-{date}"

구현:
  파일: app/routers/stocks.py (line 68-110)
  처리: 테마별 종목 그룹핑, 관련 종목 추출
  의존: ThemeStockDaily, GroupActionItem, GroupActionResponse
```

---

### 4. 헬스 체크 엔드포인트

#### GET /health
```
엔드포인트: http://localhost:8000/health

설명: 서버 상태 확인

요청:
  GET /health
  Content-Type: application/json

응답 (200 OK):
  {
    "status": "ok"
  }

목적:
  - 로드 밸런서 헬스 체크
  - 서버 활성 상태 확인
  - 모니터링 시스템 핑

구현:
  파일: app/main.py (line 78-80)
  의존: 없음 (정적 응답)
```

---

## 이벤트 핸들러

### 1. 애플리케이션 라이프사이클 이벤트

#### app.lifespan (비동기 컨텍스트)
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
  """
  애플리케이션 시작/종료 시 자동 호출

  시작 (yield 전):
    - database.create_tables() 호출
    - 모든 ORM 모델의 테이블 생성
    - 데이터베이스 초기화

  종료 (yield 후):
    - 리소스 정리
    - 데이터베이스 연결 종료
    - 백그라운드 작업 정리
  """
  # 시작
  create_tables()
  yield
  # 종료 (현재는 정리 작업 없음)
```

---

### 2. 프론트엔드 라이프사이클 이벤트

#### React useEffect 훅 (trend/page.tsx)
```typescript
useEffect(() => {
  // dates 로드 완료 시 최신 날짜로 selectedDate 설정
  if (dates && dates.length > 0 && !selectedDate) {
    setSelectedDate(dates[0]);
  }
}, [dates, selectedDate]);
```

**이벤트 흐름:**
1. 페이지 마운트
2. useDates() 실행 (API 호출)
3. dates 상태 업데이트
4. useEffect 트리거
5. selectedDate 설정 (최신 날짜)
6. 자식 컴포넌트 리렌더링

---

### 3. React Query 이벤트

#### 쿼리 페칭 이벤트
```typescript
// 자동 트리거 이벤트:
- useQuery 훅 호출
  → 캐시 확인 (캐시 미스)
  → API 요청 실행
  → 응답 수신
  → 캐시 업데이트
  → 컴포넌트 리렌더링

// 수동 트리거:
- 날짜 선택 변경
  → selectedDate 상태 변경
  → useThemesDaily(selectedDate) 재실행
  → 새로운 쿼리 키로 캐시 확인
  → 캐시 미스 → API 요청
  → 응답 → 캐시 업데이트
  → UI 업데이트
```

---

## 사용자 상호작용 흐름

### 1. 날짜 선택 흐름

```
사용자: 날짜 드롭다운 클릭
    ▼
React select onChange 이벤트
    ▼
setSelectedDate(newDate) 호출
    ▼
selectedDate 상태 변경
    ▼
trend/page.tsx 리렌더링
    ▼
자식 컴포넌트에 selectedDate prop 전달
    ▼
각 훅이 새로운 쿼리 키로 다시 실행
    ├─ useThemesDaily(selectedDate)
    ├─ useThemeHistory(selectedThemes, selectedDate)
    ├─ useStocksPersistent(selectedDate)
    └─ useStocksGroupAction(selectedDate)
    ▼
React Query 캐시 확인
    → 캐시 미스 → API 호출
    → 캐시 히트 → 캐시 데이터 반환
    ▼
API 응답 또는 캐시 데이터
    ▼
컴포넌트 리렌더링
    ▼
UI 업데이트 (차트, 테이블)
```

### 2. 테마 멀티선택 흐름 (ThemeTrendChart)

```
사용자: 테마 체크박스 클릭
    ▼
selectedThemes 상태 변경
    ▼
각 선택된 테마에 대해:
    └─ useThemeHistory(themeName, days) 호출
       → 테마별 캐시 확인
       → API 요청 (캐시 미스)
       → 응답 캐시
    ▼
LineChart 데이터셋 업데이트
    ▼
차트 리렌더링 (여러 선 추가)
```

---

## CLI 명령어 정리

### 백엔드

```bash
# 개발 서버 시작
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 데이터 수집
python backend/scripts/ingest.py \
  --date 2024-01-15 \
  --source ./data/raw/market_data.html \
  --parser beautifulsoup

# 데이터베이스 초기화 (선택)
python -c "from app.database import create_tables; create_tables()"

# API 문서 접근
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

### 프론트엔드

```bash
# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 시작
npm run start

# 타입 체크
npm run type-check

# 린트 검사
npm run lint

# 포맷팅
npm run format
```

---

## 엔드포인트 호출 예시

### cURL 예시

```bash
# 날짜 조회
curl http://localhost:8000/api/dates

# 특정 날짜 테마 조회
curl "http://localhost:8000/api/themes/daily?date=2024-01-15"

# 급등 테마 조회 (임계값 10)
curl "http://localhost:8000/api/themes/surging?date=2024-01-15&threshold=10"

# AI 테마 30일 이력
curl "http://localhost:8000/api/themes/AI/history?days=30"

# 최근 5일 3회 이상 나타난 종목
curl "http://localhost:8000/api/stocks/persistent?days=5&min=3"

# 그룹액션 조회
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15"

# 헬스 체크
curl http://localhost:8000/health
```

### Axios 예시 (프론트엔드)

```typescript
// 날짜 조회
const dates = await api.getDates();

// 테마 조회
const themes = await api.getThemesDaily("2024-01-15");

// 급등 테마
const surging = await api.getThemesSurging("2024-01-15", 10);

// 테마 이력
const history = await api.getThemeHistory("AI", 30);

// 지속 종목
const stocks = await api.getStocksPersistent(5, 3);

// 그룹액션
const groupAction = await api.getStocksGroupAction("2024-01-15");
```
