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

export const MAIN_INVESTOR_CONFIG = {
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
} as const;

export const INSTITUTIONAL_SUB_ENTITIES = [
  { key: "금융투자", label: "금융투자", color: "#f59e0b" },
  { key: "연기금", label: "연기금", color: "#84cc16" },
  { key: "투신", label: "투신", color: "#c026d3" },
  { key: "사모", label: "사모", color: "#7c3aed" },
  { key: "기타기관", label: "기타(보험/은행 등)", color: "#64748b" },
] as const;

export interface InstitutionalBreakdown {
  items: Array<{ key: string; label: string; value: number; color: string }>;
  positives: Array<{ key: string; label: string; value: number; color: string }>;
  negatives: Array<{ key: string; label: string; value: number; color: string }>;
  posSum: number;
  negSum: number;
  instTotal: number;
}

export function getInstitutionalBreakdown(
  bin: SupplyDemandPriceProfileBin,
  activeSubKeys?: Set<string>
): InstitutionalBreakdown {
  const geumtu = Number(bin["금융투자"] || 0);
  const yeon = Number(bin["연기금"] || 0);
  const tusin = Number(bin["투신"] || 0);
  const samo = Number(bin["사모"] || 0);
  const bohum = Number(bin["보험"] || 0);
  const eunhaeng = Number(bin["은행"] || 0);
  const gitafin = Number(bin["기타금융"] || 0);
  const gita = bohum + eunhaeng + gitafin;
  const instTotal = Number(bin["기관계"] || (geumtu + yeon + tusin + samo + gita));

  const allItems = [
    { key: "금융투자", label: "금융투자", value: geumtu, color: "#f59e0b" },
    { key: "연기금", label: "연기금", value: yeon, color: "#84cc16" },
    { key: "투신", label: "투신", value: tusin, color: "#c026d3" },
    { key: "사모", label: "사모", value: samo, color: "#7c3aed" },
    { key: "기타기관", label: "기타(보험/은행 등)", value: gita, color: "#64748b" },
  ];

  const filteredItems = activeSubKeys
    ? allItems.filter((item) => activeSubKeys.has(item.key))
    : allItems;

  const positives = filteredItems.filter((item) => item.value > 0);
  const negatives = filteredItems.filter((item) => item.value < 0);
  const posSum = positives.reduce((acc, curr) => acc + curr.value, 0);
  const negSum = negatives.reduce((acc, curr) => acc + Math.abs(curr.value), 0);

  return {
    items: filteredItems,
    positives,
    negatives,
    posSum,
    negSum,
    instTotal,
  };
}

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
  const [visibleEntities, setVisibleEntities] = useState<Record<string, boolean>>({
    개인: true,
    외국인: true,
    기관계: true,
  });
  const [visibleSubInstitutions, setVisibleSubInstitutions] = useState<Record<string, boolean>>({
    금융투자: true,
    연기금: true,
    투신: true,
    사모: true,
    기타기관: true,
  });
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

  const handleToggleMainEntity = (key: "개인" | "외국인" | "기관계") => {
    setVisibleEntities((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleSubInstitution = (key: string) => {
    setVisibleSubInstitutions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const activeSubKeysSet = useMemo(() => {
    const set = new Set<string>();
    Object.entries(visibleSubInstitutions).forEach(([k, v]) => {
      if (v) set.add(k);
    });
    return set;
  }, [visibleSubInstitutions]);

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

  // Max absolute value across 3 main bars (개인, 외국인, 기관계 positive/negative sums) for horizontal scaling
  const maxAbsValue = useMemo(() => {
    if (!data?.bins || data.bins.length === 0) return 100000;
    let max = 0;
    for (const b of data.bins) {
      if (visibleEntities["개인"]) {
        max = Math.max(max, Math.abs(Number(b["개인"] || 0)));
      }
      if (visibleEntities["외국인"]) {
        max = Math.max(max, Math.abs(Number(b["외국인"] || 0)));
      }
      if (visibleEntities["기관계"]) {
        const instBreakdown = getInstitutionalBreakdown(b, activeSubKeysSet);
        max = Math.max(max, instBreakdown.posSum, instBreakdown.negSum);
      }
    }
    return getNiceMaxDomain(max);
  }, [data?.bins, visibleEntities, activeSubKeysSet]);

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
  const rowHeightPx = 68;
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
            기본 1Y 매물대 (개인·외국인·기관계 3대 주체 통합)
          </span>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4">
        {/* 2. Subtitle & Interactive Legend: 3 Main Entities + Institutional Sub-forces */}
        <div className="flex flex-col gap-2.5 border-b border-gray-100 pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
            <div className="text-xs sm:text-sm font-semibold text-gray-800">
              {name} 매물대 - 개인 / 외국인 / 기관계 (금융투자·연기금·투신·사모·기타)
            </div>

            {/* 3 Main Bars + Price Line Toggle */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* 개인 Toggle */}
              <button
                type="button"
                onClick={() => handleToggleMainEntity("개인")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                  visibleEntities["개인"]
                    ? "bg-white shadow-xs font-semibold"
                    : "bg-gray-100 text-gray-400 border-gray-200 opacity-60 line-through"
                }`}
                style={{
                  borderColor: visibleEntities["개인"] ? "#2563eb" : undefined,
                  color: visibleEntities["개인"] ? "#2563eb" : undefined,
                }}
                title="개인 바 토글"
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: visibleEntities["개인"] ? "#2563eb" : "#9ca3af" }}
                />
                <span>개인</span>
              </button>

              {/* 외국인 Toggle */}
              <button
                type="button"
                onClick={() => handleToggleMainEntity("외국인")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                  visibleEntities["외국인"]
                    ? "bg-white shadow-xs font-semibold"
                    : "bg-gray-100 text-gray-400 border-gray-200 opacity-60 line-through"
                }`}
                style={{
                  borderColor: visibleEntities["외국인"] ? "#dc2626" : undefined,
                  color: visibleEntities["외국인"] ? "#dc2626" : undefined,
                }}
                title="외국인 바 토글"
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: visibleEntities["외국인"] ? "#dc2626" : "#9ca3af" }}
                />
                <span>외국인</span>
              </button>

              {/* 기관계 Toggle */}
              <button
                type="button"
                onClick={() => handleToggleMainEntity("기관계")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                  visibleEntities["기관계"]
                    ? "bg-white shadow-xs font-semibold"
                    : "bg-gray-100 text-gray-400 border-gray-200 opacity-60 line-through"
                }`}
                style={{
                  borderColor: visibleEntities["기관계"] ? "#15803d" : undefined,
                  color: visibleEntities["기관계"] ? "#15803d" : undefined,
                }}
                title="기관계 전체 바 토글"
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: visibleEntities["기관계"] ? "#15803d" : "#9ca3af" }}
                />
                <span>기관계 (통합 바)</span>
              </button>

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
            </div>
          </div>

          {/* Institutional Sub-categories Legend & Toggles (기관계 내부 색상 가이드) */}
          <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50/90 rounded border border-gray-200 text-xs">
            <span className="text-gray-700 text-[11px] font-bold mr-1 flex items-center gap-1">
              <span>기관계 내부 세부 세력:</span>
            </span>
            {INSTITUTIONAL_SUB_ENTITIES.map((sub) => {
              const isChecked = visibleSubInstitutions[sub.key] !== false;
              return (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => handleToggleSubInstitution(sub.key)}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs transition-all ${
                    isChecked
                      ? "bg-white font-medium shadow-xs"
                      : "bg-gray-200 text-gray-400 border-gray-300 opacity-60 line-through"
                  }`}
                  style={{
                    borderColor: isChecked ? sub.color : undefined,
                    color: isChecked ? sub.color : undefined,
                  }}
                  title={`${sub.label} 토글`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: isChecked ? sub.color : "#9ca3af" }}
                  />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>
        </div>

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
                  {/* 개인 */}
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-blue-600" />
                    <span className="text-gray-600">개인:</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        Number(hoveredBin["개인"] || 0) > 0
                          ? "text-red-600"
                          : Number(hoveredBin["개인"] || 0) < 0
                          ? "text-blue-600"
                          : "text-gray-500"
                      }`}
                    >
                      {formatNumberCommas(Number(hoveredBin["개인"] || 0))}주
                    </span>
                  </span>

                  {/* 외국인 */}
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-red-600" />
                    <span className="text-gray-600">외국인:</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        Number(hoveredBin["외국인"] || 0) > 0
                          ? "text-red-600"
                          : Number(hoveredBin["외국인"] || 0) < 0
                          ? "text-blue-600"
                          : "text-gray-500"
                      }`}
                    >
                      {formatNumberCommas(Number(hoveredBin["외국인"] || 0))}주
                    </span>
                  </span>

                  {/* 기관계 합계 & 세부 */}
                  {(() => {
                    const inst = getInstitutionalBreakdown(hoveredBin);
                    return (
                      <span className="inline-flex items-center gap-1 bg-gray-100/80 px-1.5 py-0.5 rounded border border-gray-200">
                        <span className="w-2 h-2 rounded-xs bg-emerald-700" />
                        <span className="font-bold text-gray-800">기관계:</span>
                        <span
                          className={`font-bold tabular-nums ${
                            inst.instTotal > 0
                              ? "text-red-600"
                              : inst.instTotal < 0
                              ? "text-blue-600"
                              : "text-gray-600"
                          }`}
                        >
                          {formatNumberCommas(inst.instTotal)}주
                        </span>
                        <span className="text-[10px] text-gray-500 ml-1">
                          (금투: {formatUnitShort(Number(hoveredBin["금융투자"] || 0))}, 연기금:{" "}
                          {formatUnitShort(Number(hoveredBin["연기금"] || 0))}, 투신:{" "}
                          {formatUnitShort(Number(hoveredBin["투신"] || 0))}, 사모:{" "}
                          {formatUnitShort(Number(hoveredBin["사모"] || 0))})
                        </span>
                      </span>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-[11px] text-gray-400">
                  마우스를 올리면 개인·외국인·기관계 및 기관 세부 순매수가 표시됩니다.
                </div>
              )}
            </div>

            {/* UNIFIED CHART: Volume Profile with Overlaid Stock Close Price Path */}
            <div className="relative border border-gray-200 rounded-lg bg-white overflow-x-auto shadow-xs">
              <div className="min-w-[720px]">
                {/* Chart Header Bar */}
                <div className="grid grid-cols-[140px_1fr] bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-700 py-2">
                  <div className="px-3 text-center border-r border-gray-200">
                    가격대(원)
                  </div>
                  <div className="px-3 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 font-normal">
                      시작: {data.start}
                    </span>
                    <span className="font-bold text-gray-800">
                      순매수(주) — 개인 / 외국인 / 기관계 (내부 다색 분할)
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
                  {/* Layer 1: Price Bin Rows with 3 Main Bars (개인, 외국인, 기관계) */}
                  <div className="absolute inset-0 flex flex-col justify-between divide-y divide-gray-100 z-0">
                    {displayBins.map((bin) => {
                      const isHovered = hoveredBin?.bin_index === bin.bin_index;
                      const gaeinVal = Number(bin["개인"] || 0);
                      const foreignVal = Number(bin["외국인"] || 0);
                      const instBreakdown = getInstitutionalBreakdown(bin, activeSubKeysSet);

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

                          {/* Right: 3 Horizontal Bars centered at 0 */}
                          <div className="relative px-2 py-1 flex flex-col justify-center gap-1">
                            {/* Vertical Background Grid Lines aligned with xTicks */}
                            <div
                              className="absolute inset-0 pointer-events-none px-2"
                              aria-hidden
                            >
                              {xTicks.map((tick, idx) => {
                                const isCenter = tick === 0;
                                const isEdge = idx === 0 || idx === xTicks.length - 1;
                                if (isEdge) return null;
                                return (
                                  <div
                                    key={tick}
                                    className={`absolute top-0 bottom-0 ${
                                      isCenter
                                        ? "border-r border-gray-400 border-dashed"
                                        : "border-r border-gray-100"
                                    }`}
                                    style={{
                                      left: `calc(8px + (100% - 16px) * ${idx / (xTicks.length - 1)})`,
                                    }}
                                  />
                                );
                              })}
                            </div>

                            {/* BAR 1: 개인 (Blue) */}
                            {visibleEntities["개인"] && (
                              <div
                                className="relative flex items-center h-2.5 w-full z-10"
                                title={`개인: ${gaeinVal.toLocaleString()}주`}
                              >
                                {/* Left half (Negative) */}
                                <div className="w-1/2 flex justify-end relative h-full">
                                  {gaeinVal < 0 && (
                                    <div
                                      className="h-full rounded-l transition-all duration-300"
                                      style={{
                                        width: `${Math.min((Math.abs(gaeinVal) / maxAbsValue) * 100, 100)}%`,
                                        backgroundColor: "#2563eb",
                                        opacity: 0.85,
                                      }}
                                    />
                                  )}
                                </div>
                                {/* Center 0 */}
                                <div className="w-[1px] h-full bg-gray-400 shrink-0 z-20" />
                                {/* Right half (Positive) */}
                                <div className="w-1/2 flex justify-start relative h-full">
                                  {gaeinVal > 0 && (
                                    <div
                                      className="h-full rounded-r transition-all duration-300"
                                      style={{
                                        width: `${Math.min((gaeinVal / maxAbsValue) * 100, 100)}%`,
                                        backgroundColor: "#2563eb",
                                        opacity: 0.85,
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* BAR 2: 외국인 (Red) */}
                            {visibleEntities["외국인"] && (
                              <div
                                className="relative flex items-center h-2.5 w-full z-10"
                                title={`외국인: ${foreignVal.toLocaleString()}주`}
                              >
                                {/* Left half (Negative) */}
                                <div className="w-1/2 flex justify-end relative h-full">
                                  {foreignVal < 0 && (
                                    <div
                                      className="h-full rounded-l transition-all duration-300"
                                      style={{
                                        width: `${Math.min((Math.abs(foreignVal) / maxAbsValue) * 100, 100)}%`,
                                        backgroundColor: "#dc2626",
                                        opacity: 0.85,
                                      }}
                                    />
                                  )}
                                </div>
                                {/* Center 0 */}
                                <div className="w-[1px] h-full bg-gray-400 shrink-0 z-20" />
                                {/* Right half (Positive) */}
                                <div className="w-1/2 flex justify-start relative h-full">
                                  {foreignVal > 0 && (
                                    <div
                                      className="h-full rounded-r transition-all duration-300"
                                      style={{
                                        width: `${Math.min((foreignVal / maxAbsValue) * 100, 100)}%`,
                                        backgroundColor: "#dc2626",
                                        opacity: 0.85,
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* BAR 3: 기관계 (Multi-colored Segmented Single Bar) */}
                            {visibleEntities["기관계"] && (
                              <div
                                className="relative flex items-center h-3 w-full z-10 rounded-xs"
                                title={`기관계 총합: ${instBreakdown.instTotal.toLocaleString()}주`}
                              >
                                {/* Left half (Negative Selling Sub-institutions stacked from 0 to left) */}
                                <div className="w-1/2 flex justify-end relative h-full">
                                  {instBreakdown.negatives.map((seg, sIdx) => {
                                    const widthPct = Math.min((Math.abs(seg.value) / maxAbsValue) * 100, 100);
                                    const isOuterLeft = sIdx === instBreakdown.negatives.length - 1;
                                    return (
                                      <div
                                        key={seg.key}
                                        className={`h-full transition-all duration-300 ${
                                          isOuterLeft ? "rounded-l" : ""
                                        }`}
                                        style={{
                                          width: `${widthPct}%`,
                                          backgroundColor: seg.color,
                                          opacity: 0.9,
                                        }}
                                        title={`기관계 > ${seg.label}: ${seg.value.toLocaleString()}주`}
                                      />
                                    );
                                  })}
                                </div>

                                {/* Center 0 */}
                                <div className="w-[1px] h-full bg-gray-500 shrink-0 z-20" />

                                {/* Right half (Positive Buying Sub-institutions stacked from 0 to right) */}
                                <div className="w-1/2 flex justify-start relative h-full">
                                  {instBreakdown.positives.map((seg, sIdx) => {
                                    const widthPct = Math.min((seg.value / maxAbsValue) * 100, 100);
                                    const isOuterRight = sIdx === instBreakdown.positives.length - 1;
                                    return (
                                      <div
                                        key={seg.key}
                                        className={`h-full transition-all duration-300 ${
                                          isOuterRight ? "rounded-r" : ""
                                        }`}
                                        style={{
                                          width: `${widthPct}%`,
                                          backgroundColor: seg.color,
                                          opacity: 0.9,
                                        }}
                                        title={`기관계 > ${seg.label}: ${seg.value.toLocaleString()}주`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}
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
              <div className="p-3 bg-gray-50 rounded border border-gray-200 flex flex-col gap-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-1.5">
                  <div className="text-gray-800 font-bold">
                    기간 전체 3대 주체 순매수 합계 ({data.label}):
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 tabular-nums">
                    {/* 개인 */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs bg-blue-600" />
                      <span className="text-gray-600 font-medium">개인:</span>
                      <span
                        className={`font-bold ${
                          Number(data.total_period_sums["개인"] || 0) > 0
                            ? "text-red-600"
                            : Number(data.total_period_sums["개인"] || 0) < 0
                            ? "text-blue-600"
                            : "text-gray-600"
                        }`}
                      >
                        {formatNumberCommas(Number(data.total_period_sums["개인"] || 0))}주 (
                        {formatUnitShort(Number(data.total_period_sums["개인"] || 0))})
                      </span>
                    </div>

                    {/* 외국인 */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs bg-red-600" />
                      <span className="text-gray-600 font-medium">외국인:</span>
                      <span
                        className={`font-bold ${
                          Number(data.total_period_sums["외국인"] || 0) > 0
                            ? "text-red-600"
                            : Number(data.total_period_sums["외국인"] || 0) < 0
                            ? "text-blue-600"
                            : "text-gray-600"
                        }`}
                      >
                        {formatNumberCommas(Number(data.total_period_sums["외국인"] || 0))}주 (
                        {formatUnitShort(Number(data.total_period_sums["외국인"] || 0))})
                      </span>
                    </div>

                    {/* 기관계 */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs bg-emerald-700" />
                      <span className="text-gray-600 font-medium">기관계:</span>
                      <span
                        className={`font-bold ${
                          Number(data.total_period_sums["기관계"] || 0) > 0
                            ? "text-red-600"
                            : Number(data.total_period_sums["기관계"] || 0) < 0
                            ? "text-blue-600"
                            : "text-gray-600"
                        }`}
                      >
                        {formatNumberCommas(Number(data.total_period_sums["기관계"] || 0))}주 (
                        {formatUnitShort(Number(data.total_period_sums["기관계"] || 0))})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Institutional Sub-breakdown details in footer */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600 pt-0.5">
                  <span className="font-semibold text-gray-700">기관계 내부 세부:</span>
                  {INSTITUTIONAL_SUB_ENTITIES.map((sub) => {
                    let val = 0;
                    if (sub.key === "기타기관") {
                      val =
                        Number(data.total_period_sums["보험"] || 0) +
                        Number(data.total_period_sums["은행"] || 0) +
                        Number(data.total_period_sums["기타금융"] || 0);
                    } else {
                      val = Number(data.total_period_sums[sub.key] || 0);
                    }
                    return (
                      <span key={sub.key} className="inline-flex items-center gap-1 tabular-nums">
                        <span
                          className="w-2 h-2 rounded-xs"
                          style={{ backgroundColor: sub.color }}
                        />
                        <span>{sub.label}:</span>
                        <span
                          className={`font-semibold ${
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
