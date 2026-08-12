"use client";

import {
  DOWN_DEEP_CSS,
  UP_DEEP_CSS,
  type ColorScale,
  legendStops,
} from "@/app/heatmap/_lib/colors";
import { formatLegendValue } from "@/app/heatmap/_lib/format";

interface ColorLegendProps {
  scale: ColorScale;
}

export function ColorLegend({ scale }: ColorLegendProps) {
  const { neutral, negBound, posBound } = scale;
  const total = posBound - negBound;
  const pct = (v: number) =>
    total <= 0 ? 50 : ((v - negBound) / total) * 100;

  // 파랑(진한) → 파랑(연한) → 회색 → 빨강(연한) → 빨강(진한)
  const gradient = `linear-gradient(to right, ${DOWN_DEEP_CSS} 0%, rgb(219, 234, 254) ${pct(
    -neutral
  )}%, rgb(55, 65, 81) ${pct(-neutral)}%, rgb(55, 65, 81) ${pct(
    neutral
  )}%, rgb(254, 226, 226) ${pct(neutral)}%, ${UP_DEEP_CSS} 100%)`;

  const stops = legendStops(scale);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-gray-400">
      <span className="text-gray-500">수익률:</span>
      <div className="flex items-center gap-1">
        <div
          className="h-3 w-56 rounded-sm border border-gray-700"
          style={{ background: gradient }}
        />
      </div>
      <div className="flex items-center gap-2 font-mono">
        {stops.map((v, i) => (
          <span key={i} className="tabular-nums">
            {formatLegendValue(v)}
          </span>
        ))}
      </div>
      <span className="text-gray-500">
        * 중립 ±{neutral}% · 바깥 구간 3등분
      </span>
    </div>
  );
}

