import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InteractiveChart, { IndicatorConfig } from "../InteractiveChart";
import * as useChartDataModule from "@/hooks/useChartData";

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

let crosshairMoveCallbacks: ((param: any) => void)[] = [];

// Mock lightweight-charts
vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
      createPriceLine: vi.fn(),
      applyOptions: vi.fn(),
    })),
    remove: vi.fn(),
    timeScale: vi.fn(() => ({
      subscribeVisibleLogicalRangeChange: vi.fn(),
      getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 100 })),
      setVisibleLogicalRange: vi.fn(),
      setVisibleRange: vi.fn(),
      scrollToPosition: vi.fn(),
    })),
    priceScale: vi.fn(() => ({
      applyOptions: vi.fn(),
    })),
    subscribeCrosshairMove: vi.fn((cb) => {
      crosshairMoveCallbacks.push(cb);
    }),
  })),
  ColorType: { Solid: "solid" },
  CandlestickSeries: "CandlestickSeries",
  LineSeries: "LineSeries",
  HistogramSeries: "HistogramSeries",
  AreaSeries: "AreaSeries",
  BaselineSeries: "BaselineSeries",
  CrosshairMode: { Normal: 0 },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
}));

const mockConfigs: IndicatorConfig[] = [
  { id: "main", name: "주가 (OHLC)", type: "candlestick", heightRatio: 5 },
  { id: "disparity_sma50", name: "SMA50 이격도", type: "line", heightRatio: 2, color: "#eab308" },
];

const mockChartData = {
  symbol: "KOSPI",
  data: [
    {
      time: "2024-01-02",
      open: 2500,
      high: 2520,
      low: 2490,
      close: 2510,
      volume: 1000000,
      indicators: { price_sma50: 2500, price_sma200: 2450, disparity_sma50: 100.4 },
    },
    {
      time: "2024-01-03",
      open: 2510,
      high: 2530,
      low: 2500,
      close: 2525,
      volume: 1200000,
      indicators: { price_sma50: 2505, price_sma200: 2455, disparity_sma50: 100.8 },
    },
    {
      time: "2024-01-04",
      open: 2525,
      high: 2550,
      low: 2520,
      close: 2540,
      volume: 1100000,
      indicators: { price_sma50: 2510, price_sma200: 2460, disparity_sma50: 101.2 },
    },
    {
      time: "2024-01-05",
      open: 2540,
      high: 2560,
      low: 2530,
      close: 2555,
      volume: 1300000,
      indicators: { price_sma50: 2515, price_sma200: 2465, disparity_sma50: 101.6 },
    },
  ],
};

describe("InteractiveChart Component", () => {
  beforeEach(() => {
    crosshairMoveCallbacks = [];
    vi.clearAllMocks();
  });

  it("renders chart header with HP toggle button and status", () => {
    vi.spyOn(useChartDataModule, "useChartData").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);

    renderWithClient(<InteractiveChart symbol="KOSPI" configs={mockConfigs} />);

    expect(screen.getByText("KOSPI")).toBeInTheDocument();
    expect(screen.getByText("HP ON")).toBeInTheDocument();
    expect(screen.getByText("Sync Latest")).toBeInTheDocument();
  });

  it("toggles HP filter on and off", () => {
    vi.spyOn(useChartDataModule, "useChartData").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);

    renderWithClient(<InteractiveChart symbol="KOSPI" configs={mockConfigs} />);

    const hpBtn = screen.getByText("HP ON");
    expect(hpBtn).toBeInTheDocument();

    // Toggle off
    fireEvent.click(hpBtn);
    expect(screen.getByText("HP OFF")).toBeInTheDocument();

    // Toggle on
    fireEvent.click(screen.getByText("HP OFF"));
    expect(screen.getByText("HP ON")).toBeInTheDocument();
  });

  it("does not render any HP deviation/disparity bottom panel", () => {
    vi.spyOn(useChartDataModule, "useChartData").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);

    const { container } = renderWithClient(<InteractiveChart symbol="KOSPI" configs={mockConfigs} />);

    // Main and disparity_sma50 panels exist
    expect(container.querySelector('[data-chart-id="main"]')).toBeInTheDocument();
    expect(container.querySelector('[data-chart-id="disparity_sma50"]')).toBeInTheDocument();

    // No hp_dev panel is present in DOM
    expect(container.querySelector('[data-chart-id="hp_dev"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-chart-id="hp"]')).not.toBeInTheDocument();
  });

  it("renders above_sma200 panel and creates a dashed white horizontal price line at 50", () => {
    vi.spyOn(useChartDataModule, "useChartData").mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
    } as any);

    const configs: IndicatorConfig[] = [
      { id: "above_sma_group", name: "Above SMA 10/20/50 (R/G/B)", type: "line", heightRatio: 1.5 },
      { id: "above_sma200", name: "Above SMA 200 (Breadth)", type: "line", heightRatio: 1, color: "#60a5fa" },
    ];

    const { container } = renderWithClient(<InteractiveChart symbol="KOSPI" configs={configs} />);

    expect(container.querySelector('[data-chart-id="above_sma200"]')).toBeInTheDocument();
  });
});
