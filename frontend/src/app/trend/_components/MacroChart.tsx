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
  LineStyle,
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

/** 기간 프리셋: years=null 은 전기간 */
type MacroPeriod = { label: string; years: number | null };

const MACRO_PERIODS: MacroPeriod[] = [
  { label: "1Y", years: 1 },
  { label: "2Y", years: 2 },
  { label: "5Y", years: 5 },
  { label: "All", years: null },
];

const DEFAULT_PERIOD: MacroPeriod = MACRO_PERIODS[1]; // 2Y — 초기 뷰포트(~1Y) + 패닝 여유

function startDateFromYears(years: number | null): string | undefined {
  if (years == null) return undefined;
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
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
  const [period, setPeriod] = useState<MacroPeriod>(DEFAULT_PERIOD);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  const startDate = useMemo(() => startDateFromYears(period.years), [period]);
  const { data: chartData, isLoading, error, isFetching } = useMacroData(startDate);

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

      // 단일 통합 차트로 구성
      const panels = [
        { id: "sp500_fgi_hy", name: "S&P 500 & High Yield Spread & CNN FGI", height: isMobile ? 320 : 520 }
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
            visible: true,
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
            visible: true,
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
              labelVisible: true,
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
        if (panel.id === "sp500_fgi_hy") {
          // 1. S&P 500 on right scale
          activeSeries.push(chart.addSeries(AreaSeries, {
            lineColor: "#38bdf8",
            topColor: "rgba(56, 189, 248, 0.4)",
            bottomColor: "rgba(56, 189, 248, 0.0)",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: {
              type: "custom",
              formatter: (price: number) => `SPX ${price.toFixed(0)}`,
            },
          }));
          
          // 2. CNN FGI on left scale
          const fgiSeries = chart.addSeries(LineSeries, {
            color: "#eab308", // Yellow/Gold
            lineWidth: 2,
            priceScaleId: "left",
            priceFormat: {
              type: "custom",
              formatter: (price: number) => `FGI ${price.toFixed(0)}`,
            },
            autoscaleInfoProvider: () => ({
              priceRange: {
                minValue: 0,
                maxValue: 100,
              },
            }),
          });
          // Add 75 and 25 threshold horizontal lines for FGI
          fgiSeries.createPriceLine({
            price: 75,
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "75",
          });
          fgiSeries.createPriceLine({
            price: 25,
            color: "#3b82f6",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "25",
          });
          activeSeries.push(fgiSeries);

          // 3. High Yield Spread on custom overlay scale 'high_yield'
          activeSeries.push(chart.addSeries(LineSeries, {
            color: "#f43f5e", // Rose/Red-orange
            lineWidth: 2,
            priceScaleId: "high_yield",
            priceFormat: {
              type: "custom",
              formatter: (price: number) => `HY ${price.toFixed(2)}%`,
            },
          }));

          // Apply margins for 'high_yield' scale to look nice
          chart.priceScale("high_yield").applyOptions({
            autoScale: true,
            scaleMargins: {
              top: 0.15,
              bottom: 0.15,
            },
          });
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
            const latestPoint = chartDataRef.current?.[chartDataRef.current.length - 1];
            if (latestPoint) {
              setHoveredData({
                time: latestPoint.date,
                sp500: latestPoint.sp500 ?? undefined,
                high_yield: latestPoint.high_yield ?? undefined,
                cnn_fgi: latestPoint.cnn_fgi ?? undefined,
              });
            } else {
              setHoveredData(null);
            }
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

    // S&P 500, CNN FGI & High Yield unified panel
    const unifiedSeries = seriesRef.current.get("sp500_fgi_hy");
    if (unifiedSeries && unifiedSeries.length >= 3) {
      // 1. S&P 500 Area series
      const sp500Data = formattedData
        .filter(p => p.sp500 !== null && p.sp500 !== undefined)
        .map(p => ({
          time: p.time as any,
          value: p.sp500 as number,
        }));
      unifiedSeries[0].setData(sp500Data);

      // 2. CNN FGI Line series
      const fgiData = formattedData
        .filter(p => p.cnn_fgi !== null && p.cnn_fgi !== undefined)
        .map(p => ({
          time: p.time as any,
          value: p.cnn_fgi as number,
        }));
      unifiedSeries[1].setData(fgiData);

      // 3. High Yield Spread Line series
      const hyData = formattedData
        .filter(p => p.high_yield !== null && p.high_yield !== undefined)
        .map(p => ({
          time: p.time as any,
          value: p.high_yield as number,
        }));
      unifiedSeries[2].setData(hyData);
    }

    // Set default hoveredData to the latest point
    const latestPoint = formattedData[formattedData.length - 1];
    if (latestPoint) {
      setHoveredData({
        time: latestPoint.date,
        sp500: latestPoint.sp500 ?? undefined,
        high_yield: latestPoint.high_yield ?? undefined,
        cnn_fgi: latestPoint.cnn_fgi ?? undefined,
      });
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
    <div ref={containerRef} className={`relative flex flex-col w-full ${isMobile ? "h-[430px]" : "h-[650px]"} bg-slate-900 overflow-hidden border border-slate-800 rounded-xl shadow-2xl`}>
      {/* Control bar */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 shrink-0 min-h-11 md:h-11 md:py-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-2.5 h-2.5 rounded-full ${isLoading || isFetching ? "bg-blue-500 animate-pulse" : error ? "bg-red-500" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"}`}></div>
          <h3 className="font-bold text-slate-200 text-sm uppercase tracking-tighter truncate">
            Macro & Sentiment Analytics
          </h3>
          <div className="flex items-center gap-1" role="group" aria-label="Period">
            {MACRO_PERIODS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPeriod(p)}
                className={`text-[9px] px-2 py-0.5 rounded border font-bold tracking-tighter uppercase transition-all ${
                  period.label === p.label
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={scrollToLatest}
            className="text-[9px] bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-600 transition-all font-bold tracking-tighter uppercase"
          >
            Sync
          </button>
        </div>

        {/* Hover legend */}
        {hoveredData && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-slate-300">
            <span className="text-slate-400 mr-1">{hoveredData.time}</span>
            {hoveredData.sp500 !== undefined && (
              <span className="text-[#38bdf8] font-bold">
                SPX: <span className="text-slate-100">{hoveredData.sp500.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              </span>
            )}
            {hoveredData.cnn_fgi !== undefined && (
              <span className="text-[#eab308] font-bold">
                FGI: <span className="text-slate-100">{hoveredData.cnn_fgi.toFixed(0)}</span>
              </span>
            )}
            {hoveredData.high_yield !== undefined && (
              <span className="text-[#f43f5e] font-bold">
                HY: <span className="text-slate-100">{hoveredData.high_yield.toFixed(2)}%</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main charts area */}
      <div data-scroll-area className="flex-1 overflow-y-auto indicator-scroll-area bg-slate-950 flex flex-col p-4 gap-4 relative">
        {(isLoading || (isFetching && formattedData.length === 0)) && (
          <div className="absolute inset-0 z-30 bg-slate-950/70 flex items-center justify-center text-slate-400 font-medium animate-pulse">
            차트 데이터를 불러오는 중입니다...
          </div>
        )}
        
        {error && !isLoading && !isFetching && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 flex items-center justify-center text-red-400 font-medium">
            데이터를 불러오는 데 실패했습니다.
          </div>
        )}

        {/* S&P 500, High Yield Spread & CNN FGI Unified Panel */}
        <div className="relative bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-inner pb-1.5">
          <div className="absolute top-2.5 left-3.5 z-20 pointer-events-none">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              S&P 500 (Right Price Scale) & CNN Fear & Greed Index (Left Price Scale) & ICE BofA High Yield Spread (Overlay Scale)
            </span>
          </div>
          <div data-chart-id="sp500_fgi_hy" className="w-full relative" style={{ height: isMobile ? "320px" : "550px" }}></div>
        </div>
      </div>
    </div>
  );
};
