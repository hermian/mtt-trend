"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  SeriesType,
} from "lightweight-charts";
import { useChartData } from "@/hooks/useChartData";

export interface IndicatorConfig {
  id: string;
  name: string;
  type: "candlestick" | "line" | "histogram";
  heightRatio: number;
  color?: string;
}

interface InteractiveChartProps {
  symbol: string;
  configs: IndicatorConfig[];
  height?: number;
}

interface HoveredData {
  time: string;
  ohlc?: { open: number; high: number; low: number; close: number };
  indicators: Record<string, number>;
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({
  symbol,
  configs,
  height = 800, // 기본 높이 상향 조정
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<SeriesType>[]>>(new Map());
  
  const isSyncingRef = useRef<boolean>(false);
  const chartDataRef = useRef<any>(null);
  
  const [status, setStatus] = useState<string>("Initializing...");
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);

  const indicatorNames = useMemo(() => {
    const names = configs.filter(c => c.id !== "main").map(c => c.id);
    if (names.includes("macd")) names.push("macd_signal");
    // 주가 전용 SMA 데이터 명시적 요청
    names.push("price_sma50", "price_sma200");
    return names.join(",");
  }, [configs]);
  
  const { data: chartData } = useChartData(symbol, indicatorNames);

  useEffect(() => {
    if (chartData) chartDataRef.current = chartData;
  }, [chartData]);

  const scrollToLatest = () => {
    if (chartDataRef.current?.data && chartsRef.current.size > 0) {
      const data = chartDataRef.current.data;
      const lastIndex = data.length - 1;
      if (lastIndex >= 0) {
        const startIndex = Math.max(0, lastIndex - 150);
        const range = { from: data[startIndex].time as any, to: data[lastIndex].time as any };
        isSyncingRef.current = true;
        chartsRef.current.forEach(c => {
          c.timeScale().setVisibleRange(range);
          c.timeScale().scrollToPosition(8, false);
        });
        setTimeout(() => { isSyncingRef.current = false; }, 200);
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    setStatus("Building High-End Charts...");
    
    const cleanup = () => {
      chartsRef.current.forEach(c => c.remove());
      chartsRef.current.clear();
      seriesRef.current.clear();
    };
    cleanup();

    try {
      const containers = containerRef.current.querySelectorAll("[data-chart-id]");
      const width = containerRef.current.clientWidth;
      const totalRatio = configs.reduce((acc, curr) => acc + curr.heightRatio, 0);

      configs.forEach((config, index) => {
        const el = Array.from(containers).find((c) => (c as HTMLElement).dataset.chartId === config.id) as HTMLElement;
        if (!el) return;

        const chartHeight = (height * config.heightRatio) / totalRatio;
        const chart = createChart(el, {
          width,
          height: chartHeight,
          layout: { background: { type: ColorType.Solid, color: "#0f172a" }, textColor: "#94a3b8" },
          grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
          timeScale: { visible: index === configs.length - 1, borderColor: "#334155", rightOffset: 20, barSpacing: 10 },
          rightPriceScale: { borderColor: "#334155", scaleMargins: { top: 0.1, bottom: 0.1 }, autoScale: true, minimumWidth: 100 },
          crosshair: { mode: CrosshairMode.Normal, vertLine: { labelVisible: index === configs.length - 1, color: "#64748b", width: 1, style: 1 }, horzLine: { color: "#64748b", width: 1, style: 1 } },
        });

        const activeSeries: ISeriesApi<SeriesType>[] = [];

        if (config.id === "main") {
          // 1. 메인 캔들스틱
          activeSeries.push(chart.addSeries(CandlestickSeries, { 
            upColor: "#ef4444", downColor: "#3b82f6", borderVisible: false, 
            wickUpColor: "#ef4444", wickDownColor: "#3b82f6" 
          }));
          // 2. 주가 SMA50 오버레이 (초록색)
          activeSeries.push(chart.addSeries(LineSeries, { color: "#10b981", lineWidth: 1.5, title: "SMA50" }));
          // 3. 주가 SMA200 오버레이 (빨간색)
          activeSeries.push(chart.addSeries(LineSeries, { color: "#f43f5e", lineWidth: 1.5, title: "SMA200" }));
        } else if (config.id === "macd") {
          activeSeries.push(chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1.5, lineStyle: 2 }));
        } else {
          const seriesType = config.type === "histogram" ? HistogramSeries : LineSeries;
          activeSeries.push(chart.addSeries(seriesType, { color: config.color || "#60a5fa", lineWidth: 2 }));
        }

        chart.subscribeCrosshairMove((param) => {
           chartsRef.current.forEach((c, id) => {
             if (id === config.id) return;
             if (!param.time || (param.point && param.point.x < 0)) {
               c.setCrosshairPosition(undefined, undefined, undefined as any);
             } else {
               c.setCrosshairPosition(undefined, param.time, undefined as any);
             }
           });

           if (!param.time || !param.point || param.point.x < 0) {
              setHoveredData(null);
           } else {
              const currentPoint = chartDataRef.current?.data.find((p: any) => p.time === param.time);
              if (currentPoint) {
                setHoveredData({
                  time: currentPoint.time,
                  ohlc: { open: currentPoint.open ?? 0, high: currentPoint.high ?? 0, low: currentPoint.low ?? 0, close: currentPoint.close ?? 0 },
                  indicators: currentPoint.indicators || {}
                });
              }
           }
        });

        chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
           if (isSyncingRef.current) return;
           const range = chart.timeScale().getVisibleLogicalRange();
           if (range) {
             isSyncingRef.current = true;
             chartsRef.current.forEach((c, id) => { if (id !== config.id) c.timeScale().setVisibleLogicalRange(range); });
             setTimeout(() => { isSyncingRef.current = false; }, 10);
           }
        });

        chartsRef.current.set(config.id, chart);
        seriesRef.current.set(config.id, activeSeries);
      });
      setStatus("Engine Ready");
    } catch (e: any) {
      console.error("Init Error:", e);
      setStatus("Error");
    }
    return cleanup;
  }, [height, configs]);

  useEffect(() => {
    if (!chartData || !chartData.data || chartData.data.length === 0) return;
    if (seriesRef.current.size === 0) return;
    setStatus("Syncing Data...");

    configs.forEach((config) => {
      const activeSeries = seriesRef.current.get(config.id);
      if (!activeSeries || activeSeries.length === 0) return;

      if (config.id === "main") {
        // 주가 데이터
        activeSeries[0].setData(chartData.data.map(p => ({ time: p.time, open: p.open ?? 0, high: p.high ?? 0, low: p.low ?? 0, close: p.close ?? 0 })));
        // 오버레이 SMA50 (필터링 제거)
        activeSeries[1].setData(chartData.data.map(p => ({ time: p.time, value: p.indicators?.price_sma50 || p.close || 0 })));
        // 오버레이 SMA200 (필터링 제거)
        activeSeries[2].setData(chartData.data.map(p => ({ time: p.time, value: p.indicators?.price_sma200 || p.close || 0 })));
      } else if (config.id === "macd") {
        // MACD 본선 (필터링 제거)
        activeSeries[0].setData(chartData.data.map(p => ({ time: p.time, value: p.indicators?.macd || 0 })));
        // MACD 시그널 (필터링 제거)
        if (activeSeries[1]) {
          activeSeries[1].setData(chartData.data.map(p => ({ time: p.time, value: p.indicators?.macd_signal || 0 })));
        }
      } else {
        // 기타 지표 (필터링 제거)
        activeSeries[0].setData(chartData.data.map(p => {
          const indicators = p.indicators || {};
          const targetKey = Object.keys(indicators).find(k => k.toLowerCase() === config.id.toLowerCase());
          const value = targetKey ? indicators[targetKey] : (p.close || 0);
          return { time: p.time, value: value };
        }));
      }
    });

    const timer = setTimeout(() => { scrollToLatest(); setStatus("Ready"); }, 500);
    return () => clearTimeout(timer);
  }, [chartData, configs]);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      chartsRef.current.forEach(c => c.applyOptions({ width: w }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div ref={containerRef} className="relative flex flex-col w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {status !== "Ready" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md text-slate-400 font-mono text-sm uppercase tracking-widest">
           {status}
        </div>
      )}

      <div className="p-4 border-b border-slate-800 bg-slate-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${status === "Ready" ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" : "bg-blue-500 animate-pulse"}`}></div>
          <h3 className="font-bold text-slate-100 text-lg uppercase tracking-tight">{chartData?.symbol || symbol} 분석</h3>
          <button onClick={scrollToLatest} className="ml-2 text-[10px] bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white px-2 py-1 rounded border border-slate-600 transition-all font-bold uppercase tracking-tighter">Go to Latest</button>
        </div>
        
        {hoveredData ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono">
            <div className="text-slate-400">DATE: <span className="text-slate-100 font-bold">{hoveredData.time}</span></div>
            <div className="flex gap-3">
              <span className="text-slate-400">O: <span className="text-slate-100 font-bold">{hoveredData.ohlc?.open}</span></span>
              <span className="text-slate-400">H: <span className="text-red-400 font-bold">{hoveredData.ohlc?.high}</span></span>
              <span className="text-slate-400">L: <span className="text-blue-400 font-bold">{hoveredData.ohlc?.low}</span></span>
              <span className="text-slate-400">C: <span className="text-slate-100 font-bold">{hoveredData.ohlc?.close}</span></span>
            </div>
            {/* 주가 전용 SMA 값 표시 */}
            <div className="flex gap-3 border-l border-slate-700 pl-3">
               <span className="text-emerald-400">MA50: {hoveredData.indicators["price_sma50"]?.toFixed(2) || "N/A"}</span>
               <span className="text-rose-400">MA200: {hoveredData.indicators["price_sma200"]?.toFixed(2) || "N/A"}</span>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 font-mono italic">마우스를 올려 상세 데이터를 확인하세요</div>
        )}
      </div>
      
      {/* 데이터 스크롤 영역 */}
      <div className="flex-1 flex flex-col bg-slate-950 p-4 gap-2 overflow-y-auto custom-scrollbar h-full">
        {configs.map((config, index) => (
          <div key={config.id} className={`relative group shrink-0 ${index === 0 ? "sticky top-0 z-30 shadow-2xl bg-slate-950" : ""}`}>
            {hoveredData && (
              <div className="absolute top-2 right-16 z-30 pointer-events-none text-[10px] font-mono bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded border border-white/5 flex gap-3">
                {config.id === "main" ? (
                  <span className={hoveredData.ohlc && hoveredData.ohlc.close >= hoveredData.ohlc.open ? "text-red-400" : "text-blue-400"}>{hoveredData.ohlc?.close}</span>
                ) : config.id === "macd" ? (
                  <>
                    <span className="text-blue-400">MACD: {hoveredData.indicators["macd"]?.toFixed(2) || "N/A"}</span>
                    <span className="text-orange-400">SIG: {hoveredData.indicators["macd_signal"]?.toFixed(2) || "N/A"}</span>
                  </>
                ) : (
                  <span className="text-blue-300">{config.name}: {hoveredData.indicators[config.id]?.toFixed(2) || "N/A"}</span>
                )}
              </div>
            )}
            
            <div data-chart-id={config.id} className={`relative rounded-xl overflow-hidden border border-slate-900/50`} style={{ height: `${(height * config.heightRatio) / configs.reduce((acc, curr) => acc + curr.heightRatio, 0)}px` }}>
              <div className="absolute top-3 left-4 z-20 pointer-events-none">
                <span className="text-[9px] font-black text-slate-500 bg-slate-900/90 backdrop-blur px-2 py-0.5 rounded border border-slate-800 uppercase tracking-widest">{config.name}</span>
              </div>
            </div>
            
            {/* 주가 차트와 지표 사이의 시각적 구분선 (Sticky 효과 극대화) */}
            {index === 0 && <div className="h-4 bg-gradient-to-b from-slate-950 to-transparent"></div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InteractiveChart;
