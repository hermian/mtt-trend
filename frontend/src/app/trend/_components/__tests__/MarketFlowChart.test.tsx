import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MarketFlowChart } from "../MarketFlowChart";
import * as useMarketFlowDataModule from "@/hooks/useMarketFlowData";

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
let addSeriesMock = vi.fn();
let priceScaleMock = vi.fn();

// Mock lightweight-charts
vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => ({
    addSeries: addSeriesMock,
    remove: vi.fn(),
    timeScale: vi.fn(() => ({
      subscribeVisibleLogicalRangeChange: vi.fn(),
      setVisibleLogicalRange: vi.fn(),
      setVisibleRange: vi.fn(),
      scrollToPosition: vi.fn(),
    })),
    priceScale: priceScaleMock,
    subscribeCrosshairMove: vi.fn((cb) => {
      crosshairMoveCallbacks.push(cb);
    }),
    applyOptions: vi.fn(),
    setCrosshairPosition: vi.fn(),
  })),
  ColorType: { Solid: "solid" },
  LineSeries: "LineSeries",
  CrosshairMode: { Normal: 0 },
}));

const mockDates = ["2026-08-18", "2026-08-19"];

const mockFlowData = {
  data: [
    {
      date: "2026-08-19",
      time: "09:00",
      kospi_price: 6850.0,
      kospi200_price: 1080.0,
      kosdaq_price: 830.0,
      kq150_price: 14000.0,
      kospi_foreigner: 100.0,
      kospi_institution: -50.0,
      kospi_individual: -50.0,
      kospi_program: 30.0,
      kosdaq_foreigner: 20.0,
      kosdaq_institution: -10.0,
      kosdaq_individual: -10.0,
      future_foreigner: 200.0,
      future_institution: -100.0,
      future_individual: -100.0,
      emini_nasdaq_price: 29500.0,
    },
    {
      date: "2026-08-19",
      time: "09:05",
      kospi_price: 6870.0,
      kospi200_price: 1085.0,
      kosdaq_price: 832.0,
      kq150_price: 14050.0,
      kospi_foreigner: 250.0,
      kospi_institution: -100.0,
      kospi_individual: -150.0,
      kospi_program: 60.0,
      kosdaq_foreigner: 35.0,
      kosdaq_institution: -15.0,
      kosdaq_individual: -20.0,
      future_foreigner: 350.0,
      future_institution: -180.0,
      future_individual: -170.0,
      emini_nasdaq_price: 29550.0,
    },
  ],
};

describe("MarketFlowChart Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    crosshairMoveCallbacks = [];
    addSeriesMock.mockReturnValue({
      setData: vi.fn(),
      createPriceLine: vi.fn(),
      applyOptions: vi.fn(),
    });
    priceScaleMock.mockReturnValue({
      applyOptions: vi.fn(),
      width: vi.fn(() => 88),
    });

    vi.spyOn(useMarketFlowDataModule, "useMarketFlowDates").mockReturnValue({
      data: mockDates,
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useMarketFlowDataModule, "useMarketFlowData").mockReturnValue({
      data: mockFlowData,
      isLoading: false,
      error: null,
    } as any);
  });

  it("renders header, index buttons, and date selector", () => {
    renderWithClient(<MarketFlowChart />);

    expect(screen.getByText("시장 지수 & 수급 트렌드")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "KOSPI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "K200" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "KOSDAQ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "K150" })).toBeInTheDocument();
  });

  it("displays E-mini NQ in HUD and prices chart badge when KOSPI is selected", () => {
    renderWithClient(<MarketFlowChart />);

    // HUD has E-mini NQ label
    const hudNq = screen.getAllByText("E-mini NQ");
    expect(hudNq.length).toBeGreaterThanOrEqual(1);

    // Latest E-mini NQ price is rendered
    expect(screen.getByText(/29,550/)).toBeInTheDocument();
  });

  it("toggles E-mini NQ series overlay when clicking chart overlay badge", () => {
    renderWithClient(<MarketFlowChart />);

    const nqBadgeBtn = screen.getByRole("button", { name: /● E-mini NQ/ });
    expect(nqBadgeBtn).toBeInTheDocument();

    // Click to hide
    fireEvent.click(nqBadgeBtn);
    expect(nqBadgeBtn).toHaveAttribute("aria-pressed", "false");

    // Click to show again
    fireEvent.click(nqBadgeBtn);
    expect(nqBadgeBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("hides E-mini NQ from HUD when KOSDAQ is selected", () => {
    renderWithClient(<MarketFlowChart />);

    const kosdaqBtn = screen.getByRole("button", { name: "KOSDAQ" });
    fireEvent.click(kosdaqBtn);

    // E-mini NQ HUD should not be visible for KOSDAQ
    expect(screen.queryByRole("button", { name: /● E-mini NQ/ })).not.toBeInTheDocument();
  });
});
