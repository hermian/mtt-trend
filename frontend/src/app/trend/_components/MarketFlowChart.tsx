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
import { useMarketFlowData, useMarketFlowDates } from "@/hooks/useMarketFlowData";

interface MarketFlowChartProps {
  height?: number;
}

interface HoveredData {
  time: string;
  prices: Record<string, number | undefined>; // 다중 지수 가격 매핑
  foreigner?: number;
  institution?: number;
  program?: number;
  future_foreigner?: number;
}

const INDEX_OPTIONS = [
  { id: "kospi", name: "KOSPI", color: "#38bdf8" },
  { id: "kospi200", name: "K200", color: "#eab308" },
  { id: "kosdaq", name: "KOSDAQ", color: "#10b981" },
  { id: "kq150", name: "K150", color: "#e879f9" },
] as const;

type IndexType = (typeof INDEX_OPTIONS)[number]["id"];

export const MarketFlowChart: React.FC<MarketFlowChartProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<SeriesType>[]>>(new Map());
  const chartDataRef = useRef<any>(null);
  const isSyncingRef = useRef<boolean>(false);
  const [status, setStatus] = useState<string>("Initializing...");
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // 지수 다중 선택 상태 (기본값: KOSPI)
  const [selectedIndexes, setSelectedIndexes] = useState<IndexType[]>(["kospi"]);

  // 날짜 리스트 및 선택 날짜 상태
  const { data: dates } = useMarketFlowDates();
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  // 날짜 데이터 로드 시 기본값으로 가장 최근 날짜 설정
  useEffect(() => {
    if (dates && dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[dates.length - 1]);
    }
  }, [dates, selectedDate]);

  const { data: chartData, isLoading, error } = useMarketFlowData(selectedDate);

  // 지수별 DB 컬럼 매핑 헬퍼
  const getIndexPrice = (p: any, idx: IndexType) => {
    switch (idx) {
      case "kospi":
        return p.kospi_price;
      case "kospi200":
        return p.kospi200_price;
      case "kosdaq":
        return p.kosdaq_price;
      case "kq150":
        return p.kq150_price;
      default:
        return p.kospi_price;
    }
  };

  // 날짜 내 첫 시점 데이터를 기준으로 0부터 시작하게 가공 (Zero-start)
  const formattedData = useMemo(() => {
    if (!chartData || !chartData.data) return [];
    
    const sorted = [...chartData.data].sort((a, b) => {
      const timeA = `${a.date}T${a.time}:00`;
      const timeB = `${b.date}T${b.time}:00`;
      return timeA > timeB ? 1 : -1;
    });

    const dayFirstData: Record<string, { f: number; i: number; p: number; ff: number }> = {};
    sorted.forEach(p => {
      if (!dayFirstData[p.date]) {
        dayFirstData[p.date] = {
          f: p.kospi_foreigner ?? 0,
          i: p.kospi_institution ?? 0,
          p: p.kospi_program ?? 0,
          ff: p.future_foreigner ?? 0,
        };
      }
    });

    return sorted.map(p => {
      const dt = new Date(`${p.date}T${p.time}:00+09:00`);
      const first = dayFirstData[p.date];
      return {
        ...p,
        time: Math.floor(dt.getTime() / 1000) as any,
        displayTime: `${p.date} ${p.time}`,
        kospi_foreigner_val: (p.kospi_foreigner ?? 0) - first.f,
        kospi_institution_val: (p.kospi_institution ?? 0) - first.i,
        kospi_program_val: (p.kospi_program ?? 0) - first.p,
        future_foreigner_val: (p.future_foreigner ?? 0) - first.ff,
      };
    });
  }, [chartData]);

  useEffect(() => {
    if (formattedData.length > 0) chartDataRef.current = formattedData;
  }, [formattedData]);

  // X축 범위를 09:00 ~ 15:45로 고정
  const setChartVisibleRange = () => {
    if (formattedData.length > 0 && chartsRef.current.size > 0) {
      const dateStr = formattedData[0].date;
      const startSec = Math.floor(new Date(`${dateStr}T09:00:00+09:00`).getTime() / 1000);
      const endSec = Math.floor(new Date(`${dateStr}T15:45:00+09:00`).getTime() / 1000);
      
      setTimeout(() => {
        isSyncingRef.current = true;
        chartsRef.current.forEach(c => {
          c.timeScale().setVisibleRange({
            from: startSec as any,
            to: endSec as any,
          });
        });
        setTimeout(() => { isSyncingRef.current = false; }, 100);
      }, 100);
    }
  };

  useEffect(() => {
    if (!containerRef.current || !selectedDate) return;
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
        { id: "prices", name: "시장 지수", height: isMobile ? 220 : 320 },
        { id: "supply", name: "수급 트렌드 (억 원)", height: isMobile ? 280 : 380 },
      ];

      panels.forEach((panel) => {
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
            rightOffset: 10,
            barSpacing: 6,
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
            tickMarkFormatter: (time: number) => {
              const dt = new Date(time * 1000);
              const formatter = new Intl.DateTimeFormat("ko-KR", {
                timeZone: "Asia/Seoul",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
              });
              return formatter.format(dt);
            }
          },
          rightPriceScale: {
            borderColor: "#334155",
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true,
            visible: true,
          },
          leftPriceScale: {
            visible: false,
          },
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

        if (panel.id === "prices") {
          // 다중 지수 선택 라인 추가
          selectedIndexes.forEach(idxId => {
            const opt = INDEX_OPTIONS.find(o => o.id === idxId);
            const series = chart.addSeries(LineSeries, {
              color: opt?.color || "#cbd5e1",
              lineWidth: 2,
              priceScaleId: "right",
              priceFormat: { type: "price", precision: 2, minMove: 0.01 },
            });
            activeSeries.push(series);
          });
        } else if (panel.id === "supply") {
          chart.applyOptions({
            rightPriceScale: {
              autoScale: true,
              scaleMargins: { top: 0.05, bottom: 0.05 },
            },
          });

          // 1. 외국인 (KOSPI)
          const foreigner = chart.addSeries(LineSeries, {
            color: "#ef4444",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 0, minMove: 1 },
          });
          foreigner.createPriceLine({
            price: 0,
            color: "#475569",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: "",
          });
          activeSeries.push(foreigner);

          // 2. 기관 (KOSPI)
          const institution = chart.addSeries(LineSeries, {
            color: "#3b82f6",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 0, minMove: 1 },
          });
          activeSeries.push(institution);

          // 3. 비차익 (KOSPI)
          const program = chart.addSeries(LineSeries, {
            color: "#10b981",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 0, minMove: 1 },
          });
          activeSeries.push(program);

          // 4. 외국인 선물
          const futureForeigner = chart.addSeries(LineSeries, {
            color: "#e879f9",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 0, minMove: 1 },
          });
          activeSeries.push(futureForeigner);
        }

        chartsRef.current.set(panel.id, chart);
        seriesRef.current.set(panel.id, activeSeries);

        // Crosshair move handling
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
              const pricesMap: Record<string, number | undefined> = {};
              selectedIndexes.forEach(idx => {
                pricesMap[idx] = getIndexPrice(latestPoint, idx);
              });
              setHoveredData({
                time: latestPoint.displayTime,
                prices: pricesMap,
                foreigner: latestPoint.kospi_foreigner_val || undefined,
                institution: latestPoint.kospi_institution_val || undefined,
                program: latestPoint.kospi_program_val || undefined,
                future_foreigner: latestPoint.future_foreigner_val || undefined,
              });
            } else {
              setHoveredData(null);
            }
          } else {
            const currentPoint = chartDataRef.current?.find((p: any) => p.time === param.time);
            if (currentPoint) {
              const pricesMap: Record<string, number | undefined> = {};
              selectedIndexes.forEach(idx => {
                pricesMap[idx] = getIndexPrice(currentPoint, idx);
              });
              setHoveredData({
                time: currentPoint.displayTime,
                prices: pricesMap,
                foreigner: currentPoint.kospi_foreigner_val || undefined,
                institution: currentPoint.kospi_institution_val || undefined,
                program: currentPoint.kospi_program_val || undefined,
                future_foreigner: currentPoint.future_foreigner_val || undefined,
              });
            }
          }
        });

        // Visible logical range sync
        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncingRef.current || !range) return;
          isSyncingRef.current = true;
          chartsRef.current.forEach(c => {
            if (c !== chart) c.timeScale().setVisibleLogicalRange(range);
          });
          setTimeout(() => { isSyncingRef.current = false; }, 10);
        });
      });

      const resizeObserver = new ResizeObserver(() => {
        chartsRef.current.forEach((chart, id) => {
          const scrollArea2 = containerRef.current?.querySelector("[data-scroll-area]") as HTMLElement;
          const el = scrollArea2?.querySelector(`[data-chart-id="${id}"]`) as HTMLElement;
          if (el) {
            chart.resize(el.clientWidth, chart.options().height as number);
          }
        });
      });
      resizeObserver.observe(scrollArea);

      setStatus("Active");
      return () => {
        cleanup();
        resizeObserver.disconnect();
      };
    } catch (e: any) {
      console.error("Error drawing charts:", e);
      setStatus(`Error: ${e.message}`);
    }
  }, [formattedData, isMobile, selectedIndexes, selectedDate]);

  // 데이터 바인딩
  useEffect(() => {
    if (formattedData.length === 0 || status !== "Active") return;

    const pricesSeries = seriesRef.current.get("prices");
    if (pricesSeries && pricesSeries.length === selectedIndexes.length) {
      selectedIndexes.forEach((idxId, sIndex) => {
        const limitSec = Math.floor(new Date(`${selectedDate}T15:30:00+09:00`).getTime() / 1000);
        const filtered = formattedData
          .filter(d => {
            const price = getIndexPrice(d, idxId);
            return price != null && price > 0 && d.time <= limitSec;
          })
          .map(d => ({ time: d.time, value: getIndexPrice(d, idxId)! }));

        if (filtered.length > 0) {
          const lastPrice = filtered[filtered.length - 1].value;
          const targetTimes = ["15:35", "15:40", "15:45"];
          
          targetTimes.forEach(tStr => {
            const tSec = Math.floor(new Date(`${selectedDate}T${tStr}:00+09:00`).getTime() / 1000);
            if (formattedData.some(d => d.time === tSec)) {
              filtered.push({ time: tSec, value: lastPrice });
            }
          });
        }
        
        pricesSeries[sIndex].setData(filtered);
      });
    }

    const supplySeries = seriesRef.current.get("supply");
    if (supplySeries && supplySeries.length >= 4) {
      supplySeries[0].setData(formattedData.map(d => ({ time: d.time, value: d.kospi_foreigner_val ?? 0 })));
      supplySeries[1].setData(formattedData.map(d => ({ time: d.time, value: d.kospi_institution_val ?? 0 })));
      supplySeries[2].setData(formattedData.map(d => ({ time: d.time, value: d.kospi_program_val ?? 0 })));
      supplySeries[3].setData(formattedData.map(d => ({ time: d.time, value: d.future_foreigner_val ?? 0 })));
    }

    setChartVisibleRange();
  }, [formattedData, status, selectedIndexes]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center bg-slate-900 text-slate-400">
        <span className="animate-pulse">로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center bg-slate-900 text-red-400">
        오류: {(error as any).message || "데이터를 불러오는 데 실패했습니다."}
      </div>
    );
  }

  const fmt = (v: number | undefined, unit = "억") => {
    if (v == null || v === 0) return "-";
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toLocaleString()}${unit}`;
  };

  // 지수 다중 선택 처리 함수
  const toggleIndex = (idxId: IndexType) => {
    setSelectedIndexes(prev => {
      if (prev.includes(idxId)) {
        if (prev.length <= 1) return prev; // 최소 1개 보장
        return prev.filter(x => x !== idxId);
      }
      return [...prev, idxId];
    });
  };

  // 날짜 좌우 이동 헬퍼
  const handlePrevDay = () => {
    if (!dates || dates.length === 0) return;
    const currIdx = dates.indexOf(selectedDate);
    if (currIdx > 0) {
      setSelectedDate(dates[currIdx - 1]);
    }
  };

  const handleNextDay = () => {
    if (!dates || dates.length === 0) return;
    const currIdx = dates.indexOf(selectedDate);
    if (currIdx >= 0 && currIdx < dates.length - 1) {
      setSelectedDate(dates[currIdx + 1]);
    }
  };

  const isFirstDay = dates ? dates.indexOf(selectedDate) === 0 : true;
  const isLastDay = dates ? dates.indexOf(selectedDate) === dates.length - 1 : true;

  return (
    <div ref={containerRef} className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
      {/* Chart Header / Date Selector & Index Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-slate-100">시장 지수 & 수급 트렌드</h2>
          <p className="text-xs text-slate-400">코스피/코스닥 지수 및 메이저 수급 추이 (5분봉)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Index toggle options */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800">
            {INDEX_OPTIONS.map((opt) => {
              const active = selectedIndexes.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleIndex(opt.id)}
                  className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  style={active ? { backgroundColor: opt.color } : {}}
                >
                  {opt.name}
                </button>
              );
            })}
          </div>

          {/* Date Selector Navigation */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded border border-slate-800">
            <button
              onClick={handlePrevDay}
              disabled={isFirstDay}
              className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              ←
            </button>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
            >
              {dates?.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button
              onClick={handleNextDay}
              disabled={isLastDay}
              className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Hover Info Board */}
      <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-900/50 p-3 sm:grid-cols-3 md:grid-cols-7 text-xs border border-slate-800/40">
        <div className="flex flex-col">
          <span className="text-slate-400 font-medium">시간</span>
          <span className="font-semibold text-slate-200">{hoveredData?.time || "-"}</span>
        </div>
        
        {/* 선택된 다중 지수를 범례에 출력 */}
        {INDEX_OPTIONS.map(opt => {
          if (!selectedIndexes.includes(opt.id)) return null;
          const val = hoveredData?.prices[opt.id];
          return (
            <div className="flex flex-col" key={opt.id} style={{ color: opt.color }}>
              <span className="font-medium opacity-90">{opt.name}</span>
              <span className="font-semibold">{val ? val.toFixed(2) : "-"}</span>
            </div>
          );
        })}

        <div className="flex flex-col">
          <span className="text-red-400 font-medium">외국인</span>
          <span className="font-semibold text-red-400">
            {fmt(hoveredData?.foreigner)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-blue-400 font-medium">기관</span>
          <span className="font-semibold text-blue-400">
            {fmt(hoveredData?.institution)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-emerald-400 font-medium">비차익</span>
          <span className="font-semibold text-emerald-400">
            {fmt(hoveredData?.program)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-fuchsia-400 font-medium">선물외인</span>
          <span className="font-semibold text-fuchsia-400">
            {fmt(hoveredData?.future_foreigner)}
          </span>
        </div>
      </div>

      {/* Chart container area */}
      <div data-scroll-area className="flex flex-col gap-4">
        <div className="relative">
          <div className="absolute left-2 top-2 z-10 flex items-center gap-3 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-800">
            {INDEX_OPTIONS.map(opt => {
              if (!selectedIndexes.includes(opt.id)) return null;
              return (
                <span key={opt.id} style={{ color: opt.color }}>
                  ● {opt.name}
                </span>
              );
            })}
          </div>
          <div data-chart-id="prices" className="w-full rounded-lg overflow-hidden border border-slate-900" />
        </div>
        <div className="relative">
          <div className="absolute left-2 top-2 z-10 flex items-center gap-3 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-800">
            <span className="text-red-400">● 외국인</span>
            <span className="text-blue-400">● 기관</span>
            <span className="text-emerald-400">● 비차익</span>
            <span className="text-fuchsia-400">● 선물외인</span>
            <span className="text-slate-500 ml-1">(억 원)</span>
          </div>
          <div data-chart-id="supply" className="w-full rounded-lg overflow-hidden border border-slate-900" />
        </div>
      </div>
    </div>
  );
};
