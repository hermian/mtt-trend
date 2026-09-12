# MTT Trend 성능 개선 감사 리포트

> 작성일: 2026-09-12 (개정: 2026-09-12 — 측정 방법 정정 및 P0 top30 개선 완료 반영)
> 대상: `hermian/mtt-trend`
> 관련 이슈: #50 (본 감사), #44 (선행 — gzip·수급 캐시·threadpool)

---

## ⚠️ 측정 방법 정정 (중요)

**초판의 절대 수치는 부풀려져 있었습니다.**

초판은 `http://localhost:8000` 으로 측정했는데, 이 호스트명이 **IPv6(`::1`) 연결을 먼저 시도한 뒤
IPv4로 폴백**하면서 요청마다 **약 0.21초의 순수 측정 아티팩트**가 더해졌습니다.

```
localhost  : connect=0.0002s  ttfb=0.254s  total=0.254s
127.0.0.1  : connect=0.0002s  ttfb=0.047s  total=0.047s   ← 동일 요청, 차이 0.207s
```

따라서 **본 개정판의 수치는 `curl -4 http://127.0.0.1:8000`** 으로 다시 측정한 값입니다.
초판에서 "느리다"고 지목한 엔드포인트 중 다수(heatmap 0.30s→0.005s, stockbee-mm 0.18s→0.004s,
dates 0.17s→0.004s 등)는 **실제로는 아티팩트가 대부분**이었고, 우선순위가 아래와 같이 조정됩니다.

측정 조건: 로컬 PM2 `mtt-backend`, 워밍 후 3회 중 최솟값, 서버 가동 안정 상태.

---

## 0. 요약 — 정정된 우선순위

| 순위 | 대상 | 정정 실측 | 페이로드 | 원인 | 상태 |
|------|------|-----------|----------|------|------|
| ~~P0~~ | `GET /api/trend/top30` | **2.19s → 0.043s** | 5.2KB | 종목 30 × 기간 6 = parquet 180회 중복 읽기 | ✅ **해결 (46배)** |
| ~~P0~~ | `/trend` 초기 JS | **1,652KB → 741KB** | — | 탭 24개 전부 정적 import (코드 스플리팅 없음) | ✅ **해결 (−55.1%)** |
| **P1** | `GET /api/charts/wics-rankings` | **0.330s** | **16.4MB** | 전체 월 무제한 반환 (페이지네이션 없음) | 미착수 |
| **P1** | `GET /api/charts/macro` | **0.287s** | **13.7MB** | 요청마다 ~35개 SQL + ffill 재계산, 캐시 없음 | 미착수 |
| ~~P1~~ | recharts 번들 | **811KB → 초기 번들에서 제거** | — | 컴포넌트 3개에서만 사용 | ✅ **해결** |
| **P2** | `GET /api/charts/trend-up-breadth` | **0.212s** | 634KB | `etf_krx.parquet`(74MB) 매 요청 재읽기 | 미착수 |
| **P2** | 블로킹 `async def` 핸들러 다수 | 동시 요청 직렬화 | — | sqlite/duckdb/pandas를 async 핸들러에서 직접 실행 | 미착수 |
| **P3** | `foreign-flow` / `wics-index/all` / `persistent` / `wics-index/meta` | 0.104 ~ 0.115s | — | 파켓·정적 데이터 캐시 부재 | 미착수 |
| **P3** | `React.memo` / `useCallback` | **0건** | — | 3,684행 `AvwapChart` 등 대형 컴포넌트 | 미착수 |

> 초판에서 P2로 분류했던 `wics-index/meta`(0.80s→0.104s), `intersection`(0.72s→0.039s),
> `supply-demand`(0.87s→0.018s), `avwap`(1.08s→0.034s), `valuation-bands`(0.22s→0.023s),
> `heatmap`(0.30s→0.005s) 등은 **아티팩트 제거 후 실질 병목이 아니었습니다.**

---

## 1. ✅ 완료 — `/api/trend/top30` N+1 파켓 읽기 해소

### 원인

