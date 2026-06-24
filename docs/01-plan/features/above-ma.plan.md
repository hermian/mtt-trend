# 01-Plan: Above MA Realtime Chart Integration (Issue #3)

## Executive Summary
본 계획은 실시간 이동평균선(10/20/50 MA) 상회 종목 비율을 관리하는 SQLite 데이터베이스(`realtime_above_ma.db`)의 데이터를 기반으로, 기존 심층지표분석과 동일한 고품질의 인터랙티브 차트 화면을 추가하는 것을 목표로 합니다. 특히, 가정용 서버 정전(오전 9시~오후 2시) 등으로 인한 데이터 수집 누락에 대비하여 백엔드에서 15분 그리드로 선형 보간(Linear Interpolation) 처리를 수행함으로써 중단 없는 트렌드 시각화를 보장합니다.

## Context Anchor
| Dimension | Content |
|-----------|---------|
| WHY | 실시간 시장 브레드(Breadth) 지표인 이동평균선 상회 비율 추이를 정밀 분석하고, 서버 전원 공급 중단 시에도 매끄러운 차트 시각화 유지 |
| WHO | 시장 유동성 및 주도 세력의 강도를 판단하고자 하는 MTT Trend 대시보드 사용자 |
| RISK | 정전 시간 동안 데이터가 아예 수집되지 않아 차트 선이 깨지거나 가독성이 현저히 저하될 위험 |
| SUCCESS | 4대 시장(KOSPI, KOSPI 200, KOSDAQ, KOSDAQ 150)의 지수 및 Above MA 비율이 15분 단위로 완벽하게 보간 및 동기화되어 렌더링됨 |
| SCOPE | 백엔드 SQLite 연동 및 15분 간격 선형 보간 유틸리티 구현, `/api/charts/above-ma` API 라우트 추가, 프론트엔드 전용 차트 컴포넌트 개발 및 사이드바 내비게이션 추가 |

## 1. Requirements
- **백엔드 (Data Engine)**:
    - `/Users/hosung/.cache/db/realtime_above_ma.db` SQLite 파일에서 실시간 데이터를 추출.
    - 데이터가 20분 이상 누락된 인트라데이 구간에 대해 이전/이후 값을 기준으로 **15분 그리드 단위 선형 보간** 처리.
- **백엔드 (API)**:
    - `GET /api/charts/above-ma?market={KOSPI|KOSPI200|KOSDAQ|KOSDAQ150}&start_date=&end_date=` 엔드포인트 구현.
- **프론트엔드 (UI/UX)**:
    - 사이드바(Sidebar, MobileSidebar)에 "Above MA" 전용 링크 추가.
    - **듀얼 차트 레이아웃**: 상단 지수 가격(Area), 하단 Above 10/20/50 MA 비율(Line, Red/Green/Blue) 시각화.
    - 호버 시 시점별 가격 및 MA 비율 수치를 헤더 영역에 동적으로 표기하는 범례 전용 툴팁 컴포넌트 연동.
    - 차트 전환용 4대 지수 칩(Chip) 컴포넌트 구성.

## 2. Risk Management
- **정전 시간대 공백**: 9:00~14:00 사이에 데이터가 없는 경우, 단순히 선을 이으면 시간축이 찌그러지거나 인덱스가 왜곡될 수 있음. -> 15분 고정 주기에 해당하는 중간 가상의 타임스탬프를 계산적으로 채워 넣고 값들을 선형 보간하여 타임라인 왜곡 방지.
- **다중 프레임 수직 정렬**: 지수 가격 차트와 Above MA 비율 차트의 X축이 어긋날 수 있음. -> lightweight-charts의 `subscribeVisibleLogicalRangeChange` 및 `subscribeCrosshairMove`를 적용해 수평 동기화 보장.

## 3. Success Criteria
1. `realtime_above_ma.db`에 적재된 실시간 데이터가 올바르게 차트로 시각화됨.
2. 9:00~14:00 사이의 수집 공백 데이터가 15분 주기로 고르게 선형 보간됨.
3. 지수 가격 Area 차트와 Above MA 3중 라인 차트의 줌/스크롤/크로스헤어가 완벽하게 상호작용함.
4. 반응형 UI를 통해 모바일 디바이스와 PC 화면에서 모두 안정적으로 렌더링됨.
