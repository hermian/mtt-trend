"use client";

import { useMemo, useState, useEffect } from "react";
import { getStreamlitSearchUrl } from "@/lib/streamlitUrl";
import { useToast } from "@/contexts/ToastContext";
import type { StockHeatmapGroup } from "@/lib/api";

interface StockListModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: StockHeatmapGroup[];
  initialGroup?: string | null;
  groupingTitle?: string;
}

export function StockListModal({
  isOpen,
  onClose,
  groups,
  initialGroup = null,
  groupingTitle = "섹터",
}: StockListModalProps) {
  const toast = useToast();
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [useSpace, setUseSpace] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<"text" | "url" | null>(null);

  // Sync initialGroup when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedGroup(initialGroup ?? "ALL");
      setCopiedType(null);
    }
  }, [isOpen, initialGroup]);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Extract stocks based on selection
  const selectedStocks = useMemo(() => {
    if (selectedGroup === "ALL") {
      const all = groups.flatMap((g) => g.stocks);
      // Deduplicate stocks by code
      const map = new Map<string, (typeof all)[0]>();
      for (const s of all) {
        if (!map.has(s.code)) map.set(s.code, s);
      }
      return Array.from(map.values());
    }
    const found = groups.find((g) => g.name === selectedGroup);
    return found ? found.stocks : [];
  }, [groups, selectedGroup]);

  const stockNames = useMemo(() => {
    return selectedStocks.map((s) => s.name);
  }, [selectedStocks]);

  const commaSeparatedText = useMemo(() => {
    const delimiter = useSpace ? ", " : ",";
    return stockNames.join(delimiter);
  }, [stockNames, useSpace]);

  // Streamlit search URL format (e.g. http://hermian.duckdns.org:15888/?search=삼성전자,SK하이닉스)
  const searchUrl = useMemo(() => {
    if (stockNames.length === 0) return "";
    const commaStringNoSpace = stockNames.join(",");
    return getStreamlitSearchUrl(commaStringNoSpace, "stock");
  }, [stockNames]);

  if (!isOpen) return null;

  const handleCopyText = async () => {
    if (!commaSeparatedText) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(commaSeparatedText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = commaSeparatedText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedType("text");
      toast.success(`${stockNames.length}개 종목 콤마 목록이 복사되었습니다.`);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
    }
  };

  const handleCopyUrl = async () => {
    if (!searchUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(searchUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = searchUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedType("url");
      toast.success("Streamlit 검색 URL이 복사되었습니다.");
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      toast.error("URL 복사에 실패했습니다.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-2xl transition-all md:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-list-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div>
            <h2 id="stock-list-modal-title" className="text-lg font-bold text-gray-100 flex items-center gap-2">
              <span>📋</span> 필터링 종목 콤마 목록
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              필터링된 {groupingTitle} 종목명을 콤마(,)로 이어 복사하거나 Streamlit 차트 검색으로 바로 이동합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* Filters & Options Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Group Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="group-select" className="text-xs font-semibold text-gray-400">
              그룹 선택:
            </label>
            <select
              id="group-select"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">
                전체 필터링 종목 ({groups.reduce((acc, g) => acc + g.stocks.length, 0)}개)
              </option>
              {groups.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name} ({g.stocks.length}종목)
                </option>
              ))}
            </select>
          </div>

          {/* Format Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useSpace}
              onChange={(e) => setUseSpace(e.target.checked)}
              className="rounded border-gray-700 bg-gray-800 text-sky-500 focus:ring-sky-500 focus:ring-offset-gray-900"
            />
            콤마 뒤 띄어쓰기 포함 (, )
          </label>
        </div>

        {/* Textarea Area */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>
              선택된 종목 수: <strong className="text-sky-400">{stockNames.length}개</strong>
            </span>
            <span className="text-[11px] text-gray-500">예시: 삼성전자,SK하이닉스</span>
          </div>

          <textarea
            readOnly
            value={commaSeparatedText}
            placeholder="조건에 해당하는 종목이 없습니다."
            rows={5}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 p-3 text-xs font-mono text-gray-200 focus:border-sky-500 focus:outline-none resize-y"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </div>

        {/* Streamlit URL Preview */}
        {searchUrl && (
          <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/60 p-2.5 text-xs">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="font-semibold text-gray-300">Streamlit 차트 검색 URL:</span>
              <button
                onClick={handleCopyUrl}
                className="text-[11px] text-sky-400 hover:underline"
              >
                {copiedType === "url" ? "✓ 복사됨" : "URL 복사"}
              </button>
            </div>
            <div className="truncate font-mono text-[11px] text-gray-400 select-all">
              {searchUrl}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-gray-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-gray-700"
          >
            닫기
          </button>

          <button
            onClick={handleCopyText}
            disabled={stockNames.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>📋</span> {copiedType === "text" ? "복사 완료!" : "콤마 목록 복사"}
          </button>

          {searchUrl && (
            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <span>🔗</span> Streamlit 차트 검색 열기 ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
