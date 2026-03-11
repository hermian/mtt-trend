# mtt-trend 프로젝트 구조

## 전체 디렉토리 트리

```
mtt-trend/
├── backend/                         # FastAPI 백엔드 서버
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI 애플리케이션 진입점
│   │   ├── database.py              # SQLAlchemy 데이터베이스 연결
│   │   ├── models.py                # SQLAlchemy ORM 모델 정의
│   │   ├── schemas.py               # Pydantic 요청/응답 스키마
│   │   └── routers/                 # API 라우터 모듈
│   │       ├── themes.py            # 테마 관련 엔드포인트
│   │       └── stocks.py            # 종목 관련 엔드포인트
│   ├── scripts/
│   │   └── ingest.py                # HTML 파일 파싱 및 DB 적재 CLI
│   ├── data/                        # HTML 입력 파일 저장소
│   │   ├── 2024-01-01_report.html
│   │   ├── 2024-01-02_report.html
│   │   └── ...
│   ├── db/                          # SQLite 데이터베이스 저장 위치
│   │   └── trends.sqlite            # 메인 데이터베이스 파일
│   ├── tests/                       # 유닛/통합 테스트
│   │   ├── test_models.py
│   │   ├── test_routers.py
│   │   └── test_ingest.py
│   ├── Dockerfile                   # Docker 이미지 정의
│   ├── requirements.txt              # Python 의존성 목록
│   ├── .env.example                 # 환경 변수 템플릿
│   └── pyproject.toml               # Python 프로젝트 설정
│
├── frontend/                        # Next.js 프론트엔드 애플리케이션
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # 루트 레이아웃 컴포넌트
│   │   │   ├── page.tsx             # 홈 페이지
│   │   │   ├── globals.css          # 전역 스타일
│   │   │   └── trend/
│   │   │       ├── page.tsx         # 테마 분석 페이지
│   │   │       └── _components/     # 페이지별 서브 컴포넌트
│   │   │           ├── DailyThemesTable.tsx      # 일일 테마 테이블
│   │   │           ├── SurgingThemesCard.tsx    # 급등 테마 카드
│   │   │           ├── TimeSeriesChart.tsx      # 시계열 차트
│   │   │           ├── PersistentStocksTable.tsx # 지속 강세 종목 테이블
│   │   │           └── GroupActionAlert.tsx     # 그룹 액션 알림
│   │   ├── hooks/
│   │   │   ├── useThemes.ts         # 테마 데이터 페칭 훅
│   │   │   └── useStocks.ts         # 종목 데이터 페칭 훅
│   │   └── lib/
│   │       ├── api.ts               # API 클라이언트 함수 정의
│   │       └── utils.ts             # 유틸리티 함수 (포맷팅 등)
│   ├── public/                      # 정적 파일 (favicon, images)
│   │   ├── favicon.ico
│   │   └── logo.png
│   ├── tests/                       # 테스트 파일
│   │   ├── components.test.tsx
│   │   └── hooks.test.ts
│   ├── Dockerfile                   # Docker 이미지 정의
│   ├── package.json                 # Node 의존성 및 스크립트
│   ├── package-lock.json            # 의존성 잠금 파일
│   ├── tsconfig.json                # TypeScript 설정
│   ├── next.config.ts               # Next.js 설정
│   ├── tailwind.config.ts           # Tailwind CSS 설정
│   ├── postcss.config.js            # PostCSS 설정
│   └── .env.example                 # 환경 변수 템플릿
│
├── .github/
│   └── workflows/                   # GitHub Actions CI/CD 워크플로우
│       ├── backend-test.yml         # 백엔드 테스트
│       ├── frontend-test.yml        # 프론트엔드 테스트
│       └── deploy.yml               # 배포 워크플로우
│
├── docker-compose.yml               # Docker Compose 다중 컨테이너 설정
├── .dockerignore                    # Docker 빌드 제외 파일
├── .gitignore                       # Git 제외 파일
├── README.md                        # 프로젝트 개요 및 시작 가이드
├── CONTRIBUTING.md                 # 기여 가이드
├── LICENSE                          # 라이선스 파일
└── docs/                            # 추가 문서
    ├── API.md                       # API 문서
    ├── DATABASE.md                  # 데이터베이스 스키마 문서
    ├── DEPLOYMENT.md                # 배포 가이드
    └── ARCHITECTURE.md              # 시스템 아키텍처 문서
```

---

## 주요 디렉토리/파일 역할

### Backend (백엔드)

#### `app/main.py`
- FastAPI 애플리케이션 인스턴스 생성 및 라우트 등록
- CORS 설정, 미들웨어 구성
- 헬스체크 엔드포인트 정의

#### `app/database.py`
- SQLAlchemy 엔진 및 세션 설정
- 데이터베이스 연결 풀 관리
- 데이터베이스 초기화 로직

#### `app/models.py`
- `theme_daily`: 테마별 일일 집계 데이터
  - 필드: id, date, theme_name, stock_count, avg_rs, change_sum, volume_sum, data_source
  - data_source: '52w_high' (신고가) 또는 'mtt' (MTT 템플릿)
