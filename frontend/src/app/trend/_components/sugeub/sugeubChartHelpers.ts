import type { SupplyDemandPoint } from "@/lib/api";
import { toChartTime } from "../_lib/chartTime";

/** LWC 시리즈 — 마지막 가격 가로 점선/라벨 비표시 (프로젝트 차트 규칙) */
export const SUGEB_LINE_OPTS = {
  lastValueVisible: false,
  priceLineVisible: false,
  title: "",
} as const;

export type SugeubRangePreset =
  | "1m"
  | "3m"
  | "6m"
  | "1y"
  | "2y"
  | "3y"
  | "5y"
  | "10y"
  | "all";

export const DEFAULT_SUGEB_RANGE: SugeubRangePreset = "2y";

export const SUGEB_RANGE_PRESETS: { id: SugeubRangePreset; label: string }[] = [
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "2y", label: "2Y" },
  { id: "3y", label: "3Y" },
  { id: "5y", label: "5Y" },
  { id: "10y", label: "10Y" },
  { id: "all", label: "전체" },
];

const TRADING_DAYS_MAP: Record<Exclude<SugeubRangePreset, "all">, number> = {
  "1m": 21,
  "3m": 63,
  "6m": 126,
  "1y": 252,
  "2y": 252 * 2,
  "3y": 252 * 3,
  "5y": 252 * 5,
  "10y": 252 * 10,
};

export function logicalRangeForPreset(
  seriesLength: number,
  preset: SugeubRangePreset
): { from: number; to: number } {
  const to = Math.max(0, seriesLength - 1);
  if (preset === "all" || seriesLength <= 0) return { from: 0, to };
  const count = TRADING_DAYS_MAP[preset] ?? 252 * 2;
  const from = Math.max(0, to - count);
  return { from, to };
}

/** 동일 타임라인 유지 — null 값은 whitespace(갭)로 처리 */
export function toSugeubLineData(
  series: SupplyDemandPoint[],
  getValue: (p: SupplyDemandPoint) => number | null | undefined
): Array<{ time: string; value?: number }> {
  const out: Array<{ time: string; value?: number }> = [];
  for (const p of series) {
    const time = toChartTime(p.date);
    if (!time) continue;
    const v = getValue(p);
    if (v != null && !Number.isNaN(v)) {
      out.push({ time, value: v });
    } else {
      out.push({ time });
    }
  }
  return out;
}
