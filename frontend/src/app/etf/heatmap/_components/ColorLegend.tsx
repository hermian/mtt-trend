"use client";

import { getHeatStyle, getLegendStops } from "../_lib/colors";
import type { PeriodKey } from "../_lib/types";

interface ColorLegendProps {
  period: PeriodKey;
}

export function ColorLegend({ period }: ColorLegendProps) {
  const stops = getLegendStops(period);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-gray-400">
      {stops.map((stop) => {
        const style = getHeatStyle(stop.value === 0 ? 0 : stop.value, period);
        return (
          <div key={stop.label} className="flex items-center gap-1">
            <span
              className="inline-block h-3.5 w-5 rounded-sm border border-gray-700"
              style={{ backgroundColor: style.backgroundColor }}
            />
            <span className="tabular-nums">{stop.label}</span>
          </div>
        );
      })}
    </div>
  );
}
