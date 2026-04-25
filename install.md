# MTT-Trend 프로젝트 설치 및 실행 가이드

이 문서는 MTT-Trend 프로젝트를 로컬 개발 환경(macOS)에서 실행하고, Ubuntu Linux 프로덕션 환경에 배포하는 절차를 안내합니다.

## 1. 개발 머신 (macOS)에서 실행 및 확인 절차

`mtt-trend` 프로젝트는 `backend` (FastAPI)와 `frontend` (Next.js)로 구성됩니다. 다음 절차를 따라 각 부분을 실행하고 연동하여 "인터랙티브 차트 시스템" 기능을 포함한 전체 애플리케이션을 확인합니다.

**전제 조건:**
- `uv` (Python 의존성 관리 및 실행 도구) 설치 완료 (Python 3.11+ 필요).
- `npm` (Node.js 패키지 관리자) 설치 완료 (Node.js 18+ 권장).

### Step 1: 백엔드 서버 실행 (FastAPI)

1.  **터미널 열기:** 새로운 터미널을 엽니다.
2.  **백엔드 디렉토리로 이동:**
    ```bash
    cd /Users/hosung/workspace/git/mtt-trend/backend
    ```
3.  **uv 가상 환경 생성 및 의존성 설치 (최초 1회 또는 의존성 변경 시):**
    ```bash
    uv venv
    uv pip install -r requirements.txt
    ```
4.  **백엔드 서버 시작:**
    ```bash
    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```
    - `INFO: Application startup complete.` 메시지가 표시되면 서버가 성공적으로 시작된 것입니다.
    - `--reload` 옵션 덕분에 백엔드 코드 변경 시 자동으로 서버가 재시작됩니다.

### Step 2: 프론트엔드 개발 서버 실행 (Next.js)

1.  **새 터미널 열기:** 또 다른 새 터미널을 엽니다.
2.  **프론트엔드 디렉토리로 이동:**
    ```bash
    cd /Users/hosung/workspace/git/mtt-trend/frontend
    ```
3.  **의존성 설치 (최초 1회 또는 의존성 변경 시):**
    ```bash
    pnpm install
    ```
4.  **프론트엔드 개발 서버 시작:**
    ```bash
    pnpm run dev
    ```
    - `ready - started server on 0.0.0.0:3000, url: http://localhost:3000` 메시지가 표시되면 서버가 성공적으로 시작된 것입니다.

### Step 3: 웹 브라우저에서 기능 확인

1.  **브라우저 열기:** 웹 브라우저를 열고 다음 주소로 이동합니다.
    ```
    http://localhost:3000/trend
    ```
2.  **인터랙티브 차트 확인:**
    - 대시보드 페이지 하단으로 스크롤하면 "심층 지표 분석 (Beta)" 섹션에 새로 구현된 차트가 보일 것입니다.
    - 차트 위에서 마우스를 움직이면 모든 하단 차트의 크로스헤어(세로선/가로선)가 동기화되어 움직이는 것을 확인할 수 있습니다.
    - "주가 (OHLC)", "RSI (14)", "MACD" 등의 지표 차트들이 표시될 것입니다.
    - **(참고):** 백엔드에서 현재는 더미 데이터를 제공하므로 실제 데이터가 아닌 랜덤 생성된 데이터가 표시됩니다.

## 2. Ubuntu Linux 프로덕션 환경 배포 절차

프로덕션 환경을 위한 배포는 개발 환경과 달리 `reload` 옵션 없이 안정적인 실행과 관리를 목표로 합니다. 여기서는 `uvicorn` 및 `pnpm run start`를 직접 사용하는 방법을 기준으로 안내해 드립니다.

**전제 조건:**
- Git이 설치되어 있고, `git pull`이 가능한 상태.
- Python 3.11+ 및 `uv` 설치 완료.
- Node.js 및 `npm` 설치 완료.
- (선택 사항) `gunicorn` 설치 (Python 백엔드용 WSGI 서버).
- (선택 사항) `nginx`와 같은 웹 서버가 프록시로 설정될 경우.

