"use client";

import React from "react";
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
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value / 10000).toFixed(0)}만`;
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
  const maxAbs = Math.max(...periodSums.map((p) => Math.abs(p.value)), 1);

  return (
    <div className="px-3 py-6 space-y-4 rounded border border-gray-200 bg-white mx-1">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <h3 className="text-sm font-bold text-gray-800 w-full text-center sm:w-auto sm:mr-2">
          주체별 순매수 합계
        </h3>
        {SUM_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPresetChange(p.id)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              activePreset === p.id && !customSumApplied
                ? "bg-sky-600 border-sky-500 text-white"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-700"
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-700"
          />
          <button
            type="button"
            onClick={onApplyCustom}
            className="px-2 py-1 rounded bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
          >
            적용
          </button>
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-500">
        {isLoading ? "합계 계산 중..." : sumPeriod.label}
      </p>
      <div className="flex items-stretch justify-center gap-1 px-2 overflow-x-auto min-h-[200px]">
        {periodSums.map((item) => {
          const positive = item.value > 0;
          const negative = item.value < 0;
          const barH = Math.max(3, (Math.abs(item.value) / maxAbs) * BAR_HALF_H);

          return (
            <div
              key={item.investor}
              className="flex flex-col items-center min-w-[52px] flex-1 max-w-[72px]"
            >
              <span
                className={`text-[9px] tabular-nums h-4 leading-4 ${
                  positive ? "text-red-600" : "text-transparent"
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
                        backgroundColor: "red",
                        opacity: 0.85,
                      }}
                      title={`${item.investor}: ${item.value.toLocaleString()}`}
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
                        backgroundColor: "blue",
                        opacity: 0.85,
                      }}
                      title={`${item.investor}: ${item.value.toLocaleString()}`}
                    />
                  )}
                </div>
              </div>

              <span
                className={`text-[9px] tabular-nums h-4 leading-4 mt-0.5 ${
                  negative ? "text-blue-600" : "text-transparent"
                }`}
              >
                {negative ? formatSumLabel(item.value) : "·"}
              </span>

              <span
                className="text-[9px] text-gray-600 mt-1 truncate w-full text-center"
                style={{ color: DISPERSION_COLORS[item.investor] }}
              >
                {item.investor}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
