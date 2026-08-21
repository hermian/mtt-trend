import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ETFDetailModal } from "../ETFDetailModal";
import type { ETFItem } from "../../_lib/types";

// Mock hooks and lightweight-charts
vi.mock("@/hooks/useReturnComparison", () => ({
  useReturnComparison: vi.fn(() => ({
    data: {
      start_date: "2025-08-21",
      end_date: "2026-08-21",
      series: [
        {
          code: "069500",
          name: "KODEX 200",
          market: "ETF",
          type: "etf",
          currency: "KRW",
          data: [
            { date: "2025-08-21", close: 35000, return_pct: 0 },
            { date: "2026-08-21", close: 42000, return_pct: 20.0 },
          ],
        },
      ],
      statistics: [
        {
          code: "069500",
          name: "KODEX 200",
          currency: "KRW",
          return_1y: 20.0,
          max_return: 25.5,
          min_return: -3.2,
          volatility: 14.8,
          end_price: 42000,
        },
      ],
      correlations: {},
      rolling_correlations: {},
    },
    isLoading: false,
    error: null,
  })),
}));

vi.mock("lightweight-charts", () => {
  const mockSeries = {
    setData: vi.fn(),
    createPriceLine: vi.fn(),
  };
  const mockChart = {
    addSeries: vi.fn(() => mockSeries),
    applyOptions: vi.fn(),
    timeScale: vi.fn(() => ({
      fitContent: vi.fn(),
    })),
    subscribeCrosshairMove: vi.fn(),
    remove: vi.fn(),
  };
  return {
    createChart: vi.fn(() => mockChart),
    ColorType: { Solid: "solid" },
    LineSeries: "Line",
    LineStyle: { Solid: 0, Dashed: 1 },
  };
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = MockResizeObserver as any;

const MOCK_ETF: ETFItem = {
  code: "069500",
  name: "KODEX 200",
  sector: "시장대표",
  marcap: 85000,
  returns: {
    "1D": 1.25,
    "1W": 2.5,
    "1M": -0.8,
    "3M": 5.4,
    "6M": 12.1,
    "1Y": 20.0,
    YTD: 15.3,
  },
};

describe("ETFDetailModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <ETFDetailModal
        isOpen={false}
        onClose={onClose}
        etf={MOCK_ETF}
        market="KR"
        selectedPeriod="1D"
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders ETF information and 3 destination links when open", () => {
    render(
      <ETFDetailModal
        isOpen={true}
        onClose={onClose}
        etf={MOCK_ETF}
        market="KR"
        selectedPeriod="1D"
      />
    );

    // Title and Code
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("KODEX 200")).toBeDefined();
    expect(screen.getByText("069500")).toBeDefined();
    expect(screen.getByText("국내 ETF")).toBeDefined();
    expect(screen.getByText("시장대표")).toBeDefined();

    // 1. app/streamlit link
    const streamlitLink = screen.getByText("1. app/streamlit 이동").closest("a");
    expect(streamlitLink).toBeDefined();
    expect(streamlitLink?.getAttribute("target")).toBe("_blank");
    expect(streamlitLink?.getAttribute("href")).toContain("search=KODEX");
    expect(streamlitLink?.getAttribute("href")).toContain("type=etf");

    // 2. AVWAP chart link
    const avwapLink = screen.getByText("2. AVWAP 차트 이동").closest("a");
    expect(avwapLink).toBeDefined();
    expect(avwapLink?.getAttribute("target")).toBe("_blank");
    expect(avwapLink?.getAttribute("href")).toContain("/trend?tab=avwap");
    expect(avwapLink?.getAttribute("href")).toContain("symbol=069500");

    // 3. Naver link
    const naverLink = screen.getByText("3. 네이버로 이동").closest("a");
    expect(naverLink).toBeDefined();
    expect(naverLink?.getAttribute("target")).toBe("_blank");
    expect(naverLink?.getAttribute("href")).toContain("stock.naver.com");

    // 1-Year Chart section
    expect(screen.getByText("최근 1년 수익률 실선 차트")).toBeDefined();
    expect(screen.getByText("+25.50%")).toBeDefined(); // Max return
    expect(screen.getByText("-3.20%")).toBeDefined(); // Min return
  });

  it("calls onClose when close button is clicked", () => {
    render(
      <ETFDetailModal
        isOpen={true}
        onClose={onClose}
        etf={MOCK_ETF}
        market="KR"
        selectedPeriod="1D"
      />
    );

    const closeButtons = screen.getAllByRole("button", { name: /닫기/i });
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when ESC key is pressed", () => {
    render(
      <ETFDetailModal
        isOpen={true}
        onClose={onClose}
        etf={MOCK_ETF}
        market="KR"
        selectedPeriod="1D"
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
