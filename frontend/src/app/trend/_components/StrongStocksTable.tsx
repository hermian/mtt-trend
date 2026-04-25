"use client";

import { useState, useMemo } from "react";
import { useStocksPersistent } from "@/hooks/useStocks";
import { PersistentStock, DataSource } from "@/lib/api";
import clsx from "clsx";

// SPEC-MTT-017: 등락률 셀 컴포넌트 (null/undefined이면 "-" 표시)
function ChangePctCell({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <span className="text-gray-400">-</span>;
  }
  const isPositive = value > 0;
  return (
    <span
      className={clsx(
        "font-medium",
        value > 0
          ? "text-green-400"
          : value < 0
            ? "text-red-400"
            : "text-gray-400"
      )}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

// SPEC-MTT-017: 테마RS변화 뱃지 컴포넌트 (null이면 "-" 표시)
function RsChangeBadge({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <span className="text-gray-400">-</span>;
  }
  const isPositive = value > 0;
  const isNeutral = value === 0;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 font-semibold",
        isNeutral
          ? "text-gray-400"
          : isPositive
            ? "text-green-400"
            : "text-red-400"
      )}
    >
      {!isNeutral && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isPositive ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
          />
        </svg>
      )}
      {isPositive ? "+" : ""}
      {value.toFixed(2)}
    </span>
  );
}

type SortKey = "stock_name" | "avg_rs" | "appearance_count";
type SortDir = "asc" | "desc";

export function StrongStocksTable({ source = "52w_high" }: { source?: DataSource }) {
  const { data: stocks, isLoading, error } = useStocksPersistent(5, 3, source);
  const [sortKey, setSortKey] = useState<SortKey>("avg_rs");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedStocks = useMemo(() => {
    if (!stocks) return [];
    // 'kodex_leverage', 'kosdaq_leverage' 테마 소속 종목 제외 필터링 추가
    return [...stocks]
      .filter(s => !s.themes.includes("kodex_leverage") && !s.themes.includes("kosdaq_leverage"))
      .sort((a, b) => {
        const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [stocks, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-red-400">
        <p>데이터를 불러오는데 실패했습니다</p>
      </div>
    );
  }

  if (!stocks || stocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <p>지속 강세 종목 데이터가 없습니다</p>
      </div>
    );
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) {
      return (
        <svg
          className="w-3 h-3 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l4-4 4 4M8 15l4 4 4-4"
          />
        </svg>
      );
    }
    return sortDir === "asc" ? (
      <svg
        className="w-3 h-3 text-blue-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="w-3 h-3 text-blue-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  return (
    <div>
      <p className="text-sm text-gray-400 mb-3">
        5일 중 3회 이상 출현 종목 ({stocks.length}개)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {(
                [
                  { key: "stock_name" as SortKey, label: "종목명" },
                  { key: "avg_rs" as SortKey, label: "평균RS" },
                  { key: "appearance_count" as SortKey, label: "출현횟수" },
                ] as { key: SortKey; label: string }[]
              ).map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-gray-400 font-medium cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </div>
                </th>
              ))}
              {/* SPEC-MTT-017: 등락률, 테마RS변화 컬럼 추가 */}
              <th className="px-4 py-3 text-left text-gray-400 font-medium">등락률</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">테마RS변화</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">소속 테마</th>
            </tr>
          </thead>
          <tbody>
            {sortedStocks.map((stock, index) => (
              <tr
                key={`${stock.stock_name}-${index}`}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="px-4 py-3 text-white font-medium">
                  {stock.stock_name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "font-semibold",
                      (stock.avg_rs ?? 0) >= 70
                        ? "text-red-400"
                        : (stock.avg_rs ?? 0) >= 50
                          ? "text-yellow-400"
                          : "text-blue-400"
                    )}
                  >
                    {stock.avg_rs != null ? stock.avg_rs.toFixed(1) : "-"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                    {stock.appearance_count}회
                  </span>
                </td>
                {/* SPEC-MTT-017: 등락률, 테마RS변화 셀 */}
                <td className="px-4 py-3">
                  <ChangePctCell value={stock.change_pct} />
                </td>
                <td className="px-4 py-3">
                  <RsChangeBadge value={stock.theme_rs_change} />
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {stock.themes.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
