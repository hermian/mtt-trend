"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  Time,
  CandlestickData,
  LineData,
} from "lightweight-charts";
import {
  getTrendUpBreadthData,
  TrendUpBreadthResponse,
  TrendUpBreadthPoint,
  ChartDataPoint,
  HistogramBin,
  DistributionStats,
} from "@/lib/api";
import { toChartTime } from "./_lib/chartTime";

export type UniverseType = "krx300" | "kospi" | "kosdaq" | "all";

const UNIVERSE_OPTIONS: { id: UniverseType; label: string; desc: string }[] = [
  { id: "krx300", label: "KRX 300", desc: "코스피/코스닥 핵심 300종목" },
  { id: "kospi", label: "KOSPI", desc: "코스피 전체 상장종목" },
  { id: "kosdaq", label: "KOSDAQ", desc: "코스닥 전체 상장종목" },
  { id: "all", label: "전체 (KOSPI+KOSDAQ)", desc: "국내 시장 전체 통합 종목" },
];

const PERIOD_OPTIONS = [
  { label: "1년", value: "1y" },
  { label: "3년", value: "3y" },
  { label: "5년", value: "5y" },
  { label: "전체", value: "all" },
];

/** 히스토그램 뷰 컴포넌트 */
interface HistogramCardProps {
  title: string;
  subtitle: string;
  stats: DistributionStats;
  colorClass: "blue" | "emerald";
  xAxisUnit: string;
}

