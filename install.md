# MTT-Trend 설치 및 실행 가이드

`mtt-trend`는 **backend** (FastAPI)와 **frontend** (Next.js)로 구성됩니다.

| 환경 | 용도 | 실행 방식 |
|------|------|-----------|
| 개발 맥북 | 코드 작성·기능 확인 | 터미널에서 직접 실행 (`--reload`, `pnpm dev`) |
| 맥미니 (헤드리스) | 24시간 운영 서버 | pm2로 백그라운드 실행, 재부팅 시 자동 복구 |

---

## 공통 전제 조건

### 필수 도구

| 도구 | 용도 | 설치 |
|------|------|------|
| `uv` | Python 의존성 관리 | `brew install uv` |
| `nvm` | Node.js 버전 관리 | [nvm 설치 스크립트](https://github.com/nvm-sh/nvm) |
| Node.js 24 | frontend 빌드·실행 | `nvm install 24.12.0 && nvm alias default 24.12.0` |
| `pnpm` | frontend 패키지 관리 | `corepack enable && corepack prepare pnpm@latest --activate` |
| `pm2` | 운영 서버 프로세스 관리 (운영만) | `npm install -g pm2` |

### 설치 확인

```bash
uv --version          # Python 패키지 관리
node --version        # v24.x 권장
pnpm --version
pm2 --version         # 운영 서버만
```

### 데이터 파일

백엔드 차트 분석(심층지표 분석 탭)에 필요한 CSV를 아래 경로에 둡니다.
레버리지와 시장 지수 파일 모두 같은 디렉터리에 위치합니다.

```
~/.cache/db/kodex_leverage/
  ├── kodex_leverage.csv      ← KODEX 레버리지 (Leverage Index)
  ├── kosdaq_leverage.csv     ← KOSDAQ 레버리지 (Leverage Index)
  ├── kospi_mtt.csv           ← KOSPI          (Market Index)
  ├── kospi200_mtt.csv        ← KOSPI 200      (Market Index)
  ├── kosdaq_mtt.csv          ← KOSDAQ         (Market Index)
  └── kosdaq150_mtt.csv       ← KOSDAQ 150     (Market Index)
```

다른 경로를 쓰려면 환경 변수 `MTT_LEVERAGE_CSV_DIR`에 절대 경로를 지정합니다.

#### 파일 ↔ 심볼 매핑

프론트엔드 차트 탭에서 칩을 클릭하면 `GET /api/charts/data?symbol=<id>`로 요청하고,
백엔드(`backend/app/utils/chart_utils.py`의 `SYMBOL_MAP`)가 아래처럼 매핑합니다.

| 화면 칩 | `symbol` 값 | 로드되는 파일 |
|---------|-------------|----------------|
| KODEX LEVERAGE | `kodex_leverage` | `kodex_leverage.csv` |
| KOSDAQ LEVERAGE | `kosdaq_leverage` | `kosdaq_leverage.csv` |
| KOSPI | `kospi` | `kospi_mtt.csv` |
| KOSPI 200 | `kospi200` | `kospi200_mtt.csv` |
| KOSDAQ | `kosdaq` | `kosdaq_mtt.csv` |
| KOSDAQ 150 | `kosdaq150` | `kosdaq150_mtt.csv` |

#### CSV 컬럼 구조 (공통)

```
Date, Open, High, Low, Close, Volume, Change,
SMA10_pct, SMA20_pct, SMA50_pct, SMA200_pct, ADR14, ADR20, RSI_14
```

- `Open/High/Low/Close/Volume/Change`: 일별 OHLCV
- `SMA10_pct` ~ `SMA200_pct`: 해당 이동평균선 위에 있는 종목 비율(시장 breadth, %)
- `ADR14/ADR20`: Advance/Decline Ratio
- `RSI_14`: 14일 RSI

> 백엔드는 CSV를 Polars로 읽고 **RSI/MACD/Stochastic/이격도/SMA 등 지표를 실시간으로 재계산**하여 응답에 통합합니다.
> 따라서 CSV에는 위 OHLCV + breadth/ADR 값만 있어도 차트의 모든 지표가 표시됩니다.

#### 데이터 파일이 없을 때

해당 심볼의 CSV가 없으면 `/api/charts/data`가 빈 데이터(`data: []`)를 반환합니다.
이때 차트 탭 상단에 **"DUMMY DATA WARNING"** 배너가 노출되며, 지수/레버리지 칩을 눌러야 실제 데이터가 표시됩니다.

```bash
# 파일 존재 여부 확인
ls -la ~/.cache/db/kodex_leverage/
```

---

## 1. 개발 환경 (개발 맥북)

개발 맥북에서는 **두 터미널**에서 backend / frontend를 각각 띄웁니다.

### 1-1. 최초 1회 설정

```bash
# nvm + Node.js
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 24.12.0
nvm alias default 24.12.0

# pnpm
corepack enable
corepack prepare pnpm@latest --activate

# backend 의존성
cd backend
uv sync   # 또는: uv pip install -r requirements.txt

# frontend 의존성
cd ../frontend
pnpm install
# 빌드 스크립트 승인 경고가 나오면:
pnpm approve-builds --all
```

### 1-2. 백엔드 실행 (터미널 1)

```bash
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 1-3. 프론트엔드 실행 (터미널 2)

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd frontend
pnpm run dev
```

### 1-4. 기능 확인

- 프론트엔드: http://localhost:3000/trend
- 백엔드 API: http://localhost:8000/api/dates?source=52w_high

### 개발 시 자주 쓰는 명령

```bash
# frontend 테스트
cd frontend && pnpm test

# frontend 린트
cd frontend && pnpm lint

# backend 스크립트 (데이터 적재 등)
cd backend && uv run python scripts/ingest.py --help
```

---

## 2. 운영 환경 (맥미니 헤드리스)

맥미니는 **pm2**로 backend·frontend를 상시 실행하고, 정전·재부팅 후에도 자동으로 복구합니다.

### 2-1. 최초 1회 설정 (맥미니에서)

```bash
# 1) 저장소 클론 (이미 있으면 생략)
git clone <repo-url> ~/workspace/git/mtt-trend
cd ~/workspace/git/mtt-trend

# 2) nvm + Node.js + pnpm + pm2
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 24.12.0
nvm alias default 24.12.0
corepack enable
corepack prepare pnpm@latest --activate
npm install -g pm2

# 3) uv 설치
brew install uv

# 4) backend 의존성
cd backend && uv pip install -r requirements.txt && cd ..

# 5) 첫 배포 (빌드 + pm2 등록)
./deploy.sh

# 6) 재부팅 시 자동 시작 등록
./scripts/setup-mac-mini-server.sh
# → 출력되는 sudo 명령을 복사해서 한 번 더 실행

# 7) 절전 방지 (헤드리스 서버 권장)
sudo pmset -a sleep 0 disksleep 0 displaysleep 10
```

### 2-2. 이후 배포 (코드 업데이트 시)

```bash
cd ~/workspace/git/mtt-trend
./deploy.sh
```

`deploy.sh`가 자동으로 처리하는 작업:

1. `git pull` — 최신 코드 수신
2. backend 의존성 업데이트 (`uv pip install`)
3. frontend 빌드 (`pnpm install && pnpm build`)
4. standalone 정적 자산 복사
5. pm2 reload + save

### 2-3. pm2 구조

운영 서버는 아래 파일로 프로세스를 관리합니다.

| 파일 | 역할 |
|------|------|
| `ecosystem.config.cjs` | pm2 앱 정의 |
| `scripts/pm2-mtt-backend.sh` | nvm·uv PATH 로드 후 backend 실행 |
| `scripts/pm2-mtt-frontend.sh` | nvm PATH 로드 후 `node .next/standalone/server.js` 실행 |

> **참고:** frontend는 `pnpm start` 대신 `node`로 직접 실행합니다.
> `package.json`의 `start` 스크립트가 `node .next/standalone/server.js`이므로 **실행 속도 차이는 없습니다.**
> pnpm은 npm 스크립트 래퍼일 뿐이며, 운영 서버 재부팅 시 PATH 의존성을 줄이기 위해 node를 직접 호출합니다.

### 2-4. 운영 서버 관리 명령

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# 상태 확인
pm2 status

# 로그 확인
pm2 logs mtt-backend
pm2 logs mtt-frontend

# 수동 재시작
pm2 restart mtt-backend
pm2 restart mtt-frontend

# 헬스 체크
curl http://localhost:8000/api/dates?source=52w_high
curl -I http://localhost:3000
```

문제가 발생하면 **4. 문제 발생 시 대응** 절을 참고하세요.

### 2-5. 재부팅 후 자동 복구 흐름

```
맥미니 부팅
  → launchd가 pm2 시작        (pm2 startup)
  → 저장된 프로세스 목록 복원  (pm2 save)
  → mtt-backend  (:8000) 실행
  → mtt-frontend (:3000) 실행
```

`pm2 startup`과 `pm2 save`는 **최초 1회** `./scripts/setup-mac-mini-server.sh`로 설정합니다.
이후 `./deploy.sh` 실행 시 `pm2 save`가 자동으로 갱신됩니다.

---

## 3. Ubuntu Linux 배포 (대안)

Ubuntu 서버에서도 동일한 pm2 + ecosystem 방식을 사용할 수 있습니다.
차이점은 `pm2 startup` 명령이 `systemd`용으로 출력된다는 것뿐입니다.

```bash
git pull
cd backend && uv pip install -r requirements.txt && cd ..
./deploy.sh
./scripts/setup-mac-mini-server.sh   # startup 출력의 sudo 명령 실행
```

Nginx 리버스 프록시, 방화벽 설정 등은 [README.md](README.md)의 프로덕션 배포 섹션을 참고하세요.

---

## 4. 문제 발생 시 대응

운영 중 장애가 생기면 아래 순서로 확인합니다.

### 4-1. 공통 진단 순서 (먼저 실행)

```bash
# 1) nvm·pm2 PATH 로드 (새 터미널이면 필수)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# 2) 프로세스 상태
pm2 status

# 3) 최근 로그 (에러 위주)
pm2 logs mtt-backend --lines 50 --err
pm2 logs mtt-frontend --lines 50 --err

# 4) 포트 점유 확인
lsof -i :8000    # backend
lsof -i :3000    # frontend

# 5) API·웹 응답 확인
curl -s "http://localhost:8000/api/dates?source=52w_high" | head -c 200
curl -I http://localhost:3000
```

| `pm2 status` 상태 | 의미 | 다음 조치 |
|-------------------|------|-----------|
| `online` | 정상 실행 중 | 로그·API 응답 추가 확인 |
| `errored` | 시작 직후 반복 실패 | 4-2, 4-3, 4-4 로그 확인 |
| `waiting restart` | 재시작 대기·지연 중 | 로그에서 bash/uv/node PATH 오류 확인 |
| 프로세스 없음 | pm2에 미등록 | `./deploy.sh` 또는 `./scripts/setup-mac-mini-server.sh` |

### 4-2. pm2 / 프로세스 문제

#### `pm2: command not found`

nvm이 로드되지 않은 터미널에서 흔히 발생합니다.

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
npm install -g pm2
```

`~/.zshrc`에 nvm 초기화가 있는지 확인합니다. 없으면 nvm 설치 시 자동 추가되지만, 터미널을 **새로 열거나** 위 `export`를 실행해야 합니다.

#### 재부팅·정전 후 backend/frontend가 안 뜸

**원인:** `pm2 startup` / `pm2 save` 미설정, 또는 sudo startup 명령 미실행.

```bash
cd ~/workspace/git/mtt-trend

# 1) startup + save 재설정
./scripts/setup-mac-mini-server.sh
# → 출력되는 sudo 명령을 반드시 복사해서 실행

# 2) 수동으로 프로세스 재등록
pm2 delete mtt-backend mtt-frontend 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

# 3) 로그 확인
pm2 logs mtt-backend --lines 50
pm2 logs mtt-frontend --lines 50
```

**재부팅 테스트:**

```bash
sudo reboot
# 재부팅 후
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
pm2 status   # 둘 다 online 이어야 함
```

#### `이진 파일을 실행할 수 없음` (bash 관련)

로그에 `/opt/homebrew/bin/bash: 이진 파일을 실행할 수 없음`이 보이면, pm2가 잘못된 bash 경로를 쓰고 있는 것입니다.

```bash
cd ~/workspace/git/mtt-trend
pm2 delete mtt-backend mtt-frontend
pm2 start ecosystem.config.cjs   # ecosystem.config.cjs는 /bin/bash 사용
pm2 save
```

`reload`만으로는 예전 설정이 남을 수 있으므로, **delete 후 start**가 확실합니다.

#### pm2는 online인데 접속이 안 됨

```bash
# 프로세스는 살아 있지만 포트가 다른 프로세스에 점유된 경우
lsof -i :8000
lsof -i :3000

# pm2 재시작
pm2 restart mtt-backend
pm2 restart mtt-frontend
```

맥미니가 **절전 모드**에 들어갔을 수도 있습니다.

```bash
pmset -g          # 현재 전원 설정 확인
sudo pmset -a sleep 0 disksleep 0 displaysleep 10
```

#### pm2 로그 파일 위치

| 앱 | stdout | stderr |
|----|--------|--------|
| mtt-backend | `~/.pm2/logs/mtt-backend-out.log` | `~/.pm2/logs/mtt-backend-error.log` |
| mtt-frontend | `~/.pm2/logs/mtt-frontend-out.log` | `~/.pm2/logs/mtt-frontend-error.log` |

```bash
tail -f ~/.pm2/logs/mtt-backend-error.log
tail -f ~/.pm2/logs/mtt-frontend-error.log
```

---

### 4-3. backend 문제

#### `uv: command not found`

```bash
brew install uv
which uv   # /opt/homebrew/bin/uv 확인
```

pm2 시작 스크립트(`scripts/pm2-mtt-backend.sh`)가 `/opt/homebrew/bin`을 PATH에 넣지만, uv 자체가 없으면 실패합니다.

#### backend API가 500 / 차트 데이터 없음

**1) 차트 데이터 CSV 확인 (레버리지 + 시장 지수)**

