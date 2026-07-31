import { describe, expect, it } from "vitest";
import {
  NEUTRAL,
  NEUTRAL_FILL,
  NULL_FILL,
  buildColorScale,
  heatColor,
  legendStops,
} from "../_lib/colors";
import { formatMarcap, formatReturn } from "../_lib/format";

describe("buildColorScale", () => {
  it("중립은 기간 테이블에서 온다", () => {
    const scale = buildColorScale([-12.5, -3, 0, 2, 8.1], "1M");
    expect(scale.neutral).toBe(NEUTRAL["1M"]);
  });

  it("경계는 p2/p98 — 극단 이상치는 잘린다", () => {
    // -50..50 분포 + 양끝 이상치 ±500
    const rets: number[] = [];
    for (let v = -50; v <= 50; v++) rets.push(v);
    rets.push(-500, 500);
    const scale = buildColorScale(rets, "1M");
    expect(scale.negBound).toBeCloseTo(-48.96, 2);
    expect(scale.posBound).toBeCloseTo(48.96, 2);
  });

  it("null만 있으면 경계 0", () => {
    const scale = buildColorScale([null, null], "1D");
    expect(scale.negBound).toBe(0);
    expect(scale.posBound).toBe(0);
  });

  it("한쪽만 있는 분포도 0 쪽 경계는 유지", () => {
    const scale = buildColorScale([5, 6, 7, 8, 9, 10], "1M");
    expect(scale.negBound).toBe(0);
    expect(scale.posBound).toBeGreaterThan(5);
  });
});

describe("heatColor", () => {
  const scale = buildColorScale([-20, 10], "1M"); // neutral 3.3

  it("null → 무채색", () => {
    expect(heatColor(null, scale).fill).toBe(NULL_FILL);
  });

  it("중립 구간 안 → 회색", () => {
    expect(heatColor(2.0, scale).fill).toBe(NEUTRAL_FILL);
    expect(heatColor(-3.3, scale).fill).toBe(NEUTRAL_FILL);
  });

  it("양수 경계 이상 → 진한 빨강", () => {
    const c = heatColor(10, scale);
    expect(c.fill).toBe("rgb(153, 27, 28)");
  });

  it("음수 경계 이하 → 진한 파랑", () => {
    const c = heatColor(-20, scale);
    expect(c.fill).toBe("rgb(30, 64, 175)");
  });

  it("중립 바로 위는 연한 빨강에 가깝다", () => {
    const c = heatColor(3.4, scale);
    expect(c.fill).toMatch(/^rgb\(25[0-4], 22[0-9], 22[0-9]\)$/);
  });
});

describe("legendStops", () => {
  it("음수·양수 구간이 있으면 8개 stops, 오름차순", () => {
    const scale = buildColorScale([-12, 6], "1M");
    const stops = legendStops(scale);
    expect(stops).toHaveLength(8);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i]).toBeGreaterThan(stops[i - 1]);
    }
  });

  it("한쪽 구간이 없으면 해당 쪽 stops 생략", () => {
    const scale = buildColorScale([5, 8], "1M"); // 양수만
    const stops = legendStops(scale);
    expect(stops).toHaveLength(5); // -n, +n, 1/3, 2/3, max
  });
});

describe("format", () => {
  it("formatMarcap: 조/억 단위", () => {
    expect(formatMarcap(12189490)).toBe("1219조");
    expect(formatMarcap(15000)).toBe("1.5조");
    expect(formatMarcap(10000)).toBe("1조");
    expect(formatMarcap(768.6)).toBe("769억");
  });

  it("formatReturn: 부호·소수점·N/A", () => {
    expect(formatReturn(null)).toBe("N/A");
    expect(formatReturn(12.345)).toBe("+12.35%");
    expect(formatReturn(-5.2)).toBe("-5.20%");
    expect(formatReturn(0)).toBe("0.00%");
  });
});
