"use client";

import React from "react";
import {
  DEFAULT_SUGEB_RANGE,
  SUGEB_RANGE_PRESETS,
  type SugeubRangePreset,
} from "./sugeubChartHelpers";

export function SugeubRangeControls({
  value,
  onChange,
}: {
  value: SugeubRangePreset;
  onChange: (preset: SugeubRangePreset) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 pb-2">
      {SUGEB_RANGE_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
            value === p.id
              ? "bg-blue-100 border-blue-400 text-blue-800 font-semibold"
              : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
          }`}
        >
          {p.label}
        </button>
      ))}
      <span className="text-[10px] text-gray-400 ml-1">기본 {DEFAULT_SUGEB_RANGE.toUpperCase()}</span>
    </div>
  );
}
