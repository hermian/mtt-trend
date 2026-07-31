# 01-Plan: 한국 주식 히트맵

## Executive Summary
easyinvesting.app/#/heatmap 과 동일한 형태의 한국 주식 히트맵을 mtt-trend에 추가한다. 섹터/업종/테마 그룹별 트리맵, 6개 기간 수익률, 시가총액 필터, 표시 개수 필터를 제공한다.

## Context Anchor
| Dimension | Content |
|-----------|---------|
| WHY | 보유 유니버스의 섹터·업종·테마별 상대 강도와 수익률을 한 화면에서 회전매/자금 이동 파악용으로 모니터링 |
| WHO | RS 기반 한국 주식 투자자 (mtt-trend 기존 사용자) |
| RISK | 극단 수익률 종목(스팩성 +700% 등)이 색상 스케일을 왜곡; 시가총액 단위 혼동(파켓 Marcap=천억원) |
| SUCCESS | `/heatmap` 에서 그룹·기간·시총·개수 필터가 즉시 전환되고, 트리맵 박스 크기가 ∛(시가총액)에 비례하며, 수익률 색상이 중립 구간 기준으로 올바르게 표시 |
| SCOPE | 백엔드 `GET /api/heatmap/stocks`, 프론트엔드 `/heatmap` 페이지 + 사이드바 진입점. 미국/ETF 확장, KRX 27섹터 분류는 범위 외 |

## 1. Requirements
* **백엔드 (FastAPI)**:
  - 최신 `~/.cache/db/rs/date=*/part-0.parquet` 에서 Code/Name/Market/Sector/WICS/테마/Marcap/RS_Rating 로드.
  - `stock_price.duckdb` 일별 종가로 6기간 수익률 계산 (영업일 1/5/21/63/126/252, rn=N+1 — parquet `28DChange`와 교차 검증됨).
  - 시가총액 필터(억원), 상위 N 제한, 그룹화(sector/industry/theme — 테마는 콤마 분할 중복 소속).
  - 인메모리 캐시 (파티션 날짜/가격 DB mtime 변경 시 무효화).
* **프론트엔드 (Next.js)**:
  - `/heatmap` 라우트, 사이드바 "주식 히트맵" 진입점.
  - 컨트롤: 그룹(섹터/업종/테마), 기간(1일/5일/1M/3M/6M/12M), 시총(전체/1000억+/5000억+/1조+/5조+/직접입력), 개수(상위50/상위100/전체).
  - SVG squarified 트리맵: 그룹 박스(이름+수익률+RS 헤더) 내부에 종목 박스, 면적 ∝ ∛(시가총액).
  - 색상: 상승=빨강/하락=파랑(한국 관례), 중립 구간 회색, 경계는 p2/p98 백분위(이상치 포화).
  - 호버 툴팁(종목 상세), 클릭 시 네이버 금융 새 탭.

## 2. Risk Management
* **색상 왜곡**: 경계를 min/max 대신 p2/p98 백분위로 산정 → 이상치는 최진한 색 포화.
* **단위 혼동**: parquet Marcap(천억원)을 로드 시 억원으로 변환, API/UI는 억원 단일 단위.
* **성능**: 베이스 프레임 1회 계산 캐싱(콜드 0.25s, 웜 <5ms), 파라미터별 재그룹화는 인메모리.

## 3. Success Criteria
1. `GET /api/heatmap/stocks` 가 모든 grouping/period 조합에서 올바른 JSON 반환 (합성 데이터 테스트 8건).
2. `/heatmap` 에서 2,423종목 전체 렌더링, 필터 전환 즉시 반영.
3. squarify 순수 함수 테스트: 면적 비례·무겹침·경계 내 배치.
