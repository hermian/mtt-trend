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
