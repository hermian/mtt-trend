# Design: KOSDAQ Leverage & Stochastic Enhancement (Compact Pro Mode)

> KOSDAQ 레버리지 연동 및 슬로우 스토캐스틱 정밀 엔진, 거래량 오버레이를 포함한 전문가용 모바일 최적화 차트 설계

## Context Anchor

| Dimension | Content |
|-----------|---------|
| WHY | KOSDAQ 레버리지 종목 분석 부재 및 부정확한 지표(밀림 현상) 해결 |
| WHO | 정밀한 기술적 분석을 수행하는 헤비 트레이더 및 모바일 사용자 |
| RISK | 데이터 인덱스 불일치(지표 밀림), 모바일 조작 시 정렬 어긋남 |
| SUCCESS | KOSDAQ 데이터 100% 연동, 지표 밀림 0건, 모바일 수직 정렬 완벽 확보 |
| SCOPE | 백엔드 지표 엔진(Polars), 프론트엔드 전문가용 멀티 차트 UI |

## 1. 개요 (Overview)
본 설계는 KODEX에 이어 KOSDAQ 레버리지 실제 데이터를 연동하고, Polars 엔진을 통해 수학적으로 정교한 지표(Stochastic, MACD, RSI)를 서빙합니다. 특히 모바일에서의 분석 효율을 위해 '울트라 컴팩트 레이아웃'과 '데이터 오버레이' 기술을 적용합니다.

## 2. 기술적 사양 (Technical Spec)

### 2.1 백엔드 (Python/Polars)
- **종목 연동**: `~/.cache/db/kodex_levarage/kosdaq_leverage.csv` 데이터 로드 및 종목별 독립 캐시(`_CHART_CACHE`) 구축.
- **정밀 지표 엔진**:
    - **Slow Stochastic (5,3,3)**: Fast %K → Slow %K(3일 평활) → Slow %D(3일 평활) 3단계 계산.
    - **수학적 안정성**: `clip(1e-10)`을 통한 Zero-Divider 방지 및 `fill_null(50.0)` 처리.
- **데이터 통합**: CSV 원본 지표(SMA_pct, ADR)와 Polars 계산 지표를 날짜 기준 1:1 결합 전송.

### 2.2 프론트엔드 (React/Lightweight-Charts)
- **울트라 컴팩트 레이아웃**:
    - **주가 차트**: 400px 고정 (Sticky).
    - **보조 지표**: 각 100px 고정 (Scrollable).
- **지표 통합 뷰**:
    - **SMA RGB**: SMA 10(Red), 20(Green), 50(Blue)를 단일 차트에 통합하여 추세 비교 가독성 극대화.
- **거래량 오버레이 (Volume Overlay)**:
    - 주가 차트 하단 35% 영역에 30% 투명도로 배치.
    - 주가 등락에 따른 다이내믹 컬러(상승-빨강, 하락-파랑) 적용.
- **모바일 조작성**:
    - 12px 선명한 커스텀 스크롤바 상시 노출.
    - 스크롤바 너비를 고려한 주가 차트 우측 패딩(`pr-[0px]` + `el.clientWidth`) 보정으로 완벽한 수직 정렬.
- **툴팁 (Legend)**:
    - 전 차트 툴팁을 **좌측 상단**으로 배치하여 가격축과 시각적 간섭 제거.
    - `10:75.2`와 같은 컴팩트한 약어 표기 적용.

## 3. UI/UX 레이아웃 설계

### 3.1 차트 탭 전용 모드
- **자동 헤더 숨김**: `activeTab === "chart"`일 때 상단 필터바 및 테마 선택 영역을 숨겨 수직 분석 공간 100% 확보.
- **Full Screen 경험**: 부모 컨테이너 패딩(p-0) 제거를 통해 화면 끝까지 데이터가 꽉 차도록 구성.

## 4. 데이터 정합성 검증
- **Sync Latest**: 최신 데이터 기준 150봉 자동 스크롤 및 지표-주가 시간축 동기화.
- **Type Safety**: Pydantic 스키마(`schemas.py`) 전수 복구를 통한 API 안정성 확보.
