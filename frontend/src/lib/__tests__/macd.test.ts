import { describe, it, expect } from "vitest";
import { calculateMacd } from "../macd";

describe("calculateMacd", () => {
  it("returns empty arrays for empty input", () => {
    const result = calculateMacd([]);
    expect(result.points).toEqual([]);
    expect(result.macdSeries).toEqual([]);
    expect(result.signalSeries).toEqual([]);
    expect(result.histogramSeries).toEqual([]);
  });

  it("filters out invalid points", () => {
    const raw = [
      { time: "2024-01-01", close: NaN },
      { time: "", close: 100 },
      { time: "2024-01-02", close: 105 },
    ];
    const result = calculateMacd(raw);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].time).toBe("2024-01-02");
  });

  it("calculates correct MACD, Signal, and Histogram values", () => {
    const raw = [
      { time: "2024-01-01", close: 100 },
      { time: "2024-01-02", close: 105 },
      { time: "2024-01-03", close: 110 },
      { time: "2024-01-04", close: 108 },
      { time: "2024-01-05", close: 102 },
    ];
    const result = calculateMacd(raw);
    expect(result.points).toHaveLength(5);
    expect(result.macdSeries).toHaveLength(5);
    expect(result.signalSeries).toHaveLength(5);
    expect(result.histogramSeries).toHaveLength(5);

    // Check first bar is 0
    expect(result.points[0].macd).toBe(0);
    expect(result.points[0].signal).toBe(0);
    expect(result.points[0].histogram).toBe(0);
    expect(result.points[0].color).toBe("#22c55e"); // + and first bar -> green
  });

  it("applies 4-color histogram rules accurately", () => {
    // We construct prices to test:
    // 1. Positive and growing -> Green
    // 2. Positive and shrinking -> Gray
    // 3. Negative and growing (downward) -> Red
    // 4. Negative and shrinking (upward towards 0) -> Pink
    const raw = [
      { time: "2024-01-01", close: 100 },
      { time: "2024-01-02", close: 120 },
      { time: "2024-01-03", close: 140 },
      { time: "2024-01-04", close: 125 },
      { time: "2024-01-05", close: 90 },
      { time: "2024-01-06", close: 70 },
      { time: "2024-01-07", close: 85 },
      { time: "2024-01-08", close: 100 },
    ];

    const result = calculateMacd(raw);
    const colors = result.points.map((p) => p.color);

    // Bar 3 (index 3): growing positive -> green
    expect(result.points[3].histogram).toBeGreaterThan(0);
    expect(result.points[3].histogram).toBeGreaterThan(result.points[2].histogram);
    expect(colors[3]).toBe("#22c55e"); // Green

    // Bar 4 (index 4): shrinking positive -> gray
    expect(result.points[4].histogram).toBeGreaterThan(0);
    expect(result.points[4].histogram).toBeLessThan(result.points[3].histogram);
    expect(colors[4]).toBe("#9ca3af"); // Gray

    // Bar 6 (index 6): falling negative -> red
    expect(result.points[6].histogram).toBeLessThan(0);
    expect(result.points[6].histogram).toBeLessThan(result.points[5].histogram);
    expect(colors[6]).toBe("#ef4444"); // Red

    // Bar 7 (index 7): shrinking negative (rebounding towards 0) -> pink
    expect(result.points[7].histogram).toBeLessThan(0);
    expect(result.points[7].histogram).toBeGreaterThan(result.points[6].histogram);
    expect(colors[7]).toBe("#f472b6"); // Pink
  });
});
