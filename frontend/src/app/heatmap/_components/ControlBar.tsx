"use client";

import { useState } from "react";
import clsx from "clsx";
import type { HeatmapGrouping, HeatmapPeriod } from "@/lib/api";

export interface HeatmapControls {
  grouping: HeatmapGrouping;
  period: HeatmapPeriod;
  marcapMin: number | null;
  marcapMax: number | null;
  minRet: number | null;
  limit: number;
}

interface ControlBarProps {
  value: HeatmapControls;
  onChange: (patch: Partial<HeatmapControls>) => void;
}

const GROUPINGS: Array<{ id: HeatmapGrouping; label: string }> = [
  { id: "sector", label: "섹터" },
  { id: "industry", label: "업종" },
  { id: "theme", label: "테마" },
  { id: "kospi", label: "KOSPI" },
  { id: "kosdaq", label: "KOSDAQ" },
];

const PERIODS: Array<{ id: HeatmapPeriod; label: string }> = [
  { id: "1D", label: "1일" },
  { id: "5D", label: "5일" },
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "12M", label: "12M" },
];

const MARCAP_PRESETS: Array<{
  label: string;
  min: number | null;
  max: number | null;
}> = [
  { label: "전체", min: null, max: null },
  { label: "1000억+", min: 1000, max: null },
  { label: "5000억+", min: 5000, max: null },
  { label: "1조+", min: 10000, max: null },
  { label: "5조+", min: 50000, max: null },
];

const MIN_RET_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "전체", value: null },
  { label: "2%+", value: 2 },
  { label: "3%+", value: 3 },
  { label: "4%+", value: 4 },
  { label: "5%+", value: 5 },
  { label: "10%+", value: 10 },
];

const LIMITS: Array<{ id: number; label: string }> = [
  { id: 50, label: "상위 50" },
  { id: 100, label: "상위 100" },
  { id: 200, label: "상위 200" },
  { id: 300, label: "상위 300" },
  { id: 400, label: "상위 400" },
  { id: 500, label: "상위 500" },
  { id: 0, label: "전체" },
];

function btnClass(active: boolean): string {
  return clsx(
    "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap",
    active
      ? "bg-sky-600 text-white"
      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
  );
}

export function ControlBar({ value, onChange }: ControlBarProps) {
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [retInput, setRetInput] = useState("");

  const applyCustom = () => {
    const min = minInput.trim() === "" ? null : Number(minInput);
    const max = maxInput.trim() === "" ? null : Number(maxInput);
    onChange({
      marcapMin: min !== null && Number.isFinite(min) && min >= 0 ? min : null,
      marcapMax: max !== null && Number.isFinite(max) && max > 0 ? max : null,
    });
  };

  const applyCustomRet = () => {
    const ret = retInput.trim() === "" ? null : Number(retInput);
    onChange({
      minRet: ret !== null && Number.isFinite(ret) ? ret : null,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3">
      {/* 그룹 기준 */}
      <div className="flex items-center gap-1">
        {GROUPINGS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={btnClass(value.grouping === g.id)}
            onClick={() => onChange({ grouping: g.id })}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* 기간 */}
      <div className="flex items-center gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={btnClass(value.period === p.id)}
            onClick={() => onChange({ period: p.id })}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 시가총액 */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">시가총액</span>
        {MARCAP_PRESETS.map((m) => (
          <button
            key={m.label}
            type="button"
            className={btnClass(
              value.marcapMin === m.min && value.marcapMax === m.max
            )}
            onClick={() => onChange({ marcapMin: m.min, marcapMax: m.max })}
          >
            {m.label}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">직접입력</span>
        <input
          type="number"
          min={0}
          placeholder="최저"
          value={minInput}
          onChange={(e) => setMinInput(e.target.value)}
          className="w-20 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">억 ~</span>
        <input
          type="number"
          min={0}
          placeholder="최대"
          value={maxInput}
          onChange={(e) => setMaxInput(e.target.value)}
          className="w-20 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">억</span>
        <button
          type="button"
          onClick={applyCustom}
          className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
        >
          적용
        </button>
      </div>

      {/* 수익률 */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">수익률</span>
        {MIN_RET_PRESETS.map((r) => (
          <button
            key={r.label}
            type="button"
            className={btnClass(value.minRet === r.value)}
            onClick={() => {
              setRetInput("");
              onChange({ minRet: r.value });
            }}
          >
            {r.label}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">직접입력</span>
        <input
          type="number"
          step="any"
          placeholder="최저"
          value={retInput}
          onChange={(e) => setRetInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyCustomRet();
          }}
          className="w-16 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">% 이상</span>
        <button
          type="button"
          onClick={applyCustomRet}
          className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
        >
          적용
        </button>
      </div>

      {/* 표시 개수 */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">표시 개수</span>
        {LIMITS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={btnClass(value.limit === l.id)}
            onClick={() => onChange({ limit: l.id })}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
