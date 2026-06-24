# Design: Above MA Realtime Chart (Double-Pane Sync Mode) (Issue #3)

> 실시간 Above MA 지표 연동 및 인트라데이 15분 그리드 선형 보간 엔진, 그리고 가격-지표 이중 패널 동기화 차트 설계서

## Context Anchor

| Dimension | Content |
|-----------|---------|
| WHY | 가정용 서버 정전으로 인한 실시간 지표 수집 단절 극복 및 수평 시간축 왜곡 없는 미려한 차트 설계 |
| WHO | 시장의 과열/침체 구간 및 대형주/중소형주 시장 전반의 참여율을 분석하고자 하는 투자자 |
| RISK | 누락 시간대의 시간축 비틀림 현상 및 이종 지표(종가 vs 백분율)의 단일 화면 렌더링에 따른 가독성 침해 |
| SUCCESS | 15분 단위 완벽한 보간 데이터 연동, 종가와 MA 비율의 수평 스크롤/줌/마우스 호버 크로스헤어 완전 동기화 |
| SCOPE | 백엔드 선형 보간 쿼리 서비스(SQLite), `/charts/above-ma` API 라우터, 프론트엔드 `AboveMaChart` 컴포넌트 |

## 1. 아키텍처 개요 (Architecture Overview)

본 설계는 실시간 이동평균선 상회 비율 트렌드를 효과적으로 전달하기 위해 백엔드에서의 **인프라 데이터 보간 파이프라인**과 프론트엔드의 **동기화 이중 패널 차트(Double-Pane Sync)** 구조로 이루어집니다.

```mermaid
graph TD
    SQLite[(realtime_above_ma.db)] --> |Query Raw Data| Utils[above_ma_utils.py]
    Utils --> |Identify Gaps & Apply Linear Interpolation| CleanData[Interpolated Response]
    CleanData --> |FastAPI Router| API[/api/charts/above-ma]
    API --> |useAboveMaData hook| UI[AboveMaChart.tsx]
    UI --> |Render Pane 1| CloseChart[Close Price Area Chart]
    UI --> |Render Pane 2| MAChart[Above 10/20/50 MA Line Chart]
    CloseChart <--> |Sync Zoom, Scroll, Crosshair| MAChart
```

---

## 2. 세부 설계 명세 (Detailed Design)

### 2.1 백엔드 데이터 엔진 및 보간 아키텍처 (Python/SQLite)
* **데이터 모델**: `Date`, `Market`, `Close`, `Above10ma`, `Above20ma`, `Above50ma`, `naver_length`
* **보간 알고리즘**:
  * 인트라데이 상에서 인접한 두 레코드 `p1(t1)`과 `p2(t2)`의 날짜가 같고 시간 차가 **20분 초과**일 때 누락(정전 등) 구간으로 정의합니다.
  * `t1`에서 `15 - (t1.minute % 15)` 연산으로 정밀하게 정렬된 다음 15분 그리드 시점(`grid_t`)을 도출합니다.
  * `grid_t < t2`일 동안 15분 단위로 이동하며 가중치 $w = (grid\_t - t1) / (t2 - t1)$를 계산합니다.
  * 계산된 $w$를 기반으로 `Close` 및 `Above10/20/50ma` 비율을 선형 계산해 가상 레코드를 채워 넣습니다:
    $$V_{interp} = V_1 + w \times (V_2 - V_1)$$
  * 이를 통해 정전 등 데이터 수집이 완전히 끊긴 환경에서도 시각적인 선형 흐름이 유지됩니다.

### 2.2 프론트엔드 컴포넌트 디자인 (React/Lightweight-Charts)
* **이중 차트 패널 설계 (Double-Pane)**:
  * 가격 스케일(Price Scale)과 백분율 스케일(Percentage Scale)의 성격 차이를 극복하기 위해 차트를 상/하 2개의 독립 캔버스로 분리합니다.
  * **상단 패널 (높이 350px)**: 지수 종가를 보여주는 Area 차트로, 은은한 블루 그라데이션 필터(`#38bdf8`)를 적용해 고급스러운 차트 테마를 형성합니다.
  * **하단 패널 (높이 250px)**: `Above10ma` (Red, `#ff3b30`), `Above20ma` (Green, `#4cd964`), `Above50ma` (Blue, `#2f80ed`) 비율 추세를 단일 차트에 겹쳐 렌더링합니다.
* **시간축/크로스헤어 완전 동기화**:
  * `subscribeVisibleLogicalRangeChange` 콜백을 양방향 바인딩하여 어느 하나의 차트를 드래그/줌인/줌아웃해도 다른 차트의 시간 척도가 프레임 지연 없이 일치해 움직입니다.
  * `subscribeCrosshairMove` 콜백을 상호 연동하여 마우스 오버 시 두 차트의 수직선 및 현재 위치 값이 칼같이 동기화됩니다.
* **통합 레이아웃 및 툴팁**:
  * 호버 중인 데이터는 차트 상단의 통합 컨트롤 헤더에 단일 라인 포맷으로 정밀하게 출력해 가독성을 높입니다.

---

## 3. UI/UX 화면 구성 설계
* **좌측 글로벌 메뉴 연동**:
  * 사이드바와 모바일 사이드바 내에 **Above MA** 탭을 추가하고 활성화 시 `/trend?tab=above_ma` 쿼리 파라미터 주소로 분기합니다.
* **시장 필터 칩 (Market Filter Chips)**:
  * 상단 영역에 KOSPI, KOSPI 200, KOSDAQ, KOSDAQ 150 지수를 즉시 스위칭할 수 있는 UI 버튼을 배치합니다.
* **시스템 정보 정보 제공**:
  * 하단 영역에 현재 타겟 지수, 데이터 소스 정보 및 보간 기능 활성화 상태(Active - Linear 15m grid)를 표시합니다.
