"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineSeries,
  LineStyle,
} from "lightweight-charts";
import { useReturnComparison } from "@/hooks/useReturnComparison";
import { useStockSearch } from "@/hooks/useAvwapChart";
import {
  ReturnComparisonItem,
  ReturnSeries,
  ReturnStatistics,
  CorrelationMatrix,
  RollingCorrelationPair,
  StockSearchResult,
} from "@/lib/api";
import { toChartTime, toFiniteNumber } from "./_lib/chartTime";
import clsx from "clsx";

const PERIOD_BUTTONS = [
  "1개월",
  "3개월",
  "6개월",
  "1년",
  "3년",
  "WTD",
  "MTD",
  "QTD",
  "YTD",
] as const;

type PeriodType = (typeof PERIOD_BUTTONS)[number];

const COLOR_PALETTE = [
  "#3b82f6", // Blue
  "#f97316", // Orange
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#eab308", // Yellow
  "#ef4444", // Red
  "#14b8a6", // Teal
  "#a855f7", // Purple
];

const PRESETS = [
  {
    label: "삼성전자 vs NVDA",
    items: [
      { code: "005930", name: "삼성전자", market: "KOSPI", type: "stock" },
      { code: "NVDA", name: "NVIDIA", market: "US", type: "us_stock" },
    ],
  },
  {
    label: "KODEX 200 vs SPY",
    items: [
      { code: "069500", name: "KODEX 200", market: "ETF", type: "etf" },
      { code: "SPY", name: "SPDR S&P 500", market: "US_ETF", type: "us_etf" },
    ],
  },
  {
    label: "QQQ vs SPY vs DIA",
    items: [
      { code: "QQQ", name: "Invesco QQQ", market: "US_ETF", type: "us_etf" },
      { code: "SPY", name: "SPDR S&P 500", market: "US_ETF", type: "us_etf" },
      { code: "DIA", name: "SPDR Dow Jones", market: "US_ETF", type: "us_etf" },
    ],
  },
  {
    label: "반도체 4선 (삼전/닉스/NVDA/TSMC)",
    items: [
      { code: "005930", name: "삼성전자", market: "KOSPI", type: "stock" },
      { code: "000660", name: "SK하이닉스", market: "KOSPI", type: "stock" },
      { code: "NVDA", name: "NVIDIA", market: "US", type: "us_stock" },
      { code: "TSM", name: "TSMC", market: "US", type: "us_stock" },
    ],
  },
];

function calculatePeriodDates(periodType: PeriodType): { start: string; end: string } {
  const end = new Date();
  const endStr = end.toISOString().split("T")[0];
  let start = new Date(end);

  if (periodType === "1개월") {
    start.setMonth(start.getMonth() - 1);
  } else if (periodType === "3개월") {
    start.setMonth(start.getMonth() - 3);
  } else if (periodType === "6개월") {
    start.setMonth(start.getMonth() - 6);
  } else if (periodType === "1년") {
    start.setFullYear(start.getFullYear() - 1);
  } else if (periodType === "3년") {
    start.setFullYear(start.getFullYear() - 3);
  } else if (periodType === "WTD") {
    const day = start.getDay();
    const diff = (day === 0 ? 6 : day - 1); // Monday is start
    start.setDate(start.getDate() - diff);
  } else if (periodType === "MTD") {
    start.setDate(1);
  } else if (periodType === "QTD") {
    const quarterMonth = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterMonth);
    start.setDate(1);
  } else if (periodType === "YTD") {
    start.setMonth(0);
    start.setDate(1);
  }

  return { start: start.toISOString().split("T")[0], end: endStr };
}

