# 테마 트렌드 대시보드

한국 주식의 신고가 달성 종목과 MTT 템플릿 종목들을 테마별로 분석하여 장 추세를 발견하는 실시간 트렌드 대시보드

## 주요 기능

- **테마별 일일 RS(상대강도) 집계**: 특정 날짜의 테마별 RS 점수를 내림차순으로 조회
- **신규 급등 테마 탐지**: 기준보다 N 포인트 이상 상승한 테마 자동 탐지
- **테마 RS 시계열 추이 분석**: 최대 1년간 특정 테마의 일일 RS 변화 시각화
- **지속 강세 종목 탐지**: N일 중 M회 이상 신고가 리스트에 등장한 종목 추출
- **그룹 액션 탐지**: 신규 등장 테마 + RS 상승 추세를 동시에 만족하는 경우 식별
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
- Git

### 백엔드 설정

```bash
cd backend

# Python 가상환경 생성
python3 -m venv .venv

# 가상환경 활성화 (macOS/Linux)
source .venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 서버 시작 (http://localhost:8000)
uvicorn app.main:app --reload --port 8000
```

### 프론트엔드 설정

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 시작 (http://localhost:3000)
npm run dev
```

### Docker로 실행 (선택)

```bash
# 프로젝트 루트에서
docker-compose up -d

# 서비스 확인
docker-compose ps
```

## 프로젝트 문서

자세한 프로젝트 문서는 [`.moai/project/`](.moai/project/) 디렉토리를 참조하세요:

- [`product.md`](.moai/project/product.md) - 제품 정의 및 기능 상세
- [`structure.md`](.moai/project/structure.md) - 프로젝트 구조
- [`tech.md`](.moai/project/tech.md) - 기술 스택 및 개발 환경

## SPEC 문서

- [SPEC-MTT-001: MTT 데이터 소스 지원](.moai/specs/SPEC-MTT-001/spec.md)

## API 문서

서버 실행 후 다음 URL에서 API 문서를 확인할 수 있습니다:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 라이선스

MIT License

---

**MoAI-ADK** 기반 프로젝트 | [MoAI 문서](.moai/docs/)
