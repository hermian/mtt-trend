# mtt-trend 데이터 흐름

## 종합 데이터 흐름 (HTML → DB → API → UI)

### 1. 전체 시스템 데이터 파이프라인

```
┌────────────────────────────────────────────────────────────────────┐
│                     COLLECTION PHASE (데이터 수집)                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  HTML 소스 (마켓 데이터)                                            │
│      ↓                                                             │
│  BeautifulSoup 파싱                                               │
│      ↓                                                             │
│  테마명, 종목명, RS 점수, 변화율 추출                                │
│      ↓                                                             │
│  Python dict/Pydantic 변환                                        │
│      ↓                                                             │
│  backend/scripts/ingest.py (CLI 실행)                             │
│      ↓                                                             │
│  데이터 검증 (Pydantic 스키마)                                     │
│      ↓                                                             │
│  SQLAlchemy ORM 객체 생성                                          │
│      ↓                                                             │
│  UPSERT 연산 (중복 데이터 처리)                                    │
│      ↓                                                             │
│  SQLite 데이터베이스 저장                                          │
│                                                                    │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────────────┐
│                     STORAGE PHASE (데이터 저장)                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  SQLite Database (data.db)                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ theme_daily 테이블                                        │   │
│  │ ─────────────────────────────────────────────────────    │   │
│  │ id | date       | theme_name | stock_count | avg_rs | ...  │   │
│  │ 1  │ 2024-01-15│ AI        │ 45         │ 82.5  │        │   │
│  │ 2  │ 2024-01-15│ 전기차     │ 38         │ 75.2  │        │   │
│  │ ...│ ...        │ ...       │ ...        │ ...   │        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ theme_stock_daily 테이블                                 │   │
│  │ ─────────────────────────────────────────────────────    │   │
│  │ id | date       | theme_name | stock_name | rs_score |   │   │
│  │ 1  │ 2024-01-15│ AI        │ AAPL      │ 85     │    │   │
│  │ 2  │ 2024-01-15│ AI        │ MSFT      │ 90     │    │   │
│  │ 3  │ 2024-01-15│ 전기차     │ BYD       │ 78     │    │   │
│  │ ...│ ...        │ ...       │ ...       │ ...    │    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                    │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────────────┐
│                      API PHASE (데이터 조회)                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  FastAPI 라우터 (app/routers/themes.py, stocks.py)               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /api/dates ← SELECT DISTINCT date FROM theme_daily      │   │
│  │ /api/themes/daily ← SELECT * FROM theme_daily WHERE ... │   │
│  │ /api/themes/surging ← 5일 이동평균 + 변화율 필터링        │   │
│  │ /api/themes/{name}/history ← 테마 이력 조회               │   │
│  │ /api/stocks/persistent ← GROUP BY stock_name, COUNT(*) │   │
│  │ /api/stocks/group-action ← 테마 기반 관련 종목           │   │
│  └──────────────────────────────────────────────────────────┘   │
│      ↓                                                             │
│  SQLAlchemy 쿼리 실행                                             │
│      ↓                                                             │
│  ORM 모델 → Python dict/Pydantic 변환                            │
│      ↓                                                             │
│  JSON 직렬화 (Pydantic 스키마)                                    │
│      ↓                                                             │
│  HTTP 응답 (200 OK)                                               │
│                                                                    │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION PHASE (UI 렌더링)                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  프론트엔드 (React/Next.js)                                        │
│      ↓                                                             │
│  Axios HTTP 클라이언트                                            │
│      ↓                                                             │
│  JSON 응답 수신                                                    │
│      ↓                                                             │
│  TypeScript 인터페이스로 타입 검증                                 │
│      ↓                                                             │
│  React Query 캐시에 저장                                          │
│      ↓                                                             │
│  컴포넌트에 데이터 전달                                            │
│      ↓                                                             │
│  React 상태 업데이트 (useState)                                   │
│      ↓                                                             │
│  Recharts 차트 렌더링                                             │
│  또는 HTML 테이블 렌더링                                          │
│      ↓                                                             │
│  사용자에게 시각화된 데이터 표시                                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 요청 생명주기 (프론트엔드 → 백엔드)

### 1. 사용자 상호작용에서 UI 표시까지

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER (사용자 액션)                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 시나리오: 사용자가 날짜 선택 드롭다운에서 "2024-01-15" 선택      │
│                                                                 │
│ React 컴포넌트 (trend/page.tsx)                                 │
│   ↓                                                             │
│ <select onChange={(e) => setSelectedDate(e.target.value)} />   │
│   ↓                                                             │
│ selectedDate 상태 변경 (null → "2024-01-15")                   │
│                                                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓

┌─────────────────────────────────────────────────────────────────┐
│ 2. QUERY TRIGGER (React Query 훅 재실행)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ selectedDate prop 변경 감지                                      │
│   ↓                                                             │
│ useThemesDaily("2024-01-15") 재호출                             │
│   ↓                                                             │
│ React Query 캐시 확인                                           │
│   ├─ 캐시 키: "themes-daily-2024-01-15"                        │
│   ├─ 캐시 상태: MISS (첫 요청)                                  │
│   └─ staleTime 확인: 60초 (아직 fresh)                         │
│   ↓                                                             │
│ API 호출 필요 (캐시 미스 or stale)                              │
│                                                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓

┌─────────────────────────────────────────────────────────────────┐
│ 3. API REQUEST (HTTP 요청)                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ api.getThemesDaily("2024-01-15") 호출                           │
│   ↓                                                             │
│ Axios 인스턴스                                                   │
│   ├─ baseURL: "http://localhost:8000"                          │
│   ├─ timeout: 10000ms                                          │
│   └─ headers: {"Content-Type": "application/json"}             │
│   ↓                                                             │
│ GET /api/themes/daily?date=2024-01-15 요청                     │
│   ├─ 메서드: GET                                                │
│   ├─ URL: http://localhost:8000/api/themes/daily              │
│   ├─ 쿼리: ?date=2024-01-15                                    │
│   ├─ 헤더: Content-Type, User-Agent                            │
│   └─ 바디: 없음                                                 │
│   ↓                                                             │
│ 네트워크 송신 (브라우저 → 서버)                                  │
│                                                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓

┌─────────────────────────────────────────────────────────────────┐
│ 4. SERVER PROCESSING (백엔드 처리)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ FastAPI 라우터 수신                                              │
│   ↓                                                             │
│ themes.router.get_themes_daily() 핸들러 실행                    │
│   ├─ 파라미터: date = "2024-01-15"                             │
│   ├─ 의존성: db: Session = Depends(get_db)                    │
│   │   └─ SQLite 세션 생성                                       │
│   └─ 함수 시작                                                  │
│   ↓                                                             │
│ SQLAlchemy 쿼리 작성                                            │
│   ↓                                                             │
│ db.query(ThemeDaily).filter(ThemeDaily.date == "2024-01-15")  │
│                     .order_by(ThemeDaily.avg_rs.desc())        │
│                     .all()                                      │
│   ↓                                                             │
│ SQL 생성 및 SQLite 실행                                         │
│   ↓                                                             │
│ SELECT * FROM theme_daily                                      │
│  WHERE date = '2024-01-15'                                     │
│  ORDER BY avg_rs DESC                                          │
│   ↓                                                             │
│ 데이터베이스 조회 결과                                           │
│   ├─ Row 1: ThemeDaily(date="2024-01-15", theme_name="AI", ...) │
│   ├─ Row 2: ThemeDaily(date="2024-01-15", theme_name="전기차", ...) │
│   └─ ...                                                        │
│   ↓                                                             │
│ Pydantic 스키마로 변환                                          │
│   ├─ ORM 모델 → ThemeDailyItem 변환 (from_attributes=True)    │
│   └─ 리스트: List[ThemeDailyItem]                              │
│   ↓                                                             │
│ 응답 스키마 생성                                                │
│   ├─ ThemeDailyResponse(date="2024-01-15", themes=[...])      │
│   └─ 응답 검증 완료                                             │
│   ↓                                                             │
│ JSON 직렬화 (Pydantic model_dump_json())                        │
│   ↓                                                             │
│ {                                                               │
│   "date": "2024-01-15",                                        │
│   "themes": [                                                  │
│     {                                                          │
│       "date": "2024-01-15",                                    │
│       "theme_name": "AI",                                      │
│       "stock_count": 45,                                       │
│       "avg_rs": 82.5,                                          │
│       "change_sum": 150.3,                                     │
│       "volume_sum": 1000000                                    │
│     },                                                         │
│     ...                                                        │
│   ]                                                            │
│ }                                                              │
│   ↓                                                             │
│ HTTP 응답 전송 (200 OK)                                         │
│                                                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓

┌─────────────────────────────────────────────────────────────────┐
│ 5. CLIENT RESPONSE (프론트엔드 응답 처리)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Axios 응답 수신                                                  │
│   ├─ 상태 코드: 200                                             │
│   ├─ 헤더: Content-Type: application/json                      │
│   └─ 바디: JSON 문자열                                          │
│   ↓                                                             │
│ TypeScript 타입 검증                                            │
│   ├─ 응답 타입: { date: string; themes: ThemeDaily[] }        │
│   ├─ 필드 검증: date (string), themes (array)                 │
│   └─ 각 요소 검증: ThemeDaily 인터페이스 확인                   │
│   ↓                                                             │
│ React Query 캐시 업데이트                                       │
│   ├─ 캐시 키: "themes-daily-2024-01-15"                       │
│   ├─ 데이터: { date, themes }                                 │
│   ├─ 상태: "success"                                           │
│   └─ 타임스탬프: 현재 시간                                      │
│   ↓                                                             │
│ React 컴포넌트 리렌더링 (TopThemesBar)                          │
│   ├─ data.themes 변경 감지                                     │
│   └─ 컴포넌트 리렌더 트리거                                     │
│   ↓                                                             │
│ Recharts BarChart 데이터 업데이트                               │
│   ├─ chartData 상태: themes 배열 변환                          │
│   │   ├─ { name: "AI", value: 82.5 }                         │
│   │   ├─ { name: "전기차", value: 75.2 }                      │
│   │   └─ ...                                                   │
│   └─ 차트 데이터 소스 업데이트                                  │
│   ↓                                                             │
│ SVG 차트 렌더링                                                 │
│   ├─ 바 아이템 생성 (각 테마별)                                │
│   ├─ X축: 테마명                                               │
│   ├─ Y축: avg_rs 값                                           │
│   └─ 색상: 테마별 구분 색                                       │
│   ↓                                                             │
│ DOM 업데이트                                                    │
│   └─ 브라우저 렌더링 (Paint)                                    │
│   ↓                                                             │
│ 사용자 화면에 표시                                              │
│   └─ "2024-01-15"의 테마 순위 차트 시각화                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 상태 관리 패턴

### 1. React Query (서버 상태)

```
┌──────────────────────────────────────────────────────────┐
│               React Query 상태 계층                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ QueryClient
│   │
│   ├─ Cache (메모리)
│   │   ├─ 캐시 키: "dates"
│   │   │   ├─ 데이터: string[]
│   │   │   ├─ 상태: "success" | "pending" | "error"
│   │   │   ├─ lastUpdated: timestamp
│   │   │   └─ staleTime: 60000ms
│   │   │
│   │   ├─ 캐시 키: "themes-daily-2024-01-15"
│   │   │   ├─ 데이터: { date, themes }
│   │   │   ├─ 상태: "success" | "pending" | "error"
│   │   │   └─ gcTime: 300000ms (가비지 컬렉션)
│   │   │
│   │   ├─ 캐시 키: "theme-history-AI-30"
│   │   │   ├─ 데이터: ThemeHistory[]
│   │   │   └─ ...
│   │   │
│   │   └─ ...
│   │
│   ├─ Observers (컴포넌트 구독)
│   │   ├─ TopThemesBar → "themes-daily-2024-01-15" 구독
│   │   ├─ ThemeTrendChart → "theme-history-AI-30", ... 구독
│   │   └─ StockAnalysisTabs → "stocks-persistent-5-3" 구독
│   │
│   └─ Background Refetch
│       ├─ 윈도우 포커스 시 자동 새로고침
│       ├─ 네트워크 복구 시 자동 새로고침
│       └─ 폴링 주기: 설정 가능
│
└────────────────────────────────────┬────────────────────┘
                                     │
                                     ↓
                    캐시 미스 또는 만료 시
                    useQuery 훅 → API 호출
