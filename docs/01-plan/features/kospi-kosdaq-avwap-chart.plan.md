# 01-Plan: KOSPI / KOSDAQ AVWAP (Anchored VWAP) Chart System

## 1. Executive Summary
- **Problem**: 기존에는 Python 스크립트(`screener/mmt/kospi_avwap_plot.py`)를 통해 PDF 형태로만 KOSPI/KOSDAQ의 앵커드 VWAP(AVWAP) 및 다중 주기 차트를 조회할 수 있어, 실시간 웹 인터페이스에서 인터랙티브하게 탐색(주기 전환, 앵커 토글, 크로스헤어 동기화)하기 어려웠습니다.
- **Solution**: FastAPI 백엔드에 KOSPI/KOSDAQ의 일봉(1D), 주봉(1W), 월봉(1M), 년봉(1Y) 리샘플링 및 AVWAP/거래대금/지표 연산 API를 구축하고, Next.js 프론트엔드에 `lightweight-charts` 기반 4단 동기화 패널(RSI, 메인 캔들+AVWAP+MA, 거래량+VIX Fix, 거래대금+SMA) 인터랙티브 차트를 구현합니다.
- **Function UX Effect**: KOSPI/KOSDAQ 지수를 1D/1W/1M/1Y 주기로 즉시 전환하며, 한국 표준 캔들스틱(상승 Red, 하락 Blue)과 주요 변곡점 앵커 VWAP, 최고/최저점 VWAP, 거래량 및 거래대금(조원 단위)을 상단 UI에서 On/Off 토글하며 직관적으로 분석할 수 있습니다.
- **Core Value**: 시장의 장기/중기/단기 지지·저항대 및 추세 전환점을 AVWAP과 거래대금 추이를 결합하여 빠르고 정확하게 분석할 수 있습니다.

---

## 2. Objective & Scope

### 2.1 목표
기존 `mtt-trend` 대시보드 내에 `AVWAP 차트` 탭(`/trend?tab=avwap`)을 신설하고, `kospi_avwap_plot.py`의 핵심 분석 지표 및 앵커 VWAP 계산 로직을 웹 인터랙티브 차트로 완벽하게 구현합니다.

### 2.2 범위 (Scope)
1. **시장 선택**: KOSPI, KOSDAQ
2. **주기 선택**: 일봉(1D), 주봉(1W), 월봉(1M), 년봉(1Y)
3. **캔들스틱 차트**: 한국 시장 표준 색상 (상승: Red `#ef4444`, 하락: Blue `#3b82f6`)
4. **이동평균선 (MA Overlays)**:
   - **일봉 (1D)**: EMA 10, EMA 21, SMA 50, SMA 150, SMA 200
   - **주봉 (1W)**: SMA 10, SMA 30, SMA 40
   - **월봉 (1M)**: SMA 6, SMA 12, SMA 24
   - **년봉 (1Y)**: SMA 3, SMA 5, SMA 10
5. **AVWAP 및 앵커 라인**:
   - 기본 VWAP (Lookback: 1D 252일, 1W 52주, 1M 12개월, 1Y 전체)
   - 최고점 HVWAP (윈도우 내 최고가 기준 앵커)
   - 최저점 LVWAP (윈도우 내 최저가 기준 앵커)
   - `kospi_avwap_plot.py`에 정의된 주기별 프리셋 앵커 날짜들 (2015, 2021, 2022, 2023, 2024 등)
   - 상단 컨트롤 바에서 각 앵커 라인 개별 / 전체 On/Off 토글 기능
6. **4단 멀티패널 레이아웃 및 동기화**:
   - **패널 1 (상단 90px)**: RSI (14) + 70/30 과매수/과매도선
   - **패널 2 (중앙 420px)**: 메인 캔들스틱 + MA + 볼린저 밴드 상단(BB Upper 2σ) + AVWAP 라인들
   - **패널 3 (하단 110px)**: 거래량 막대 + 거래량 MA + Williams VIX Fix (좌측 보조축, Green 점선)
   - **패널 4 (하단 180px)**: 거래대금 (조원 막대, Red/Blue) + 거래대금 SMA (주황색 실선 `#f59e0b`, 일봉 50일선, 주봉 10주선, 월봉 12개월선, 년봉 3년선, `scaleMargins: { top: 0.05, bottom: 0 }` 적용으로 바 높이 극대화)
   - 모든 4개 패널 간 마우스 크로스헤어, 수직 가이드라인, 휠 줌/팬 시간축 완벽 동기화

---

## 3. Requirements & Technical Specifications

### 3.1 Mathematical Definitions & Formulae

1. **Typical Price & VWAP**:
   $$TP_t = \frac{Open_t + High_t + Low_t + Close_t}{4}$$
   $$VWAP_t = \frac{\sum_{i=start}^t (TP_i \times Volume_i)}{\sum_{i=start}^t Volume_i}$$
2. **Williams VIX Fix (22 Periods)**:
   $$VIXFix_t = \frac{\max(Close_{t-21..t}) - Low_t}{\max(Close_{t-21..t})} \times 100$$
3. **Bollinger Band Upper (2σ)**:
   $$BB\ Upper_t = SMA(Close, N) + 2 \times StdDev(Close, N)$$
   - 1D: $N=75$, 1W: $N=15$, 1M: $N=15$
4. **Trading Amount & Amount SMA**:
   $$Amount\ (Trillion\ KRW)_t = \frac{Raw\ Amount_t}{10^{12}}$$
   $$Amount\ SMA_t = SMA(Amount, M)$$
   - 1D: $M=50$, 1W: $M=10$, 1M: $M=12$, 1Y: $M=3$

---

### 3.2 Backend Architecture (FastAPI & Pandas)

