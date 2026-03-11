# mtt-trend 기술 스택

## 기술 스택 표

### 백엔드 (Backend)

| 영역 | 기술 | 버전 | 용도 |
|------|------|------|------|
| 런타임 | Python | 3.11+ | 백엔드 애플리케이션 |
| 웹 프레임워크 | FastAPI | 0.109.2 | REST API 구축 |
| ASGI 서버 | Uvicorn | 0.27.1 | FastAPI 실행 환경 |
| ORM | SQLAlchemy | 2.0.28 | 데이터베이스 매핑 |
| 데이터 검증 | Pydantic | 2.6.1 | 요청/응답 스키마 |
| HTML 파싱 | BeautifulSoup4 | 4.12.3 | HTML 리포트 파싱 |
| 데이터베이스 | SQLite | 3.40+ | 로컬 데이터 저장 |
| 테스트 | pytest | 7.4+ | 유닛 및 통합 테스트 |
| 타입 검사 | mypy | 1.7+ | 정적 타입 검사 |
| 코드 포맷팅 | Black | 23.12+ | 코드 스타일 통일 |

### 프론트엔드 (Frontend)

| 영역 | 기술 | 버전 | 용도 |
|------|------|------|------|
| 런타임 | Node.js | 18.0+ | JavaScript 실행 환경 |
| 메타프레임워크 | Next.js | 14.1.0+ | React 메타프레임워크 |
| UI 라이브러리 | React | 18.2.0+ | 컴포넌트 기반 UI |
| 언어 | TypeScript | 5.3+ | 타입 안정성 |
| 상태 관리 | TanStack Query | 5.17+ | 서버 상태 관리 |
| HTTP 클라이언트 | Axios | 1.6.5 | API 호출 |
| 차트 라이브러리 | Recharts | 2.10.4 | 시계열 데이터 시각화 |
| CSS 프레임워크 | Tailwind CSS | 3.4.1 | 유틸리티 CSS |
| 컴포넌트 라이브러리 | Headless UI | 1.7.0+ | 접근성 높은 컴포넌트 |
| 아이콘 | Heroicons | 2.0+ | SVG 아이콘 |
| 테스트 | Jest | 29.0+ | 유닛 테스트 |
| 테스트 | React Testing Library | 14.0+ | 컴포넌트 테스트 |

### DevOps & 배포

| 영역 | 기술 | 용도 |
|------|------|------|
| 컨테이너화 | Docker | 애플리케이션 컨테이너화 |
| 컨테이너 오케스트레이션 | Docker Compose | 로컬 개발 환경 |
| 리포지토리 | GitHub | 소스 코드 관리 |
| CI/CD | GitHub Actions | 자동 테스트 및 배포 |
| 배포 | Vercel / AWS / 자체 서버 | 프로덕션 배포 |
| 모니터링 | Sentry (선택) | 에러 추적 및 모니터링 |

---

## 기술 선택 근거

### FastAPI 선택 이유

1. **고성능**: ASGI 기반으로 비동기 처리 지원
2. **자동 API 문서화**: Swagger UI 및 ReDoc 자동 제공
3. **타입 안정성**: Pydantic 통합으로 요청/응답 검증
4. **개발 속도**: 보일러플레이트 코드 최소화
5. **커뮤니티**: 빠르게 성장하는 프레임워크

### SQLAlchemy 선택 이유

1. **강력한 ORM**: 복잡한 쿼리도 쉽게 표현
2. **데이터베이스 독립성**: SQLite → PostgreSQL 마이그레이션 용이
3. **관계 매핑**: 테이블 간 관계 자동 처리
4. **마이그레이션**: Alembic과 통합으로 스키마 관리 용이

### Next.js + React 선택 이유

1. **정적 생성**: 페이지 미리 생성으로 빠른 로딩
2. **App Router**: 최신 라우팅 패턴 (파일 기반)
3. **TypeScript**: 타입 안정성 및 개발 경험 향상
4. **SEO 최적화**: 메타 태그 자동 관리
5. **배포 용이**: Vercel과 완벽한 통합

