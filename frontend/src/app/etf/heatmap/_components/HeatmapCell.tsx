"use client";

import { formatReturn, getHeatStyle } from "../_lib/colors";
import type { ETFItem, PeriodKey } from "../_lib/types";

interface HeatmapCellProps {
  etf: ETFItem;
  period: PeriodKey;
  /** 타일 상단 라벨 (없으면 etf.name) */
  label?: string;
  onHover?: (etf: ETFItem | null) => void;
}

export function HeatmapCell({ etf, period, label, onHover }: HeatmapCellProps) {
  const val = etf.returns?.[period] ?? null;
  const style = getHeatStyle(val);
  const header = label ?? etf.name;

  return (
    <button
      type="button"
      onMouseEnter={() => onHover?.(etf)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(etf)}
      onBlur={() => onHover?.(null)}
      className="flex min-w-0 flex-col overflow-hidden rounded-sm border border-gray-800/80 text-left transition-transform hover:z-10 hover:scale-[1.03] focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
      title={`${etf.name} (${etf.code})`}
    >
      <span className="truncate bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-gray-200">
        {header}
      </span>
      <span
        className="flex flex-1 flex-col justify-between gap-0.5 px-1.5 py-1"
        style={{
          backgroundColor: style.backgroundColor,
          color: style.color,
        }}
      >
        <span className="font-mono text-[10px] opacity-80">{etf.code}</span>
        <span className="text-xs font-bold tabular-nums leading-none">
          {formatReturn(val)}
        </span>
      </span>
    </button>
  );
}