```

### 2. React 로컬 상태 (UI 상태)

```
┌──────────────────────────────────────────────────────────┐
│              React Local State (useState)                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ trend/page.tsx
│   │
│   ├─ selectedDate
│   │   ├─ 타입: string | null
│   │   ├─ 초기값: null
│   │   ├─ 변경 트리거: 드롭다운 선택
│   │   └─ 영향: useThemesDaily, useStocksGroupAction 등
│   │
│   ├─ (ThemeTrendChart) selectedThemes
│   │   ├─ 타입: string[]
│   │   ├─ 초기값: []
│   │   ├─ 변경 트리거: 체크박스 클릭
│   │   └─ 영향: LineChart 데이터 업데이트
│   │
│   └─ (StockAnalysisTabs) activeTab
│       ├─ 타입: "persistent" | "group-action"
│       ├─ 초기값: "persistent"
│       ├─ 변경 트리거: 탭 클릭
│       └─ 영향: 표시할 테이블 선택
│
└──────────────────────────────────────────────────────────┘
```

### 3. 상태 변경 흐름

```
사용자 액션
    ↓
UI 이벤트 (onChange, onClick)
    ↓
setState 호출
    ↓
로컬 상태 업데이트 (React)
    ↓
컴포넌트 리렌더
    ↓