**단계별 배포:**

### Step 1: 프로젝트 업데이트 및 의존성 설치

1.  **프로젝트 디렉토리로 이동:**
    ```bash
    cd /path/to/your/mtt-trend # 실제 프로젝트 경로로 변경
    ```
2.  **최신 코드 가져오기:**
    ```bash
    git pull origin main # 또는 적절한 배포 브랜치명 사용
    ```
3.  **백엔드 의존성 설치:**
    ```bash
    cd backend
    uv venv # 가상 환경이 없으면 생성
    uv pip install -r requirements.txt
    cd ..
    ```
4.  **프론트엔드 의존성 설치 및 빌드:**
    ```bash
    cd frontend
    pnpm install
    pnpm run build
    cd ..
    ```
    - `pnpm run build`는 Next.js 애플리케이션을 프로덕션 배포용으로 최적화된 정적 파일 및 서버 번들로 빌드합니다.

### Step 2: 백엔드 서버 실행 (FastAPI)

프로덕션 환경에서는 `uvicorn`을 `reload` 없이 안정적으로 실행하며, `gunicorn`과 같은 WSGI 서버와 함께 사용하는 것이 일반적입니다.

1.  **백엔드 가상 환경 활성화:**
    ```bash
    cd backend
    source .venv/bin/activate # 또는 uv shell
    ```
2.  **uvicorn 서버 시작 (추천: gunicorn과 함께):**
    ```bash
    # (선택 사항: gunicorn 설치 - 필요시)
    # pip install gunicorn
    
    # gunicorn + uvicorn worker 조합으로 실행 (더 안정적이고 성능이 좋음)
    # `-w`는 워커 수, `-k`는 워커 클래스를 지정합니다.
    nohup gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000 > backend_output.log 2>&1 &
    
    # 또는 간단히 uvicorn만 실행 (nohup을 사용하여 백그라운드에서 실행)
    # nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend_output.log 2>&1 &
    ```
    - `nohup` 명령어는 터미널 세션이 종료되어도 프로세스가 계속 실행되도록 합니다.
    - `> backend_output.log 2>&1`는 모든 출력을 `backend_output.log` 파일로 리다이렉션합니다.
    - `&`는 명령어를 백그라운드에서 실행합니다.

### Step 3: 프론트엔드 서버 실행 (Next.js)

`pnpm run build`로 빌드된 Next.js 애플리케이션은 Node.js 서버를 통해 서빙됩니다.

1.  **프론트엔드 디렉토리로 이동:**
    ```bash
    cd frontend
    ```
2.  **프론트엔드 서버 시작:**
    ```bash
    nohup pnpm run start > frontend_output.log 2>&1 &
    ```
    - 이 명령은 Next.js가 빌드한 프로덕션 서버를 시작합니다.
    - `nohup` 및 `&`를 사용하여 백그라운드에서 실행합니다.

### Step 4: 방화벽 및 접근 설정 (필요시)

-   **Ubuntu 방화벽 (ufw) 설정:**
    ```bash
    sudo ufw allow 8000/tcp # 백엔드 포트
    sudo ufw allow 3000/tcp # 프론트엔드 포트 (또는 웹 서버 포트)
    sudo ufw enable
    ```
-   **Nginx/Apache 프록시 설정 (선택 사항):**
    - 프로덕션 환경에서는 Nginx나 Apache를 프론트엔드/백엔드 서버 앞에 두고 리버스 프록시로 구성하여 SSL 암호화, 로드 밸런싱, 정적 파일 서빙 등을 처리하는 것이 일반적입니다.
    - 이 경우 Nginx는 외부 요청을 `localhost:3000` (프론트엔드) 및 `localhost:8000` (백엔드)으로 전달하도록 설정해야 합니다.

**최종 확인:**
- 배포된 서버의 IP 주소 또는 도메인으로 웹 브라우저에 접속하여 "인터랙티브 차트 시스템"이 정상적으로 동작하는지 확인합니다. (예: `http://your_server_ip:3000/trend`)
