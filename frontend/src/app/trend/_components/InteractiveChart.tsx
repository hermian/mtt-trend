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

// 툴팁/범례에 표시할 데이터 타입
interface HoveredData {
  time: string;
  ohlc?: { open: number; high: number; low: number; close: number };
  indicators: Record<string, number>;
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({
  symbol,
  configs,
  height = 600,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());
  
  const [status, setStatus] = useState<string>("Initializing...");
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);

  const indicatorNames = useMemo(() => 
    configs.filter(c => c.id !== "main").map(c => c.id).join(","), 
    [configs]
  );
  const { data: chartData } = useChartData(symbol, indicatorNames);

  useEffect(() => {
    if (!containerRef.current) return;

    setStatus("Configuring Tooltips...");
    
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
        const el = Array.from(containers).find(
          (c) => (c as HTMLElement).dataset.chartId === config.id
        ) as HTMLElement;

        if (!el) return;

        const chartHeight = (height * config.heightRatio) / totalRatio;

        const chart = createChart(el, {
          width,
          height: chartHeight,
          layout: {
            background: { type: ColorType.Solid, color: "#0f172a" },
            textColor: "#94a3b8",
          },
          grid: {
            vertLines: { color: "#1e293b" },
            horzLines: { color: "#1e293b" },
          },
          timeScale: {
            visible: index === configs.length - 1,
            borderColor: "#334155",
            rightOffset: 5,
            barSpacing: 6,
          },
          rightPriceScale: {
            borderColor: "#334155",
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true,
            // 글자 짤림 방지를 위해 최소 너비 확보
            minimumWidth: 60,
          },
          crosshair: { 
            mode: CrosshairMode.Normal,
            vertLine: {
               labelVisible: index === configs.length - 1,
               color: "#64748b",
               width: 1,
               style: 1,
            },
            horzLine: {
               color: "#64748b",
               width: 1,
               style: 1,
            }
          },
          handleScroll: true,
          handleScale: true,
        });

        const series = config.id === "main"
          ? chart.addSeries(CandlestickSeries, { upColor: "#ef4444", downColor: "#3b82f6", borderVisible: false, wickUpColor: "#ef4444", wickDownColor: "#3b82f6" })
          : config.type === "histogram"
          ? chart.addSeries(HistogramSeries, { color: config.color || "#10b981" })
          : chart.addSeries(LineSeries, { color: config.color || "#60a5fa", lineWidth: 2 });

        // --- 데이터 포인트 찾기 및 툴팁 업데이트 로직 ---
        chart.subscribeCrosshairMove((param) => {
           // 1. 다른 차트들 세로선 동기화
           chartsRef.current.forEach((c, id) => {
             if (id === config.id) return;
             if (!param.time || (param.point && param.point.x < 0)) {
               c.setCrosshairPosition(undefined, undefined, undefined as any);
             } else {
               c.setCrosshairPosition(undefined, param.time, undefined as any);
             }
           });

           // 2. 툴팁(범례) 데이터 추출
           if (!param.time || !param.point || param.point.x < 0) {
              setHoveredData(null);
           } else {
              const currentData = chartData?.data.find(p => p.time === param.time);
              if (currentData) {
                setHoveredData({
                  time: currentData.time,
                  ohlc: { 
                    open: currentData.open ?? 0, 
                    high: currentData.high ?? 0, 
                    low: currentData.low ?? 0, 
                    close: currentData.close ?? 0 
                  },
                  indicators: currentData.indicators || {}
                });
              }
           }
        });

        // 시간 축 동기화
        chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
           const range = chart.timeScale().getVisibleLogicalRange();
           if (range) {
             chartsRef.current.forEach((c, id) => {
               if (id !== config.id) c.timeScale().setVisibleLogicalRange(range);
             });
           }
        });

        chartsRef.current.set(config.id, chart);
        seriesRef.current.set(config.id, series);
      });

      setStatus("Waiting for Data...");
    } catch (e: any) {
      console.error("Init Error:", e);
      setStatus("Error");
    }

    return cleanup;
  }, [height, symbol, chartData]); // chartData 추가하여 툴팁 로직에서 접근 가능하게 함

  useEffect(() => {
    if (!chartData || !chartData.data || chartData.data.length === 0) return;
    if (seriesRef.current.size === 0) return;

    configs.forEach((config) => {
      const series = seriesRef.current.get(config.id);
      if (!series) return;

      const data = config.id === "main" 
        ? chartData.data.map(p => ({ time: p.time, open: p.open ?? 0, high: p.high ?? 0, low: p.low ?? 0, close: p.close ?? 0 }))
        : chartData.data.filter(p => p.indicators && p.indicators[config.id] !== undefined).map(p => ({ time: p.time, value: p.indicators![config.id] }));
      
      series.setData(data);
    });

    chartsRef.current.forEach(c => c.timeScale().fitContent());
    setStatus("Ready");
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

      {/* Floating Global Tooltip (Legend Area) */}
      <div className="p-4 border-b border-slate-800 bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status === "Ready" ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" : "bg-blue-500 animate-pulse"}`}></div>
          <h3 className="font-bold text-slate-100 text-lg uppercase tracking-tight">{symbol} 분석</h3>
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
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 font-mono italic">마우스를 올려 상세 데이터를 확인하세요</div>
        )}
      </div>
      
      <div className="flex-1 flex flex-col bg-slate-950 p-4 gap-2">
        {configs.map((config, index) => (
          <div key={config.id} className="relative group">
            {/* 개별 차트 지표 값 레이블 */}
            {hoveredData && (
              <div className="absolute top-2 right-16 z-30 pointer-events-none text-[10px] font-mono bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded border border-white/5">
                {config.id === "main" ? (
                  <span className={hoveredData.ohlc && hoveredData.ohlc.close >= hoveredData.ohlc.open ? "text-red-400" : "text-blue-400"}>
                    {hoveredData.ohlc?.close}
                  </span>
                ) : (
                  <span className="text-blue-300">
                    {hoveredData.name}: {hoveredData.indicators[config.id]?.toFixed(2)}
                  </span>
                )}
              </div>
            )}
            
            <div 
              data-chart-id={config.id} 
              className={`relative rounded-xl overflow-hidden border border-slate-900/50 ${index === 0 ? "sticky top-0 z-10 shadow-2xl" : ""}`} 
              style={{ height: `${(height * config.heightRatio) / configs.reduce((acc, curr) => acc + curr.heightRatio, 0)}px` }}
            >
              <div className="absolute top-3 left-4 z-20 pointer-events-none">
                <span className="text-[9px] font-black text-slate-500 bg-slate-900/90 backdrop-blur px-2 py-0.5 rounded border border-slate-800 uppercase tracking-widest">
                  {config.name}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InteractiveChart;