자식 컴포넌트에 prop 전달 (새로운 값)
    ↓
React Query 훅 재실행 (의존성 배열 변경)
    ↓
React Query 캐시 확인
    ├─ 캐시 HIT → 캐시 데이터 반환 (즉시)
    ├─ 캐시 MISS → API 호출 (비동기)
    ├─ 캐시 STALE → 캐시 반환 + 백그라운드 갱신
    └─ 오류 → 오류 상태 반환
    ↓
쿼리 상태 업데이트 (pending → success/error)
    ↓
컴포넌트 리렌더 (data/error 변경)
    ↓
UI 업데이트
    ↓
사용자 화면에 표시
```

---

## 데이터 변환 단계

### 1. 백엔드 변환 흐름 (SQL → JSON)

```
데이터베이스 (SQLite)
    │
    ↓ (SQL 쿼리 실행)
    │
ORM 모델 객체
    ├─ ThemeDaily {
    │    id: 1
    │    date: "2024-01-15"
    │    theme_name: "AI"
    │    stock_count: 45
    │    avg_rs: 82.5
    │    change_sum: 150.3
    │    volume_sum: 1000000
    │  }
    │
    ↓ (Pydantic 스키마 변환)
    │
Pydantic 모델
    ├─ ThemeDailyItem {
    │    date: "2024-01-15"
    │    theme_name: "AI"
    │    stock_count: 45
    │    avg_rs: 82.5
    │    change_sum: 150.3
    │    volume_sum: 1000000
    │  }
    │
    ↓ (JSON 직렬화)
    │