`app/utils/top30_utils.py`의 `compute_top30()`이 상위 30개 종목 각각에 대해 `build_series()`를
호출하고, 그 안에서 `window_dates`(기본 6일)를 순회하며 `load_marcap_rows()`를 실행했습니다.

```
30 stocks × 6 dates = 180회  →  매번 duckdb.connect(":memory:") + 1.1MB parquet 재읽기
```

`resolve_partition()`도 호출마다 `rs_dir.iterdir()`로 **413개 파티션 디렉터리를 재스캔**했습니다.

### 적용한 변경 (`backend/app/utils/top30_utils.py`, +112 / −28)

1. **`_rs_index()` 신설** — 파티션 인덱스(날짜 목록 + parquet 경로)를 **1회 스캔**으로 구축하고
   디렉터리 mtime 키로 캐시. `available_dates()` / `resolve_partition()` 이 이를 공유.
   → 413개 디렉터리 재스캔 제거 (콜드 3.5ms → 캐시 히트 0.0ms, `resolve_partition` × 8 = 0.0001s)
2. **`compute_top30()` 이 파티션을 "해석된 날짜당 1회"만 로드** — `ranked_by_date` 공유 캐시로
   종목 루프에서 재사용. window 날짜 해석 결과도 순서 유지한 채 1회만 계산.
3. `build_series()` 에 선택적 `rank_map_cache` 파라미터 추가 (단독 호출 시 기존 동작 유지).

### 검증 — 출력 동등성 (deep JSON 비교)

개정 전 소스를 `git show HEAD:...` 로 추출해 별도 모듈로 로드한 뒤, **16개 시나리오를
`json.dumps(sort_keys=True)` 로 완전 비교**했습니다.

```
[OK] available_dates identical
[OK] resolve_partition identical (9 probes, 비거래일·범위밖 날짜 포함)
[PASS] all 16 scenarios identical (deep JSON compare)
```

- 시장 필터: `all` / `kospi` / `kosdaq`
- 비교 기간: `compare_days` = 1 / 5 / 20 / 60
- 경계: 데이터 시작 이전(`compare_available=False`), 중간 날짜, 비거래일

### 검증 — 성능

| 측정 | 개선 전 | 개선 후 | 배수 |
|------|---------|---------|------|
| `compute_top30()` 동일 프로세스 A/B | **2.19s** | **0.047s** | **46배** |
| `GET /api/trend/top30` (127.0.0.1) | ~1.79s (추정¹) | **0.043s** | **~42배** |
| 파켓 읽기 횟수 | 180회 | 6회 | 30배 |
| `resolve_partition()` × 8 | 413 dir 스캔 × 8 | 0.0001s (캐시) | — |

¹ 개선 전 API 값은 `localhost` 측정 2.00s 에서 아티팩트 0.21s 를 제외한 추정치입니다.
가장 신뢰할 수 있는 수치는 동일 조건 A/B 인 **2.19s → 0.047s** 입니다.

### 부수 효과 — `compare_days` 확장 시

| `compare_days` | window 날짜 수 | 응답 시간 |
|---|---|---|
| 1 | 2 | 0.204s |
| 5 | 6 | **0.043s** |
| 20 | 21 | 0.397s |
| 60 | 61 | 0.713s |

> 60일 비교는 여전히 61개 파티션을 읽으므로 ~0.7s 입니다. 추가 개선이 필요하면
> `compute_top30_matrix()`가 쓰는 **단일 DuckDB 다중파일 쿼리**(`read_parquet([...], union_by_name=true)`)
> 로 통합할 수 있습니다 (읽기 61회 → 1회).

### API 계약

응답 스키마 변경 없음. 개선 후 실측 페이로드:

```json
{
  "date": "2026-09-11", "compare_date": "2026-09-04", "compare_available": true,
  "window_dates": ["2026-09-04","2026-09-07","2026-09-08","2026-09-09","2026-09-10","2026-09-11"],
  "stocks": [ { "code": "005930", "name": "삼성전자", "rank": 1, "previous_rank": 1,
                "rank_delta": 0, "new_entrant": false, "series": [1,1,1,1,1,1] }, ... ]
}
```

