# 01-Plan: AVWAP 수급 탭 (종목분석기 lightweight-charts 통합)

## 1. Executive Summary

- **Problem**: `stock_analyzer`(종목분석기)의 수급 분석 기능이 별도 FastAPI 앱(Plotly 기반)으로 분리되어 있어, AVWAP 차트와 함께 종목을 분석하려면 앱/URL을 전환해야 합니다. AVWAP 차트에서 KR 종목을 선택해도 수급 데이터는 자동으로 함께 갱신되지 않습니다.
- **Solution**: `stock_analyzer`의 수급 지표·테이블·차트 로직을 mtt-trend 백엔드 API로 이식하고, AVWAP 차트 하단에 **「AVWAP 수급」** 탭을 추가합니다. 차트는 Plotly 대신 `lightweight-charts`로 구현하며, KR 종목 선택 시 AVWAP 데이터와 **병렬 prefetch**하여 탭 전환 시 즉시 표시합니다.
- **Reference UI**: [종목분석기 — 키움증권(039490)](http://hermian.duckdns.org:18081/?code=039490) (Playwright 스크린샷 기준)
- **Function UX Effect**: AVWAP 차트에서 KR 주식을 검색·선택하면 AVWAP·수급 데이터가 동시에 로드됩니다. 하단 탭 `AVWAP` ↔ `AVWAP 수급` 전환 시 로딩 없이 캐시된 수급 분석표·차트·순매수 합계를 바로 확인할 수 있습니다.

---

## 2. Objective & Scope

### 2.1 목표

1. AVWAP 차트 영역 하단에 **「AVWAP 수급」** 탭 추가 (기본 탭: `AVWAP`)
2. KR 종목(`searchCountry === "kr"` && `searchType === "stock"`)일 때만 탭 활성화
3. 종목 변경 시 AVWAP API + 수급 API **동시 요청** (React Query prefetch)
4. `stock_analyzer`와 **동일 산출물** 제공:
   - 수급 분석표 (상세)
   - 투자자별 매매동향 이동평균 (LDS 요약)
   - 차트 4종 (MA 3패널, 분산비율, 정규화 비교, 기간별 순매수 합계)
   - 분산비율 보조표 (통계 / 최근 5일 / 최고가 시점)
5. 차트 렌더링: **lightweight-charts** (AGENTS.md 규칙 준수)

### 2.2 범위 (In Scope)

| 영역 | 포함 |
|------|------|
| 대상 시장 | KR 주식 (6자리 종목코드) |
| 데이터 소스 | `~/.cache/db/sugeub.sqlite` (screener cron 갱신, 읽기 전용) |
| 시세 병합 | FinanceDataReader (stock_analyzer `sources.fetch_price` 동일) |
| UI 위치 | `AvwapChart.tsx` 하단 탭 (차트 캔버스 영역 교체) |
| 기간 합계 | 1M / 3M / 6M / 12M 프리셋 + 사용자 지정 기간 |

### 2.3 범위 외 (Out of Scope)

- US 종목 / ETF / 지수 AVWAP 수급 (탭 비활성 또는 안내 메시지)
- sugeub DB 직접 갱신 (기존 screener cron 유지)
- stock_analyzer 독립 앱 폐기 (본 Plan은 mtt-trend 통합만)

---

## 3. Reference UI 분석 (Playwright)

참조 URL `http://hermian.duckdns.org:18081/?code=039490` 기준 구성:

```
┌─────────────────────────────────────────────────────────┐
│  종목 분석기 — 키움증권(039490)                           │
├─────────────────────────────────────────────────────────┤
│  [1] 수급 분석표 (상세)          ← 테이블 (최근 10일 + 요약행) │
│  [2] 투자자별 매매동향 MA (LDS)   ← 테이블 (5~720일 구간)      │
├─────────────────────────────────────────────────────────┤
│  [3] Chart 1 — 종가·세력 오실레이터·주체별 매집수량 3MA (3패널) │
│  [4] Chart 2 — 주체별 분산비율 (%) + 종가 보조축              │
│  [5] Chart 3 — 매집수량 min-max 정규화 비교 + 종가 보조축      │
├─────────────────────────────────────────────────────────┤
│  [6] 주체별 순매수 합계  [1M][3M][6M][12M] + 날짜 범위       │
│      → 막대 차트 (양수 적색 / 음수 청색)                      │
├─────────────────────────────────────────────────────────┤
│  [7] 분산비율 상세 — 통계 / 최근 5일 / 최고가 시점            │
└─────────────────────────────────────────────────────────┘
```

**lightweight-charts 적용 범위**

| # | 원본 (Plotly) | lightweight-charts 전략 |
|---|---------------|-------------------------|
| 3 | 3패널 시계열 | 멀티 pane (AvwapChart/MarketFlowChart 패턴) — X축·크로스헤어 동기화 |
| 4 | 분산비율 % + 종가 | LineSeries(분산) + LineSeries(종가, 별도 priceScale) |
| 5 | 정규화 매집수량 + 종가 | LineSeries(정규화) + LineSeries(종가, 별도 scale) |
| 6 | 카테고리 막대 | **HTML/CSS React Bar** (투자자명 x축 — lightweight 비시계열) |

**테이블 [1][2][7]**: React `<table>` + Tailwind (pandas Styler HTML 이식)

---

## 4. Data & Indicator Specifications

> 원본: `../stock_analyzer/analyzer/{config,indicators,tables,db,sources}.py`

### 4.1 DB 스키마

- 파일: `SUGEUB_DB` env 또는 `~/.cache/db/sugeub.sqlite`
- 테이블: `종목별투자자_수량`
- PK: `(일자, 단축코드)`
- 컬럼: 개인, 외국인, 기관계, 금융투자, 보험, 투신, … (일별 순매수 수량)

### 4.2 지표 계산 (`compute_indicators`)

```
세력 = 외국인 + 기관계
{c}누적 = cumsum({c})
{c}매집수량 = {c}누적 - cummax({c}누적).cummin()  ← 원본 로직
{c}매집고점 = {c}매집수량.cummax()
{c}분산비율 = {c}매집수량 / {c}매집고점
```

- MA: 종가/거래량 × {5, 20, 60, 240}일
- SUM: 투자자별 × {5, 20, 60, 240}일 rolling sum
- 정규화: `_norm(s) = (s - mean) / (max - min)`

### 4.3 DISPLAY_COLS (표·차트 공통 순서)

```
개인, 세력, 외국인, 기관계, 금융투자, 보험, 투신,
기타금융, 은행, 연기금, 사모, 기타법인, 기타외국인
```

### 4.4 순매수 합계 기간

- 프리셋: `1m`(31일), `3m`(91일), `6m`(182일), `12m`(365일) — 기본 `3m`
- 사용자 지정: `sum_start` ~ `sum_end` (데이터 범위 내 clamp)

---

## 5. Backend Architecture

### 5.1 신규 엔드포인트

```
GET /api/charts/supply-demand
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `code` | string | **필수** — 6자리 KR 종목코드 |
| `sum` | string | `1m` \| `3m` \| `6m` \| `12m` (기본 `3m`) |
| `sum_start` | string? | YYYY-MM-DD (sum_start/end 지정 시 sum 무시) |
| `sum_end` | string? | YYYY-MM-DD |

### 5.2 응답 스키마 (`SupplyDemandResponse`)

```typescript
interface SupplyDemandResponse {
  code: string;
  name: string;
  data_first: string;   // ISO date
  data_last: string;
  sum_period: { preset: string; start: string; end: string; label: string };

  // 시계열 (차트용 — 전체 기간)
  series: SupplyDemandPoint[];

  // 테이블 (서버-side 계산 완료 JSON)
  table_supply: SupplyDemandTableRow[];
  table_lds: LdsTableRow[];
  table_dispersion_stats: DispersionRow[];
  table_dispersion_recent: DispersionRow[];
  table_dispersion_peak: DispersionRow[];

  // 기간별 순매수 합계 (막대 차트용)
  period_sums: { investor: string; value: number }[];
}

interface SupplyDemandPoint {
  date: string;
  close: number;
  volume: number;
  // 투자자별 일별 순매수
  investors: Record<string, number>;
  // 지표
  force_oscillator: number | null;      // 세력 5MA - 20MA
  accumulation_3ma: Record<string, number | null>;  // {세력, 외국인, ...}매집수량 3MA
  dispersion_pct: Record<string, number | null>;    // 분산비율 × 100
  norm_accumulation: Record<string, number | null>; // min-max 정규화
}
```

### 5.3 백엔드 파일

| 파일 | 역할 |
|------|------|
| `backend/app/utils/sugeub_utils.py` | DB 조회, FDR 시세, `compute_indicators`, 테이블 빌드 (stock_analyzer 포팅) |
| `backend/app/schemas.py` | Pydantic 모델 추가 |
| `backend/app/routers/charts.py` | `GET /supply-demand` 라우트 |
| `backend/tests/test_supply_demand.py` | 지표·API 통합 테스트 (039490/005930 fixture) |

**포팅 원칙**: `indicators.compute_indicators`, `tables.build_*`, `db.load_supply_demand` 로직을 **수치 동일성** 기준으로 복사. HTML 렌더링(`*_html`)은 JSON 변환으로 대체.

### 5.4 환경 변수

```bash
SUGEUB_DB=~/.cache/db/sugeub.sqlite   # stock_analyzer와 동일
```

---

## 6. Frontend Architecture

### 6.1 컴포넌트 구조

```
AvwapChart.tsx
├── [기존] Control Bar / HUD / AVWAP Chart Canvas
└── [신규] Bottom Tab Bar
    ├── Tab "AVWAP"        → 기존 4~5 pane 차트
    └── Tab "AVWAP 수급"   → AvwapSugeubPanel
        ├── SugeubTables.tsx       — [1][2][7] 테이블
        ├── SugeubMaChart.tsx      — Chart 1 (3 pane, lightweight)
        ├── SugeubDispersionChart.tsx — Chart 2
        ├── SugeubNormChart.tsx    — Chart 3
        └── SugeubPeriodSumBar.tsx — Chart 6 (React bar, 비-LWC)
```

### 6.2 React Query 연동 (AVWAP 연동 핵심)

```typescript
// hooks/useSupplyDemand.ts
export const useSupplyDemand = (code: string | null, sumOpts, enabled: boolean) =>
  useQuery({
    queryKey: ["supplyDemand", code, sumOpts],
    queryFn: () => api.getSupplyDemand(code!, sumOpts),
    enabled: enabled && !!code,
    staleTime: 60_000,
  });

// AvwapChart.tsx — KR 종목 symbol 변경 시
const isKrStock = searchCountry === "kr" && searchType === "stock" && !!symbol;

useEffect(() => {
  if (!isKrStock || !symbol) return;
  queryClient.prefetchQuery({
    queryKey: ["supplyDemand", symbol, defaultSumOpts],
    queryFn: () => api.getSupplyDemand(symbol, defaultSumOpts),
  });
}, [symbol, isKrStock, queryClient]);
```

**동작 시나리오**

1. 사용자가 KR 종목 `039490` 검색 → AVWAP `useAvwapChart` + 수급 `prefetchQuery` **동시 시작**
2. AVWAP 탭에서 차트 분석 중 → 백그라운드로 수급 데이터 캐시 완료
3. 「AVWAP 수급」 탭 클릭 → 캐시 hit → **즉시 렌더** (스피너 없음)
4. US/ETF/지수 선택 → 수급 탭 **disabled** + tooltip "KR 주식 전용"

### 6.3 탭 UI 위치

```
┌─ Control Bar (기존) ─────────────────────────────────┐
├─ HUD Header (기존) ──────────────────────────────────┤
├─ [AVWAP] [AVWAP 수급]  ← 탭 바 (KR 종목일 때만 수급 활성) │
├─ Content Area (flex-1, overflow-y-auto) ─────────────┤
│   AVWAP 탭: 기존 MDD/Main/HP/Volume/Amount panes     │
│   수급 탭:  SugeubPanel (테이블 + 차트 스크롤)          │
└──────────────────────────────────────────────────────┘
```

### 6.4 lightweight-charts 구현 규칙 (AGENTS.md)

- `createPriceLine({ title: "" })` — pane 내부 텍스트 오버레이 금지
- 지표명·수치: **상단 HUD 헤더** 또는 패널 좌상단 배지
- 크로스헤어 hover: `axisLabelVisible: true`, `lineVisible: false`, `color: <지표색>`
- 좌측 Y축 비활성 (`leftPriceScale: { visible: false }`)
- 다중 pane: `MarketFlowChart` / `AvwapChart` 의 `chartsRef` + `subscribeCrosshairMove` 동기화 패턴 재사용

### 6.5 차트 색상 (stock_analyzer plotly 팔레트 이식)

| 주체 | MA Chart | Dispersion |
|------|----------|------------|
| 종가 | `#8aa8cf` | rgba 보조 |
| 세력 | `#b8860b` / darkgoldenrod | `#b8860b` |
| 외국인 | `#d65c5c` | `#cc3333` |
| 기관계 | `#3a9c3a` | `#2e8b2e` |
| 개인 | `#2244cc` | `#2244cc` |
| 세력 오실레이터 | purple | — |

### 6.6 테이블 스타일

- 다크 테마: `bg-gray-900`, `border-gray-700`, `text-gray-200`
- 양수(순매수): `text-red-400`, 음수: `text-blue-400` (원본 red/blue 유지)
- 세력 열: `bg-emerald-950/40` gradient hint
- 요약 행(1주/1달/현재보유량/분산추이): `bg-amber-950/30` / `bg-teal-950/30`

---

## 7. Implementation Steps

### Phase 1 — Backend API (TDD)

1. `sugeub_utils.py` 포팅 + 단위 테스트 (indicators 수치 검증 vs stock_analyzer snapshot)
2. `SupplyDemandResponse` 스키마 + `/api/charts/supply-demand` 라우트
3. `test_supply_demand.py` — 039490, 005930 API 응답 구조·핵심 값 assert

### Phase 2 — Frontend Data Layer

1. `api.ts` — `getSupplyDemand()` + TypeScript 타입
2. `useSupplyDemand.ts` hook
3. `AvwapChart.tsx` — prefetch on symbol change

### Phase 3 — Tab Shell

1. `chartViewTab` state: `"avwap" | "sugeub"`
2. 탭 바 UI + KR 전용 enable/disable
3. `AvwapSugeubPanel.tsx` skeleton (로딩/에러/empty)

### Phase 4 — Tables

1. `SugeubTables.tsx` — 5개 테이블 렌더
2. Vitest: 테이블 행·색상 클래스 snapshot

### Phase 5 — Charts (lightweight-charts)

1. `SugeubMaChart.tsx` — 3 pane sync
2. `SugeubDispersionChart.tsx` — 범례 토글 (기본 visible = `DISPERSION_DEFAULT_VISIBLE`)
3. `SugeubNormChart.tsx`
4. `SugeubPeriodSumBar.tsx` — 기간 pill + date picker + bar
5. 기간 프리셋 변경 시 `sum` queryKey 변경 → refetch

### Phase 6 — Integration & QA

1. `pnpm run build` (frontend zero TS errors)
2. Playwright E2E: `avwap-sugeub.spec.ts`
   - KR 종목 039490 로드 → AVWAP + 수급 prefetch
   - 「AVWAP 수급」 탭 클릭 → 테이블·차트 visible (< 500ms, 캐시 hit)
   - US 종목 → 수급 탭 disabled
3. Visual regression (optional): reference URL vs local screenshot diff

---

## 8. File Change Summary

| # | Path | Change |
|---|------|--------|
| 1 | `backend/app/utils/sugeub_utils.py` | **NEW** |
| 2 | `backend/app/schemas.py` | SupplyDemand* 모델 추가 |
| 3 | `backend/app/routers/charts.py` | `/supply-demand` 엔드포인트 |
| 4 | `backend/tests/test_supply_demand.py` | **NEW** |
| 5 | `frontend/src/lib/api.ts` | API client + types |
| 6 | `frontend/src/hooks/useSupplyDemand.ts` | **NEW** |
| 7 | `frontend/src/app/trend/_components/AvwapChart.tsx` | 탭 바 + prefetch |
| 8 | `frontend/src/app/trend/_components/AvwapSugeubPanel.tsx` | **NEW** |
| 9 | `frontend/src/app/trend/_components/sugeub/*.tsx` | 차트·테이블 sub-components |
| 10 | `frontend/e2e/avwap-sugeub.spec.ts` | **NEW** |

**수정 파일 3+ → TodoList 단위 분할 실행**

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| sugeub.sqlite 미존재/구버전 | API 404 + UI "수급 DB 없음" 안내 (foreign_flow 패턴) |
| 지표 수치 불일치 | stock_analyzer `.snapshots/` CSV와 pytest 대조 |
| AvwapChart.tsx 3000+ LOC 추가 부담 | 수급 UI는 `AvwapSugeubPanel`로 완전 분리 |
| 분산비율 13개 시리즈 성능 | 범례 default 9개만 visible, 나머지 off |
| 기간 막대 차트 | lightweight 비적합 → React SVG/CSS bar (scope 명시) |

---

## 10. Acceptance Criteria

- [ ] AVWAP 차트 하단에 `AVWAP` / `AVWAP 수급` 탭 표시
- [ ] KR 주식 선택 시 AVWAP·수급 API 병렬 호출
- [ ] 수급 탭 첫 진입 시 캐시된 데이터 즉시 표시 (prefetch 완료 시)
- [ ] stock_analyzer와 동일: 2 테이블 + 4 차트 + 3 보조표
- [ ] 차트: lightweight-charts (기간 합계 bar 제외)
- [ ] AGENTS.md: `createPriceLine` title 금지, HUD/우측 Y축 라벨 준수
- [ ] US/ETF/지수: 수급 탭 비활성 + 안내
- [ ] `pnpm run build` 성공 + E2E 통과

---

## 11. Test Plan

### Backend (pytest)

- `test_compute_indicators_matches_snapshot` — 005930/039490
- `test_supply_demand_api_kr_stock` — 200 + schema
- `test_supply_demand_api_invalid_code` — 404
- `test_sum_period_presets` — 1m/3m/6m/12m, custom range

### Frontend (Vitest)

- `AvwapSugeubPanel.test.tsx` — 테이블·로딩·에러
- `SugeubMaChart.test.tsx` — pane mount (mock LWC)
- `AvwapChart.test.tsx` — 탭 전환, KR prefetch trigger

### E2E (Playwright)

```typescript
test("KR stock prefetches supply-demand; tab shows instantly", async ({ page }) => {
  await page.goto("/trend?tab=avwap&symbol=039490&name=키움증권&type=stock&country=kr");
  await expect(page.locator('[data-chart-id="main"]')).toBeVisible({ timeout: 15000 });
  // Wait for prefetch network
  await page.waitForResponse(r => r.url().includes("/api/charts/supply-demand") && r.status() === 200);
  await page.getByRole("tab", { name: "AVWAP 수급" }).click();
  await expect(page.getByText("수급 분석표")).toBeVisible();
  await expect(page.locator('[data-chart-id="sugeub-ma"]')).toBeVisible();
});
```

---

## 12. Dependencies

- 기존: `lightweight-charts`, `@tanstack/react-query`, FastAPI, pandas
- 백엔드 추가: `FinanceDataReader` (이미 screener/mtt-trend 생태계 사용)
- DB: screener `sugeub.sh` cron (평일 18:05) — **변경 없음**

---

Version: 1.0.0  
Created: 2026-08-23  
Related: `../stock_analyzer`, `avwap-supertrend.plan.md`, `kospi-kosdaq-avwap-chart.plan.md`