JSON 문자열
    ├─ {
    │    "date": "2024-01-15",
    │    "theme_name": "AI",
    │    "stock_count": 45,
    │    "avg_rs": 82.5,
    │    "change_sum": 150.3,
    │    "volume_sum": 1000000
    │  }
    │
    ↓ (HTTP 응답)
    │
HTTP 바디 (텍스트)
```

### 2. 프론트엔드 변환 흐름 (JSON → UI)

```
HTTP 응답 (JSON 문자열)
    ├─ {
    │    "date": "2024-01-15",
    │    "themes": [
    │      { "theme_name": "AI", "avg_rs": 82.5, ... },
    │      { "theme_name": "전기차", "avg_rs": 75.2, ... }
    │    ]
    │  }
    │
    ↓ (JSON 파싱)
    │
JavaScript 객체
    ├─ {
    │    date: "2024-01-15"
    │    themes: [
    │      ThemeDailyItem { ... }
    │      ThemeDailyItem { ... }
    │    ]
    │  }
    │
    ↓ (TypeScript 타입 검증)
    │
타입 안전 객체
    ├─ ThemeDailyResponse {
    │    date: string
    │    themes: ThemeDaily[]
    │  }
    │
    ↓ (React Query 캐시 저장)
    │
쿼리 캐시
    ├─ 키: "themes-daily-2024-01-15"
    ├─ 데이터: { date, themes }
    └─ 상태: "success"
    │
    ↓ (컴포넌트 리렌더)
    │
