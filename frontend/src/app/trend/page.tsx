"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDates } from "@/hooks/useThemes";
import { TopThemesBar } from "./_components/TopThemesBar";
import { SurgingThemesCard } from "./_components/SurgingThemesCard";
import { ThemeTrendChart } from "./_components/ThemeTrendChart";
import { StockAnalysisTabs } from "./_components/StockAnalysisTabs";
import { ThemeStocksPanel } from "./_components/ThemeStocksPanel";
import InteractiveChart, { IndicatorConfig } from "./_components/InteractiveChart";
import type { DataSource } from "@/lib/api";

const SOURCE_LABELS: Record<DataSource, string> = {
  "52w_high": "52주 신고가",
  mtt: "MTT 종목",
};

const CHART_CONFIGS: IndicatorConfig[] = [
  { id: "main", name: "주가 (OHLC)", type: "candlestick", heightRatio: 3 },
  { id: "rsi", name: "RSI (14)", type: "line", heightRatio: 1, color: "#fbbf24" },
  { id: "macd", name: "MACD", type: "histogram", heightRatio: 1, color: "#10b981" },
];

function TrendPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") === "chart" ? "chart" : "overview";
  
  const [source, setSource] = useState<DataSource>("52w_high");
  const { data: dates, isLoading: datesLoading, error: datesError } = useDates(source);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDate(null);
    if (dates && dates.length > 0) {
      setSelectedDate(dates[dates.length - 1]);
    }
  }, [source, dates]);

  function handleThemeClick(themeName: string) {
    if (selectedTheme === themeName) {
      setSelectedTheme(null);
    } else {
      setSelectedTheme(themeName);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <header className="h-16 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between px-6 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest">
              {activeTab === "overview" ? "Theme Overview" : "Technical Analysis"}
            </h2>
            {activeTab === "chart" && selectedTheme && (
              <span className="bg-blue-900/40 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-800/50">
                Selected: {selectedTheme}
              </span>
            )}
          </div>

          <div className="flex items-center gap-6">
            {/* Source Toggle */}
            <div className="hidden sm:flex items-center bg-black/30 p-1 rounded-lg border border-gray-800">
                {(["52w_high", "mtt"] as DataSource[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                      source === s ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {SOURCE_LABELS[s]}
                  </button>
                ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-medium">기준일</span>
              {datesLoading ? (
                <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
              ) : (
                <select
                  value={selectedDate || ""}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-gray-800 text-xs border border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  {dates?.map((date) => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {!selectedDate ? (
            <div className="flex items-center justify-center h-full text-gray-500 animate-pulse font-medium">
              데이터를 로드하고 있습니다...
            </div>
          ) : (
            <>
              {activeTab === "overview" && (
                <div className="max-w-7xl mx-auto space-y-8">
                  {/* Summary Cards Section */}
                  <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                        테마별 RS 점수
                      </h3>
                      <TopThemesBar
                        date={selectedDate}
                        source={source}
                        onThemeClick={handleThemeClick}
                        selectedTheme={selectedTheme}
                      />
                    </div>

                    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                        신규 급등 테마 탐지
                      </h3>
                      <SurgingThemesCard date={selectedDate} source={source} />
                    </div>
                  </section>

                  {/* Theme Stock Details Slide Panel */}
                  {selectedTheme && (
                    <ThemeStocksPanel
                      themeName={selectedTheme}
                      date={selectedDate}
                      source={source}
                      onClose={() => setSelectedTheme(null)}
                    />
                  )}

                  {/* RS Trend Chart */}
                  <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
                      테마 RS 추이
                    </h3>
                    <ThemeTrendChart date={selectedDate} source={source} />
                  </section>

                  {/* Stock Analysis Tabs */}
                  <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 pb-10 hover:border-gray-700 transition-colors">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                      상세 종목 분석
                    </h3>
                    <StockAnalysisTabs date={selectedDate} source={source} />
                  </section>
                </div>
              )}

              {activeTab === "chart" && (
                <div className="max-w-7xl mx-auto h-full flex flex-col">
                  <div className="mb-6 flex justify-between items-end border-b border-gray-800 pb-6">
                    <div>
                      <h3 className="text-2xl font-extrabold text-white tracking-tight">Interactive Technical Analytics</h3>
                      <p className="text-gray-400 text-sm mt-1">실시간 가격 및 기술적 지표 심층 분석 엔진 (Beta)</p>
                    </div>
                    {selectedTheme && (
                       <button 
                         onClick={() => router.push("/trend")}
                         className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-900/30 transition-all"
                       >
                         ← 대시보드 요약보기
                       </button>
                    )}
                  </div>
                  
                  <div className="flex-1 min-h-[800px]">
                    <InteractiveChart 
                      symbol={selectedTheme || "KOSPI"} 
                      configs={CHART_CONFIGS}
                      height={800}
                    />
                  </div>
                  
                  <div className="mt-8 p-6 bg-gray-900/40 border border-gray-800 rounded-2xl">
                    <h4 className="text-blue-400 font-bold text-xs mb-3 font-mono tracking-tighter uppercase">System Status & Config</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] text-gray-500">
                       <p>Target Symbol: <span className="text-gray-300 font-bold">{selectedTheme || "KOSPI (Default)"}</span></p>
                       <p>Indicators: <span className="text-gray-300 font-bold">{CHART_CONFIGS.map(c => c.name).join(", ")}</span></p>
                       <p>Engine: <span className="text-gray-300 font-bold">Lightweight Charts 60fps Canvas</span></p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function TrendPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-500 bg-gray-950">페이지를 준비 중입니다...</div>}>
      <TrendPageContent />
    </Suspense>
  );
}
