import React, { useState } from "react";
import type { PeriodSumItem, SupplyDemandSumPeriod } from "@/lib/api";
import { DISPERSION_COLORS, SUM_PRESETS } from "./constants";
import type { SupplySumPreset } from "@/hooks/useSupplyDemand";

const BAR_HALF_H = 72;

export interface SugeubPeriodSumBarProps {
  periodSums: PeriodSumItem[];
  sumPeriod: SupplyDemandSumPeriod;
  activePreset: SupplySumPreset;
  customSumApplied?: boolean;
  isLoading?: boolean;
  onPresetChange: (preset: SupplySumPreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onApplyCustom: () => void;
}

function formatSumLabel(value: number): string {
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  if (abs >= 100000000) {
    return `${sign}${(abs / 100000000).toFixed(1)}억`;
  }
  if (abs >= 10000) {
    return `${sign}${(abs / 10000).toFixed(0)}만`;
  }
  if (abs === 0) return "0";
  return `${sign}${abs.toLocaleString()}`;
}

export function SugeubPeriodSumBar({
  periodSums,
  sumPeriod,
  activePreset,
  customSumApplied = false,
  isLoading = false,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onApplyCustom,
}: SugeubPeriodSumBarProps) {
  const [viewMode, setViewMode] = useState<"auto" | "horizontal" | "vertical">("auto");
  const maxAbs = Math.max(...periodSums.map((p) => Math.abs(p.value)), 1);

  const showHorizontal = viewMode === "horizontal" || viewMode === "auto";
  const showVertical = viewMode === "vertical" || viewMode === "auto";

  return (
    <div className="px-3 py-4 sm:py-6 space-y-4 rounded-lg border border-gray-200 bg-white mx-1 shadow-xs">
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-800">
              주체별 순매수 합계
            </h3>
            <span className="text-[11px] text-gray-500 font-normal">
              ({isLoading ? "계산 중..." : sumPeriod.label})
            </span>
          </div>

          {/* View Mode Toggle: Auto / 가로형 / 세로형 */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode("auto")}
              className={`px-2 py-0.5 rounded transition-all ${
                viewMode === "auto"
                  ? "bg-white text-gray-800 font-semibold shadow-2xs"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              title="화면 크기에 따라 자동 맞춤 (모바일 가로형 / 데스크탑 세로형)"
            >
              자동
            </button>
            <button
              type="button"
              onClick={() => setViewMode("horizontal")}
              className={`px-2 py-0.5 rounded transition-all ${
                viewMode === "horizontal"
                  ? "bg-white text-gray-800 font-semibold shadow-2xs"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              title="가로 스크롤 없는 수평 목록형"
            >
              가로형
            </button>
            <button
              type="button"
              onClick={() => setViewMode("vertical")}
              className={`px-2 py-0.5 rounded transition-all ${
                viewMode === "vertical"
                  ? "bg-white text-gray-800 font-semibold shadow-2xs"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              title="세로 막대 차트형"
            >
              세로형
            </button>
          </div>
        </div>

        {/* Presets & Custom Date Inputs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {SUM_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPresetChange(p.id)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  activePreset === p.id && !customSumApplied
                    ? "bg-sky-600 border-sky-500 text-white font-medium shadow-2xs"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 flex-1 min-w-0 max-w-[135px] sm:max-w-none"
            />
            <span className="text-gray-500 shrink-0">~</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 flex-1 min-w-0 max-w-[135px] sm:max-w-none"
            />
            <button
              type="button"
              onClick={onApplyCustom}
              className="px-2.5 py-1 rounded bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 shrink-0 font-medium"
            >
              적용
            </button>
          </div>
        </div>
      </div>

      {/* 2. MOBILE / HORIZONTAL DIVERGING BAR VIEW (가로 스크롤 없이 100% 폭에 다 보여줌) */}
      {(viewMode === "horizontal" || (viewMode === "auto" && showHorizontal)) && (
        <div
          className={`${
            viewMode === "auto" ? "sm:hidden" : ""
          } flex flex-col divide-y divide-gray-100 border border-gray-200 rounded-lg bg-gray-50/40 p-2 sm:p-3`}
        >
          {/* Legend row */}
          <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium px-1 pb-1.5">
            <span>주체</span>
            <div className="flex items-center gap-4">
              <span className="text-blue-600">◀ 순매도(-)</span>
              <span className="text-gray-400">|</span>
              <span className="text-red-600">순매수(+) ▶</span>
            </div>
            <span>순매수량</span>
          </div>

          {periodSums.map((item) => {
            const positive = item.value > 0;
            const negative = item.value < 0;
            const barPct = Math.min((Math.abs(item.value) / maxAbs) * 100, 100);
            const investorColor = DISPERSION_COLORS[item.investor] || "#4b5563";

            return (
              <div
                key={item.investor}
                className="py-1 flex items-center gap-2 text-xs"
              >
                {/* Investor Name */}
                <span
                  className="w-14 font-semibold shrink-0 text-left text-[11px] truncate"
                  style={{ color: investorColor }}
                  title={item.investor}
                >
                  {item.investor}
                </span>

                {/* Diverging Bar Container (Center 0 Axis) */}
                <div className="relative flex-1 flex items-center h-4.5 bg-white rounded border border-gray-200/80 overflow-hidden shadow-2xs">
                  {/* Left (Negative) */}
                  <div className="w-1/2 flex justify-end relative h-full">
                    {negative && (
                      <div
                        className="h-full rounded-l transition-all duration-300"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: "#2563eb",
                          opacity: 0.85,
                        }}
                        title={`${item.investor}: ${item.value.toLocaleString()}주`}
                      />
                    )}
                  </div>

                  {/* Center 0 Line */}
                  <div className="w-[1px] h-full bg-gray-400 shrink-0 z-10" />

                  {/* Right (Positive) */}
                  <div className="w-1/2 flex justify-start relative h-full">
                    {positive && (
                      <div
                        className="h-full rounded-r transition-all duration-300"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: "#dc2626",
                          opacity: 0.85,
                        }}
                        title={`${item.investor}: ${item.value.toLocaleString()}주`}
                      />
                    )}
                  </div>
                </div>

                {/* Value Label */}
                <span
                  className={`w-14 text-right tabular-nums font-bold text-[11px] shrink-0 ${
                    positive
                      ? "text-red-600"
                      : negative
                      ? "text-blue-600"
                      : "text-gray-400"
                  }`}
                  title={`${item.value.toLocaleString()}주`}
                >
                  {formatSumLabel(item.value)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. DESKTOP / VERTICAL COLUMN CHART VIEW */}
      {(viewMode === "vertical" || (viewMode === "auto" && showVertical)) && (
        <div
          className={`${
            viewMode === "auto" ? "hidden sm:flex" : "flex"
          } items-stretch gap-1 px-1 sm:px-2 overflow-x-auto overscroll-x-contain min-h-[200px] border border-gray-100 rounded-lg p-2 bg-gray-50/20`}
        >
          {periodSums.map((item) => {
            const positive = item.value > 0;
            const negative = item.value < 0;
            const barH = Math.max(3, (Math.abs(item.value) / maxAbs) * BAR_HALF_H);

            return (
              <div
                key={item.investor}
                className="flex flex-col items-center min-w-[44px] sm:min-w-[52px] flex-1 max-w-[72px]"
              >
                <span
                  className={`text-[9px] tabular-nums h-4 leading-4 ${
                    positive ? "text-red-600 font-semibold" : "text-transparent"
                  }`}
                >
                  {positive ? formatSumLabel(item.value) : "·"}
                </span>

                <div className="w-full flex flex-col" style={{ height: BAR_HALF_H * 2 }}>
                  <div
                    className="w-full flex flex-col justify-end items-center"
                    style={{ height: BAR_HALF_H }}
                  >
                    {positive && (
                      <div
                        className="w-3/4 rounded-t"
                        style={{
                          height: barH,
                          backgroundColor: "#dc2626",
                          opacity: 0.85,
                        }}
                        title={`${item.investor}: ${item.value.toLocaleString()}주`}
                      />
                    )}
                  </div>
                  <div className="w-full border-t border-gray-400 shrink-0" aria-hidden />
                  <div
                    className="w-full flex flex-col justify-start items-center"
                    style={{ height: BAR_HALF_H }}
                  >
                    {negative && (
                      <div
                        className="w-3/4 rounded-b"
                        style={{
                          height: barH,
                          backgroundColor: "#2563eb",
                          opacity: 0.85,
                        }}
                        title={`${item.investor}: ${item.value.toLocaleString()}주`}
                      />
                    )}
                  </div>
                </div>

                <span
                  className={`text-[9px] tabular-nums h-4 leading-4 mt-0.5 ${
                    negative ? "text-blue-600 font-semibold" : "text-transparent"
                  }`}
                >
                  {negative ? formatSumLabel(item.value) : "·"}
                </span>

                <span
                  className="text-[10px] font-medium text-gray-700 mt-1 truncate w-full text-center"
                  style={{ color: DISPERSION_COLORS[item.investor] }}
                >
                  {item.investor}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
