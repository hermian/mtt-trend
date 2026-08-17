# Consensus Plan (pending approval) — 시총 TOP 30 추적 대시보드 탭

Sources: deep-interview spec `deep-interview-top30-marcap-tracking.md` (sha256 75b1744c…); ralplan run `01a00d0b-85b9-7000-a23f-a2c32aeaba04` pass 1 — Planner (0c62671f…), Architect CLEAR/APPROVE (56757bbf…), Critic OKAY (244578f…).

## RALPLAN-DR Summary
- **Principles**: (1) reuse repo conventions; (2) deterministic/testable ranking API independent of live `~/.cache/db`; (3) chart/table share one JSON payload; (4) signal semantics per spec (new_entrant, rank_delta, movers); (5) add orthogonally, don't mutate existing endpoints/UI.
- **Decision Drivers**: signal correctness + boundary testability; single payload source; minimal surface.
- **Viable Options**: A = dedicated endpoint + duckdb util + recharts (chosen); B = extend heatmap/charts (rejected: concern-mixing, regression risk); C = lightweight-charts ladder (rejected: financial-chart form factor, weaker emphasis/toggle fit).
- **Why chosen**: clean separation, full testability, recharts `Line type="stepAfter"` present, matches spec chart + table-toggle. **Consequences**: one new router/util/schema set; movers styling must be CSS-enforced; **Follow-ups**: manual smoke vs real `~/.cache/db` before merge; keep mover threshold as a single constant for easy tuning.

## ADR
- **Decision**: new dedicated backend router `top30.py` + duckdb util + recharts-based panel + sidebar `?tab=top30`.
- **Drivers**: correctness/testability of rank signals; single payload for chart+table; minimal orthogonal surface.
- **Alternatives**: extend charts.py / heatmap (rejected), lightweight-charts (rejected) — see Options above.
- **Why chosen**: matches spec; testable; existing libs.
- **Consequences**: new schema/routes; frontend adds one panel + wiring.
- **Follow-ups**: real-data smoke test; mover-threshold constant.

## Backend (FastAPI, `backend/`)
1. **`backend/app/utils/top30_utils.py`**
   - `KQ → KOSDAQ` label map (reuse heatmap pattern).
   - `resolve_partition(date)`: return the newest partition (under the existing env-overridable `RS_PARQUET_DIR`/`_latest_rs_partition`-style path) with `Date <= requested`; if none, return None. **Contract pinned so the before-data-start test is deterministic.**
   - `load_top30(partition, market)`: duckdb read `Code, Name, Market, Marcap`; exclude null Marcap; row_number by `Marcap DESC` within `all|kospi|kosdaq`; return top 30 with `rank`.
   - `build_rankings(ref_date, comp_date, market, window_dates)`: `previous_rank` from compare; **`rank_delta = previous_rank − reference_rank` (positive = climb, negative = drop)**; `new_entrant = previous_rank is None`; `rank_series` per window date (missing date ⇒ null break).
2. **`backend/app/schemas.py`**: `Top30Stock` (code, name, market, marcap 천억원 float, rank, previous_rank, rank_delta, new_entrant, series), `Top30Response` (date, market, compare_days, compare_date, window_dates, stocks, compare_available), `Top30DatesResponse`.
3. **`backend/app/routers/top30.py`** (new, registered in `main.py`):
   - `GET /api/trend/top30?date=YYYY-MM-DD&market=all|kospi|kosdaq&compare_days=5` — validate market ∈ {all,kospi,kosdaq}, compare_days ∈ {1,5,20,60}; resolve ref/compare dates; before-data-start ⇒ graceful `previous_rank=null`, `new_entrant=false`, `rank_delta=null`, `compare_available=false`.
   - `GET /api/trend/top30/dates` — available trading dates.
4. **`backend/tests/test_api_top30.py`** + `conftest.py` fixture (temp partitions under `RS_PARQUET_DIR`, duckdb): exactly 30; Marcap-desc order; kospi/kosdaq/all slices; new_entrant; **rank_delta sign (positive climb / negative drop)**; null-Marcap exclusion; invalid `market`/`compare_days` ⇒ 422; before-data-start graceful path.

## Frontend (Next.js, `frontend/`)
5. **`frontend/src/lib/api.ts`**: `Top30Stock`, `Top30Response` + `getTop30(date, market, compareDays)` (reuse existing fetch pattern).
6. **`frontend/src/hooks/useTop30.ts`**: react-query keyed `[date, market, compareDays]`.
7. **`frontend/src/app/trend/_components/MarketCapTop30Panel.tsx`**:
   - Chart (default): recharts `LineChart`, `Line type="stepAfter"`, `YAxis reversed [1,30]`; movers (new_entrant or rank_delta ≥ 5) bright/thick, others thin + low-saturation (**CSS-enforced**); rank-down subtle red; `Tooltip` (종목명/순위/시총 천억원); `Legend`.
   - Table (toggle): rank, ▲▼ (rank_delta), name (`StockNameLink`), market, marcap 천억원, 신규진입 badge.
   - Controls: date / market(전체·KOSPI·KOSDAQ) / compare_days({1,5,20,60}) selectors, default 5; view toggle 차트|표.
8. **`frontend/src/app/_components/Sidebar.tsx`**: add `href="/trend?tab=top30"` label **"시총 TOP 30"** + icon + `isTop30Active`.
9. **`frontend/src/app/trend/page.tsx`**: `top30` in `activeTab` parser; render `<MarketCapTop30Panel/>`; include `top30` in header-visible list and `overflow-hidden` scroll branch (like wics/stockbee); header title "시총 TOP 30".
10. **Tests**: `useTop30.test.ts` (mocked fetch) + `MarketCapTop30Panel.test.tsx` (chart + table + toggle + new-entrant badge + getTop30 called with filters).

## Acceptance check (maps to spec AC)
- [ ] Backend returns exactly 30 by Marcap desc (천억원). rank_delta/previous_rank/new_entrant present; sign locked.
- [ ] Market filter recomputes per market. compare_days {1,5,20,60} vs N-trading-days-earlier; before-data-start graceful.
- [ ] Backend pytest passes incl. boundary (null marcap, market, new-entrant, sign, graceful).
- [ ] Sidebar tab → chart default (recharts stepped, movers emphasized), table toggle, date/market/compare selects wired.

## Risks
- Compare-window before earliest partition → graceful (spec + test).
- 30 recharts lines: fine at this scale.
- Movers threshold as one constant for tuning.

## Intent Reconciliation
- **Clean.** No open assumptions conflict with user intent captured in the deep-interview spec. All user decisions (chart-default + table toggle; market filter all/kospi/kosdaq; comparison default 5 / options 1/5/20/60; standard new-entrant vs rank-climber semantics; movers ≥5 rank emphasis; non-goals) are implemented faithfully in the sections above. No prior-context conflict (this spec is the only governing artifact).
