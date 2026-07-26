"use client";

import { HeatmapCell } from "./HeatmapCell";
import type { ETFItem, PeriodKey } from "../_lib/types";

interface HeatmapGroupProps {
  label: string;
  etfs: ETFItem[];
  period: PeriodKey;
  onHover?: (etf: ETFItem | null) => void;
}

/** 서브카테고리 라벨(좌) + 타일 행(우) — 스노우볼72 스타일 */
export function HeatmapGroup({
  label,
  etfs,
  period,
  onHover,
}: HeatmapGroupProps) {
  const showLabel = Boolean(label);

  return (
    <div
      className={`min-w-0 ${
        showLabel ? "grid grid-cols-[4.5rem_1fr] gap-2 items-start" : ""
      }`}
    >
      {showLabel && (
        <h3 className="pt-1 text-[11px] font-semibold leading-tight text-gray-400">
          {label}
        </h3>
      )}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-5">
        {etfs.map((etf) => (
          <HeatmapCell
            key={`${label}-${etf.code}-${etf.name}`}
            etf={etf}
            period={period}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  );
}