```bash
ls -la ~/.cache/db/kodex_leverage/
# 레버리지: kodex_leverage.csv, kosdaq_leverage.csv
# 시장 지수: kospi_mtt.csv, kospi200_mtt.csv, kosdaq_mtt.csv, kosdaq150_mtt.csv
```

> 시장 지수(`*_mtt.csv`)는 외부 데이터 파이프라인이 생성하여 같은 디렉터리에 배치합니다.
> 특정 심볼만 빈 데이터가 나온다면 해당 CSV가 누락된 것입니다.

다른 경로를 쓰는 경우:

```bash
export MTT_LEVERAGE_CSV_DIR=/절대/경로/폴더
# ecosystem.config.cjs의 mtt-backend env에 추가하거나
# pm2 restart mtt-backend
```

**2) backend 직접 실행으로 오류 재현**

```bash
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
# 터미널에 traceback이 출력되면 원인 파악
```

**3) API 단건 테스트**

```bash
curl "http://localhost:8000/api/dates?source=52w_high"
curl "http://localhost:8000/api/charts/data?symbol=KODEX_LEVERAGE"
curl "http://localhost:8000/api/charts/data?symbol=kospi"          # 시장 지수 (KOSPI)
curl "http://localhost:8000/api/charts/data?symbol=kosdaq150"      # 시장 지수 (KOSDAQ 150)
```

