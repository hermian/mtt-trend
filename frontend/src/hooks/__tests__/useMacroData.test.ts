import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useMacroData } from "../useMacroData";
import { api } from "@/lib/api";
import React, { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock API module
vi.mock("@/lib/api", () => ({
  api: {
    getMacroData: vi.fn(),
  },
}));

// Helper wrapper for QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe("useMacroData Hook", () => {
  it("should fetch macro data successfully", async () => {
    const mockData = {
      data: [
        { date: "2026-06-24", sp500: 5000, high_yield: 3.1, cnn_fgi: 45 },
        { date: "2026-06-25", sp500: 5010, high_yield: 3.2, cnn_fgi: 50 },
      ],
    };

    vi.mocked(api.getMacroData).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useMacroData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(api.getMacroData).toHaveBeenCalledTimes(1);
    expect(api.getMacroData).toHaveBeenCalledWith(undefined, undefined);
  });

  it("should pass startDate to the API", async () => {
    vi.mocked(api.getMacroData).mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useMacroData("2024-07-22"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getMacroData).toHaveBeenCalledWith("2024-07-22", undefined);
  });
});
