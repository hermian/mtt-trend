import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AvwapChart from "../AvwapChart";
import * as useAvwapChartModule from "@/hooks/useAvwapChart";

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
    ],
    preset_dates: ["2021-06-28"],
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

    render(<AvwapChart />);

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
    expect(screen.getByText("MDD (%)")).toBeInTheDocument();
    expect(screen.getByText("-3.5%")).toBeInTheDocument();
    expect(screen.getByText("15.4조")).toBeInTheDocument();
    expect(screen.getByText(/거래대금 \(조원\) & SMA/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/종목명 또는 코드/)).toBeInTheDocument();
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

    render(<AvwapChart />);

    const kosdaqBtn = screen.getByText("KOSDAQ");
    fireEvent.click(kosdaqBtn);

    const weeklyBtn = screen.getByText("주봉");
    fireEvent.click(weeklyBtn);

    expect(useAvwapSpy).toHaveBeenCalledWith("kosdaq", "1W", null);
  });

  it("allows searching and selecting a stock", () => {
    const useAvwapSpy = vi.spyOn(useAvwapChartModule, "useAvwapChart").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useAvwapChartModule, "useStockSearch").mockReturnValue({
      data: [{ code: "005930", name: "삼성전자", market: "KOSPI" }],
      isLoading: false,
    } as any);

    render(<AvwapChart />);

    const input = screen.getByPlaceholderText(/종목명 또는 코드/);
    fireEvent.change(input, { target: { value: "삼성" } });

    const stockOption = screen.getByText("삼성전자");
    expect(stockOption).toBeInTheDocument();
    fireEvent.click(stockOption);

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

    render(<AvwapChart />);

    const anchorBadge = screen.getByText(/2021-06-28/);
    expect(anchorBadge).toBeInTheDocument();
    fireEvent.click(anchorBadge);

    const offAllBtn = screen.getByText("앵커 전체OFF");
    fireEvent.click(offAllBtn);

    const onAllBtn = screen.getByText("앵커 전체ON");
    fireEvent.click(onAllBtn);
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

    render(<AvwapChart />);

    const logBtn = screen.getByText("로그(Log)");
    const linearBtn = screen.getByText("선형(Linear)");

    expect(logBtn).toBeInTheDocument();
    expect(linearBtn).toBeInTheDocument();
    expect(screen.getByText("[LOG]")).toBeInTheDocument();

    // Click Linear
    fireEvent.click(linearBtn);
    expect(screen.getByText("[LINEAR]")).toBeInTheDocument();

    // Click Log again
    fireEvent.click(logBtn);
    expect(screen.getByText("[LOG]")).toBeInTheDocument();
  });
});
