/**
 * API 레이어 단위 테스트 (단순화 버전)
 *
 * 파라미터 전달 검증과 응답 구조 확인에만 집중합니다.
 * 실제 데이터 값 검증은 제외하여 백엔드 데이터 변경 시의 regression을 방지합니다.
 *
 * SPEC-MTT-002 F-03~F-05: API 연동 검증
 * SPEC-MTT-006: 파라미터화 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock apiClient module
vi.mock("../apiClient", () => ({
  apiClient: {
    get: vi.fn(),
  },
  API_CONFIG: {
    BASE_URL: "http://localhost:8000",
    TIMEOUT: 10000,
    DEFAULT_STALE_TIME: 5 * 60 * 1000,
  },
}));

import { api } from "../api";
import { apiClient } from "../apiClient";

const mockedGet = vi.mocked(apiClient.get);

describe("API Layer - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDates", () => {
    it("should call API with correct params for 52w_high source", async () => {
      mockedGet.mockResolvedValue({ data: { dates: [] } });

      await api.getDates("52w_high");

      expect(mockedGet).toHaveBeenCalledWith("/api/dates", {
        params: { source: "52w_high" },
      });
    });

    it("should return array of dates", async () => {
      const mockDates = ["2024-01-01", "2024-01-02"];
      mockedGet.mockResolvedValue({ data: { dates: mockDates } });

      const result = await api.getDates("52w_high");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockDates);
    });
  });

  describe("getThemesDaily", () => {
    it("should call API with correct params", async () => {
      mockedGet.mockResolvedValue({
        data: { date: "2024-01-01", themes: [] },
      });

      await api.getThemesDaily("2024-01-01", "52w_high");

      expect(mockedGet).toHaveBeenCalledWith("/api/themes/daily", {
        params: { date: "2024-01-01", source: "52w_high" },
      });
    });

    it("should return array of themes", async () => {
      const mockThemes = [{ theme_name: "Test", stock_count: 1 }];
      mockedGet.mockResolvedValue({
        data: { date: "2024-01-01", themes: mockThemes },
      });

      const result = await api.getThemesDaily("2024-01-01", "52w_high");

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getThemesSurging", () => {
    it("should call API with correct params including threshold", async () => {
      mockedGet.mockResolvedValue({
        data: { date: "2024-01-01", threshold: 10, themes: [] },
      });

      await api.getThemesSurging("2024-01-01", 10, "52w_high");

      expect(mockedGet).toHaveBeenCalledWith("/api/themes/surging", {
        params: { date: "2024-01-01", threshold: 10, source: "52w_high" },
      });
    });

    it("should use default threshold=10 when not provided", async () => {
      mockedGet.mockResolvedValue({
        data: { date: "2024-01-01", threshold: 10, themes: [] },
      });

      await api.getThemesSurging("2024-01-01");

      expect(mockedGet).toHaveBeenCalledWith("/api/themes/surging", {
        params: expect.objectContaining({ threshold: 10 }),
      });
    });
  });

  describe("getThemeHistory", () => {
    it("should call API with correct params", async () => {
      mockedGet.mockResolvedValue({
        data: { theme_name: "AI", days: 30, history: [] },
      });

      await api.getThemeHistory("AI", 30, "52w_high");

      expect(mockedGet).toHaveBeenCalledWith("/api/themes/AI/history", {
        params: { days: 30, source: "52w_high" },
      });
    });

    it("should encode theme name for URL", async () => {
      mockedGet.mockResolvedValue({
        data: { theme_name: "AI & ML", days: 30, history: [] },
      });

      await api.getThemeHistory("AI & ML", 30, "52w_high");

      expect(mockedGet).toHaveBeenCalledWith(
        "/api/themes/AI%20%26%20ML/history",
        expect.any(Object)
      );
    });
  });

  describe("getStocksPersistent", () => {
    it("should call API with correct params", async () => {
      mockedGet.mockResolvedValue({
        data: { days: 5, min_appearances: 3, stocks: [] },
      });

      await api.getStocksPersistent(5, 3, "52w_high");

      expect(mockedGet).toHaveBeenCalledWith("/api/stocks/persistent", {
        params: { days: 5, min: 3, source: "52w_high" },
      });
    });
  });

  describe("getStocksGroupAction", () => {
    // SPEC-MTT-006: 파라미터화 테스트
    it("should use default params (timeWindow=3, rsThreshold=0)", async () => {
      mockedGet.mockResolvedValue({
        data: { date: "2024-01-15", stocks: [] },
      });

      await api.getStocksGroupAction("2024-01-15", "52w_high");

      expect(mockedGet).toHaveBeenCalledWith("/api/stocks/group-action", {
        params: expect.objectContaining({
          timeWindow: 3,
          rsThreshold: 0,
        }),
      });
    });

    it("should pass timeWindow parameter", async () => {
      mockedGet.mockResolvedValue({
        data: { date: "2024-01-15", stocks: [] },
      });

      await api.getStocksGroupAction("2024-01-15", "52w_high", 7);

      expect(mockedGet).toHaveBeenCalledWith("/api/stocks/group-action", {
        params: expect.objectContaining({ timeWindow: 7 }),
      });
    });

    it("should pass rsThreshold parameter", async () => {
      mockedGet.mockResolvedValue({
        data: { date: "2024-01-15", stocks: [] },
      });

      await api.getStocksGroupAction("2024-01-15", "52w_high", 3, 10);

      expect(mockedGet).toHaveBeenCalledWith("/api/stocks/group-action", {
        params: expect.objectContaining({ rsThreshold: 10 }),
      });
    });

    it("should handle negative rsThreshold", async () => {
      mockedGet.mockResolvedValue({
        data: { date: "2024-01-15", stocks: [] },
      });

      await api.getStocksGroupAction("2024-01-15", "52w_high", 3, -5);

      expect(mockedGet).toHaveBeenCalledWith("/api/stocks/group-action", {
        params: expect.objectContaining({ rsThreshold: -5 }),
      });
    });

    it("should return array with status_threshold field", async () => {
      const mockStocks = [
        {
          stock_name: "Test Stock",
          rs_score: 95.0,
          status_threshold: 5,
        },
      ];
      mockedGet.mockResolvedValue({
        data: { date: "2024-01-01", stocks: mockStocks },
      });

      const result = await api.getStocksGroupAction("2024-01-15", "52w_high");

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("status_threshold");
    });
  });

  describe("Error Handling", () => {
    it("should propagate API errors", async () => {
      const mockError = new Error("Network Error");
      mockedGet.mockRejectedValue(mockError);

      await expect(api.getDates("52w_high")).rejects.toThrow("Network Error");
    });
  });
});
