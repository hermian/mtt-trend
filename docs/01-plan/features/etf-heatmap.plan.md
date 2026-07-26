# 01-Plan: ETF Heatmap Dashboard (Issue #11)

## Executive Summary
본 계획은 스노우볼72의 ETF 대시보드와 동일한 레이아웃과 뷰를 제공하는 ETF 히트맵 대시보드를 `mtt-trend`에 구현하는 것을 목표로 합니다. 한국 ETF 탭을 먼저 구성하고, 추후 미국 및 세계 ETF 탭을 연동할 수 있도록 Next.js의 탭 구조와 기간 필터(1D, MTD, YTD 등)를 구축합니다.

## Context Anchor
| Dimension | Content |
|-----------|---------|
| WHY | 개인 연금저축/ISA 계좌에서 투자 가능한 한국 상장 ETF들의 자산군별/국내섹터별 상대 성과를 한눈에 모니터링하여 자산배분 기회를 포착 |
| WHO | 국내 상장 ETF를 중심으로 자산배분 및 순환매 투자를 진행하고자 하는 사용자 |
| RISK | ETF 종목별로 기간 수익률(MTD, YTD 등) 데이터가 비어있거나 불일치하여 히트맵 색상이 왜곡될 위험 |
| SUCCESS | 스노우볼72와 동일한 테마 그룹 및 그리드 형태로 한국 ETF 수익률 히트맵이 정상 출력되고, 기간 필터 및 툴팁이 버벅임 없이 작동함 |
| SCOPE | `config/etf_heatmap_layout.json` 파싱, API 엔드포인트 `/api/etf/heatmap` 추가, Next.js 프론트엔드 히트맵 페이지 및 컴포넌트 구현 |

## 1. Requirements
* **백엔드 (FastAPI)**:
  - `config/etf_heatmap_layout.json` 파일의 한국 ETF 목록 및 그룹 메타데이터 로드.
  - 최신 기준일에 대하여 각 ETF의 1일 수익률, MTD, YTD, 3M, 6M, 1Y, 3Y, 5Y 성과 정보를 `rs_etf` 파티션 및 `etf_price.db`에서 조회 및 가공.
  - `GET /api/etf/heatmap?market=KR` API 라우트 개발.
* **프론트엔드 (Next.js)**:
  - `/etf/heatmap` 라우트 페이지 추가.
  - 탭 구조: 한국 ETF / 미국 ETF(비활성) / 세계 ETF(비활성).
  - 기간 필터 버튼: 1일(1D), 이달(MTD), 올해(YTD), 3개월, 6개월, 1년, 3년, 5년.
  - 히트맵 그리드: 양수 수익률은 초록색(진하기 비례), 음수 수익률은 빨간색(진하기 비례)으로 채워지는 셀 디자인 적용.
  - 셀 호버 시 종목 코드, 명칭, 수익률 상세 정보를 표시하는 툴팁 제공.

## 2. Risk Management
* **수익률 누락 대응**: 새로 상장한 종목의 과거 수익률(예: 3Y, 5Y)이 없는 경우, 빈 공간이나 N/A로 우아하게 표시하고 색상은 무채색(회색) 처리.
* **성능 지연**: 수백 개의 ETF 데이터를 매 요청마다 DB에서 스캔하면 응답 시간이 느려질 수 있음. 백엔드에서 데이터 조회 결과를 인메모리 캐싱하거나, 파일/DB 조회 시 특정 날짜 스냅샷을 빠르게 가져올 수 있도록 인덱스 최적화 적용.

## 3. Success Criteria
1. `/api/etf/heatmap?market=KR` 엔드포인트가 200ms 이내로 올바른 JSON 구조를 반환함.
2. Next.js 화면에 스노우볼72와 동일한 27개 그룹별 ETF 목록이 올바르게 렌더링됨.
3. 기간 필터 스위칭 시 히트맵 셀 색상이 즉각적으로 업데이트됨.
