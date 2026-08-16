import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

// Mock lightweight-charts
vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
      createPriceLine: vi.fn(),
    })),
    remove: vi.fn(),
    timeScale: vi.fn(() => ({
      subscribeVisibleLogicalRangeChange: vi.fn(),
      getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 100 })),
      setVisibleLogicalRange: vi.fn(),
    })),
    priceScale: vi.fn(() => ({
      applyOptions: vi.fn(),
    })),
    subscribeCrosshairMove: vi.fn(),
    subscribeClick: vi.fn(),
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
    expect(screen.getByText(/2021-06-28/)).toBeInTheDocument();
    expect(screen.getByText("52HChg:")).toBeInTheDocument();
    expect(screen.getByText("-4.2%")).toBeInTheDocument();
    expect(screen.getByText("MDD (%)")).toBeInTheDocument();
    expect(screen.getByText("-3.5%")).toBeInTheDocument();
    expect(screen.getByText("15.4조")).toBeInTheDocument();
    expect(screen.getByText(/거래대금 \(조원\)/)).toBeInTheDocument();
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

    // Toggle All Off / On
    const toggleOffBtn = screen.getByText("앵커 전체OFF");
    fireEvent.click(toggleOffBtn);

    const toggleOnBtn = screen.getByText("앵커 전체ON");
    fireEvent.click(toggleOnBtn);
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

  it("toggles line highlight when clicking anchor badges and base lines", () => {
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

    // Click VWAP button to highlight VWAP line
    const vwapBtn = screen.getByText("VWAP");
    fireEvent.click(vwapBtn);

    // Banner appears
    expect(screen.getByText(/선 강조 중/)).toBeInTheDocument();

    // Click release button
    const releaseBtn = screen.getByText("✕ 해제");
    fireEvent.click(releaseBtn);
    expect(screen.queryByText(/선 강조 중/)).not.toBeInTheDocument();
  });
});
