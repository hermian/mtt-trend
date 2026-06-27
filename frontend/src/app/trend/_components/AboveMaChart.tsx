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
import { useAboveMaData } from "@/hooks/useAboveMaData";

interface AboveMaChartProps {
  market: string;
  height?: number;
}

interface HoveredData {
  time: string;
  close: number;
  above_sma10: number;
  above_sma20: number;
  above_sma50: number;
}

export const AboveMaChart: React.FC<AboveMaChartProps> = ({ market, height = 700 }) => {
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

  const { data: chartData, isLoading, error } = useAboveMaData(market);

  const formattedData = useMemo(() => {
    if (!chartData || !chartData.data) return [];
    return [...chartData.data]
      .sort((a, b) => (a.time > b.time ? 1 : -1))
      .map(p => ({
        ...p,
        time: Math.floor(new Date(p.time.replace(" ", "T")).getTime() / 1000),
        originalTime: p.time
      }));
  }, [chartData]);

  useEffect(() => {
    if (formattedData.length > 0) chartDataRef.current = formattedData;
  }, [formattedData]);

  const [verticalLineXs, setVerticalLineXs] = useState<number[]>([]);

  const dayBoundaries = useMemo(() => {
    if (formattedData.length === 0) return [];
    const boundaries: number[] = [];
    let lastDate = "";
    formattedData.forEach(p => {
      const dateStr = p.originalTime.split(" ")[0];
      if (dateStr !== lastDate) {
        boundaries.push(p.time);
        lastDate = dateStr;
      }
    });
    return boundaries;
  }, [formattedData]);

  const dayBoundariesRef = useRef<number[]>([]);
  useEffect(() => {
    dayBoundariesRef.current = dayBoundaries;
  }, [dayBoundaries]);

  const updateLinePositions = () => {
    const closeChart = chartsRef.current.get("close");
    if (!closeChart) return;
    
    const xs: number[] = [];
    dayBoundariesRef.current.forEach(time => {
      const x = closeChart.timeScale().timeToCoordinate(time as any);
      if (x !== null && x >= 0) {
        xs.push(x);
      }
    });
    setVerticalLineXs(xs);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      updateLinePositions();
    }, 600);
    return () => clearTimeout(timer);
  }, [dayBoundaries]);

  const scrollToLatest = () => {
    if (chartDataRef.current && chartsRef.current.size > 0) {
      const data = chartDataRef.current;
      const lastIndex = data.length - 1;
      if (lastIndex >= 0) {
        let startIndex = 0;

        if (isMobile) {
          // 실거래일 기준 최근 5일치 시작 지점 찾기
          const uniqueDates: string[] = [];
          for (let i = lastIndex; i >= 0; i--) {
            const dateStr = data[i].originalTime.split(" ")[0];
            if (!uniqueDates.includes(dateStr)) {
              uniqueDates.push(dateStr);
            }
            if (uniqueDates.length === 6) { // 6번째 날짜 발견 시 중단
              break;
            }
          }
          
          if (uniqueDates.length >= 5) {
            // 최근 5개 날짜 중 가장 오래된 날짜 (uniqueDates[4])
            const cutoffDate = uniqueDates.length === 6 ? uniqueDates[4] : uniqueDates[uniqueDates.length - 1];
            for (let i = 0; i <= lastIndex; i++) {
              const dateStr = data[i].originalTime.split(" ")[0];
              if (dateStr >= cutoffDate) {
                startIndex = i;
                break;
              }
            }
          }
        }

        const range = { from: data[startIndex].time as any, to: data[lastIndex].time as any };
        isSyncingRef.current = true;
        chartsRef.current.forEach(c => {
          c.timeScale().setVisibleRange(range);
          if (isMobile) {
            c.timeScale().scrollToPosition(8, false);
          }
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

      // We have two subcharts: "close" and "above_ma"
      const panels = [
        { id: "close", name: `${market} Index Close`, height: isMobile ? 200 : 350 },
        { id: "above_ma", name: "Above 10/20/50 MA Percentage (%)", height: isMobile ? 150 : 250 }
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
            textColor: "#cbd5e1", // 높은 시인성을 위해 더 밝은 텍스트 컬러 사용 (slate-300)
            fontFamily: "Inter, system-ui, -apple-system, sans-serif", // 볼드체 뭉침을 방지하고 깔끔하게 렌더링하기 위한 폰트 지정
          },
          grid: {
            vertLines: { color: "#1e293b" },
            horzLines: { color: "#1e293b" },
          },
          timeScale: {
            visible: index === panels.length - 1,
            borderColor: "#334155",
            rightOffset: 20,
            barSpacing: 10,
          },
          rightPriceScale: {
            borderColor: "#334155",
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true,
            minimumWidth: 100,
          },
          handleScale: isMobile ? {
            pinch: true,                  // 모바일 핀치 줌 허용 (가로 시간축 줌인/줌아웃)
            mouseWheel: false,            // 모바일 휠 미지원
            axisPressedMouseMove: false,  // Y축 터치 드래그 조작 차단 (높이 고정)
          } : {
            axisPressedMouseMove: panel.id === "close",
            pinch: panel.id === "close",
            mouseWheel: true,
          },
          handleScroll: isMobile ? {
            horzTouchDrag: panel.id === "close",
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
        if (panel.id === "close") {
          // Index close price as AreaSeries with a beautiful gradient
          activeSeries.push(chart.addSeries(AreaSeries, {
            lineColor: "#38bdf8",
            topColor: "rgba(56, 189, 248, 0.4)",
            bottomColor: "rgba(56, 189, 248, 0.0)",
            lineWidth: 2,
          }));
        } else if (panel.id === "above_ma") {
          // Above 10MA (Red), Above 20MA (Green), Above 50MA (Blue)
          activeSeries.push(chart.addSeries(LineSeries, { color: "#ff3b30", lineWidth: 2, title: "10MA" }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#4cd964", lineWidth: 2, title: "20MA" }));
          activeSeries.push(chart.addSeries(LineSeries, { color: "#2f80ed", lineWidth: 2, title: "50MA" }));
          
          // Configure price scale options for percentage (0 to 100)
          chart.priceScale("right").applyOptions({
            scaleMargins: { top: 0.05, bottom: 0.05 },
            visible: true,
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
            setHoveredData(null);
          } else {
            const currentPoint = chartDataRef.current?.find((p: any) => p.time === param.time);
            if (currentPoint) {
              setHoveredData({
                time: currentPoint.originalTime,
                close: currentPoint.close || 0,
                above_sma10: currentPoint.indicators?.above_sma10 || 0,
                above_sma20: currentPoint.indicators?.above_sma20 || 0,
                above_sma50: currentPoint.indicators?.above_sma50 || 0,
              });
            }
          }
        });

        // Visible range synchronization
        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          updateLinePositions();
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
      setStatus("Error");
    }

    return cleanup;
  }, [market, isMobile]);

  // Push data into charts
  useEffect(() => {
    if (formattedData.length === 0) return;
    if (seriesRef.current.size === 0) return;

    // Close price chart
    const closeSeriesList = seriesRef.current.get("close");
    if (closeSeriesList && closeSeriesList[0]) {
      closeSeriesList[0].setData(formattedData.map(p => ({
        time: p.time as any,
        value: p.close || 0
      })));
    }

    // Above MA indicators chart
    const aboveMaSeriesList = seriesRef.current.get("above_ma");
    if (aboveMaSeriesList && aboveMaSeriesList.length >= 3) {
      aboveMaSeriesList[0].setData(formattedData.map(p => ({ time: p.time as any, value: p.indicators?.above_sma10 || 0 })));
      aboveMaSeriesList[1].setData(formattedData.map(p => ({ time: p.time as any, value: p.indicators?.above_sma20 || 0 })));
      aboveMaSeriesList[2].setData(formattedData.map(p => ({ time: p.time as any, value: p.indicators?.above_sma50 || 0 })));
    }

    setTimeout(() => { scrollToLatest(); }, 500);
  }, [formattedData]);

  // Clean resize listener
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      chartsRef.current.forEach((chart, id) => {
        const el = containerRef.current?.querySelector(`[data-chart-id="${id}"]`);
        if (el) chart.applyOptions({ width: el.clientWidth });
      });
      setTimeout(() => {
        const closeChart = chartsRef.current.get("close");
        if (!closeChart) return;
        const xs: number[] = [];
        dayBoundariesRef.current.forEach(time => {
          const x = closeChart.timeScale().timeToCoordinate(time as any);
          if (x !== null && x >= 0) {
            xs.push(x);
          }
        });
        setVerticalLineXs(xs);
      }, 50);
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
            {market} Above MA Trend
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
            <span className="text-[#38bdf8] font-bold">
              Index: <span className="text-slate-100">{hoveredData.close.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
            </span>
            <span className="text-[#ff3b30] font-bold">
              10MA: <span className="text-slate-100">{hoveredData.above_sma10.toFixed(1)}%</span>
            </span>
            <span className="text-[#4cd964] font-bold">
              20MA: <span className="text-slate-100">{hoveredData.above_sma20.toFixed(1)}%</span>
            </span>
            <span className="text-[#2f80ed] font-bold">
              50MA: <span className="text-slate-100">{hoveredData.above_sma50.toFixed(1)}%</span>
            </span>
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

        {/* Close Price Panel */}
        <div className="relative bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-inner">
          <div className="absolute top-2.5 left-3.5 z-20 pointer-events-none">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {market} Index Close Price
            </span>
          </div>
          <div data-chart-id="close" className="w-full relative" style={{ height: isMobile ? "200px" : "350px" }}>
            {/* Vertical lines overlay */}
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
              {verticalLineXs.map((x, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 border-l border-dashed border-sky-500/30"
                  style={{ left: `${x}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Above MA percentages Panel */}
        <div className="relative bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-inner">
          <div className="absolute top-2.5 left-3.5 z-20 pointer-events-none">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Above 10/20/50 MA Percentage (%)
            </span>
          </div>
          <div data-chart-id="above_ma" className="w-full relative" style={{ height: isMobile ? "150px" : "250px" }}>
            {/* Vertical lines overlay */}
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
              {verticalLineXs.map((x, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 border-l border-dashed border-sky-500/30"
                  style={{ left: `${x}px` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
