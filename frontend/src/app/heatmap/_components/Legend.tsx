"use client";

import type { HeatmapColorBy, HeatmapSizeBy } from "@/lib/api";
import {
  DOWN_DEEP_CSS,
  UP_DEEP_CSS,
  type ColorScale,
  legendStops,
} from "../_lib/colors";
import { formatLegendValue } from "../_lib/format";

interface LegendProps {
  scale: ColorScale;
  growthScale?: ColorScale;
  colorBy?: HeatmapColorBy;
  sizeBy?: HeatmapSizeBy;
}

function ScaleBar({
  label,
  scale,
  badge,
}: {
  label: string;
  scale: ColorScale;
  badge?: string;
}) {
  const { neutral, negBound, posBound } = scale;
  const total = posBound - negBound;
  const pct = (v: number) =>
    total <= 0 ? 50 : ((v - negBound) / total) * 100;

  const gradient = `linear-gradient(to right, ${DOWN_DEEP_CSS} 0%, rgb(219, 234, 254) ${pct(
    -neutral
  )}%, rgb(55, 65, 81) ${pct(-neutral)}%, rgb(55, 65, 81) ${pct(
    neutral
  )}%, rgb(254, 226, 226) ${pct(neutral)}%, ${UP_DEEP_CSS} 100%)`;

  const stops = legendStops(scale);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {badge && (
        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-300">
          {badge}
        </span>
      )}
      <span className="text-gray-400">{label}:</span>
      <div
        className="h-3 w-40 sm:w-48 rounded-sm border border-gray-700"
        style={{ background: gradient }}
      />
      <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px]">
        {stops.map((v, i) => (
          <span key={i} className="tabular-nums">
            {formatLegendValue(v)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 색상 범례: [음수 최소 … -중립 … +중립 … 양수 최대] 그라디언트 바.
 * 반반 분할(split) 모드일 경우 좌측(수익률)과 우측(대금증가율) 범례를 함께 제공.
 */
export function Legend({
  scale,
  growthScale,
  colorBy = "return",
  sizeBy = "marcap",
}: LegendProps) {
  const isSplit = colorBy === "split";
  const sizeLabel = sizeBy === "trade_value" ? "거래대금" : "시가총액";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-400">
      {isSplit ? (
        <>
          <ScaleBar label="주가수익률" badge="좌측 50%" scale={scale} />
          <div className="hidden h-4 w-px bg-gray-800 lg:block" />
          <ScaleBar
            label="대금증가율"
            badge="우측 50%"
            scale={growthScale ?? scale}
          />
        </>
      ) : colorBy === "trade_value_growth" ? (
        <ScaleBar label="거래대금 증가율" scale={scale} />
      ) : (
        <ScaleBar label="수익률" scale={scale} />
      )}
      <span className="text-gray-500">
        * 중립 ±{scale.neutral}% · 바깥 구간 3등분 · 박스 크기 = ∛({sizeLabel})
      </span>
    </div>
  );
}