### TanStack Query 선택 이유

1. **서버 상태 관리**: 복잡한 캐싱 로직 자동화
2. **자동 재요청**: 포커스 시 데이터 동기화
3. **무한 스크롤**: 페이지네이션 자동 처리
4. **개발자 경험**: React DevTools 플러그인 제공

### Recharts 선택 이유

1. **React 네이티브**: JSX로 직관적인 차트 작성
2. **반응형 디자인**: 모바일 자동 최적화
3. **풍부한 차트 종류**: 선, 막대, 파이 등 다양
4. **커스터마이징**: CSS와 Props로 스타일 조정 용이

### SQLite 선택 이유 (현재)

1. **간단함**: 설정 없이 즉시 사용 가능
2. **로컬 개발**: 서버 없이 개발 환경 구성
3. **비용**: 완전 무료
4. **마이그레이션**: 나중에 PostgreSQL로 전환 용이

**향후 계획**: 데이터 증가 시 PostgreSQL로 마이그레이션

---

## 개발 환경 요구사항

### 필수 소프트웨어

- **Python 3.11 이상**
  - macOS: `brew install python@3.11` 또는 pyenv 사용
  - Windows: python.org에서 다운로드 후 설치
  - Linux: `apt-get install python3.11` (Ubuntu)

- **Node.js 18.0 이상**
  - macOS: `brew install node` 또는 nvm 사용
  - Windows: nodejs.org에서 다운로드 후 설치
  - Linux: nvm을 통한 설치 권장

- **Git**
  - 소스 코드 관리용

- **Docker & Docker Compose** (선택)
  - 컨테이너 환경에서 실행 시 필요
  - Docker Desktop macOS/Windows, Linux 패키지 설치

### 권장 개발 도구

- **VS Code**: 프론트엔드/백엔드 통합 개발
- **PyCharm Community**: Python 개발 (무료)
- **Postman**: API 테스트
- **Git Desktop / GitHub CLI**: 버전 관리
- **Chrome DevTools**: 프론트엔드 디버깅

### 시스템 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|------|---------|---------|
| CPU | 2코어 | 4코어 이상 |
| RAM | 4GB | 8GB 이상 |
| 디스크 | 5GB (프로젝트) | 20GB 여유 |
| 네트워크 | 1Mbps | 10Mbps 이상 |

---

## 로컬 실행 방법

### 방법 1: 네이티브 설치 (개발 권장)

#### 1-1. 백엔드 설정

```bash
# 프로젝트 루트 디렉토리
cd backend

# Python 가상환경 생성
python3.11 -m venv venv

# 가상환경 활성화 (macOS/Linux)
source venv/bin/activate
# 가상환경 활성화 (Windows)
venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 데이터베이스 초기화 (선택)
python -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"

# 서버 시작 (http://localhost:8000)
uvicorn app.main:app --reload --port 8000
```

#### 1-2. 프론트엔드 설정

```bash
# 프로젝트 루트로 이동
cd frontend

# Node 의존성 설치
npm install

# 개발 서버 시작 (http://localhost:3000)
npm run dev
```

#### 1-3. 데이터 적재

```bash
# 백엔드 디렉토리에서
cd backend

# HTML 파일 파싱 및 DB 적재
python scripts/ingest.py --date 2024-01-01 --file data/2024-01-01_report.html

# 또는 배치 처리 (data 폴더의 모든 HTML 파일)
python scripts/ingest.py --batch data/
```

### 방법 2: Docker Compose (프로덕션 유사)

```bash
# 프로젝트 루트에서
docker-compose up -d

# 서비스 확인
docker-compose ps

# 로그 확인
docker-compose logs -f

# 서비스 종료
docker-compose down
```

**접근 URL**:
- 백엔드 API: http://localhost:8000
- 프론트엔드: http://localhost:3000
- API 문서: http://localhost:8000/docs (Swagger)
- API 문서: http://localhost:8000/redoc (ReDoc)

### 방법 3: 개별 Docker 실행

