import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HeatmapTooltip } from "../HeatmapTooltip";
import type { ETFItem } from "../../_lib/types";

// Mock useReturnComparison
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
            { date: "2026-01-15", close: 38000, return_pct: 8.5 },
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

const MOCK_ETF: ETFItem = {
  code: "069500",
  name: "KODEX 200",
  sector: "시장대표",
  marcap: 85000,
  returns: {
    "1D": 1.25,
    "1W": -2.5,
    MTD: 5.8,
    "3M": -4.2,
    "6M": 12.1,
    "1Y": 20.0,
    YTD: 15.3,
    "3Y": null,
    "5Y": null,
  },
};

describe("HeatmapTooltip", () => {
  it("renders ETF name, code, sector and 1-year price line chart", () => {
    render(<HeatmapTooltip etf={MOCK_ETF} market="KR" />);

    expect(screen.getByText("KODEX 200")).toBeDefined();
    expect(screen.getByText("069500")).toBeDefined();
    expect(screen.getByText("시장대표")).toBeDefined();
    expect(screen.getByText("시총 8.5조원")).toBeDefined();

    // Chart label and svg
    expect(screen.getByText(/최근 1년 주가 추이 \(실선 차트\)/i)).toBeDefined();
    expect(
      screen.getByRole("img", { name: /KODEX 200 최근 1년 주가 실선 차트/i })
    ).toBeDefined();

    // 1Y Return badge
    expect(screen.getByText(/1년 \+20\.00%/i)).toBeDefined();

    // End price
    expect(screen.getByText("₩42,000")).toBeDefined();

    // Date range
    expect(screen.getByText("2025-08-21")).toBeDefined();
    expect(screen.getByText("2026-08-21")).toBeDefined();
  });
});
