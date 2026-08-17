# Deep Interview Spec: 시총 TOP 30 추적 대시보드 탭

## Metadata
- Interview ID: 01a00d0b-85b9-7000-a23f-a2c32aeaba04
- Rounds: 8
- Final Ambiguity Score: 18.25%
- Type: brownfield
- Generated: 2026-08-17
- Threshold: 0.05
- Threshold Source: default
- Initial Context Summarized: no
- Status: PASSED (사용자 승인 하에 잔여 모호성 수용 — 기준 임계 5% 초과, 실행 승인은 별도)
- Auto-Researched Rounds: none
- Auto-Answered Rounds: none
- Architect Failures: 0
- Lateral Reviews: 2 (round 2 initial→progress, round 7 progress→refined)
- Lateral Panel Failures: 2 (서브에이전트 미가용 → 내부 반박자/단순화 관점으로 대체 반영)
- Refined Rounds: none
- Closure Overrides: none
- Restated Goal: 시가총액 상위 30 랭킹(시장 필터: 전체/KOSPI/KOSDAQ)을 기준일 기준으로 계산하고, 사용자가 선택한 비교 기간(기본 5거래일, 옵션 1/5/20/60) 대비 신규 진입·순위 변동(순위 5단계 이상=큰 상승 강조, 하락=붉은색 경미)을 순위 흐름 계단식 라인차트(기본)와 표 토글로 추적하는 새 대시보드 탭을 백엔드 API + 프론트엔드로 추가한다.

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.85 | 0.35 | 0.2975 |
| Constraint Clarity | 0.80 | 0.25 | 0.2000 |
| Success Criteria | 0.80 | 0.25 | 0.2000 |
| Context Clarity | 0.80 | 0.15 | 0.1200 |
| **Total Clarity** | | | **0.8175** |
| **Ambiguity** | | | **0.1825 (18.25%)** |

## Topology
| Component | Status | Description | Coverage / Deferral Note |
|-----------|--------|-------------|--------------------------|
| ranking-api (시총 랭킹 계산 API) | active | 기준일 시가총액 상위 30 종목 랭킹과 비교일 대비 순위 변동(신규 진입/순위 상승)을 계산하는 백엔드 엔드포인트와 테스트 | 수용 기준(아래) 커버 완료: 시장 필터 재계산, rank_delta/new_entrant, 비교 기간 연동, pytest |
| top30-tab-ui (대시보드 탭 UI) | active | 차트 기본 + 표 선택 토글을 갖춘 새 대시보드 탭(사이드바 라우트)으로 신규 진입/순위 상승을 하이라이트 표시 | 순위 흐름 계단식 라인차트(기본), movers 강조(5단계 이상), 표 토글 + 선택기 연동 커버 |

## Established Facts
1. `fact-ui-chart-default` (round 0) — 대시보드 탭은 차트를 기본 뷰로 하고 표로 전환 가능한 토글 제공.
2. `fact-compare-window` (round 1) — 신규 진입/순위 변동 비교 기준일을 사용자가 드롭다운으로 선택 가능.
3. `fact-market-filter` (round 3) — 시장 범위는 사용자가 전체/KOSPI/KOSDAQ 필터로 선택 가능.
4. `fact-signal-semantics` (round 4) — 신규진입 = 비교일 TOP30 밖 → 기준일 TOP30 안(재진입 포함), 순위상승 = 양쪽 모두 TOP30 안에서 순위 상승, 하락/유지는 그 외.
5. `fact-default-window` (round 5) — 비교 기간 기본값 = 최근 5거래일, 옵션 {1, 5, 20, 60} 드롭다운.
6. `fact-acceptance-criteria` (round 6) — 아래 Acceptance Criteria 승인.
7. `fact-chart-rankflow` (round 2) — 기본 뷰는 순위 흐름 계단식 라인차트(순위 1~30, 상승 시 위로), 신규 진입/급등 색 강조, 표 뷰는 토글.
8. `fact-chart-emphasis` (round 7) — 30개 라인 모두 표시, movers(신규 진입 + 큰 상승)만 굵고 밝게, 나머지 얇고 저채도, 호버 툴팁/범례 공통.
9. `fact-threshold` (round 8) — 순위 5단계 이상 상승만 '큰 상승'으로 강조, 신규진입 항상 강조, 하락 붉은색 경미.
10. `fact-data-history` (round 7) — 시가총액 데이터는 ~/.cache/db/rs 일별 파티션(2025-01-02 ~ 2026-08-14, 394일) Marcap, 결측 없음, KOSPI/KQ 시장 존재.

