import { describe, it, expect } from "vitest";
import {
  calculateAtrMultiple,
  getAtrMultipleStatus,
  type AtrMultipleInputPoint,
} from "../atrMultiple";

describe("atrMultiple", () => {
  describe("getAtrMultipleStatus", () => {
    it("classifies levels correctly based on hermian/screener#294 and note.com", () => {
      expect(getAtrMultipleStatus(10.5).label).toContain("극단과열");
      expect(getAtrMultipleStatus(10.0).label).toContain("극단과열");
      expect(getAtrMultipleStatus(10.0).color).toBe("#ef4444");

      expect(getAtrMultipleStatus(7.5).label).toContain("과열");
      expect(getAtrMultipleStatus(7.0).label).toContain("과열");
      expect(getAtrMultipleStatus(7.0).color).toBe("#f97316");

      expect(getAtrMultipleStatus(4.5).label).toContain("추세확장");
      expect(getAtrMultipleStatus(4.0).label).toContain("추세확장");
      expect(getAtrMultipleStatus(4.0).color).toBe("#eab308");

      expect(getAtrMultipleStatus(2.5).label).toContain("추세초입");
      expect(getAtrMultipleStatus(2.0).label).toContain("추세초입");
      expect(getAtrMultipleStatus(2.0).color).toBe("#22c55e");

      expect(getAtrMultipleStatus(0.5).label).toContain("수렴");
      expect(getAtrMultipleStatus(0.0).label).toContain("수렴");
      expect(getAtrMultipleStatus(0.0).color).toBe("#38bdf8");

      expect(getAtrMultipleStatus(-1.5).label).toContain("50MA하회");
      expect(getAtrMultipleStatus(-1.5).color).toBe("#94a3b8");
    });
  });

  describe("calculateAtrMultiple", () => {
    it("returns empty arrays for empty input", () => {
      const res = calculateAtrMultiple([]);
      expect(res.points).toEqual([]);
      expect(res.series).toEqual([]);
    });

    it("calculates values for all valid bars to ensure 1:1 timeline alignment with main chart", () => {
      const bars: AtrMultipleInputPoint[] = Array.from({ length: 49 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, "0")}`,
        high: 105,
        low: 95,
        close: 100,
      }));
      const res = calculateAtrMultiple(bars, { smaPeriod: 50 });
      expect(res.points).toHaveLength(49);
      expect(res.series).toHaveLength(49);
      expect(res.points[0].time).toBe(bars[0].time);
      expect(res.points[48].time).toBe(bars[48].time);
    });

    it("matches note.com formula and calculations", () => {
      const bars: AtrMultipleInputPoint[] = Array.from({ length: 60 }, (_, i) => ({
        time: `2024-01-${String(i + 1).padStart(2, "0")}`,
        high: 270,
        low: 260,
        close: 265.39,
      }));

      const res = calculateAtrMultiple(bars, { smaPeriod: 50, atrPeriod: 14 });
      expect(res.points.length).toBe(60);
      expect(res.series.length).toBe(60);

      // When close equals SMA, disparity is 0 and ATR multiple is 0
      expect(res.points[59].value).toBeCloseTo(0, 4);
      expect(res.points[59].label).toContain("수렴");
    });

    it("filters out invalid points with NaN or non-positive values", () => {
      const bars: AtrMultipleInputPoint[] = Array.from({ length: 60 }, (_, i) => {
        if (i === 10) {
          return { time: "2024-01-11", high: NaN, low: 90, close: 100 };
        }
        return {
          time: `2024-01-${String(i + 1).padStart(2, "0")}`,
          high: 105,
          low: 95,
          close: 100,
        };
      });

      const res = calculateAtrMultiple(bars, { smaPeriod: 50 });
      // 59 valid points -> 59 points
      expect(res.points.length).toBe(59);
    });
  });
});
