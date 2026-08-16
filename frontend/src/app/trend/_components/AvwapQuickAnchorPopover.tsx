"use client";

import React, { useState, useRef, useEffect } from "react";

interface AvwapQuickAnchorPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAnchor: (date: string, label: string, color: string) => void;
  availableDates?: string[];
  defaultDate?: string;
}

const COLOR_PALETTE = [
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#8b5cf6", // Violet
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#84cc16", // Lime
  "#eab308", // Yellow
  "#f97316", // Orange
  "#d946ef", // Fuchsia
  "#a855f7", // Purple
  "#14b8a6", // Teal
  "#38bdf8", // Sky
  "#fb7185", // Salmon
  "#4ade80", // Light Green
];

export function AvwapQuickAnchorPopover({
  isOpen,
  onClose,
  onAddAnchor,
  availableDates = [],
  defaultDate = "",
}: AvwapQuickAnchorPopoverProps) {
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [errorMsg, setErrorMsg] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultDate) {
      setDate(defaultDate);
    }
  }, [defaultDate]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || date.length < 10) {
      setErrorMsg("유효한 날짜를 입력해주세요 (YYYY-MM-DD)");
      return;
    }
    setErrorMsg("");
    onAddAnchor(date.trim(), label.trim(), selectedColor);
    setLabel("");
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-4 top-12 z-50 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 text-xs font-sans text-white animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
        <span className="font-bold text-gray-200 flex items-center gap-1.5">
          <span className="text-emerald-400">⚓</span> 변곡점 앵커 추가
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white p-0.5 rounded transition-colors"
          title="닫기"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Date Input */}
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">
            기준 일자 (YYYY-MM-DD) <span className="text-rose-400">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            required
          />
        </div>

        {/* Label Input */}
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">
            앵커 라벨 (선택)
          </label>
          <input
            type="text"
            placeholder="예: 25년 4월 저점, 실적발표"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            maxLength={30}
          />
        </div>

        {/* Color Palette */}
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">
            라인 색상
          </label>
          <div className="grid grid-cols-8 gap-1.5 p-1.5 bg-gray-950/60 rounded-lg border border-gray-800">
            {COLOR_PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setSelectedColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full transition-transform ${
                  selectedColor === c
                    ? "ring-2 ring-white scale-110 shadow-sm"
                    : "opacity-70 hover:opacity-100 hover:scale-105"
                }`}
                title={c}
              />
            ))}
          </div>
        </div>

        {errorMsg && <div className="text-rose-400 text-[11px] font-medium">{errorMsg}</div>}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1"
          >
            <span>+ 앵커 생성</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default AvwapQuickAnchorPopover;