```bash
# 백엔드 이미지 빌드
cd backend
docker build -t mtt-trend-backend .
docker run -p 8000:8000 -v $(pwd)/db:/app/db mtt-trend-backend

# 프론트엔드 이미지 빌드
cd frontend
docker build -t mtt-trend-frontend .
docker run -p 3000:3000 mtt-trend-frontend
```

---

## 환경 변수 목록

### 백엔드 환경 변수 (`.env`)

```bash
# 애플리케이션 설정
APP_NAME=mtt-trend
APP_ENV=development    # development, staging, production
DEBUG=True

# 데이터베이스 설정
DATABASE_URL=sqlite:///./db/trends.sqlite
# PostgreSQL 사용 시:
# DATABASE_URL=postgresql://user:password@localhost:5432/mtt_trend

# 서버 설정
HOST=0.0.0.0
PORT=8000
WORKERS=4

# CORS 설정
CORS_ORIGINS=["http://localhost:3000", "http://127.0.0.1:3000"]

# API 문서
DOCS_URL=/docs
REDOC_URL=/redoc

# 외부 서비스 (선택)
SENTRY_DSN=  # 에러 추적
LOG_LEVEL=INFO
```

### 프론트엔드 환경 변수 (`.env.local`)

```bash
# API 서버 주소
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# 환경
NEXT_PUBLIC_ENV=development

# Analytics (선택)
NEXT_PUBLIC_GA_ID=  # Google Analytics

# Sentry (선택)
NEXT_PUBLIC_SENTRY_DSN=

# 기능 플래그
NEXT_PUBLIC_ENABLE_ALERTS=true
NEXT_PUBLIC_ENABLE_EXPORT=true

# 데이터 소스 기본값
NEXT_PUBLIC_DEFAULT_DATA_SOURCE=52w_high  # 또는 mtt
```

### 환경 변수 설정 방법

```bash
# 백엔드
cd backend
cp .env.example .env
# .env 파일 편집

# 프론트엔드
cd frontend
cp .env.example .env.local
# .env.local 파일 편집
```

---

## API 엔드포인트 빠른 참조

### 기본 정보

- **Base URL**: `http://localhost:8000/api`
- **응답 형식**: JSON
- **인증**: 현재 없음 (향후 JWT 추가 예정)
- **데이터 소스 선택**: `source` 파라미터로 '52w_high' (기본값) 또는 'mtt' 지정

### 테마 엔드포인트

#### GET `/dates`
일자별 적재된 데이터 목록 조회
```
응답: ["2024-01-01", "2024-01-02", ...]
```

#### GET `/themes/daily`
특정 날짜의 테마별 집계 데이터
```
파라미터:
  date: YYYY-MM-DD (필수)
  source: 52w_high|mtt (선택, 기본값: 52w_high)

응답: [
  {
    "theme_name": "AI",
    "stock_count": 15,
    "avg_rs": 45.3,
    "change_sum": 123.45,
    "volume_sum": 1000000,
    "data_source": "52w_high"
  },
  ...
]
```

#### GET `/themes/surging`
급등 테마 (임계값 이상 상승)
```
파라미터:
  date: YYYY-MM-DD (필수)
  threshold: 10 (선택, 기본값: 10 포인트)
  source: 52w_high|mtt (선택, 기본값: 52w_high)

응답: [
  {
    "theme_name": "배터리",
    "current_rs": 52.3,
    "previous_avg": 42.1,
    "change": 10.2,
    "data_source": "52w_high"
  },
  ...
]
```

#### GET `/themes/{theme_name}/history`
특정 테마의 시계열 데이터
```
파라미터:
  days: 30 (선택, 기본값: 30일)
  source: 52w_high|mtt (선택, 기본값: 52w_high)

응답: [
  {
    "date": "2024-01-01",
    "avg_rs": 45.2,
    "stock_count": 12,
    "data_source": "52w_high"
  },
  ...
]
```

### 종목 엔드포인트

