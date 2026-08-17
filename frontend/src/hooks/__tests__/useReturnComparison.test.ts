/**
 * useReturnComparison 훅 테스트
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReturnComparison } from "../useReturnComparison";
import * as api from "@/lib/api";
import type { ReactNode } from "react";

vi.mock("@/lib/api");

const MOCK_RETURN_RESPONSE = {
  start_date: "2025-08-01",
  end_date: "2026-08-14",
  series: [
    {
      code: "005930",
      name: "삼성전자",
      market: "KOSPI",
      type: "stock",
      currency: "KRW",
      color: "#3b82f6",
      data: [
        { date: "2025-08-01", close: 70000, return_pct: 0.0 },
        { date: "2026-08-14", close: 77000, return_pct: 10.0 },
      ],
    },
    {
      code: "NVDA",
      name: "NVIDIA",
      market: "US",
      type: "us_stock",
      currency: "USD",
      color: "#f97316",
      data: [
        { date: "2025-08-01", close: 100, return_pct: 0.0 },
        { date: "2026-08-14", close: 120, return_pct: 20.0 },
      ],
    },
  ],
  statistics: [
    {
      code: "005930",
      name: "삼성전자",
      start_price: 70000,
      end_price: 77000,
      currency: "KRW",
      return_1w: 1.5,
      return_1m: 3.2,
      return_3m: 5.0,
      return_6m: 8.1,
      return_1y: 10.0,
      return_ytd: 7.2,
      period_return: 10.0,
      max_return: 12.0,
      min_return: -2.0,
      mean_return: 5.5,
      volatility: 1.2,
    },
  ],
  correlations: {
    "3M": { labels: ["삼성전자", "NVIDIA"], matrix: [[1.0, 0.45], [0.45, 1.0]] },
    "6M": { labels: ["삼성전자", "NVIDIA"], matrix: [[1.0, 0.50], [0.50, 1.0]] },
  },
  rolling_correlations: {
    "3M": [
      {
        pair: "삼성전자 vs NVIDIA",
        data: [{ date: "2026-08-14", corr: 0.45 }],
      },
    ],
  },
};

describe("useReturnComparison Hook", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("fetches return comparison when items are provided", async () => {
    vi.mocked(api.api.compareReturns).mockResolvedValue(MOCK_RETURN_RESPONSE as never);
    const items = [
      { code: "005930", name: "삼성전자", market: "KOSPI", type: "stock" },
      { code: "NVDA", name: "NVIDIA", market: "US", type: "us_stock" },
    ];

    const { result } = renderHook(() => useReturnComparison(items, "2025-08-01", "2026-08-14"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_RETURN_RESPONSE);
    expect(api.api.compareReturns).toHaveBeenCalledWith({
      items,
      start_date: "2025-08-01",
      end_date: "2026-08-14",
    });
  });

  it("disabled when items are empty", async () => {
    const { result } = renderHook(() => useReturnComparison([], "2025-08-01", "2026-08-14"), {
      wrapper,
    });
    expect(api.api.compareReturns).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
