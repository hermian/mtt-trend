import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AvwapChart from "../AvwapChart";
import * as useAvwapChartModule from "@/hooks/useAvwapChart";

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

let lastSubscribeClickCallback: ((param: any) => void) | null = null;
let lastSubscribeCrosshairMoveCallback: ((param: any) => void) | null = null;

// Mock lightweight-charts
vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
      createPriceLine: vi.fn((opts) => ({
        applyOptions: vi.fn(),
        options: vi.fn(() => opts),
      })),
      priceToCoordinate: vi.fn(() => 100),
      applyOptions: vi.fn(),
    })),
    remove: vi.fn(),
    timeScale: vi.fn(() => ({
      subscribeVisibleLogicalRangeChange: vi.fn(),
      getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 100 })),
      setVisibleLogicalRange: vi.fn(),
    })),
    priceScale: vi.fn(() => ({
      applyOptions: vi.fn(),
      width: vi.fn(() => 95),
    })),
    subscribeCrosshairMove: vi.fn((cb) => {
      lastSubscribeCrosshairMoveCallback = cb;
    }),
    subscribeClick: vi.fn((cb) => {
      lastSubscribeClickCallback = cb;
    }),
    unsubscribeClick: vi.fn(),
  })),
  ColorType: { Solid: "solid" },
  CandlestickSeries: "CandlestickSeries",
  LineSeries: "LineSeries",
  AreaSeries: "AreaSeries",
  BaselineSeries: "BaselineSeries",
  HistogramSeries: "HistogramSeries",
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 },
  PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2, IndexedTo100: 3 },
}));