#### GET `/stocks/persistent`
지속 강세 종목 (N일 중 M회 이상 출현)
```
파라미터:
  days: 20 (선택)
  min: 3 (선택, N일 중 M회 이상)
  source: 52w_high|mtt (선택, 기본값: 52w_high)

응답: [
  {
    "stock_name": "삼성전자",
    "appearance_count": 5,
    "first_date": "2024-01-01",
    "latest_date": "2024-01-20",
    "data_source": "52w_high"
  },
  ...
]
```

#### GET `/stocks/group-action`
그룹 액션 탐지 (신규 테마 + RS 상승)
```
파라미터:
  date: YYYY-MM-DD (필수)
  source: 52w_high|mtt (선택, 기본값: 52w_high)

응답: [
  {
    "theme_name": "수소",
    "new_appearance": true,
    "rs_trend": "상승",
    "trigger_date": "2024-01-15",
    "data_source": "52w_high"
  },
  ...
]
```

### 헬스체크

#### GET `/health`
서버 상태 확인
```
응답: {
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 프론트엔드 UI 구조

### 데이터 소스 관리

#### 데이터 타입 및 API 함수 (`src/lib/api.ts`)

```typescript
type DataSource = '52w_high' | 'mtt';
// 모든 API 함수에 source 파라미터 추가
// 예: fetchThemesDaily(date, source)
```

#### 커스텀 훅 (`src/hooks/useThemes.ts`, `src/hooks/useStocks.ts`)

모든 훅에서 `source` 파라미터 지원:
- 쿼리 키에 source 포함으로 소스별 캐싱 분리
- source 변경 시 자동 재요청

#### 테마 분석 페이지 (`src/app/trend/page.tsx`)

- **헤더에 데이터 소스 토글 버튼** 추가:
  - "52주 신고가" / "MTT 종목" 전환 UI
  - 버튼 클릭 시 날짜 선택 리셋
  - 전체 데이터 새로고침 트리거
- `source` 상태 관리 및 모든 서브 컴포넌트에 prop 전달
- 소스별 독립적 필터링 상태 유지

#### 하위 컴포넌트들 (`src/app/trend/_components/`)

모든 5개 컴포넌트가 `source` prop 수신:
- `DailyThemesTable.tsx`: source 파라미터로 API 호출
- `SurgingThemesCard.tsx`: source별 급등 테마 필터링
- `TimeSeriesChart.tsx`: source별 시계열 데이터 표시
- `PersistentStocksTable.tsx`: source별 지속 강세 종목 조회
- `GroupActionAlert.tsx`: source별 그룹 액션 탐지

---

## 개발 워크플로우

### 1. 백엔드 개발

```bash
# 가상환경 활성화
cd backend && source venv/bin/activate

# 테스트 실행
pytest tests/

# 타입 검사
mypy app/

# 코드 포맷팅
black app/ scripts/

# 서버 시작 (핫 리로드)
uvicorn app.main:app --reload
```

### 2. 프론트엔드 개발

```bash
cd frontend

# 패키지 설치
npm install

# 테스트 실행
npm run test

# 개발 서버 (핫 리로드)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 빌드 미리보기
npm run start
```

### 3. 데이터 파이프라인

```bash
cd backend

# 52주 신고가 데이터 적재 (자동 소스 감지)
python scripts/ingest.py --file data/★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html

# MTT 템플릿 데이터 적재 (자동 소스 감지)
python scripts/ingest.py --file data/★Themes_With_7_or_More_MTT_Stocks-Top7_2024-01-15.html

# 배치 처리 (data 폴더의 모든 파일 자동 소스 감지)
python scripts/ingest.py --batch data/

# 데이터 검증 (특정 소스 확인)
python -c "from app.models import ThemeDaily; print(ThemeDaily.query.filter_by(data_source='52w_high').count())"

