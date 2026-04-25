# 01-Plan: Interactive Charting System

## 1. Executive Summary
- **Problem**: 현재 사용 중인 대시보드 툴(Streamlit 등)은 수십 개의 지표 차트를 렌더링하고, 이들 간의 크로스헤어를 완벽하게 동기화하며, 주가 차트를 상단에 고정(Sticky Top)하는 복잡한 커스텀 레이아웃과 모바일 최적화를 달성하는 데 성능적, 구조적 한계가 있습니다.
- **Solution**: FastAPI와 `lightweight-charts`를 결합하여 기존 `mtt-trend` 서비스에 통합되는 고성능/고맞춤형 인터렉티브 차트 시스템을 구축합니다.
- **Function UX Effect**: 수만 개의 데이터를 버벅임 없이 모바일과 웹에서 즉시 탐색 가능하며, 지표 추가/삭제가 동적으로 이루어지고, 모든 차트의 마우스 이동(크로스헤어)이 완벽하게 동기화됩니다.
- **Core Value**: 분석가의 일일 모니터링 시간을 단축시키고, 다중 기술 지표의 통합 분석(심층 분석) 경험을 대폭 향상시킵니다.

## 2. Objective & Scope
**목표:**
기존 `mtt-trend` 서비스 (FastAPI + Next.js) 내에 초경량, 고성능의 인터렉티브 기술 지표 대시보드를 구축합니다.

**범위 (Scope):**
- 주가 차트 (상단 고정 - Sticky Top)
- 동적으로 추가/삭제 가능한 여러 하단 기술 지표 차트 구현
- 차트 간 완벽한 동기화 (크로스헤어, 시간 축 동기화)
- 개별 차트 간의 간격(space) 조절 및 높이 비율 조절 (예: Base가 1일 때 주가 차트는 3배 높이)
- 범례(Legend) 및 툴팁(Tooltip) 켬/끔 (On/Off) 제어

## 3. Requirements
- **Must-have**:
  - `lightweight-charts` 기반 렌더링으로 60fps 유지 및 모바일 터치 지원.
  - 상단 주가 차트 고정 및 하단 지표 스크롤 가능 영역 분리.
  - 동기화된 크로스헤어 (하나의 차트에 마우스 오버 시 모든 차트에 세로선/가로선 및 툴팁 표시).
  - 설정 객체 (배열/리스트 형태)를 기반으로 지표 차트를 루프 렌더링 (유지보수 극대화).
  - 지표별 상대적 높이 비율 설정 지원.
- **Nice-to-have** (Future Considerations):
  - 사용자별 차트 설정(레이아웃, 켜진 지표 목록) 저장 기능.

## 4. Technical Approach
**아키텍처 및 프레임워크:**
- **프론트엔드 (Next.js):**
  - `lightweight-charts` (TradingView) 라이브러리를 React 컴포넌트로 래핑하여 사용.
  - 지표 설정 리스트(`[{ id: 'rsi', heightRatio: 1, ... }]`)를 기반으로 컴포넌트를 동적으로 맵핑 렌더링.
  - 최상단 주가 차트는 CSS `position: sticky; top: 0; z-index: 10;`을 통해 스크롤 시에도 화면 상단에 고정.
  - 차트 인스턴스 배열을 참조(ref)로 관리하여 한 차트의 마우스 이벤트(`subscribeCrosshairMove`) 발생 시 타 차트들의 `setCrosshairPosition`을 동기화.
  - 브라우저의 Window Resize 이벤트를 감지하여 모든 차트의 너비를 동기화.
- **백엔드 (FastAPI):**
  - `mtt-trend`의 기존 백엔드 라우터에 차트 전용 API(`GET /api/charts/data`)를 신설.
  - Polars/Pandas 엔진을 재활용하여 필요한 기술 지표들을 JSON 형태로 통합 응답. 대기시간 3~5초 이내를 목표로 데이터 직렬화 최적화 적용.

## 5. Alternatives Considered
- **대안 A: Lightweight Charts (JS) + FastAPI (선택됨)**
  - 가장 빠르며(Canvas 기반), 동기화 및 세밀한 DOM 레이아웃 제어(Sticky, 높이 등)가 가장 유연함. 프론트엔드가 이미 Next.js이므로 최고의 시너지.
- **대안 B: Plotly Dash / Streamlit**
  - 파이썬만으로 개발이 가능하지만, 클라이언트 사이드 인터랙션(특히 여러 차트 간 실시간 크로스헤어 동기화 및 60fps 스크롤)에서 성능적 오버헤드가 크고, DOM 요소의 정밀 제어(Sticky 레이아웃 등)가 극히 까다로움. (기각됨)

## 6. Risk Assessment
- **리스크**: `lightweight-charts`의 React 통합 시 의존성 충돌이나 무한 리렌더링 성능 저하 문제 발생 가능.
- **완화 방안**: 컴포넌트 마운트 시 한 번만 차트를 초기화하고, 데이터나 설정 변경 시 전체 리렌더링이 아닌 `applyOptions` 및 `setData` 메서드만 직접 호출하도록 `useEffect`를 세밀하게 설계함.

## 7. Success Criteria
- 1만 개 이상의 데이터 포인트 렌더링 시에도 버벅임 없이 모바일/웹에서 차트 이동(Pan)/확대(Zoom)가 가능해야 함.
- 메인 주가 차트에서 마우스 이동 시 하단 5개 이상의 지표 차트에서도 지연 없이 크로스헤어 세로선이 100% 동기화 표시되어야 함.
- 프론트엔드의 지표 리스트 배열에 새로운 지표 객체를 추가하는 것만으로 새 차트가 지정된 높이 비율과 간격으로 즉시 렌더링되어야 함.
