# 02-Design: KODEX Leverage Chart Data Integration

## Context Anchor
| Dimension | Content |
|-----------|---------|
| WHY | 더미 데이터를 실제 KODEX 레버리지 시장 데이터로 교체하여 분석 실효성 확보 |
| WHO | `mtt-trend` 대시보드 사용자 (트레이더 및 데이터 분석가) |
| RISK | CSV 파일 파싱 성능 및 대용량 데이터 전송 시 프론트엔드 렌더링 지연 |
| SUCCESS | KODEX 레버리지의 OHLC 및 모든 기술 지표(SMA, ADR)가 에러 없이 동기화되어 렌더링됨 |
| SCOPE | CSV 데이터 이관, 백엔드 CSV 파서 구현, `/api/charts/data` 연동, 프론트엔드 지표 매핑 |

## 1. Overview
기존의 더미 데이터 기반 `/api/charts/data` 엔드포인트를 확장하여, 서버 로컬에 저장된 CSV 파일을 로드하고 파싱하여 실시간 차트 데이터를 제공하는 시스템을 설계합니다.

## 2. Architecture Options

### Option A: Minimal Changes (Direct File Access)
- **Concept**: `charts.py` 라우터 함수 내에서 직접 `pandas` 또는 `csv` 모듈을 사용하여 파일을 읽고 반환합니다.
- **Pros**: 구현이 매우 빠르고 단순함.
- **Cons**: 요청마다 파일 I/O가 발생하여 성능이 저하됨. 확장성이 부족함.

### Option B: Clean Architecture (Service Layer + Memory DB)
- **Concept**: `CsvDataProvider` 서비스를 구현하고, 앱 시작 시 CSV 데이터를 메모리(또는 전용 캐시)에 로드합니다. 라우터는 서비스에 데이터만 요청합니다.
- **Pros**: 최상의 성능 (메모리 접근). 코드 유지보수 용이.
- **Cons**: 구현 복잡도 증가. 데이터 업데이트 시 서버 재시작 또는 리로드 로직 필요.

### Option C: Pragmatic Balance (Utility + LRU Cache)
- **Concept**: 파일을 읽어 스키마에 맞게 변환하는 유틸리티를 작성하고, Python의 `@lru_cache`를 사용하여 반복 요청에 대응합니다.
- **Pros**: 성능과 단순함의 적절한 조화. 별도의 데이터베이스 없이 파일 시스템 기반으로 동작.
- **Cons**: 캐시 만료 로직이 정교하지 않을 수 있음.

## 3. Trade-offs & Selection

| Metric | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Complexity | Low | High | Medium |
| Performance | Low | High | High |
| Effort | Low | Medium | Medium |
| Maintainability | Low | High | High |

**Selection**: **Option C (Pragmatic Balance)**를 권장합니다. 현재 데이터가 파일 기반으로 관리되고 있으며, `kodex_leverage` 외에도 다른 CSV 파일이 추가될 가능성이 높으므로 유틸리티 기반의 캐싱 접근 방식이 가장 효율적입니다.

## 4. Technical Detail (Option C)

### Backend Logic
1. `backend/app/utils/chart_utils.py` 생성:
   - CSV 로드 및 `ChartDataResponse` 변환 함수.
   - 컬럼명 매핑 (e.g., `SMA10_pct` -> `indicators['sma10']`).
2. `charts.py` 라우터 수정:
   - `symbol`이 `kodex_leverage`일 경우 유틸리티 호출.

### Frontend Integration
1. `TrendPage.tsx`의 `CHART_CONFIGS` 확장:
   - SMA10/20/50/200, ADR14/20 지표 설정 추가.
   - 차트 타입(Line/Histogram) 및 색상 지정.

## 5. UI/UX Design
- 차트 상단 툴바에 현재 표시 중인 데이터가 "KODEX Leverage (CSV)"임을 명시.
- 더 많은 지표가 추가되므로 차트 컨테이너 간격을 최적화하여 한 화면에 더 많이 보이게 조절.
