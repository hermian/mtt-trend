"use client";

import { useStocksGroupAction } from "@/hooks/useStocks";
import { GroupActionStock, DataSource } from "@/lib/api";
import clsx from "clsx";

interface GroupActionTableProps {
  date: string;
  source?: DataSource;
}

function RsChangeBadge({ value }: { value: number | null }) {
  if (value === null) {
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

function ChangePctCell({ value }: { value: number }) {
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

export function GroupActionTable({ date, source = "52w_high" }: GroupActionTableProps) {
  const { data: stocks, isLoading, error } = useStocksGroupAction(date, source);

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
        <p>그룹 액션 탐지 데이터가 없습니다</p>
      </div>
    );
  }

  // Sort by rs_score desc
  const sorted = [...stocks].sort((a, b) => b.rs_score - a.rs_score);

  // Separate new vs returning stocks based on theme_rs_change
  // Positive = gaining momentum (new), negative = losing (returning to baseline)
  const getStockStatus = (
    stock: GroupActionStock
  ): "new" | "returning" | "neutral" => {
    if (stock.theme_rs_change > 5) return "new";
    if (stock.theme_rs_change < -5) return "returning";
    return "neutral";
  };

  return (
    <div>
      <p className="text-sm text-gray-400 mb-3">
        {date} 기준 그룹 액션 탐지 ({stocks.length}개 종목)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                종목명
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                RS점수
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                등락률
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                소속 테마
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                테마RS변화
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((stock, index) => {
              const status = getStockStatus(stock);
              return (
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
                        stock.rs_score >= 70
                          ? "text-red-400"
                          : stock.rs_score >= 50
                            ? "text-yellow-400"
                            : "text-blue-400"
                      )}
                    >
                      {stock.rs_score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ChangePctCell value={stock.change_pct} />
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {stock.theme_name}
                  </td>
                  <td className="px-4 py-3">
                    <RsChangeBadge value={stock.theme_rs_change} />
                  </td>
                  <td className="px-4 py-3">
                    {status === "new" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                        신규
                      </span>
                    ) : status === "returning" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        재등장
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-300 border border-gray-500/30">
                        유지
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