- **엔드포인트**: `GET /api/charts/avwap`
  - 쿼리 파라미터:
    - `market`: `kospi` | `kosdaq` (기본값: `kospi`)
    - `interval`: `1D` | `1W` | `1M` | `1Y` (기본값: `1D`)
- **데이터 소스**:
  - `~/.cache/db/kodex_leverage/kospi_mtt.csv` (1995년~현재)
  - `~/.cache/db/kodex_leverage/kosdaq_mtt.csv` (1996년~현재)
- **응답 스키마 (`AvwapChartResponse`)**:
  ```typescript
  interface AvwapPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change_pct: number | null;
    ma: Record<string, number | null>;
    vol_ma: number | null;
    amount: number | null;        // 거래대금 (조원)
    amount_sma50: number | null;  // 거래대금 SMA (조원)
    bb_upper: number | null;
    vix_fix: number | null;
    rsi: number | null;
    vwap: number | null;
    hvwap: number | null;
    lvwap: number | null;
  }
  ```

---

### 3.3 Frontend Architecture (Next.js & Lightweight Charts)

- **주요 파일**:
  - 컴포넌트: `frontend/src/app/trend/_components/AvwapChart.tsx`
  - API 클라이언트: `frontend/src/lib/api.ts` (`api.getAvwapChartData`, `api.searchStocks`)
  - Hook: `frontend/src/hooks/useAvwapChart.ts` (`useAvwapChart`, `useStockSearch`)
  - 페이지 연결: `frontend/src/app/trend/page.tsx` (`tab=avwap`)
  - 내비게이션: `Sidebar.tsx`, `MobileSidebar.tsx` ('AVWAP 차트' 메뉴)
- **UI 및 차트 동기화**:
  - 4개 `createChart` 인스턴스 간 `timeScale.subscribeVisibleLogicalRangeChange`를 통한 가로축 동기화
  - `subscribeCrosshairMove` 및 절대 위치 수직 가이드 점선 라인 (`verticalGuideRef`) 동기화
  - 상단 HUD 상태 바에 날짜, OHLCV, 등락률, RSI, VIX Fix, 거래대금, SMA 실시간 수치 표기
  - 종목 검색 자동완성 입력창(드롭다운 제안, 엔터 선택, ✕ 복귀 버튼) 및 개별 종목과 지수 간 매끄러운 전환

---

## 3.4 Individual Stock Search & Plotting Extension (개별 종목 지원)

1. **종목 검색 및 식별**:
   - `GET /api/charts/stocks/search?q=...` 엔드포인트를 통해 종목명(예: `삼성전자`) 또는 종목코드(예: `005930`)로 실시간 자동완성 제공.
   - `~/.cache/db/stock_master.db` 및 `~/.cache/db/marcap.duckdb`의 `marcap_adj` 테이블을 활용하여 종목코드, 종목명, 소속 시장(KOSPI/KOSDAQ)을 정확하게 조회.
2. **개별 종목 기술 지표 및 리샘플링**:
   - `GET /api/charts/avwap?symbol=005930&interval=1D`
   - 수정주가(OHLCV + Amount) 데이터를 1D, 1W, 1M, 1Y로 리샘플링하여 동일한 4단 패널 포맷으로 렌더링.
   - 거래대금 단위: 개별 종목은 `억원` 단위(`Amount / 1e8`), 지수는 `조원` 단위(`Amount / 1e12`)로 동적 포맷팅 지원.
3. **개별 종목 동적 앵커**:
   - `YTD (올해 초)`
   - `52주 최고가 (52W High)`
   - `52주 최저가 (52W Low)`
   - `역대 최고가 (ATH)`
   - `역대 최저가 (ATL)`
   - 기본 `VWAP`, `HVWAP`, `LVWAP` 및 볼린저 밴드 상단(BB Upper) 지원.

---

## 4. Verification & Testing Strategy

1. **백엔드 단위 테스트 (`backend/tests/test_avwap_chart.py`)**:
   - `test_avwap_kospi_1d`: KOSPI 1D 응답 구조, OHLCV, MAs, VWAP, HVWAP, LVWAP, Amount, Amount SMA50 검증
   - `test_avwap_kospi_1w`: KOSPI 주봉 리샘플링 및 지표 검증
   - `test_avwap_kospi_1m`: KOSPI 월봉 리샘플링 및 지표 검증
   - `test_avwap_kospi_1y`: KOSPI 년봉 리샘플링 및 2000년 이후 전체 데이터셋 검증
   - `test_avwap_kosdaq`: KOSDAQ 일/주/월/년봉 및 코스닥 전용 앵커 포인트 검증
   - `test_stock_search`: 종목 검색 자동완성 API 검증
   - `test_avwap_stock_by_code_and_name`: 종목코드(`005930`) 및 종목명(`SK하이닉스`) 기반 개별 종목 4패널 AVWAP 차트 및 404 예외 검증
2. **프론트엔드 컴포넌트 테스트 (`frontend/src/app/trend/_components/__tests__/AvwapChart.test.tsx`)**:
   - 컨트롤 바 렌더링(시장 선택, 검색 인풋, 주기 선택, 빠른 토글 버튼, 앵커 뱃지)
   - 시장 및 주기 전환 시 쿼리 파라미터 호출 검증
   - 종목 검색 자동완성 입력 및 종목 선택 플롯 검증
   - 앵커 개별/전체 토글 동작 검증
   - 거래대금(조원/억원) 및 SMA 패널 라벨 렌더링 검증
3. **프로덕션 빌드 검증 (`npm run build`)**:
   - Next.js Turbopack 정적 페이지 빌드 및 TypeScript 타입 체크 100% 무결성 검증
