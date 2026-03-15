"use client";

import { useIntersection } from "@/hooks/useStocks";
import { DataSource } from "@/lib/api";
import clsx from "clsx";

export function IntersectionTab({ source = "52w_high" }: { source?: DataSource }) {
  const { data: themes, isLoading, error } = useIntersection(undefined, source);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-gray-700/30 rounded-lg p-4">
            <div className="h-6 bg-gray-700 rounded animate-pulse mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="h-4 bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-red-400">
        <p>교집합 데이터를 불러오는데 실패했습니다</p>
      </div>
    );
  }

  if (!themes || themes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <p>교집합 추천 테마가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        52w 신고가와 MTT 모두에서 강세인 종목 ({themes.length}개 테마)
      </p>

      {themes.map((theme) => (
        <div
          key={theme.theme_name}
          className="bg-gray-700/30 rounded-lg overflow-hidden"
        >
          {/* Theme Header */}
          <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-600">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {theme.theme_name}
              </h3>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-400">교집합 종목</p>
                  <p className="text-lg font-bold text-blue-400">
                    {theme.intersection_stock_count}개
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">52w 평균 RS</p>
                  <p className="text-lg font-bold text-white">
                    {theme.avg_rs_52w != null ? theme.avg_rs_52w.toFixed(1) : "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stocks Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">종목명</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">RS (52w)</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">RS (MTT)</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">등락률 (52w)</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">등락률 (MTT)</th>
                </tr>
              </thead>
              <tbody>
                {theme.intersection_stocks?.map((stock) => (
                  <tr
                    key={stock.stock_name}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      {stock.stock_name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "font-semibold",
                          (stock.rs_score_52w ?? 0) >= 70
                            ? "text-red-400"
                            : (stock.rs_score_52w ?? 0) >= 50
                              ? "text-yellow-400"
                              : "text-blue-400"
                        )}
                      >
                        {stock.rs_score_52w != null ? stock.rs_score_52w.toFixed(1) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "font-semibold",
                          (stock.rs_score_mtt ?? 0) >= 70
                            ? "text-red-400"
                            : (stock.rs_score_mtt ?? 0) >= 50
                              ? "text-yellow-400"
                              : "text-blue-400"
                        )}
                      >
                        {stock.rs_score_mtt != null ? stock.rs_score_mtt.toFixed(1) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "font-medium",
                          (stock.change_pct_52w ?? 0) > 0
                            ? "text-red-400"
                            : (stock.change_pct_52w ?? 0) < 0
                              ? "text-blue-400"
                              : "text-gray-400"
                        )}
                      >
                        {stock.change_pct_52w != null
                          ? `${stock.change_pct_52w > 0 ? "+" : ""}${stock.change_pct_52w.toFixed(2)}%`
                          : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "font-medium",
                          (stock.change_pct_mtt ?? 0) > 0
                            ? "text-red-400"
                            : (stock.change_pct_mtt ?? 0) < 0
                              ? "text-blue-400"
                              : "text-gray-400"
                        )}
                      >
                        {stock.change_pct_mtt != null
                          ? `${stock.change_pct_mtt > 0 ? "+" : ""}${stock.change_pct_mtt.toFixed(2)}%`
                          : "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