#### 포트 8000 이미 사용 중 (`Address already in use`)

```bash
lsof -i :8000
# PID 확인 후
kill <PID>
# 또는 pm2로 관리 중이면
pm2 restart mtt-backend
```

#### backend/data HTML 파일 미반영

파일 감시(watcher)가 `backend/data/`를 모니터링합니다.

```bash
ls backend/data/
pm2 logs mtt-backend --lines 30   # Ingested / Sync 로그 확인
```

수동 적재:

```bash
cd backend
uv run python scripts/ingest.py --help
```

---

### 4-4. frontend 문제

#### `pnpm: command not found`

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
```

#### `pnpm build` 실패

```bash
cd frontend
rm -rf .next node_modules/.cache
pnpm install
pnpm approve-builds --all
pnpm rebuild esbuild sharp unrs-resolver
pnpm build
```

**Node 버전 불일치:** Node 24 권장. pnpm 최신 버전은 Node 22.13+ 필요.

```bash
node --version    # v24.x 확인
nvm use 24.12.0
```

#### pnpm 빌드 스크립트 경고 (`Ignored build scripts`)

`esbuild`, `sharp` 빌드가 막히면 Next.js 빌드·이미지 처리가 실패할 수 있습니다.

```bash
cd frontend
pnpm approve-builds --all
pnpm rebuild esbuild sharp unrs-resolver
```

#### 페이지는 뜨는데 CSS/JS 404 (정적 파일 누락)

standalone 모드는 `.next/static`을 자동 복사하지 않습니다.

```bash
cd frontend
mkdir -p .next/standalone/.next/static
cp -r .next/static/* .next/standalone/.next/static/
[ -d public ] && cp -r public .next/standalone/
pm2 restart mtt-frontend
```

`./deploy.sh`가 이 단계를 자동 처리합니다. 수동 빌드 후에는 위 명령이 필요합니다.

#### frontend는 뜨는데 API 호출 실패 (네트워크 탭 502/ECONNREFUSED)

frontend는 `next.config.ts`의 rewrite로 `/api/*`를 backend로 전달합니다.

```bash
# backend가 먼저 살아 있어야 함
curl "http://localhost:8000/api/dates?source=52w_high"

# 빌드 시점 API URL (기본: http://localhost:8000)
cat frontend/.env.production 2>/dev/null || echo "기본값 localhost:8000 사용"
```

운영 서버에서 backend가 다른 호스트/포트면 **빌드 전** 환경 변수 설정:

```bash
# frontend/.env.production 예시
NEXT_PUBLIC_API_URL=http://localhost:8000
```

변경 후 **반드시 재빌드**:

```bash
cd frontend && pnpm build && cd ..
pm2 restart mtt-frontend
```

#### `Cannot find module '.next/standalone/server.js'`

빌드가 안 됐거나 `.next`가 삭제된 상태에서 pm2가 시작된 경우입니다.

```bash
cd ~/workspace/git/mtt-trend
./deploy.sh   # 빌드 + pm2 reload 일괄 처리
```

#### 포트 3000 이미 사용 중

```bash
lsof -i :3000
pm2 restart mtt-frontend
```

---

### 4-5. deploy.sh 실패

#### `git pull` 충돌

```bash
git status
# 로컬 변경이 있으면 stash 또는 commit 후 pull
git stash
git pull
./deploy.sh
```

#### deploy 중 pm2 단계 실패

deploy.sh 앞부분(빌드)은 성공했는데 pm2만 실패한 경우:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd ~/workspace/git/mtt-trend
chmod +x scripts/pm2-mtt-backend.sh scripts/pm2-mtt-frontend.sh
pm2 delete mtt-backend mtt-frontend 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

#### deploy 전체 재시도 (클린 빌드)

```bash
cd ~/workspace/git/mtt-trend
cd frontend
rm -rf .next node_modules/.cache
cd ..
./deploy.sh
```

---

### 4-6. 맥미니 헤드리스 특이 이슈

| 증상 | 원인 | 해결 |
|------|------|------|
| 재부팅 후 서비스 전부 중단 | `pm2 startup` sudo 미실행 | `./scripts/setup-mac-mini-server.sh` 후 sudo 명령 실행 |
| 밤중에 접속 불가 | 맥미니 절전 | `sudo pmset -a sleep 0 disksleep 0 displaysleep 10` |
| SSH는 되는데 웹만 안 됨 | pm2 프로세스만 죽음 | `pm2 status` → `pm2 restart all` |
| frontend만 online | backend PATH/uv 오류 | `pm2 logs mtt-backend --err --lines 50` |
| backend만 online | frontend 빌드 누락 | `./deploy.sh`로 재빌드 |

**원격에서 빠른 복구:**

```bash
ssh <맥미니>
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
pm2 status
pm2 restart all
# 안 되면
cd ~/workspace/git/mtt-trend && ./deploy.sh
```

---

### 4-7. 개발 환경 전용 문제

#### `pnpm run dev`는 되는데 운영 빌드만 실패

개발(`next dev`)과 운영(`next build` + standalone)은 다른 경로입니다. 운영 문제는 반드시 `pnpm build`로 재현하세요.

#### backend `--reload` 시 간헐적 오류

운영 서버(pm2)에서는 `--reload`를 쓰지 않습니다. 개발 중 watcher 관련 오류는 서버 재시작으로 해결되는 경우가 많습니다.

```bash
# 개발 터미널에서 Ctrl+C 후 재실행
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### 4-8. 그래도 해결 안 될 때

아래 정보를 모아두면 원인 파악이 빨라집니다.

```bash
node --version
pnpm --version
uv --version
pm2 --version
pm2 status
uname -a

pm2 logs mtt-backend --lines 100 --nostream
pm2 logs mtt-frontend --lines 100 --nostream

curl -v "http://localhost:8000/api/dates?source=52w_high"
curl -v -I http://localhost:3000
```

완전 초기화가 필요하면:

```bash
cd ~/workspace/git/mtt-trend
pm2 delete mtt-backend mtt-frontend 2>/dev/null || true
./deploy.sh
./scripts/setup-mac-mini-server.sh
pm2 save
```