## Trigger Metadata
- 라운드 전반에 **트리거 없음** (직접 모순/내부 불일치/회피/범위 확장 없음). 일관된 감소세 기록.
- Ambiguity: 1.00(초기) → 0.635 → 0.5925 → 0.53 → 0.5125 → 0.4875 → 0.3375 → 0.2375 → **0.1825**.
- 주관적 스코러 raw 대비 runtime floor(clamp) 초과 없음: 분쟁 사실 0건, 미채점 컴포넌트 0건, auto-answer 희석 0건.

## Lateral Review Panel
- **round 2 (initial→progress):** 프로gress 전환. contrarian/simplifier 관점 반영 — 30개 계단 라인 겹침 방지를 위해 색 구분+호버, movers만 강조·나머지 저채도 축소 필요. (round 7에서 실현)
- **round 7 (progress→refined):** movers 강조 임계('큰 상승') 정의 필요, 하락은 붉게 경미 표시, 탭 라우트/라벨 확정 필요. (round 8에서 실현)
- `lateral_panel_failures = 2`: 현재 환경에 서브에이전트 미가용이어서 패널은 병렬 스폰 대신 동일 관점을 직접 질문에 반영.

## Goal
시가총액 상위 30 랭킹(시장 필터: 전체/KOSPI/KOSDAQ)을 기준일 기준으로 계산하고, 사용자가 선택한 비교 기간(기본 5거래일, 옵션 1/5/20/60) 대비 신규 진입·순위 변동(순위 5단계 이상=큰 상승 강조, 하락=붉은색 경미)을 순위 흐름 계단식 라인차트(기본)와 표 토글로 추적하는 새 대시보드 탭을 백엔드 API + 프론트엔드로 추가한다.

## Constraints
- 시가총액 상위 **정확히 30개**를 내림차순으로 노출 (Marcap **천억원 단위** 표시, 항상 시총 클수록 1위).
- 시장 필터: `전체 / KOSPI / KOSDAQ(KQ)` — 필터별로 해당 시장의 상위 30을 재계산.
- 비교 기간: 드롭다운 {1, 5, 20, 60} 거래일, 기본 5거래일. 기준일 = 선택 조회일, 비교일 = N거래일 이전.
- 차트 기본 뷰: 순위 흐름 계단식 라인차트(30개 라인, 상승 시 y 위로). movers만 굵고 밝게, 나머지 얇고 저채도. 호버 툴팁(종목명/순위/시총) + 범례 포함.
- movers 강조: 신규 진입 항상 강조, 순위 5단계 이상 상승 = '큰 상승' 강조, 하락은 붉은색 경미 표시.
- 표 토글: 차트 기본에서 표로 전환, 순위 ▲▼/신규 진입 배지 표시.
- 신규 진입/순위 변동 계산은 기준일·비교일 두 스냅샷의 Marcap 랭킹 비교.
- Marcap null 종목은 랭킹 계산에서 제외.
- 비교일 파티션 부재(데이터 경계 이탈) 시 순위변동/신규진입 정보 없이 TOP30 랭킹만 graceful 반환 (가정).
- 새 탭 라우트 `?tab=top30`, 사이드바 라벨 **"시총 TOP 30"** (가정, 스펙 승인 시 확정).
- 기존 trend 탭/날짜 선택기/사이드바/백엔드 테스트 컨벤션 재사용.

