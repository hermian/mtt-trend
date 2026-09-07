# Agent Guidelines & Project Rules

## Chart Development Rules (lightweight-charts)

### 1. 차트 내부(Pane) 텍스트 오버레이 금지 (`createPriceLine`의 `title` 금지)
- `lightweight-charts`에서 `createPriceLine({ title: "..." })`의 `title` 속성은 Y축 눈금자가 아니라 **차트 캔버스 좌측 내부(Pane Left)**에 텍스트를 직접 렌더링합니다.
- 여러 지표를 표시할 때 `title`을 설정하면 차트 좌측 캔버스 영역에 글자들이 겹쳐서 차트 내용(캔들/라인/봉)을 가리는 심각한 UI 문제가 발생합니다.
- **규칙**:
  - `createPriceLine` 및 `applyOptions` 호출 시 **`title: ""` (빈 문자열) 또는 `title` 속성을 생략**할 것.
  - 차트 캔버스 가로선을 숨기려면 `lineVisible: false`를 설정할 것.

### 2. Y축 눈금자(Price Scale) 라벨 표시 원칙
- 마우스 호버(Crosshair Move) 시 지표 수치를 표시할 때는 **오른쪽 Y축(Right Price Scale) 눈금자 배지**로만 표시합니다.
  - `axisLabelVisible: true`
  - `color: <지표 고유 색상>`
  - `lineVisible: false`
- 불필요한 좌측 Y축(`leftPriceScale: { visible: false }`)을 활성화하여 패널 간 X축 정렬이 어긋나거나 좌측 여백을 낭비하지 않도록 합니다.

### 3. 지표 명칭 및 상세 수치 표기 위치
- 각 지표의 명칭(예: `EMA10`, `VWAP`, `HP추세`, `거래대금` 등) 및 상세 수치는 **차트 상단 HUD 헤더 바 또는 툴팁/범례**에 텍스트로 표시합니다.

---

## Environment & Tooling Rules

### 1. Python & Test Environment
- **가상환경 경로**: Backend 실행 및 테스트 시 `backend/.venv/bin/python`, `backend/.venv/bin/pytest`를 직접 사용합니다.
- **프론트엔드 패키지 매니저**: `pnpm`을 사용합니다 (`pnpm install`, `pnpm build`).

### 2. Deployment Protocol
- 모든 기능 개발, 버그 수정 및 로컬 검증이 완료되면 **반드시 프로젝트 루트의 `./deploy.sh`를 실행**하여 빌드 및 PM2 프로세스(`mtt-backend`, `mtt-frontend`)를 갱신합니다.

### 3. Macro Data Pipeline (`screener` 연동)
- **읽기 전용 백엔드**: `mtt-trend` 백엔드는 매크로 DB(`~/.cache/db/macro.db`)에 대해 **Read-Only(조회 전용)**로 동작합니다.
- **수집 및 적재 전담**: 실제 데이터 수집기 및 스케줄러는 `~/workspace/git/screener/mmt/macro_collector/`에서 관리되며, 평일 18:27 KST 크론(`run_macro_refresh.sh`)으로 자동 갱신됩니다.
- **희소 시계열 ffill 원칙**: 분기(GDP, I/GDP 등), 월간(M2, ISM), 주간(수출), 기준금리 등 발표 주기가 희소한 지표는 `charts.py`의 `ffill_series`에 등록하여 일별 거래일 축에 맞춰 직전값을 유지(`ffill`)하도록 처리해야 합니다.

### 4. Git & Issue Conventions
- **커밋 및 푸시 분리 원칙 (절대 동시 수행 금지 & 독단적 판단 금지)**:
  - **커밋(`git commit`)과 푸시(`git push`)는 절대로 동시에(연달아) 실행하지 않습니다.**
  - **커밋과 푸시는 각각 사용자의 명확한 지시가 있을 때만 개별적으로 수행**하며, 에이전트의 독단적인 판단으로 커밋하거나 푸시하지 않습니다.
- **Lore 커밋 형식 준수**: 비사소한 변경 시 Git Trailer(의사결정 맥락)를 포함한 Lore 포맷으로 커밋합니다.
  - `Fixes: #이슈번호` (또는 `Related:`)
  - `Constraint:` (외부 제약 조건)
  - `Rejected:` (기각된 대안과 이유)
  - `Confidence: high|medium|low`
  - `Scope-risk: narrow|moderate|broad`
  - `Reversibility: clean|moderate|difficult`
  - `Tested:` (수행한 검증)
  - `Directive:` (향후 수정자를 위한 지침)
- **외부 저장소 주의사항**: `screener` 저장소에 커밋할 경우 GJC pre-commit 훅이 걸려 있으므로 인가된 변경 시 `git commit --no-verify`를 사용합니다.
- **이슈 관리**: 기능 추가 및 주요 작업 시 GitHub CLI(`gh issue create`, `gh issue view` 등)를 적극 활용합니다.