function formatPercent(val?: number | null): string {
  if (val == null || isNaN(val)) return "-";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

function getPercentColor(val?: number | null): string {
  if (val == null || isNaN(val)) return "text-gray-400";
  if (val > 0) return "text-red-400 font-semibold";
  if (val < 0) return "text-blue-400 font-semibold";
  return "text-gray-300";
}

function formatPrice(val?: number | null, currency: string = "KRW"): string {
  if (val == null || isNaN(val)) return "-";
  if (currency === "USD") {
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₩${val.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
}

// RdBu color interpolator for correlation heatmap
function getCorrCellColor(val: number | null): { bg: string; text: string } {
  if (val == null || isNaN(val)) {
    return { bg: "bg-gray-800", text: "text-gray-500" };
  }
  // val is between -1.0 and 1.0
  if (val >= 0.8) return { bg: "bg-blue-600 text-white font-bold", text: "text-white" };
  if (val >= 0.5) return { bg: "bg-blue-700/80 text-blue-100", text: "text-blue-100" };
  if (val >= 0.2) return { bg: "bg-blue-900/60 text-blue-200", text: "text-blue-200" };
  if (val > -0.2) return { bg: "bg-gray-800 text-gray-300", text: "text-gray-300" };
  if (val > -0.5) return { bg: "bg-red-900/50 text-red-200", text: "text-red-200" };
  if (val > -0.8) return { bg: "bg-red-800/80 text-red-100", text: "text-red-100" };
  return { bg: "bg-red-600 text-white font-bold", text: "text-white" };
}

export function ReturnComparisonPanel() {
  // Default selected items (삼성전자 & NVDA)
  const [selectedItems, setSelectedItems] = useState<ReturnComparisonItem[]>([
    { code: "005930", name: "삼성전자", market: "KOSPI", type: "stock" },
    { code: "NVDA", name: "NVIDIA", market: "US", type: "us_stock" },
  ]);

  // Date range state (default: 1 Year)
  const defaultDates = useMemo(() => calculatePeriodDates("1년"), []);
  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);
  const [activePeriod, setActivePeriod] = useState<PeriodType | null>("1년");

  // State management
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [hiddenRollingPairs, setHiddenRollingPairs] = useState<Set<string>>(new Set());

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"stock" | "etf">("stock");
  const [searchCountry, setSearchCountry] = useState<"kr" | "us">("kr");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Correlation active period tab
  const [activeCorrPeriod, setActiveCorrPeriod] = useState<"3M" | "6M" | "12M" | "3Y">("6M");

  const { data: searchResults, isFetching: isSearching } = useStockSearch(
    searchQuery,
    searchType,
    searchCountry
  );

  const { data: returnData, isLoading, isFetching, error, refetch } = useReturnComparison(
    selectedItems,
    startDate,
    endDate
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddItem = (stock: StockSearchResult) => {
    if (selectedItems.some((item) => item.code === stock.code)) {
      setSearchQuery("");
      setShowDropdown(false);
      return;
    }
    if (selectedItems.length >= 10) {
      alert("최대 10개 종목까지 동시에 비교할 수 있습니다.");
      return;
    }

    let itemType = searchType === "etf" ? (searchCountry === "us" ? "us_etf" : "etf") : (searchCountry === "us" ? "us_stock" : "stock");
    if (stock.market === "US_ETF" || stock.market === "ETF_US") itemType = "us_etf";
    else if (stock.market === "ETF") itemType = "etf";
    else if (["US", "NASDAQ", "NYSE", "AMEX"].includes(stock.market)) itemType = "us_stock";

    const newItem: ReturnComparisonItem = {
      code: stock.code,
      name: stock.name,
      market: stock.market,
      type: itemType,
    };

    setSelectedItems((prev) => [...prev, newItem]);
    setSearchQuery("");
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleRemoveItem = (code: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.code !== code));
  };

  const handleClearAll = () => {
    setSelectedItems([]);
  };

  const handleApplyPreset = (preset: (typeof PRESETS)[number]) => {
    setSelectedItems(preset.items);
  };

  const handlePeriodClick = (p: PeriodType) => {
    setActivePeriod(p);
    const { start, end } = calculatePeriodDates(p);
    setStartDate(start);
    setEndDate(end);
  };

  const toggleSeriesVisibility = (code: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleRollingPairVisibility = (pairName: string) => {
    setHiddenRollingPairs((prev) => {
      const next = new Set(prev);
      if (next.has(pairName)) next.delete(pairName);
      else next.add(pairName);
      return next;
    });
  };

  // --- Main Cumulative Return Chart (Lightweight Charts) ---
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const mainSeriesListRef = useRef<ISeriesApi<"Line">[]>([]);
  const seriesMapRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    values: { name: string; code: string; color: string; ret: number; close: number; currency: string }[];
  } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(51, 65, 85, 0.4)" },
        horzLines: { color: "rgba(51, 65, 85, 0.4)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(148, 163, 184, 0.5)",
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: "rgba(148, 163, 184, 0.5)",
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      leftPriceScale: {
        visible: false,
      },
      rightPriceScale: {
        borderColor: "#334155",
        autoScale: true,
      },
      timeScale: {
        borderColor: "#334155",
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartApiRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartApiRef.current) {
        chartApiRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 450,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartApiRef.current = null;
    };
  }, []);

  // Update chart series when returnData or hiddenSeries changes
  useEffect(() => {
    const chart = chartApiRef.current;
    if (!chart) return;

    // Remove existing series
    mainSeriesListRef.current.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {}
    });
    mainSeriesListRef.current = [];
    seriesMapRef.current.clear();

    if (!returnData || !returnData.series || returnData.series.length === 0) return;

    // Add 0% baseline series
    const baseDates = new Set<string>();
    returnData.series.forEach((s) => s.data.forEach((d) => baseDates.add(d.date)));
    const sortedDates = Array.from(baseDates).sort();

    if (sortedDates.length > 0) {
      const zeroSeries = chart.addSeries(LineSeries, {
        color: "rgba(148, 163, 184, 0.4)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      zeroSeries.setData(
        sortedDates.map((d) => ({
          time: toChartTime(d) || d,
          value: 0,
        }))
      );
      mainSeriesListRef.current.push(zeroSeries);
    }

    // Add each asset's cumulative return line (without left title box)
    returnData.series.forEach((ser, idx) => {
      if (hiddenSeries.has(ser.code)) return;
      const color = ser.color || COLOR_PALETTE[idx % COLOR_PALETTE.length];

      const lineSeries = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const chartDataPoints = ser.data
        .map((p) => {
          const t = toChartTime(p.date);
          const v = toFiniteNumber(p.return_pct);
          if (t && v !== null) return { time: t, value: v };
          return null;
        })
        .filter((p): p is { time: string; value: number } => p !== null);

      lineSeries.setData(chartDataPoints);
      mainSeriesListRef.current.push(lineSeries);
      seriesMapRef.current.set(ser.code, lineSeries);
    });

    chart.timeScale().fitContent();

    // Tooltip handler
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHoveredPoint(null);
        return;
      }

      const dateStr = typeof param.time === "string" ? param.time : (param.time as any).year ? `${(param.time as any).year}-${String((param.time as any).month).padStart(2, "0")}-${String((param.time as any).day).padStart(2, "0")}` : "";
      
      const hoveredValues: { name: string; code: string; color: string; ret: number; close: number; currency: string }[] = [];

      returnData.series.forEach((ser, idx) => {
        if (hiddenSeries.has(ser.code)) return;
        const color = ser.color || COLOR_PALETTE[idx % COLOR_PALETTE.length];
        const pt = ser.data.find((d) => d.date === dateStr);
        if (pt) {
          hoveredValues.push({
            name: ser.name,
            code: ser.code,
            color,
            ret: pt.return_pct,
            close: pt.close,
            currency: ser.currency,
          });
        }
      });

      if (hoveredValues.length > 0) {
        setHoveredPoint({ date: dateStr, values: hoveredValues });
      } else {
        setHoveredPoint(null);
      }
    });
  }, [returnData, hiddenSeries]);

  // --- Rolling Correlation Trend Chart (Lightweight Charts) ---
  const rollingContainerRef = useRef<HTMLDivElement>(null);
  const rollingApiRef = useRef<IChartApi | null>(null);
  const rollingSeriesRef = useRef<ISeriesApi<"Line">[]>([]);

  useEffect(() => {
    if (!rollingContainerRef.current) return;

    const chart = createChart(rollingContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(51, 65, 85, 0.4)" },
        horzLines: { color: "rgba(51, 65, 85, 0.4)" },
      },
      leftPriceScale: {
        visible: false,
      },
      rightPriceScale: {
        borderColor: "#334155",
        autoScale: true,
      },
      timeScale: {
        borderColor: "#334155",
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    rollingApiRef.current = chart;

    const handleResize = () => {
      if (rollingContainerRef.current && rollingApiRef.current) {
        rollingApiRef.current.applyOptions({
          width: rollingContainerRef.current.clientWidth,
          height: rollingContainerRef.current.clientHeight || 320,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      rollingApiRef.current = null;
    };
  }, []);

  // Update rolling chart series
  useEffect(() => {
    const chart = rollingApiRef.current;
    if (!chart) return;

    // Remove previous series
    rollingSeriesRef.current.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {}
    });
    rollingSeriesRef.current = [];

    const pairs = returnData?.rolling_correlations?.[activeCorrPeriod] || [];
    if (pairs.length === 0) return;

    const allDates = new Set<string>();
    pairs.forEach((p) => p.data.forEach((d) => allDates.add(d.date)));
    const sorted = Array.from(allDates).sort();

    if (sorted.length > 0) {
      // 0 baseline
      const zeroSeries = chart.addSeries(LineSeries, {
        color: "rgba(148, 163, 184, 0.5)",
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      zeroSeries.setData(sorted.map((d) => ({ time: toChartTime(d) || d, value: 0 })));
      rollingSeriesRef.current.push(zeroSeries);

      // +1.0 line
      const plusOne = chart.addSeries(LineSeries, {
        color: "rgba(148, 163, 184, 0.3)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      plusOne.setData(sorted.map((d) => ({ time: toChartTime(d) || d, value: 1.0 })));
      rollingSeriesRef.current.push(plusOne);

      // -1.0 line
      const minusOne = chart.addSeries(LineSeries, {
        color: "rgba(148, 163, 184, 0.3)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      minusOne.setData(sorted.map((d) => ({ time: toChartTime(d) || d, value: -1.0 })));
      rollingSeriesRef.current.push(minusOne);
    }

    pairs.forEach((pair, idx) => {
      if (hiddenRollingPairs.has(pair.pair)) return;
      const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const pts = pair.data
        .map((p) => {
          const t = toChartTime(p.date);
          const v = toFiniteNumber(p.corr);
          if (t && v !== null) return { time: t, value: v };
          return null;
        })
        .filter((p): p is { time: string; value: number } => p !== null);

      series.setData(pts);
      rollingSeriesRef.current.push(series);
    });

    chart.timeScale().fitContent();
  }, [returnData?.rolling_correlations, activeCorrPeriod, hiddenRollingPairs]);

  const corrMatrix = returnData?.correlations?.[activeCorrPeriod];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-gray-950 text-white min-h-screen">
      {/* 1. Header & Controls Section */}
      <div className="flex flex-col gap-4 bg-gray-900/70 border border-gray-800 p-4 md:p-5 rounded-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white">
              종목 수익률 비교 & 상관계수 분석
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              다중 자산 비교
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400 mr-1">추천 프리셋:</span>
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar & Options */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Segment Toggle: KR / US */}
          <div className="inline-flex rounded-lg bg-gray-800/90 p-0.5 border border-gray-700">
            <button
              type="button"
              onClick={() => setSearchCountry("kr")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                searchCountry === "kr"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              KR
            </button>
            <button
              type="button"
              onClick={() => setSearchCountry("us")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                searchCountry === "us"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              US
            </button>
          </div>

          {/* Segment Toggle: 종목 / ETF */}
          <div className="inline-flex rounded-lg bg-gray-800/90 p-0.5 border border-gray-700">
            <button
              type="button"
              onClick={() => setSearchType("stock")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                searchType === "stock"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              종목
            </button>
            <button
              type="button"
              onClick={() => setSearchType("etf")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                searchType === "etf"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              ETF
            </button>
          </div>

          {/* Search Box with Autocomplete Dropdown */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <div className="flex items-center bg-gray-800/90 border border-gray-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 rounded-lg px-3 py-1.5 text-xs transition-all">
              <span className="text-gray-400 mr-2">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={
                  searchCountry === "kr"
                    ? searchType === "etf"
                      ? "국내 ETF명 또는 코드 (예: KODEX 200, 069500)"
                      : "국내 종목명 또는 코드 (예: 삼성전자, 005930)"
                    : searchType === "etf"
                    ? "미국 ETF명 또는 티커 (예: QQQ, SPY, SOXX)"
                    : "미국 종목명 또는 티커 (예: NVDA, AAPL, TSLA)"
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  setSelectedIndex(-1);
                }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (!showDropdown) setShowDropdown(true);
                    else if (searchResults && searchResults.length > 0) {
                      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
                    }
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if (searchResults && searchResults.length > 0) {
                      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
                    }
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (selectedIndex >= 0 && searchResults && searchResults[selectedIndex]) {
                      handleAddItem(searchResults[selectedIndex]);
                    } else if (searchResults && searchResults.length > 0) {
                      handleAddItem(searchResults[0]);
                    }
                  } else if (e.key === "Escape") {
                    setShowDropdown(false);
                  }
                }}
                className="bg-transparent text-white placeholder-gray-500 focus:outline-none w-full text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setShowDropdown(false);
                  }}
                  className="text-gray-400 hover:text-white ml-1 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown results */}
            {showDropdown && searchQuery.trim().length >= 1 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
              >
                {isSearching ? (
                  <div className="p-3 text-xs text-gray-400 text-center animate-pulse">
                    검색 중...
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((stock, idx) => (
                    <div
                      key={`${stock.code}-${idx}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddItem(stock);
                      }}
                      className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer border-b border-gray-800/50 last:border-0 transition-colors ${
                        idx === selectedIndex ? "bg-blue-600/30 text-blue-200" : "hover:bg-gray-800 text-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{stock.name}</span>
                        <span className="text-gray-400 font-mono text-[11px]">{stock.code}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono">
                        {stock.market}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-xs text-gray-500 text-center">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Refresh / Query Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors disabled:opacity-50 shadow-md"
          >
            <span>{isFetching ? "⏳" : "🔄"}</span>
            <span>조회</span>
          </button>
        </div>

        {/* Selected Items Tag List */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-800/60">
          <span className="text-xs font-semibold text-gray-400 mr-1">
            비교 대상 ({selectedItems.length}/10):
          </span>
          {selectedItems.map((item, idx) => {
            const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
            const isHidden = hiddenSeries.has(item.code);
            return (
              <div
                key={item.code}
                className={clsx(
                  "inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all select-none",
                  isHidden
                    ? "bg-gray-800/40 text-gray-500 border-gray-700/40 opacity-60"
                    : "bg-gray-800 text-gray-200 border-gray-700 shadow-sm"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleSeriesVisibility(item.code)}
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                  title={isHidden ? "클릭하여 차트에 표시" : "클릭하여 차트에서 숨김"}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isHidden ? "#64748b" : color }}
                  />
                  <span className={clsx("font-semibold", isHidden ? "line-through text-gray-400" : "text-white")}>
                    {item.name || item.code}
                  </span>
                  <span className="text-gray-400 font-mono text-[10px]">({item.code})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.code)}
                  className="text-gray-400 hover:text-red-400 ml-1 transition-colors text-[11px]"
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {selectedItems.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 transition-colors"
            >
              전체 비우기
            </button>
          )}
          {selectedItems.length === 0 && (
            <span className="text-xs text-amber-400/80">
              ⚠️ 비교할 종목을 위 검색창에서 검색하여 추가해주세요.
            </span>
          )}
        </div>

        {/* Period Shortcuts & Date Range Pickers */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-800/60">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-400 mr-1.5">조회 기간:</span>
            {PERIOD_BUTTONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodClick(p)}
                className={clsx(
                  "px-2.5 py-1 text-xs font-medium rounded-lg border transition-all",
                  activePeriod === p
                    ? "bg-blue-600 text-white border-blue-500 shadow-sm font-bold"
                    : "bg-gray-800 text-gray-400 hover:text-white border-gray-700 hover:bg-gray-700"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-gray-800/80 border border-gray-700 rounded-lg px-2 py-1">
              <span className="text-gray-400 text-[11px]">시작:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePeriod(null);
                }}
                className="bg-transparent text-white focus:outline-none font-mono text-xs"
              />
            </div>
            <span className="text-gray-500">~</span>
            <div className="flex items-center gap-1 bg-gray-800/80 border border-gray-700 rounded-lg px-2 py-1">
              <span className="text-gray-400 text-[11px]">종료:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePeriod(null);
                }}
                className="bg-transparent text-white focus:outline-none font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Cumulative Return Chart */}
      <div className="flex flex-col bg-gray-900/70 border border-gray-800 rounded-2xl p-4 md:p-5 backdrop-blur-md shadow-xl relative">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📈</span>
              <span>누적 수익률 (%) 비교 차트</span>
            </h2>
            <span className="text-xs text-gray-400 font-mono">
              ({startDate} ~ {endDate})
            </span>
          </div>

          {/* Interactive Hover Tooltip Badge */}
          {hoveredPoint && (
            <div className="flex items-center gap-3 bg-gray-800/95 border border-gray-700 px-3 py-1.5 rounded-lg text-xs shadow-lg flex-wrap">
              <span className="text-gray-400 font-mono font-bold mr-1">
                📅 {hoveredPoint.date}
              </span>
              {hoveredPoint.values.map((v) => (
                <div key={v.code} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                  <span className="text-gray-300 font-medium">{v.name}:</span>
                  <span className={getPercentColor(v.ret)}>{formatPercent(v.ret)}</span>
                  <span className="text-gray-500 font-mono text-[10px]">
                    ({formatPrice(v.close, v.currency)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chart Canvas */}
        <div className="w-full h-[420px] md:h-[480px] relative">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/60 z-20 backdrop-blur-sm">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs text-blue-400 font-mono">수익률 데이터 계산 중...</span>
            </div>
          )}
          {selectedItems.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-gray-400">
              <span className="text-3xl mb-2">📊</span>
              <p className="text-sm font-semibold">비교할 종목을 추가해주세요</p>
              <p className="text-xs text-gray-500 mt-1">상단 검색창에서 KR/US 종목 또는 ETF를 검색하여 추가할 수 있습니다.</p>
            </div>
          )}
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>

        {/* Chart Legend */}
        {returnData?.series && returnData.series.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-800/80">
            {returnData.series.map((ser, idx) => {
              const color = ser.color || COLOR_PALETTE[idx % COLOR_PALETTE.length];
              const isHidden = hiddenSeries.has(ser.code);
              const lastRet = ser.data.length > 0 ? ser.data[ser.data.length - 1].return_pct : null;
              return (
                <button
                  key={ser.code}
                  type="button"
                  onClick={() => toggleSeriesVisibility(ser.code)}
                  className={clsx(
                    "flex items-center gap-2 text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer select-none",
                    isHidden
                      ? "bg-gray-800/40 text-gray-500 border-gray-700/40 opacity-50"
                      : "bg-gray-800/80 text-gray-200 border-gray-700 hover:bg-gray-700 shadow-sm"
                  )}
                  title={isHidden ? "클릭하여 차트에 표시" : "클릭하여 차트에서 숨김"}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: isHidden ? "#64748b" : color }} />
                  <span className={clsx("font-semibold", isHidden && "line-through")}>{ser.name}</span>
                  <span className={clsx("font-mono text-xs", getPercentColor(lastRet), isHidden && "opacity-50")}>
                    {formatPercent(lastRet)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Statistics Table Section */}
      {returnData?.statistics && returnData.statistics.length > 0 && (
        <div className="flex flex-col bg-gray-900/70 border border-gray-800 rounded-2xl p-4 md:p-5 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📋</span>
              <span>기간별 수익률 및 기술 통계 요약</span>
            </h2>
            <span className="text-xs text-gray-400">
              * 기간내 수익률: 조회 기간({startDate} ~ {endDate}) 기준
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-800/80 text-gray-400 font-semibold border-b border-gray-700">
                  <th className="py-2.5 px-3">종목명</th>
                  <th className="py-2.5 px-3">시작가</th>
                  <th className="py-2.5 px-3">현재가</th>
                  <th className="py-2.5 px-3 text-right">1W</th>
                  <th className="py-2.5 px-3 text-right">1M</th>
                  <th className="py-2.5 px-3 text-right">3M</th>
                  <th className="py-2.5 px-3 text-right">6M</th>
                  <th className="py-2.5 px-3 text-right">1Y</th>
                  <th className="py-2.5 px-3 text-right">YTD</th>
                  <th className="py-2.5 px-3 text-right bg-blue-900/20 text-blue-300 font-bold border-l border-r border-blue-800/30">
                    기간내수익률
                  </th>
                  <th className="py-2.5 px-3 text-right">최고수익률</th>
                  <th className="py-2.5 px-3 text-right">최저수익률</th>
                  <th className="py-2.5 px-3 text-right">평균수익률</th>
                  <th className="py-2.5 px-3 text-right">변동성(std)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {returnData.statistics.map((st, idx) => {
                  const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
                  const isHidden = hiddenSeries.has(st.code);
                  return (
                    <tr
                      key={st.code}
                      onClick={() => toggleSeriesVisibility(st.code)}
                      className={clsx(
                        "hover:bg-gray-800/50 transition-colors font-mono cursor-pointer select-none",
                        isHidden && "opacity-40"
                      )}
                      title={isHidden ? "클릭하여 차트에 표시" : "클릭하여 차트에서 숨김"}
                    >
                      <td className="py-2.5 px-3 font-sans font-semibold text-white flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: isHidden ? "#64748b" : color }}
                        />
                        <span className={isHidden ? "line-through text-gray-400" : ""}>{st.name}</span>
                        <span className="text-gray-400 font-mono text-[11px]">({st.code})</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">{formatPrice(st.start_price, st.currency)}</td>
                      <td className="py-2.5 px-3 text-gray-300">{formatPrice(st.end_price, st.currency)}</td>
                      <td className={clsx("py-2.5 px-3 text-right", getPercentColor(st.return_1w))}>{formatPercent(st.return_1w)}</td>
                      <td className={clsx("py-2.5 px-3 text-right", getPercentColor(st.return_1m))}>{formatPercent(st.return_1m)}</td>
                      <td className={clsx("py-2.5 px-3 text-right", getPercentColor(st.return_3m))}>{formatPercent(st.return_3m)}</td>
                      <td className={clsx("py-2.5 px-3 text-right", getPercentColor(st.return_6m))}>{formatPercent(st.return_6m)}</td>
                      <td className={clsx("py-2.5 px-3 text-right", getPercentColor(st.return_1y))}>{formatPercent(st.return_1y)}</td>
                      <td className={clsx("py-2.5 px-3 text-right", getPercentColor(st.return_ytd))}>{formatPercent(st.return_ytd)}</td>
                      <td className={clsx("py-2.5 px-3 text-right font-bold text-sm bg-blue-900/20 border-l border-r border-blue-800/30", getPercentColor(st.period_return))}>
                        {formatPercent(st.period_return)}
                      </td>
                      <td className={clsx("py-2.5 px-3 text-right", getPercentColor(st.max_return))}>{formatPercent(st.max_return)}</td>
                      <td className={clsx("py-2.5 px-3 text-right", getPercentColor(st.min_return))}>{formatPercent(st.min_return)}</td>
                      <td className={clsx("py-2.5 px-3 text-right", getPercentColor(st.mean_return))}>{formatPercent(st.mean_return)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-300">{st.volatility != null ? `${st.volatility.toFixed(2)}%` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Correlation Analysis Section (when >= 2 items) */}
      {selectedItems.length >= 2 && (
        <div className="flex flex-col bg-gray-900/70 border border-gray-800 rounded-2xl p-4 md:p-5 backdrop-blur-md shadow-xl gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔗</span>
                <span>종목간 상관계수 분석</span>
              </h2>
              <span className="text-xs text-gray-400">
                (일일 수익률 기준 공통 거래일 연산)
              </span>
            </div>

            {/* Period Tabs */}
            <div className="flex items-center gap-1 bg-gray-800/90 p-0.5 rounded-lg border border-gray-700">
              {(["3M", "6M", "12M", "3Y"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActiveCorrPeriod(p)}
                  className={clsx(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all",
                    activeCorrPeriod === p
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Correlation Grid: Heatmap + Rolling Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Heatmap Matrix */}
            <div className="lg:col-span-5 flex flex-col bg-gray-950/50 border border-gray-800/80 rounded-xl p-4">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span>🟦</span>
                <span>{activeCorrPeriod} 상관계수 히트맵</span>
              </h3>

              {corrMatrix && corrMatrix.labels.length > 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 overflow-x-auto">
                  <table className="text-xs border-collapse font-mono">
                    <thead>
                      <tr>
                        <th className="p-2"></th>
                        {corrMatrix.labels.map((lbl, idx) => (
                          <th key={idx} className="p-2 text-gray-400 font-sans font-semibold truncate max-w-[100px] text-center">
                            {lbl}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {corrMatrix.labels.map((rowLbl, rIdx) => (
                        <tr key={rIdx}>
                          <td className="p-2 text-gray-400 font-sans font-semibold truncate max-w-[100px] text-right">
                            {rowLbl}
                          </td>
                          {corrMatrix.matrix[rIdx]?.map((val, cIdx) => {
                            const { bg, text } = getCorrCellColor(val);
                            return (
                              <td
                                key={cIdx}
                                className={clsx(
                                  "p-3 text-center rounded m-0.5 border border-gray-900 transition-transform hover:scale-105",
                                  bg,
                                  text
                                )}
                                title={`${rowLbl} vs ${corrMatrix.labels[cIdx]}: ${val != null ? val.toFixed(2) : "N/A"}`}
                              >
                                {val != null ? val.toFixed(2) : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Legend Indicator */}
                  <div className="flex items-center gap-2 mt-4 text-[10px] text-gray-400">
                    <span className="text-red-400 font-bold">-1.0 (음의 상관)</span>
                    <div className="w-24 h-2 rounded bg-gradient-to-r from-red-600 via-gray-700 to-blue-600 border border-gray-600" />
                    <span className="text-blue-400 font-bold">+1.0 (양의 상관)</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-xs">
                  <span>해당 기간({activeCorrPeriod})의 공통 거래일 데이터가 부족합니다 (최소 20거래일 필요)</span>
                </div>
              )}
            </div>

            {/* Rolling Trend Chart */}
            <div className="lg:col-span-7 flex flex-col bg-gray-950/50 border border-gray-800/80 rounded-xl p-4">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>📈</span>
                <span>{activeCorrPeriod} 30일 롤링 상관계수 추세선</span>
              </h3>

              <div className="w-full h-64 md:h-72 relative">
                <div ref={rollingContainerRef} className="w-full h-full" />
              </div>

              {/* Rolling chart legend with toggle */}
              {returnData?.rolling_correlations?.[activeCorrPeriod] && (
                <div className="flex flex-wrap items-center justify-center gap-3 mt-2 pt-2 border-t border-gray-800/60">
                  {returnData.rolling_correlations[activeCorrPeriod].map((pair, idx) => {
                    const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
                    const isHidden = hiddenRollingPairs.has(pair.pair);
                    return (
                      <button
                        key={pair.pair}
                        type="button"
                        onClick={() => toggleRollingPairVisibility(pair.pair)}
                        className={clsx(
                          "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer select-none",
                          isHidden
                            ? "bg-gray-800/40 text-gray-500 border-gray-700/40 opacity-50"
                            : "bg-gray-800/80 text-gray-200 border-gray-700 hover:bg-gray-700 shadow-sm"
                        )}
                        title={isHidden ? "클릭하여 추세선 표시" : "클릭하여 추세선 숨김"}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: isHidden ? "#64748b" : color }}
                        />
                        <span className={clsx("font-semibold", isHidden && "line-through")}>
                          {pair.pair}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
