"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useTop30, useTop30Dates, useTop30Matrix } from "@/hooks/useTop30";
import { Top30MatrixItem } from "@/lib/api";
import { StockNameLink } from "@/components/StockNameLink";
import clsx from "clsx";

const MARKETS = [
  { id: "all", label: "전체" },
  { id: "kospi", label: "KOSPI" },
  { id: "kosdaq", label: "KOSDAQ" },
] as const;

const TIMEFRAMES = [
  { id: "daily", label: "일간", startLabel: "시작일", endLabel: "종료일", badge3: "3D▲", badge2: "2D▲", guideBadge3: "3일 연속", guideBadge2: "2일 연속", colSuffix: "기준일" },
  { id: "weekly", label: "주간", startLabel: "시작주", endLabel: "종료주", badge3: "3W▲", badge2: "2W▲", guideBadge3: "3주 연속", guideBadge2: "2주 연속", colSuffix: "기준주" },
  { id: "monthly", label: "월간", startLabel: "시작월", endLabel: "종료월", badge3: "3M▲", badge2: "2M▲", guideBadge3: "3개월 연속", guideBadge2: "2개월 연속", colSuffix: "기준월" },
] as const;

type TimeframeType = "daily" | "weekly" | "monthly";

const TOP_10_BADGES = [
  "bg-red-900/60 border border-red-700/50 text-red-200",
  "bg-orange-900/60 border border-orange-700/50 text-orange-200",
  "bg-amber-900/60 border border-amber-700/50 text-amber-200",
  "bg-green-900/60 border border-green-700/50 text-green-200",
  "bg-emerald-900/60 border border-emerald-700/50 text-emerald-200",
  "bg-teal-900/60 border border-teal-700/50 text-teal-200",
  "bg-blue-900/60 border border-blue-700/50 text-blue-200",
  "bg-indigo-900/60 border border-indigo-700/50 text-indigo-200",
  "bg-purple-900/60 border border-purple-700/50 text-purple-200",
  "bg-rose-900/60 border border-rose-700/50 text-rose-200",
];


const TOP_10_COLORS = [
  "#3b82f6", // #1 Sky/Blue (삼성전자)
  "#10b981", // #2 Emerald (SK하이닉스)
  "#f59e0b", // #3 Amber (SK스퀘어)
  "#ec4899", // #4 Pink (삼성전기)
  "#8b5cf6", // #5 Purple (현대차)
  "#06b6d4", // #6 Cyan (LG에너지솔루션)
  "#f97316", // #7 Orange (삼성바이오로직스)
  "#14b8a6", // #8 Teal (KB금융)
  "#a855f7", // #9 Violet (삼성생명)
  "#84cc16", // #10 Lime (한화에어로스페이스)
];

const CHART_TOP_10_STROKES = TOP_10_COLORS;


function formatMarcap(marcap?: number | null): string {
  if (marcap == null) return "-";
  const jo = marcap / 10; // 천억원 → 조원
  if (jo >= 1) {
    return `${jo.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조`;
  }
  const billion = marcap * 1000;
  return `${billion.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억`;
}

interface SelectedCellState {
  code: string;
  name: string;
  date: string;
  item: Top30MatrixItem;
}

