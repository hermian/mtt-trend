"use client";

import React, { useState } from "react";
import type { DispersionTableRow, SupplyDemandTableRow } from "@/lib/api";
import {
  DISPLAY_COLS,
  HIGHLIGHT_ROW_LABELS,
  SUMMARY_ROW_LABELS,
  TABLE_COLS,
} from "./constants";

const MOBILE_HIDDEN_COLS = new Set<string>([
  "거래량",
  "금융투자",
  "보험",
  "투신",
  "기타금융",
  "은행",
  "연기금",
  "사모",
  "기타법인",
  "기타외국인",
]);

function cellColor(col: string, val: unknown, label: string): string {
  if (!DISPLAY_COLS.includes(col as (typeof DISPLAY_COLS)[number])) return "text-gray-800";
  if (typeof val !== "number") return "text-gray-600";
  if (label === "보유비중" || label === "지수선도" || label === "분산추이") return "text-gray-800";
  if (val > 0) return "text-red-600";
  if (val < 0) return "text-blue-600";
  return "text-gray-900";
}

function formatCell(col: string, val: unknown, label: string): string {
  if (val == null || val === "") return "—";
  if (typeof val !== "number") return String(val);
  if (label === "보유비중" || label === "지수선도" || label === "분산추이") {
    return `${val.toFixed(2)}%`;
  }
  if (col === "종가" || col === "거래량") {
    return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function rowBg(label: string): string {
  if (["1주", "1달", "1분기", "1년"].includes(label)) return "bg-[#E8F8F5]";
  if (SUMMARY_ROW_LABELS.has(label)) return "bg-[#FEF9E7]";
  if (HIGHLIGHT_ROW_LABELS.has(label) && !SUMMARY_ROW_LABELS.has(label)) return "bg-[#E8F8F5]";
  return "";
}

function GenericTable({
  title,
  rows,
  rowKeyField = "label",
  pctMode = false,
  showAllCols = false,
}: {
  title: string;
  rows: SupplyDemandTableRow[] | DispersionTableRow[];
  rowKeyField?: string;
  pctMode?: boolean;
  showAllCols?: boolean;
}) {
  if (!rows.length) return null;
  const cols = pctMode ? DISPLAY_COLS : TABLE_COLS;

  return (
    <div className="space-y-2 sm:space-y-3">
      <h3 className="text-base font-bold text-gray-800 text-center border-b border-gray-200 pb-2">
        {title}
      </h3>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-max min-w-full mx-auto text-[10px] sm:text-[11px] border-collapse dataframe whitespace-nowrap">
          <thead>
            <tr className="bg-[#f7f7f9] text-gray-700">
              <th className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-center border border-gray-300 font-bold sticky left-0 bg-[#f7f7f9] z-10">
                {rowKeyField === "stat" ? "통계" : rowKeyField === "date" ? "일자" : "일자"}
              </th>
              {cols.map((c) => (
                <th
                  key={c}
                  className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-right border border-gray-300 font-bold whitespace-nowrap ${
                    !showAllCols && MOBILE_HIDDEN_COLS.has(c) ? "hidden sm:table-cell" : ""
                  } ${c === "세력" ? "bg-green-50" : ""}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const label = String(row[rowKeyField] ?? row.label ?? i);
              return (
                <tr key={`${label}-${i}`} className={rowBg(label)}>
                  <td className="px-1.5 sm:px-2.5 py-1 text-center text-gray-800 font-medium border border-gray-300 sticky left-0 bg-inherit z-10">
                    {label}
                  </td>
                  {cols.map((c) => {
                    const val = row[c];
                    return (
                      <td
                        key={c}
                        className={`px-1.5 sm:px-2.5 py-1 text-right tabular-nums border border-gray-300 ${
                          !showAllCols && MOBILE_HIDDEN_COLS.has(c) ? "hidden sm:table-cell" : ""
                        } ${cellColor(c, val, label)} ${c === "세력" ? "bg-green-50/60" : ""}`}
                      >
                        {pctMode && typeof val === "number"
                          ? `${(val * 100).toFixed(2)}%`
                          : formatCell(c, val, label)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface SugeubTablesProps {
  tableSupply: SupplyDemandTableRow[];
  tableLds: SupplyDemandTableRow[];
  tableDispersionRecent: DispersionTableRow[];
  tableDispersionPeak: DispersionTableRow[];
}

export function SugeubTables({
  tableSupply,
  tableLds,
  tableDispersionRecent,
  tableDispersionPeak,
}: SugeubTablesProps) {
  const [showAllCols, setShowAllCols] = useState(false);

  return (
    <div className="space-y-6 sm:space-y-10">
      <div className="flex items-center justify-end sm:hidden">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAllCols}
            onChange={(e) => setShowAllCols(e.target.checked)}
            className="accent-blue-600 w-4 h-4"
          />
          상세 열 표시
        </label>
      </div>
      <GenericTable title="수급 분석표 (상세)" rows={tableSupply} showAllCols={showAllCols} />
      <GenericTable title="투자자별 매매동향 이동평균 (요약)" rows={tableLds} showAllCols={showAllCols} />
      <div className="space-y-4 sm:space-y-6">
        <h3 className="text-base font-bold text-gray-800 text-center border-b-2 border-gray-200 pb-2">
          분산비율 상세
        </h3>
        <GenericTable title="최근 5일" rows={tableDispersionRecent} rowKeyField="date" pctMode showAllCols={showAllCols} />
        <GenericTable title="최고가 시점" rows={tableDispersionPeak} rowKeyField="date" pctMode showAllCols={showAllCols} />
      </div>
      <p className="text-[10px] text-gray-400 text-center sm:hidden">
        좌우로 밀어 모든 항목을 확인할 수 있습니다
      </p>
    </div>
  );
}
