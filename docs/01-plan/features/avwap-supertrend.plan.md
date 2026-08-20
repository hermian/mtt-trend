# 01-Plan: AVWAP Chart Supertrend Indicator System

## 1. Executive Summary
- **Problem**: AVWAP 차트에서 단기/중기 추세 전환 및 모멘텀 지속 여부를 빠르게 식별하기 위해 신뢰성 높은 추세 추종 지표(Supertrend)를 즉각적으로 오버레이하고 파라미터(ATR 기간, 승수, 계산 방식, 시그널 표시 등)를 자유롭게 조정할 수 있는 기능이 부재했습니다.
- **Solution**: TradingView의 검증된 Pine Script v4 Supertrend 수식(`Periods=10`, `Multiplier=3.0`, `changeATR=true`, `showsignals=true`, `highlighting=true`)을 100% 반영한 고성능 TypeScript 연산 모듈을 개발하고, Next.js 프론트엔드 AVWAP 차트에 On/Off 토글 버튼과 설정 팝오버(Popover)를 연동합니다.
- **Function UX Effect**: 상단 컨트롤 바에서 `⚡ Supertrend` 버튼으로 원클릭 On/Off 전환이 가능하며, `⚙` 설정 버튼을 통해 ATR 기간/승수/계산 방식/시그널 표시 여부를 실시간으로 변경하고 `localStorage`에 영구 저장합니다. 또한 차트 상단 HUD 헤더 바 및 우측 Y축 크로스헤어 눈금자에 실시간 지표값이 연동됩니다.

---

## 2. Objective & Scope

### 2.1 목표
1. TradingView Supertrend(Pine Script v4) 지표의 완전한 클라이언트 사이드 연산 모듈 개발 (`frontend/src/lib/supertrend.ts`)
2. 단위 테스트 작성 및 수학적 정확성 검증 (`frontend/src/lib/__tests__/supertrend.test.ts`)
3. 직관적인 설정 팝오버 UI 컴포넌트 개발 (`frontend/src/app/trend/_components/SupertrendSettingsPopover.tsx`)
4. AVWAP 차트(`AvwapChart.tsx`) 내 시리즈 오버레이(상승 초록선, 하락 빨간선, 매수/매도 시그널 마커, 영역 강조) 및 컨트롤 바 토글 연동
5. Playwright E2E 테스트를 통한 기능 및 UI 동작 검증

### 2.2 범위 (Scope)
- **차트 오버레이**:
  - 상승 추세 구간 (`trend == 1`): 녹색 라인 (`#10b981`, 두께 2)
  - 하락 추세 구간 (`trend == -1`): 적색 라인 (`#ef4444`, 두께 2)
  - 매수/매도 전환 시그널 마커 (상승/하락 반전 봉)
- **설정 파라미터 (Configurable Inputs)**:
  - `atrPeriod` (기본값: 10, 1~100)
  - `multiplier` (기본값: 3.0, 0.1~20.0, step 0.1)
  - `changeATR` (기본값: true / Wilder's RMA vs SMA)
  - `showSignals` (기본값: true / 매수·매도 시그널 표시 On/Off)
  - `highlighting` (기본값: true / 하이라이팅 On/Off)
- **가이드라인 준수**:
  - `lightweight-charts` Pane 내부 text overlay 금지 (`title: ""`)
  - 마우스 호버 시 우측 Y축(Price Scale) 라벨 배지만 표시 (`axisLabelVisible: true`)
  - 차트 상단 HUD 헤더 바에 `Supertrend` 명칭 및 실시간 수치 표기

---

## 3. Mathematical Specifications

### 3.1 True Range ($TR$)
$$TR_i = \max(High_i - Low_i, |High_i - Close_{i-1}|, |Low_i - Close_{i-1}|)$$
*(단, 첫 번째 봉 $i=0$은 $TR_0 = High_0 - Low_0$)*

### 3.2 ATR Calculation
- **Wilder's RMA (`changeATR = true`, TradingView 표준)**:
  $$ATR_i = \frac{ATR_{i-1} \times (Periods - 1) + TR_i}{Periods}$$
- **Simple Moving Average (`changeATR = false`)**:
  $$ATR_i = \frac{1}{Periods} \sum_{k=0}^{Periods-1} TR_{i-k}$$

### 3.3 Trailing Bands
- $src_i = \frac{High_i + Low_i}{2}$
- $basicUp_i = src_i - (Multiplier \times ATR_i)$
- $basicDn_i = src_i + (Multiplier \times ATR_i)$
- $up_i = Close_{i-1} > up_{i-1} ? \max(basicUp_i, up_{i-1}) : basicUp_i$
- $dn_i = Close_{i-1} < dn_{i-1} ? \min(basicDn_i, dn_{i-1}) : basicDn_i$

### 3.4 Trend State & Signals
- $trend_i = \begin{cases} 1 & (trend_{i-1} == -1 \land Close_i > dn_{i-1}) \\ -1 & (trend_{i-1} == 1 \land Close_i < up_{i-1}) \\ trend_{i-1} & (\text{유지}) \end{cases}$
- $buySignal_i = (trend_i == 1 \land trend_{i-1} == -1)$
- $sellSignal_i = (trend_i == -1 \land trend_{i-1} == 1)$

---

## 4. Implementation Steps

1. **Step 1: 연산 모듈 및 단위 테스트**
   - `frontend/src/lib/supertrend.ts`
   - `frontend/src/lib/__tests__/supertrend.test.ts`
2. **Step 2: 설정 팝오버 컴포넌트**
   - `frontend/src/app/trend/_components/SupertrendSettingsPopover.tsx`
3. **Step 3: AVWAP 차트 연동**
   - `frontend/src/app/trend/_components/AvwapChart.tsx`
   - 컨트롤 바 토글 & 팝오버 연동, 시리즈 렌더링, HUD 수치 표시
4. **Step 4: 검증 및 테스트**
   - Vitest 단위 테스트 실행
   - Playwright E2E 테스트 실행 (`frontend/tests/supertrend.spec.ts`)