describe("AvwapChart Component", () => {
  const mockChartData = {
    market: "kospi",
    name: "KOSPI",
    interval: "1D",
    amount_unit: "조원",
    points: [
      {
        date: "2024-01-02",
        open: 2600.0,
        high: 2620.0,
        low: 2590.0,
        close: 2610.0,
        volume: 50000000,
        change_pct: 0.5,
        ma: { EMA_10: 2590.0, SMA_50: 2550.0 },
        vol_ma: 48000000,
        amount: 15.4,
        amount_sma50: 12.1,
        bb_upper: 2650.0,
        vix_fix: 5.2,
        rsi: 58.4,
        mdd: -3.5,
        h52_chg: -4.2,
        vwap: 2605.0,
        hvwap: 2615.0,
        lvwap: 2595.0,
      },
    ],
    anchors: [
      {
        id: "anchor_20210628",
        name: "AVWAP (2021-06-28)",
        anchor_date: "2021-06-28",
        color: "#ec4899",
        values: [{ date: "2024-01-02", value: 2700.0 }],
      },
      {
        id: "anchor_atl_20000104",
        name: "역대 최저(ATL) (2000-01-04)",
        anchor_date: "2000-01-04",
        color: "#6b7280",
        values: [{ date: "2024-01-02", value: 500.0 }],
      },
    ],
    preset_dates: ["2021-06-28", "2000-01-04"],
  };

  it("renders market and interval controls and amount panel", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    expect(screen.getAllByText("KOSPI")[0]).toBeInTheDocument();
    expect(screen.getByText("KOSDAQ")).toBeInTheDocument();
    expect(screen.getByText("일봉")).toBeInTheDocument();
    expect(screen.getByText("주봉")).toBeInTheDocument();
    expect(screen.getByText("월봉")).toBeInTheDocument();
    expect(screen.getByText("년봉")).toBeInTheDocument();
    expect(screen.getByText("VWAP")).toBeInTheDocument();
    expect(screen.getByText("HVWAP(최고)")).toBeInTheDocument();
    expect(screen.getByText("LVWAP(최저)")).toBeInTheDocument();
    expect(screen.getByText("BB상단")).toBeInTheDocument();
    expect(screen.getByText("HP필터")).toBeInTheDocument();
    expect(screen.getByText("HP 이탈도")).toBeInTheDocument();
    expect(screen.getByText(/낙폭\(52주\):/)).toBeInTheDocument();
    expect(screen.getByText("-4.2%")).toBeInTheDocument();
    expect(screen.getByText("52주 (기본)")).toBeInTheDocument();
    expect(screen.getByText("3년")).toBeInTheDocument();
    expect(screen.getByText("전기간")).toBeInTheDocument();
    expect(screen.getByText(/전체: -3.5%/)).toBeInTheDocument();
    expect(screen.getByText("15.4조")).toBeInTheDocument();
    expect(screen.getByText(/거래대금 \(조원\)/)).toBeInTheDocument();
    expect(screen.getByText("KR")).toBeInTheDocument();
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("종목")).toBeInTheDocument();
    expect(screen.getByText("ETF")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/종목명 또는 코드/)).toBeInTheDocument();
    expect(screen.getByText("+ 앵커 추가")).toBeInTheDocument();
    expect(screen.getByText("⚙ 관리")).toBeInTheDocument();
  });


  it("allows switching market and interval", () => {
    const useAvwapSpy = vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const kosdaqBtn = screen.getByText("KOSDAQ");
    fireEvent.click(kosdaqBtn);

    expect(useAvwapSpy).toHaveBeenCalledWith("kosdaq", "1D", null);

    const weekBtn = screen.getByText("주봉");
    fireEvent.click(weekBtn);

    expect(useAvwapSpy).toHaveBeenCalledWith("kosdaq", "1W", null);
  });

  it("allows searching and selecting a stock", () => {
    const useAvwapSpy = vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [
        { code: "005930", name: "삼성전자", market: "KOSPI" },
        { code: "000660", name: "SK하이닉스", market: "KOSPI" },
      ],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const input = screen.getByPlaceholderText(/종목명 또는 코드/);
    fireEvent.change(input, { target: { value: "삼성" } });

    const option = screen.getByText("005930");
    expect(option).toBeInTheDocument();

    fireEvent.click(option);

    expect(useAvwapSpy).toHaveBeenCalledWith("kospi", "1D", "005930");
  });

  it("toggles anchor buttons", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const anchorBtn = screen.getByText(/2021-06-28/);
    expect(anchorBtn).toBeInTheDocument();

    // Toggle off
    fireEvent.click(anchorBtn);
    // Toggle on
    fireEvent.click(anchorBtn);

    // Toggle All Off / On using single toggle button
    const toggleAnchorBtn = screen.getByText("앵커 전체 ON");
    fireEvent.click(toggleAnchorBtn);
    expect(screen.getByText("앵커 전체 OFF")).toBeInTheDocument();

    fireEvent.click(screen.getByText("앵커 전체 OFF"));
    expect(screen.getByText("앵커 전체 ON")).toBeInTheDocument();
  });

  it("renders log scale by default and allows toggling to linear scale", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const logBtn = screen.getByText("로그(Log)");
    const linearBtn = screen.getByText("선형(Linear)");

    expect(logBtn).toBeInTheDocument();
    expect(linearBtn).toBeInTheDocument();

    fireEvent.click(linearBtn);
    fireEvent.click(logBtn);
  });

  it("allows toggling between Stock and ETF search mode and selecting an ETF", () => {
    const useAvwapSpy = vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [
        { code: "069500", name: "KODEX 200", market: "ETF" },
      ],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const etfToggleBtn = screen.getByRole("button", { name: "ETF" });
    const stockToggleBtn = screen.getByRole("button", { name: "종목" });
    expect(etfToggleBtn).toBeInTheDocument();
    expect(stockToggleBtn).toBeInTheDocument();

    // Click ETF toggle
    fireEvent.click(etfToggleBtn);
    expect(screen.getByPlaceholderText(/ETF명 또는 코드/)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/ETF명 또는 코드/);
    fireEvent.change(input, { target: { value: "KODEX" } });

    const etfOption = screen.getByText("069500");
    expect(etfOption).toBeInTheDocument();
    fireEvent.click(etfOption);

    expect(useAvwapSpy).toHaveBeenCalledWith("kospi", "1D", "069500");
    expect(screen.getAllByText("ETF").length).toBeGreaterThan(0);
  });

  it("allows switching to S&P500, NDX, and DOW markets", () => {
    const useAvwapSpy = vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    expect(screen.getByText("S&P500")).toBeInTheDocument();
    expect(screen.getByText("NDX")).toBeInTheDocument();
    expect(screen.getByText("DOW")).toBeInTheDocument();

    // Click S&P500
    fireEvent.click(screen.getByText("S&P500"));
    expect(useAvwapSpy).toHaveBeenCalledWith("sp500", "1D", null);

    // Click NDX
    fireEvent.click(screen.getByText("NDX"));
    expect(useAvwapSpy).toHaveBeenCalledWith("nasdaq100", "1D", null);

    // Click DOW
    fireEvent.click(screen.getByText("DOW"));
    expect(useAvwapSpy).toHaveBeenCalledWith("dow", "1D", null);
  });

  it("opens quick anchor popover and anchor manager modal", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    // 1. Open Quick Add Popover
    const addBtn = screen.getByText("+ 앵커 추가");
    fireEvent.click(addBtn);
    expect(screen.getByText("변곡점 앵커 추가")).toBeInTheDocument();
    expect(screen.getByText("+ 앵커 생성")).toBeInTheDocument();

    // 2. Open Anchor Manager Modal
    const manageBtn = screen.getByText("⚙ 관리");
    fireEvent.click(manageBtn);
    expect(screen.getByText("변곡점 앵커 관리")).toBeInTheDocument();
    expect(screen.getByText("+ 등록")).toBeInTheDocument();
    expect(screen.getByText("📥 JSON 내보내기")).toBeInTheDocument();
  });

  it("toggles click-to-anchor picker mode and shows helper banner", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const pickerBtn = screen.getByText("🎯 캔들 클릭");
    expect(pickerBtn).toBeInTheDocument();

    // Toggle on
    fireEvent.click(pickerBtn);
    expect(screen.getByText(/앵커로 설정할 캔들을 클릭하세요/)).toBeInTheDocument();

    // Toggle off via cancel button
    const cancelBtn = screen.getByText("ESC 취소");
    fireEvent.click(cancelBtn);
    expect(screen.queryByText(/앵커로 설정할 캔들을 클릭하세요/)).not.toBeInTheDocument();
  });

  it("toggles anchor badges on/off when clicked", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const anchorBtn = screen.getByText("AVWAP (2021-06-28)").closest("button")!;
    expect(anchorBtn).toHaveAttribute("title", "클릭하여 차트 표시 끄기 (OFF)");

    // Click anchor badge -> turn OFF
    fireEvent.click(anchorBtn);
    expect(anchorBtn).toHaveAttribute("title", "클릭하여 차트 표시 켜기 (ON)");

    // Click anchor badge again -> turn ON
    fireEvent.click(anchorBtn);
    expect(anchorBtn).toHaveAttribute("title", "클릭하여 차트 표시 끄기 (OFF)");
  });

  it("toggles base indicator lines on/off and highlights line on chart click", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    // Click VWAP button to toggle VWAP line (OFF -> ON)
    const vwapBtn = screen.getByText("VWAP");
    expect(vwapBtn).toHaveAttribute("title", "클릭하여 VWAP 표시 ON/OFF");
    fireEvent.click(vwapBtn);
    fireEvent.click(vwapBtn);

    // Simulate clicking line inside chart canvas
    expect(lastSubscribeClickCallback).toBeDefined();
    if (lastSubscribeClickCallback) {
      act(() => {
        lastSubscribeClickCallback!({
          time: "2024-01-02",
          point: { x: 50, y: 100 },
        });
      });
    }

    // Banner appears indicating line is highlighted
    expect(screen.getByText(/선 강조 중/)).toBeInTheDocument();

    // Click release button
    const releaseBtn = screen.getByText("✕ 해제");
    fireEvent.click(releaseBtn);
    expect(screen.queryByText(/선 강조 중/)).not.toBeInTheDocument();
  });
  it("allows toggling between KR and US search mode and updates search", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    const useSearchSpy = vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [
        { code: "AAPL", name: "애플 (Apple Inc)", market: "NASDAQ" },
      ],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const usBtn = screen.getByRole("button", { name: "US" });
    const krBtn = screen.getByRole("button", { name: "KR" });
    expect(usBtn).toBeInTheDocument();
    expect(krBtn).toBeInTheDocument();

    // Click US button
    fireEvent.click(usBtn);
    expect(screen.getByPlaceholderText(/미국 종목명 또는 티커/)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/미국 종목명 또는 티커/);
    fireEvent.change(input, { target: { value: "AAPL" } });

    expect(useSearchSpy).toHaveBeenCalledWith("AAPL", "stock", "us");
  });

  it("allows searching and selecting US stocks and displays market badges (NASDAQ, NYSE, AMEX)", () => {
    const useAvwapSpy = vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [
        { code: "AAPL", name: "애플 (Apple Inc)", market: "NASDAQ" },
        { code: "BRK-B", name: "버크셔 해서웨이", market: "NYSE" },
        { code: "SPY", name: "SPDR S&P 500", market: "AMEX" },
      ],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const usBtn = screen.getByRole("button", { name: "US" });
    fireEvent.click(usBtn);

    const input = screen.getByPlaceholderText(/미국 종목명 또는 티커/);
    fireEvent.change(input, { target: { value: "Apple" } });

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("NASDAQ")).toBeInTheDocument();
    expect(screen.getByText("NYSE")).toBeInTheDocument();
    expect(screen.getByText("AMEX")).toBeInTheDocument();

    fireEvent.click(screen.getByText("AAPL"));
    expect(useAvwapSpy).toHaveBeenCalledWith("kospi", "1D", "AAPL");
  });

  it("allows searching and selecting US ETFs with US_ETF market badge", () => {
    const useAvwapSpy = vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [
        { code: "QQQ", name: "Invesco QQQ Trust", market: "US_ETF" },
        { code: "TQQQ", name: "ProShares UltraPro QQQ", market: "US_ETF" },
      ],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    const usBtn = screen.getByRole("button", { name: "US" });
    fireEvent.click(usBtn);

    const etfToggleBtn = screen.getByRole("button", { name: "ETF" });
    fireEvent.click(etfToggleBtn);

    const input = screen.getByPlaceholderText(/미국 ETF명 또는 티커/);
    fireEvent.change(input, { target: { value: "QQQ" } });

    expect(screen.getByText("QQQ")).toBeInTheDocument();
    expect(screen.getAllByText("US_ETF").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("QQQ"));
    expect(useAvwapSpy).toHaveBeenCalledWith("kospi", "1D", "QQQ");
  });

  it("formats USD trading amount correctly with amount_unit 백만$", () => {
    const usStockChartData = {
      ...mockChartData,
      symbol: "AAPL",
      name: "애플 (AAPL)",
      market: "NASDAQ",
      amount_unit: "백만$",
      points: [
        {
          ...mockChartData.points[0],
          amount: 2500.5,
          amount_sma50: 1800.0,
        },
      ],
    };

    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: usStockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    expect(screen.getByText(/거래대금 \(백만\$\)/)).toBeInTheDocument();
    expect(screen.getByText("2.5B$")).toBeInTheDocument();
  });

  it("applies mobile responsive classes to HUD header", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    const { container } = renderWithClient(<AvwapChart />);

    const hudEl = container.querySelector(".font-mono.flex.flex-wrap");
    expect(hudEl).toHaveClass("gap-y-0.5");
    expect(hudEl).toHaveClass("sm:gap-y-1");
  });

  it("toggles HP filter on and off and updates HUD and deviation panel", () => {
    const multiPointData = {
      ...mockChartData,
      points: [
        { ...mockChartData.points[0], date: "2024-01-02", close: 2500.0 },
        { ...mockChartData.points[0], date: "2024-01-03", close: 2520.0 },
        { ...mockChartData.points[0], date: "2024-01-04", close: 2550.0 },
        { ...mockChartData.points[0], date: "2024-01-05", close: 2600.0 },
      ],
    };

    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: multiPointData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    // HP is enabled by default
    const hpBtn = screen.getByText("HP필터");
    expect(hpBtn).toBeInTheDocument();
    expect(screen.getByText("HP 이탈도")).toBeInTheDocument();
    expect(screen.getByText(/HP추세:/)).toBeInTheDocument();
    expect(screen.getByText(/HP이탈:/)).toBeInTheDocument();

    // Toggle HP off
    fireEvent.click(hpBtn);
    expect(screen.queryByText("HP 이탈도")).not.toBeInTheDocument();
    expect(screen.queryByText(/HP추세:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/HP이탈:/)).not.toBeInTheDocument();

    // Toggle HP back on
    fireEvent.click(hpBtn);
    expect(screen.getByText("HP 이탈도")).toBeInTheDocument();
    expect(screen.getByText(/HP추세:/)).toBeInTheDocument();
  });

  it("updates crosshair price lines and HUD across all panels when moving crosshair (+ cursor)", () => {
    vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<AvwapChart />);

    expect(lastSubscribeCrosshairMoveCallback).toBeDefined();

    if (lastSubscribeCrosshairMoveCallback) {
      act(() => {
        lastSubscribeCrosshairMoveCallback!({
          time: "2024-01-02",
          point: { x: 100, y: 100 },
        });
      });
    }

    // HUD values are displayed
    expect(screen.getByText("2024-01-02")).toBeInTheDocument();
    expect(screen.getByText("2,610")).toBeInTheDocument();
    expect(screen.getByText("15.4조")).toBeInTheDocument();

    // Mouse leave / crosshair reset
    if (lastSubscribeCrosshairMoveCallback) {
      act(() => {
        lastSubscribeCrosshairMoveCallback!({
          time: null,
          point: null,
        });
      });
    }
  });
});