/**
 * useStocks 훅 테스트
 * SPEC-MTT-002 F-05: 지속 강세 종목 화면
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useStocksPersistent, useStocksGroupAction } from "../useStocks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as api from "@/lib/api";

// Mock API module
vi.mock("@/lib/api");

describe("useStocks Hook", () => {
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

  describe("useStocksPersistent", () => {
    it("should fetch persistent strong stocks", async () => {
      // Arrange
      const mockStocks = [
        {
          stock_name: "Samsung Electronics",
          appearance_count: 5,
          avg_rs: 90.0,
          themes: ["AI", "Semiconductor"]
        },
        {
          stock_name: "SK Hynix",
          appearance_count: 4,
          avg_rs: 88.5,
          themes: ["Semiconductor"]
        }
      ];
      vi.spyOn(api.api, "getStocksPersistent").mockResolvedValue(mockStocks);

      // Act
      const { result } = renderHook(() => useStocksPersistent(5, 3, "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockStocks);
      expect(api.api.getStocksPersistent).toHaveBeenCalledWith(5, 3, "52w_high");
    });

    it("should fetch with custom parameters", async () => {
      // Arrange
      const mockStocks = [
        {
          stock_name: "Kakao",
          appearance_count: 7,
          avg_rs: 85.0,
          themes: ["Platform", "AI"]
        }
      ];
      vi.spyOn(api.api, "getStocksPersistent").mockResolvedValue(mockStocks);

      // Act
      const { result } = renderHook(() => useStocksPersistent(7, 5, "mtt"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.api.getStocksPersistent).toHaveBeenCalledWith(7, 5, "mtt");
    });

    it("should handle empty results", async () => {
      // Arrange
      vi.spyOn(api.api, "getStocksPersistent").mockResolvedValue([]);

      // Act
      const { result } = renderHook(() => useStocksPersistent(5, 3, "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it("should handle errors", async () => {
      // Arrange
      vi.spyOn(api.api, "getStocksPersistent").mockRejectedValue(new Error("Failed to fetch"));

      // Act
      const { result } = renderHook(() => useStocksPersistent(5, 3, "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
    });
  });

  describe("useStocksGroupAction", () => {
    it("should fetch group action stocks when date is provided", async () => {
      // Arrange
      const mockStocks = [
        {
          stock_name: "Samsung Electronics",
          rs_score: 95.0,
          change_pct: 3.5,
          theme_name: "Semiconductor",
          theme_rs_change: 5.0,
          first_seen_date: "2024-01-01"
        },
        {
          stock_name: "SK Hynix",
          rs_score: 92.0,
          change_pct: 2.8,
          theme_name: "Semiconductor",
          theme_rs_change: 5.0,
          first_seen_date: "2024-01-01"
        }
      ];
      vi.spyOn(api.api, "getStocksGroupAction").mockResolvedValue(mockStocks);

      // Act
      const { result } = renderHook(() => useStocksGroupAction("2024-01-01", "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockStocks);
      expect(api.api.getStocksGroupAction).toHaveBeenCalledWith("2024-01-01", "52w_high");
    });

    it("should not fetch when date is null", () => {
      // Arrange & Act
      const { result } = renderHook(() => useStocksGroupAction(null, "52w_high"), { wrapper });

      // Assert
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle empty results", async () => {
      // Arrange
      vi.spyOn(api.api, "getStocksGroupAction").mockResolvedValue([]);

      // Act
      const { result } = renderHook(() => useStocksGroupAction("2024-01-01", "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it("should handle errors", async () => {
      // Arrange
      vi.spyOn(api.api, "getStocksGroupAction").mockRejectedValue(new Error("Network error"));

      // Act
      const { result } = renderHook(() => useStocksGroupAction("2024-01-01", "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
    });
  });

  describe("Data Validation", () => {
    it("should filter stocks by minimum appearance count", async () => {
      // Arrange
      const mockStocks = [
        {
          stock_name: "Samsung Electronics",
          appearance_count: 5,
          avg_rs: 90.0,
          themes: ["AI", "Semiconductor"]
        }
      ];
      vi.spyOn(api.api, "getStocksPersistent").mockResolvedValue(mockStocks);

      // Act
      const { result } = renderHook(() => useStocksPersistent(5, 3, "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data![0].appearance_count).toBeGreaterThanOrEqual(3);
    });

    it("should validate group action stock structure", async () => {
      // Arrange
      const mockStocks = [
        {
          stock_name: "Test Stock",
          rs_score: 85.0,
          change_pct: 2.5,
          theme_name: "Test Theme",
          theme_rs_change: 3.0,
          first_seen_date: "2024-01-01"
        }
      ];
      vi.spyOn(api.api, "getStocksGroupAction").mockResolvedValue(mockStocks);

      // Act
      const { result } = renderHook(() => useStocksGroupAction("2024-01-01", "52w_high"), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const stock = result.current.data![0];
      expect(stock.stock_name).toBeDefined();
      expect(stock.rs_score).toBeGreaterThanOrEqual(0);
      expect(stock.change_pct).toBeDefined();
      expect(stock.theme_name).toBeDefined();
    });
  });
});
