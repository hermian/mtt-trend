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
import { AboveMaChart } from "./_components/AboveMaChart";
import { MacroChart } from "./_components/MacroChart";
import { WicsRankingPanel } from "./_components/WicsRankingPanel";
import { WicsIndexExplorer } from "./_components/WicsIndexExplorer";
import { MarketFlowChart } from "./_components/MarketFlowChart";
import { ForeignFlowChart } from "./_components/ForeignFlowChart";
import { StockbeeMmPanel } from "./_components/StockbeeMmPanel";
import type { DataSource } from "@/lib/api";

const SOURCE_LABELS: Record<DataSource, string> = {
  "52w_high": "52주 신고가",
  mtt: "MTT 종목",
};

const CHART_CONFIGS: IndicatorConfig[] = [
  { id: "main", name: "주가 (OHLC)", type: "candlestick", heightRatio: 5 },
  { id: "above_sma_group", name: "Above SMA 10/20/50 (R/G/B)", type: "line", heightRatio: 1.5 },
  { id: "above_sma200", name: "Above SMA 200 (Breadth)", type: "line", heightRatio: 1, color: "#60a5fa" },
  { id: "adr_group", name: "ADR 14/20 (Ratio)", type: "line", heightRatio: 2 },
  { id: "disparity_sma50", name: "SMA50 이격도", type: "line", heightRatio: 2, color: "#eab308" },
  { id: "rsi", name: "RSI (14)", type: "line", heightRatio: 2, color: "#fbbf24" },
  { id: "stochastic", name: "Stochastic (5,3,3)", type: "line", heightRatio: 2 },
  { id: "macd", name: "MACD (12,26,9)", type: "line", heightRatio: 2, color: "#3b82f6" },
  { id: "vix_fix", name: "VIX Fix (22) & Fear", type: "line", heightRatio: 2, color: "#ef4444" },
];

const REAL_DATA_THEMES = [
  "kodex_leverage",
  "kosdaq_leverage",
  "kospi",
  "kospi200",
  "kosdaq",
  "kosdaq150"
];

const ABOVE_MA_MARKETS = [
  "kospi",
  "kospi200",
  "kosdaq",
  "kosdaq150"
];

function TrendPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab");
  const activeTab =
    rawTab === "chart"
      ? "chart"
      : rawTab === "above_ma"
      ? "above_ma"
      : rawTab === "macro"
      ? "macro"
      : rawTab === "wics_ranking"
      ? "wics_ranking"
      : rawTab === "wics_index"
      ? "wics_index"
      : rawTab === "market_flow"
      ? "market_flow"
      : rawTab === "foreign_flow"
      ? "foreign_flow"
      : rawTab === "stockbee_mm"
      ? "stockbee_mm"
      : "overview";
  
  const [source, setSource] = useState<DataSource>("mtt");
  const { data: dates, isLoading: datesLoading, error: datesError } = useDates(source);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  // 오버뷰 탭(52주 트렌드)에서는 레버리지/지수 테마가 선택되지 않도록 제어 (내비게이션 캐시 문제 해결)
  useEffect(() => {
    if (activeTab === "overview" && selectedTheme && REAL_DATA_THEMES.includes(selectedTheme)) {
      setSelectedTheme(null);
    }
  }, [activeTab, selectedTheme]);

  // 차트 탭 진입 시 테마가 선택되어 있지 않거나 실제 데이터 테마가 아니라면 기본값으로 kospi 설정
  useEffect(() => {
    if (activeTab === "chart" && (!selectedTheme || !REAL_DATA_THEMES.includes(selectedTheme))) {
      setSelectedTheme("kospi");
    }
  }, [activeTab, selectedTheme]);

  // Above MA 탭 진입 시 시장 인덱스가 선택되어 있지 않거나 Above MA 시장이 아니라면 기본값으로 kospi 설정
  useEffect(() => {
    if (activeTab === "above_ma" && (!selectedTheme || !ABOVE_MA_MARKETS.includes(selectedTheme.toLowerCase()))) {
      setSelectedTheme("kospi");
    }
  }, [activeTab, selectedTheme]);

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
        {/* Header Bar - 차트 및 Above MA 탭일 때는 숨김 처리하여 공간 확보 */}
        {activeTab !== "chart" && activeTab !== "above_ma" && activeTab !== "macro" && activeTab !== "wics_ranking" && activeTab !== "wics_index" && activeTab !== "market_flow" && activeTab !== "foreign_flow" && activeTab !== "stockbee_mm" && (
          <header className="h-16 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between px-6 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-3">
                <span>{activeTab === "overview" ? "Theme Overview" : "Technical Analysis"}</span>
              </h2>
              {selectedDate && (
                <span className="text-lg md:text-xl font-extrabold text-blue-400 font-mono tracking-tight bg-blue-500/10 px-3 py-0.5 rounded-lg border border-blue-500/20 shadow-sm">
                  {selectedDate}
                </span>
              )}
              {selectedTheme && (
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
        )}

        {/* Scrollable Content - 차트 탭일 때는 내부에서 스크롤을 제어하므로 overflow-hidden 및 패딩 제거 */}
        <div className={`flex-1 ${activeTab === "chart" || activeTab === "wics_ranking" || activeTab === "wics_index" || activeTab === "stockbee_mm" ? "overflow-hidden pr-[20px] md:pr-0" : "overflow-y-auto p-4 md:p-8"} custom-scrollbar`}>
          {!selectedDate && activeTab !== "wics_ranking" && activeTab !== "wics_index" && activeTab !== "market_flow" && activeTab !== "above_ma" && activeTab !== "foreign_flow" && activeTab !== "macro" && activeTab !== "stockbee_mm" ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 font-medium">
              {datesLoading ? (
                <div className="animate-pulse">데이터를 로드하고 있습니다...</div>
              ) : datesError ? (
                <div className="text-red-400">데이터를 불러오는 중 오류가 발생했습니다. (백엔드 서버 상태를 확인하세요)</div>
              ) : (!dates || dates.length === 0) ? (
                <div className="text-amber-400">조회할 수 있는 날짜 데이터가 없습니다. DB 동기화(DB Sync)를 진행해 주세요.</div>
              ) : (
                <div className="animate-pulse">데이터를 로드하고 있습니다...</div>
              )}
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
                        date={selectedDate || ""}
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
                      <SurgingThemesCard
                        date={selectedDate || ""}
                        source={source}
                        onThemeClick={handleThemeClick}
                        selectedTheme={selectedTheme}
                      />
                    </div>
                  </section>

                  {/* Theme Stock Details Slide Panel */}
                  {selectedTheme && (
                    <ThemeStocksPanel
                      themeName={selectedTheme}
                      date={selectedDate || ""}
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
                    <ThemeTrendChart date={selectedDate || ""} source={source} />
                  </section>

                  {/* Stock Analysis Tabs */}
                  <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 pb-10 hover:border-gray-700 transition-colors">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                      상세 종목 분석
                    </h3>
                    <StockAnalysisTabs date={selectedDate || ""} source={source} />
                  </section>
                </div>
              )}

              {activeTab === "chart" && (
                <div className="w-full h-full flex flex-col px-3 md:px-6 pr-[20px] md:pr-6">
                  {(!selectedTheme || !REAL_DATA_THEMES.includes(selectedTheme)) && (
                    <div className="mb-4 p-3 bg-amber-900/30 border border-amber-800/50 rounded-xl flex items-center gap-3">
                      <span className="text-amber-500 animate-pulse">⚠️</span>
                      <p className="text-[11px] text-amber-200/80 font-medium">
                        <strong className="text-amber-400">DUMMY DATA WARNING:</strong> 현재 {selectedTheme || "KOSPI"} 데이터는 서버에서 생성된 시뮬레이션 값입니다. 실제 데이터를 보려면 아래의 <button onClick={() => setSelectedTheme("kospi")} className="underline font-bold text-amber-300 hover:text-white">KOSPI</button> 또는 <button onClick={() => setSelectedTheme("kodex_leverage")} className="underline font-bold text-amber-300 hover:text-white">KODEX 레버리지</button> 등 실제 지수/레버리지 버튼을 클릭하세요.
                      </p>
                    </div>
                  )}
                  <div className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-end border-b border-gray-800 pb-6 gap-4">
                    <div>
                      <h3 className="text-2xl font-extrabold text-white tracking-tight">Interactive Technical Analytics</h3>
                      <p className="text-gray-400 text-sm mt-1">실시간 가격 및 기술적 지표 심층 분석 엔진 (Beta)</p>
                      
                      {/* 프리미엄 인덱스 & 레버리지 분리형 칩 선택 영역 */}
                      <div className="flex flex-wrap gap-4 mt-3 bg-gray-900/60 p-4 rounded-xl border border-gray-800">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider font-bold">Market Index</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: "kospi", name: "KOSPI" },
                              { id: "kospi200", name: "KOSPI 200" },
                              { id: "kosdaq", name: "KOSDAQ" },
                              { id: "kosdaq150", name: "KOSDAQ 150" }
                            ].map(item => (
                              <button
                                key={item.id}
                                onClick={() => setSelectedTheme(item.id)}
                                className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all duration-200 ${
                                  selectedTheme === item.id 
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 transform scale-[1.02]" 
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-white"
                                }`}
                              >
                                {item.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="w-[1px] bg-gray-800 self-stretch hidden md:block"></div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider font-bold">Leverage Index</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: "kodex_leverage", name: "KODEX LEVERAGE" },
                              { id: "kosdaq_leverage", name: "KOSDAQ LEVERAGE" }
                            ].map(item => (
                              <button
                                key={item.id}
                                onClick={() => setSelectedTheme(item.id)}
                                className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all duration-200 ${
                                  selectedTheme === item.id 
                                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 transform scale-[1.02]" 
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-white"
                                }`}
                              >
                                {item.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {selectedTheme && (
                       <button 
                         onClick={() => router.push("/trend")}
                         className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-900/30 transition-all self-start lg:self-end shrink-0"
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

              {(activeTab === "above_ma" || activeTab === "market_flow") && (
                <div className="w-full h-full flex flex-col gap-10">
                  {/* --- Top: Above MA Realtime Trends --- */}
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end border-b border-gray-800 pb-6 gap-4">
                      <div>
                        <h3 className="text-2xl font-extrabold text-white tracking-tight">Above MA Realtime Trends</h3>
                        <p className="text-gray-400 text-sm mt-1">이동평균선(10/20/50 MA) 상회 종목 비율 실시간 추이 분석 (정전 시 보간 지원)</p>
                        
                        {/* 시장 인덱스 선택 영역 */}
                        <div className="flex flex-wrap gap-2 mt-4 bg-gray-900/60 p-4 rounded-xl border border-gray-800">
                          {[
                            { id: "kospi", name: "KOSPI" },
                            { id: "kospi200", name: "KOSPI 200" },
                            { id: "kosdaq", name: "KOSDAQ" },
                            { id: "kosdaq150", name: "KOSDAQ 150" }
                          ].map(item => (
                            <button
                              key={item.id}
                              onClick={() => setSelectedTheme(item.id)}
                              className={`text-xs px-4 py-2 rounded-lg font-bold transition-all duration-200 ${
                                (selectedTheme?.toLowerCase() || "kospi") === item.id 
                                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 transform scale-[1.02]" 
                                  : "bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-white"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => router.push("/trend")}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-900/30 transition-all self-start lg:self-end shrink-0"
                      >
                        ← 대시보드 요약보기
                      </button>
                    </div>
                    
                    <div className="min-h-[690px]">
                      <AboveMaChart 
                        market={selectedTheme?.toUpperCase() || "KOSPI"} 
                      />
                    </div>
                    
                    <div className="p-6 bg-gray-900/40 border border-gray-800 rounded-2xl">
                      <h4 className="text-blue-400 font-bold text-xs mb-3 font-mono tracking-tighter uppercase">Above MA System Status</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] text-gray-500">
                         <p>Target Index: <span className="text-gray-300 font-bold">{selectedTheme?.toUpperCase() || "KOSPI"}</span></p>
                         <p>DB Source: <span className="text-gray-300 font-bold">realtime_above_ma.db (SQLite)</span></p>
                         <p>Interpolation Status: <span className="text-emerald-400 font-bold">Active (Linear 15m grid)</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Section Divider */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-800" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-gray-950 px-4 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                        Market Flow & Supply
                      </span>
                    </div>
                  </div>

                  {/* --- Bottom: Market Flow & Supply --- */}
                  <div className="flex flex-col gap-6 mb-10">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end border-b border-gray-800 pb-6 gap-4">
                      <div>
                        <h3 className="text-2xl font-extrabold text-white tracking-tight">Market Flow & Supply</h3>
                        <p className="text-gray-400 text-sm mt-1">국내 주가지수와 시장 메이저 수급의 추이를 실시간으로 모니터링</p>
                      </div>
                    </div>
                    
                    <div className="min-h-[690px]">
                      <MarketFlowChart />
                    </div>
                    
                    <div className="p-6 bg-gray-900/40 border border-gray-800 rounded-2xl">
                      <h4 className="text-blue-400 font-bold text-xs mb-3 font-mono tracking-tighter uppercase">Market Flow Database Status</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] text-gray-500">
                         <p>Source DB: <span className="text-gray-300 font-bold">~/.cache/db/macro.db (market_flow)</span></p>
                         <p>Data Range: <span className="text-gray-300 font-bold">KOSPI200, KQ150, Major supply & demand</span></p>
                         <p>Collector status: <span className="text-emerald-400 font-bold">Active (5m Interval via telegram_kospi200_v2.sh)</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "macro" && (
                <div className="w-full h-full flex flex-col gap-6">
                  <div className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-end border-b border-gray-800 pb-6 gap-4">
                    <div>
                      <h3 className="text-2xl font-extrabold text-white tracking-tight">Macro & Sentiment Metrics</h3>
                      <p className="text-gray-400 text-sm mt-1">S&P 500, High Yield Spread, 그리고 CNN Fear & Greed Index 추이 분석</p>
                    </div>
                    <button 
                      onClick={() => router.push("/trend")}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-900/30 transition-all self-start lg:self-end shrink-0"
                    >
                      ← 대시보드 요약보기
                    </button>
                  </div>
                  
                  <div className="flex-1 min-h-0">
                    <MacroChart />
                  </div>
                  
                  <div className="mt-8 p-6 bg-gray-900/40 border border-gray-800 rounded-2xl mb-10">
                    <h4 className="text-blue-400 font-bold text-xs mb-3 font-mono tracking-tighter uppercase">Macro Database Status</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] text-gray-500">
                       <p>Source DB: <span className="text-gray-300 font-bold">~/.cache/db/macro.db</span></p>
                       <p>Series: <span className="text-gray-300 font-bold">SP500, HY, FGI, 일평균수출(FinJump·주간·ffill) 등</span></p>
                       <p>Integration: <span className="text-emerald-400 font-bold">Full Outer Join (Daily Aligned)</span></p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "foreign_flow" && (
                <div className="w-full h-full flex flex-col gap-6">
                  <div className="flex justify-end">
                    <button
                      onClick={() => router.push("/trend")}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-900/30 transition-all"
                    >
                      ← 대시보드 요약보기
                    </button>
                  </div>
                  <ForeignFlowChart />
                  <div className="p-6 bg-gray-900/40 border border-gray-800 rounded-2xl mb-10">
                    <h4 className="text-blue-400 font-bold text-xs mb-3 font-mono tracking-tighter uppercase">Foreign Flow Cache Status</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] text-gray-500">
                      <p>Source: <span className="text-gray-300 font-bold">~/.cache/finance_krx/*.parquet</span></p>
                      <p>Refresh: <span className="text-gray-300 font-bold">screener cron market_sugeub.py (18:17)</span></p>
                      <p>Mode: <span className="text-emerald-400 font-bold">Read-only</span></p>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "wics_ranking" && (
                <div className="w-full h-full flex flex-col px-3 md:px-6 pr-[20px] md:pr-6 gap-6">
                  <div className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-end border-b border-gray-800 pb-6 gap-4">
                    <div>
                      <h3 className="text-2xl font-extrabold text-white tracking-tight">WICS Industry Rankings</h3>
                      <p className="text-gray-400 text-sm mt-1">각 월별 WICS 섹터 랭킹 및 상위 섹터 추이 시각화</p>
                    </div>
                    <button 
                      onClick={() => router.push("/trend")}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-900/30 transition-all self-start lg:self-end shrink-0"
                    >
                      ← 대시보드 요약보기
                    </button>
                  </div>
                  
                  <WicsRankingPanel />
                </div>
              )}
              {activeTab === "wics_index" && (
                <div className="h-full flex flex-col pr-[20px] md:pr-0">
                  <div className="px-3 md:px-4 pt-3 md:pt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-gray-800 pb-3">
                    <div>
                      <h3 className="text-xl font-extrabold text-white tracking-tight">WICS Index Explorer</h3>
                      <p className="text-gray-400 text-xs mt-0.5">
                        전 섹터 오버레이 · 보이는 구간 왼쪽=100 · 주도섹터 탐색
                      </p>
                    </div>
                    <button
                      onClick={() => router.push("/trend?tab=wics_ranking")}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-900/30 self-start"
                    >
                      WICS 랭킹 →
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <WicsIndexExplorer />
                  </div>
                </div>
              )}

              {activeTab === "stockbee_mm" && (
                <div className="h-full flex flex-col px-3 md:px-6 pr-[20px] md:pr-6 gap-4 pt-3 md:pt-4">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end border-b border-gray-800 pb-4 gap-3">
                    <div>
                      <h3 className="text-2xl font-extrabold text-white tracking-tight">Stockbee Market Monitor</h3>
                      <p className="text-gray-400 text-sm mt-1">
                        한국: marcap 계산 DB · 미국: Stockbee 공개 스프레드시트
                      </p>
                    </div>
                    <button
                      onClick={() => router.push("/trend")}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-900/30 self-start lg:self-end shrink-0"
                    >
                      ← 대시보드 요약보기
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <StockbeeMmPanel />
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