React 상태 업데이트
    ├─ data: ThemeDailyResponse
    ├─ isLoading: false
    └─ error: null
    │
    ↓ (컴포넌트 변환)
    │
Recharts 차트 데이터
    ├─ [
    │    { name: "AI", value: 82.5, key: "avg_rs" },
    │    { name: "전기차", value: 75.2, key: "avg_rs" }
    │  ]
    │
    ↓ (SVG 렌더링)
    │
HTML/SVG DOM
    ├─ <BarChart />
    │    ├─ <Bar dataKey="value" fill="#8884d8" />
    │    ├─ <XAxis dataKey="name" />
    │    └─ <YAxis />
    │
    ↓ (브라우저 렌더링)
    │
사용자 화면 (픽셀)
```

### 3. 데이터 변환 체크포인트

| 단계 | 입력 | 변환 | 출력 | 검증 |
|------|------|------|------|------|
| 데이터베이스 | Row 객체 | SQLAlchemy ORM | ThemeDaily 객체 | DB 제약조건 |
| 백엔드 API | ThemeDaily 객체 | Pydantic 매핑 | ThemeDailyItem | from_attributes=True |
| 직렬화 | ThemeDailyItem | model_dump_json() | JSON 문자열 | JSONEncoder |
| 네트워크 | JSON 문자열 | HTTP 전송 | 바이트 스트림 | HTTP 헤더 |
| 파싱 | 바이트 스트림 | JSON.parse() | JS 객체 | JSON 구조 |
| 타입 검증 | JS 객체 | TypeScript 검사 | 타입 안전 객체 | 런타임 검증 |
| React Query | 타입 안전 객체 | 캐시 저장 | 캐시 엔트리 | 캐시 키 일치 |
| 컴포넌트 | 캐시 엔트리 | 상태 업데이트 | React 상태 | 의존성 배열 |
| 차트 데이터 | React 상태 | 데이터 포맷 | 차트 데이터셋 | 스키마 일치 |
| 렌더링 | 차트 데이터셋 | SVG 생성 | DOM 요소 | 브라우저 API |

---

## 특수 데이터 변환

### 1. 5일 이동평균 계산 (급등 테마)

```
입력: 테마별 최근 5일 avg_rs 값
  ├─ 2024-01-11: 70.0
  ├─ 2024-01-12: 72.0
  ├─ 2024-01-13: 75.0
  ├─ 2024-01-14: 78.0
  └─ 2024-01-15: 82.5

처리:
  이동평균 = (70.0 + 72.0 + 75.0 + 78.0 + 82.5) / 5
  avg_rs_5d = 75.5

변화율 계산:
  rs_change = ((82.5 - 75.5) / 75.5) × 100
  rs_change = 9.27%

필터링:
  if (rs_change >= threshold) → 응답에 포함

출력:
  ThemeSurgingItem {
    avg_rs: 82.5
    avg_rs_5d: 75.5
    rs_change: 9.27
  }
