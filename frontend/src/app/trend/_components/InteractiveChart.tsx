"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  BaselineSeries,
  IChartApi,
  ISeriesApi,
  SeriesType,
} from "lightweight-charts";
import { useChartData } from "@/hooks/useChartData";
import { toChartTime } from "./_lib/chartTime";

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
  const verticalGuideRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<SeriesType>[]>>(new Map());
  const chartDataRef = useRef<any>(null);
  const isSyncingRef = useRef<boolean>(false);
  const [status, setStatus] = useState<string>("Initializing...");
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);


  const indicatorNames = useMemo(() => {
    const names = configs.filter(c => !["main", "above_sma_group", "adr_group", "disparity_sma50"].includes(c.id)).map(c => c.id);
    if (configs.some(c => c.id === "macd")) names.push("macd_signal");
    if (configs.some(c => c.id === "stochastic")) names.push("stoch_k", "stoch_d");
    if (configs.some(c => c.id === "above_sma_group")) names.push("above_sma10", "above_sma20", "above_sma50");
    if (configs.some(c => c.id === "adr_group")) names.push("adr14", "adr20");
    if (configs.some(c => c.id === "disparity_sma50")) names.push("disparity_sma50");
    if (configs.some(c => c.id === "vix_fix")) names.push("vix_fix_fear");
    names.push("price_sma50", "price_sma200");
    return names.join(",");
  }, [configs]);
  
  const { data: chartData, isLoading, error } = useChartData(symbol, indicatorNames);

  useEffect(() => { if (chartData) chartDataRef.current = chartData; }, [chartData]);

  const scrollToLatest = () => {
    if (chartDataRef.current?.data && chartsRef.current.size > 0) {
      const data = chartDataRef.current.data;
      const lastIndex = data.length - 1;
      if (lastIndex >= 0) {
        const startIndex = Math.max(0, lastIndex - 150);
        const from = toChartTime(data[startIndex].time) ?? data[startIndex].time;
        const to = toChartTime(data[lastIndex].time) ?? data[lastIndex].time;
        const range = { from: from as any, to: to as any };
        isSyncingRef.current = true;
        chartsRef.current.forEach(c => {
          try {
            c.timeScale().setVisibleRange(range);
            c.timeScale().scrollToPosition(8, false);
          } catch { /* invalid range */ }
        });
        setTimeout(() => { isSyncingRef.current = false; }, 200);
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    setStatus("Building High-End Charts...");
    const scrollArea = containerRef.current.querySelector("[data-scroll-area]") as HTMLElement;
    if (!scrollArea) return;

    let onCustomWheel: ((e: WheelEvent) => void) | null = null;

    const cleanup = () => {
      if (onCustomWheel && scrollArea) {
        scrollArea.removeEventListener("wheel", onCustomWheel);
      }
      chartsRef.current.forEach(c => c.remove());
      chartsRef.current.clear();
      seriesRef.current.clear();
    };
    cleanup();

    try {
      // @MX:NOTE: 모바일 기기 여부 감지
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      onCustomWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey || e.altKey) {
          e.preventDefault();
          const firstChart = chartsRef.current.values().next().value;
          if (!firstChart) return;
          const currentRange = firstChart.timeScale().getVisibleLogicalRange();
          if (!currentRange) return;

          const delta = e.deltaY;
          const zoomFactor = delta > 0 ? 1.15 : 0.85;
          const length = currentRange.to - currentRange.from;
          const newLength = Math.max(15, Math.min(10000, length * zoomFactor));
          const diff = newLength - length;

          const rect = scrollArea.getBoundingClientRect();
          const cursorRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const newFrom = currentRange.from - diff * cursorRatio;
          const newTo = currentRange.to + diff * (1 - cursorRatio);

          isSyncingRef.current = true;
          chartsRef.current.forEach((c) => {
            try {
              c.timeScale().setVisibleLogicalRange({ from: newFrom, to: newTo });
            } catch {}
          });
          isSyncingRef.current = false;
        } else if (e.shiftKey) {
          e.preventDefault();
          const firstChart = chartsRef.current.values().next().value;
          if (!firstChart) return;
          const currentRange = firstChart.timeScale().getVisibleLogicalRange();
          if (!currentRange) return;

          const length = currentRange.to - currentRange.from;
          const shiftAmount = (e.deltaY || e.deltaX) * (length / 600);
          const newFrom = currentRange.from + shiftAmount;
          const newTo = currentRange.to + shiftAmount;

          isSyncingRef.current = true;
          chartsRef.current.forEach((c) => {
            try {
              c.timeScale().setVisibleLogicalRange({ from: newFrom, to: newTo });
            } catch {}
          });
          isSyncingRef.current = false;
        }
      };

      scrollArea.addEventListener("wheel", onCustomWheel, { passive: false });

      configs.forEach((config, index) => {
        const el = scrollArea.querySelector(`[data-chart-id="${config.id}"]`) as HTMLElement;
        if (!el) return;
        const chartHeight = config.id === "main" ? 400 : 100;
        el.style.height = `${chartHeight}px`;
        const chart = createChart(el, {
          autoSize: true,
          height: chartHeight,
          layout: { background: { type: ColorType.Solid, color: "#0f172a" }, textColor: "#94a3b8" },
          grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
          timeScale: { visible: index === configs.length - 1, borderColor: "#334155", rightOffset: 20, barSpacing: 10 },
          rightPriceScale: { 
            borderColor: "#334155", 
            scaleMargins: { top: 0.1, bottom: 0.1 }, 
            autoScale: true, // @MX:NOTE: 항상 오토 스케일링 유지
            minimumWidth: 100,
          },
          // @MX:NOTE: 확대/축소(Scale) 조작 제어
          handleScale: isMobile ? false : {
            axisPressedMouseMove: config.id === "main",
            pinch: config.id === "main",
            mouseWheel: false,
          },
          // @MX:NOTE: 스크롤(Scroll) 조작 제어
          handleScroll: isMobile ? {
            horzTouchDrag: config.id === "main", // 좌우 이동만 허용
            vertTouchDrag: false,               // @MX:NOTE: Y축 방향 드래그 차단 (오토 스케일 유지 핵심)
          } : {
            mouseWheel: false,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
          crosshair: { mode: CrosshairMode.Normal, vertLine: { visible: false }, horzLine: { color: "#64748b", width: 1, style: 1 } },
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
          activeSeries.push(chart.addSeries(LineSeries, { color: "#10b981", lineWidth: 2, crosshairMarkerVisible: false }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#f43f5e", lineWidth: 2, crosshairMarkerVisible: false }));
        } else if (config.id === "above_sma_group") {
          activeSeries.push(chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 2 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2 }));
        } else if (config.id === "adr_group") {
          activeSeries.push(chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 2 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#f472b6", lineWidth: 2 }));
        } else if (config.id === "disparity_sma50") {
          const s = chart.addSeries(BaselineSeries, {
            baseValue: { type: "price", price: 100 },
            topLineColor: "#eab308",
            bottomLineColor: "#eab308",
            topFillColor1: "rgba(234, 179, 8, 0.45)",
            topFillColor2: "rgba(234, 179, 8, 0.05)",
            bottomFillColor1: "rgba(234, 179, 8, 0.05)",
            bottomFillColor2: "rgba(234, 179, 8, 0.45)",
            lineWidth: 2,
          });
          try {
            s.createPriceLine({
              price: 100,
              color: "#ffffff",
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
            });
          } catch {}
          activeSeries.push(s);
        } else if (config.id === "macd") {
          activeSeries.push(chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 2, lineStyle: 2 }));
        } else if (config.id === "vix_fix") {
          // Fear 히스토그램을 먼저 추가해 라인이 위에 그려지도록 함
          activeSeries.push(chart.addSeries(HistogramSeries, { color: "rgba(249, 115, 22, 0.65)" }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 1 }));
        } else if (config.id === "stochastic") {
          activeSeries.push(chart.addSeries(AreaSeries, { topColor: "rgba(239, 68, 68, 0.4)", bottomColor: "rgba(239, 68, 68, 0.0)", lineVisible: false, crosshairMarkerVisible: false }));
          activeSeries.push(chart.addSeries(AreaSeries, { topColor: "rgba(59, 130, 246, 0.0)", bottomColor: "rgba(59, 130, 246, 0.4)", lineVisible: false, crosshairMarkerVisible: false }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#fbbf24", lineWidth: 2 }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#f8fafc", lineWidth: 2, lineStyle: 2 }));
        } else if (config.id === "rsi" || config.id === "rsi_14") {
          const s = chart.addSeries(LineSeries, { color: config.color || "#fbbf24", lineWidth: 2 });
          try {
            s.createPriceLine({ price: 70, color: "#ffffff", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true });
            s.createPriceLine({ price: 30, color: "#ffffff", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true });
          } catch {}
          activeSeries.push(s);
        } else {
          const seriesType = config.type === "histogram" ? HistogramSeries : LineSeries;
          activeSeries.push(chart.addSeries(seriesType, { color: config.color || "#60a5fa", lineWidth: 2 }));
        }

        chart.subscribeCrosshairMove((param) => {
          if (verticalGuideRef.current) {
            if (!param.time || !param.point || param.point.x < 0) {
              verticalGuideRef.current.style.display = "none";
            } else {
              verticalGuideRef.current.style.display = "block";
              verticalGuideRef.current.style.transform = `translateX(${param.point.x}px)`;
            }
          }

          if (!param.time || !param.point || param.point.x < 0) {
            setHoveredData(null);
          } else {
            const currentPoint = chartDataRef.current?.data?.find((p: any) => p.time === param.time);
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
    const sortedData = [...chartData.data]
      .map((p) => ({ ...p, time: toChartTime(p.time) ?? String(p.time).slice(0, 10) }))
      .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.time))
      .sort((a, b) => (a.time > b.time ? 1 : -1));

    configs.forEach((config) => {
      const activeSeries = seriesRef.current.get(config.id);
      if (!activeSeries || activeSeries.length === 0) return;
      if (config.id === "main") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, open: p.open ?? 0, high: p.high ?? 0, low: p.low ?? 0, close: p.close ?? 0 })));
        activeSeries[1].setData(sortedData.map((p, idx) => {
          const prevClose = idx > 0 ? (sortedData[idx - 1].close ?? p.open ?? 0) : (p.open ?? 0);
          const isUp = (p.close ?? 0) >= prevClose;
          // 투명도 30%로 하향 조정
          return { 
            time: p.time, 
            value: p.volume || 0, 
            color: isUp ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)" 
          };
        }));
        activeSeries[2].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.price_sma50 || p.close || 0 })));
        activeSeries[3].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.price_sma200 || p.close || 0 })));
      } else if (config.id === "above_sma_group") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.above_sma10 || 0 })));
        activeSeries[1].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.above_sma20 || 0 })));
        activeSeries[2].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.above_sma50 || 0 })));
      } else if (config.id === "adr_group") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.adr14 || 0 })));
        activeSeries[1].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.adr20 || 0 })));
      } else if (config.id === "disparity_sma50") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.disparity_sma50 ?? 100 })));
      } else if (config.id === "macd") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.macd || 0 })));
        if (activeSeries[1]) activeSeries[1].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.macd_signal || 0 })));
      } else if (config.id === "vix_fix") {
        activeSeries[0].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.vix_fix_fear || 0 })));
        activeSeries[1].setData(sortedData.map(p => ({ time: p.time, value: p.indicators?.vix_fix || 0 })));
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
  }, [chartData, configs, status]);

  const renderTooltip = (config: IndicatorConfig) => {
    if (!hoveredData) return null;
    return (
      <div className="absolute top-1 left-16 z-30 pointer-events-none text-[9px] font-mono bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/5 flex gap-2 shadow-lg animate-in fade-in duration-200">
        {config.id === "main" ? (
          <>
            <span className={hoveredData.ohlc && hoveredData.ohlc.close >= hoveredData.ohlc.open ? "text-red-400" : "text-blue-400"}>C: {hoveredData.ohlc?.close}</span>
            <span className="text-slate-100 font-bold ml-1">V: {(hoveredData.ohlc?.volume || 0).toLocaleString()}</span>
          </>
        ) : config.id === "above_sma_group" ? (
          <><span className="text-red-500 font-bold">10:{hoveredData.indicators["above_sma10"]?.toFixed(1)}</span><span className="text-green-500 font-bold">20:{hoveredData.indicators["above_sma20"]?.toFixed(1)}</span><span className="text-blue-500 font-bold">50:{hoveredData.indicators["above_sma50"]?.toFixed(1)}</span></>
        ) : config.id === "adr_group" ? (
          <><span className="text-[#a78bfa] font-bold">14:{hoveredData.indicators["adr14"]?.toFixed(1)}</span><span className="text-[#f472b6] font-bold">20:{hoveredData.indicators["adr20"]?.toFixed(1)}</span></>
        ) : config.id === "disparity_sma50" ? (
          <span className="text-[#eab308] font-bold">이격:{hoveredData.indicators["disparity_sma50"]?.toFixed(1)}</span>
        ) : config.id === "macd" ? (
          <><span className="text-blue-400">M:{hoveredData.indicators["macd"]?.toFixed(1)}</span><span className="text-orange-400">S:{hoveredData.indicators["macd_signal"]?.toFixed(1)}</span></>
        ) : config.id === "stochastic" ? (
           <><span className="text-amber-400">K:{hoveredData.indicators["stoch_k"]?.toFixed(1)}</span><span className="text-slate-100">D:{hoveredData.indicators["stoch_d"]?.toFixed(1)}</span></>
        ) : config.id === "vix_fix" ? (
           <><span className="text-red-400">VF:{hoveredData.indicators["vix_fix"]?.toFixed(1)}</span>{(hoveredData.indicators["vix_fix_fear"] ?? 0) > 0 && <span className="text-orange-400 font-bold">FEAR:{hoveredData.indicators["vix_fix_fear"]?.toFixed(1)}</span>}</>
        ) : (
          <span className="text-blue-300">{config.name}:{hoveredData.indicators[config.id]?.toFixed(1)}</span>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative flex flex-col w-full h-[calc(100vh-3.5rem)] md:h-full min-h-0 bg-slate-950 overflow-hidden border-t border-slate-800">
      <div className="px-3 py-1 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4 shrink-0 h-9">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${status === "Ready" ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]" : "bg-blue-500 animate-pulse"}`}></div>
          <h3 className="font-bold text-slate-200 text-xs uppercase tracking-tighter truncate">{chartData?.symbol || symbol}</h3>
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline-block border border-slate-700/60 rounded px-1.5 py-0.5 bg-slate-800/40">
            휠: 패널 세로 이동 | Ctrl+휠: 줌 | Shift+휠: 가로 이동
          </span>
          <button onClick={scrollToLatest} className="text-[8px] bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white px-1.5 py-0.5 rounded border border-slate-700 transition-all font-bold tracking-tighter uppercase">Sync Latest</button>
        </div>
        {hoveredData && (
          <div className="flex items-center gap-3 text-[9px] font-mono">
            <span className="text-slate-400">{hoveredData.time}</span>
            <div className="flex gap-2 border-r border-slate-700 pr-3">
              <span className="text-slate-400">O:<span className="text-slate-100">{hoveredData.ohlc?.open.toLocaleString()}</span></span>
              <span className="text-red-400">H:<span>{hoveredData.ohlc?.high.toLocaleString()}</span></span>
              <span className="text-blue-400">L:<span>{hoveredData.ohlc?.low.toLocaleString()}</span></span>
              <span className="text-slate-100">C:<span>{hoveredData.ohlc?.close.toLocaleString()}</span></span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#10b981] font-bold">SMA50:<span className="text-slate-100 ml-0.5">{hoveredData.indicators["price_sma50"]?.toLocaleString(undefined, {maximumFractionDigits: 0})}</span></span>
              <span className="text-[#f43f5e] font-bold">SMA200:<span className="text-slate-100 ml-0.5">{hoveredData.indicators["price_sma200"]?.toLocaleString(undefined, {maximumFractionDigits: 0})}</span></span>
            </div>
          </div>
        )}
      </div>

      <div
        data-scroll-area
        onMouseLeave={() => {
          if (verticalGuideRef.current) verticalGuideRef.current.style.display = "none";
          setHoveredData(null);
        }}
        className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 relative pb-16"
      >
        {/* 심층지표 모든 패널을 관통하는 실시간 수직선(Crosshair 세로선) 가이드 */}
        <div
          ref={verticalGuideRef}
          className="pointer-events-none absolute top-0 bottom-0 z-30 border-l border-dashed border-slate-400/80 hidden transition-none"
          style={{ width: "1px", left: 0 }}
        />

        {(isLoading || (!chartData && status === "Initializing...")) && (
          <div className="absolute inset-0 z-30 bg-slate-950/70 flex items-center justify-center text-slate-400 font-medium animate-pulse">
            차트 데이터를 불러오는 중입니다...
          </div>
        )}
        
        {error && !isLoading && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 flex items-center justify-center text-red-400 font-medium">
            데이터를 불러오는 데 실패했습니다.
          </div>
        )}

        <div className="flex flex-col">
          {configs.map((config) => (
            <div key={config.id} className="relative border-b border-slate-900/50 last:border-0 group shrink-0">
              {renderTooltip(config)}
              <div data-chart-id={config.id} className="w-full" style={{ height: config.id === 'main' ? '400px' : '100px' }}>
                <div className="absolute top-1 left-2 z-20 pointer-events-none"><span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{config.name}</span></div>
              </div>
            </div>
          ))}
        </div>
        {/* 최하단 패널 잘림 방지 여백 스페이스 */}
        <div className="h-24 w-full bg-slate-950 shrink-0" />
      </div>
    </div>
  );
};

export default InteractiveChart;