const HistogramCard: React.FC<HistogramCardProps> = ({
  title,
  subtitle,
  stats,
  colorClass,
  xAxisUnit,
}) => {
  const [hoveredBin, setHoveredBin] = useState<HistogramBin | null>(null);

  const maxCount = useMemo(() => {
    if (!stats.bins || stats.bins.length === 0) return 1;
    return Math.max(...stats.bins.map((b) => b.count), 1);
  }, [stats.bins]);

  const maxRange = useMemo(() => {
    if (!stats.bins || stats.bins.length === 0) return 100;
    return stats.bins[stats.bins.length - 1].x_end;
  }, [stats.bins]);

  const barColor = colorClass === "blue" ? "bg-blue-500 hover:bg-blue-400" : "bg-emerald-500 hover:bg-emerald-400";
  const activeBarColor = colorClass === "blue" ? "bg-blue-400 ring-2 ring-blue-300" : "bg-emerald-400 ring-2 ring-emerald-300";
  const latestBarColor = "bg-amber-400 ring-2 ring-amber-300 animate-pulse";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col flex-1 shadow-lg">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white tracking-wide">{title}</h4>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono border border-gray-700/60" title={`누적 데이터 기간: ${stats.start_date || ""} ~ ${stats.end_date || ""}`}>
              {stats.start_date && stats.end_date ? `${stats.start_date} ~ ${stats.end_date}` : `${stats.total_days.toLocaleString()}일 데이터`}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle} · 총 {stats.total_days.toLocaleString()}거래일 기준</p>
        </div>

        {/* Latest & Percentile Badges */}
        <div className="flex items-center gap-2 font-mono">
          <div className="bg-amber-500/15 border border-amber-500/40 rounded px-2 py-1 text-right">
            <div className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold">Latest ({stats.end_date || "최신일"})</div>
            <div className="text-xs font-bold text-amber-400">
              {stats.latest != null ? `${stats.latest.toFixed(1)}%` : "-"}
              <span className="text-[11px] text-amber-300/80 ml-1 font-normal">
                ({stats.percentile != null ? `${stats.percentile.toFixed(1)}%ile` : "-"})
              </span>
            </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-right">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Median</div>
            <div className="text-xs font-bold text-gray-200">
              {stats.median != null ? `${stats.median.toFixed(1)}%` : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Sub-Bar */}
      <div className="grid grid-cols-4 gap-2 my-3 text-center text-xs font-mono bg-gray-950/60 p-2 rounded-lg border border-gray-800/60">
        <div>
          <span className="text-gray-500 block text-[10px]">평균 (Mean)</span>
          <span className="text-gray-300 font-semibold">{stats.mean != null ? `${stats.mean.toFixed(1)}%` : "-"}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">중앙값 (Median)</span>
          <span className="text-gray-300 font-semibold">{stats.median != null ? `${stats.median.toFixed(1)}%` : "-"}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">최소 (Min)</span>
          <span className="text-gray-400">{stats.min != null ? `${stats.min.toFixed(1)}%` : "-"}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">최대 (Max)</span>
          <span className="text-gray-400">{stats.max != null ? `${stats.max.toFixed(1)}%` : "-"}</span>
        </div>
      </div>

      {/* Histogram SVG/Bar Canvas */}
      <div className="flex-1 flex flex-col justify-end pt-2 pb-1 min-h-[160px]">
        {/* Hover info tooltip line */}
        <div className="h-5 text-[11px] font-mono text-center text-gray-300 flex items-center justify-center gap-2">
          {hoveredBin ? (
            <>
              <span className="text-amber-400 font-semibold">{hoveredBin.x_label}</span>
              <span className="text-gray-400">|</span>
              <span className="text-white font-bold">{hoveredBin.count} 거래일</span>
              <span className="text-gray-500">
                ({((hoveredBin.count / (stats.total_days || 1)) * 100).toFixed(1)}%)
              </span>
              {hoveredBin.is_latest_bin && (
                <span className="bg-amber-400/20 text-amber-300 px-1 py-0.2 rounded text-[10px]">★ 현재 위치</span>
              )}
            </>
          ) : (
            <span className="text-gray-500 text-[11px]">막대에 마우스를 올리면 상세 일수가 표시됩니다</span>
          )}
        </div>

        {/* Bars Container with Median Vertical Line */}
        <div className="relative flex items-end gap-1 h-32 px-2 pt-2 border-b border-gray-700/80">
          {/* Median 세로 붉은 점선 바 */}
          {stats.median != null && maxRange > 0 && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-10 flex flex-col items-center"
              style={{ left: `${Math.min(98, Math.max(2, (stats.median / maxRange) * 100))}%` }}
            >
              <div className="bg-red-600 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow -translate-y-1 select-none whitespace-nowrap border border-red-400/30">
                Median {stats.median.toFixed(1)}%
              </div>
              <div className="flex-1 w-0 border-l-2 border-red-500 border-dashed opacity-90 shadow-sm" />
            </div>
          )}

          {stats.bins && stats.bins.length > 0 ? (
            stats.bins.map((b, idx) => {
              const heightPct = Math.max(4, (b.count / maxCount) * 100);
              const isHovered = hoveredBin === b;
              const isLatest = b.is_latest_bin;

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  onMouseEnter={() => setHoveredBin(b)}
                  onMouseLeave={() => setHoveredBin(null)}
                >
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t transition-all duration-150 ${
                      isLatest
                        ? latestBarColor
                        : isHovered
                        ? activeBarColor
                        : barColor
                    }`}
                  />
                </div>
              );
            })
          ) : (
            <div className="w-full flex items-center justify-center text-gray-500 text-xs font-mono">
              분포 데이터가 없습니다.
            </div>
          )}
        </div>

        {/* X-Axis labels */}
        <div className="flex justify-between text-[10px] font-mono text-gray-500 px-1 pt-1.5">
          <span>0.0%</span>
          <span className="text-gray-400 font-semibold">{xAxisUnit}</span>
          <span>{stats.bins && stats.bins.length > 0 ? `${stats.bins[stats.bins.length - 1].x_end.toFixed(0)}%` : "100%"}</span>
        </div>
      </div>
    </div>
  );
};

export const TrendUpBreadthPanel: React.FC = () => {
  const [universe, setUniverse] = useState<UniverseType>("krx300");
  const [period, setPeriod] = useState<string>("3y");
  const [priceScaleMode, setPriceScaleMode] = useState<"log" | "linear">("log");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrendUpBreadthResponse | null>(null);

  // Hovered HUD Data
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<{
    close?: number;
    sma10?: number;
    sma20?: number;
    sma50?: number;
    sma150?: number;
    sma200?: number;
  } | null>(null);
  const [hoveredBreadth, setHoveredBreadth] = useState<{
    ratio?: number;
    ratio5ma?: number;
    trendUpStocks?: number;
    totalStocks?: number;
  } | null>(null);

  // Chart DOM Containers
  const indexChartContainerRef = useRef<HTMLDivElement>(null);
  const breadthChartContainerRef = useRef<HTMLDivElement>(null);

  const indexChartRef = useRef<IChartApi | null>(null);
  const breadthChartRef = useRef<IChartApi | null>(null);

  const isSyncingRef = useRef<boolean>(false);
  // Calculate start date based on period (기본 3년으로 가볍고 빠른 초기 로드)
  const startDate = useMemo(() => {
    const now = new Date();
    if (period === "1y") {
      const d = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return d.toISOString().slice(0, 10);
    }
    if (period === "3y") {
      const d = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
      return d.toISOString().slice(0, 10);
    }
    if (period === "5y") {
      const d = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      return d.toISOString().slice(0, 10);
    }
    return undefined; // "all"
  }, [period]);

  // Fetch Data (선택된 기간 및 유니버스 데이터 로드)
  useEffect(() => {
    let isCancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await getTrendUpBreadthData(universe, startDate);
        if (!isCancelled) {
          setData(res);
          // Set initial HUD values to latest data point
          if (res.breadth_data && res.breadth_data.length > 0) {
            const lastB = res.breadth_data[res.breadth_data.length - 1];
            setHoveredDate(lastB.time);
            setHoveredBreadth({
              ratio: lastB.trend_up_ratio ?? undefined,
              ratio5ma: lastB.trend_up_ratio_5ma ?? undefined,
              trendUpStocks: lastB.trend_up_stocks ?? undefined,
              totalStocks: lastB.total_stocks ?? undefined,
            });
          }
          if (res.index_data && res.index_data.length > 0) {
            const lastI = res.index_data[res.index_data.length - 1];
            setHoveredIndex({
              close: lastI.close ?? undefined,
              sma10: lastI.indicators?.sma10 ?? undefined,
              sma20: lastI.indicators?.sma20 ?? undefined,
              sma50: lastI.indicators?.sma50 ?? undefined,
              sma150: lastI.indicators?.sma150 ?? undefined,
              sma200: lastI.indicators?.sma200 ?? undefined,
            });
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const errMsg = err instanceof Error ? err.message : "데이터 로드 실패";
          setError(errMsg);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      isCancelled = true;
    };
  }, [universe, startDate]);

  // Initialize and render lightweight-charts
  useEffect(() => {
    if (!data || !indexChartContainerRef.current || !breadthChartContainerRef.current) return;

    // Clean up previous charts
    if (indexChartRef.current) {
      indexChartRef.current.remove();
      indexChartRef.current = null;
    }
    if (breadthChartRef.current) {
      breadthChartRef.current.remove();
      breadthChartRef.current = null;
    }
    const commonChartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: "#0B0E14" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.4)" },
        horzLines: { color: "rgba(30, 41, 59, 0.4)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#64748b", width: 1 as const, style: LineStyle.Dashed },
        horzLine: { color: "#64748b", width: 1 as const, style: LineStyle.Dashed },
      },
      timeScale: {
        borderColor: "#334155",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#334155",
        autoScale: true,
        minimumWidth: 85, // X축 틀어짐 방지: 상하단 차트 Y축 너비를 85px로 일치
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    };

    // 1. Index Candlestick Chart (높이 420px, Y축 Log scale, 상단 X축 라벨 숨김)
    const indexChart = createChart(indexChartContainerRef.current, {
      ...commonChartOptions,
      height: 420,
      timeScale: {
        visible: false, // 상단 지수 차트 X축은 숨기고 하단 차트 X축과 수직 일체화
        borderColor: "#334155",
      },
      rightPriceScale: {
        ...commonChartOptions.rightPriceScale,
        mode: priceScaleMode === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
    });
    indexChartRef.current = indexChart;

    const sma10Series = indexChart.addSeries(LineSeries, { color: "#a855f7", lineWidth: 1, priceLineVisible: false });
    const sma20Series = indexChart.addSeries(LineSeries, { color: "#eab308", lineWidth: 1, priceLineVisible: false });
    const sma50Series = indexChart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, priceLineVisible: false });
    const sma150Series = indexChart.addSeries(LineSeries, { color: "#ec4899", lineWidth: 2, priceLineVisible: false });
    const sma200Series = indexChart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2, priceLineVisible: false });

    // Format and set data for index chart
    const candleData: CandlestickData<Time>[] = [];
    const sma10Data: LineData<Time>[] = [];
    const sma20Data: LineData<Time>[] = [];
    const sma50Data: LineData<Time>[] = [];
    const sma150Data: LineData<Time>[] = [];
    const sma200Data: LineData<Time>[] = [];

    const indexMap = new Map<string, ChartDataPoint>();

    data.index_data.forEach((p) => {
      const t = toChartTime(p.time);
      if (!t || p.open == null || p.high == null || p.low == null || p.close == null) return;
      candleData.push({ time: t, open: p.open, high: p.high, low: p.low, close: p.close });
      indexMap.set(p.time, p);

      if (p.indicators?.sma10 != null) sma10Data.push({ time: t, value: p.indicators.sma10 });
      if (p.indicators?.sma20 != null) sma20Data.push({ time: t, value: p.indicators.sma20 });
      if (p.indicators?.sma50 != null) sma50Data.push({ time: t, value: p.indicators.sma50 });
      if (p.indicators?.sma150 != null) sma150Data.push({ time: t, value: p.indicators.sma150 });
      if (p.indicators?.sma200 != null) sma200Data.push({ time: t, value: p.indicators.sma200 });
    });

    candleSeries.setData(candleData);
    sma10Series.setData(sma10Data);
    sma20Series.setData(sma20Data);
    sma50Series.setData(sma50Data);
    sma150Series.setData(sma150Data);
    sma200Series.setData(sma200Data);

    // 2. Trend-up Breadth Chart
    const breadthChart = createChart(breadthChartContainerRef.current, {
      ...commonChartOptions,
      height: 220,
    });
    breadthChartRef.current = breadthChart;

    // Daily Ratio Line (옅은 하늘색)
    const dailySeries = breadthChart.addSeries(LineSeries, {
      color: "rgba(96, 165, 250, 0.45)",
      lineWidth: 1,
      priceLineVisible: false,
    });
    // 5-day MA Ratio Line (진한 파란색)
    const ma5Series = breadthChart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    // Reference Price Line: Median (AGENTS.md 규칙: title 생략, 눈금자 배지만 표시)
    if (data.distribution_5ma.median != null) {
      ma5Series.createPriceLine({
        price: data.distribution_5ma.median,
        color: "#94a3b8",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "",
      });
    }

    const dailyData: LineData<Time>[] = [];
    const ma5Data: LineData<Time>[] = [];
    const breadthMap = new Map<string, TrendUpBreadthPoint>();

    data.breadth_data.forEach((p) => {
      const t = toChartTime(p.time);
      if (!t) return;
      breadthMap.set(p.time, p);

      if (p.trend_up_ratio != null) dailyData.push({ time: t, value: p.trend_up_ratio });
      if (p.trend_up_ratio_5ma != null) ma5Data.push({ time: t, value: p.trend_up_ratio_5ma });
    });

    dailySeries.setData(dailyData);
    ma5Series.setData(ma5Data);

    // Synchronize Crosshairs & TimeScale between Index & Breadth charts
    const timeScaleIndex = indexChart.timeScale();
    const timeScaleBreadth = breadthChart.timeScale();

    timeScaleIndex.subscribeVisibleLogicalRangeChange((range) => {
      if (isSyncingRef.current || !range) return;
      isSyncingRef.current = true;
      timeScaleBreadth.setVisibleLogicalRange(range);
      isSyncingRef.current = false;
    });

    timeScaleBreadth.subscribeVisibleLogicalRangeChange((range) => {
      if (isSyncingRef.current || !range) return;
      isSyncingRef.current = true;
      timeScaleIndex.setVisibleLogicalRange(range);
      isSyncingRef.current = false;
    });

    // Crosshair Sync & HUD updates
    const updateHovered = (timeStr: string | null) => {
      if (!timeStr) return;
      setHoveredDate(timeStr);
      const bPt = breadthMap.get(timeStr);
      if (bPt) {
        setHoveredBreadth({
          ratio: bPt.trend_up_ratio ?? undefined,
          ratio5ma: bPt.trend_up_ratio_5ma ?? undefined,
          trendUpStocks: bPt.trend_up_stocks ?? undefined,
          totalStocks: bPt.total_stocks ?? undefined,
        });
      }
      const iPt = indexMap.get(timeStr);
      if (iPt) {
        setHoveredIndex({
          close: iPt.close ?? undefined,
          sma10: iPt.indicators?.sma10 ?? undefined,
          sma20: iPt.indicators?.sma20 ?? undefined,
          sma50: iPt.indicators?.sma50 ?? undefined,
          sma150: iPt.indicators?.sma150 ?? undefined,
          sma200: iPt.indicators?.sma200 ?? undefined,
        });
      }
    };

    const extractTimeString = (timeVal: Time): string => {
      if (typeof timeVal === "string") return timeVal;
      if (typeof timeVal === "number") {
        const d = new Date(timeVal * 1000);
        return d.toISOString().slice(0, 10);
      }
      return `${timeVal.year}-${String(timeVal.month).padStart(2, "0")}-${String(timeVal.day).padStart(2, "0")}`;
    };

    indexChart.subscribeCrosshairMove((param) => {
      if (!param.time) return;
      updateHovered(extractTimeString(param.time));
    });

    breadthChart.subscribeCrosshairMove((param) => {
      if (!param.time) return;
      updateHovered(extractTimeString(param.time));
    });

    // Initial fit view (동일한 일자 배열이므로 완벽히 동일한 시간 윈도우 핏팅)
    timeScaleIndex.fitContent();
    timeScaleBreadth.fitContent();
    // Resize Observer
    const handleResize = () => {
      if (indexChartContainerRef.current && indexChartRef.current) {
        indexChartRef.current.applyOptions({ width: indexChartContainerRef.current.clientWidth });
      }
      if (breadthChartContainerRef.current && breadthChartRef.current) {
        breadthChartRef.current.applyOptions({ width: breadthChartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (indexChartRef.current) {
        indexChartRef.current.remove();
        indexChartRef.current = null;
      }
      if (breadthChartRef.current) {
        breadthChartRef.current.remove();
        breadthChartRef.current = null;
      }
    };
  }, [data]);

  // Handle Log/Linear Price Scale Toggle
  useEffect(() => {
    if (indexChartRef.current) {
      try {
        indexChartRef.current.priceScale("right").applyOptions({
          mode: priceScaleMode === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
          autoScale: true,
        });
      } catch (e) {
        // ignore if not yet mounted
      }
    }
  }, [priceScaleMode]);
  // Period Preset Click Handler
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };
  return (
    <div className="flex flex-col gap-4 p-4 min-h-screen bg-gray-950 text-white custom-scrollbar">
      {/* Control Bar & Universe Selection */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3.5 shadow-md">
        {/* Left: Title & Universe Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-wide">Market Breadth</h2>
            <span className="text-xs text-blue-400 font-medium px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded-full">
              Trend-up Breadth
            </span>
          </div>

          <div className="h-4 w-px bg-gray-700 hidden sm:block" />

          {/* Universe Buttons */}
          <div className="flex items-center bg-gray-950 p-1 rounded-lg border border-gray-800 gap-1">
            {UNIVERSE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setUniverse(opt.id)}
                title={opt.desc}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  universe === opt.id
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Period Buttons */}
        <div className="flex items-center bg-gray-950 p-1 rounded-lg border border-gray-800 gap-1">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-all ${
                period === p.value
                  ? "bg-gray-800 text-amber-400 font-bold border border-gray-700"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Layout */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-[550px] bg-gray-900 border border-gray-800 rounded-xl">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-mono text-gray-400 animate-pulse">
            {UNIVERSE_OPTIONS.find((u) => u.id === universe)?.label} Trend-up Breadth 연산 중...
          </p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 bg-red-950/20 border border-red-800/40 rounded-xl text-red-400 text-sm">
          오류가 발생했습니다: {error}
        </div>
      ) : (
        <>
          {/* Charts Container */}
          <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            {/* Upper Chart: Index Candlestick + MA Lines */}
            <div className="flex flex-col border-b border-gray-800">
              {/* Index Chart Header HUD */}
              <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-gray-900/90 border-b border-gray-800 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-200">{data?.universe_name} 지수 주가</span>
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-400">기준일:</span>
                  <span className="text-amber-400 font-bold">{hoveredDate || "-"}</span>
                  {hoveredIndex?.close != null && (
                    <span className="text-white font-bold ml-1">종가 {hoveredIndex.close.toLocaleString()}</span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                  {/* Log / Linear Toggle */}
                  <div className="flex items-center bg-gray-950 p-0.5 rounded border border-gray-700">
                    <button
                      onClick={() => setPriceScaleMode("log")}
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                        priceScaleMode === "log" ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Log
                    </button>
                    <button
                      onClick={() => setPriceScaleMode("linear")}
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                        priceScaleMode === "linear" ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Linear
                    </button>
                  </div>
                  <span className="text-purple-400">SMA10 {hoveredIndex?.sma10?.toLocaleString() ?? "-"}</span>
                  <span className="text-yellow-400">SMA20 {hoveredIndex?.sma20?.toLocaleString() ?? "-"}</span>
                  <span className="text-blue-400">SMA50 {hoveredIndex?.sma50?.toLocaleString() ?? "-"}</span>
                  <span className="text-pink-400">SMA150 {hoveredIndex?.sma150?.toLocaleString() ?? "-"}</span>
                  <span className="text-red-400 font-semibold">SMA200 {hoveredIndex?.sma200?.toLocaleString() ?? "-"}</span>
                </div>
              </div>

              {/* Index Chart Canvas */}
              <div ref={indexChartContainerRef} className="w-full" />
            </div>

            {/* Middle Chart: Trend-up Breadth Time Series */}
            <div className="flex flex-col">
              {/* Breadth Chart Header HUD */}
              <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-gray-900/90 border-b border-gray-800 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-400">Trend-up Breadth (%)</span>
                  <span className="text-gray-500 text-[11px]">
                    (조건: MA20 &gt; MA40 &amp;&amp; MA20 상승 &amp;&amp; MA40 상승)
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-blue-300">
                    일간: <strong className="text-white">{hoveredBreadth?.ratio != null ? `${hoveredBreadth.ratio.toFixed(1)}%` : "-"}</strong>
                  </span>
                  <span className="text-blue-500">
                    5일평균: <strong className="text-blue-400 font-bold">{hoveredBreadth?.ratio5ma != null ? `${hoveredBreadth.ratio5ma.toFixed(1)}%` : "-"}</strong>
                  </span>
                  {hoveredBreadth?.trendUpStocks != null && hoveredBreadth?.totalStocks != null && (
                    <span className="text-gray-400">
                      상승종목: <strong className="text-gray-200">{hoveredBreadth.trendUpStocks}</strong> / {hoveredBreadth.totalStocks}개
                    </span>
                  )}
                  {data?.distribution_5ma.median != null && (
                    <span className="text-gray-400 border-l border-gray-700 pl-2">
                      중앙값 기준선: <strong className="text-gray-300">{data.distribution_5ma.median.toFixed(1)}%</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Breadth Chart Canvas */}
              <div ref={breadthChartContainerRef} className="w-full" />
            </div>
          </div>

          {/* Lower Row: 2 Distribution Histograms in 1 Row (1열에 2개 배치) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Daily Trend-up Ratio Distribution */}
            {data && (
              <HistogramCard
                title="일간 추세상승 비율 분포 (Daily Ratio)"
                subtitle="전체 거래일 중 일간 Trend-up 비율(%) 빈도 분포"
                stats={data.distribution_daily}
                colorClass="blue"
                xAxisUnit="Trend-up Ratio (%)"
              />
            )}

            {/* 2. 5-Day MA Ratio Distribution */}
            {data && (
              <HistogramCard
                title="5일 이동평균 비율 분포 (5-day MA)"
                subtitle="전체 거래일 중 5일 스무딩 Trend-up 비율(%) 빈도 분포"
                stats={data.distribution_5ma}
                colorClass="emerald"
                xAxisUnit="5-day Average (%)"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TrendUpBreadthPanel;
