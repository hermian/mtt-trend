# 01-Plan: WICS Index Explorer (주도섹터 탐색 탭)

## Executive Summary
모든 WICS 섹터 지수를 한 화면에 오버레이하고, **보이는 구간의 왼쪽 끝=100으로 항상 rebase**하여 구간 상대강도를 탐색하는 전용 탭을 추가한다. 목표는 12개월 고정 랭킹이 아닌, 사용자가 고른 창(window)에서 **누가 주도했는지**를 시각적으로 찾는 것이다.

기존 `wics_ranking` 탭의 셀 클릭 단건 차트는 **그대로 유지**한다 (역할 분리).

## Context Anchor
| Dimension | Content |
|-----------|---------|
| WHY | 구간을 바꾸며 주도섹터를 찾기 위해 — 고정 12m 랭킹만으로는 “지금 창”의 상대강도가 안 보임 |
| WHO | 섹터 로테이션·모멘텀을 보는 MTT Trend 사용자 |
| RISK | 79개 라인 스파게티, 줌/팬 시 rebase 비용, 전구간 fetch 부하 |
| SUCCESS | 휠/드래그로 창을 바꿔도 좌단=100이 유지되고, Top-N·클릭·리더보드로 주도 섹터를 수초 내 식별 |
| SCOPE | 신규 탭 `wics_index`, bulk/window API, 오버레이 차트+리더보드, 일/주/월·라인/캔들. screener DB `wics_daily_index` 소비 (생산은 screener#228) |

## 의존성
- Producer: [hermian/screener#228](https://github.com/hermian/screener/issues/228) — `stock_master.db.wics_daily_index`
- 기존 Phase 1 (유지): [mtt-trend#8](https://github.com/hermian/mtt-trend/issues/8) 랭킹 탭 단건 차트 — **회귀 금지**

## 1. Requirements

### 1.1 UX / 탭
- 사이드바에 **WICS Index** (가칭) 탭 추가. `?tab=wics_index`
- 기본: 전 섹터 라인은 **ghost(저채도)**. **창 끝 수익률 Top-N(기본 5)** 만 색+라벨
- `전체 표시` 토글: ghost 없이 전 섹터 동등 표시(선택)
- **클릭**: 해당 섹터 full opacity + 라벨/범례. 나머지 fade. 재클릭 해제
- **다중 선택**(⌘/Ctrl+클릭): 비교용 2~N개 유지 (선택 구현, 권장)
- **범례 Toggle**: 선택(또는 Top-N) 섹터명 + **창 구간 수익률(%)** 표시 on/off
- 우측 **리더보드**: 현재 visible range 수익률 정렬 리스트. 행 클릭=차트 하이라이트 동기화
- **벤치마크 1줄**(권장): KOSPI 또는 전 섹터 EW — 동일하게 좌단=100 rebase. “시장 대비” 감각

### 1.2 줌 / 팬 / Rebase (핵심)
- 마우스 휠: 기간 확대·축소
- 드래그: 좌우 이동(팬). 필요 시 창 밖으로 데이터 window(윈도우 fetch)
- `visibleLogicalRange` 변경 시마다:
  1. 보이는 첫 봉의 지수를 섹터별 base로 삼아
  2. 전 시리즈를 `(value / left) * 100` 으로 재계산
  3. 다시 setData
- **항상 차트 왼쪽 = 100** (절대 저장값 유지, rebase는 표시 전용)

### 1.3 주기 / 차트 타입
- 주기: **일 | 주 | 월**
- 타입: **라인 | 캔들**
  - 주/월 집계(일별 지수 → OHLC): Open=구간 첫, High=max, Low=min, Close=구간 끝
  - 탐색 기본값: **일 + 라인**

### 1.4 API
- 기존 `GET /api/charts/wics-index?wics=` 유지 (랭킹 탭용)
- 추가:
  - `GET /api/charts/wics-index/all?start_date=&end_date=&tf=D|W|M`
    - 응답: 섹터별 시계열 (라인: `{date, close}` 또는 캔들용 OHLC)
  - (선택) `GET /api/charts/wics-index/meta` — 섹터 목록, 날짜 min/max
- 초기 로드: 최근 N봉(예: 일 252 / 주 104 / 월 60). 팬 시 인접 윈도우 추가 fetch

### 1.5 Out of Scope (이번 스펙)
- screener 쪽 지수 산출 변경
- 랭킹 탭 UI 변경(단건 차트 유지)
- 백테스트/매매 시그널 자동 생성

## 2. Risk Management
| Risk | Mitigation |
|------|------------|
| 79라인 가독성 | 기본 Top-N 강조 + ghost; 리더보드 병행 |
| rebase마다 전체 setData | 보이는 포인트만 유지; debounce 16~50ms |
| 전기간 fetch | 윈도우 페이징; tf 집계는 서버 또는 클라 다운샘플 |
| 벤치마크 데이터 부재 | KOSPI는 macro/기존 차트 DB; 없으면 전 섹터 EW로 대체 |

## 3. Success Criteria
1. `?tab=wics_index`에서 전 섹터 오버레이 + Top-N 기본 강조가 동작한다.
2. 휠/드래그 후 **좌단 값이 항상 100**으로 보인다.
3. 클릭(및 리더보드)으로 섹터 식별·fade가 동작하고 범례 Toggle이 동작한다.
4. 일/주/월 × 라인/캔들 전환이 동작한다.
5. 기존 `wics_ranking` 단건 차트·API가 깨지지 않는다.

## 4. 구현 순서 (권장)
1. Plan/Design 확정 (본 문서)
2. API `wics-index/all` + tf 집계 + 테스트
3. 탭·사이드바·기본 오버레이 + 좌단 rebase
4. Top-N / 클릭 fade / 범례 / 리더보드
5. 일주월·라인캔들 · 윈도우 fetch
6. 벤치마크 라인 (있으면)
