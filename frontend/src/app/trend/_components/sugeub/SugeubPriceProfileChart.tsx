"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  useSupplyDemandPriceProfile,
  type PriceProfileParams,
} from "@/hooks/useSupplyDemand";
import type {
  SupplyDemandPriceProfileBin,
  PriceProfilePoint,
} from "@/lib/api";

export interface SugeubPriceProfileChartProps {
  code: string;
  name: string;
  defaultFirstDate?: string;
  defaultLastDate?: string;
}

type ProfilePreset = "1m" | "3m" | "6m" | "1y" | "3y" | "ytd" | "all";

const PRESETS: { id: ProfilePreset; label: string }[] = [
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y (기본)" },
  { id: "3y", label: "3Y" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "전체" },
];

const BIN_OPTIONS = [5, 7, 10, 15];

export const INVESTOR_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  개인: {
    label: "개인",
    color: "#2563eb",
  },
  외국인: {
    label: "외국인",
    color: "#dc2626",
  },
  기관계: {
    label: "기관계",
    color: "#15803d",
  },
  연기금: {
    label: "연기금 등",
    color: "#84cc16",
  },
};

const EXTRA_INVESTORS: Record<
  string,
  { label: string; color: string }
> = {
  금융투자: {
    label: "금융투자",
    color: "#f59e0b",
  },
  투신: {
    label: "투신",
    color: "#c026d3",
  },
  사모: {
    label: "사모",
    color: "#7c3aed",
  },
  기타법인: {
    label: "기타법인",
    color: "#78716c",
  },
};

function formatKoreanDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[0]}년 ${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일`;
}

function formatUnitShort(num: number): string {
  const abs = Math.abs(num);
  const sign = num > 0 ? "+" : num < 0 ? "-" : "";
  if (abs >= 100000000) {
    return `${sign}${(abs / 100000000).toFixed(1)}억`;
  }
  if (abs >= 10000) {
    return `${sign}${(abs / 10000).toFixed(0)}만`;
  }
  return `${sign}${abs.toLocaleString()}`;
}

function formatNumberCommas(num: number): string {
  const sign = num > 0 ? "+" : "";
  return `${sign}${Math.round(num).toLocaleString()}`;
}

function getNiceMaxDomain(maxVal: number): number {
  if (maxVal <= 0) return 100000;
  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const norm = maxVal / mag;
  let niceNorm = 1;
  if (norm <= 1) niceNorm = 1;
  else if (norm <= 1.5) niceNorm = 1.5;
  else if (norm <= 2) niceNorm = 2;
  else if (norm <= 2.5) niceNorm = 2.5;
  else if (norm <= 3) niceNorm = 3;
  else if (norm <= 4) niceNorm = 4;
  else if (norm <= 5) niceNorm = 5;
  else if (norm <= 6) niceNorm = 6;
  else if (norm <= 8) niceNorm = 8;
  else niceNorm = 10;
  return niceNorm * mag;
}

export function SugeubPriceProfileChart({
  code,
  name,
  defaultFirstDate,
  defaultLastDate,
}: SugeubPriceProfileChartProps) {
  const [activePreset, setActivePreset] = useState<ProfilePreset>("1y");
  const [customApplied, setCustomApplied] = useState<boolean>(false);
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [binCount, setBinCount] = useState<number>(7);
  const [showPriceLine, setShowPriceLine] = useState<boolean>(true);
  const [visibleInvestors, setVisibleInvestors] = useState<Record<string, boolean>>({
    개인: true,
    외국인: true,
    기관계: true,
    연기금: true,
    금융투자: false,
    투신: false,
    사모: false,
    기타법인: false,
  });
  const [showExtraInvestors, setShowExtraInvestors] = useState<boolean>(false);
  const [hoveredBin, setHoveredBin] = useState<SupplyDemandPriceProfileBin | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  const queryParams: PriceProfileParams = useMemo(() => {
    if (customApplied && customStart && customEnd) {
      return {
        preset: "custom",
        start: customStart,
        end: customEnd,
        bins: binCount,
      };
    }
    return {
      preset: activePreset,
      bins: binCount,
    };
  }, [customApplied, customStart, customEnd, activePreset, binCount]);

  const { data, isLoading, error, refetch } = useSupplyDemandPriceProfile(
    code,
    queryParams,
    !!code
  );

  const handlePresetSelect = (preset: ProfilePreset) => {
    setActivePreset(preset);
    setCustomApplied(false);
  };

  const handleApplyCustom = () => {
    const s = customStart || data?.start || "";
    const e = customEnd || data?.end || "";
    if (s && e) {
      if (s > e) {
        alert("시작일은 종료일보다 이전이어야 합니다.");
        return;
      }
      setCustomStart(s);
      setCustomEnd(e);
      setCustomApplied(true);
    }
  };

  const handleToggleInvestor = (investorKey: string) => {
    setVisibleInvestors((prev) => ({
      ...prev,
      [investorKey]: !prev[investorKey],
    }));
  };

  // 4 main default investors (개인, 외국인, 기관계, 연기금) + any enabled extra investors
  const activeInvestorKeys = useMemo(() => {
    const list = ["개인", "외국인", "기관계", "연기금"];
    if (showExtraInvestors) {
      list.push("금융투자", "투신", "사모", "기타법인");
    }
    return list.filter((k) => visibleInvestors[k]);
  }, [visibleInvestors, showExtraInvestors]);

  // Reverse bins so highest price is at top (same as financial chart / 매물대.png)
  const displayBins = useMemo(() => {
    if (!data?.bins) return [];
    return [...data.bins].reverse();
  }, [data?.bins]);

  // Price Domain bounds across bins for perfect vertical coordinate alignment
  const priceDomain = useMemo(() => {
    if (!displayBins || displayBins.length === 0) {
      return { min: 0, max: 100000 };
    }
    const min = displayBins[displayBins.length - 1].price_low;
    const max = displayBins[0].price_high;
    return { min, max: max === min ? min + 1000 : max };
  }, [displayBins]);

  // Max absolute value across active investors for bar horizontal scaling
  const maxAbsValue = useMemo(() => {
    if (!data?.bins || data.bins.length === 0) return 100000;
    let max = 0;
    for (const b of data.bins) {
      for (const inv of activeInvestorKeys) {
        const val = Math.abs(Number(b[inv] || 0));
        if (val > max) max = val;
      }
    }
    return getNiceMaxDomain(max);
  }, [data?.bins, activeInvestorKeys]);

  // Generate X-axis ticks (e.g. -max, -max/2, 0, +max/2, +max)
  const xTicks = useMemo(() => {
    const step = maxAbsValue / 4;
    const ticks: number[] = [];
    for (let v = -maxAbsValue; v <= maxAbsValue + step * 0.01; v += step) {
      ticks.push(Math.round(v));
    }
    return ticks;
  }, [maxAbsValue]);

  // Price series and stats
  const priceSeries: PriceProfilePoint[] = useMemo(() => {
    return data?.price_series || [];
  }, [data?.price_series]);

  const priceStats = useMemo(() => {
    if (!priceSeries || priceSeries.length === 0) {
      return { min: 0, max: 0, latest: 0, first: 0, returnPct: 0 };
    }
    let min = priceSeries[0].close;
    let max = priceSeries[0].close;
    priceSeries.forEach((p) => {
      if (p.close < min) min = p.close;
      if (p.close > max) max = p.close;
    });
    const first = priceSeries[0].close;
    const latest = priceSeries[priceSeries.length - 1].close;
    const returnPct = first > 0 ? ((latest - first) / first) * 100 : 0;
    return { min, max, latest, first, returnPct };
  }, [priceSeries]);

  const headerStartDate = data?.start ? formatKoreanDate(data.start) : "";
  const headerEndDate = data?.end ? formatKoreanDate(data.end) : "";

  // SVG dimensions for the overlaid stock price path
  const svgViewBoxWidth = 1000;
  const rowHeightPx = 64;
  const totalChartHeightPx = Math.max(300, displayBins.length * rowHeightPx);

  // Calculate SVG Points for the Price Line (X: 0 to 1000, Y: 0 to totalChartHeightPx)
  const priceSvgPoints = useMemo(() => {
    if (priceSeries.length === 0) return [];
    const { min: pMin, max: pMax } = priceDomain;
    const pRange = pMax - pMin || 1;

    return priceSeries.map((p, idx) => {
      const x =
        priceSeries.length > 1
          ? (idx / (priceSeries.length - 1)) * svgViewBoxWidth
          : svgViewBoxWidth / 2;
      const y = (1 - (p.close - pMin) / pRange) * totalChartHeightPx;
      return { x, y, point: p, index: idx };
    });
  }, [priceSeries, priceDomain, totalChartHeightPx]);

  const priceLineD = useMemo(() => {
    if (priceSvgPoints.length === 0) return "";
    return priceSvgPoints
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(" ");
  }, [priceSvgPoints]);

  const priceAreaD = useMemo(() => {
    if (priceSvgPoints.length === 0) return "";
    const firstX = priceSvgPoints[0].x.toFixed(1);
    const lastX = priceSvgPoints[priceSvgPoints.length - 1].x.toFixed(1);
    return `${priceLineD} L ${lastX} ${totalChartHeightPx} L ${firstX} ${totalChartHeightPx} Z`;
  }, [priceLineD, priceSvgPoints, totalChartHeightPx]);

  // Mouse move handler on chart area
  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartContainerRef.current || priceSvgPoints.length === 0) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relX = (clientX / rect.width) * svgViewBoxWidth;

    let closestIdx = 0;
    let minDiff = Infinity;
    priceSvgPoints.forEach((pt, idx) => {
      const diff = Math.abs(pt.x - relX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setHoveredPointIndex(closestIdx);

    const pt = priceSeries[closestIdx];
    if (pt) {
      const matchedBin = displayBins.find(
        (b) => pt.close >= b.price_low && pt.close <= b.price_high
      );
      setHoveredBin(matchedBin || null);
    }
  };

  const handleChartMouseLeave = () => {
    setHoveredPointIndex(null);
    setHoveredBin(null);
  };

  const activeHoveredPoint =
    hoveredPointIndex !== null && hoveredPointIndex < priceSeries.length
      ? priceSeries[hoveredPointIndex]
      : null;
  const activeHoveredCoord =
    hoveredPointIndex !== null && hoveredPointIndex < priceSvgPoints.length
      ? priceSvgPoints[hoveredPointIndex]
      : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden my-4">
      {/* 1. Header with Chesly Style Title */}
      <div className="bg-[#1b5e20] text-white px-4 py-3 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-center sm:text-left">
            {name} 매물대 분석{" "}
            <span className="font-normal text-sm sm:text-base opacity-90">
              {headerStartDate} ~ {headerEndDate}
            </span>
          </h3>
          <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded text-white/90">
            기본 1Y 수급 매물대 + 종가 실선
          </span>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4">
        {/* 2. Subtitle & Interactive Legend (Investors + Price Line Toggle) */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="text-xs sm:text-sm font-semibold text-gray-800">
            {name} 매물대 - 개인 / 외국인 / 기관계 / 연기금 등
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Investor Toggles */}
            {Object.entries(INVESTOR_CONFIG).map(([key, cfg]) => {
              const isChecked = visibleInvestors[key] !== false;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleToggleInvestor(key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                    isChecked
                      ? "bg-white shadow-xs font-semibold"
                      : "bg-gray-100 text-gray-400 border-gray-200 opacity-60 line-through"
                  }`}
                  style={{
                    borderColor: isChecked ? cfg.color : undefined,
                    color: isChecked ? cfg.color : undefined,
                  }}
                  title={`${cfg.label} 토글`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: isChecked ? cfg.color : "#9ca3af" }}
                  />
                  <span>{cfg.label}</span>
                </button>
              );
            })}

            {/* Overlaid Close Price Line Toggle */}
            <button
              type="button"
              onClick={() => setShowPriceLine((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                showPriceLine
                  ? "bg-slate-900 text-white border-slate-900 font-bold shadow-xs"
                  : "bg-gray-100 text-gray-400 border-gray-200 line-through"
              }`}
              title="매물대 내 종가 실선 차트 On/Off"
            >
              <span className="w-3 h-0.5 bg-current rounded shrink-0" />
              <span>종가 실선 차트</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExtraInvestors((v) => !v)}
              className="px-2 py-1 text-[11px] rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 border border-dashed border-gray-300"
            >
              {showExtraInvestors ? "세부 주체 숨기기" : "+ 세부 주체 추가 (금융투자 등)"}
            </button>
          </div>
        </div>

        {/* 2-1. Extra Investors Toggle Bar (if enabled) */}
        {showExtraInvestors && (
          <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
            <span className="text-gray-500 text-[11px] font-medium mr-1">추가 주체:</span>
            {Object.entries(EXTRA_INVESTORS).map(([key, cfg]) => {
              const isChecked = !!visibleInvestors[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleToggleInvestor(key)}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs transition-all ${
                    isChecked
                      ? "bg-white font-medium shadow-xs"
                      : "bg-gray-200 text-gray-400 border-gray-300 opacity-60"
                  }`}
                  style={{
                    borderColor: isChecked ? cfg.color : undefined,
                    color: isChecked ? cfg.color : undefined,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: isChecked ? cfg.color : "#9ca3af" }}
                  />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Controls Bar: Presets & Date Range Inputs */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 p-3 rounded-lg border border-gray-200/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-600 mr-1">기간:</span>
            {PRESETS.map((p) => {
              const isActive = activePreset === p.id && !customApplied;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetSelect(p.id)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    isActive
                      ? "bg-sky-600 text-white font-medium shadow-xs"
                      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart || data?.start || ""}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={customEnd || data?.end || ""}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleApplyCustom}
                className="px-2.5 py-1 rounded bg-sky-50 border border-sky-300 text-sky-700 hover:bg-sky-100 font-medium transition-colors"
              >
                적용
              </button>
            </div>

            <div className="flex items-center gap-1 ml-2 border-l border-gray-300 pl-2">
              <span className="text-gray-500 text-[11px]">구간:</span>
              <select
                value={binCount}
                onChange={(e) => setBinCount(Number(e.target.value))}
                className="bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-700 text-xs focus:outline-hidden"
              >
                {BIN_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}구간
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4. Chart Display Area */}
        {isLoading && !data && (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-500 gap-2">
            <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">수급별 매물대 및 주가 데이터를 분석 중입니다...</span>
          </div>
        )}

        {error && !data && (
          <div className="flex flex-col items-center justify-center min-h-[240px] text-red-600 text-sm gap-2">
            <span>매물대 데이터를 불러오는 데 실패했습니다.</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs text-blue-600 hover:underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {data && displayBins.length > 0 && (
          <div className="space-y-2 select-none">
            {/* Top Unified HUD / Hover Summary Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs flex flex-wrap items-center justify-between gap-2 min-h-[42px]">
              {/* Left: Stock Price HUD */}
              <div className="flex items-center gap-3 font-medium">
                {activeHoveredPoint ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">
                      {activeHoveredPoint.date}:
                    </span>
                    <span className="text-slate-950 font-extrabold tabular-nums">
                      종가 {activeHoveredPoint.close.toLocaleString()}원
                    </span>
                    <span
                      className={`text-[11px] tabular-nums font-bold ${
                        (activeHoveredPoint.change_pct || 0) > 0
                          ? "text-red-600"
                          : (activeHoveredPoint.change_pct || 0) < 0
                          ? "text-blue-600"
                          : "text-gray-500"
                      }`}
                    >
                      ({(activeHoveredPoint.change_pct || 0) > 0 ? "+" : ""}
                      {activeHoveredPoint.change_pct}%)
                    </span>
                    {activeHoveredPoint.volume !== undefined && (
                      <span className="text-gray-500 text-[11px]">
                        거래량: {formatUnitShort(activeHoveredPoint.volume)}주
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="font-bold text-slate-900">주가 현황:</span>
                    <span>최저 {priceStats.min.toLocaleString()}원</span>
                    <span className="text-gray-300">|</span>
                    <span>최고 {priceStats.max.toLocaleString()}원</span>
                    <span className="text-gray-300">|</span>
                    <span className="font-extrabold text-slate-900">
                      현재 {priceStats.latest.toLocaleString()}원
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        priceStats.returnPct >= 0 ? "text-red-600" : "text-blue-600"
                      }`}
                    >
                      ({priceStats.returnPct >= 0 ? "+" : ""}
                      {priceStats.returnPct.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Hovered Bin Investor Detail */}
              {hoveredBin ? (
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="font-bold text-slate-800">
                    구간 {hoveredBin.price_label}원 ({hoveredBin.days}일):
                  </span>
                  {activeInvestorKeys.map((inv) => {
                    const val = Number(hoveredBin[inv] || 0);
                    const cfg = INVESTOR_CONFIG[inv] || EXTRA_INVESTORS[inv];
                    return (
                      <span key={inv} className="inline-flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-xs"
                          style={{ backgroundColor: cfg?.color || "#6b7280" }}
                        />
                        <span className="text-gray-600">{cfg?.label || inv}:</span>
                        <span
                          className={`font-semibold tabular-nums ${
                            val > 0
                              ? "text-red-600"
                              : val < 0
                              ? "text-blue-600"
                              : "text-gray-500"
                          }`}
                        >
                          {formatNumberCommas(val)}주 ({formatUnitShort(val)})
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-gray-400">
                  마우스를 올리면 날짜별 종가 및 가격대별 수급 상세가 실시간 표시됩니다.
                </div>
              )}
            </div>

            {/* UNIFIED CHART: Volume Profile with Overlaid Stock Close Price Path */}
            <div className="relative border border-gray-200 rounded-lg bg-white overflow-x-auto shadow-xs">
              <div className="min-w-[720px]">
                {/* Chart Header Bar with Timeline on Top and Net Buy label */}
                <div className="grid grid-cols-[140px_1fr] bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-700 py-2">
                  <div className="px-3 text-center border-r border-gray-200">
                    가격대(원)
                  </div>
                  <div className="px-3 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 font-normal">
                      시작: {data.start}
                    </span>
                    <span className="font-bold text-gray-800">
                      순매수(주) & 종가 실선 추세 (0 중심축)
                    </span>
                    <span className="text-[11px] text-gray-500 font-normal">
                      종료: {data.end}
                    </span>
                  </div>
                </div>

                {/* Relative Plot Area containing both Bars (Layer 1) and SVG Price Line (Layer 2) */}
                <div
                  ref={chartContainerRef}
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={handleChartMouseLeave}
                  className="relative cursor-crosshair"
                  style={{ height: totalChartHeightPx }}
                >
                  {/* Layer 1: Price Bin Rows with Grouped Investor Bars */}
                  <div className="absolute inset-0 flex flex-col justify-between divide-y divide-gray-100 z-0">
                    {displayBins.map((bin) => {
                      const isHovered = hoveredBin?.bin_index === bin.bin_index;
                      return (
                        <div
                          key={bin.bin_index}
                          onMouseEnter={() => setHoveredBin(bin)}
                          onMouseLeave={() => setHoveredBin(null)}
                          className={`grid grid-cols-[140px_1fr] flex-1 transition-colors ${
                            isHovered ? "bg-amber-50/60" : "hover:bg-gray-50/50"
                          }`}
                        >
                          {/* Left: Price Range Label */}
                          <div className="px-3 py-1 flex flex-col justify-center items-center border-r border-gray-200 text-xs font-medium text-gray-800 tabular-nums select-none bg-white/80">
                            <span>{bin.price_label}</span>
                            <span className="text-[10px] text-gray-400 font-normal">
                              {bin.days}일
                            </span>
                          </div>

                          {/* Right: Grouped Horizontal Bars centered at 0 */}
                          <div className="relative px-2 py-1 flex flex-col justify-center gap-1">
                            {/* Vertical Background Grid Lines */}
                            <div
                              className="absolute inset-0 flex justify-between pointer-events-none px-2"
                              aria-hidden
                            >
                              {xTicks.map((tick) => {
                                const isCenter = tick === 0;
                                return (
                                  <div
                                    key={tick}
                                    className={`h-full border-r ${
                                      isCenter
                                        ? "border-gray-400 border-dashed"
                                        : "border-gray-100"
                                    }`}
                                    style={{ width: `${100 / (xTicks.length - 1)}%` }}
                                  />
                                );
                              })}
                            </div>

                            {/* Horizontal Bars for Each Active Investor */}
                            {activeInvestorKeys.map((inv) => {
                              const val = Number(bin[inv] || 0);
                              const cfg = INVESTOR_CONFIG[inv] || EXTRA_INVESTORS[inv];
                              const abs = Math.abs(val);
                              const widthPct = Math.min((abs / maxAbsValue) * 50, 50);
                              const isPositive = val > 0;
                              const isNegative = val < 0;

                              return (
                                <div
                                  key={inv}
                                  className="relative flex items-center h-2.5 w-full z-10"
                                >
                                  {/* Left half (Negative, 0 to -max) */}
                                  <div className="w-1/2 flex justify-end relative h-full">
                                    {isNegative && (
                                      <div
                                        className="h-full rounded-l transition-all duration-300"
                                        style={{
                                          width: `${widthPct * 2}%`,
                                          backgroundColor: cfg?.color || "#3b82f6",
                                          opacity: 0.85,
                                        }}
                                        title={`${cfg?.label || inv}: ${val.toLocaleString()}주`}
                                      />
                                    )}
                                  </div>

                                  {/* Center 0 baseline */}
                                  <div className="w-[1px] h-full bg-gray-400 shrink-0 z-20" />

                                  {/* Right half (Positive, 0 to +max) */}
                                  <div className="w-1/2 flex justify-start relative h-full">
                                    {isPositive && (
                                      <div
                                        className="h-full rounded-r transition-all duration-300"
                                        style={{
                                          width: `${widthPct * 2}%`,
                                          backgroundColor: cfg?.color || "#ef4444",
                                          opacity: 0.85,
                                        }}
                                        title={`${cfg?.label || inv}: ${val.toLocaleString()}주`}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Layer 2: Overlaid Stock Close Price SVG Path spanning across the bars */}
                  {showPriceLine && (
                    <div className="absolute inset-0 left-[140px] pointer-events-none z-20">
                      <svg
                        viewBox={`0 0 ${svgViewBoxWidth} ${totalChartHeightPx}`}
                        preserveAspectRatio="none"
                        className="w-full h-full overflow-visible"
                      >
                        <defs>
                          <linearGradient id="priceLineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.01" />
                          </linearGradient>
                          <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.3" />
                          </filter>
                        </defs>

                        {/* Subtle Area Fill under Price Line */}
                        {priceAreaD && <path d={priceAreaD} fill="url(#priceLineGrad)" />}

                        {/* Solid Stock Close Price Line */}
                        {priceLineD && (
                          <path
                            d={priceLineD}
                            fill="none"
                            stroke="#0f172a"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#lineGlow)"
                          />
                        )}

                        {/* High/Low Markers */}
                        {priceSvgPoints.length > 0 && (
                          <>
                            {/* Highest Point Marker */}
                            {(() => {
                              const highPt = priceSvgPoints.reduce((prev, curr) =>
                                curr.point.close > prev.point.close ? curr : prev
                              );
                              return (
                                <g>
                                  <circle
                                    cx={highPt.x}
                                    cy={highPt.y}
                                    r="4.5"
                                    fill="#dc2626"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                  />
                                  <text
                                    x={Math.max(30, Math.min(svgViewBoxWidth - 30, highPt.x))}
                                    y={Math.max(16, highPt.y - 8)}
                                    textAnchor="middle"
                                    fill="#b91c1c"
                                    fontSize="11"
                                    fontWeight="bold"
                                    className="bg-white/90 px-1 py-0.5 rounded"
                                  >
                                    최고 {highPt.point.close.toLocaleString()}
                                  </text>
                                </g>
                              );
                            })()}

                            {/* Lowest Point Marker */}
                            {(() => {
                              const lowPt = priceSvgPoints.reduce((prev, curr) =>
                                curr.point.close < prev.point.close ? curr : prev
                              );
                              return (
                                <g>
                                  <circle
                                    cx={lowPt.x}
                                    cy={lowPt.y}
                                    r="4.5"
                                    fill="#2563eb"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                  />
                                  <text
                                    x={Math.max(30, Math.min(svgViewBoxWidth - 30, lowPt.x))}
                                    y={Math.min(totalChartHeightPx - 6, lowPt.y + 14)}
                                    textAnchor="middle"
                                    fill="#1d4ed8"
                                    fontSize="11"
                                    fontWeight="bold"
                                  >
                                    최저 {lowPt.point.close.toLocaleString()}
                                  </text>
                                </g>
                              );
                            })()}

                            {/* Latest Close Point Marker */}
                            {(() => {
                              const lastPt = priceSvgPoints[priceSvgPoints.length - 1];
                              return (
                                <g>
                                  <circle
                                    cx={lastPt.x}
                                    cy={lastPt.y}
                                    r="5"
                                    fill="#0f172a"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                  />
                                </g>
                              );
                            })()}
                          </>
                        )}

                        {/* Interactive Crosshair Tracking on Price Line */}
                        {activeHoveredCoord && activeHoveredPoint && (
                          <g>
                            {/* Vertical Crosshair Line (Timeline cursor) */}
                            <line
                              x1={activeHoveredCoord.x}
                              y1={0}
                              x2={activeHoveredCoord.x}
                              y2={totalChartHeightPx}
                              stroke="#0f172a"
                              strokeWidth="1.5"
                              strokeDasharray="4 2"
                            />
                            {/* Horizontal Crosshair Line (Price cursor) */}
                            <line
                              x1={0}
                              y1={activeHoveredCoord.y}
                              x2={svgViewBoxWidth}
                              y2={activeHoveredCoord.y}
                              stroke="#0f172a"
                              strokeWidth="1.2"
                              strokeDasharray="4 2"
                            />
                            {/* Interactive Cursor Circle */}
                            <circle
                              cx={activeHoveredCoord.x}
                              cy={activeHoveredCoord.y}
                              r="6"
                              fill="#0f172a"
                              stroke="#ffffff"
                              strokeWidth="2.5"
                            />
                          </g>
                        )}
                      </svg>
                    </div>
                  )}
                </div>

                {/* X-Axis Ticks Footer */}
                <div className="grid grid-cols-[140px_1fr] bg-gray-50 border-t border-gray-200 py-1.5 text-[10px] text-gray-500">
                  <div className="border-r border-gray-200 text-center font-medium">
                    0 기준선
                  </div>
                  <div className="relative px-2 flex justify-between tabular-nums">
                    {xTicks.map((tick) => (
                      <span
                        key={tick}
                        className={`text-center ${
                          tick === 0
                            ? "font-bold text-gray-800"
                            : tick < 0
                            ? "text-blue-700 font-medium"
                            : "text-red-700 font-medium"
                        }`}
                      >
                        {formatNumberCommas(tick)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Total Period Sums Summary Card */}
            {data.total_period_sums && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-gray-700 font-semibold">
                  기간 전체 순매수 합계 ({data.label}):
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 tabular-nums">
                  {activeInvestorKeys.map((inv) => {
                    const val = Number(data.total_period_sums[inv] || 0);
                    const cfg = INVESTOR_CONFIG[inv] || EXTRA_INVESTORS[inv];
                    return (
                      <div key={inv} className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-xs"
                          style={{ backgroundColor: cfg?.color || "#6b7280" }}
                        />
                        <span className="text-gray-600">{cfg?.label || inv}:</span>
                        <span
                          className={`font-bold ${
                            val > 0
                              ? "text-red-600"
                              : val < 0
                              ? "text-blue-600"
                              : "text-gray-600"
                          }`}
                        >
                          {formatNumberCommas(val)}주 ({formatUnitShort(val)})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
