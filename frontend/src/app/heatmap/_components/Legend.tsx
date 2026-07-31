"use client";

import {
  DOWN_DEEP_CSS,
  UP_DEEP_CSS,
  type ColorScale,
  legendStops,
} from "../_lib/colors";
import { formatLegendValue } from "../_lib/format";

interface LegendProps {
  scale: ColorScale;
}

/**
 * 색상 범례: [음수 최소 … -중립 … +중립 … 양수 최대] 그라디언트 바.
 * 바깥 구간 3등분 눈금. 박스 크기 = ∛(시가총액) 안내 포함.
 */
export function Legend({ scale }: LegendProps) {
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-400">
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
        * 중립 ±{neutral}% · 바깥 구간 3등분 · 박스 크기 = ∛(시가총액)
      </span>
    </div>
  );
}
