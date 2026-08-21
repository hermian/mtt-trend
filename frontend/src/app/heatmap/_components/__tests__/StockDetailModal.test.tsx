import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StockDetailModal } from "../StockDetailModal";
import type { StockHeatmapItem } from "@/lib/api";

// Mock hooks and lightweight-charts
vi.mock("@/hooks/useReturnComparison", () => ({
  useReturnComparison: vi.fn(() => ({
    data: {
      start_date: "2025-08-21",
      end_date: "2026-08-21",
      series: [
        {
          code: "005930",
          name: "삼성전자",
          market: "KOSPI",
          type: "stock",
          currency: "KRW",
          data: [
            { date: "2025-08-21", close: 60000, return_pct: 0 },
            { date: "2026-08-21", close: 75000, return_pct: 25.0 },
          ],
        },
      ],
      statistics: [
        {
          code: "005930",
          name: "삼성전자",
          currency: "KRW",
          return_1y: 25.0,
          max_return: 30.2,
          min_return: -5.1,
          volatility: 18.2,
          end_price: 75000,
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

const MOCK_STOCK: StockHeatmapItem = {
  code: "005930",
  name: "삼성전자",
  market: "KOSPI",
  marcap: 4500000,
  ret: 3.5,
  rs: 85,
  mmt: 90,
  weight: 165,
};

describe("StockDetailModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <StockDetailModal
        isOpen={false}
        onClose={onClose}
        stock={MOCK_STOCK}
        groupName="반도체"
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders stock information and 3 destination links when open", () => {
    render(
      <StockDetailModal
        isOpen={true}
        onClose={onClose}
        stock={MOCK_STOCK}
        groupName="반도체"
        periodLabel="1D"
      />
    );

    // Title and Code
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("삼성전자")).toBeDefined();
    expect(screen.getByText("005930")).toBeDefined();
    expect(screen.getByText("KOSPI")).toBeDefined();
    expect(screen.getByText("반도체")).toBeDefined();

    // 1. app/streamlit link
    const streamlitLink = screen.getByText("1. app/streamlit 이동").closest("a");
    expect(streamlitLink).toBeDefined();
    expect(streamlitLink?.getAttribute("target")).toBe("_blank");
    expect(streamlitLink?.getAttribute("href")).toContain("search=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90");
    expect(streamlitLink?.getAttribute("href")).toContain("type=stock");

    // 2. AVWAP chart link
    const avwapLink = screen.getByText("2. AVWAP 차트 이동").closest("a");
    expect(avwapLink).toBeDefined();
    expect(avwapLink?.getAttribute("target")).toBe("_blank");
    expect(avwapLink?.getAttribute("href")).toContain("/trend?tab=avwap");
    expect(avwapLink?.getAttribute("href")).toContain("symbol=005930");
    expect(avwapLink?.getAttribute("href")).toContain("type=stock");

    // 3. Naver link
    const naverLink = screen.getByText("3. 네이버로 이동").closest("a");
    expect(naverLink).toBeDefined();
    expect(naverLink?.getAttribute("target")).toBe("_blank");
    expect(naverLink?.getAttribute("href")).toContain("005930");

    // 1-Year Chart section
    expect(screen.getByText("최근 1년 수익률 실선 차트")).toBeDefined();
    expect(screen.getByText("+30.20%")).toBeDefined(); // Max return
    expect(screen.getByText("-5.10%")).toBeDefined(); // Min return
  });

  it("calls onClose when close button is clicked", () => {
    render(
      <StockDetailModal
        isOpen={true}
        onClose={onClose}
        stock={MOCK_STOCK}
        groupName="반도체"
      />
    );

    const closeButtons = screen.getAllByRole("button", { name: /닫기/i });
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when ESC key is pressed", () => {
    render(
      <StockDetailModal
        isOpen={true}
        onClose={onClose}
        stock={MOCK_STOCK}
        groupName="반도체"
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
