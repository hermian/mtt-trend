"use client";

import { useState, useEffect } from "react";
import { useDates } from "@/hooks/useThemes";
import { TopThemesBar } from "./_components/TopThemesBar";
import { ThemeTrendChart } from "./_components/ThemeTrendChart";
import { StockAnalysisTabs } from "./_components/StockAnalysisTabs";
import type { DataSource } from "@/lib/api";

const SOURCE_LABELS: Record<DataSource, string> = {
  "52w_high": "52주 신고가",
  mtt: "MTT 종목",
};

export default function TrendPage() {
  const [source, setSource] = useState<DataSource>("52w_high");
  const { data: dates, isLoading: datesLoading, error: datesError } = useDates(source);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Reset date when source changes
  useEffect(() => {
    setSelectedDate(null);
  }, [source]);

  // Set default to latest date when dates are loaded
  useEffect(() => {
    if (dates && dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[dates.length - 1]);
    }
  }, [dates, selectedDate]);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">52주 고점 테마 트렌드</h1>
          <p className="text-gray-400 text-sm mt-1">
            테마별 RS(상대강도) 분석 대시보드
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Source Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-600">
            {(["52w_high", "mtt"] as DataSource[]).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  source === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {SOURCE_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-3">
            <label htmlFor="date-select" className="text-sm text-gray-400">
              기준일:
            </label>
            {datesLoading ? (
              <div className="h-9 w-36 bg-gray-700 rounded-lg animate-pulse" />
            ) : datesError ? (
              <span className="text-red-400 text-sm">날짜 로드 실패</span>
            ) : (
              <select
                id="date-select"
                value={selectedDate || ""}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {dates?.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {selectedDate ? (
        <>
          {/* Section 2: Top Themes Bar Chart */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              테마별 RS 점수 (상위 15) — {SOURCE_LABELS[source]}
            </h2>
            <TopThemesBar date={selectedDate} source={source} />
          </section>

          {/* Section 3: Theme RS Trend Chart */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              테마 RS 추이
            </h2>
            <ThemeTrendChart date={selectedDate} source={source} />
          </section>

          {/* Section 4: Stock Analysis Tabs */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              종목 분석
            </h2>
            <StockAnalysisTabs date={selectedDate} source={source} />
          </section>
        </>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">날짜를 선택하세요</p>
        </div>
      )}
    </div>
  );
}