---

## 2. 남은 백엔드 병목

### 🔴 P1. `GET /api/charts/wics-rankings` — 0.330초 / 16.4MB

앱 최대 페이로드. `start_month`/`end_month` 미지정 시 **전체 월(수십 년치)** 를 한 번에 반환합니다.
프론트는 통상 최근 구간만 보므로 대부분 낭비입니다.

**개선안**
1. 서버 기본 구간 제한 (weekly 엔드포인트처럼 최근 N개월 기본값).
2. `months` 목록은 경량 엔드포인트(`/api/charts/wics-months`)가 이미 있으므로 랭킹은 구간 필수화 검토.
3. `ORDER BY YearMonth ASC` + 슬라이싱을 SQL `LIMIT`으로 처리.

### 🔴 P1. `GET /api/charts/macro` — 0.287초 / 13.7MB

- 캐시 전무. 요청마다 `series_defs`(약 35개) + `ffill_series`(6개) + ISM/수출 ffill을 개별 SQL로
  조회하고 Python 루프로 merge.
- `async def get_macro_chart_data()` 안에서 `sqlite3.connect()` + 동기 루프 실행 → **이벤트 루프 블로킹**.
- `start_date` 미지정 시 `1980-01-01`부터 전체 구간 반환 → 13.7MB.

**개선안**
1. `macro.db` mtime 키 인메모리 캐시 (`sugeub_utils.py`의 `_cached_result` 패턴 재사용).
   매크로 DB는 평일 18:27 KST 1회 갱신이므로 mtime 무효화로 충분.
2. 기본 조회 구간을 프론트 실제 표시 범위로 제한, 전체 구간은 명시 요청 시에만.
3. `async def` → `def` 전환 (threadpool).

### 🟠 P2. `GET /api/charts/trend-up-breadth` — 0.212초

`etf_krx.parquet`(**74MB**) + krx300 parquet 을 매 요청 재읽기. 캐시 없음.
`stock_heatmap_utils.py`가 이미 `_cache` + `@lru_cache` 패턴을 쓰고 있으므로 동일하게 적용 가능.

### 🟠 P2. 블로킹 `async def` 핸들러 다수 (동시성)

#44 에서 **수급 계열 3개만** `async def` → `def` 로 전환되었고, 나머지는 여전히 `async def`
안에서 sqlite/duckdb/pandas 를 직접 실행합니다.

| 파일 | 블로킹 작업을 하는 `async def` 핸들러 |
|------|----------------------------------------|
| `routers/charts.py` | `get_chart_data`, `get_above_ma_chart_data`, `get_stockbee_mm_data`, `get_trend_up_breadth_endpoint`, `get_macro_chart_data`, `get_valuation_bands`, `get_foreign_flow_chart_data`, `get_market_flow_chart_data`, `get_market_flow_dates`, `get_wics_months`, `get_wics_rankings`, `get_wics_weeks`, `get_wics_weekly_rankings`, `get_wics_index`, `get_wics_index_meta`, `get_wics_index_all` |
| `routers/top30.py` | `list_top30_dates`, `get_top30_matrix`, `get_top30` |

**영향** — FastAPI는 `async def`를 이벤트 루프에서 직접 실행합니다. 핸들러가 0.3초간
sqlite/pandas를 돌리면 **그 시간 동안 다른 모든 요청이 대기**합니다. 단일 요청 지연은 작아도
(wics-rankings 0.33s + macro 0.29s 동시 요청 = 0.62s) 동시성에서 손실이 큽니다.

