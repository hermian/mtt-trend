"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useWicsMonths, useWicsRankings, useWicsWeeks, useWicsWeeklyRankings } from "@/hooks/useWicsData";
import { WicsRankingItem } from "@/lib/api";
import { StockNameLink } from "@/components/StockNameLink";
import { WicsIndexChart } from "./WicsIndexChart";
import clsx from "clsx";

const TOP_10_COLORS = [
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

function endOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

function isoWeekToRange(yw: string): { start: string; end: string } {
  const match = yw.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return { start: yw, end: yw };
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return {
    start: monday.toISOString().slice(0, 10),
    end: friday.toISOString().slice(0, 10),
  };
}

interface SelectedCellState {
  wics: string;
  month: string;
  item: WicsRankingItem;
}

export const WicsRankingPanel: React.FC = () => {
  const { data: months, isLoading: monthsLoading, error: monthsError } = useWicsMonths();
  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");

  const { data: weeks, isLoading: weeksLoading, error: weeksError } = useWicsWeeks();
  const [startWeek, setStartWeek] = useState<string>("");
  const [endWeek, setEndWeek] = useState<string>("");

  const [viewMode, setViewMode] = useState<"monthly" | "weekly">("monthly");
  const [rankType, setRankType] = useState<"MC" | "EW">("MC");
  const [selectedCell, setSelectedCell] = useState<SelectedCellState | null>(null);
  const [isChartMinimized, setIsChartMinimized] = useState<boolean>(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [baseColumnWidth, setBaseColumnWidth] = useState<number>(150);

  const activeWics = selectedCell?.wics ?? null;

  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const clickStartCoord = useRef({ x: 0, y: 0 });
  const isResizingRef = useRef(false);

  const formatMarcap = (val?: number) => {
    if (!val) return "";
    const trillion = val / 1_000_000_000_000;
    if (trillion >= 1) {
      return `${trillion.toFixed(1)}조원`;
    }
    const billion = val / 100_000_000;
    return `${billion.toLocaleString(undefined, { maximumFractionDigits: 0 })}억원`;
  };

  // Resize handler
  const handleResizeStart = (ym: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = columnWidths[ym] || baseColumnWidth;

    const handleMouseMoveWindow = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(100, Math.min(500, startWidth + deltaX));
      setColumnWidths((prev) => ({
        ...prev,
        [ym]: newWidth,
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
    if (e.button !== 0) return; // Only left click
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

  // Set default months once months are loaded
  useEffect(() => {
    if (months && months.length > 0) {
      const latest = months[months.length - 1];
      const defaultStartIdx = Math.max(0, months.length - 12);
      const defaultStart = months[defaultStartIdx];
      setStartMonth(defaultStart);
      setEndMonth(latest);
    }
  }, [months]);

  // Set default weeks once weeks are loaded
  useEffect(() => {
    if (weeks && weeks.length > 0) {
      const latest = weeks[weeks.length - 1];
      const defaultStartIdx = Math.max(0, weeks.length - 24);
      const defaultStart = weeks[defaultStartIdx];
      setStartWeek(defaultStart);
      setEndWeek(latest);
    }
  }, [weeks]);

  // Column width reset on mode change
  useEffect(() => {
    setBaseColumnWidth(150);
    setColumnWidths({});
  }, [viewMode]);

  // API fetch start months
  const fetchStartMonth = useMemo(() => {
    if (!months || !startMonth || !endMonth) return startMonth;
    const startIdx = months.indexOf(startMonth);
    const endIdx = months.indexOf(endMonth);
    if (startIdx === -1 || endIdx === -1) return startMonth;
    const neededStartIdx = Math.max(0, endIdx - 2);
    const actualStartIdx = Math.min(startIdx, neededStartIdx);
    return months[actualStartIdx];
  }, [months, startMonth, endMonth]);

  // API fetch start weeks
  const fetchStartWeek = useMemo(() => {
    if (!weeks || !startWeek || !endWeek) return startWeek;
    const startIdx = weeks.indexOf(startWeek);
    const endIdx = weeks.indexOf(endWeek);
    if (startIdx === -1 || endIdx === -1) return startWeek;
    const neededStartIdx = Math.max(0, endIdx - 2);
    const actualStartIdx = Math.min(startIdx, neededStartIdx);
    return weeks[actualStartIdx];
  }, [weeks, startWeek, endWeek]);

  // Data fetching
  const { data: rankingsData, isLoading: rankingsLoading, error: rankingsError } = useWicsRankings(
    fetchStartMonth || undefined,
    endMonth || undefined
  );

  const { data: weeklyRankingsData, isLoading: weeklyRankingsLoading, error: weeklyRankingsError } = useWicsWeeklyRankings(
    fetchStartWeek || undefined,
    endWeek || undefined
  );

  // Active view abstraction
  const activeData = useMemo(() => {
    return viewMode === "monthly" ? rankingsData : weeklyRankingsData;
  }, [viewMode, rankingsData, weeklyRankingsData]);

  const activeStart = useMemo(() => {
    return viewMode === "monthly" ? startMonth : startWeek;
  }, [viewMode, startMonth, startWeek]);

  const activeEnd = useMemo(() => {
    return viewMode === "monthly" ? endMonth : endWeek;
  }, [viewMode, endMonth, endWeek]);

  const activePeriodsList = useMemo(() => {
    return viewMode === "monthly" ? months : weeks;
  }, [viewMode, months, weeks]);

  // Selectable drop down lists
  const selectableEndPeriods = useMemo(() => {
    const list = activePeriodsList || [];
    if (!activeStart) return list;
    return list.filter((m) => m >= activeStart);
  }, [activePeriodsList, activeStart]);

  const selectableStartPeriods = useMemo(() => {
    const list = activePeriodsList || [];
    if (!activeEnd) return list;
    return list.filter((m) => m <= activeEnd);
  }, [activePeriodsList, activeEnd]);

  // Handle select changes
  const handleStartPeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (viewMode === "monthly") {
      setStartMonth(val);
      if (endMonth && val > endMonth) setEndMonth(val);
    } else {
      setStartWeek(val);
      if (endWeek && val > endWeek) setEndWeek(val);
    }
  };

  const handleEndPeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (viewMode === "monthly") {
      setEndMonth(val);
      if (startMonth && val < startMonth) setStartMonth(val);
    } else {
      setEndWeek(val);
      if (startWeek && val < startWeek) setStartWeek(val);
    }
  };

  // Determine top 10 WICS sectors of the last period to assign colors
  const wicsColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    if (!activeData || activeData.months.length === 0) return colorMap;

    const lastPeriodObj = activeData.months[activeData.months.length - 1];
    if (!lastPeriodObj || !lastPeriodObj.rankings) return colorMap;

    const sortedLastRankings = [...lastPeriodObj.rankings].sort((a, b) => {
      const rA = rankType === "MC" ? a.Rank_MC : a.Rank_EW;
      const rB = rankType === "MC" ? b.Rank_MC : b.Rank_EW;
      return rA - rB;
    });

    const top10 = sortedLastRankings.slice(0, 10);
    top10.forEach((item, index) => {
      if (item.WICS) {
        colorMap.set(item.WICS, TOP_10_COLORS[index]);
      }
    });

    return colorMap;
  }, [activeData, rankType]);

  // Sorted rankings for all periods in range
  const processedMonths = useMemo(() => {
    if (!activeData) return [];
    return activeData.months.map((mObj) => {
      const sorted = [...mObj.rankings].sort((a, b) => {
        const rA = rankType === "MC" ? a.Rank_MC : a.Rank_EW;
        const rB = rankType === "MC" ? b.Rank_MC : b.Rank_EW;
        return rA - rB;
      });
      return {
        YearMonth: mObj.YearMonth, // 'YearMonth' field contains YearWeek if weekly view
        rankings: sorted,
      };
    });
  }, [activeData, rankType]);

  // Filter processedMonths to only show the user's selected range in the UI
  const visibleMonths = useMemo(() => {
    if (!processedMonths || !activeStart || !activeEnd) return processedMonths;
    return processedMonths.filter((m) => m.YearMonth >= activeStart && m.YearMonth <= activeEnd);
  }, [processedMonths, activeStart, activeEnd]);

  // Identify WICS sectors with 3 consecutive increases (3M / 3W) ending in the latest period
  const risingSectors3M = useMemo(() => {
    const sectors = new Set<string>();
    if (!processedMonths || processedMonths.length < 3) return sectors;

    const latestPeriodObj = processedMonths[processedMonths.length - 1];
    if (!latestPeriodObj || !latestPeriodObj.rankings) return sectors;

    const targetPeriods = processedMonths.slice(-3);

    for (const item of latestPeriodObj.rankings) {
      const wicsName = item.WICS;
      const rets: number[] = [];
      let valid = true;

      for (const m of targetPeriods) {
        const rItem = m.rankings.find((r) => r.WICS === wicsName);
        if (!rItem) {
          valid = false;
          break;
        }
        const ret = rankType === "MC" ? rItem.MC_12m_Return : rItem.EW_12m_Return;
        if (ret === undefined || ret === null) {
          valid = false;
          break;
        }
        rets.push(ret);
      }

      if (valid && rets.length === 3) {
        if (rets[2] > rets[1] && rets[1] > rets[0]) {
          sectors.add(wicsName);
        }
      }
    }

    return sectors;
  }, [processedMonths, rankType]);

  // Identify WICS sectors with 2 consecutive increases (2M / 2W) ending in the latest period
  const risingSectors2M = useMemo(() => {
    const sectors = new Set<string>();
    if (!processedMonths || processedMonths.length < 2) return sectors;

    const latestPeriodObj = processedMonths[processedMonths.length - 1];
    if (!latestPeriodObj || !latestPeriodObj.rankings) return sectors;

    const targetPeriods = processedMonths.slice(-2);

    for (const item of latestPeriodObj.rankings) {
      const wicsName = item.WICS;
      if (risingSectors3M.has(wicsName)) continue;

      const rets: number[] = [];
      let valid = true;

      for (const m of targetPeriods) {
        const rItem = m.rankings.find((r) => r.WICS === wicsName);
        if (!rItem) {
          valid = false;
          break;
        }
        const ret = rankType === "MC" ? rItem.MC_12m_Return : rItem.EW_12m_Return;
        if (ret === undefined || ret === null) {
          valid = false;
          break;
        }
        rets.push(ret);
      }

      if (valid && rets.length === 2) {
        if (rets[1] > rets[0]) {
          sectors.add(wicsName);
        }
      }
    }

    return sectors;
  }, [processedMonths, rankType, risingSectors3M]);

  // Auto-scroll to the far right on load or when data changes
  useEffect(() => {
    if (containerRef.current && visibleMonths.length > 0) {
      const container = containerRef.current;
      const timer = setTimeout(() => {
        container.scrollLeft = container.scrollWidth - container.clientWidth;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visibleMonths]);

  const handleCellClick = (item: WicsRankingItem, month: string) => {
    if (selectedCell && selectedCell.wics === item.WICS && selectedCell.month === month) {
      setSelectedCell(null);
    } else {
      setSelectedCell({
        wics: item.WICS,
        month,
        item,
      });
      setIsChartMinimized(false);
    }
  };

  const renderReturn = (val?: number) => {
    if (val === undefined || val === null) return "-";
    const percent = val * 100;
    const isPositive = percent > 0;
    return (
      <span className={clsx("font-bold text-[8px] md:text-[10px]", isPositive ? "text-red-400" : percent < 0 ? "text-blue-400" : "text-gray-400")}>
        {isPositive ? `+${percent.toFixed(1)}%` : `${percent.toFixed(1)}%`}
      </span>
    );
  };

  const renderTop2Share = (val?: number) => {
    if (val === undefined || val === null) return "";
    const percent = val * 100;
    return <span className="text-gray-500 text-[8px] md:text-[9px] ml-1">top2={percent.toFixed(0)}%</span>;
  };

  if (monthsError || rankingsError || weeksError || weeklyRankingsError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900/40 border border-red-900/30 rounded-2xl">
        <span className="text-red-500 text-3xl mb-2">⚠️</span>
        <p className="text-gray-300 font-medium">데이터 로드 중 에러가 발생했습니다.</p>
        <p className="text-gray-500 text-xs mt-1">
          {(monthsError || rankingsError || weeksError || weeklyRankingsError)?.toString()}
        </p>
      </div>
    );
  }

  const activeLoading = viewMode === "monthly" ? monthsLoading : weeksLoading;
  const activeRankingsLoading = viewMode === "monthly" ? rankingsLoading : weeklyRankingsLoading;

  const indexDateRange = useMemo(() => {
    if (viewMode === "monthly") {
      if (!startMonth || !endMonth) return { start: undefined, end: undefined };
      return { start: `${startMonth}-01`, end: endOfMonth(endMonth) };
    }
    if (!startWeek || !endWeek) return { start: undefined, end: undefined };
    return {
      start: isoWeekToRange(startWeek).start,
      end: isoWeekToRange(endWeek).end,
    };
  }, [viewMode, startMonth, endMonth, startWeek, endWeek]);

  return (
    <div ref={outerRef} className="flex flex-col h-full space-y-6 relative">
      {/* Filters & Header Controls */}
      <div className="flex flex-col bg-gray-900/60 p-4 rounded-xl border border-gray-800 gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-black/30 p-1 rounded-lg border border-gray-800 self-start md:self-auto shrink-0">
              <button
                onClick={() => setViewMode("monthly")}
                className={clsx(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  viewMode === "monthly" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                )}
              >
                월간 랭킹
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={clsx(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  viewMode === "weekly" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                )}
              >
                주간 랭킹
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">
                {viewMode === "monthly" ? "시작월" : "시작주"}
              </span>
              {activeLoading ? (
                <div className="h-9 w-24 bg-gray-800 rounded animate-pulse" />
              ) : (
                <select
                  value={viewMode === "monthly" ? startMonth : startWeek}
                  onChange={handleStartPeriodChange}
                  className="bg-gray-800 text-xs border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer text-white max-h-60"
                >
                  {selectableStartPeriods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">
                {viewMode === "monthly" ? "종료월" : "종료주"}
              </span>
              {activeLoading ? (
                <div className="h-9 w-24 bg-gray-800 rounded animate-pulse" />
              ) : (
                <select
                  value={viewMode === "monthly" ? endMonth : endWeek}
                  onChange={handleEndPeriodChange}
                  className="bg-gray-800 text-xs border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer text-white max-h-60"
                >
                  {selectableEndPeriods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Column Width Slider & Preset Controls */}
            <div className="flex flex-wrap items-center gap-3 bg-black/20 px-3 py-1.5 rounded-lg border border-gray-800/80">
              <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">열 너비</span>
              <input
                type="range"
                min="100"
                max="300"
                value={baseColumnWidth}
                onChange={(e) => {
                  setBaseColumnWidth(Number(e.target.value));
                  setColumnWidths({}); // Reset individual column overrides for consistency when adjusting slider
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
          </div>

          {/* Rank Type Toggle */}
          <div className="flex items-center bg-black/30 p-1 rounded-lg border border-gray-800 self-start md:self-auto">
            <button
              onClick={() => setRankType("MC")}
              className={clsx(
                "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                rankType === "MC" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
              )}
            >
              시가총액 가중 (MC)
            </button>
            <button
              onClick={() => setRankType("EW")}
              className={clsx(
                "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                rankType === "EW" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
              )}
            >
              동등 가중 (EW)
            </button>
          </div>
        </div>

        {/* Tip Guidance Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-950/20 px-3.5 py-2 rounded-lg border border-blue-900/30 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <span className="text-sm">💡</span>
            <span>
              테이블의 특정 셀을 클릭하면 화면 우측 하단 <strong>PiP 미니 패널</strong>에서 해당 섹터의 <strong>12M 수익률, Top 2 종목 상세 및 일별 지수 차트</strong>를 스크롤과 무관하게 실시간으로 확인할 수 있습니다.
            </span>
          </div>
        </div>
      </div>

      {/* Main Ranking Grid */}
      <div className="flex-1 bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
        {activeRankingsLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 animate-pulse font-medium">
            WICS 랭킹 데이터를 로드하고 있습니다...
          </div>
        ) : visibleMonths.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 font-medium">
            표시할 데이터가 없습니다. {viewMode === "monthly" ? "다른 월 범위를 선택해 보세요." : "다른 주 범위를 선택해 보세요."}
          </div>
        ) : (
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
                {Array.from({ length: 78 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-[35px] border-b border-gray-800/40 flex items-center justify-center text-[10px] md:text-xs font-bold text-gray-500"
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly / Weekly Columns */}
            <div className="flex flex-1">
              {visibleMonths.map((monthObj) => {
                const isLastMonth = monthObj.YearMonth === activeEnd;
                return (
                  <div
                    key={monthObj.YearMonth}
                    style={{ width: `${columnWidths[monthObj.YearMonth] || baseColumnWidth}px` }}
                    className={clsx(
                      "flex-shrink-0 border-r border-gray-800/80 flex flex-col relative",
                      isLastMonth && "bg-blue-950/5"
                    )}
                  >
                    {/* Period Header */}
                    <div
                      onClick={() => {
                        if (hasDraggedRef.current) return;
                        setSelectedCell(null);
                      }}
                      className={clsx(
                        "h-12 border-b border-gray-800 flex flex-col items-center justify-center px-4 font-bold text-sm bg-gray-900/80 sticky top-0 z-30 cursor-pointer hover:bg-gray-800/80 transition-colors",
                        isLastMonth ? "text-blue-400" : "text-gray-300"
                      )}
                    >
                      <span>{monthObj.YearMonth}</span>
                      {isLastMonth && (
                        <span className="text-[9px] text-blue-500 font-mono tracking-tighter uppercase">
                          {viewMode === "monthly" ? "(기준월 / 색상 지정)" : "(기준주 / 색상 지정)"}
                        </span>
                      )}
                    </div>

                    {/* Rankings List */}
                    <div className="flex-1">
                      {monthObj.rankings.map((item) => {
                        const hasColor = wicsColorMap.has(item.WICS);
                        const colorClass = hasColor ? wicsColorMap.get(item.WICS) : "bg-gray-900/30 border border-gray-800/50 text-gray-300 hover:border-gray-700";
                        const isMatch = activeWics === item.WICS;
                        const isExactCell = selectedCell?.wics === item.WICS && selectedCell?.month === monthObj.YearMonth;
                        const hasActiveSelection = activeWics !== null;
                        const isRising3M = risingSectors3M.has(item.WICS);
                        const isRising2M = risingSectors2M.has(item.WICS);

                        return (
                          <div
                            key={item.WICS}
                            onClick={() => {
                              if (hasDraggedRef.current) return;
                              handleCellClick(item, monthObj.YearMonth);
                            }}
                            className={clsx(
                              "h-[35px] px-2 py-0.5 flex flex-col justify-center border-b border-gray-800/30 cursor-pointer select-none transition-all duration-200",
                              colorClass,
                              isMatch && "ring-2 ring-yellow-400 border-yellow-400 scale-[1.02] shadow-lg shadow-yellow-400/20 z-10 opacity-100",
                              isExactCell && "ring-2 ring-white border-white scale-[1.04] z-20 shadow-white/30",
                              isRising3M && !hasActiveSelection && "ring-2 ring-emerald-500 border-emerald-500 scale-[1.01] shadow-md shadow-emerald-500/10 z-10",
                              isRising2M && !hasActiveSelection && "ring-2 ring-blue-500/80 border-blue-500 scale-[1.01] shadow-md shadow-blue-500/10 z-10",
                              hasActiveSelection && !isMatch && "opacity-25"
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center min-w-0 flex-1 mr-1">
                                <span className="font-bold text-[10px] md:text-xs truncate">
                                  {item.WICS}
                                </span>
                                {isRising3M && (
                                  <span className="ml-1 text-[7px] md:text-[8px] bg-emerald-500 text-white px-0.5 py-0.2 rounded font-bold whitespace-nowrap leading-none shrink-0" title={viewMode === "monthly" ? "3달 연속 수익률 상승" : "3주 연속 수익률 상승"}>
                                    {viewMode === "monthly" ? "3M▲" : "3W▲"}
                                  </span>
                                )}
                                {isRising2M && (
                                  <span className="ml-1 text-[7px] md:text-[8px] bg-blue-500 text-white px-0.5 py-0.2 rounded font-bold whitespace-nowrap leading-none shrink-0" title={viewMode === "monthly" ? "2달 연속 수익률 상승" : "2주 연속 수익률 상승"}>
                                    {viewMode === "monthly" ? "2M▲" : "2W▲"}
                                  </span>
                                )}
                              </div>
                              <span className="text-[8px] md:text-[10px] text-gray-500 font-semibold font-mono shrink-0">
                                #{rankType === "MC" ? item.Rank_MC : item.Rank_EW}
                              </span>
                            </div>
                            <div className="flex items-center justify-start mt-0">
                              {renderReturn(rankType === "MC" ? item.MC_12m_Return : item.EW_12m_Return)}
                              {renderTop2Share(item.Top2_Share)}
                            </div>
                          </div>
                        );
                      })}
                      {/* Handle cases if there are fewer than 78 sectors in data */}
                      {monthObj.rankings.length < 78 &&
                        Array.from({ length: 78 - monthObj.rankings.length }).map((_, idx) => (
                          <div
                            key={idx}
                            className="h-[35px] border-b border-gray-800/30 bg-gray-900/10"
                          />
                        ))}
                    </div>
                    {/* Column Resize Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(monthObj.YearMonth, e)}
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
        <h4 className="text-blue-400 font-bold text-xs mb-3 font-mono tracking-tighter uppercase">WICS Ranking Guide</h4>
        <div className="space-y-2 text-xs text-gray-400">
          <p>
            • <strong className="text-emerald-400">
              {viewMode === "monthly" ? "3달 연속 상승 하이라이트 (3M▲)" : "3주 연속 상승 하이라이트 (3W▲)"}:
            </strong>{" "}
            최근 {viewMode === "monthly" ? "3달(3개월 데이터 기준)" : "3주(3주 데이터 기준)"} 동안 수익률이 연속으로 상승한 종목은 초기 로딩 시 초록색 테두리와 `{viewMode === "monthly" ? "3M▲" : "3W▲"}` 배지가 표시됩니다.
          </p>
          <p>
            • <strong className="text-blue-400">
              {viewMode === "monthly" ? "2달 연속 상승 하이라이트 (2M▲)" : "2주 연속 상승 하이라이트 (2W▲)"}:
            </strong>{" "}
            최근 {viewMode === "monthly" ? "2달(2개월 데이터 기준)" : "2주(2주 데이터 기준)"} 동안 수익률이 연속으로 상승한 종목은 초기 로딩 시 파란색 테두리와 `{viewMode === "monthly" ? "2M▲" : "2W▲"}` 배지가 표시됩니다.
          </p>
          <p>
            • <strong className="text-gray-200">색상 지정 규칙:</strong> 맨 마지막 {viewMode === "monthly" ? "월(종료월)" : "주(종료주)"}의 상위 10개 WICS 섹터는 각각 서로 다른 10가지 색상을 가집니다. 이전 {viewMode === "monthly" ? "월" : "주"}의 동일 WICS 섹터에도 같은 색상이 적용되어 순위 변동 추이를 시각적으로 쉽게 추적할 수 있습니다.
          </p>
          <p>
            • <strong className="text-gray-200">하이라이트 & PiP 미니 패널:</strong> 특정 Cell을 클릭하면 선택한 WICS 섹터가 전체 {viewMode === "monthly" ? "월" : "주"}에서 하이라이트 되며, 화면 우측 하단에 해당 시점의 상세 수익률, Top 2 종목 및 일별 지수 차트가 표시됩니다. 다시 클릭하면 닫힙니다.
          </p>
          <p>
            • <strong className="text-gray-200">가중치 유형:</strong> <strong className="text-gray-300">시가총액 가중(MC)</strong>은 각 섹터 내 대형주 위주 성과를 반영하고, <strong className="text-gray-300">동등 가중(EW)</strong>은 섹터 내 개별 종목들의 평균 성과를 균등하게 반영합니다.
          </p>
        </div>
      </div>

      {/* Floating PiP Mini Chart & Detail Widget */}
      {selectedCell && (
        <div
          className={clsx(
            "fixed z-40 transition-all duration-300 shadow-2xl backdrop-blur-md rounded-2xl border border-gray-700 bg-gray-900/95 overflow-hidden ring-1 ring-white/10 animate-fade-in",
            "bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6",
            isChartMinimized ? "w-auto sm:w-80 p-3" : "w-auto sm:w-[640px] max-w-[calc(100vw-1.5rem)] p-3 sm:p-3.5"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-blue-400 bg-blue-900/40 border border-blue-700/50 px-1.5 py-0.5 rounded font-mono tracking-wider uppercase shrink-0">
                PiP 상세 & 차트
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">{selectedCell.wics}</h3>
              <span className="text-[10px] sm:text-[11px] text-gray-400 font-mono shrink-0">
                {selectedCell.month}
              </span>
            </div>

            {/* Weight Switcher & Window Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center bg-black/40 p-0.5 rounded border border-gray-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setRankType("MC")}
                  className={clsx(
                    "px-1.5 py-0.5 rounded font-bold transition-all",
                    rankType === "MC" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  시총
                </button>
                <button
                  type="button"
                  onClick={() => setRankType("EW")}
                  className={clsx(
                    "px-1.5 py-0.5 rounded font-bold transition-all",
                    rankType === "EW" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  동일
                </button>
              </div>
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
              {/* Left Column: Sector 12M Return + Top 2 Stocks */}
              <div className="w-[140px] sm:w-[210px] shrink-0 flex flex-col justify-between space-y-1.5">
                {/* Sector 12M Return & Top2 Share */}
                <div className="bg-black/40 p-1.5 sm:p-2 rounded-lg border border-gray-800/80">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="text-gray-400">12M 수익률</span>
                    <span className="text-[9px] text-gray-500 font-mono">
                      #{rankType === "MC" ? selectedCell.item.Rank_MC : selectedCell.item.Rank_EW}
                    </span>
                  </div>
                  <div className={clsx(
                    "font-bold font-mono text-xs sm:text-sm mt-0.5",
                    ((rankType === "MC" ? selectedCell.item.MC_12m_Return : selectedCell.item.EW_12m_Return) ?? 0) > 0
                      ? "text-red-400"
                      : ((rankType === "MC" ? selectedCell.item.MC_12m_Return : selectedCell.item.EW_12m_Return) ?? 0) < 0
                        ? "text-blue-400"
                        : "text-gray-400"
                  )}>
                    {(() => {
                      const ret = rankType === "MC" ? selectedCell.item.MC_12m_Return : selectedCell.item.EW_12m_Return;
                      if (ret === undefined || ret === null) return "-";
                      const pct = ret * 100;
                      return pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
                    })()}
                  </div>
                  {selectedCell.item.Top2_Share !== undefined && selectedCell.item.Top2_Share !== null && (
                    <div className="text-[9px] sm:text-[10px] text-gray-400 font-mono mt-1 pt-1 border-t border-gray-800/60 flex justify-between">
                      <span>Top2 비중</span>
                      <span className="font-bold text-gray-200">
                        {(selectedCell.item.Top2_Share * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Top 2 Stocks List */}
                {selectedCell.item.top_stocks && selectedCell.item.top_stocks.length > 0 ? (
                  <div className="flex-1 flex flex-col justify-between gap-1">
                    {selectedCell.item.top_stocks.slice(0, 2).map((stock) => {
                      const retPct = stock.stock_12m_return !== undefined ? stock.stock_12m_return * 100 : null;
                      const weightPct = stock.sector_weight !== undefined ? stock.sector_weight * 100 : null;

                      return (
                        <div key={stock.stock_code} className="bg-black/35 p-1.5 rounded-lg border border-gray-800/50 flex-1 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-300 truncate max-w-[85px] sm:max-w-[130px] text-[10px] sm:text-[11px]">
                              {stock.rank_in_sector}. <StockNameLink name={stock.stock_name} />
                            </span>
                            <span className="text-[8px] text-gray-500 font-mono">
                              {weightPct !== null ? `${weightPct.toFixed(0)}%` : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-gray-400 font-mono mt-0.5">
                            <span className={clsx(
                              "font-bold",
                              retPct && retPct > 0 ? "text-red-400" : retPct && retPct < 0 ? "text-blue-400" : "text-gray-400"
                            )}>
                              {retPct !== null ? (retPct > 0 ? `+${retPct.toFixed(1)}%` : `${retPct.toFixed(1)}%`) : "-"}
                            </span>
                            {stock.marcap !== undefined && (
                              <span className="text-gray-500 text-[8px] hidden sm:inline">{formatMarcap(stock.marcap)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[9px] text-gray-500 italic p-1">종목 정보 없음</div>
                )}
              </div>

              {/* Right Column: Index Line Chart */}
              <div className="flex-1 min-w-0 bg-black/25 p-2 rounded-lg border border-gray-800/60 flex flex-col justify-between">
                <WicsIndexChart
                  key={selectedCell.wics}
                  wics={selectedCell.wics}
                  weight={rankType}
                  onWeightChange={setRankType}
                  startDate={indexDateRange.start}
                  endDate={indexDateRange.end}
                  height={135}
                  compact={true}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
