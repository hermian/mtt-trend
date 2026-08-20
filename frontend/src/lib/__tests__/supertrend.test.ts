import { describe, it, expect } from "vitest";
import {
  calculateSupertrend,
  DEFAULT_SUPERTREND_CONFIG,
  type SupertrendInputPoint,
} from "../supertrend";

describe("calculateSupertrend", () => {
  it("returns empty series data when input is empty", () => {
    const res = calculateSupertrend([]);
    expect(res.points).toEqual([]);
    expect(res.upLine).toEqual([]);
    expect(res.dnLine).toEqual([]);
    expect(res.buySignals).toEqual([]);
    expect(res.sellSignals).toEqual([]);
  });

  it("calculates supertrend for a single bar", () => {
    const data: SupertrendInputPoint[] = [
      { date: "2024-01-02", high: 100, low: 90, close: 95 },
    ];
    const res = calculateSupertrend(data, { atrPeriod: 10, multiplier: 3.0 });
    expect(res.points.length).toBe(1);
    const pt = res.points[0];
    expect(pt.trend).toBe(1);
    // src = 95, TR = 10, ATR = 10, basicUp = 95 - 30 = 65
    expect(pt.up).toBe(65);
    expect(pt.value).toBe(65);
    expect(res.upLine.length).toBe(1);
    expect(res.dnLine.length).toBe(0);
  });

  it("flips trend from up to down (Sell signal) when close breaks below trailing up band", () => {
    const data: SupertrendInputPoint[] = [
      { date: "2024-01-02", high: 100, low: 90, close: 95 },
      { date: "2024-01-03", high: 102, low: 94, close: 100 },
      { date: "2024-01-04", high: 105, low: 98, close: 104 },
      // Sudden drop below previous up band
      { date: "2024-01-05", high: 80, low: 60, close: 60 },
    ];

    const res = calculateSupertrend(data, { atrPeriod: 3, multiplier: 2.0 });
    expect(res.points.length).toBe(4);
    expect(res.points[0].trend).toBe(1);
    expect(res.points[1].trend).toBe(1);
    expect(res.points[2].trend).toBe(1);
    expect(res.points[3].trend).toBe(-1);
    expect(res.points[3].sellSignal).toBe(true);
    expect(res.sellSignals.length).toBe(1);
    expect(res.sellSignals[0].time).toBe("2024-01-05");
  });

  it("flips trend from down to up (Buy signal) when close breaks above trailing dn band", () => {
    const data: SupertrendInputPoint[] = [
      { date: "2024-01-02", high: 100, low: 90, close: 95 },
      { date: "2024-01-03", high: 80, low: 60, close: 60 }, // flips to down
      { date: "2024-01-04", high: 75, low: 58, close: 62 },
      { date: "2024-01-05", high: 110, low: 90, close: 108 }, // flips to up
    ];

    const res = calculateSupertrend(data, { atrPeriod: 3, multiplier: 2.0 });
    expect(res.points[1].trend).toBe(-1);
    expect(res.points[1].sellSignal).toBe(true);
    expect(res.points[3].trend).toBe(1);
    expect(res.points[3].buySignal).toBe(true);
    expect(res.buySignals.length).toBe(1);
    expect(res.buySignals[0].time).toBe("2024-01-05");
  });

  it("supports switching ATR calculation method between Wilder RMA and SMA", () => {
    const data: SupertrendInputPoint[] = [
      { date: "2024-01-02", high: 100, low: 90, close: 95 },
      { date: "2024-01-03", high: 105, low: 92, close: 102 },
      { date: "2024-01-04", high: 110, low: 98, close: 108 },
    ];

    const resRma = calculateSupertrend(data, { changeATR: true, atrPeriod: 2 });
    const resSma = calculateSupertrend(data, { changeATR: false, atrPeriod: 2 });

    expect(resRma.points.length).toBe(3);
    expect(resSma.points.length).toBe(3);
    expect(resRma.points[2].value).not.toBeNaN();
    expect(resSma.points[2].value).not.toBeNaN();
  });

  it("respects showSignals option", () => {
    const data: SupertrendInputPoint[] = [
      { date: "2024-01-02", high: 100, low: 90, close: 95 },
      { date: "2024-01-03", high: 80, low: 60, close: 60 },
    ];

    const resWithoutSignals = calculateSupertrend(data, { showSignals: false });
    expect(resWithoutSignals.buySignals).toEqual([]);
    expect(resWithoutSignals.sellSignals).toEqual([]);
  });
});