- `theme_stock_daily`: 테마별 종목 상세 데이터
  - 필드: id, date, theme_name, stock_name, rs_score, change_pct, data_source
  - data_source: 상위 테이블과 동일한 소스 구분

#### `app/schemas.py`
- `ThemeDailySchema`: 테마 조회 응답 스키마
- `StockSchema`: 종목 정보 응답 스키마
- `SurgingThemeSchema`: 급등 테마 응답 스키마

#### `app/routers/themes.py`
- `/api/dates` - 적재된 날짜 목록 조회
- `/api/themes/daily?date=&source=` - 날짜별 테마 목록 (avg_rs 내림차순), source: 52w_high|mtt
- `/api/themes/surging?date=&threshold=10&source=` - 급등 테마 (기준값 대비 +N)
- `/api/themes/{name}/history?days=30&source=` - 특정 테마의 RS 시계열

#### `app/routers/stocks.py`
- `/api/stocks/persistent?days=5&min=3&source=` - 지속 강세 종목 (N일 중 M회 이상)
- `/api/stocks/group-action?date=&source=` - 그룹 액션 탐지 (신규 + 상승)

#### `scripts/ingest.py`
- HTML 파일을 BeautifulSoup로 파싱
- 파일명 자동 감지로 데이터 소스 구분:
  - `★52Week_High_Stocks_By_Theme_With_RS_Scores_*.html` → source: '52w_high'
  - `★Themes_With_7_or_More_MTT_Stocks-Top7_*.html` → source: 'mtt'
- MTT 파일의 경우 평탄 테이블 형식 파싱 및 "종목명(RS/등락률%)" 형식 파싱
- 테이블 데이터 추출 및 정규화
- SQLite에 적재하는 배치 스크립트 (각 행에 data_source 포함)
- CLI 인터페이스 제공 (날짜, 파일경로 인자)

#### `data/` 디렉토리
- 제공되는 HTML 리포트 파일 저장
- 파일명 규칙:
  - 52주 신고가: `★52Week_High_Stocks_By_Theme_With_RS_Scores_YYYY-MM-DD.html`
  - MTT 템플릿: `★Themes_With_7_or_More_MTT_Stocks-Top7_YYYY-MM-DD.html`

#### `db/trends.sqlite`
- SQLite 데이터베이스 파일
- 테이블: theme_daily, theme_stock_daily
- 인덱스: date, theme_name, stock_name 등

### Frontend (프론트엔드)

#### `src/app/layout.tsx`
- 루트 레이아웃 컴포넌트
- 전체 페이지 틀 (헤더, 네비게이션, 푸터)
- React Query Provider, Tailwind 적용

#### `src/app/page.tsx`
- 홈 페이지
- 대시보드 개요 및 빠른 링크
- 최신 테마 상단 5개 미리보기

#### `src/app/trend/page.tsx`
- 테마 분석 페이지
- 5개 서브 컴포넌트 레이아웃 조정
- 필터 및 선택 상태 관리

#### `src/app/trend/_components/DailyThemesTable.tsx`
- 특정 날짜의 테마 목록을 테이블로 표시
- avg_rs 기준 정렬 가능
- 클릭으로 테마 상세 보기 가능

#### `src/app/trend/_components/SurgingThemesCard.tsx`
- 신규 급등 테마를 카드 형태로 표시
- 임계값 입력 UI (기본값 +10)
- 변화 방향 화살표로 시각화

#### `src/app/trend/_components/TimeSeriesChart.tsx`
- Recharts를 사용한 선 그래프
- 다중 테마 선택 지원 (legend 클릭으로 토글)
- 기간 선택 슬라이더 (7일, 30일, 90일, 1년)

#### `src/app/trend/_components/PersistentStocksTable.tsx`
- 지속 강세 종목을 테이블로 표시
- 필터: "N일 중 M회 이상" 조건
- 소속 테마, 출현 횟수 표시

#### `src/app/trend/_components/GroupActionAlert.tsx`
- 그룹 액션 감지된 테마 알림
- 카드 또는 배너 형태
- 신규 등장 + RS 상승 조건 강조

#### `src/hooks/useThemes.ts`
- TanStack Query 훅
- API 엔드포인트 호출 및 캐싱
- 로딩/에러 상태 관리

#### `src/hooks/useStocks.ts`
- 종목 데이터 페칭 훅
- 필터링 옵션 지원 (days, min_count)

#### `src/lib/api.ts`
- Axios 인스턴스 설정
- 기본 URL: `http://localhost:8000/api`
- 에러 처리 및 타입 안정성

### Docker & CI/CD

#### `docker-compose.yml`
- 백엔드 서비스 (FastAPI + SQLite)
- 프론트엔드 서비스 (Next.js)
- 포트 매핑: backend 8000, frontend 3000

#### `.github/workflows/`
- 푸시/PR 시 자동 테스트
- 커버리지 리포트 생성
- 메인 브랜치 배포 자동화

