"use client";

import { formatReturn } from "../_lib/colors";
import { PERIODS, type ETFItem } from "../_lib/types";

interface HeatmapTooltipProps {
  etf: ETFItem;
}

export function HeatmapTooltip({ etf }: HeatmapTooltipProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-700 bg-gray-900/95 p-4 shadow-2xl backdrop-blur-sm">
      <div className="mb-2 border-b border-gray-800 pb-2">
        <h4 className="text-sm font-bold text-white">{etf.name}</h4>
        <p className="mt-0.5 font-mono text-xs text-gray-400">{etf.code}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {PERIODS.map((p) => {
          const val = etf.returns[p.key];
          return (
            <div key={p.key} className="flex items-center justify-between">
              <span className="text-gray-400">{p.label}</span>
              <span
                className={`font-semibold tabular-nums ${
                  val === null
                    ? "text-gray-500"
                    : val > 0
                      ? "text-emerald-400"
                      : val < 0
                        ? "text-rose-400"
                        : "text-gray-300"
                }`}
              >
                {formatReturn(val)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
