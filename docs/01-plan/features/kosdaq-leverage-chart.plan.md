# 01-Plan: KOSDAQ Leverage Chart Integration

## Executive Summary
본 계획은 KODEX 레버리지 차트의 성공적인 구현 모델을 바탕으로, KOSDAQ 레버리지(`~/.cache/db/kodex_levarage/kosdaq_leverage.csv`) 실제 데이터를 연동하고 정밀 기술 지표 분석 엔진을 확장하는 것을 목표로 합니다. 코드 중복을 최소화하기 위해 백엔드 분석 유틸리티를 추상화합니다.

## Context Anchor
| Dimension | Content |
|-----------|---------|
| WHY | KOSDAQ 레버리지 실제 시장 데이터를 통해 포트폴리오 다변화 및 비교 분석 환경 구축 |
| WHO | mtt-trend 대시보드 사용자 |
| RISK | 여러 종목 데이터 로드 시 백엔드 캐시 충돌 및 프론트엔드 상태 관리 복잡도 증가 |
| SUCCESS | KOSDAQ 레버리지 차트가 KODEX와 동일한 정밀도(SMA, RSI, MACD) 및 동기화 수준으로 렌더링됨 |
| SCOPE | 백엔드 유틸리티 범용화, `/api/charts/data` 파라미터 확장, 프론트엔드 종목 선택 및 차트 매핑 |

## 1. Requirements
- **백엔드 (Polars Engine)**:
    - `load_chart_data(symbol)` 형태로 함수를 범용화하여 `kodex_leverage`와 `kosdaq_leverage`를 모두 처리.
    - 종목별 독립적인 `mtime` 감지 및 캐시 관리.
- **백엔드 (API)**:
    - `GET /api/charts/data?symbol=kosdaq_leverage` 요청 처리.
- **프론트엔드 (UI)**:
    - 차트 상단에 종목 전환 토글 또는 선택 인터페이스 추가 (필요 시).
    - 동일한 기술 지표(RSI, MACD, SMA50/200) 및 Sticky 레이아웃 적용.

## 2. Risk Management
- **캐시 충돌**: 글로벌 캐시 객체가 종목별로 구분되지 않을 경우 잘못된 데이터가 서빙될 위험이 있음. -> `symbol`을 키로 하는 딕셔너리 구조로 캐시 확장.
- **코드 중복**: 각 종목마다 별도의 계산 함수를 만들 경우 유지보수 난이도가 상승함. -> Polars 계산 로직을 단일 공통 함수로 모듈화.

## 3. Success Criteria
1. `~/.cache/db/kodex_levarage/kosdaq_leverage.csv`의 OHLC 데이터가 정확히 로드됨.
2. RSI, MACD(Signal), SMA50/200 지표가 Polars를 통해 자동 계산됨.
3. 데이터 밀림 현상 없이 모든 차트가 수직으로 정렬됨.
4. 기존 KODEX 레버리지 기능에 영향을 주지 않음 (회귀 테스트).
