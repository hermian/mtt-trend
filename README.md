# 테마 트렌드 대시보드

한국 주식의 신고가 달성 종목과 MTT 템플릿 종목들을 테마별로 분석하여 장 추세를 발견하는 실시간 트렌드 대시보드

## 주요 기능

- **테마별 일일 RS(상대강도) 집계**: 특정 날짜의 테마별 RS 점수를 내림차순으로 조회
- **신규 급등 테마 탐지**: 기준보다 N 포인트 이상 상승한 테마 자동 탐지
- **테마 RS 시계열 추이 분석**: 최대 1년간 특정 테마의 일일 RS 변화 시각화
- **지속 강세 종목 탐지**: N일 중 M회 이상 신고가 리스트에 등장한 종목 추출
- **그룹 액션 탐지** (SPEC-MTT-006, SPEC-MTT-007): 신규 등장 테마 + RS 상승 추세를 동시에 만족하는 경우 식별
  - **파라미터 조절**: 시간 윈도우(1-7일), RS 임계값(-10~20), 상태 임계값(1-20) 동적 조절
  - **UI 슬라이더**: 실시간 파라미터 조절로 탐지 조건 유연하게 변경
  - **툴팁 기능** (SPEC-MTT-007): 각 파라미터의 역할과 사용법을 설명하는 접근성 툴팁 제공
  - **성능 최적화**: 인덱스 추가로 쿼리 응답 시간 80% 개선 (500ms → 100ms)
- **교집합 추천** (SPEC-MTT-012): 52주 신고가와 MTT 두 데이터 소스에서 동시에 출현하는 테마/종목 분석
  - **높은 신뢰도**: 두 독립적인 분석 방법론의 교차 검증으로 정확도 향상
  - **자동 날짜 선택**: 양쪽 소스 모두 데이터가 있는 최신 날짜 자동 탐색
  - **테마/종목 교집합**: Level 1(테마) + Level 2(종목) 2단계 분석
- **다중 데이터 소스 지원**: 52주 신고가 데이터와 MTT 템플릿 데이터 전환 기능

## 기술 스택

### 백엔드
- Python 3.11+ / FastAPI 0.109+
- SQLAlchemy 2.0+ (ORM)
- SQLite (데이터베이스)

### 프론트엔드
- Next.js 14+ / React 18+
- TypeScript 5.3+
- Tailwind CSS 3.4+
- TanStack Query 5+ (상태 관리)
- Recharts 2+ (차트)

## 빠른 시작

### 사전 요구사항

- Python 3.11 이상
- Node.js 18.0 이상
- uv (Python 패키지 매니저)
- Git

**uv 설치:**
```bash
# macOS/Linux (curl)
curl -LsSf https://astral.sh/uv/install.sh | sh

# macOS (Homebrew)
brew install uv

# 또는 pip
pip install uv
```

### 백엔드 설정

```bash
cd backend

# uv 설치 (이미 설치되어 있다면 생략)
# curl -LsSf https://astral.sh/uv/install.sh | sh
# 또는 brew install uv

# 가상환경 생성 및 패키지 설치
uv venv
uv pip install -r requirements.txt

# 데이터 수집 (선택)
# 단일 파일 처리
python scripts/ingest.py ../data/★52Week_High_Stocks_By_Theme_With_RS_Scores_YYYY-MM-DD.html

# 디렉토리 내 모든 파일 처리
python scripts/ingest.py ../data/

# 서버 시작 (http://localhost:8000)
uv run uvicorn app.main:app --reload --port 8000

# 테스트 실행
./test-run.sh           # 기본 실행
./test-run.sh -v        # 상세 출력
./test-run.sh --cov     # 커버리지 포함
```

### 프론트엔드 설정

```bash
cd frontend

# Node.js 환경 설정
source ~/.nvm/nvm.sh
corepack enable

# 의존성 설치
pnpm install

# 개발 서버 시작 (http://localhost:3000)
pnpm dev

# 테스트 실행
./test-run.sh           # 스크립트 사용 (권장)
# 또는
pnpm test              # 직접 실행
```

**그룹 액션 탐지 UI 사용 방법:**

