"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
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
  ohlc?: { open: number; high: number; low: number; close: number; volume: number };
  indicators: Record<string, number>;
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({ symbol, configs, height = 800 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<SeriesType>[]>>(new Map());
  const chartDataRef = useRef<any>(null);
  const isSyncingRef = useRef<boolean>(false);
  const [status, setStatus] = useState<string>("Initializing...");
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);

  const mainConfig = useMemo(() => configs.find(c => c.id === "main"), [configs]);
  const indicatorConfigs = useMemo(() => configs.filter(c => c.id !== "main"), [configs]);

  const indicatorNames = useMemo(() => {
    const names = configs.filter(c => !["main", "sma_group"].includes(c.id)).map(c => c.id);
    if (configs.some(c => c.id === "macd")) names.push("macd_signal");
    if (configs.some(c => c.id === "stochastic")) names.push("stoch_k", "stoch_d");
    if (configs.some(c => c.id === "sma_group")) names.push("sma10", "sma20", "sma50");
    names.push("price_sma50", "price_sma200");
    return names.join(",");
  }, [configs]);
  
  const { data: chartData } = useChartData(symbol, indicatorNames);

  useEffect(() => { if (chartData) chartDataRef.current = chartData; }, [chartData]);

  const scrollToLatest = () => {
    if (chartDataRef.current?.data && chartsRef.current.size > 0) {
      const data = chartDataRef.current.data;
      const lastIndex = data.length - 1;
      if (lastIndex >= 0) {
        const startIndex = Math.max(0, lastIndex - 150);
        const range = { from: data[startIndex].time as any, to: data[lastIndex].time as any };
        isSyncingRef.current = true;
        chartsRef.current.forEach(c => { c.timeScale().setVisibleRange(range); c.timeScale().scrollToPosition(8, false); });
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
      const scrollArea = containerRef.current.querySelector("[data-scroll-area]") as HTMLElement;
      if (!scrollArea) return;
      
      configs.forEach((config, index) => {
        const el = scrollArea.querySelector(`[data-chart-id="${config.id}"]`) as HTMLElement;
        if (!el) return;
        const width = el.clientWidth;
        const chartHeight = config.id === "main" ? 400 : 100;
        
        const chart = createChart(el, {
          width, height: chartHeight,
          layout: { background: { type: ColorType.Solid, color: "#0f172a" }, textColor: "#94a3b8" },
          grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
          timeScale: { visible: index === configs.length - 1, borderColor: "#334155", rightOffset: 20, barSpacing: 10 },
          rightPriceScale: { borderColor: "#334155", scaleMargins: { top: 0.1, bottom: 0.1 }, autoScale: true, minimumWidth: 100 },
          crosshair: { mode: CrosshairMode.Normal, vertLine: { labelVisible: index === configs.length - 1, color: "#64748b", width: 1, style: 1 }, horzLine: { color: "#64748b", width: 1, style: 1 } },
        });

        const activeSeries: ISeriesApi<SeriesType>[] = [];
        if (config.id === "main") {
          activeSeries.push(chart.addSeries(CandlestickSeries, { upColor: "#ef4444", downColor: "#3b82f6", borderVisible: false, wickUpColor: "#ef4444", wickDownColor: "#3b82f6" }));
          // 투명도 30%로 하향 조정
          activeSeries.push(chart.addSeries(HistogramSeries, { 
            color: "rgba(148, 163, 184, 0.3)", 
            priceFormat: { type: "volume" }, 
            priceScaleId: "overlay" 
          }));
          chart.priceScale("overlay").applyOptions({ scaleMargins: { top: 0.65, bottom: 0 } });
          activeSeries.push(chart.addSeries(LineSeries, { color: "#10b981", lineWidth: 1.5, crosshairMarkerVisible: false }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#f43f5e", lineWidth: 1.5, crosshairMarkerVisible: false }));
        } else if (config.id === "sma_group") {
          activeSeries.push(chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 1.5 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 1.5 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1.5 }));
        } else if (config.id === "macd") {
          activeSeries.push(chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1.5, lineStyle: 2 }));
        } else if (config.id === "stochastic") {
          activeSeries.push(chart.addSeries(AreaSeries, { topColor: "rgba(239, 68, 68, 0.4)", bottomColor: "rgba(239, 68, 68, 0.0)", lineVisible: false, crosshairMarkerVisible: false, base: 80 }));
          activeSeries.push(chart.addSeries(AreaSeries, { topColor: "rgba(59, 130, 246, 0.0)", bottomColor: "rgba(59, 130, 246, 0.4)", lineVisible: false, crosshairMarkerVisible: false, base: 20 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#fbbf24", lineWidth: 2 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#f8fafc", lineWidth: 1.5, lineStyle: 2 }));
        } else {
          const seriesType = config.type === "histogram" ? HistogramSeries : LineSeries;
          activeSeries.push(chart.addSeries(seriesType, { color: config.color || "#60a5fa", lineWidth: 2 }));
        }

        chart.subscribeCrosshairMove((param) => {
           chartsRef.current.forEach((c) => { if (c !== chart) { if (!param.time || (param.point && param.point.x < 0)) { c.setCrosshairPosition(undefined, undefined, undefined as any); } else { c.setCrosshairPosition(undefined, param.time, undefined as any); } } });
           if (!param.time || !param.point || param.point.x < 0) { setHoveredData(null); } else {
              const currentPoint = chartDataRef.current?.data.find((p: any) => p.time === param.time);
              if (currentPoint) { 
                setHoveredData({ 
                  time: currentPoint.time, 
                  ohlc: { open: currentPoint.open, high: currentPoint.high, low: currentPoint.low, close: currentPoint.close, volume: currentPoint.volume || 0 }, 
                  indicators: currentPoint.indicators || {} 
                }); 
              }
           }
        });

        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncingRef.current || !range) return;
          isSyncingRef.current = true;
          chartsRef.current.forEach(c => { if (c !== chart) c.timeScale().setVisibleLogicalRange(range); });
          setTimeout(() => { isSyncingRef.current = false; }, 10);
        });

        chartsRef.current.set(config.id, chart);
        seriesRef.current.set(config.id, activeSeries);
      });
      setStatus("Ready");
    } catch (e: any) { setStatus("Error"); }
    return cleanup;
  }, [configs, symbol]);

  useEffect(() => {
    if (!chartData || !chartData.data || chartData.data.length === 0) return;
    if (seriesRef.current.size === 0) return;
    const sortedData = [...chartData.data].sort((a, b) => (a.time > b.time ? 1 : -1));

    configs.forEach((config) => {
      const activeSeries = seriesRef.current.get(config.id);
      if (!activeSeries || activeSeries.length === 0) return;
      if (config.id === "main") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, open: p.open ?? 0, high: p.high ?? 0, low: p.low ?? 0, close: p.close ?? 0 })));
        activeSeries[1].setData(sortedData.map((p, idx) => {
          const prevClose = idx > 0 ? sortedData[idx - 1].close : p.open;
          const isUp = p.close >= prevClose;
          // 투명도 30%로 하향 조정
          return { 
            time: p.time, 
            value: p.volume || 0, 
            color: isUp ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)" 
          };
        }));
        activeSeries[2].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.price_sma50 || p.close || 0 })));
        activeSeries[3].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.price_sma200 || p.close || 0 })));
      } else if (config.id === "sma_group") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.sma10 || 0 })));
        activeSeries[1].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.sma20 || 0 })));
        activeSeries[2].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.sma50 || 0 })));
      } else if (config.id === "macd") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.macd || 0 })));
        if (activeSeries[1]) activeSeries[1].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.macd_signal || 0 })));
      } else if (config.id === "stochastic") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, value: Math.max(80, p.indicators?.stoch_k || 50) })));
        activeSeries[1].setData(sortedData.map(p => ({ time: p.time, value: Math.min(20, p.indicators?.stoch_k || 50) })));
        activeSeries[2].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.stoch_k || 50 })));
        activeSeries[3].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.stoch_d || 50 })));
      } else {
        activeSeries[0].setData(sortedData.map(p => {
          const indicators = p.indicators || {};
          const targetKey = Object.keys(indicators).find(k => k.toLowerCase() === config.id.toLowerCase());
          return { time: p.time, value: targetKey ? indicators[targetKey] : (p.close || 0) };
        }));
      }
    });
    setTimeout(() => { scrollToLatest(); }, 500);
  }, [chartData, configs]);

  useEffect(() => {
    const handleResize = () => { if (!containerRef.current) return; chartsRef.current.forEach((chart, id) => { const el = containerRef.current?.querySelector(`[data-chart-id="${id}"]`); if (el) chart.applyOptions({ width: el.clientWidth }); }); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const renderTooltip = (config: IndicatorConfig) => {
    if (!hoveredData) return null;
    return (
      <div className="absolute top-1 left-16 z-30 pointer-events-none text-[9px] font-mono bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/5 flex gap-2 shadow-lg animate-in fade-in duration-200">
        {config.id === "main" ? (
          <>
            <span className={hoveredData.ohlc && hoveredData.ohlc.close >= hoveredData.ohlc.open ? "text-red-400" : "text-blue-400"}>C: {hoveredData.ohlc?.close}</span>
            <span className="text-slate-100 font-bold ml-1">V: {(hoveredData.ohlc?.volume || 0).toLocaleString()}</span>
          </>
        ) : config.id === "sma_group" ? (
          <><span className="text-red-500 font-bold">10:{hoveredData.indicators["sma10"]?.toFixed(1)}</span><span className="text-green-500 font-bold">20:{hoveredData.indicators["sma20"]?.toFixed(1)}</span><span className="text-blue-500 font-bold">50:{hoveredData.indicators["sma50"]?.toFixed(1)}</span></>
        ) : config.id === "macd" ? (
          <><span className="text-blue-400">M:{hoveredData.indicators["macd"]?.toFixed(1)}</span><span className="text-orange-400">S:{hoveredData.indicators["macd_signal"]?.toFixed(1)}</span></>
        ) : config.id === "stochastic" ? (
           <><span className="text-amber-400">K:{hoveredData.indicators["stoch_k"]?.toFixed(1)}</span><span className="text-slate-100">D:{hoveredData.indicators["stoch_d"]?.toFixed(1)}</span></>
        ) : (
          <span className="text-blue-300">{config.name}:{hoveredData.indicators[config.id]?.toFixed(1)}</span>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative flex flex-col w-full h-screen bg-slate-900 overflow-hidden border-t border-slate-800">
      <style jsx global>{`
        .indicator-scroll-area::-webkit-scrollbar { width: 12px; display: block !important; } 
        .indicator-scroll-area::-webkit-scrollbar-track { background: #1e293b; } 
        .indicator-scroll-area::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; border: 2px solid #1e293b; } 
        .indicator-scroll-area::-webkit-scrollbar-thumb:hover { background: #64748b; }
        .indicator-scroll-area { -webkit-overflow-scrolling: touch; scroll-behavior: smooth; }
      `}</style>
      <div className="px-3 py-1 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between gap-4 shrink-0 h-9">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${status === "Ready" ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]" : "bg-blue-500 animate-pulse"}`}></div>
          <h3 className="font-bold text-slate-200 text-xs uppercase tracking-tighter truncate">{chartData?.symbol || symbol}</h3>
          <button onClick={scrollToLatest} className="text-[8px] bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white px-1.5 py-0.5 rounded border border-slate-600 transition-all font-bold tracking-tighter uppercase">Sync</button>
        </div>
        {hoveredData && (
          <div className="flex items-center gap-3 text-[9px] font-mono">
            <span className="text-slate-400">{hoveredData.time}</span>
            <div className="flex gap-2">
              <span className="text-slate-400">O:<span className="text-slate-100">{hoveredData.ohlc?.open.toLocaleString()}</span></span>
              <span className="text-red-400">H:<span>{hoveredData.ohlc?.high.toLocaleString()}</span></span>
              <span className="text-blue-400">L:<span>{hoveredData.ohlc?.low.toLocaleString()}</span></span>
              <span className="text-slate-100">C:<span>{hoveredData.ohlc?.close.toLocaleString()}</span></span>
            </div>
          </div>
        )}
      </div>

      <div data-scroll-area className="flex-1 overflow-y-scroll indicator-scroll-area bg-slate-950">
        {mainConfig && (
          <div className="relative shrink-0 bg-slate-950 border-b-2 border-slate-800 shadow-xl z-20 pr-[0px] sticky top-0">
            {renderTooltip(mainConfig)}
            <div data-chart-id="main" className="w-full" style={{ height: '400px' }}>
              <div className="absolute top-1 left-2 z-20 pointer-events-none"><span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{mainConfig.name}</span></div>
            </div>
          </div>
        )}
        <div className="flex flex-col">
          {indicatorConfigs.map((config) => (
            <div key={config.id} className="relative border-b border-slate-900/50 last:border-0 group shrink-0">
              {renderTooltip(config)}
              <div data-chart-id={config.id} className="w-full" style={{ height: '100px' }}>
                <div className="absolute top-1 left-2 z-20 pointer-events-none"><span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{config.name}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InteractiveChart;