# 데이터 백업
sqlite3 db/trends.sqlite ".backup db/backup_$(date +%Y%m%d).sqlite"
```

---

## 주요 명령어 정리

### 백엔드

| 명령어 | 설명 |
|--------|------|
| `uvicorn app.main:app --reload` | 개발 서버 시작 |
| `pytest` | 모든 테스트 실행 |
| `pytest tests/test_routers.py -v` | 특정 테스트 파일 실행 |
| `black app/` | 코드 포맷팅 |
| `mypy app/` | 타입 검사 |
| `python scripts/ingest.py --file data/YYYY-MM-DD_report.html` | 데이터 적재 |

### 프론트엔드

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 시작 |
| `npm run build` | 프로덕션 빌드 |
| `npm run test` | 테스트 실행 |
| `npm run lint` | 코드 스타일 검사 |
| `npm run type-check` | TypeScript 타입 검사 |

### Docker

| 명령어 | 설명 |
|--------|------|
| `docker-compose up -d` | 모든 서비스 시작 |
| `docker-compose down` | 모든 서비스 중지 |
| `docker-compose logs -f` | 로그 실시간 확인 |
| `docker-compose ps` | 실행 중인 서비스 확인 |

---

## 데이터베이스 스키마

### theme_daily 테이블

```sql
CREATE TABLE theme_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  theme_name TEXT NOT NULL,
  data_source TEXT NOT NULL DEFAULT '52w_high',
  stock_count INTEGER DEFAULT 0,
  avg_rs REAL,
  change_sum REAL,
  volume_sum INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, theme_name, data_source)
);

CREATE INDEX idx_date ON theme_daily(date);
CREATE INDEX idx_theme_name ON theme_daily(theme_name);
CREATE INDEX idx_data_source ON theme_daily(data_source);
```

**data_source 값**:
- `52w_high`: 52주 신고가 달성 종목 기반
- `mtt`: Mark Minervini Template 기술적 패턴 종목

### theme_stock_daily 테이블

```sql
CREATE TABLE theme_stock_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  theme_name TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  data_source TEXT NOT NULL DEFAULT '52w_high',
  rs_score REAL,
  change_pct REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, theme_name, stock_name, data_source)
);

CREATE INDEX idx_date_theme ON theme_stock_daily(date, theme_name);
CREATE INDEX idx_stock_name ON theme_stock_daily(stock_name);
CREATE INDEX idx_data_source ON theme_stock_daily(data_source);
```

**data_source 값**: theme_daily와 동일하게 '52w_high' 또는 'mtt'

---

## 데이터베이스 마이그레이션

### 기존 데이터베이스 업데이트 (MTT 데이터 소스 추가)

다중 데이터 소스 지원을 위한 마이그레이션 스크립트는 `database.py`에 자동 포함됩니다.

**자동 마이그레이션 (기존 DB):**

```python
# database.py 내 auto-migration 로직
# ALTER TABLE theme_daily ADD COLUMN data_source TEXT NOT NULL DEFAULT '52w_high'
# ALTER TABLE theme_stock_daily ADD COLUMN data_source TEXT NOT NULL DEFAULT '52w_high'
# UNIQUE 제약 조건 업데이트: (date, theme_name, data_source)
```

**새로운 프로젝트:**

schema_init 단계에서 `data_source` 컬럼이 포함된 테이블로 생성됩니다.

---

## 배포 고려사항

### 프로덕션 체크리스트

- [ ] 환경 변수 설정 (.env 파일)
- [ ] 데이터베이스 백업 전략 수립
- [ ] HTTPS 인증서 설정
- [ ] 에러 추적(Sentry) 설정
- [ ] 로그 수집 설정
- [ ] 모니터링 및 알림 설정
- [ ] 백업 및 복구 계획 수립
- [ ] 보안 감사 실시

### 추천 배포 환경

- **Vercel**: Next.js 프론트엔드 (무료 티어 가능)
- **AWS**: EC2/ECS + RDS (PostgreSQL)
- **Heroku**: FastAPI 백엔드 (기본 요금)
- **Docker**: 자체 서버에 Docker Compose 배포

---

## 라이선스 및 의존성

전체 의존성 목록은 다음 파일에서 확인 가능:
- 백엔드: `backend/requirements.txt`
- 프론트엔드: `frontend/package.json`

권장: 정기적으로 의존성 업데이트
```bash
# Python
pip install --upgrade -r requirements.txt

# Node
npm outdated
npm update
```