---

## 모듈 간 의존성 관계

### 데이터 흐름

```
HTML 리포트 파일 (52w_high 또는 mtt)
    ↓
scripts/ingest.py (파일명으로 소스 감지)
    ↓
BeautifulSoup 파싱 (소스별 레이아웃 대응)
    ↓
SQLite Database (trends.sqlite, data_source 컬럼 포함)
    ↓
Backend API (FastAPI, ?source 파라미터 지원)
    ↓ (REST JSON)
Frontend App (Next.js + React Query)
    ↓
소스 토글 버튼 (52주 신고가 ↔ MTT 종목)
    ↓
User Browser (Recharts 시각화)
```

### 백엔드 모듈 의존성

```
main.py
├── database.py (SQLAlchemy 설정)
│   └── models.py (ORM 정의)
├── routers/themes.py (쿼리 로직)
│   ├── models.py
│   └── schemas.py
└── routers/stocks.py
    ├── models.py
    └── schemas.py
```

### 프론트엔드 모듈 의존성

```
app/layout.tsx (루트)
├── app/page.tsx (홈)
└── app/trend/page.tsx
    ├── _components/DailyThemesTable.tsx
    ├── _components/SurgingThemesCard.tsx
    ├── _components/TimeSeriesChart.tsx
    ├── _components/PersistentStocksTable.tsx
    ├── _components/GroupActionAlert.tsx
    ├── hooks/useThemes.ts → lib/api.ts
    └── hooks/useStocks.ts → lib/api.ts
```

---

## 데이터 흐름 경로

### 1. 데이터 적재 경로

```
Step 1: HTML 파일 준비
  위치: backend/data/YYYY-MM-DD_report.html
  형식: 테이블 구조로 테마, 종목, RS 점수 포함

Step 2: ingest.py 실행
  명령어: python scripts/ingest.py --date 2024-01-01 --file data/2024-01-01_report.html
  동작:
    - HTML 파싱
    - 테이블 추출
    - 데이터 검증
    - SQLite 저장

Step 3: DB 업데이트
  테이블: theme_daily, theme_stock_daily
  인덱스: (date, theme_name), (date, stock_name) 등
```

### 2. 조회 경로

```
Step 1: Frontend 페이지 로드 (trend/page.tsx)
  ↓
Step 2: React Query 훅 호출 (useThemes, useStocks)
  ↓
Step 3: API 요청 (lib/api.ts)
  GET /api/themes/daily?date=2024-01-01
  GET /api/themes/surging?date=2024-01-01&threshold=10
  ↓
Step 4: Backend 라우터 처리 (routers/themes.py)
  - 요청 파라미터 검증
  - ORM 쿼리 실행 (models.py)
  - 결과 스키마 변환 (schemas.py)
  ↓
Step 5: JSON 응답
  HTTP 200 + JSON
  ↓
Step 6: React 컴포넌트 렌더링
  - Recharts 차트 렌더
  - 테이블 표시
```

### 3. 시계열 조회 경로

```
GET /api/themes/{theme_name}/history?days=30
  ↓
Backend 쿼리:
  SELECT * FROM theme_daily
  WHERE theme_name = '{name}'
  AND date >= DATE('now', '-30 days')
  ORDER BY date ASC
  ↓
응답: [
  { date: "2024-01-01", avg_rs: 45.2, ... },
  { date: "2024-01-02", avg_rs: 52.1, ... },
  ...
]
  ↓
Frontend TimeSeriesChart 렌더:
  Recharts 선 그래프
```

---

## 주요 데이터 흐름 특성

### 배치 vs 실시간

- **배치 처리**: ingest.py로 일일 1회 자동화 (권장: 05:00 KST)
- **실시간 조회**: REST API로 언제든지 조회 가능
- **캐싱**: TanStack Query로 클라이언트 캐싱 (staleTime 설정)

### 데이터 일관성

- **단일 소스**: SQLite 데이터베이스가 유일한 신뢰할 수 있는 출처
- **트랜잭션**: ingest.py에서 원자성 보장
- **검증**: Pydantic 스키마로 요청/응답 검증

### 성능 최적화

- **인덱싱**: date, theme_name, stock_name 기준 인덱싱
- **캐싱**: 프론트엔드 TanStack Query, 백엔드 Redis (Optional)
- **페이지네이션**: 대량 데이터 조회 시 100건 단위 분할

---

## 확장성 고려사항

### 수평 확장
- SQLite → PostgreSQL 마이그레이션 가능
- 백엔드 마이크로서비스 분리 가능
- 프론트엔드 정적 사이트 생성(SSG) 전환 가능

### 수직 확장
- 데이터베이스 연결 풀 증가
- API 동시 요청 처리 개선
- 프론트엔드 번들 크기 최적화

### 모니터링
- 백엔드: Prometheus + Grafana
- 프론트엔드: Sentry 에러 추적
- 데이터베이스: 쿼리 성능 모니터링