```

### 2. 지속 종목 필터링

```
입력: 최근 5일 theme_stock_daily 레코드
  ├─ 2024-01-11: AAPL, RS 80
  ├─ 2024-01-12: AAPL, RS 85
  ├─ 2024-01-13: AAPL, RS 78
  ├─ 2024-01-14: AAPL, RS 82
  ├─ 2024-01-15: AAPL, RS 85
  └─ (MSFT, BYD 등 다른 종목들)

처리:
  GROUP BY stock_name
  COUNT(*) as appearance_count
  AVG(rs_score) as avg_rs

  stock_name | appearance_count | avg_rs | themes
  AAPL       | 5                | 82.0   | ["AI", "테크"]
  MSFT       | 4                | 80.5   | ["AI", "클라우드"]
  ...

필터링:
  if (appearance_count >= min_appearances) → 응답에 포함
  (기본 min = 3)

출력:
  PersistentStockItem {
    stock_name: "AAPL"
    appearance_count: 5
    avg_rs: 82.0
    themes: ["AI", "테크"]
  }
```

### 3. 그룹액션 데이터 구성

```
입력: 특정 날짜 theme_stock_daily 데이터
  ├─ 2024-01-15, AI, AAPL, RS 85, 변화율 2.5%
  ├─ 2024-01-15, AI, MSFT, RS 90, 변화율 3.1%
  ├─ 2024-01-15, 전기차, BYD, RS 78, 변화율 1.8%
  └─ ...

처리:
  1. 각 레코드에 대해:
     - 해당 종목의 첫 출현 날짜 조회
     - 해당 테마의 현재 RS 변화율 조회

  2. 종목별 추가 정보 조회:
     - first_seen_date (언제부터 나타났는가)
     - theme_rs_change (테마의 강도 변화)

출력:
  GroupActionItem {
    stock_name: "AAPL"
    rs_score: 85
    change_pct: 2.5
    theme_name: "AI"
    theme_rs_change: 12.3
    first_seen_date: "2024-01-08"
  }
```

---

## 에러 처리 및 데이터 검증

### 1. 백엔드 검증

```
API 요청 수신
    ↓
쿼리 파라미터 검증
    ├─ date: 필수 여부 확인
    ├─ 형식: YYYY-MM-DD 검증
    ├─ 범위: 데이터베이스에 존재하는 날짜인지 확인
    └─ threshold: 숫자 범위 확인 (0-100)
    ↓
데이터베이스 쿼리
    ├─ SQL 인젝션 방지 (SQLAlchemy ORM 사용)
    ├─ NULL 처리 (Optional 타입)
    └─ 빈 결과 처리
    ↓
Pydantic 응답 검증
    ├─ 필드 타입 확인
    ├─ NULL 허용 여부 검증
    └─ 필수 필드 확인
    ↓
응답 생성 및 반환
    └─ 오류 시 400/404/500 상태 코드 반환
```

### 2. 프론트엔드 검증

```
API 호출
    ↓
HTTP 응답 수신
    ├─ 상태 코드 확인 (200, 400, 404, 500)
    ├─ 오류 처리:
    │   ├─ 4xx: 클라이언트 오류 (입력 검증)
    │   ├─ 5xx: 서버 오류 (재시도 또는 폴백)
    │   └─ 네트워크 오류: 재시도
    └─ JSON 파싱
    ↓
TypeScript 타입 검증
    ├─ 필드 존재 여부 확인
    ├─ 타입 일치 여부 확인
    └─ 스키마 검증
    ↓
React Query 에러 처리
    ├─ error 상태 업데이트
    ├─ 컴포넌트에 오류 표시
    └─ 사용자에게 오류 메시지 전달
    ↓
UI 오류 표시
    ├─ 로딩 상태: 스피너 표시
    ├─ 오류 상태: "데이터 로드 실패" 메시지
    └─ 빈 상태: "데이터 없음" 메시지
