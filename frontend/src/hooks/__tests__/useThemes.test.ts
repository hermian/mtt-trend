/**
 * useThemes 훅 테스트
 * SPEC-MTT-002 F-03: 테마 트렌드 화면
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDates, useThemesDaily, useThemesSurging, useThemeHistory, useMultipleThemeHistories } from "../useThemes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as api from "@/lib/api";

// Mock API module
vi.mock("@/lib/api");

describe("useThemes Hook", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useDates", () => {
    it("should fetch dates for 52w_high source", async () => {
      // Arrange
      const mockDates = ["2024-01-01", "2024-01-02", "2024-01-03"];
      vi.spyOn(api, "api").mockResolvedValue(mockDates);

      // Act
      const { result } = renderHook(() => useDates("52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockDates);
    });

    it("should fetch dates for mtt source", async () => {
      // Arrange
      const mockDates = ["2024-01-01", "2024-01-02"];
      vi.spyOn(api.api, "getDates").mockResolvedValue(mockDates);

      // Act
      const { result } = renderHook(() => useDates("mtt"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockDates);
    });

    it("should have loading state initially", () => {
      // Arrange & Act
      const { result } = renderHook(() => useDates("52w_high"), { wrapper });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });

    it("should handle errors", async () => {
      // Arrange
      vi.spyOn(api.api, "getDates").mockRejectedValue(new Error("Failed to fetch"));

      // Act
      const { result } = renderHook(() => useDates("52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
    });
  });

  describe("useThemesDaily", () => {
    it("should fetch daily themes when date is provided", async () => {
      // Arrange
      const mockThemes = [
        {
          date: "2024-01-01",
          theme_name: "AI",
          stock_count: 10,
          avg_rs: 85.5,
          change_sum: 5.2,
          volume_sum: 1000000
        }
      ];
      vi.spyOn(api.api, "getThemesDaily").mockResolvedValue(mockThemes);

      // Act
      const { result } = renderHook(() => useThemesDaily("2024-01-01", "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockThemes);
    });

    it("should not fetch when date is null", () => {
      // Arrange & Act
      const { result } = renderHook(() => useThemesDaily(null, "52w_high"), { wrapper });

      // Assert
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useThemesSurging", () => {
    it("should fetch surging themes with threshold", async () => {
      // Arrange
      const mockSurging = [
        {
          date: "2024-01-01",
          theme_name: "Semiconductor",
          avg_rs: 90.0,
          avg_rs_5d: 80.0,
          rs_change: 10.0,
          stock_count: 15
        }
      ];
      vi.spyOn(api.api, "getThemesSurging").mockResolvedValue(mockSurging);

      // Act
      const { result } = renderHook(() => useThemesSurging("2024-01-01", 10, "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSurging);
      expect(api.api.getThemesSurging).toHaveBeenCalledWith("2024-01-01", 10, "52w_high");
    });
  });

  describe("useThemeHistory", () => {
    it("should fetch theme history for 30 days", async () => {
      // Arrange
      const mockHistory = [
        {
          date: "2024-01-01",
          theme_name: "AI",
          avg_rs: 85.0,
          stock_count: 10,
          change_sum: 5.2
        }
      ];
      vi.spyOn(api.api, "getThemeHistory").mockResolvedValue(mockHistory);

      // Act
      const { result } = renderHook(() => useThemeHistory("AI", 30, "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockHistory);
    });
  });

  describe("useMultipleThemeHistories", () => {
    it("should fetch multiple theme histories in parallel", async () => {
      // Arrange
      const mockHistories = {
        "AI": [{ date: "2024-01-01", theme_name: "AI", avg_rs: 85.0, stock_count: 10, change_sum: 5.2 }],
        "Semiconductor": [{ date: "2024-01-01", theme_name: "Semiconductor", avg_rs: 90.0, stock_count: 15, change_sum: 7.5 }]
      };
      vi.spyOn(api.api, "getThemeHistory")
        .mockResolvedValueOnce(mockHistories["AI"])
        .mockResolvedValueOnce(mockHistories["Semiconductor"]);

      // Act
      const { result } = renderHook(() => useMultipleThemeHistories(["AI", "Semiconductor"], 30, "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockHistories);
    });

    it("should not fetch when theme names array is empty", () => {
      // Arrange & Act
      const { result } = renderHook(() => useMultipleThemeHistories([], 30, "52w_high"), { wrapper });

      // Assert
      expect(result.current.fetchStatus).toBe("idle");
    });
  });
});
