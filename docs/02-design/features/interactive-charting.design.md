# 02-Design: Interactive Charting System (Pragmatic Balance)

## Context Anchor
| Dimension | Content |
|-----------|---------|
| WHY | 기존 Streamlit/FastAPI 차트의 동기화, 모바일 최적화 및 레이아웃 제어 한계 극복 |
| WHO | `mtt-trend` 대시보드를 일일 모니터링 및 심층 분석에 사용하는 트레이더/분석가 |
| RISK | `lightweight-charts` React 래퍼 적용 시 리렌더링 및 메모리 누수 성능 저하 |
| SUCCESS | 1만 개 이상의 데이터에서도 모바일/웹 60fps 유지, 여러 차트 간 크로스헤어 100% 동기화 |
| SCOPE | (In) 상단 주가 차트 고정, 하단 기술 지표 루프 렌더링, 크로스헤어 동기화, FastAPI 차트 전용 데이터 API 추가 |

## 1. Overview
FastAPI 백엔드에 차트 전용 API를 추가하고, 프론트엔드(`Next.js`)에서 `lightweight-charts`를 사용해 "주가 차트(상단 고정) + 다중 지표 차트(하단 스크롤)" 레이아웃을 구현합니다. 프론트엔드는 지표 설정 배열을 매핑하여 차트를 동적으로 렌더링하는 실용적(Pragmatic Balance) 아키텍처를 채택합니다.

## 2. Architecture & Components

### 2.1. Backend (FastAPI)
- **Endpoint**: `GET /api/charts/data`
- **Request Parameters**:
  - `symbol` (선택적, 기본값: 'KOSPI' 또는 특정 테마명)
  - `start_date` (선택적)
  - `end_date` (선택적)
  - `indicators` (선택적, 쉼표로 구분된 지표 목록, 예: `rsi,macd,200ma_rate`)
- **Response Format**:
  `lightweight-charts`에 바로 주입할 수 있는 Time-Series 배열 형태로 최적화된 JSON.
  ```json
  [
    { "time": "2024-01-01", "open": 2500, "high": 2520, "low": 2490, "close": 2510, "rsi": 65.2, "macd": 1.5, "signal": 1.2 },
    // ...
  ]
  ```
- **Data Processing (`scripts/ingest.py` 재활용 및 확장)**:
  - 기존 SQLite 데이터(`theme_daily`, `theme_stock_daily`) 또는 외부 소스(CSV/Parquet)에서 OHLCV 데이터 및 미리 계산된 지표 데이터를 추출.

### 2.2. Frontend (Next.js & React)
- **Component: `InteractiveChart.tsx` (신규)**
  - `src/app/trend/_components/` 경로에 생성.
  - **State & Refs**:
    - `chartRefs`: 생성된 모든 `lightweight-charts` 인스턴스 배열을 보관하여 이벤트 핸들링에 사용.
    - `syncCrosshair(param, sourceChart)`: 한 차트에서 발생한 마우스 이벤트 좌표(time/price)를 기반으로 다른 모든 차트의 `setCrosshairPosition`을 호출.
  - **Layout (CSS/Tailwind)**:
    - 메인 컨테이너는 Flexbox column 구조.
    - 첫 번째 차트(주가 차트) 래퍼에 `position: sticky; top: 0; z-index: 10;` 적용.
    - 나머지 지표 차트들은 그 아래에 일반적인 스크롤 요소로 배치.
  - **Dynamic Rendering**:
    - `chartConfig` 배열 (예: `[{ id: 'main', type: 'candlestick', heightRatio: 3 }, { id: 'rsi', type: 'line', heightRatio: 1 }]`)을 순회하며 차트 컨테이너 `div` 생성.
    - 브라우저 창 크기 조절 이벤트를 감지하여 모든 차트 인스턴스의 `resize` 메서드 동기 호출.

## 3. Data Flow
1. 사용자가 페이지 진입 시 `useChartData` (React Query Custom Hook)가 `/api/charts/data` 호출.
2. 백엔드(FastAPI)가 SQLite DB 및 기술 지표 데이터를 취합하여 Time-Series JSON 반환.
3. 프론트엔드의 `InteractiveChart` 컴포넌트가 마운트되면서 `lightweight-charts` 인스턴스 초기화.
4. 데이터가 도착하면 메인 차트(`setData(ohlcv)`), 지표 차트(`setData(indicatorData)`)에 각각 데이터 세팅.
5. 차트 위 마우스 이동 시 `subscribeCrosshairMove` 콜백 트리거 -> 모든 하위 차트 동기화 업데이트.

## 4. API Design (FastAPI Schema)
```python
# app/schemas.py (신규 추가)
class ChartDataPoint(BaseModel):
    time: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    # 동적 지표 필드 (Dictionary 형태 반환 고려)
    indicators: Optional[Dict[str, float]] = None

class ChartDataResponse(BaseModel):
    symbol: str
    data: List[ChartDataPoint]
```

## 5. Security & Error Handling
- **Error Handling**: API 요청 실패 시 차트 영역 중앙에 에러 메시지 렌더링. 데이터 배열이 비어있을 경우 "데이터 없음" 문구 표출.
- **Security**: `/api/charts/data` 엔드포인트 파라미터(특히 `symbol`, `indicators`)에 대한 철저한 유효성 검사 (SQL Injection 방지, 허용된 지표 목록만 쿼리 허용).

## 6. Implementation Steps (Do Phase Guide)
1. **[Backend] API 구성**: `app/routers/charts.py` 생성 및 `/api/charts/data` 구현.
2. **[Backend] Data Fetching**: 임시 더미 데이터(OHLCV + 지표)를 생성하는 로직 작성 (DB 연동 전 테스트용).
3. **[Frontend] Package Install**: `npm install lightweight-charts` 실행.
4. **[Frontend] Hook 구성**: `src/hooks/useChartData.ts` 생성하여 React Query로 API 연결.
5. **[Frontend] Component UI**: `InteractiveChart.tsx` 작성. 차트 초기화, 동기화, 해제(Cleanup) 로직 구현.
6. **[Frontend] Layout 구성**: 설정 배열(Props) 기반 루프 렌더링 작성.
7. **[Integration]**: `src/app/trend/page.tsx`에 신규 컴포넌트 마운트 및 테스트.