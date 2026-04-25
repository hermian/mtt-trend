# 01-Plan: KODEX Leverage Chart Data Integration

## 1. Executive Summary
- **Problem**: 현재 인터랙티브 차트 시스템은 더미 데이터를 사용하고 있어 실질적인 분석 도구로 활용할 수 없습니다. 특히 `KODEX 레버리지`와 같은 핵심 종목의 시계열 데이터와 기술 지표(SMA, ADR 등)를 시각화하는 기능이 필요합니다.
- **Solution**: 로컬 캐시 디렉토리에 존재하는 `kodex_leverage.csv` 파일을 백엔드 시스템에 이관하고, 이를 파싱하여 API로 제공하는 전용 데이터 공급자(Data Provider)를 구축합니다.
- **Core Value**: 실질적인 시장 데이터 기반의 고성능 기술 분석 환경 제공.

## Context Anchor
| Dimension | Content |
|-----------|---------|
| WHY | 더미 데이터를 실제 KODEX 레버리지 시장 데이터로 교체하여 분석 실효성 확보 |
| WHO | `mtt-trend` 대시보드 사용자 (트레이더 및 데이터 분석가) |
| RISK | CSV 파일 파싱 성능 및 대용량 데이터 전송 시 프론트엔드 렌더링 지연 |
| SUCCESS | KODEX 레버리지의 OHLC 및 모든 기술 지표(SMA, ADR)가 에러 없이 동기화되어 렌더링됨 |
| SCOPE | CSV 데이터 이관, 백엔드 CSV 파서 구현, `/api/charts/data` 연동, 프론트엔드 지표 매핑 |

## 2. Requirements
- **Functional**:
  - `backend/data/charts/kodex_leverage.csv` 파일 로드 및 캐싱 로직.
  - API 호출 시 `symbol=kodex_leverage` 파라미터 지원.
  - CSV의 모든 컬럼(`SMA10_pct`, `ADR14` 등)을 `indicators` 맵으로 변환.
  - 프론트엔드 `CHART_CONFIGS`에 SMA 및 ADR 지표 추가.
- **Non-Functional**:
  - 1000개 이상의 데이터 포인트 로드 시 응답 시간 500ms 이내 유지.

## 3. Milestones
1. **[Backend] Data Migration**: CSV 파일 위치 확정 및 데이터 검증.
2. **[Backend] CSV Provider**: CSV 데이터를 `ChartDataResponse` 형식으로 변환하는 서비스 구현.
3. **[Frontend] Configuration**: 새로운 기술 지표를 위한 차트 레이아웃 및 색상 설정.
4. **[Integration] Verification**: 실제 데이터 기반 크로스헤어 및 시간 축 동기화 테스트.

## 4. Risk & Mitigation
- **Risk**: 데이터 포맷 변경 (CSV 컬럼명 변경 등).
- **Mitigation**: Pydantic 모델을 통한 데이터 유효성 검사 및 기본값 처리.

## 5. Success Criteria
- 브라우저에서 `kodex_leverage` 선택 시 2010년부터 현재까지의 차트가 끊김 없이 표시됨.
- 주가 차트 하단에 SMA 및 ADR 지표가 정확한 수치로 렌더링됨.
