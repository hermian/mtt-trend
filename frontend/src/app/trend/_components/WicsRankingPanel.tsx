"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useWicsMonths, useWicsRankings } from "@/hooks/useWicsData";
import { WicsRankingItem } from "@/lib/api";
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

export const WicsRankingPanel: React.FC = () => {
  const { data: months, isLoading: monthsLoading, error: monthsError } = useWicsMonths();

  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");
  const [rankType, setRankType] = useState<"MC" | "EW">("MC");
  const [activeWics, setActiveWics] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [baseColumnWidth, setBaseColumnWidth] = useState<number>(150);

  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const clickStartCoord = useRef({ x: 0, y: 0 });
  const isResizingRef = useRef(false);

  const [hoveredCell, setHoveredCell] = useState<{
    item: WicsRankingItem;
    x: number;
    y: number;
    month: string;
  } | null>(null);

  const handleCellMouseEnter = (item: WicsRankingItem, month: string, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const outerRect = outerRef.current?.getBoundingClientRect();
    if (!outerRect) return;

    setHoveredCell({
      item,
      month,
      x: rect.left - outerRect.left + rect.width / 2,
      y: rect.top - outerRect.top,
    });
  };

  const handleCellMouseLeave = () => {
    setHoveredCell(null);
  };

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
      // Default range: latest 12 months if available
      const defaultStartIdx = Math.max(0, months.length - 12);
      const defaultStart = months[defaultStartIdx];

      setStartMonth(defaultStart);
      setEndMonth(latest);
    }
  }, [months]);

  // We fetch starting at min(startMonth, endMonth - 2 months) to ensure we always have 3 months ending in endMonth for 3M streak calculation
  const fetchStartMonth = useMemo(() => {
    if (!months || !startMonth || !endMonth) return startMonth;
    const startIdx = months.indexOf(startMonth);
    const endIdx = months.indexOf(endMonth);
    if (startIdx === -1 || endIdx === -1) return startMonth;

    const neededStartIdx = Math.max(0, endIdx - 2);
    const actualStartIdx = Math.min(startIdx, neededStartIdx);
    return months[actualStartIdx];
  }, [months, startMonth, endMonth]);

  const { data: rankingsData, isLoading: rankingsLoading, error: rankingsError } = useWicsRankings(
    fetchStartMonth || undefined,
    endMonth || undefined
  );

  // Filter months to keep startMonth <= month <= endMonth
  const selectableEndMonths = useMemo(() => {
    if (!months || !startMonth) return months || [];
    return months.filter((m) => m >= startMonth);
  }, [months, startMonth]);

  const selectableStartMonths = useMemo(() => {
    if (!months || !endMonth) return months || [];
    return months.filter((m) => m <= endMonth);
  }, [months, endMonth]);

  // Adjust endMonth if startMonth becomes greater
  const handleStartMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setStartMonth(val);
    if (endMonth && val > endMonth) {
      setEndMonth(val);
    }
  };

  const handleEndMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setEndMonth(val);
    if (startMonth && val < startMonth) {
      setStartMonth(val);
    }
  };

  // Determine top 10 WICS sectors of the last month to assign colors
  const wicsColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    if (!rankingsData || rankingsData.months.length === 0) return colorMap;

    // Get the last month's rankings (which is the last element because backend queries chronological ascending)
    const lastMonthObj = rankingsData.months[rankingsData.months.length - 1];
    if (!lastMonthObj || !lastMonthObj.rankings) return colorMap;

    // Sort rankings of the last month by the active rank type
    const sortedLastRankings = [...lastMonthObj.rankings].sort((a, b) => {
      const rA = rankType === "MC" ? a.Rank_MC : a.Rank_EW;
      const rB = rankType === "MC" ? b.Rank_MC : b.Rank_EW;
      return rA - rB;
    });

    // Assign a unique color from TOP_10_COLORS to the top 10 WICS
    const top10 = sortedLastRankings.slice(0, 10);
    top10.forEach((item, index) => {
      if (item.WICS) {
        colorMap.set(item.WICS, TOP_10_COLORS[index]);
      }
    });

    return colorMap;
  }, [rankingsData, rankType]);

  // Sorted rankings for all months in range
  const processedMonths = useMemo(() => {
    if (!rankingsData) return [];
    return rankingsData.months.map((mObj) => {
      const sorted = [...mObj.rankings].sort((a, b) => {
        const rA = rankType === "MC" ? a.Rank_MC : a.Rank_EW;
        const rB = rankType === "MC" ? b.Rank_MC : b.Rank_EW;
        return rA - rB;
      });
      return {
        YearMonth: mObj.YearMonth,
        rankings: sorted,
      };
    });
  }, [rankingsData, rankType]);

  // Filter processedMonths to only show the user's selected range in the UI
  const visibleMonths = useMemo(() => {
    if (!processedMonths || !startMonth || !endMonth) return processedMonths;
    return processedMonths.filter((m) => m.YearMonth >= startMonth && m.YearMonth <= endMonth);
  }, [processedMonths, startMonth, endMonth]);

  // Identify WICS sectors with 3 consecutive monthly increases (3M) ending in the latest month (spans 3 months of data)
  const risingSectors3M = useMemo(() => {
    const sectors = new Set<string>();
    if (!processedMonths || processedMonths.length < 3) return sectors;

    const latestMonthObj = processedMonths[processedMonths.length - 1];
    if (!latestMonthObj || !latestMonthObj.rankings) return sectors;

    // 3M streak requires 3 months of data (e.g. N-2 -> N-1 -> N)
    const targetMonths = processedMonths.slice(-3);

    for (const item of latestMonthObj.rankings) {
      const wicsName = item.WICS;
      const rets: number[] = [];
      let valid = true;

      for (const m of targetMonths) {
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

  // Identify WICS sectors with 2 consecutive monthly increases (2M) ending in the latest month (spans 2 months of data)
  const risingSectors2M = useMemo(() => {
    const sectors = new Set<string>();
    if (!processedMonths || processedMonths.length < 2) return sectors;

    const latestMonthObj = processedMonths[processedMonths.length - 1];
    if (!latestMonthObj || !latestMonthObj.rankings) return sectors;

    // 2M streak requires 2 months of data (e.g. N-1 -> N)
    const targetMonths = processedMonths.slice(-2);

    for (const item of latestMonthObj.rankings) {
      const wicsName = item.WICS;
      if (risingSectors3M.has(wicsName)) continue; // Skip if already in 3M

      const rets: number[] = [];
      let valid = true;

      for (const m of targetMonths) {
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

  const handleCellClick = (wics: string) => {
    if (activeWics === wics) {
      setActiveWics(null);
    } else {
      setActiveWics(wics);
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

  if (monthsError || rankingsError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900/40 border border-red-900/30 rounded-2xl">
        <span className="text-red-500 text-3xl mb-2">⚠️</span>
        <p className="text-gray-300 font-medium">데이터 로드 중 에러가 발생했습니다.</p>
        <p className="text-gray-500 text-xs mt-1">{(monthsError || rankingsError)?.toString()}</p>
      </div>
    );
  }

  return (
    <div ref={outerRef} className="flex flex-col h-full space-y-6 relative">
      {/* Filters & Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-gray-900/60 p-4 rounded-xl border border-gray-800 gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">시작월</span>
            {monthsLoading ? (
              <div className="h-9 w-24 bg-gray-800 rounded animate-pulse" />
            ) : (
              <select
                value={startMonth}
                onChange={handleStartMonthChange}
                className="bg-gray-800 text-xs border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer text-white"
              >
                {selectableStartMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">종료월</span>
            {monthsLoading ? (
              <div className="h-9 w-24 bg-gray-800 rounded animate-pulse" />
            ) : (
              <select
                value={endMonth}
                onChange={handleEndMonthChange}
                className="bg-gray-800 text-xs border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer text-white"
              >
                {selectableEndMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
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
              min="80"
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
                  setBaseColumnWidth(90);
                  setColumnWidths({});
                }}
                className={clsx(
                  "px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors",
                  baseColumnWidth === 90 ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"
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

      {/* Main Ranking Grid */}
      <div className="flex-1 bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
        {rankingsLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 animate-pulse font-medium">
            WICS 랭킹 데이터를 로드하고 있습니다...
          </div>
        ) : visibleMonths.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 font-medium">
            표시할 데이터가 없습니다. 다른 월 범위를 선택해 보세요.
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
              isDownRef.current ? "cursor-grabbing" : "cursor-default"
            )}
          >
            {/* Fixed Rank Column */}
            <div className="flex-shrink-0 bg-gray-900/80 border-r border-gray-800 sticky left-0 z-20 w-16">
              <div
                onClick={() => {
                  if (hasDraggedRef.current) return;
                  setActiveWics(null);
                }}
                className="h-12 border-b border-gray-800 flex items-center justify-center font-bold text-xs text-gray-400 bg-gray-900 sticky top-0 left-0 z-40 cursor-pointer hover:bg-gray-800 transition-colors"
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

            {/* Monthly Columns */}
            <div className="flex flex-1">
              {visibleMonths.map((monthObj) => {
                const isLastMonth = monthObj.YearMonth === endMonth;
                return (
                  <div
                    key={monthObj.YearMonth}
                    style={{ width: `${columnWidths[monthObj.YearMonth] || baseColumnWidth}px` }}
                    className={clsx(
                      "flex-shrink-0 border-r border-gray-800/80 flex flex-col relative",
                      isLastMonth && "bg-blue-950/5"
                    )}
                  >
                    {/* Month Header */}
                    <div
                      onClick={() => {
                        if (hasDraggedRef.current) return;
                        setActiveWics(null);
                      }}
                      className={clsx(
                        "h-12 border-b border-gray-800 flex flex-col items-center justify-center px-4 font-bold text-sm bg-gray-900/80 sticky top-0 z-30 cursor-pointer hover:bg-gray-800/80 transition-colors",
                        isLastMonth ? "text-blue-400" : "text-gray-300"
                      )}
                    >
                      <span>{monthObj.YearMonth}</span>
                      {isLastMonth && (
                        <span className="text-[9px] text-blue-500 font-mono tracking-tighter uppercase">
                          (기준월 / 색상 지정)
                        </span>
                      )}
                    </div>

                    {/* Rankings List */}
                    <div className="flex-1">
                      {monthObj.rankings.map((item) => {
                        const hasColor = wicsColorMap.has(item.WICS);
                        const colorClass = hasColor ? wicsColorMap.get(item.WICS) : "bg-gray-900/30 border border-gray-800/50 text-gray-300 hover:border-gray-700";
                        const isMatch = activeWics === item.WICS;
                        const hasActiveSelection = activeWics !== null;
                        const isRising3M = risingSectors3M.has(item.WICS);
                        const isRising2M = risingSectors2M.has(item.WICS);

                        return (
                          <div
                            key={item.WICS}
                            onClick={() => {
                              if (hasDraggedRef.current) return;
                              handleCellClick(item.WICS);
                            }}
                            onMouseEnter={(e) => handleCellMouseEnter(item, monthObj.YearMonth, e)}
                            onMouseLeave={handleCellMouseLeave}
                            className={clsx(
                              "h-[35px] px-2 py-0.5 flex flex-col justify-center border-b border-gray-800/30 cursor-pointer select-none transition-all duration-200",
                              colorClass,
                              isMatch && "ring-2 ring-yellow-400 border-yellow-400 scale-[1.02] shadow-lg shadow-yellow-400/20 z-10 opacity-100",
                              isRising3M && !hasActiveSelection && "ring-2 ring-emerald-500 border-emerald-500 scale-[1.01] shadow-md shadow-emerald-500/10 z-10",
                              isRising2M && !hasActiveSelection && "ring-2 ring-blue-500/80 border-blue-500 scale-[1.01] shadow-md shadow-blue-500/10 z-10",
                              hasActiveSelection && !isMatch && "opacity-25"
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center min-w-0 flex-1 mr-1">
                                <span className="font-bold text-[10px] md:text-xs truncate" title={item.WICS}>
                                  {item.WICS}
                                </span>
                                {isRising3M && (
                                  <span className="ml-1 text-[7px] md:text-[8px] bg-emerald-500 text-white px-0.5 py-0.2 rounded font-bold whitespace-nowrap leading-none shrink-0" title="3달 연속 수익률 상승">
                                    3M▲
                                  </span>
                                )}
                                {isRising2M && (
                                  <span className="ml-1 text-[7px] md:text-[8px] bg-blue-500 text-white px-0.5 py-0.2 rounded font-bold whitespace-nowrap leading-none shrink-0" title="2달 연속 수익률 상승">
                                    2M▲
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
            • <strong className="text-emerald-400">3달 연속 상승 하이라이트 (3M▲):</strong> 최근 3달(3개월 데이터 기준) 동안 수익률이 연속으로 상승한 종목은 초기 로딩 시 초록색 테두리와 `3M▲` 배지가 표시됩니다.
          </p>
          <p>
            • <strong className="text-blue-400">2달 연속 상승 하이라이트 (2M▲):</strong> 최근 2달(2개월 데이터 기준) 동안 수익률이 연속으로 상승한 종목은 초기 로딩 시 파란색 테두리와 `2M▲` 배지가 표시됩니다.
          </p>
          <p>
            • <strong className="text-gray-200">색상 지정 규칙:</strong> 맨 마지막 월(종료월)의 상위 10개 WICS 섹터는 각각 서로 다른 10가지 색상을 가집니다. 이전 월의 동일 WICS 섹터에도 같은 색상이 적용되어 순위 변동 추이를 시각적으로 쉽게 추적할 수 있습니다.
          </p>
          <p>
            • <strong className="text-gray-200">하이라이트 기능:</strong> 특정 Cell을 클릭하면 선택한 WICS 섹터가 전체 월에서 하이라이트 되며, 다른 섹터들은 흐려져 해당 섹터의 순위 흐름에만 집중할 수 있습니다. 다시 클릭하면 하이라이트가 해제됩니다.
          </p>
          <p>
            • <strong className="text-gray-200">가중치 유형:</strong> <strong className="text-gray-300">시가총액 가중(MC)</strong>은 각 섹터 내 대형주 위주 성과를 반영하고, <strong className="text-gray-300">동등 가중(EW)</strong>은 섹터 내 개별 종목들의 평균 성과를 균등하게 반영합니다.
          </p>
        </div>
      </div>

      {/* Dynamic Hover Tooltip */}
      {hoveredCell && (
        <div
          style={{
            position: "absolute",
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y}px`,
            transform: "translate(-50%, -105%)",
          }}
          className="z-50 w-64 bg-gray-900/95 border border-gray-800 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs pointer-events-none transition-all duration-150 animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-2 mb-2">
            <span className="font-bold text-gray-250 text-[11px]">{hoveredCell.item.WICS}</span>
            <span className="text-[10px] text-gray-500 font-mono">{hoveredCell.month}</span>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-400 font-medium">섹터 12M 수익률</span>
              <span className={clsx(
                "font-bold font-mono",
                ((rankType === "MC" ? hoveredCell.item.MC_12m_Return : hoveredCell.item.EW_12m_Return) ?? 0) > 0 
                  ? "text-red-400" 
                  : ((rankType === "MC" ? hoveredCell.item.MC_12m_Return : hoveredCell.item.EW_12m_Return) ?? 0) < 0 
                    ? "text-blue-400" 
                    : "text-gray-400"
              )}>
                {(() => {
                  const ret = rankType === "MC" ? hoveredCell.item.MC_12m_Return : hoveredCell.item.EW_12m_Return;
                  if (ret === undefined || ret === null) return "-";
                  const pct = ret * 100;
                  return pct > 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;
                })()}
              </span>
            </div>

            {hoveredCell.item.Top2_Share !== undefined && hoveredCell.item.Top2_Share !== null && (
              <div className="flex justify-between items-center text-[11px] border-b border-gray-800/40 pb-2">
                <span className="text-gray-400 font-medium">Top 2 시총 비중</span>
                <span className="font-bold text-gray-300 font-mono">
                  {(hoveredCell.item.Top2_Share * 100).toFixed(1)}%
                </span>
              </div>
            )}

            {hoveredCell.item.top_stocks && hoveredCell.item.top_stocks.length > 0 ? (
              <div className="space-y-2 mt-1">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Top 2 종목 상세</p>
                {hoveredCell.item.top_stocks.map((stock) => {
                  const retPct = stock.stock_12m_return !== undefined ? stock.stock_12m_return * 100 : null;
                  const weightPct = stock.sector_weight !== undefined ? stock.sector_weight * 100 : null;
                  
                  return (
                    <div key={stock.stock_code} className="bg-black/35 p-2 rounded-lg border border-gray-800/40">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-350 truncate max-w-[120px] text-[11px]">
                          {stock.rank_in_sector}. {stock.stock_name}
                        </span>
                        <span className="text-[8px] text-gray-500 font-mono">
                          {stock.stock_code}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-gray-400 font-mono">
                        <div className="flex justify-between">
                          <span>수익률:</span>
                          <span className={clsx(
                            "font-bold",
                            retPct && retPct > 0 ? "text-red-400" : retPct && retPct < 0 ? "text-blue-400" : "text-gray-400"
                          )}>
                            {retPct !== null ? (retPct > 0 ? `+${retPct.toFixed(1)}%` : `${retPct.toFixed(1)}%`) : "-"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>비중:</span>
                          <span className="font-bold text-gray-300">
                            {weightPct !== null ? `${weightPct.toFixed(1)}%` : "-"}
                          </span>
                        </div>
                        {stock.marcap !== undefined && (
                          <div className="col-span-2 flex justify-between mt-0.5 text-[8px] text-gray-500">
                            <span>시가총액:</span>
                            <span>{formatMarcap(stock.marcap)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-gray-500 italic mt-1">상세 종목 정보 없음</p>
            )}
          </div>

          {/* Little arrow at the bottom */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900/95" />
        </div>
      )}
    </div>
  );
};
