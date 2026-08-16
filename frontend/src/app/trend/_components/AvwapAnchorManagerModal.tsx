"use client";

import React, { useState, useEffect } from "react";
import type { CustomAnchorResponse } from "@/lib/api";

export interface UnifiedAnchorItem {
  id: string;
  name: string;
  anchor_date: string;
  color: string;
  isCustom: boolean;
  isEnabled: boolean;
}

interface AvwapAnchorManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetName: string;
  anchors: UnifiedAnchorItem[];
  onToggleAnchor: (id: string) => void;
  onUpdateCustomAnchor: (id: string, date: string, label: string, color: string) => void;
  onDeleteAnchor: (id: string, anchorDate: string, isCustom: boolean) => void;
  onAddCustomAnchor: (date: string, label: string, color: string) => void;
  onResetToDefaults: () => void;
}

const PRESET_COLORS = [
  "#ec4899", "#f43f5e", "#8b5cf6", "#6366f1", "#3b82f6",
  "#06b6d4", "#10b981", "#84cc16", "#eab308", "#f97316",
  "#d946ef", "#a855f7", "#14b8a6", "#38bdf8", "#fb7185", "#4ade80"
];

export function AvwapAnchorManagerModal({
  isOpen,
  onClose,
  targetName,
  anchors,
  onToggleAnchor,
  onUpdateCustomAnchor,
  onDeleteAnchor,
  onAddCustomAnchor,
  onResetToDefaults,
}: AvwapAnchorManagerModalProps) {

  // New anchor form state
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [activeTab, setActiveTab] = useState<"all" | "custom" | "preset">("all");

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredAnchors = anchors.filter((a) => {
    if (activeTab === "custom") return a.isCustom;
    if (activeTab === "preset") return !a.isCustom;
    return true;
  });

  const handleStartEdit = (anc: UnifiedAnchorItem) => {
    setEditingId(anc.id);
    setEditDate(anc.anchor_date);
    setEditLabel(anc.name.replace(` (${anc.anchor_date})`, "").replace("AVWAP", "").trim());
    setEditColor(anc.color);
  };

  const handleSaveEdit = (id: string) => {
    if (editDate) {
      onUpdateCustomAnchor(id, editDate, editLabel, editColor);
    }
    setEditingId(null);
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || newDate.length < 10) return;
    onAddCustomAnchor(newDate.trim(), newLabel.trim(), newColor);
    setNewDate("");
    setNewLabel("");
  };

  // Export anchors to JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(anchors, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `avwap_anchors_${targetName}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-gray-200 text-xs font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚓</span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>변곡점 앵커 관리</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800 font-mono">
                  {targetName}
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">
                차트에 표시할 프리셋 및 사용자 지정 AVWAP 앵커를 조회하고 편집합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Top Controls: Add Form & Tabs */}
        <div className="p-5 border-b border-gray-800/80 bg-gray-950/50 space-y-4">
          {/* Quick Add Bar */}
          <form onSubmit={handleAddNew} className="flex flex-wrap items-end gap-2.5 bg-gray-900/80 p-3 rounded-xl border border-gray-800">
            <div className="flex-1 min-w-[130px]">
              <label htmlFor="modal-new-anchor-date" className="block text-[11px] text-gray-400 font-medium mb-1">
                기준 날짜 <span className="text-rose-400">*</span>
              </label>
              <input
                id="modal-new-anchor-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
            <div className="flex-[1.5] min-w-[160px]">
              <label htmlFor="modal-new-anchor-label" className="block text-[11px] text-gray-400 font-medium mb-1">
                라벨 / 메모 (선택)
              </label>
              <input
                id="modal-new-anchor-label"
                type="text"
                placeholder="예: 25년 4월 저점, 실적발표"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="modal-new-anchor-color" className="block text-[11px] text-gray-400 font-medium mb-1">
                색상
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="modal-new-anchor-color"
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-gray-700 p-0.5"
                  title="색상 선택"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow transition-colors flex items-center gap-1 text-xs"
            >
              <span>+ 등록</span>
            </button>
          </form>

          {/* Filter Tabs & Utility Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-lg bg-gray-800/80 p-0.5 border border-gray-700 text-xs">
              {[
                { id: "all", label: `전체 (${anchors.length})` },
                { id: "custom", label: `커스텀 (${anchors.filter((a) => a.isCustom).length})` },
                { id: "preset", label: `시스템 (${anchors.filter((a) => !a.isCustom).length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-3 py-1 font-semibold rounded-md transition-all ${
                    activeTab === t.id
                      ? "bg-gray-700 text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 text-[11px] transition-colors"
                title="앵커 목록을 JSON 파일로 저장"
              >
                📥 JSON 내보내기
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("등록된 커스텀 앵커 및 삭제된 시스템 앵커를 모두 초기화하고 기본값으로 복원하시겠습니까?")) {
                    onResetToDefaults();
                  }
                }}
                className="px-2.5 py-1 bg-gray-800 hover:bg-rose-950 text-rose-300 rounded-lg border border-rose-900/60 text-[11px] transition-colors"
              >
                🔄 기본값으로 복원
              </button>
            </div>
          </div>
        </div>

        {/* Anchor Table List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          {filteredAnchors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-center">
              <span className="text-3xl mb-2">⚓</span>
              <p className="font-semibold">등록된 앵커가 없습니다.</p>
              <p className="text-[11px] text-gray-600 mt-1">상단의 폼을 통해 새로운 변곡점 일자를 등록해보세요.</p>
            </div>
          ) : (
            <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-900/90 text-gray-400 text-[11px] font-semibold border-b border-gray-800">
                    <th className="py-2.5 px-3 w-12 text-center">표시</th>
                    <th className="py-2.5 px-3 w-16">구분</th>
                    <th className="py-2.5 px-3 w-32 font-mono">기준일자</th>
                    <th className="py-2.5 px-3">라벨 / 명칭</th>
                    <th className="py-2.5 px-3 w-20 text-center">색상</th>
                    <th className="py-2.5 px-3 w-24 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredAnchors.map((anc) => {
                    const isEditing = editingId === anc.id;

                    return (
                      <tr
                        key={anc.id}
                        className={`hover:bg-gray-800/40 transition-colors ${
                          !anc.isEnabled ? "opacity-50" : ""
                        }`}
                      >
                        {/* Toggle On/Off */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={anc.isEnabled}
                            onChange={() => onToggleAnchor(anc.id)}
                            className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Tag */}
                        <td className="py-2 px-3">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              anc.isCustom
                                ? "bg-emerald-950/90 text-emerald-300 border border-emerald-800"
                                : "bg-gray-800 text-gray-400 border border-gray-700"
                            }`}
                          >
                            {anc.isCustom ? "커스텀" : "시스템"}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-2 px-3 font-mono font-bold text-gray-200">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white"
                            />
                          ) : (
                            anc.anchor_date
                          )}
                        </td>

                        {/* Label */}
                        <td className="py-2 px-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-white"
                              placeholder="라벨"
                            />
                          ) : (
                            <span className="font-medium text-white">{anc.name}</span>
                          )}
                        </td>

                        {/* Color */}
                        <td className="py-2 px-3 text-center">
                          {isEditing ? (
                            <input
                              type="color"
                              value={editColor}
                              onChange={(e) => setEditColor(e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer bg-transparent border border-gray-700"
                            />
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <span
                                className="w-3.5 h-3.5 rounded-full inline-block shadow-sm"
                                style={{ backgroundColor: anc.color }}
                              />
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSaveEdit(anc.id)}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-[11px]"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              {anc.isCustom && (
                                <button
                                  onClick={() => handleStartEdit(anc)}
                                  className="p-1 text-gray-400 hover:text-blue-400 rounded hover:bg-gray-800 transition-colors"
                                  title="수정"
                                >
                                  ✏️
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const targetType = anc.isCustom ? "커스텀" : "시스템";
                                  if (confirm(`'${anc.name}' ${targetType} 앵커를 삭제(숨김)하시겠습니까?`)) {
                                    onDeleteAnchor(anc.id, anc.anchor_date, anc.isCustom);
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-rose-400 rounded hover:bg-gray-800 transition-colors"
                                title="삭제"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-800 flex items-center justify-between bg-gray-900/80">
          <span className="text-[11px] text-gray-500">
            총 {anchors.length}개의 앵커 ({anchors.filter((a) => a.isEnabled).length}개 활성화)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-xs"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default AvwapAnchorManagerModal;
