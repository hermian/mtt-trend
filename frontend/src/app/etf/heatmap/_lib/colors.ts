import type { PeriodKey } from "./types";
import {
  percentile,
  type ColorScale,
  heatColor,
  NEUTRAL_FILL,
  NULL_FILL,
  UP_DEEP_CSS,
  DOWN_DEEP_CSS,
  legendStops,
} from "@/app/heatmap/_lib/colors";

/** 기간별 중립 구간 (±%). 이 안이면 회색. */
export const ETF_NEUTRAL: Record<PeriodKey, number> = {
  "1D": 1.0,
  "1W": 2.0,
  MTD: 3.3,
  YTD: 7.5,
  "3M": 6.0,
  "6M": 9.0,
  "1Y": 13.0,
  "3Y": 20.0,
  "5Y": 30.0,
};

export function buildETFColorScale(
  rets: Array<number | null>,
  period: PeriodKey
): ColorScale {
  const neutral = ETF_NEUTRAL[period] ?? 3.3;
  const valid = rets
    .filter((r): r is number => r !== null)
    .sort((a, b) => a - b);
  const neg = Math.min(0, percentile(valid, 0.02));
  const pos = Math.max(0, percentile(valid, 0.98));
  return { neutral, negBound: neg, posBound: pos };
}

export {
  heatColor,
  type ColorScale,
  NEUTRAL_FILL,
  NULL_FILL,
  UP_DEEP_CSS,
  DOWN_DEEP_CSS,
  legendStops,
};

export function formatReturn(val: number | null): string {
  if (val === null) return "N/A";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

