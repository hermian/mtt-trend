import { describe, it, expect } from "vitest";
import {
  hpFilter,
  hpDeviationPercent,
  hpFilterSeries,
  HP_LAMBDA_WEEKLY,
  HP_LAMBDA_DAILY,
} from "../hpFilter";

describe("hpFilter", () => {
  it("빈 배열은 빈 결과를 반환한다", () => {
    expect(hpFilter([])).toEqual({ trend: [], cycle: [] });
  });

  it("관측치가 4개 미만이면 원본을 추세로 반환한다", () => {
    const y = [1, 2, 3];
    const { trend, cycle } = hpFilter(y, 1600);
    expect(trend).toEqual(y);
    expect(cycle).toEqual([0, 0, 0]);
  });

  it("직선 시계열에서는 추세가 원본에 가깝다", () => {
    const y = Array.from({ length: 50 }, (_, i) => 100 + i);
    const { trend, cycle } = hpFilter(y, HP_LAMBDA_WEEKLY);
    const mae =
      trend.reduce((s, t, i) => s + Math.abs(t - y[i]), 0) / y.length;
    expect(mae).toBeLessThan(0.5);
    const cycleMae =
      cycle.reduce((s, c) => s + Math.abs(c), 0) / cycle.length;
    expect(cycleMae).toBeLessThan(0.5);
  });

  it("고주파 노이즈는 순환 성분으로 흡수되고 추세는 매끄럽다", () => {
    const n = 80;
    const y = Array.from({ length: n }, (_, i) => {
      const base = 100 + 0.5 * i;
      return base + (i % 2 === 0 ? 5 : -5);
    });
    const { trend } = hpFilter(y, HP_LAMBDA_WEEKLY);
    // 추세의 2차 차분 크기가 원본보다 작아야 함
    const rough = (arr: number[]) => {
      let s = 0;
      for (let i = 2; i < arr.length; i++) {
        const d2 = arr[i] - 2 * arr[i - 1] + arr[i - 2];
        s += d2 * d2;
      }
      return s;
    };
    expect(rough(trend)).toBeLessThan(rough(y) * 0.1);
  });

  it("λ가 클수록 추세가 더 매끄럽다", () => {
    const y = Array.from({ length: 60 }, (_, i) => Math.sin(i / 3) * 10 + i);
    const tSmall = hpFilter(y, 100).trend;
    const tLarge = hpFilter(y, HP_LAMBDA_DAILY).trend;
    const roughness = (arr: number[]) => {
      let s = 0;
      for (let i = 2; i < arr.length; i++) {
        const d2 = arr[i] - 2 * arr[i - 1] + arr[i - 2];
        s += d2 * d2;
      }
      return s;
    };
    expect(roughness(tLarge)).toBeLessThan(roughness(tSmall));
  });

  it("추세 + 순환 = 원본을 복원한다", () => {
    const y = [10, 12, 11, 15, 14, 18, 17, 20, 19, 22];
    const { trend, cycle } = hpFilter(y, 1600);
    trend.forEach((t, i) => {
      expect(t + cycle[i]).toBeCloseTo(y[i], 8);
    });
  });
});

describe("hpDeviationPercent", () => {
  it("추세와 같으면 100을 반환한다", () => {
    expect(hpDeviationPercent([50, 100], [50, 100])).toEqual([100, 100]);
  });

  it("FinJump 스타일: 지수/추세×100", () => {
    // KOSPI 예시: 6257.45 / 7579.29 ≈ 82.56
    const dev = hpDeviationPercent([6257.45], [7579.29]);
    expect(dev[0]).toBeCloseTo(82.56, 1);
  });

  it("추세 0이면 100으로 폴백한다", () => {
    expect(hpDeviationPercent([10], [0])).toEqual([100]);
  });
});

describe("hpFilterSeries", () => {
  it("time을 유지한 추세·이탈 시리즈를 반환한다", () => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      time: `2024-01-${String(i + 1).padStart(2, "0")}`,
      value: 100 + i + (i % 3 === 0 ? 2 : 0),
    }));
    const { trend, deviation } = hpFilterSeries(data, HP_LAMBDA_WEEKLY);
    expect(trend).toHaveLength(20);
    expect(deviation).toHaveLength(20);
    expect(trend[0].time).toBe(data[0].time);
    expect(deviation[5].value).toBeCloseTo(
      (data[5].value / trend[5].value) * 100,
      5,
    );
  });
});