**개선안** — 시그니처만 `async def` → `def` 로 바꾸면 FastAPI가 threadpool에서 실행합니다.
`await`를 쓰지 않는 핸들러가 대부분이므로 **기계적 변경**이며 동작 변화 없음.
(#44 수급 3건에서 검증됨: 병렬 6요청 1.873s → 0.253s)

### 🟡 P3. 캐시 부재 (0.10 ~ 0.12초)

| 엔드포인트 | 시간 | 비고 |
|------------|------|------|
| `/api/charts/foreign-flow` | 0.115s | `kospi_investor.parquet` 매 요청 재읽기 |
| `/api/charts/wics-index/all` | 0.113s | 2.58MB |
| `/api/stocks/persistent` | 0.113s | 다중 서브쿼리 |
| `/api/charts/wics-index/meta` | 0.104s | 593,740행 `DISTINCT WICS` 스캔 (사실상 정적) |

### 참고 — 이미 잘 되어 있는 부분 (재작업 불필요)

- SQLite `WAL` + `synchronous=NORMAL` + `busy_timeout=5000` (`database.py`) ✅
- `GZipMiddleware(minimum_size=1024)` 전역 적용 ✅
- AVWAP / 수급 mtime 기반 인메모리 캐시 + 앵커 변경 시 무효화 ✅
  (실측: avwap 0.034s, supply-demand 0.018s — 웜 캐시 정상 동작)
- `theme_daily` / `theme_stock_daily` 인덱스 구성 ✅
- 서버 시작 시 초기 동기화를 `asyncio.create_task` + `to_thread`로 백그라운드 처리 ✅

---

## 3. 프론트엔드 병목

### ✅ P0 (완료). `/trend` 코드 스플리팅 — 초기 JS 1,652KB → 741KB

**개선 전 측정** (라이브 `:3000` 에서 재확인)
```
GET /trend  →  JS 청크 13개, 합계 1,691,655 B = 1,652.0 KB (gzip 전)

  811,804 B  f0547499…  ← recharts + d3        (recharts 문자열 83회, ResponsiveContainer/CartesianGrid/BarChart 포함)
  224,632 B  8de41627…  ← trend 컴포넌트
  188,349 B  235fbcb7…  ← lightweight-charts
  156,337 B  092d9d2f…  ← trend 컴포넌트
  112,594 B  a6dad97d…
   79,405 B  6035a956…  ← axios
   (외 7개)
```

**원인** — `src/app/trend/page.tsx`가 **24개 컴포넌트를 전부 정적 import** 합니다.
`next/dynamic`은 `KospiWeatherChart` **단 1개**에만 적용되어 있었습니다.

페이지는 15개 탭을 `activeTab` 조건부 렌더링하므로 **한 번에 하나만 마운트**되지만,
**코드는 전부 초기 번들에 포함**됩니다. 사용자는 탭 하나를 보기 위해 15개 탭 분량의 JS를
모두 다운로드·파싱·실행합니다.

**적용한 변경** — 탭 전용 컴포넌트 **15개**를 `next/dynamic` + **`ssr: false`** 로 전환:

```tsx
const ThemeTrendChart = dynamic(
  () => import("./_components/ThemeTrendChart").then((m) => m.ThemeTrendChart),
  { ssr: false, loading: () => <TabLoading label="테마 RS 추이 차트" /> }
);
```

> ⚠️ **`ssr: false` 는 필수입니다.** 기본값(`ssr: true`)으로 두면 해당 청크가 여전히
> 초기 페이로드에 포함되어 **분할 효과가 0** 입니다. `ssr: false` 일 때만 클라이언트
> 지연 로드로 빠집니다. (→ `Directive:` 참조)

기본 탭(overview)에서 즉시 보이는 `TopThemesBar`, `SurgingThemesCard`,
`StockAnalysisTabs`, `ThemeStocksPanel` 은 **정적으로 유지**했습니다(지연 로드 시 LCP 악화).
`InteractiveChart` 는 `import type` 만 남겨 타입 전용 import 로 모듈이 되돌아오지 않게 했습니다.

**결과**

| 단계 | 초기 JS | 감소 |
|------|---------|------|
| 개선 전 | 1,652.0 KB | — |
| ① `dynamic` + `ssr:false` 15개 | 1,145.4 KB | **−506.6 KB (−30.7%)** |
| ② + recharts 제거 (아래 P1) | **741.4 KB** | **−910.6 KB (−55.1%)** |

런타임 교차검증: 새 빌드가 서빙하는 13개 스크립트 합계 **759,225 B = 741.4 KB** (계산값과 일치),
13개 청크 및 6개 탭 라우트 전부 HTTP 200.

> **배포 완료** — 2026-09-12 20:59 사용자가 `./deploy.sh` 를 직접 실행해 **라이브 반영 완료**.
> 라이브 `:3000` 실측 초기 JS **759,225 B = 741.4 KB** (측정용 빌드 값과 **바이트 단위 일치**).
> 811KB recharts 청크가 초기 페이로드에서 사라졌고 최대 청크는 224,632 B 로 내려갔다.
> 검증: `/trend` 청크 13/13 = 200, `/` 307, `/trend`·`/heatmap` 200,
> 프록시 경유 API 전부 200. (에이전트는 샌드박스 대량삭제 가드 때문에 빌드를 완주할 수 없어,
> **빌드·배포는 사용자가 수행**하는 것으로 운영 규칙을 확정했다.)

### ✅ P1 (완료). recharts 초기 번들에서 제거

`recharts` + `d3` 번들 811KB (전체 JS의 **49%**). 사용처는 3개뿐이었습니다.

| 파일 | 용도 | 처리 |
|------|------|------|
| `TopThemesBar.tsx` | 테마별 RS 가로 막대 (overview 탭) | **recharts 제거 — CSS/flexbox 로 재작성** |
| `ThemeTrendChart.tsx` | 테마 RS 추이 (overview 탭) | `dynamic` 지연 로드로 전환 |
| `MarketCapTop30Panel.tsx` | TOP30 스파크라인 (top30 탭) | `dynamic` 지연 로드로 전환 |

`TopThemesBar` 는 단일 시리즈 가로 막대라 recharts가 과했습니다. 슬라이더(5~30, 기본 10),
`EXCLUDED_THEMES` 필터, RS 기준 색상, 클릭→`onThemeClick`, 호버 툴팁, `stock_count` 라벨,
로딩/에러/빈 상태를 **모두 보존**하고 렌더링만 CSS 로 바꿨습니다.

> **정정** — 초판의 "recharts 811KB" 는 부정확했습니다. 811,804 B 청크는
> **recharts + d3 + 공유 앱 코드**였고, 순수 recharts 는 약 **406KB** 입니다.
> 다만 나머지 공유 코드도 지연 로드 경로로 옮겨가므로 **초기 페이로드에서 811KB 청크가
> 통째로 사라지는 것**은 사실입니다.

**동작 변경 1건 (의도적)** — 막대 순서. 기존 코드는 `sort desc → slice → reverse()` 로
오름차순 배열을 만든 뒤 recharts vertical 레이아웃에 넘겼고, recharts는 첫 항목을 **아래**에
그렸습니다. 결과적으로 **RS가 가장 낮은 테마가 맨 위**에 표시되어 코드 주석
("Reverse so highest is at top") 과 **정반대**로 동작하고 있었습니다.
새 구현은 **RS 높은 순서로 위→아래** 렌더합니다(주석·의도와 일치).
Playwright DOM 실측으로 기존/신규 순서 차이를 확인했습니다.

### 🟡 P2. `React.memo` / `useCallback` 부재

| 컴포넌트 | 행수 | useMemo | useCallback | React.memo |
|----------|------|---------|-------------|------------|
| `AvwapChart.tsx` | 3,684 | 17 | **0** | **0** |
| `MarketCapTop30Panel.tsx` | 1,484 | 15 | **0** | **0** |
| `ReturnComparisonPanel.tsx` | 1,208 | 2 | **0** | **0** |
| `MacroChart.tsx` | 982 | 7 | **0** | **0** |
| `WicsRankingPanel.tsx` | 965 | 15 | **0** | **0** |
| `MarketFlowChart.tsx` | 945 | 4 | **0** | **0** |

`page.tsx`는 `selectedTheme`, `selectedDate`, `source` 등을 단일 상태로 관리하고, 이 값이 바뀌면
**3,684행 `AvwapChart`를 포함한 하위 트리 전체가 리렌더**됩니다. 자식에 전달되는 콜백이
매 렌더 새로 생성되어 `React.memo`가 있어도 무력화됩니다.

### 🟡 P3. Service Worker가 순수 pass-through

`public/sw.js`는 `event.respondWith(fetch(event.request))`로 모든 요청을 그대로 통과시킵니다.
PWA 설치 요건 충족용이며 캐싱 이득이 없습니다.

### 참고 — 잘 되어 있는 부분

- React Query `staleTime: 5분`, `gcTime: 10분`, `refetchOnWindowFocus: false` ✅
- `refetchInterval` / `setInterval` 폴링 **전무** ✅
- `MarketCapTop30Panel`, `WicsRankingPanel`, `AvwapChart` 등에 `useMemo` 적극 사용 ✅
- `.next/standalone` + 정적 자산 복사 배포 파이프라인 정상 ✅

---

## 4. 권장 실행 순서 (개정)

| 단계 | 작업 | 난이도 | 효과 | 상태 |
|------|------|--------|------|------|
| ~~1~~ | ~~`compute_top30()` 파켓 읽기 통합~~ | 낮음 | top30 **2.19s → 0.047s** | ✅ **완료** |
| ~~1~~ | ~~`page.tsx` 탭 컴포넌트 `dynamic` 전환~~ | 낮음 | 초기 JS **1,652KB → 1,145KB** | ✅ **완료** |
| ~~8~~ | ~~recharts 초기 번들 제거~~ | 높음 | 초기 JS **→ 741KB**, recharts 제거 | ✅ **완료** |
| **1** | 블로킹 `async def` → `def` 일괄 전환 | 낮음 | 동시 요청 직렬화 해소 | 대기 |
| **2** | wics-rankings 기본 구간 제한 | 낮음 | 16.4MB → 수 MB | 대기 |
| **3** | macro mtime 캐시 + 구간 제한 | 낮음 | 0.287s → ~0.01s, 13.7MB → 감소 | 대기 |
| **4** | trend-up-breadth / foreign-flow 파켓 캐시 | 중간 | 0.212s / 0.115s → 수십 ms | 대기 |
| **5** | `useCallback` + `React.memo` 적용 | 중간 | 리렌더 비용 감소 | 대기 |
| **6** | SW 정적/API 캐시 전략 | 중간 | 재방문 체감 속도 | 대기 |
| **7** | `ThemeTrendChart` → lightweight-charts 이관 | 높음 | 잔여 recharts 의존 완전 제거 | 대기 |
| (선택) | top30 `compare_days=60` 단일 쿼리화 | 중간 | 0.713s → ~0.05s | 대기 |

---

## 5. 측정 원본 데이터 (정정판, `curl -4 http://127.0.0.1:8000`, 3회 최솟값)

| 엔드포인트 | 시간 | 페이로드 | 초판(localhost) |
|------------|------|----------|------------------|
| `/api/charts/wics-rankings` | **0.330s** | **16.4MB** | 0.61s |
| `/api/charts/macro` | **0.287s** | **13.7MB** | 1.05s |
| `/api/charts/trend-up-breadth?universe=krx300` | **0.212s** | 634KB | 0.88s |
| `/api/stocks/group-action?source=mtt` | 0.149s | 241B | 0.35s |
| `/api/charts/foreign-flow` | 0.115s | 922KB | 0.64s |
| `/api/charts/wics-index/all` | 0.113s | 2.58MB | 0.72s |
| `/api/stocks/persistent?days=5&min=3&source=mtt` | 0.113s | 2.9KB | 0.34s |
| `/api/charts/wics-index/meta` | 0.104s | 1.6KB | 0.80s |
| **`/api/trend/top30`** | **0.043s** ✅ | 5.2KB | **2.00s** |
| `/api/stocks/intersection` | 0.039s | 1.2KB | 0.72s |
| `/api/charts/avwap?market=kospi&interval=1D` | 0.034s | 3.48MB | 1.08s |
| `/api/charts/market-flow` | 0.026s | 2.03MB | 0.23s |
| `/api/charts/valuation-bands?index=kospi&mode=pbr` | 0.023s | 1.17MB | 0.22s |
| `/api/charts/wics-rankings/weekly` | 0.023s | 1.22MB | 0.27s |
| `/api/charts/supply-demand?code=005930` | 0.018s | 4.05MB | 0.87s |
| `/api/trend/top30/matrix` | 0.017s | 98KB | 0.28s |
| `/api/heatmap/stocks?grouping=sector&period=1D&limit=100` | 0.005s | 13.2KB | 0.30s |
| `/api/dates?source=mtt` | 0.004s | 3.7KB | 0.17s |
| `/api/charts/stockbee-mm` | 0.004s | 74KB | 0.18s |
| `/api/charts/market-flow/dates` | 0.002s | 768B | 0.16s |
| `/api/trend/top30/dates` | 0.001s | 5.4KB | 0.17s |
| `/health` | 0.001s | — | — |

> 초판과의 차이는 대부분 `localhost` 아티팩트(~0.21s)입니다. 단, **wics-rankings / macro /
> trend-up-breadth 는 여전히 상위 병목**이며, 이들은 페이로드와 캐시 부재가 실제 원인입니다.

### 데이터 자산 규모

| 자산 | 크기 |
|------|------|
| `~/.cache/db/rs/` | 413개 파티션 × 1.1MB parquet (전수 `part-0.parquet` 존재 확인) |
| `~/.cache/db/stock_master.db` | 503MB (`wics_daily_index` 593,740행) |
| `~/.cache/db/etf_krx.parquet` | 74MB |
| `backend/db/trends.sqlite` | 42MB |
| `backend/data/` | HTML 560개 |

---

## 6. 검증 절차 (재현용)

```bash
# 1) 개선 전 소스 추출
git show HEAD:backend/app/utils/top30_utils.py > /tmp/top30_old.py

# 2) 동등성 + 성능 검증 (별도 모듈로 로드해 deep JSON 비교)
backend/.venv/bin/python /tmp/verify_top30.py

# 3) API 측정 — localhost 대신 127.0.0.1 사용 (IPv6 폴백 아티팩트 회피)
curl -4 -s -o /dev/null -w "ttfb=%{time_starttransfer}s total=%{time_total}s\n" \
  "http://127.0.0.1:8000/api/trend/top30"
```

---

## 7. 진행 상황 및 다음 단계 (2026-09-12 21:30 기준)

### 완료

| # | 항목 | 결과 | 커밋 |
|---|------|------|------|
| 1 | `compute_top30()` N+1 파켓 읽기 | 2.19s → **0.047s** (46배), 파켓 읽기 180 → 6회 | `0e89a0a` |
| 2 | `/trend` 코드 스플리팅 (`dynamic` + `ssr:false` 15개) | 초기 JS 1,652.0 → 1,145.4 KB | `9dae02a` |
| 3 | recharts 초기 번들 제거 (`TopThemesBar` 재작성 + 2개 지연 로드) | → **741.4 KB** (−55.1%) | `9dae02a` |
| 4 | **프로덕션 배포** | 라이브 `:3000` 실측 **759,225 B = 741.4 KB** (바이트 단위 일치) | — (사용자 실행) |
| 5 | **P2** 블로킹 `async def` → `def` **12개** | 이벤트 루프 직렬화 해소 (검증 완료, 배포 대기) | 미커밋 |

- 커밋 2건은 **미푸시** 상태 (`origin/main` 대비 ahead 2).
- **P2 변경은 워킹트리에 미커밋** — 배포 대기.
- 이슈 **#50** OPEN (`performance` 라벨).

### 남은 병목 — 2026-09-12 21:00 재측정 (`curl -4 http://127.0.0.1:8000`, 3회 최솟값)

| 순위 | 대상 | 실측 | 페이로드 |
|------|------|------|----------|
| **P1** | `GET /api/charts/wics-rankings` | **0.316s** | **15.6MB** |
| **P1** | `GET /api/charts/macro` | **0.280s** | **13.0MB** |
| **P2** | `GET /api/charts/trend-up-breadth?universe=krx300` | 0.221s | 619KB |
| **P3** | `foreign-flow` / `wics-index/all` / `persistent` / `wics-index/meta` | 0.100 ~ 0.113s | — |
| **P3** | `React.memo` / `useCallback` 부재 | 0건 | — |
| (선택) | top30 `compare_days=60` 단일 쿼리화 | 0.713s → ~0.05s | — |

### ✅ 완료 — P2: 블로킹 `async def` → `def` **12개** 전환

**전수 조사 정정** — 최초 보고는 11개였으나 스캐너가 **본문에 중첩 `def` 헬퍼를 가진**
핸들러(`get_macro_chart_data`)를 놓쳤다. 실제 대상은 **12개**다.
`get_foreign_flow_chart_data` 는 블로킹 IO 를 동기 헬퍼(`load_foreign_flow_data`)에
위임하므로 휴리스틱에 안 걸렸지만 동일한 문제였다.

```
라우트 핸들러 41개
  ├─ async def          28개  →  16개   (12개 전환)
  └─ def (threadpool)   13개  →  25개
블로킹 async def (await 0회):  11개 →   0개
```

- 변경: `backend/app/routers/charts.py` **12줄** — `async def` → `def` 만, 다른 줄 무변경.
  `git diff` 검증: added 12 / removed 12, 전부 `async def X(` → `def X(` 패턴 일치.
- 대상: `get_macro_chart_data`, `get_valuation_bands`, `get_foreign_flow_chart_data`,
  `get_market_flow_chart_data`, `get_market_flow_dates`, `get_wics_months`, `get_wics_rankings`,
  `get_wics_weeks`, `get_wics_weekly_rankings`, `get_wics_index`, `get_wics_index_meta`,
  `get_wics_index_all`
- **효과**: 단일 요청 지연은 그대로지만, 블로킹 IO 가 이벤트 루프를 점유해
  **다른 모든 요청을 직렬화하던 문제**가 사라진다. 프론트가 탭 전환 시 여러 API 를
  동시에 호출하는 구조라 체감 효과가 크다.
- **위험**: 낮음. 시그니처 1단어 변경, 로직·반환값 불변.
  `async def` → `def` 는 FastAPI 가 threadpool 로 보내는 표준 동작이다.

**검증 (2026-09-12)**

| 검증 | 방법 | 결과 |
|------|------|------|
| 응답 동등성 | `httpx.ASGITransport`(lifespan 미기동) 로 변경 전/후 13개 요청 sha256 비교 | **13/13 동일** |
| macro 동등성 | 라이브 구코드 서버 응답과 sha256 비교 (2개 케이스) | **MATCH** |
| 백엔드 테스트 | `.venv/bin/pytest tests/ -q` | **226 passed** |
| 잔여 스캔 | 블로킹 `async def` (await 0회) 전수 조사 | **0개** |

> ⚠️ **pytest 실행 시 `TMPDIR` 를 워크스페이스 안으로 지정할 것.** 기본 temp 경로
> (`/private/var/folders/...`)는 샌드박스 브로커가 `mkdir` 을 막아 **226건 전부 ERROR** 가 된다.
> ```bash
> cd backend && TMPDIR="$PWD/.pytest-tmp" .venv/bin/pytest tests/ -q
> ```

**다음 후보**: P1 `wics-rankings`(기본 구간 제한 + mtime 캐시) → P1 `macro`(mtime 캐시 + 구간 제한)
→ P2 `trend-up-breadth` 파켓 캐시.

### 운영 규칙 (확정)

- **빌드·배포는 에이전트가 실행하지 않는다.** 필요 시 사용자에게 실행을 요청한다.
  (에이전트는 샌드박스 대량삭제 가드 때문에 Next.js 빌드를 완주할 수 없다.)
- 커밋과 푸시는 **각각 별도의 명시적 지시**가 있을 때만 수행한다.
