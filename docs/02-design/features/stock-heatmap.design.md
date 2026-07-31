# 02-Design: 한국 주식 히트맵

## System Architecture

```
[ Frontend /heatmap (Next.js) ]
       │  ▲
       │  │ GET /api/heatmap/stocks?grouping=&period=&marcap_min=&marcap_max=&limit=
       ▼  │
[ Backend (FastAPI) routers/heatmap.py ]
       │
       └─► utils/stock_heatmap_utils.py
             ├─► ~/.cache/db/rs/date=*/part-0.parquet  (유니버스·속성·시총·RS)
             └─► ~/.cache/db/stock_price.duckdb        (기간 수익률, ATTACH READ_ONLY)
```

## 1. Data Contract

### GET `/api/heatmap/stocks`
* **Query Params**: `grouping` (sector|industry|theme, 기본 sector), `period` (1D|5D|1M|3M|6M|12M, 기본 1M), `marcap_min`/`marcap_max` (억원), `limit` (0=전체).
* **Response**: `StockHeatmapResponse` — `as_of_date`, `stock_count`, `groups[] {name, stock_count, avg_return, rs, weight, stocks[] {code, name, market, marcap, ret, rs, weight}}`.
* `weight = ∛(marcap)` — 트리맵 면적 가중치. 그룹 weight = 구성종목 합. 모두 weight 내림차순.
* `avg_return` = 단순평균, `rs` = RS_Rating 평균 반올림.

## 2. Backend Design

### 데이터 소스 매핑
| 그룹 버튼 | parquet 컬럼 | 값 |
|-----------|--------------|-----|
| 섹터 | `Sector` | 10대 섹터 (IT, 산업재, …) |
| 업종 | `WICS` | 79 WICS 산업 |
| 테마 | `테마` | 콤마구분 인포스탁 테마 (중복 소속) |

### 수익률 계산
`stock_price.duckdb` 를 READ_ONLY ATTACH 후 종목별 `ROW_NUMBER() OVER (ORDER BY 날짜 DESC)`:
`ret(N) = (close[rn=1] - close[rn=N+1]) / close[rn=N+1] × 100`.
검증: parquet `28DChange` == rn=29 계산값 (삼성전자 -42.48 ≈ -42.5).

### 캐싱
모듈 레벨 `_cache` + lock. 키 = (최신 파티션 날짜, stock_price.duckdb mtime).
베이스 프레임(2,400행 × 6기간) 1회 구축 후 요청별 필터/그룹화는 인메모리. 콜드 0.25s, 웜 <5ms.

### 단위
parquet `Marcap` 은 **천억원** → 로드 시 ×1000 으로 억원 변환. API/UI 전부 억원.

## 3. Frontend Design

### 라우트/컴포넌트
```
app/heatmap/
  page.tsx                 — 상태(컨트롤) + react-query(useStockHeatmap) + 조립
  _components/ControlBar   — 그룹/기간/시총칩+직접입력/개수 버튼
  _components/Legend       — p2/p98 그라디언트 범례 + 중립 안내
  _components/TreemapChart — SVG squarified 트리맵 + 툴팁 + 네이버 링크
  _lib/treemap.ts          — squarify 순수함수 (Bruls et al.)
  _lib/colors.ts           — 상승 빨강/하락 파랑, 중립 ±테이블, p2/p98 경계
  _lib/format.ts           — 조/억 단위, 수익률 포맷
```

### 트리맵
외부: 그룹 weight로 squarify → 그룹 박스. 내부: 헤더 스트립(22px, 박스 충분히 클 때만) 제외 영역에 종목 weight로 squarify. 라벨은 박스 크기 임계값 기반 단계 표시(이름/수익률).

### 색상 스케일
- 중립: 기간별 고정 (1D ±1.0 … 12M ±13.0) → 회색.
- 경계: 표시 종목 수익률의 p2/p98 (이상치는 최진한 색 포화) — easyinvesting 방식.
- 한국 관례: 상승 빨강(254,226,226 → 153,27,28), 하락 파랑(219,234,254 → 30,64,175).

## 4. Test Strategy
* 백엔드 `tests/test_api_heatmap.py`: 합성 parquet 2파티션 + 합성 가격 duckdb (환경변수 주입). 기간 수익률 공식, 최신 파티션 선택, 테마 중복, 시총 필터 단위, limit, 400 검증. 8건.
* 프론트엔드 `app/heatmap/__tests__/`: squarify (면적 비례·무겹침·경계·균등 비율), 색상 (중립/경계/포화/범례 stops), 포맷. 19건.
