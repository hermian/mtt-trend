import { describe, expect, it } from "vitest";
import { toChartTime, toFiniteNumber } from "./chartTime";

describe("toChartTime", () => {
  it("strips pandas/polars nanosecond ISO used by kospi_mtt.csv", () => {
    expect(toChartTime("1995-05-02T00:00:00.000000000")).toBe("1995-05-02");
  });

  it("keeps already-normalized business days", () => {
    expect(toChartTime("2026-08-14")).toBe("2026-08-14");
  });

  it("returns null for invalid values", () => {
    expect(toChartTime("")).toBeNull();
    expect(toChartTime(null)).toBeNull();
    expect(toChartTime("not-a-date")).toBeNull();
  });
});

describe("toFiniteNumber", () => {
  it("rejects NaN/Infinity that would crash lightweight-charts setData", () => {
    expect(toFiniteNumber(Number.NaN)).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(12)).toBe(12);
  });
});