## Non-Goals
- 주가/시가총액 **수집 파이프라인 변경 없음** — 기존 ~/.cache/db/rs 파티션만 읽음.
- 자동매매·리밸런싱·포트폴리오 실행 로직 포함 안 함.
- 시총 외 지표(수익률 순위 등) 추가 랭킹 없음.
- 미국 주식 등 해외 시장 미포함.

## Acceptance Criteria
- [ ] 기준일 선택 시가총액 내림차순 **상위 정확히 30개** 반환 (Marcap 천억원 단위 노출)
- [ ] 각 종목에 비교일 대비 **순위 변동(rank_delta)**, **신규 진입 여부**, **이전 순위** 포함
- [ ] 시장 필터(전체/KOSPI/KOSDAQ) 적용 시 해당 시장 상위 30으로 재계산
- [ ] 비교 기간 선택({1,5,20,60}) 시 해당 N거래일 이전 TOP30과 비교
- [ ] 백엔드 pytest 단위/API 테스트(Marcap null, 시장 필터, 신규 진입 판정 경계) 통과
- [ ] 새 사이드바 탭 라우트가 **순위 흐름 계단식 라인차트(기본)** 렌더 — 상승 시 위로, 신규진입/급등(5단계↑) 색 강조
- [ ] 표 뷰 토글로 전환 가능, 순위 ▲▼/신규 진입 배지 표시
- [ ] 날짜/시장/비교기간 선택기가 백엔드와 연동

## Deferrals
- 사용자 확정 토폴로지 연기는 **없음** (두 컴포넌트 모두 active).
- Convergence Pacing: 최소 라운드 수/점수 상승 제한/감쇠 없음 — **양방향 스코어링이 유일한 페이싱 메커니즘**.

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 표로 보여줄 것 | 표보다 차트 선호? | 차트 기본 + 표 토글 (round 0) |
| 30개를 한 번에 어떻게 | 라인 겹침 가독성 | 순위 흐름 계단식 라인, movers 강조·나머지 저채도 (round 2, 7) |
| 비교 기준일 | 몇 일 대비? | 사용자 선택 드롭다운, 기본 5거래일 (round 1, 5) |
| 시장 범위 | KOSPI 만? 전체? | 전체/KOSPI/KOSDAQ 필터 선택 (round 3) |
| 신규진입 vs 상승 정의 | 혼동 가능 | 표준 정의: 비교일 밖→기준일 진입(재진입 포함) / 양쪽 TOP30 내 상승 (round 4) |
| '큰 상승' 기준 | 임계 불명 | 순위 5단계 이상 (round 8) |
| 데이터 가용성 | 과거 시총 이력? | RS 파티션 394일 확보, 결측 없음 (context 검증) |

## Technical Context
**brownfield — 백엔드 (FastAPI, `backend/`)**
- SQLite + duckdb 기반. 시총 랭킹 전용 엔드포인트는 현재 없음(신규 생성 필요: 예 `GET /api/trend/top30?market=all&date=YYYY-MM-DD&compare_days=5`).
- 시가총액 소스: `~/.cache/db/rs/date=YYYY-MM-DD/*.parquet` — 컬럼 `Code, Name, Market, Sector, WICS, 테마, Marcap`(천억원). 검증 결과 394개 파티션(2025-01-02~2026-08-14), Marcap 전 기간 결측 없음, `KOSPI`(773) + `KQ`-KOSDAQ(1637) 시장.
- 계산: 두 파티션(기준일/비교일)을 읽어 시장 필터 내 Marcap 내림차순 랭킹 산출 → rank_delta, previous_rank, new_entrant 플래그. duckdb 로딩은 `stock_heatmap_utils.py` 패턴 재사용.
- 테스트: `backend/tests/` pytest, `conftest.py` 픽스처 사용.