export function MarketCapTop30Panel() {
  const [timeframe, setTimeframe] = useState<TimeframeType>("daily");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [market, setMarket] = useState<"all" | "kospi" | "kosdaq">("all");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [selectedCell, setSelectedCell] = useState<SelectedCellState | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [isChartMinimized, setIsChartMinimized] = useState<boolean>(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [baseColumnWidth, setBaseColumnWidth] = useState<number>(150);

  const activeCode = selectedCell?.code ?? null;


  const currentTfMeta = useMemo(() => {
    return TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0];
  }, [timeframe]);

  // Fetch available dates / periods for active timeframe
  const { data: datesData, isLoading: datesLoading, error: datesError } = useTop30Dates(timeframe);
  const dates = datesData?.dates ?? [];

  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const clickStartCoord = useRef({ x: 0, y: 0 });
  const isResizingRef = useRef(false);

  // Set default start/end dates once periods are loaded or timeframe changes
  const handleResetDateRange = () => {
    if (!dates || dates.length === 0) return;
    const latest = dates[dates.length - 1];
    const defaultCount = timeframe === "daily" ? 20 : timeframe === "weekly" ? 24 : 12;
    const defaultStartIdx = Math.max(0, dates.length - defaultCount);
    setStartDate(dates[defaultStartIdx]);
    setEndDate(latest);
  };

  useEffect(() => {
    handleResetDateRange();
  }, [dates, timeframe]);

  // Ctrl + Wheel Zoom Handler for Chart View (X-axis date range expansion / contraction)
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el || view !== "chart" || !dates || dates.length < 2) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();

      let currentStartIdx = dates.indexOf(startDate);
      let currentEndIdx = dates.indexOf(endDate);

      if (currentStartIdx === -1) currentStartIdx = 0;
      if (currentEndIdx === -1) currentEndIdx = dates.length - 1;
      if (currentStartIdx > currentEndIdx) {
        const tmp = currentStartIdx;
        currentStartIdx = currentEndIdx;
        currentEndIdx = tmp;
      }

      const span = currentEndIdx - currentStartIdx + 1;
      const rect = el.getBoundingClientRect();
      const leftPadding = 45;
      const rightPadding = 25;
      const chartWidth = Math.max(1, rect.width - leftPadding - rightPadding);
      const mouseX = e.clientX - rect.left - leftPadding;
      const cursorRatio = Math.max(0, Math.min(1, mouseX / chartWidth));

      // Zoom step: ~15% of span, min 1
      const step = Math.max(1, Math.round(span * 0.15));
      const deltaSpan = e.deltaY < 0 ? -step : step;
      const newSpan = Math.max(5, Math.min(dates.length, span + deltaSpan));

      if (newSpan === span) return;

      const diff = newSpan - span;
      let newStartIdx = Math.round(currentStartIdx - diff * cursorRatio);
      let newEndIdx = Math.round(currentEndIdx + diff * (1 - cursorRatio));

      if (newStartIdx < 0) {
        newEndIdx = Math.min(dates.length - 1, newEndIdx - newStartIdx);
        newStartIdx = 0;
      }
      if (newEndIdx >= dates.length) {
        newStartIdx = Math.max(0, newStartIdx - (newEndIdx - (dates.length - 1)));
        newEndIdx = dates.length - 1;
      }

      if (newStartIdx <= newEndIdx && (dates[newStartIdx] !== startDate || dates[newEndIdx] !== endDate)) {
        setStartDate(dates[newStartIdx]);
        setEndDate(dates[newEndIdx]);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [view, dates, startDate, endDate]);


  // Handle column resize
  const handleResizeStart = (d: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = columnWidths[d] || baseColumnWidth;

    const handleMouseMoveWindow = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(100, Math.min(500, startWidth + deltaX));
      setColumnWidths((prev) => ({
        ...prev,
        [d]: newWidth,
      }));
    };

    const handleMouseUpWindow = () => {
      isResizingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMoveWindow);
      window.removeEventListener("mouseup", handleMouseUpWindow);
    };

    window.addEventListener("mousemove", handleMouseMoveWindow);
    window.addEventListener("mouseup", handleMouseUpWindow);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (isResizingRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest("select, option, button, a")) return;

    const container = containerRef.current;
    if (!container) return;

    isDownRef.current = true;
    startXRef.current = e.pageX - container.offsetLeft;
    scrollLeftRef.current = container.scrollLeft;
    clickStartCoord.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDownRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    e.preventDefault();

    const deltaX = Math.abs(e.clientX - clickStartCoord.current.x);
    const deltaY = Math.abs(e.clientY - clickStartCoord.current.y);

    if (deltaX > 5 || deltaY > 5) {
      hasDraggedRef.current = true;
    }

    const x = e.pageX - container.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    container.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    isDownRef.current = false;
  };

  const handleMouseLeave = () => {
    isDownRef.current = false;
  };

  const handleTimeframeChange = (newTf: TimeframeType) => {
    if (newTf === timeframe) return;
    setTimeframe(newTf);
    setStartDate("");
    setEndDate("");
  };

  // Queries
  const matrixResult = useTop30Matrix(
    startDate || undefined,
    endDate || undefined,
    market,
    timeframe,
    30
  );
  const matrixQueryData = matrixResult?.data;
  const matrixLoading = matrixResult?.isLoading ?? false;
  const matrixError = matrixResult?.error ?? null;

  // Optional legacy hook fallback for tests mocking useTop30 (daily only)
  const isDaily = timeframe === "daily";
  const singleResult = useTop30(
    !matrixQueryData && isDaily && endDate ? endDate : null,
    market,
    5
  );
  const singleTop30Data = singleResult?.data;
  const singleLoading = singleResult?.isLoading ?? false;
  const singleError = isDaily ? singleResult?.error ?? null : null;

  // Unified matrix dataset
  const matrixData = useMemo(() => {
    if (matrixQueryData && matrixQueryData.dates && matrixQueryData.dates.length > 0) {
      return matrixQueryData;
    }
    if (singleTop30Data) {
      const windowDates =
        singleTop30Data.window_dates && singleTop30Data.window_dates.length > 0
          ? singleTop30Data.window_dates
          : [singleTop30Data.date];

      return {
        market: singleTop30Data.market,
        timeframe: "daily",
        dates: windowDates.map((d, dateIdx) => {
          return {
            date: d,
            rankings: singleTop30Data.stocks.map((s) => ({
              code: s.code,
              name: s.name,
              market: s.market,
              marcap: s.marcap,
              rank: s.series[dateIdx] ?? s.rank,
              previous_rank: s.previous_rank,
              rank_delta: s.rank_delta,
              new_entrant: s.new_entrant,
              sector: null,
            })),
          };
        }),
      };
    }
    return undefined;
  }, [matrixQueryData, singleTop30Data]);

  // Sync startDate and endDate once matrix data arrives if not yet set
  useEffect(() => {
    if (matrixData?.dates && matrixData.dates.length > 0) {
      if (!startDate || !endDate) {
        const d = matrixData.dates;
        setStartDate(d[0].date);
        setEndDate(d[d.length - 1].date);
      }
    }
  }, [matrixData, startDate, endDate]);

  const isLoading = matrixLoading && (singleLoading || !matrixData);
  const error = matrixError || singleError;


  // Filtered visible dates
  const visibleDates = useMemo(() => {
    if (!matrixData || !matrixData.dates) return [];
    if (!startDate || !endDate) return matrixData.dates;
    return matrixData.dates.filter((d) => d.date >= startDate && d.date <= endDate);
  }, [matrixData, startDate, endDate]);

  // Selectable drop down lists
  const selectableEndDates = useMemo(() => {
    if (!startDate) return dates;
    return dates.filter((d) => d >= startDate);
  }, [dates, startDate]);

  const selectableStartDates = useMemo(() => {
    if (!endDate) return dates;
    return dates.filter((d) => d <= endDate);
  }, [dates, endDate]);

  // Handle select changes
  const handleStartDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setStartDate(val);
    if (endDate && val > endDate) setEndDate(val);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setEndDate(val);
    if (startDate && val < startDate) setStartDate(val);
  };

  // Toggle stock highlight & PiP
  const handleToggleStock = (stock: { code: string; name: string; marcap?: number | null; market?: string; rank?: number; item?: Top30MatrixItem }) => {
    if (activeCode === stock.code) {
      // Toggle off
      setSelectedCell(null);
    } else {
      // Toggle on
      const foundItem: Top30MatrixItem = stock.item || {
        code: stock.code,
        name: stock.name,
        market: stock.market || "KOSPI",
        marcap: stock.marcap ?? null,
        rank: stock.rank ?? 1,
        previous_rank: null,
        rank_delta: null,
        new_entrant: false,
        sector: null,
      };
      setSelectedCell({
        code: stock.code,
        name: stock.name,
        date: visibleDates.length > 0 ? visibleDates[visibleDates.length - 1].date : endDate,
        item: foundItem,
      });
    }
  };

  // Handle table cell click (toggle)
  const handleCellClick = (item: Top30MatrixItem, date: string) => {
    if (activeCode === item.code) {
      setSelectedCell(null);
    } else {
      setSelectedCell({
        code: item.code,
        name: item.name,
        date,
        item,
      });
    }
  };

  // Auto-scroll table to the rightmost date on load
  useEffect(() => {
    if (view === "table" && containerRef.current && visibleDates.length > 0) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [view, visibleDates.length]);

  // Map latest date top 10 stocks to distinctive colors
  const stockColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    if (!visibleDates || visibleDates.length === 0) return colorMap;

    const lastDateObj = visibleDates[visibleDates.length - 1];
    if (!lastDateObj || !lastDateObj.rankings) return colorMap;

    const sortedLastRankings = [...lastDateObj.rankings].sort((a, b) => a.rank - b.rank);
    const top10 = sortedLastRankings.slice(0, 10);
    top10.forEach((item, index) => {
      if (item.code) {
        colorMap.set(item.code, TOP_10_COLORS[index]);
      }
    });

    return colorMap;
  }, [visibleDates]);

  const chartStockColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    if (!visibleDates || visibleDates.length === 0) return colorMap;

    const lastDateObj = visibleDates[visibleDates.length - 1];
    if (!lastDateObj || !lastDateObj.rankings) return colorMap;

    const sortedLastRankings = [...lastDateObj.rankings].sort((a, b) => a.rank - b.rank);
    const top10 = sortedLastRankings.slice(0, 10);
    top10.forEach((item, index) => {
      if (item.code) {
        colorMap.set(item.code, CHART_TOP_10_STROKES[index]);
      }
    });

    return colorMap;
  }, [visibleDates]);

  // Identify stocks with 3 consecutive rank rises ending in the latest date
  const risingStocks3D = useMemo(() => {
    const stocks = new Set<string>();
    if (!visibleDates || visibleDates.length < 3) return stocks;

    const targetDates = visibleDates.slice(-3);
    const latestObj = targetDates[2];
    if (!latestObj || !latestObj.rankings) return stocks;

    for (const item of latestObj.rankings) {
      const code = item.code;
      const r0 = targetDates[0].rankings.find((r) => r.code === code)?.rank;
      const r1 = targetDates[1].rankings.find((r) => r.code === code)?.rank;
      const r2 = item.rank;

      if (r0 !== undefined && r1 !== undefined && r2 !== undefined) {
        if (r2 < r1 && r1 < r0) {
          stocks.add(code);
        }
      }
    }

    return stocks;
  }, [visibleDates]);

  // Identify stocks with 2 consecutive rank rises ending in the latest date
  const risingStocks2D = useMemo(() => {
    const stocks = new Set<string>();
    if (!visibleDates || visibleDates.length < 2) return stocks;

    const targetDates = visibleDates.slice(-2);
    const latestObj = targetDates[1];
    if (!latestObj || !latestObj.rankings) return stocks;

    for (const item of latestObj.rankings) {
      const code = item.code;
      if (risingStocks3D.has(code)) continue;

      const r0 = targetDates[0].rankings.find((r) => r.code === code)?.rank;
      const r1 = item.rank;

      if (r0 !== undefined && r1 !== undefined) {
        if (r1 < r0) {
          stocks.add(code);
        }
      }
    }

    return stocks;
  }, [visibleDates, risingStocks3D]);

  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!visibleDates.length) return [];

    return visibleDates.map((dateObj) => {
      const row: Record<string, any> = {
        date: dateObj.date.length > 5 ? dateObj.date.slice(5) : dateObj.date,
        fullDate: dateObj.date,
      };

      for (const item of dateObj.rankings) {
        row[item.code] = item.rank;
      }
      return row;
    });
  }, [visibleDates]);


  // Latest rankings on the latest date in visibleDates (for 1~30 end labels)
  const latestRankings = useMemo(() => {
    if (!visibleDates.length) return [];
    const last = visibleDates[visibleDates.length - 1];
    return [...last.rankings].sort((a, b) => a.rank - b.rank);
  }, [visibleDates]);

  const latestStockRankMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of latestRankings) {
      map.set(r.code, r.rank);
    }
    return map;
  }, [latestRankings]);

  // All unique stocks appearing across visible dates (latest reference date first)
  const allStocks = useMemo(() => {
    if (!visibleDates.length) return [];
    const map = new Map<string, Top30MatrixItem>();
    for (let i = visibleDates.length - 1; i >= 0; i--) {
      for (const r of visibleDates[i].rankings) {
        if (!map.has(r.code)) {
          map.set(r.code, r);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.rank - b.rank);
  }, [visibleDates]);


  // PiP Mini Chart Data
  const pipChartData = useMemo(() => {
    if (!selectedCell || !visibleDates.length) return [];
    return visibleDates.map((d) => {
      const found = d.rankings.find((r) => r.code === selectedCell.code);
      return {
        date: d.date.length > 5 ? d.date.slice(5) : d.date,
        fullDate: d.date,
        rank: found ? found.rank : null,
      };
    });
  }, [selectedCell, visibleDates]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900/40 border border-red-900/30 rounded-2xl">
        <span className="text-red-500 text-3xl mb-2">⚠️</span>
        <p className="text-gray-300 font-medium">시총 TOP 30 데이터를 불러오지 못했습니다. (백엔드 /api/trend/top30 확인)</p>
        <p className="text-gray-500 text-xs mt-1">{error?.toString()}</p>
      </div>
    );
  }

  const latestDate = visibleDates.length > 0 ? visibleDates[visibleDates.length - 1].date : endDate;

  // Custom 2-column Tooltip showing all 30 ranks without clipping
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const fullDate = payload[0]?.payload?.fullDate || label;
    const items = payload
      .filter((p: any) => p.value != null)
      .map((p: any) => {
        const stock = allStocks.find((s) => s.code === p.dataKey);
        return {
          rank: p.value as number,
          code: p.dataKey as string,
          name: stock?.name ?? p.dataKey,
          marcap: stock?.marcap,
          market: stock?.market,
          color: p.stroke,
        };
      })
      .sort((a: any, b: any) => a.rank - b.rank);

    return (
      <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl p-3 shadow-2xl z-50 text-xs w-[380px] max-w-[90vw] ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white font-mono text-sm">{fullDate}</span>
            <span className="text-[10px] text-blue-400 font-semibold bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/40">
              TOP 30
            </span>
          </div>
          <span className="text-[10px] text-gray-400">총 {items.length}개 종목 (1위~30위)</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
          {items.map((item: any) => {
            const isTop10 = item.rank <= 10;
            const isHighlighted = activeCode === item.code || hoveredCode === item.code;
            return (
              <div
                key={item.code}
                onMouseEnter={() => setHoveredCode(item.code)}
                onMouseLeave={() => setHoveredCode(null)}
                className={clsx(
                  "flex items-center justify-between py-0.5 px-1.5 rounded transition-colors",
                  isHighlighted
                    ? "bg-yellow-950/80 ring-1 ring-yellow-400 text-yellow-200 font-bold"
                    : isTop10
                    ? "bg-white/5 text-white"
                    : "text-gray-300"
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-4 text-right font-mono font-bold text-[10px]"
                    style={{ color: item.color }}
                  >
                    {item.rank}
                  </span>
                  <span className="truncate max-w-[90px] font-medium text-[11px]">
                    {item.name}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-gray-400 shrink-0">
                  {formatMarcap(item.marcap)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-6 relative">
      {/* Top Header Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-2xl font-extrabold text-white tracking-tight">시총 TOP 30 추적</h3>
          <p className="text-gray-400 text-sm mt-1">
            일별·주간·월간 시가총액 상위 30 종목 랭킹 추이 및 신규 진입·순위 변동 추적
          </p>
        </div>
      </div>

      {/* Filters & Header Controls */}
      <div className="flex flex-col bg-gray-900/60 p-4 rounded-xl border border-gray-800 gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-black/30 p-1 rounded-lg border border-gray-800 self-start md:self-auto shrink-0">
              <button
                onClick={() => setView("chart")}
                className={clsx(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  view === "chart" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                )}
              >
                차트
              </button>
              <button
                onClick={() => setView("table")}
                className={clsx(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  view === "table" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                )}
              >
                표
              </button>
            </div>

            {/* Timeframe Selector (일간 / 주간 / 월간) */}
            <div className="flex items-center bg-black/30 p-1 rounded-lg border border-gray-800 self-start md:self-auto shrink-0">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => handleTimeframeChange(tf.id)}
                  className={clsx(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all",
                    timeframe === tf.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>


            {/* Calendar Date / Period Selectors */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg border border-gray-800">
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{currentTfMeta.startLabel}</span>
                {timeframe === "monthly" ? (
                  <input
                    type="month"
                    value={startDate}
                    min={dates.length > 0 ? dates[0] : undefined}
                    max={endDate || (dates.length > 0 ? dates[dates.length - 1] : undefined)}
                    onChange={(e) => setStartDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {}
                    }}
                    className="cursor-pointer rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none [color-scheme:dark]"
                  />
                ) : timeframe === "weekly" ? (
                  <select
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-gray-900 text-xs border border-gray-700 rounded px-2.5 py-1 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-h-60"
                  >
                    {selectableStartDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={startDate}
                    min={dates.length > 0 ? dates[0] : undefined}
                    max={endDate || (dates.length > 0 ? dates[dates.length - 1] : undefined)}
                    onChange={(e) => setStartDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {}
                    }}
                    className="cursor-pointer rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none [color-scheme:dark]"
                  />
                )}
              </div>

              <span className="text-gray-500 text-xs">~</span>

              <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg border border-gray-800">
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{currentTfMeta.endLabel}</span>
                {timeframe === "monthly" ? (
                  <input
                    type="month"
                    value={endDate}
                    min={startDate || (dates.length > 0 ? dates[0] : undefined)}
                    max={dates.length > 0 ? dates[dates.length - 1] : undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {}
                    }}
                    className="cursor-pointer rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none [color-scheme:dark]"
                  />
                ) : timeframe === "weekly" ? (
                  <select
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-gray-900 text-xs border border-gray-700 rounded px-2.5 py-1 text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-h-60"
                  >
                    {selectableEndDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || (dates.length > 0 ? dates[0] : undefined)}
                    max={dates.length > 0 ? dates[dates.length - 1] : undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {}
                    }}
                    className="cursor-pointer rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none [color-scheme:dark]"
                  />
                )}
              </div>
            </div>

            {/* Column Width Slider & Presets (Table View Only) */}
            {view === "table" && (
              <div className="flex flex-wrap items-center gap-3 bg-black/20 px-3 py-1.5 rounded-lg border border-gray-800/80">
                <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">열 너비</span>
                <input
                  type="range"
                  min="100"
                  max="300"
                  value={baseColumnWidth}
                  onChange={(e) => {
                    setBaseColumnWidth(Number(e.target.value));
                    setColumnWidths({});
                  }}
                  className="w-20 md:w-28 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[10px] text-gray-500 font-mono w-8">{baseColumnWidth}px</span>
                <div className="flex gap-1 border-l border-gray-800 pl-2">
                  <button
                    onClick={() => {
                      setBaseColumnWidth(120);
                      setColumnWidths({});
                    }}
                    className={clsx(
                      "px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors",
                      baseColumnWidth === 120 ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"
                    )}
                  >
                    좁게
                  </button>
                  <button
                    onClick={() => {
                      setBaseColumnWidth(150);
                      setColumnWidths({});
                    }}
                    className={clsx(
                      "px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors",
                      baseColumnWidth === 150 ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"
                    )}
                  >
                    보통
                  </button>
                  <button
                    onClick={() => {
                      setBaseColumnWidth(220);
                      setColumnWidths({});
                    }}
                    className={clsx(
                      "px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors",
                      baseColumnWidth === 220 ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"
                    )}
                  >
                    넓게
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Market Selector */}
          <div className="flex items-center bg-black/30 p-1 rounded-lg border border-gray-800 self-start md:self-auto">
            {MARKETS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMarket(m.id)}
                className={clsx(
                  "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                  market === m.id ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tip Guidance Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-950/20 px-3.5 py-2 rounded-lg border border-blue-900/30 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <span className="text-sm">💡</span>
            <span>
              <strong>설계서 차트 하이라이트 원칙:</strong> 신규진입(<span className="text-sky-400 font-bold">하늘색</span>) 및 5단계↑ 급등 Movers(<span className="text-emerald-400 font-bold">초록색</span>)는 굵고 밝게, 하락은 <span className="text-red-400 font-bold">붉은색</span>, 일반 종목은 저채도로 표시됩니다. 종목 클릭 시 <span className="text-yellow-300 font-bold">노란색</span>으로 단독 강조됩니다.
            </span>
          </div>
        </div>
      </div>

      {/* Main Content (Chart or Table) */}
      <div className="flex-1 bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 animate-pulse font-medium">
            시총 TOP 30 데이터를 로드하고 있습니다...
          </div>
        ) : !visibleDates.length || (visibleDates.length > 0 && visibleDates[0].rankings.length === 0) ? (
          <div className="flex-1 flex items-center justify-center text-amber-400 font-medium">
            표시할 시가총액 데이터가 없습니다. DB 동기화(DB Sync)를 확인해 주세요.
          </div>
        ) : view === "chart" ? (
          /* Stepped Line Chart View */
          <div ref={chartContainerRef} className="flex-1 p-4 flex flex-col min-h-[800px] select-none">
            <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <span>시총 TOP 30 계단식 순위 추적 차트 ({currentTfMeta.label})</span>
                  <span className="text-xs font-normal text-gray-500 font-mono">
                    ({startDate} ~ {endDate})
                  </span>
                </h4>
                <button
                  onClick={handleResetDateRange}
                  className="px-2 py-0.5 text-[10px] font-bold text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700 rounded border border-gray-700 transition-colors"
                  title="기본 조회 기간으로 초기화"
                >
                  기간 초기화
                </button>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span className="bg-blue-950/40 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded font-mono text-[10px]">
                  🔍 Ctrl + 휠: X축 기간 확대/축소
                </span>
                <span className="hidden md:inline text-gray-500">
                  신규진입(하늘색) | 5단계↑급등(초록색) | 하락(붉은색) | 일반(저채도)
                </span>
              </div>
            </div>

            {/* Tall Chart Canvas with Right End Labels Column */}
            <div className="w-full h-[760px] md:h-[820px] flex flex-row items-stretch bg-black/20 rounded-xl border border-gray-800/80 overflow-hidden">
              {/* Left Chart Area */}
              <div className="flex-1 min-w-0 h-full p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis
                      reversed
                      domain={[1, 30]}
                      ticks={[1, 5, 10, 15, 20, 25, 30]}
                      stroke="#6b7280"
                      tick={{ fontSize: 11 }}
                      label={{
                        value: "순위 (1=최상위)",
                        angle: -90,
                        position: "insideLeft",
                        style: { fill: "#6b7280", fontSize: 11 },
                      }}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    {allStocks.map((s) => {
                      const latestRank = latestStockRankMap.get(s.code);
                      const isTop10 = latestRank != null && latestRank <= 10;
                      const isSelected = activeCode === s.code;
                      const isHovered = hoveredCode === s.code;
                      const isFocused = isSelected || isHovered;

                      const isNewEntrant = s.new_entrant;
                      const rankDelta = s.rank_delta;
                      const isBigClimber = rankDelta != null && rankDelta >= 5;
                      const isRankDrop = rankDelta != null && rankDelta < 0;
                      const isMover = isNewEntrant || isBigClimber;

                      let baseColor = "#64748b";
                      if (isTop10 && latestRank) {
                        baseColor = TOP_10_COLORS[latestRank - 1] || "#3b82f6";
                      } else if (isNewEntrant) {
                        baseColor = "#38bdf8";
                      } else if (isBigClimber) {
                        baseColor = "#34d399";
                      } else if (isRankDrop) {
                        baseColor = "#f87171";
                      }

                      const strokeColor = isFocused ? "#facc15" : baseColor;
                      const strokeWidth = isFocused
                        ? 4.5
                        : isTop10
                        ? 2.8
                        : isMover
                        ? 3.0
                        : isRankDrop
                        ? 1.8
                        : 1.5;

                      const hasFocus = activeCode !== null || hoveredCode !== null;
                      const strokeOpacity = isFocused
                        ? 1.0
                        : hasFocus
                        ? 0.12
                        : isTop10
                        ? 0.95
                        : isMover
                        ? 1.0
                        : isRankDrop
                        ? 0.75
                        : 0.48;

                      return (
                        <Line
                          key={s.code}
                          type="stepAfter"
                          dataKey={s.code}
                          name={s.name}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeOpacity={strokeOpacity}
                          dot={
                            isFocused
                              ? { r: 4, fill: "#facc15", stroke: "#000", strokeWidth: 1 }
                              : isTop10 || isMover
                              ? { r: 2.5, fill: strokeColor }
                              : false
                          }
                          activeDot={{ r: 6, fill: "#facc15", stroke: "#fff", strokeWidth: 2 }}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Right End Labels Column (Direct 1~30 Ranks corresponding to the right edge of chart) */}
              <div className="w-44 md:w-52 shrink-0 border-l border-gray-800 bg-gray-950/60 p-2 flex flex-col justify-between overflow-y-auto custom-scrollbar select-none text-[11px]">
                <div className="text-[10px] font-bold text-gray-400 px-1 pb-1 mb-1 border-b border-gray-800 flex items-center justify-between">
                  <span>종료일 랭킹 (1~30위)</span>
                  <span className="font-mono text-[9px] text-gray-500">{endDate?.slice(5)}</span>
                </div>
                <div className="flex-1 flex flex-col justify-between gap-0.5">
                  {latestRankings.map((item) => {
                    const isTop10 = item.rank <= 10;
                    const isSelected = activeCode === item.code;
                    const isHovered = hoveredCode === item.code;
                    const isFocused = isSelected || isHovered;

                    const isNewEntrant = item.new_entrant;
                    const rankDelta = item.rank_delta;
                    const isBigClimber = rankDelta != null && rankDelta >= 5;
                    const isRankDrop = rankDelta != null && rankDelta < 0;

                    let tagColor = "#64748b";
                    if (isTop10) {
                      tagColor = TOP_10_COLORS[item.rank - 1] || "#3b82f6";
                    } else if (isNewEntrant) {
                      tagColor = "#38bdf8";
                    } else if (isBigClimber) {
                      tagColor = "#34d399";
                    } else if (isRankDrop) {
                      tagColor = "#f87171";
                    }

                    return (
                      <button
                        key={item.code}
                        onMouseEnter={() => setHoveredCode(item.code)}
                        onMouseLeave={() => setHoveredCode(null)}
                        onClick={() => handleToggleStock(item)}
                        className={clsx(
                          "flex items-center justify-between px-1.5 py-0.5 rounded transition-all text-left cursor-pointer",
                          isFocused
                            ? "bg-yellow-950/90 text-yellow-200 ring-1 ring-yellow-400 font-bold scale-[1.02] shadow-sm z-10"
                            : "hover:bg-gray-800/80 text-gray-300"
                        )}
                        title={`${item.rank}위 ${item.name} (${formatMarcap(item.marcap)})`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: isFocused ? "#facc15" : tagColor }}
                          />
                          <span className="font-mono font-bold text-[10px] w-4 text-right text-gray-400">
                            {item.rank}
                          </span>
                          <span className="truncate font-medium text-[11px] max-w-[75px] md:max-w-[95px]">
                            {item.name}
                          </span>
                        </div>
                        <div className="shrink-0 font-mono text-[9px]">
                          {isNewEntrant ? (
                            <span className="text-sky-400 font-bold">NEW</span>
                          ) : rankDelta != null && rankDelta > 0 ? (
                            <span className={clsx("font-bold", isBigClimber ? "text-emerald-400" : "text-emerald-500/80")}>
                              ▲{rankDelta}
                            </span>
                          ) : isRankDrop ? (
                            <span className="text-red-400 font-bold">▼{Math.abs(rankDelta!)}</span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Interactive Stock Chips Grid (Highlight Toggle) */}
            <div className="mt-4 pt-3 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400">
                  종목 선택 하이라이트 (TOP 10 고유 색상 및 Movers 분류)
                </span>
                {activeCode && (
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="text-[11px] text-yellow-400 hover:text-yellow-300 font-semibold underline"
                  >
                    하이라이트 해제
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                {allStocks.map((s) => {
                  const latestRank = latestStockRankMap.get(s.code);
                  const isTop10 = latestRank != null && latestRank <= 10;
                  const isSelected = activeCode === s.code;
                  const isHovered = hoveredCode === s.code;
                  const isFocused = isSelected || isHovered;

                  const isNewEntrant = s.new_entrant;
                  const rankDelta = s.rank_delta;
                  const isBigClimber = rankDelta != null && rankDelta >= 5;
                  const isRankDrop = rankDelta != null && rankDelta < 0;

                  let chipColor = "#64748b";
                  if (isTop10 && latestRank) {
                    chipColor = TOP_10_COLORS[latestRank - 1] || "#3b82f6";
                  } else if (isNewEntrant) {
                    chipColor = "#38bdf8";
                  } else if (isBigClimber) {
                    chipColor = "#34d399";
                  } else if (isRankDrop) {
                    chipColor = "#f87171";
                  }

                  return (
                    <button
                      key={s.code}
                      onMouseEnter={() => setHoveredCode(s.code)}
                      onMouseLeave={() => setHoveredCode(null)}
                      onClick={() => handleToggleStock(s)}
                      className={clsx(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer",
                        isFocused
                          ? "bg-yellow-950/80 border-yellow-400 text-yellow-200 ring-1 ring-yellow-400 scale-105 shadow-md shadow-yellow-400/20"
                          : isTop10
                          ? "bg-gray-800/80 border-gray-700 text-gray-200 hover:border-gray-500"
                          : isNewEntrant
                          ? "bg-sky-950/40 border-sky-800/60 text-sky-200 hover:border-sky-500"
                          : isBigClimber
                          ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200 hover:border-emerald-500"
                          : isRankDrop
                          ? "bg-red-950/30 border-red-900/40 text-red-300 hover:border-red-600"
                          : "bg-gray-900/50 border-gray-800 text-gray-400 hover:text-gray-300 hover:border-gray-700"
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: isFocused ? "#facc15" : chipColor }}
                      />
                      <span className="font-mono text-[10px] text-gray-500">#{s.rank}</span>
                      <span>{s.name}</span>
                      {isNewEntrant ? (
                        <span className="text-[9px] text-sky-400 font-bold font-mono">NEW</span>
                      ) : rankDelta != null && rankDelta > 0 ? (
                        <span className={clsx("text-[9px] font-bold font-mono", isBigClimber ? "text-emerald-400" : "text-gray-400")}>
                          ▲{rankDelta}
                        </span>
                      ) : isRankDrop ? (
                        <span className="text-[9px] text-red-400 font-bold font-mono">
                          ▼{Math.abs(rankDelta!)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>


        ) : (
          /* Table (WICS-style Ranking Matrix) View */
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className={clsx(
              "flex-1 overflow-auto custom-scrollbar flex",
              isDownRef.current ? "cursor-grabbing select-none" : "cursor-grab"
            )}
          >
            {/* Sticky Left Rank Column */}
            <div className="sticky left-0 z-20 bg-gray-900 border-r border-gray-800 flex-shrink-0 w-12 flex flex-col">
              <div
                style={{ width: "48px" }}
                className="h-12 border-b border-gray-800 flex items-center justify-center font-bold text-xs text-gray-400 bg-gray-900 sticky top-0 z-30"
              >
                순위
              </div>
              <div>
                {Array.from({ length: 30 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-[38px] border-b border-gray-800/40 flex items-center justify-center text-[10px] md:text-xs font-bold text-gray-500"
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Date / Period Columns */}
            <div className="flex flex-1">
              {visibleDates.map((dateObj) => {
                const isLastDate = dateObj.date === latestDate;
                return (
                  <div
                    key={dateObj.date}
                    style={{ width: `${columnWidths[dateObj.date] || baseColumnWidth}px` }}
                    className={clsx(
                      "flex-shrink-0 border-r border-gray-800/80 flex flex-col relative",
                      isLastDate && "bg-blue-950/5"
                    )}
                  >
                    {/* Date Column Header */}
                    <div
                      onClick={() => {
                        if (hasDraggedRef.current) return;
                        setSelectedCell(null);
                      }}
                      className={clsx(
                        "h-12 border-b border-gray-800 flex flex-col items-center justify-center px-4 font-bold text-sm bg-gray-900/80 sticky top-0 z-30 cursor-pointer hover:bg-gray-800/80 transition-colors",
                        isLastDate ? "text-blue-400" : "text-gray-300"
                      )}
                    >
                      <span className="font-mono text-xs">{dateObj.date}</span>
                      {isLastDate && (
                        <span className="text-[9px] text-blue-500 font-mono tracking-tighter uppercase">
                          ({currentTfMeta.colSuffix} / 색상 지정)
                        </span>
                      )}
                    </div>

                    {/* Rankings List */}
                    <div className="flex-1">
                      {dateObj.rankings.map((item) => {
                        const hasColor = stockColorMap.has(item.code);
                        const colorClass = hasColor
                          ? stockColorMap.get(item.code)
                          : "bg-gray-900/30 border border-gray-800/50 text-gray-300 hover:border-gray-700";
                        const isMatch = activeCode === item.code;
                        const isExactCell = selectedCell?.code === item.code && selectedCell?.date === dateObj.date;
                        const hasActiveSelection = activeCode !== null;
                        const isRising3D = risingStocks3D.has(item.code);
                        const isRising2D = risingStocks2D.has(item.code);

                        return (
                          <div
                            key={item.code}
                            onClick={() => {
                              if (hasDraggedRef.current) return;
                              handleCellClick(item, dateObj.date);
                            }}
                            className={clsx(
                              "h-[38px] px-2 py-0.5 flex flex-col justify-center border-b border-gray-800/30 cursor-pointer select-none transition-all duration-200",
                              colorClass,
                              isMatch &&
                                "ring-2 ring-yellow-400 border-yellow-400 scale-[1.02] shadow-lg shadow-yellow-400/20 z-10 opacity-100",
                              isExactCell && "ring-2 ring-white border-white scale-[1.04] z-20 shadow-white/30",
                              isRising3D &&
                                !hasActiveSelection &&
                                "ring-2 ring-emerald-500 border-emerald-500 scale-[1.01] shadow-md shadow-emerald-500/10 z-10",
                              isRising2D &&
                                !hasActiveSelection &&
                                "ring-2 ring-blue-500/80 border-blue-500 scale-[1.01] shadow-md shadow-blue-500/10 z-10",
                              hasActiveSelection && !isMatch && "opacity-25"
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center min-w-0 flex-1 mr-1">
                                <span className="font-bold text-[10px] md:text-xs truncate">
                                  <StockNameLink name={item.name} />
                                </span>
                                {isRising3D && (
                                  <span
                                    className="ml-1 text-[7px] md:text-[8px] bg-emerald-500 text-white px-0.5 py-0.2 rounded font-bold whitespace-nowrap leading-none shrink-0"
                                    title={`${currentTfMeta.guideBadge3} 순위 상승`}
                                  >
                                    {currentTfMeta.badge3}
                                  </span>
                                )}
                                {isRising2D && (
                                  <span
                                    className="ml-1 text-[7px] md:text-[8px] bg-blue-500 text-white px-0.5 py-0.2 rounded font-bold whitespace-nowrap leading-none shrink-0"
                                    title={`${currentTfMeta.guideBadge2} 순위 상승`}
                                  >
                                    {currentTfMeta.badge2}
                                  </span>
                                )}
                                {item.new_entrant && (
                                  <span
                                    className="ml-1 text-[7px] md:text-[8px] bg-emerald-700/80 text-emerald-200 border border-emerald-500/50 px-1 py-0.2 rounded font-bold whitespace-nowrap leading-none shrink-0"
                                    title="신규 진입"
                                  >
                                    신규진입
                                  </span>
                                )}
                              </div>
                              <span className="text-[8px] md:text-[10px] text-gray-500 font-semibold font-mono shrink-0">
                                #{item.rank}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0 text-[8px] md:text-[9px] font-mono text-gray-400">
                              <span>{formatMarcap(item.marcap)}</span>
                              {item.new_entrant ? (
                                <span className="text-emerald-400 font-bold text-[8px]">NEW</span>
                              ) : item.rank_delta != null && item.rank_delta > 0 ? (
                                <span className="text-emerald-400 font-bold">▲{item.rank_delta}</span>
                              ) : item.rank_delta != null && item.rank_delta < 0 ? (
                                <span className="text-red-400 font-bold">▼{Math.abs(item.rank_delta)}</span>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {/* Filler rows if fewer than 30 items */}
                      {dateObj.rankings.length < 30 &&
                        Array.from({ length: 30 - dateObj.rankings.length }).map((_, idx) => (
                          <div key={idx} className="h-[38px] border-b border-gray-800/30 bg-gray-900/10" />
                        ))}
                    </div>

                    {/* Column Resize Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(dateObj.date, e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/80 z-35 hover:w-1.5 transition-all"
                      title="드래그하여 너비 조절"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend & Instructions */}
      <div className="p-6 bg-gray-900/40 border border-gray-800 rounded-2xl">
        <h4 className="text-blue-400 font-bold text-xs mb-3 font-mono tracking-tighter uppercase">
          MarketCap TOP 30 Tracking Guide
        </h4>
        <div className="space-y-2 text-xs text-gray-400">
          <p>
            • <strong className="text-emerald-400">3연속 순위 상승 ({currentTfMeta.badge3}):</strong> 최근 3개 기간 동안 순위가 연속으로 상승한 종목은 초록색 테두리와 `{currentTfMeta.badge3}` 배지가 표시됩니다.
          </p>
          <p>
            • <strong className="text-blue-400">2연속 순위 상승 ({currentTfMeta.badge2}):</strong> 최근 2개 기간 동안 순위가 연속으로 상승한 종목은 파란색 테두리와 `{currentTfMeta.badge2}` 배지가 표시됩니다.
          </p>
          <p>
            • <strong className="text-gray-200">색상 지정 규칙:</strong> 맨 마지막 기간(종료일/기준일)의 상위 10개 종목은 각각 고유한 10가지 색상을 가집니다. 과거 기간의 동일 종목에도 같은 색상이 적용되어 순위 변동 추이를 시각적으로 직관적이게 추적할 수 있습니다.
          </p>
          <p>
            • <strong className="text-gray-200">하이라이트 & PiP 미니 패널:</strong> 차트 하단의 종목 칩이나 표의 셀을 클릭하면 선택한 종목이 노란색으로 하이라이트되며(클릭 시 토글), 화면 우측 하단 PiP 패널에 해당 시점의 상세 시가총액과 <strong>계단식 순위 차트</strong>가 표시됩니다.
          </p>
          <p>
            • <strong className="text-gray-200">계단식 차트(Step-After):</strong> 차트 뷰는 순위의 불연속적 이동 특성을 가장 정확히 나타내기 위해 계단식(Step) 꺾은선으로 순위(1~30위)를 시각화합니다.
          </p>
        </div>
      </div>

      {/* Floating PiP Mini Chart & Detail Widget */}
      {selectedCell && (
        <div
          className={clsx(
            "fixed z-40 transition-all duration-300 shadow-2xl backdrop-blur-md rounded-2xl border border-gray-700 bg-gray-900/95 overflow-hidden ring-1 ring-white/10 animate-fade-in",
            "bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6",
            isChartMinimized ? "w-auto sm:w-80 p-3" : "w-auto sm:w-[600px] max-w-[calc(100vw-1.5rem)] p-3 sm:p-3.5"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-blue-400 bg-blue-900/40 border border-blue-700/50 px-1.5 py-0.5 rounded font-mono tracking-wider uppercase shrink-0">
                PiP 상세 & 차트
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                <StockNameLink name={selectedCell.name} />
              </h3>
              <span className="text-[10px] sm:text-[11px] text-gray-400 font-mono shrink-0">
                {selectedCell.date}
              </span>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsChartMinimized((prev) => !prev)}
                className="px-1.5 py-0.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-xs font-mono"
                title={isChartMinimized ? "차트 펼치기" : "차트 최소화"}
              >
                {isChartMinimized ? "□" : "─"}
              </button>
              <button
                onClick={() => setSelectedCell(null)}
                className="px-1.5 py-0.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors text-xs font-mono"
                title="차트 닫기"
              >
                ✕
              </button>
            </div>
          </div>

          {!isChartMinimized && (
            <div className="mt-2.5 flex flex-row gap-2.5 sm:gap-3 items-stretch">
              {/* Left Column: Stock Details */}
              <div className="w-[140px] sm:w-[190px] shrink-0 flex flex-col justify-between space-y-1.5">
                <div className="bg-black/40 p-2 rounded-lg border border-gray-800/80">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="text-gray-400">순위</span>
                    <span className="text-[10px] text-blue-400 font-bold font-mono">
                      #{selectedCell.item.rank}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs font-mono">
                    <span className="text-gray-400">전일대비</span>
                    {selectedCell.item.new_entrant ? (
                      <span className="text-emerald-400 font-bold text-[10px] bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/50">
                        신규진입
                      </span>
                    ) : selectedCell.item.rank_delta != null && selectedCell.item.rank_delta > 0 ? (
                      <span className="text-emerald-400 font-bold">▲ {selectedCell.item.rank_delta}</span>
                    ) : selectedCell.item.rank_delta != null && selectedCell.item.rank_delta < 0 ? (
                      <span className="text-red-400 font-bold">▼ {Math.abs(selectedCell.item.rank_delta)}</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </div>
                </div>

                <div className="bg-black/40 p-2 rounded-lg border border-gray-800/80">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-400">
                    <span>시가총액</span>
                  </div>
                  <div className="text-sm font-extrabold font-mono text-gray-200 mt-0.5">
                    {formatMarcap(selectedCell.item.marcap)}
                  </div>
                  <div className="text-[9px] text-gray-500 font-mono mt-1 pt-1 border-t border-gray-800/60 flex justify-between">
                    <span>시장</span>
                    <span className="text-gray-300 font-bold">
                      {selectedCell.item.market === "KQ" ? "KOSDAQ" : selectedCell.item.market}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Mini Stepped Rank Chart */}
              <div className="flex-1 min-w-0 bg-black/25 p-2 rounded-lg border border-gray-800/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                  <span className="font-bold">순위 변동 추이 (계단식)</span>
                  <span className="font-mono text-[9px] text-gray-500">1위~30위</span>
                </div>
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pipChartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid stroke="#1f2937" strokeDasharray="2 2" />
                      <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 8 }} />
                      <YAxis
                        reversed
                        domain={[1, 30]}
                        ticks={[1, 10, 20, 30]}
                        stroke="#6b7280"
                        tick={{ fontSize: 8 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                        formatter={(value: any) => [`#${value}위`, "순위"]}
                      />
                      <Line
                        type="stepAfter"
                        dataKey="rank"
                        stroke="#facc15"
                        strokeWidth={2.5}
                        dot={{ r: 2, fill: "#facc15" }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}