"use client";

import { PERIODS, type PeriodKey } from "../_lib/types";

interface PeriodFilterProps {
  value: PeriodKey;
  onChange: (period: PeriodKey) => void;
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="flex gap-0.5 overflow-x-auto border-b border-gray-800">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          className={`shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
            value === p.key
              ? "border-b-2 border-sky-500 text-sky-400"
              : "border-b-2 border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
