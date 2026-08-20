"use client";

import React, { useRef, useEffect } from "react";
import {
  DEFAULT_SUPERTREND_CONFIG,
  type SupertrendConfig,
} from "@/lib/supertrend";

interface SupertrendSettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  config: SupertrendConfig;
  onChangeConfig: (newConfig: SupertrendConfig) => void;
  onResetDefaults: () => void;
}

export function SupertrendSettingsPopover({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  onResetDefaults,
}: SupertrendSettingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute top-full right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 z-50 text-xs font-sans text-gray-200 backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-gray-800 pb-2.5 mb-3">
        <div className="flex items-center gap-1.5 font-bold text-gray-100 text-sm">
          <span>⚡ Supertrend 설정</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3.5">
        {/* 1. ATR Period */}
        <div className="flex items-center justify-between">
          <label className="text-gray-300 font-medium">ATR 기간 (Period)</label>
          <input
            type="number"
            min={1}
            max={200}
            value={config.atrPeriod}
            onChange={(e) => {
              const val = Math.max(1, parseInt(e.target.value) || 1);
              onChangeConfig({ ...config, atrPeriod: val });
            }}
            className="w-20 bg-gray-950 border border-gray-700 rounded px-2.5 py-1 text-right text-gray-100 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* 2. ATR Multiplier */}
        <div className="flex items-center justify-between">
          <label className="text-gray-300 font-medium">ATR 승수 (Multiplier)</label>
          <input
            type="number"
            min={0.1}
            max={20}
            step={0.1}
            value={config.multiplier}
            onChange={(e) => {
              const val = Math.max(0.1, parseFloat(e.target.value) || 0.1);
              onChangeConfig({ ...config, multiplier: val });
            }}
            className="w-20 bg-gray-950 border border-gray-700 rounded px-2.5 py-1 text-right text-gray-100 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* 3. ATR Calculation Method */}
        <div className="flex items-center justify-between">
          <label className="text-gray-300 font-medium">ATR 계산 방식</label>
          <div className="inline-flex rounded-lg bg-gray-950 p-0.5 border border-gray-700">
            <button
              type="button"
              onClick={() => onChangeConfig({ ...config, changeATR: true })}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all ${
                config.changeATR
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Wilder (RMA)
            </button>
            <button
              type="button"
              onClick={() => onChangeConfig({ ...config, changeATR: false })}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all ${
                !config.changeATR
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              단순 (SMA)
            </button>
          </div>
        </div>

        {/* 4. Show Buy/Sell Signals */}
        <div className="flex items-center justify-between">
          <label className="text-gray-300 font-medium">매수/매도 시그널 표시</label>
          <input
            type="checkbox"
            checked={config.showSignals}
            onChange={(e) =>
              onChangeConfig({ ...config, showSignals: e.target.checked })
            }
            className="w-4 h-4 rounded bg-gray-950 border-gray-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
        </div>

        {/* 5. Highlighting */}
        <div className="flex items-center justify-between">
          <label className="text-gray-300 font-medium">영역 하이라이팅</label>
          <input
            type="checkbox"
            checked={config.highlighting}
            onChange={(e) =>
              onChangeConfig({ ...config, highlighting: e.target.checked })
            }
            className="w-4 h-4 rounded bg-gray-950 border-gray-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-800 pt-3 mt-4">
        <button
          type="button"
          onClick={onResetDefaults}
          className="text-gray-400 hover:text-rose-400 text-[11px] font-medium transition-colors"
        >
          기본값 복원
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition-colors shadow-sm"
        >
          확인
        </button>
      </div>
    </div>
  );
}
export default SupertrendSettingsPopover;
