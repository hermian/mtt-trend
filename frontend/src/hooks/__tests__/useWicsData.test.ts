/**
 * useWicsData 랭킹 훅 테스트
 *
 * 회귀 방지: 구간(start/end) 없이 호출하면 서버가 전체 이력을 반환한다
 * (`/api/charts/wics-rankings` 15.6MB, `127.0.0.1` 기준 0.32s).
 * WicsRankingPanel 의 구간 상태는 months/weeks 로딩 후에 설정되므로,
 * enabled 가드가 없으면 마운트 시점에 무파라미터 호출이 나가 전체 이력을
 * 받아온 뒤 버린다. 이 테스트가 그 가드를 고정한다.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWicsRankings, useWicsWeeklyRankings } from "../useWicsData";
import * as api from "@/lib/api";
import type { ReactNode } from "react";

vi.mock("@/lib/api");

describe("useWicsData rankings hooks", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("fetches monthly rankings when both month bounds are set", async () => {
    vi.mocked(api.api.getWicsRankings).mockResolvedValue({ months: [] } as never);
    const { result } = renderHook(() => useWicsRankings("2025-09", "2026-09"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.api.getWicsRankings).toHaveBeenCalledWith("2025-09", "2026-09");
  });

  it("monthly disabled without any bound", async () => {
    const { result } = renderHook(() => useWicsRankings(undefined, undefined), { wrapper });
    await waitFor(() => expect(api.api.getWicsRankings).not.toHaveBeenCalled());
    expect(result.current.isError).toBe(false);
  });

  it("monthly disabled when only one bound is set", async () => {
    const { result } = renderHook(() => useWicsRankings("2025-09", undefined), { wrapper });
    await waitFor(() => expect(api.api.getWicsRankings).not.toHaveBeenCalled());
    expect(result.current.isError).toBe(false);
  });

  it("fetches weekly rankings when both week bounds are set", async () => {
    vi.mocked(api.api.getWicsWeeklyRankings).mockResolvedValue({ months: [] } as never);
    const { result } = renderHook(() => useWicsWeeklyRankings("2026-W14", "2026-W37"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.api.getWicsWeeklyRankings).toHaveBeenCalledWith("2026-W14", "2026-W37");
  });

  it("weekly disabled without any bound", async () => {
    const { result } = renderHook(() => useWicsWeeklyRankings(undefined, undefined), { wrapper });
    await waitFor(() => expect(api.api.getWicsWeeklyRankings).not.toHaveBeenCalled());
    expect(result.current.isError).toBe(false);
  });
});
