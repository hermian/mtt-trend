"use client";

import { useState } from "react";
import clsx from "clsx";
import type { HeatmapGrouping, HeatmapPeriod } from "@/lib/api";

export interface HeatmapControls {
  grouping: HeatmapGrouping;
  period: HeatmapPeriod;
  startDate: string | null;
  endDate: string | null;
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
  { id: "CUSTOM", label: "기간 지정" },
];

const MARCAP_PRESETS: Array<{
  label: string;
  min: number | null;
  max: number | null;
}> = [
  { label: "전체", min: null, max: null },
  { label: "1000억+", min: 1000, max: null },
  { label: "3000억+", min: 3000, max: null },
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

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getDefaultDates(): { start: string; end: string } {
  const now = new Date();
  const end = formatDate(now);
  const d = new Date(now);
  d.setMonth(d.getMonth() - 1);
  const start = formatDate(d);
  return { start, end };
}

function getPresetDates(preset: "1M" | "3M" | "YTD" | "1Y"): { start: string; end: string } {
  const now = new Date();
  const end = formatDate(now);
  if (preset === "YTD") {
    return { start: `${now.getFullYear()}-01-01`, end };
  }
  const d = new Date(now);
  if (preset === "1M") d.setMonth(d.getMonth() - 1);
  if (preset === "3M") d.setMonth(d.getMonth() - 3);
  if (preset === "1Y") d.setFullYear(d.getFullYear() - 1);
  return { start: formatDate(d), end };
}

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

  const [customStart, setCustomStart] = useState(value.startDate ?? "");
  const [customEnd, setCustomEnd] = useState(value.endDate ?? "");

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

  const applyDateRange = () => {
    if (!customStart.trim()) return;
    onChange({
      period: "CUSTOM",
      startDate: customStart.trim(),
      endDate: customEnd.trim() || null,
    });
  };

  const handleSelectPeriod = (pId: HeatmapPeriod) => {
    if (pId !== "CUSTOM") {
      onChange({ period: pId, startDate: null, endDate: null });
    } else {
      const defaults = getDefaultDates();
      const start = customStart || defaults.start;
      const end = customEnd || defaults.end;
      setCustomStart(start);
      setCustomEnd(end);
      onChange({ period: "CUSTOM", startDate: start, endDate: end });
    }
  };

  const handleApplyPreset = (preset: "1M" | "3M" | "YTD" | "1Y") => {
    const { start, end } = getPresetDates(preset);
    setCustomStart(start);
    setCustomEnd(end);
    onChange({ period: "CUSTOM", startDate: start, endDate: end });
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={btnClass(value.period === p.id)}
              onClick={() => handleSelectPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {value.period === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-700 bg-gray-800/80 px-2.5 py-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-400">시작</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                className="cursor-pointer rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-sky-500 focus:outline-none [color-scheme:dark]"
              />
              <span className="font-medium text-gray-400">~ 종료</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                className="cursor-pointer rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-sky-500 focus:outline-none [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={applyDateRange}
                className="rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-sky-500"
              >
                조회
              </button>
            </div>

            <div className="flex items-center gap-1 border-l border-gray-700 pl-2">
              <button
                type="button"
                onClick={() => handleApplyPreset("1M")}
                className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                1개월전
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("3M")}
                className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                3개월전
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("YTD")}
                className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                YTD(올해)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("1Y")}
                className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                1년전
              </button>
            </div>
          </div>
        )}
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
          className="rounded-md bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-600"
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
          className="rounded-md bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-600"
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