**frontend (Next.js App Router, `frontend/`)**
- 탭 시스템: `src/app/_components/Sidebar.tsx`가 `?tab=...` 링크 렌더, `src/app/trend/page.tsx`가 `activeTab` 파싱 + 탭 컴포넌트 선택. 새 탭 `?tab=top30` + 사이드바 항목 "시총 TOP 30" 추가.
- 차트: `recharts`(계단식 다중 시리즈 Line `type="step"`) 적합, `lightweight-charts`도 존재. 기존 `InteractiveChart`/`WicsRankingPanel` 패턴 재사용.
- 데이터: `@tanstack/react-query`, axios. 날짜 선택기(useDates) 및 시장/비교기간 선택기 연동.

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Stock | core domain | Code, Name, Market, Marcap, rank, rank_delta, previous_rank, new_entrant | Stock is ranked in Ranking |
| Ranking | core domain | market_filter, compare_days, reference_date, compare_date | Ranking contains Stock (top 30) |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 2 | 2 | - | - | N/A |
| 2 | 2 | 0 | 0 | 2 | 100% |
| 3 | 2 | 0 | 0 | 2 | 100% |
| 4 | 2 | 0 | 0 | 2 | 100% |
| 5 | 2 | 0 | 0 | 2 | 100% |
| 6 | 2 | 0 | 0 | 2 | 100% |
| 7 | 2 | 0 | 0 | 2 | 100% |
| 8 | 2 | 0 | 0 | 2 | 100% |

핵심 엔터티 `Stock`(시총, 순위, 변동)과 `Ranking`(시장 필터/비교기간)로 1라운드부터 수렴, 전 구간 Stability 100%.

## Interview Transcript
<details>
<summary>Full Q&A (8 rounds)</summary>

### Round 1 (Goal, ranking-api) — Ambiguity 100% → 63.5%
**Q:** 신규 진입/순위 상승을 판단하는 비교 기준창은?
**A:** 비교 기간을 사용자가 드롭다운으로 선택 가능 (기본 몇 일, separately 확정).

### Round 2 (Constraints, top30-tab-ui) — 63.5% → 59.3%
**Q:** 30개 종목을 한 화면에서 쉽게 보는 차트 기본 뷰 표현 방식은?
**A:** 순위 흐름 계단식 라인차트 — 각 순위(1~30, 상승 시 위로)를 시간 따라 라인으로, 신규 진입·급등 색 강조.

### Round 3 (Constraints, ranking-api) — 59.3% → 53%
**Q:** 시가총액 상위 30 랭킹의 시장 범위는?
**A:** 시장 범위도 사용자 선택 가능 — 전체/KOSPI/KOSDAQ 필터.

### Round 4 (Goal, ranking-api) — 53% → 51.3%
**Q:** 신규 진입 vs 순위 상승의 정확한 정의?
**A:** 표준 정의 — 신규진입 = 비교일 TOP30 밖→기준일 진입(재진입 포함), 순위상승 = 양쪽 모두 TOP30 안에서 순위 상승.

### Round 5 (Constraints, ranking-api) — 51.3% → 48.8%
**Q:** 비교 기간 드롭다운의 기본값과 옵션은?
**A:** 기본 = 최근 5거래일, 옵션 {1, 5, 20, 60}.

### Round 6 (Criteria, ranking-api) — 48.8% → 33.8%
**Q:** 완료로 판단할 수용 기준(위 Acceptance Criteria) 확인.
**A:** 네, 이 기준으로 완료를 판단합니다.

### Round 7 (Goal, top30-tab-ui) — 33.8% → 23.8%
**Q:** 순위 흐름 라인차트 기본 화면의 강조 구성은?
**A:** 30개 라인 모두 표시, movers(신규진입+큰 상승)만 굵고 밝게, 나머지 얇고 저채도. (호버 툴팁/범례 포함)

### Round 8 (Constraints, top30-tab-ui) — 23.8% → 18.3%
**Q:** movers 강조 임계('큰 상승')는?
**A:** 순위 5단계 이상 상승만 강조, 신규진입 항상 강조, 하락은 붉은색 경미.

(이후 Restate Gate: 한 문장 목표 사용자 승인 → 스펙 결정.)
</details>