1. http://localhost:3000/trend 접속
2. '그룹 액션 탐지' 섹션 확인
3. 슬라이더로 파라미터 조절:
   - **시간 윈도우**: 1~7일 (신규 등장 판정 기간)
   - **RS 임계값**: -10~+20 (테마 RS 상승 판정 기준)
   - **상태 임계값**: 1~20 (상태 분류 기준)
4. 툴팁 아이콘 hover 시 파라미터 상세 설명 확인
5. 시간 윈도우/RS 임계값 변경 시 API 재호출
6. 상태 임계값 변경 시 테이블 즉시 갱신 (클라이언트 계산)
```

### 테스트 실행

프론트엔드 테스트는 Vitest로 실행합니다:

```bash
cd frontend

# 방법 1: 스크립트 사용 (권장)
./test-run.sh                    # 모든 테스트 (watch 모드)
./test-run.sh --run              # 모든 테스트 (한 번만 실행)
./test-run.sh api.test           # api.test.tsx만 테스트
./test-run.sh GroupAction       # GroupAction가 포함된 테스트만

# 방법 2: 직접 실행
source ~/.nvm/nvm.sh
corepack enable
pnpm test                      # watch 모드
pnpm test --run                # 한 번만 실행
pnpm test api.test            # 특정 테스트 파일만 실행
pnpm test --ui                 # UI 모드
pnpm test --coverage           # 커버리지 포함
```

**테스트 환경 요구사항:**
- Node.js 24.12.0 (nvm 통해 설치)
- pnpm (corepack 통해 자동 활성화)

### 백엔드 테스트

백엔드 테스트는 pytest로 실행합니다:

```bash
cd backend

# 방법 1: 스크립트 사용 (권장)
./test-run.sh           # 기본 실행
./test-run.sh -v        # 상세 출력
./test-run.sh --cov     # 커버리지 포함

# 방법 2: 직접 실행
uv run pytest tests/ -v
```

**테스트 환경 요구사항:**
- Python 3.11+
- uv 패키지 매니저
- 가상환경 (`.venv`)

## 데이터 수집

HTML 파일로부터 테마 데이터를 수집하고 데이터베이스에 저장합니다.

### 1. 단일 파일 처리

```bash
cd backend
python scripts/ingest.py ../data/★52Week_High_Stocks_By_Theme_With_RS_Scores_2024-01-15.html
```

### 2. 배치 처리 (추천)

```bash
# backend/data/ 디렉토리 내 모든 HTML 파일 처리
cd backend
python scripts/ingest.py ../data/

# MTT 데이터만 처리
python scripts/ingest.py ../data/ --source mtt
```

### 3. 데이터 수집 가이드

자세한 데이터 수집 방법은 [DATA-INGESTION.md](DATA-INGESTION.md)를 참조하세요.

## 데이터 확인

수집된 데이터는 API를 통해 확인할 수 있습니다:

- **API 문서**: [API-DOCUMENTATION.md](API-DOCUMENTATION.md)
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 그룹 액션 탐지 API (SPEC-MTT-006)

그룹 액션 탐지는 신규 등장 종목과 테마 RS 상승을 결합하여 유망한 투자 기회를 탐지합니다.

```bash
# 기본 조회 (시간 윈도우 3일, RS 임계값 0)
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15"

# 시간 윈도우 조절 (1~7일)
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&timeWindow=5"

# RS 임계값 조절 (-10~20)
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&rsThreshold=5"

# 파라미터 조합
curl "http://localhost:8000/api/stocks/group-action?date=2024-01-15&timeWindow=7&rsThreshold=10"
```

**파라미터 설명:**
- `timeWindow`: 신규 등장 판정 기간 (1-7일, 기본값 3)
- `rsThreshold`: 테마 RS 상승 판정 기준 (-10~20, 기본값 0)
- `statusThreshold`: 상태 분류 기준 (응답 필드, 1-20, 기본값 5)

**상태 분류:**
- `new_theme`: 신규 테마 (어제 데이터 없음)
- `new`: 강한 상승 (RS 변화 > 임계값)
- `returning`: 강한 하락 (RS 변화 < -임계값)
- `neutral`: 유지 (그 외)

### 교집합 추천 API (SPEC-MTT-012)

교집합 추천은 52주 신고가와 MTT 두 소스에서 동시에 출현하는 테마/종목을 분석합니다.

```bash
# 특정 날짜의 교집합 조회
curl "http://localhost:8000/api/stocks/intersection?date=2024-01-15"

