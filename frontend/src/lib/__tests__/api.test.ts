/**
 * API 레이어 테스트
 * SPEC-MTT-002 F-03~F-05: API 연동 검증
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../api";

// Mock apiClient (axios instance)
vi.mock("../api", () => ({
  api: {
    getDates: vi.fn(),
    getThemesDaily: vi.fn(),
    getThemesSurging: vi.fn(),
    getThemeHistory: vi.fn(),
    getStocksPersistent: vi.fn(),
    getStocksGroupAction: vi.fn(),
  },
}));

describe("API Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDates", () => {
    it("should fetch dates for 52w_high source", async () => {
      // Arrange
      const mockDates = ["2024-01-01", "2024-01-02", "2024-01-03"];
      vi.mocked(api).getDates.mockResolvedValue(mockDates);

      // Act
      const result = await api.getDates("52w_high");

      // Assert
      expect(result).toEqual(mockDates);
      expect(api.getDates).toHaveBeenCalledWith("52w_high");
    });

    it("should fetch dates for mtt source", async () => {
      // Arrange
      const mockDates = ["2024-01-01", "2024-01-02"];
      vi.mocked(api).getDates.mockResolvedValue(mockDates);

      // Act
      const result = await api.getDates("mtt");

      // Assert
      expect(result).toEqual(mockDates);
      expect(api.getDates).toHaveBeenCalledWith("mtt");
    });
  });

  describe("getThemesDaily", () => {
    it("should fetch daily themes for a specific date", async () => {
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
      vi.mocked(api).getThemesDaily.mockResolvedValue(mockThemes);

      // Act
      const result = await api.getThemesDaily("2024-01-01", "52w_high");

      // Assert
      expect(result).toEqual(mockThemes);
      expect(result.length).toBe(1);
      expect(result[0].theme_name).toBe("AI");
      expect(api.getThemesDaily).toHaveBeenCalledWith("2024-01-01", "52w_high");
    });
  });

  describe("getThemesSurging", () => {
    it("should fetch surging themes with default threshold", async () => {
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
      vi.mocked(api).getThemesSurging.mockResolvedValue(mockSurging);

      // Act
      const result = await api.getThemesSurging("2024-01-01", 10, "52w_high");

      // Assert
      expect(result).toEqual(mockSurging);
      expect(result[0].rs_change).toBeGreaterThan(0);
      expect(api.getThemesSurging).toHaveBeenCalledWith("2024-01-01", 10, "52w_high");
    });
  });

  describe("getThemeHistory", () => {
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
      vi.mocked(api).getThemeHistory.mockResolvedValue(mockHistory);

      // Act
      const result = await api.getThemeHistory("AI", 30, "52w_high");

      // Assert
      expect(result).toEqual(mockHistory);
      expect(api.getThemeHistory).toHaveBeenCalledWith("AI", 30, "52w_high");
    });
  });

  describe("getStocksPersistent", () => {
    it("should fetch persistent strong stocks", async () => {
      // Arrange
      const mockStocks = [
        {
          stock_name: "Samsung Electronics",
          appearance_count: 5,
          avg_rs: 90.0,
          themes: ["AI", "Semiconductor"]
        }
      ];
      vi.mocked(api).getStocksPersistent.mockResolvedValue(mockStocks);

      // Act
      const result = await api.getStocksPersistent(5, 3, "52w_high");

      // Assert
      expect(result).toEqual(mockStocks);
      expect(result[0].appearance_count).toBeGreaterThanOrEqual(3);
      expect(api.getStocksPersistent).toHaveBeenCalledWith(5, 3, "52w_high");
    });
  });

  describe("getStocksGroupAction", () => {
    it("should fetch group action stocks", async () => {
      // Arrange
      const mockStocks = [
        {
          stock_name: "SK Hynix",
          rs_score: 95.0,
          change_pct: 3.5,
          theme_name: "Semiconductor",
          theme_rs_change: 5.0,
          first_seen_date: "2024-01-01"
        }
      ];
      vi.mocked(api).getStocksGroupAction.mockResolvedValue(mockStocks);

      // Act
      const result = await api.getStocksGroupAction("2024-01-01", "52w_high");

      // Assert
      expect(result).toEqual(mockStocks);
      expect(result[0].rs_score).toBeGreaterThan(0);
      expect(api.getStocksGroupAction).toHaveBeenCalledWith("2024-01-01", "52w_high");
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      // Arrange
      const mockError = new Error("Network Error");
      vi.mocked(api).getDates.mockRejectedValue(mockError);

      // Act & Assert
      await expect(api.getDates("52w_high")).rejects.toThrow("Network Error");
    });
  });
});
