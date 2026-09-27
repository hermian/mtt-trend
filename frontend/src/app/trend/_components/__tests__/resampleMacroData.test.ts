import { describe, it, expect } from "vitest";
import {
  resampleMacroData,
  getWeekKey,
  TIMEFRAMES,
  type FakePoint,
} from "../MacroChart";

describe("resampleMacroData & getWeekKey", () => {
  it("should have correct TIMEFRAMES metadata", () => {
    expect(TIMEFRAMES).toEqual([
      { id: "daily", label: "일" },
      { id: "weekly", label: "주" },
      { id: "monthly", label: "월" },
    ]);
  });

  describe("getWeekKey", () => {
    it("should calculate UTC Monday date consistently regardless of local timezone", () => {
      // 2026-08-31 is Monday, 2026-09-04 is Friday, 2026-09-06 is Sunday
      expect(getWeekKey("2026-08-31")).toBe("2026-08-31");
      expect(getWeekKey("2026-09-01")).toBe("2026-08-31");
      expect(getWeekKey("2026-09-04")).toBe("2026-08-31");
      expect(getWeekKey("2026-09-06")).toBe("2026-08-31");

      // Next Monday
      expect(getWeekKey("2026-09-07")).toBe("2026-09-07");
      expect(getWeekKey("2026-09-11")).toBe("2026-09-07");
    });
  });

  describe("resampleMacroData", () => {
    const mockPoints: FakePoint[] = [
      // Week 1 (2026-08-31 Mon ~ 2026-09-04 Fri)
      { date: "2026-08-31", time: "2026-08-31", sp500: 5000, unrate: 4.1 },
      { date: "2026-09-01", time: "2026-09-01", sp500: 5010, unrate: 4.1 },
      { date: "2026-09-04", time: "2026-09-04", sp500: 5020, unrate: 4.1 },
      // Week 2 (2026-09-07 Mon ~ 2026-09-11 Fri)
      { date: "2026-09-07", time: "2026-09-07", sp500: 5030, unrate: 4.1 },
      { date: "2026-09-11", time: "2026-09-11", sp500: 5050, unrate: 4.1 },
      // Month 10 (2026-10-01 Thu ~ 2026-10-02 Fri)
      { date: "2026-10-01", time: "2026-10-01", sp500: 5100, unrate: 4.0 },
      { date: "2026-10-02", time: "2026-10-02", sp500: 5120, unrate: 4.0 },
    ];

    it("returns original array for daily timeframe", () => {
      const result = resampleMacroData(mockPoints, "daily");
      expect(result).toBe(mockPoints);
      expect(result.length).toBe(7);
    });

    it("returns empty array when input is empty", () => {
      expect(resampleMacroData([], "weekly")).toEqual([]);
      expect(resampleMacroData([], "monthly")).toEqual([]);
    });

    it("correctly resamples to weekly bars taking the last trading day of each week", () => {
      const weekly = resampleMacroData(mockPoints, "weekly");
      expect(weekly.length).toBe(3);

      // Week 1 last trading day: 2026-09-04
      expect(weekly[0].date).toBe("2026-09-04");
      expect(weekly[0].sp500).toBe(5020);

      // Week 2 last trading day: 2026-09-11
      expect(weekly[1].date).toBe("2026-09-11");
      expect(weekly[1].sp500).toBe(5050);

      // Week 3 last trading day: 2026-10-02
      expect(weekly[2].date).toBe("2026-10-02");
      expect(weekly[2].sp500).toBe(5120);
    });

    it("correctly resamples to monthly bars taking the last trading day of each month", () => {
      const monthly = resampleMacroData(mockPoints, "monthly");
      expect(monthly.length).toBe(3);

      // August last trading day: 2026-08-31
      expect(monthly[0].date).toBe("2026-08-31");
      expect(monthly[0].sp500).toBe(5000);

      // September last trading day: 2026-09-11
      expect(monthly[1].date).toBe("2026-09-11");
      expect(monthly[1].sp500).toBe(5050);

      // October last trading day: 2026-10-02
      expect(monthly[2].date).toBe("2026-10-02");
      expect(monthly[2].sp500).toBe(5120);
      expect(monthly[2].unrate).toBe(4.0);
    });
  });
});