```

---

## 데이터 흐름 최적화

### 1. 캐싱 전략

```
React Query 캐시 계층:

  캐시 정책:
    staleTime: 60000ms
      → 이 시간 내에는 캐시된 데이터를 fresh 상태로 간주
      → API 호출 없이 캐시 데이터 반환

    gcTime (formerly cacheTime): 300000ms
      → 캐시 엔트리를 메모리에 유지하는 시간
      → 이 시간 후 자동 삭제

    refetchOnWindowFocus: true
      → 윈도우가 포커스를 받을 때 자동 새로고침

  캐시 히트 시나리오:
    useThemesDaily("2024-01-15") 호출
      → 캐시 키 "themes-daily-2024-01-15" 확인
      → 캐시 존재 + stale 아님
      → 즉시 캐시 데이터 반환 (네트워크 없음)

  캐시 미스 시나리오:
    useThemeHistory("AI", 30) 호출
      → 캐시 키 "theme-history-AI-30" 확인
      → 캐시 미스
      → API 호출 (/api/themes/AI/history?days=30)
      → 응답 수신
      → 캐시에 저장
      → 컴포넌트에 반환
```

### 2. 배경 갱신 (Background Refetch)

```
시나리오: 사용자가 다른 탭에 있다가 돌아옴

  1. 윈도우 focus 이벤트 발생
  2. React Query 감지
  3. staleTime 확인
  4. stale 상태면 배경에서 자동 API 호출
  5. 새로운 데이터 도착
  6. 캐시 업데이트
  7. 컴포넌트 리렌더 (사용자는 자동 새로고침 인식)

  장점:
    - 사용자 경험 개선 (항상 최신 데이터)
    - 네트워크 요청 최적화 (stale 시에만)
    - 로딩 화면 없음 (캐시 데이터 먼저 표시)
```

### 3. 데이터베이스 인덱스 활용

```
theme_daily 테이블:
  인덱스: idx_td_date (date 컬럼)
  쿼리: SELECT * FROM theme_daily WHERE date = '2024-01-15'
  최적화: 인덱스 사용 (Full Table Scan 회피)
  성능: O(log n) vs O(n)

theme_stock_daily 테이블:
  인덱스 1: idx_tsd_stock (stock_name, date)
    쿼리: SELECT * FROM theme_stock_daily WHERE stock_name = 'AAPL' AND date = '2024-01-15'
    성능: 인덱스 범위 검색

  인덱스 2: idx_tsd_theme_date (theme_name, date)
    쿼리: SELECT * FROM theme_stock_daily WHERE theme_name = 'AI' AND date = '2024-01-15'
    성능: 인덱스 범위 검색
```

---

## 데이터 일관성 및 무결성

### 1. ACID 보장

```
테마 데이터 삽입 (ingest.py):

Atomic (원자성):
  - UPSERT 연산이 전부 성공하거나 전부 실패
  - 중간 상태 없음

Consistent (일관성):
  - 유니크 제약조건: (date, theme_name) 중복 방지
  - 외래키 없음 (관계 단순화)
  - Pydantic 검증으로 데이터 타입 보장

Isolated (격리성):
  - SQLite: 연속적 트랜잭션
  - 동시 접근 최소화 (단일 프로세스)

Durable (지속성):
  - 데이터베이스 파일 (data.db) 디스크 저장
  - 서버 재시작 후에도 데이터 유지
```

### 2. 데이터 버전 관리

```
데이터 갱신 흐름:

같은 날짜/테마의 데이터 재수집:
  1. 이전 데이터 조회 (date + theme_name)
  2. 유니크 제약조건 확인
  3. UPSERT 실행 (UPDATE or INSERT)
     ├─ 존재하면 UPDATE (새 데이터로 교체)
     └─ 없으면 INSERT (새로 추가)

예시:
  1차 수집: 2024-01-15 AI 테마, stock_count=45, avg_rs=80.0
  DB: INSERT INTO theme_daily VALUES (date='2024-01-15', theme_name='AI', stock_count=45, avg_rs=80.0, ...)

  2차 수집: 2024-01-15 AI 테마, stock_count=46, avg_rs=82.5 (업데이트)
  DB: UPDATE theme_daily SET stock_count=46, avg_rs=82.5 WHERE date='2024-01-15' AND theme_name='AI'

장점: 버전 관리 없이도 최신 데이터만 유지
```
