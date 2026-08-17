/**
 * useTop30 / useTop30Dates 훅 테스트
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTop30, useTop30Dates } from "../useTop30";
import * as api from "@/lib/api";
import type { ReactNode } from "react";

vi.mock("@/lib/api");

const MOCK_RESPONSE = {
  date: "2026-08-14",
  market: "all",
  compare_days: 5,
  compare_date: "2026-08-07",
  compare_available: true,
  window_dates: ["2026-08-07", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"],
  stocks: [
    {
      code: "005930", name: "삼성전자", market: "KOSPI", marcap: 16048.0,
      rank: 1, previous_rank: 1, rank_delta: 0, new_entrant: false,
      series: [1, 1, 1, 1, 1],
    },
    {
      code: "402340", name: "SK스퀘어", market: "KOSPI", marcap: 1522.8,
      rank: 3, previous_rank: null, rank_delta: null, new_entrant: true,
      series: [9, 8, 6, 4, 3],
    },
  ],
};

describe("useTop30 Hook", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("fetches top30 with date/market/compareDays", async () => {
    vi.mocked(api.api.getTop30).mockResolvedValue(MOCK_RESPONSE as never);
    const { result } = renderHook(() => useTop30("2026-08-14", "all", 5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_RESPONSE);
    expect(api.api.getTop30).toHaveBeenCalledWith("2026-08-14", "all", 5);
  });

  it("disabled without a date", async () => {
    const { result } = renderHook(() => useTop30(null, "kospi", 20), { wrapper });
    await waitFor(() => expect(api.api.getTop30).not.toHaveBeenCalled());
    expect(result.current.isError).toBe(false);
  });

  it("fetches available dates", async () => {
    vi.mocked(api.api.getTop30Dates).mockResolvedValue({ dates: ["2026-08-14", "2026-08-13"] } as never);
    const { result } = renderHook(() => useTop30Dates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.dates).toEqual(["2026-08-14", "2026-08-13"]);
  });
});