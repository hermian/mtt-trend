# MTT-Trend 프로젝트 설치 및 실행 가이드

이 문서는 MTT-Trend 프로젝트를 로컬 개발 환경(macOS)에서 실행하고, Ubuntu Linux 프로덕션 환경에 배포하는 절차를 안내합니다.

## 1. 개발 머신 (macOS)에서 실행 및 확인 절차

`mtt-trend` 프로젝트는 `backend` (FastAPI)와 `frontend` (Next.js)로 구성됩니다.

**전제 조건:**
- `uv` (Python 의존성 관리 도구) 설치 완료.
- `pnpm` (Node.js 패키지 관리자) 설치 완료.

### Step 1: 백엔드 서버 실행 (FastAPI)

1.  **데이터 확인**: `backend/data/charts/` 디렉토리에 `kodex_leverage.csv` 및 `kosdaq_leverage.csv` 파일이 있는지 확인합니다.
2.  **의존성 설치**:
    ```bash
    cd backend
    uv sync # 또는 uv pip install -r requirements.txt
    ```
3.  **서버 시작**:
    ```bash
    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```

### Step 2: 프론트엔드 개발 서버 실행 (Next.js)

1.  **의존성 설치**:
    ```bash
    cd frontend
    pnpm install
    ```
2.  **개발 서버 시작**:
    ```bash
    pnpm run dev
    ```

### Step 3: 기능 확인
- `http://localhost:3000/trend` 접속 후 '차트 분석' 탭 확인.
- **실제 데이터**: 이제 더미 데이터가 아닌 실제 KODEX/KOSDAQ 레버리지 데이터와 Polars 엔진으로 계산된 정밀 지표(Stochastic, MACD 등)가 표시됩니다.

## 2. Ubuntu Linux 프로덕션 환경 배포 절차

### Step 1: 코드 수신 및 빌드
```bash
# 최신 코드 수신
git pull origin main

# 백엔드 의존성 최신화
cd backend
uv pip install -r requirements.txt

# 프론트엔드 빌드 (필수)
cd ../frontend
pnpm install
pnpm run build
```

### Step 2: 서비스 실행 (Background)

**백엔드 (Gunicorn + Uvicorn)**:
```bash
cd ../backend
# 4개의 워커로 안정적인 서빙
nohup uv run gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000 > backend.log 2>&1 &
```

**프론트엔드 (Next.js)**:
```bash
cd ../frontend
nohup pnpm run start --port 3000 > frontend.log 2>&1 &
```

### Step 3: 인프라 설정 (권장)
- **Nginx 리버스 프록시**: 외부 80/443 포트 요청을 내부 3000(프론트) 및 8000(백엔드)으로 분기하도록 설정합니다.
- **방화벽**: `sudo ufw allow 3000,8000/tcp` 명령으로 포트를 개방합니다.

**주의**: 실제 배포 시 프론트엔드의 환경 변수(`.env.production`)에 백엔드 API 서버의 실제 IP 또는 도메인이 설정되어 있는지 확인하십시오.
