/**
 * API 레이어 테스트
 * SPEC-MTT-002 F-03~F-05: API 연동 검증
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../api";
import axios from "axios";

// Mock axios
vi.mock("axios");

describe("API Layer", () => {
  const mockAxios = axios as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDates", () => {
    it("should fetch dates for 52w_high source", async () => {
      // Arrange
      const mockDates = ["2024-01-01", "2024-01-02", "2024-01-03"];
      mockAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          data: { dates: mockDates }
        })
      });

      // Act
      const result = await api.getDates("52w_high");

      // Assert
      expect(result).toEqual(mockDates);
    });

    it("should fetch dates for mtt source", async () => {
      // Arrange
      const mockDates = ["2024-01-01", "2024-01-02"];
      mockAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          data: { dates: mockDates }
        })
      });

      // Act
      const result = await api.getDates("mtt");

      // Assert
      expect(result).toEqual(mockDates);
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
      mockAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          data: { date: "2024-01-01", themes: mockThemes }
        })
      });

      // Act
      const result = await api.getThemesDaily("2024-01-01", "52w_high");

      // Assert
      expect(result).toEqual(mockThemes);
      expect(result.length).toBe(1);
      expect(result[0].theme_name).toBe("AI");
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
      mockAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          data: { date: "2024-01-01", threshold: 10, themes: mockSurging }
        })
      });

      // Act
      const result = await api.getThemesSurging("2024-01-01", 10, "52w_high");

      // Assert
      expect(result).toEqual(mockSurging);
      expect(result[0].rs_change).toBeGreaterThan(0);
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
      mockAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          data: { theme_name: "AI", days: 30, history: mockHistory }
        })
      });

      // Act
      const result = await api.getThemeHistory("AI", 30, "52w_high");

      // Assert
      expect(result).toEqual(mockHistory);
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
      mockAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          data: { days: 5, min_appearances: 3, stocks: mockStocks }
        })
      });

      // Act
      const result = await api.getStocksPersistent(5, 3, "52w_high");

      // Assert
      expect(result).toEqual(mockStocks);
      expect(result[0].appearance_count).toBeGreaterThanOrEqual(3);
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
      mockAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          data: { date: "2024-01-01", stocks: mockStocks }
        })
      });

      // Act
      const result = await api.getStocksGroupAction("2024-01-01", "52w_high");

      // Assert
      expect(result).toEqual(mockStocks);
      expect(result[0].rs_score).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      // Arrange
      mockAxios.create.mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error("Network Error"))
      });

      // Act & Assert
      await expect(api.getDates("52w_high")).rejects.toThrow("Network Error");
    });
  });
});
