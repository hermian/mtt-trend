/**
 * API 레이어 테스트
 * SPEC-MTT-002 F-03~F-05: API 연동 검증
 * SPEC-MTT-006: 파라미터화 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../api";

// Mock apiClient (axios instance)
vi.mock("../api", async () => {
  const actual = await vi.importActual("../api");
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
    },
  };
});

describe("API Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Get the mocked apiClient
  const getApiClient = async () => (await import("../api")).apiClient;

  describe("getDates", () => {
    it("should fetch dates for 52w_high source", async () => {
      const mockDates = ["2024-01-01", "2024-01-02", "2024-01-03"];
      const apiClient = (await import("../api")).apiClient;
      vi.mocked(apiClient.get).mockResolvedValue({ data: { dates: mockDates } });

      const result = await api.getDates("52w_high");

      expect(result).toEqual(mockDates);
    });

    it("should fetch dates for mtt source", async () => {
      const mockDates = ["2024-01-01", "2024-01-02"];
      const apiClient = (await import("../api")).apiClient;
      vi.mocked(apiClient.get).mockResolvedValue({ data: { dates: mockDates } });

      const result = await api.getDates("mtt");

      expect(result).toEqual(mockDates);
    });
  });

  describe("getThemesDaily", () => {
    it("should fetch daily themes for a specific date", async () => {
      const mockThemes = [
        {
          date: "2024-01-01",
          theme_name: "AI",
          stock_count: 10,
          avg_rs: 85.5,
          change_sum: 5.2,
          volume_sum: 1000000,
        },
      ];
      const apiClient = (await import("../api")).apiClient;
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { date: "2024-01-01", themes: mockThemes },
      });

      const result = await api.getThemesDaily("2024-01-01", "52w_high");

      expect(result).toEqual(mockThemes);
      expect(result[0].theme_name).toBe("AI");
    });
  });

  describe("getThemesSurging", () => {
    it("should fetch surging themes with default threshold", async () => {
      const mockSurging = [
        {
          date: "2024-01-01",
          theme_name: "Semiconductor",
          avg_rs: 90.0,
          avg_rs_5d: 80.0,
          rs_change: 10.0,
          stock_count: 15,
        },
      ];
      const apiClient = (await import("../api")).apiClient;
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { date: "2024-01-01", threshold: 10, themes: mockSurging },
      });

      const result = await api.getThemesSurging("2024-01-01", 10, "52w_high");

      expect(result).toEqual(mockSurging);
      expect(result[0].rs_change).toBeGreaterThan(0);
    });
  });

  describe("getThemeHistory", () => {
    it("should fetch theme history for 30 days", async () => {
      const mockHistory = [
        {
          date: "2024-01-01",
          theme_name: "AI",
          avg_rs: 85.0,
          stock_count: 10,
          change_sum: 5.2,
        },
      ];
      const apiClient = (await import("../api")).apiClient;
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { theme_name: "AI", days: 30, history: mockHistory },
      });

      const result = await api.getThemeHistory("AI", 30, "52w_high");

      expect(result).toEqual(mockHistory);
    });
  });

  describe("getStocksPersistent", () => {
    it("should fetch persistent strong stocks", async () => {
      const mockStocks = [
        {
          stock_name: "Samsung Electronics",
          appearance_count: 5,
          avg_rs: 90.0,
          themes: ["AI", "Semiconductor"],
        },
      ];
      const apiClient = (await import("../api")).apiClient;
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { days: 5, min_appearances: 3, stocks: mockStocks },
      });

      const result = await api.getStocksPersistent(5, 3, "52w_high");

      expect(result).toEqual(mockStocks);
      expect(result[0].appearance_count).toBeGreaterThanOrEqual(3);
    });
  });

  describe("getStocksGroupAction", () => {
    it("should fetch group action stocks", async () => {
      const mockStocks = [
        {
          stock_name: "SK Hynix",
          rs_score: 95.0,
          change_pct: 3.5,
          theme_name: "Semiconductor",
          theme_rs_change: 5.0,
          first_seen_date: "2024-01-01",
          status_threshold: 5,
        },
      ];
      const apiClient = (await import("../api")).apiClient;
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { date: "2024-01-01", stocks: mockStocks },
      });

      const result = await api.getStocksGroupAction("2024-01-01", "52w_high");

      expect(result).toEqual(mockStocks);
      expect(result[0].rs_score).toBeGreaterThan(0);
    });
  });

  // SPEC-MTT-006: 파라미터화 테스트
  describe("getStocksGroupAction - SPEC-MTT-006", () => {
    describe("timeWindow 파라미터", () => {
      it("기본값(3)으로 호출 시 timeWindow=3이 전달되어야 함", async () => {
        const mockStocks: any[] = [];
        const apiClient = (await import("../api")).apiClient;
        vi.mocked(apiClient.get).mockResolvedValue({
          data: { date: "2024-01-15", stocks: mockStocks },
        });

        await api.getStocksGroupAction("2024-01-15", "52w_high");

        expect(apiClient.get).toHaveBeenCalledWith("/api/stocks/group-action", {
          params: expect.objectContaining({
            timeWindow: 3,
            rsThreshold: 0,
          }),
        });
      });

      it("timeWindow=5로 호출 시 API에 전달되어야 함", async () => {
        const mockStocks: any[] = [];
        const apiClient = (await import("../api")).apiClient;
        vi.mocked(apiClient.get).mockResolvedValue({
          data: { date: "2024-01-15", stocks: mockStocks },
        });

        await api.getStocksGroupAction("2024-01-15", "52w_high", 5);

        expect(apiClient.get).toHaveBeenCalledWith("/api/stocks/group-action", {
          params: expect.objectContaining({
            timeWindow: 5,
          }),
        });
      });

      it("timeWindow=7로 호출 시 API에 전달되어야 함", async () => {
        const mockStocks: any[] = [];
        const apiClient = (await import("../api")).apiClient;
        vi.mocked(apiClient.get).mockResolvedValue({
          data: { date: "2024-01-15", stocks: mockStocks },
        });

        await api.getStocksGroupAction("2024-01-15", "52w_high", 7);

        expect(apiClient.get).toHaveBeenCalledWith("/api/stocks/group-action", {
          params: expect.objectContaining({
            timeWindow: 7,
          }),
        });
      });
    });

    describe("rsThreshold 파라미터", () => {
      it("기본값(0)으로 호출 시 rsThreshold=0이 전달되어야 함", async () => {
        const mockStocks: any[] = [];
        const apiClient = (await import("../api")).apiClient;
        vi.mocked(apiClient.get).mockResolvedValue({
          data: { date: "2024-01-15", stocks: mockStocks },
        });

        await api.getStocksGroupAction("2024-01-15", "52w_high");

        expect(apiClient.get).toHaveBeenCalledWith("/api/stocks/group-action", {
          params: expect.objectContaining({
            rsThreshold: 0,
          }),
        });
      });

      it("rsThreshold=5로 호출 시 API에 전달되어야 함", async () => {
        const mockStocks: any[] = [];
        const apiClient = (await import("../api")).apiClient;
        vi.mocked(apiClient.get).mockResolvedValue({
          data: { date: "2024-01-15", stocks: mockStocks },
        });

        await api.getStocksGroupAction("2024-01-15", "52w_high", 3, 5);

        expect(apiClient.get).toHaveBeenCalledWith("/api/stocks/group-action", {
          params: expect.objectContaining({
            rsThreshold: 5,
          }),
        });
      });

      it("rsThreshold=-5로 호출 시 API에 전달되어야 함", async () => {
        const mockStocks: any[] = [];
        const apiClient = (await import("../api")).apiClient;
        vi.mocked(apiClient.get).mockResolvedValue({
          data: { date: "2024-01-15", stocks: mockStocks },
        });

        await api.getStocksGroupAction("2024-01-15", "52w_high", 3, -5);

        expect(apiClient.get).toHaveBeenCalledWith("/api/stocks/group-action", {
          params: expect.objectContaining({
            rsThreshold: -5,
          }),
        });
      });
    });

    describe("파라미터 조합", () => {
      it("모든 파라미터를 조합하여 호출할 수 있어야 함", async () => {
        const mockStocks: any[] = [];
        const apiClient = (await import("../api")).apiClient;
        vi.mocked(apiClient.get).mockResolvedValue({
          data: { date: "2024-01-15", stocks: mockStocks },
        });

        await api.getStocksGroupAction("2024-01-15", "52w_high", 5, 10);

        expect(apiClient.get).toHaveBeenCalledWith("/api/stocks/group-action", {
          params: expect.objectContaining({
            timeWindow: 5,
            rsThreshold: 10,
          }),
        });
      });
    });

    describe("status_threshold 필드", () => {
      it("응답에 status_threshold 필드가 포함되어야 함", async () => {
        const mockStocks = [
          {
            stock_name: "SK Hynix",
            rs_score: 95.0,
            change_pct: 3.5,
            theme_name: "Semiconductor",
            theme_rs_change: 5.0,
            first_seen_date: "2024-01-01",
            status_threshold: 5,
          },
        ];
        const apiClient = (await import("../api")).apiClient;
        vi.mocked(apiClient.get).mockResolvedValue({
          data: { date: "2024-01-01", stocks: mockStocks },
        });

        const result = await api.getStocksGroupAction("2024-01-15", "52w_high");

        expect(result[0]).toHaveProperty("status_threshold", 5);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      const mockError = new Error("Network Error");
      const apiClient = (await import("../api")).apiClient;
      vi.mocked(apiClient.get).mockRejectedValue(mockError);

      // Act & Assert
      await expect(api.getDates("52w_high")).rejects.toThrow("Network Error");
    });
  });
});
