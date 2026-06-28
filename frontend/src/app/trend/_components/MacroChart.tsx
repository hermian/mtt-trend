"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineSeries,
  AreaSeries,
  IChartApi,
  ISeriesApi,
  SeriesType,
} from "lightweight-charts";
import { useMacroData } from "@/hooks/useMacroData";

interface MacroChartProps {
  height?: number;
}

interface HoveredData {
  time: string;
  sp500?: number;
  high_yield?: number;
  cnn_fgi?: number;
}

export const MacroChart: React.FC<MacroChartProps> = ({ height = 700 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<SeriesType>[]>>(new Map());
  const chartDataRef = useRef<any>(null);
  const isSyncingRef = useRef<boolean>(false);
  const [status, setStatus] = useState<string>("Initializing...");
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  const { data: chartData, isLoading, error } = useMacroData();

  const formattedData = useMemo(() => {
    if (!chartData || !chartData.data) return [];
    return [...chartData.data]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map(p => ({
        ...p,
        time: p.date, // YYYY-MM-DD string is natively supported as time in lightweight-charts
      }));
  }, [chartData]);

  useEffect(() => {
    if (formattedData.length > 0) chartDataRef.current = formattedData;
  }, [formattedData]);

  const scrollToLatest = () => {
    if (chartDataRef.current && chartsRef.current.size > 0) {
      const data = chartDataRef.current;
      const lastIndex = data.length - 1;
      if (lastIndex >= 0) {
        let startIndex = 0;
        if (isMobile && data.length > 120) {
          startIndex = data.length - 120; // 최근 약 6개월치 데이터 표시
        } else if (data.length > 250) {
          startIndex = data.length - 250; // 최근 약 1년치 데이터 표시
        }

        const range = { from: data[startIndex].time as any, to: data[lastIndex].time as any };
        isSyncingRef.current = true;
        chartsRef.current.forEach(c => {
          c.timeScale().setVisibleRange(range);
        });
        setTimeout(() => { isSyncingRef.current = false; }, 200);
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    setStatus("Building Charts...");
    const cleanup = () => {
      chartsRef.current.forEach(c => c.remove());
      chartsRef.current.clear();
      seriesRef.current.clear();
    };
    cleanup();

    try {
      const scrollArea = containerRef.current.querySelector("[data-scroll-area]") as HTMLElement;
      if (!scrollArea) return;

      const panels = [
        { id: "sp500_fgi", name: "S&P 500 (Right) & CNN Fear & Greed Index (Left)", height: isMobile ? 220 : 350 },
        { id: "high_yield", name: "ICE BofA US High Yield Spread (%)", height: isMobile ? 130 : 220 }
      ];

      panels.forEach((panel, index) => {
        const el = scrollArea.querySelector(`[data-chart-id="${panel.id}"]`) as HTMLElement;
        if (!el) return;
        const width = el.clientWidth;

        const chart = createChart(el, {
          width,
          height: panel.height,
          layout: {
            background: { type: ColorType.Solid, color: "#0f172a" },
            textColor: "#cbd5e1",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          },
          grid: {
            vertLines: { color: "#1e293b" },
            horzLines: { color: "#1e293b" },
          },
          timeScale: {
            visible: index === panels.length - 1,
            borderColor: "#334155",
            rightOffset: 20,
            barSpacing: 6,
          },
          rightPriceScale: {
            borderColor: "#334155",
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true,
            visible: true,
          },
          leftPriceScale: {
            borderColor: "#334155",
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true,
            visible: panel.id === "sp500_fgi", // Only show left scale on top panel for CNN FGI
          },
          handleScale: isMobile ? {
            pinch: true,
            mouseWheel: false,
            axisPressedMouseMove: false,
          } : {
            axisPressedMouseMove: true,
            pinch: true,
            mouseWheel: true,
          },
          handleScroll: isMobile ? {
            horzTouchDrag: true,
            vertTouchDrag: false,
          } : true,
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              labelVisible: index === panels.length - 1,
              color: "#64748b",
              width: 1,
              style: 1,
            },
            horzLine: {
              color: "#64748b",
              width: 1,
              style: 1,
            },
          },
        });

        const activeSeries: ISeriesApi<SeriesType>[] = [];
        if (panel.id === "sp500_fgi") {
          // SP500 on right scale
          activeSeries.push(chart.addSeries(AreaSeries, {
            lineColor: "#38bdf8",
            topColor: "rgba(56, 189, 248, 0.4)",
            bottomColor: "rgba(56, 189, 248, 0.0)",
            lineWidth: 2,
            priceScaleId: "right",
            title: "S&P 500",
          }));
          // CNN FGI on left scale
          activeSeries.push(chart.addSeries(LineSeries, {
            color: "#eab308", // Yellow/Gold
            lineWidth: 2,
            priceScaleId: "left",
            title: "CNN FGI",
          }));
        } else if (panel.id === "high_yield") {
          // High Yield spread on right scale
          activeSeries.push(chart.addSeries(LineSeries, {
            color: "#f43f5e", // Rose/Red-orange
            lineWidth: 2,
            priceScaleId: "right",
            title: "High Yield Spread",
          }));
        }

        // Crosshair synchronization
        chart.subscribeCrosshairMove((param) => {
          chartsRef.current.forEach((c) => {
            if (c !== chart) {
              if (!param.time || (param.point && param.point.x < 0)) {
                c.setCrosshairPosition(null as any, null as any, null as any);
              } else {
                c.setCrosshairPosition(null as any, param.time as any, null as any);
              }
            }
          });

          if (!param.time || !param.point || param.point.x < 0) {
            setHoveredData(null);
          } else {
            const currentPoint = chartDataRef.current?.find((p: any) => p.time === param.time);
            if (currentPoint) {
              setHoveredData({
                time: currentPoint.date,
                sp500: currentPoint.sp500 ?? undefined,
                high_yield: currentPoint.high_yield ?? undefined,
                cnn_fgi: currentPoint.cnn_fgi ?? undefined,
              });
            }
          }
        });

        // Visible range synchronization
        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncingRef.current || !range) return;
          isSyncingRef.current = true;
          chartsRef.current.forEach(c => {
            if (c !== chart) c.timeScale().setVisibleLogicalRange(range);
          });
          setTimeout(() => { isSyncingRef.current = false; }, 10);
        });

        chartsRef.current.set(panel.id, chart);
        seriesRef.current.set(panel.id, activeSeries);
      });
      setStatus("Ready");
    } catch (e: any) {
      console.error(e);
      setStatus("Error");
    }

    return cleanup;
  }, [isMobile]);

  // Push data into charts
  useEffect(() => {
    if (formattedData.length === 0) return;
    if (seriesRef.current.size === 0) return;

    // S&P 500 & CNN FGI top panel
    const sp500FgiSeries = seriesRef.current.get("sp500_fgi");
    if (sp500FgiSeries && sp500FgiSeries.length >= 2) {
      // S&P 500 Area series - filters out null values to prevent line breaks, or sets them
      const sp500Data = formattedData
        .filter(p => p.sp500 !== null && p.sp500 !== undefined)
        .map(p => ({
          time: p.time as any,
          value: p.sp500 as number,
        }));
      sp500FgiSeries[0].setData(sp500Data);

      const fgiData = formattedData
        .filter(p => p.cnn_fgi !== null && p.cnn_fgi !== undefined)
        .map(p => ({
          time: p.time as any,
          value: p.cnn_fgi as number,
        }));
      sp500FgiSeries[1].setData(fgiData);
    }

    // High Yield Spread bottom panel
    const highYieldSeries = seriesRef.current.get("high_yield");
    if (highYieldSeries && highYieldSeries[0]) {
      const hyData = formattedData
        .filter(p => p.high_yield !== null && p.high_yield !== undefined)
        .map(p => ({
          time: p.time as any,
          value: p.high_yield as number,
        }));
      highYieldSeries[0].setData(hyData);
    }

    setTimeout(() => { scrollToLatest(); }, 500);
  }, [formattedData]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      chartsRef.current.forEach((chart, id) => {
        const el = containerRef.current?.querySelector(`[data-chart-id="${id}"]`);
        if (el) chart.applyOptions({ width: el.clientWidth });
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div ref={containerRef} className={`relative flex flex-col w-full ${isMobile ? "h-[450px]" : "h-[690px]"} bg-slate-900 overflow-hidden border border-slate-800 rounded-xl shadow-2xl`}>
      {/* Control bar */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between gap-4 shrink-0 h-11">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? "bg-blue-500 animate-pulse" : error ? "bg-red-500" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"}`}></div>
          <h3 className="font-bold text-slate-200 text-sm uppercase tracking-tighter truncate">
            Macro & Sentiment Analytics
          </h3>
          <button
            onClick={scrollToLatest}
            className="text-[9px] bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-600 transition-all font-bold tracking-tighter uppercase"
          >
            Sync
          </button>
        </div>

        {/* Hover legend */}
        {hoveredData && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-slate-300">
            <span className="text-slate-400">{hoveredData.time}</span>
            {hoveredData.sp500 !== undefined && (
              <span className="text-[#38bdf8] font-bold">
                S&P 500: <span className="text-slate-100">{hoveredData.sp500.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </span>
            )}
            {hoveredData.cnn_fgi !== undefined && (
              <span className="text-[#eab308] font-bold">
                CNN FGI: <span className="text-slate-100">{hoveredData.cnn_fgi.toFixed(1)}</span>
              </span>
            )}
            {hoveredData.high_yield !== undefined && (
              <span className="text-[#f43f5e] font-bold">
                High Yield Spread: <span className="text-slate-100">{hoveredData.high_yield.toFixed(2)}%</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main charts area */}
      <div data-scroll-area className="flex-1 overflow-y-auto indicator-scroll-area bg-slate-950 flex flex-col p-4 gap-4 relative">
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-slate-950/70 flex items-center justify-center text-slate-400 font-medium animate-pulse">
            차트 데이터를 불러오는 중입니다...
          </div>
        )}
        
        {error && !isLoading && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 flex items-center justify-center text-red-400 font-medium">
            데이터를 불러오는 데 실패했습니다.
          </div>
        )}

        {/* S&P 500 & CNN FGI Panel */}
        <div className="relative bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-inner">
          <div className="absolute top-2.5 left-3.5 z-20 pointer-events-none">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              S&P 500 (Right Price Scale) & CNN Fear & Greed Index (Left Price Scale)
            </span>
          </div>
          <div data-chart-id="sp500_fgi" className="w-full relative" style={{ height: isMobile ? "220px" : "350px" }}></div>
        </div>

        {/* High Yield Spread Panel */}
        <div className="relative bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-inner">
          <div className="absolute top-2.5 left-3.5 z-20 pointer-events-none">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              ICE BofA US High Yield Index Option-Adjusted Spread (%)
            </span>
          </div>
          <div data-chart-id="high_yield" className="w-full relative" style={{ height: isMobile ? "130px" : "220px" }}></div>
        </div>
      </div>
    </div>
  );
};
