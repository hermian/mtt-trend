import { describe, it, expect } from "vitest";
import {
  calculateStochasticSlow,
  calculateMultiStochasticSlow,
  STOCH_CONFIGS,
} from "../stochastic";

describe("calculateStochasticSlow", () => {
  it("returns empty array for empty input", () => {
    expect(calculateStochasticSlow([], STOCH_CONFIGS.short)).toEqual([]);
  });

  it("calculates accurate slow stochastic values", () => {
    const bars = [
      { time: "2024-01-01", high: 100, low: 90, close: 95 }, // range 10, close 95 -> fastK 50, slowK 50, slowD 50
      { time: "2024-01-02", high: 110, low: 95, close: 105 },
      { time: "2024-01-03", high: 115, low: 100, close: 110 },
      { time: "2024-01-04", high: 120, low: 105, close: 115 },
      { time: "2024-01-05", high: 125, low: 110, close: 120 },
    ];

    const res = calculateStochasticSlow(bars, STOCH_CONFIGS.short);
    expect(res).toHaveLength(5);
    expect(res[0].k).toBe(50);
    expect(res[0].d).toBe(50);
    res.forEach((pt) => {
      expect(pt.k).toBeGreaterThanOrEqual(0);
      expect(pt.k).toBeLessThanOrEqual(100);
      expect(pt.d).toBeGreaterThanOrEqual(0);
      expect(pt.d).toBeLessThanOrEqual(100);
    });
  });
});

describe("calculateMultiStochasticSlow", () => {
  it("calculates short(5,3,3), mid(10,6,6), and long(20,12,12)", () => {
    const bars = Array.from({ length: 30 }, (_, i) => ({
      time: `2024-01-${String(i + 1).padStart(2, "0")}`,
      high: 100 + i * 2 + (i % 2 === 0 ? 5 : -2),
      low: 90 + i * 2 - (i % 2 === 0 ? 2 : 5),
      close: 95 + i * 2,
    }));

    const res = calculateMultiStochasticSlow(bars);
    expect(res.short).toHaveLength(30);
    expect(res.mid).toHaveLength(30);
    expect(res.long).toHaveLength(30);

    // Verify all values are within 0-100
    for (let i = 0; i < 30; i++) {
      expect(res.short[i].k).toBeGreaterThanOrEqual(0);
      expect(res.short[i].k).toBeLessThanOrEqual(100);
      expect(res.mid[i].k).toBeGreaterThanOrEqual(0);
      expect(res.mid[i].k).toBeLessThanOrEqual(100);
      expect(res.long[i].k).toBeGreaterThanOrEqual(0);
      expect(res.long[i].k).toBeLessThanOrEqual(100);
    }
  });

  it("filters out invalid bars with NaN or null", () => {
    const bars = [
      { time: "2024-01-01", high: 100, low: 90, close: 95 },
      { time: "2024-01-02", high: NaN, low: 90, close: 95 },
      { time: "", high: 105, low: 95, close: 100 },
      { time: "2024-01-03", high: 110, low: 100, close: 105 },
    ];
    const res = calculateMultiStochasticSlow(bars);
    expect(res.short).toHaveLength(2);
    expect(res.short[0].time).toBe("2024-01-01");
    expect(res.short[1].time).toBe("2024-01-03");
    expect(res.shortSeries).toHaveLength(2);
    expect(res.shortSeries[0]).toHaveProperty("value");
    expect(res.midSeries).toHaveLength(2);
    expect(res.longSeries).toHaveLength(2);
  });
});