# 최신 날짜 자동 선택 (date 파라미터 생략)
curl "http://localhost:8000/api/stocks/intersection"
```

**응답 예시:**
```json
{
  "date": "2024-01-15",
  "theme_count": 2,
  "total_stock_count": 5,
  "themes": [
    {
      "theme_name": "AI",
      "intersection_stock_count": 3,
      "avg_rs_52w": 87.5,
      "avg_rs_mtt": 85.0,
      "stock_count_52w": 5,
      "stock_count_mtt": 4,
      "intersection_stocks": [
        {
          "stock_name": "삼성전자",
          "rs_score_52w": 90,
          "rs_score_mtt": 88,
          "change_pct_52w": 2.5,
          "change_pct_mtt": 2.3
        }
      ]
    }
  ]
}
```

### 일반 API 예시

```bash
# 처리된 날짜 목록 확인
curl "http://localhost:8000/api/dates?source=52w_high"

# 특정 날짜의 테마 데이터 확인
curl "http://localhost:8000/api/themes/daily?date=2024-01-15&source=52w_high"
```

### Docker로 실행 (선택)

```bash
# 프로젝트 루트에서
docker-compose up -d

# 서비스 확인
docker-compose ps
```

## API 문서

서버 실행 후 다음 URL에서 API 문서를 확인할 수 있습니다:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **API 문서**: [API-DOCUMENTATION.md](API-DOCUMENTATION.md) - 완전한 API 참조 및 사용법

## 프로젝트 문서

자세한 프로젝트 문서는 [`.moai/project/`](.moai/project/) 디렉토리를 참조하세요:

- [`product.md`](.moai/project/product.md) - 제품 정의 및 기능 상세
- [`structure.md`](.moai/project/structure.md) - 프로젝트 구조
- [`tech.md`](.moai/project/tech.md) - 기술 스택 및 개발 환경

## SPEC 문서

- [SPEC-MTT-001: MTT 데이터 소스 지원](.moai/specs/SPEC-MTT-001/spec.md)
- [SPEC-MTT-002: 데이터 파이프라인 완성 및 트렌드 대시보드 MVP](.moai/specs/SPEC-MTT-002/spec.md)
- [SPEC-MTT-003: 신규 급등 테마 탐지 UI 컴포넌트](.moai/specs/SPEC-MTT-003/spec.md)
- [SPEC-MTT-004: 테마 RS 대시보드 레이아웃 개선](.moai/specs/SPEC-MTT-004/spec.md)
- [SPEC-MTT-005: 테마 RS 추이 차트 인터랙티브 개선](.moai/specs/SPEC-MTT-005/spec.md)
- [SPEC-MTT-006: 그룹 액션 탐지 기능 고도화](.moai/specs/SPEC-MTT-006/spec.md) - 파라미터화, UI 슬라이더, 성능 최적화
- [SPEC-MTT-007: 그룹 액션 탐지 파라미터 툴팁 추가](.moai/specs/SPEC-MTT-007/spec.md) - 접근성 툴팁, 사용성 개선
- [SPEC-MTT-008: 테마 RS 추이 슬라이딩 윈도우 기간 설정](.moai/specs/SPEC-MTT-008/spec.md)
- [SPEC-MTT-009: HTML 자동 감지 및 DB 동기화 시스템](.moai/specs/SPEC-MTT-009/spec.md)
- [SPEC-MTT-010: 서버 시작 시 자동 동기화](.moai/specs/SPEC-MTT-010/spec.md) - 자동 데이터 적재, 중복 방지, 에러 격리
- [SPEC-MTT-011: 테스트 DB 분리](.moai/specs/SPEC-MTT-011/spec.md)
- [SPEC-MTT-012: 52주 신고가 × MTT 교집합 추천](.moai/specs/SPEC-MTT-012/spec.md) - 두 데이터 소스 교차 분석, 높은 신뢰도 추천

## 라이선스

MIT License

---

**MoAI-ADK** 기반 프로젝트 | [MoAI 문서](.moai/docs/)
