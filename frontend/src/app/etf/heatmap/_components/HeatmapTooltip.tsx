"use client";

import { useMemo } from "react";
import { useReturnComparison } from "@/hooks/useReturnComparison";
import { formatReturn } from "../_lib/colors";
import type { ETFItem } from "../_lib/types";
import type { MarketKey } from "../_lib/links";

interface HeatmapTooltipProps {
  etf: ETFItem;
  market?: MarketKey;
}

export function HeatmapTooltip({ etf, market = "KR" }: HeatmapTooltipProps) {
  // Request 1-year price/return series
  const returnItems = useMemo(() => {
    if (!etf) return [];
    const itemType = market === "US" ? "us_etf" : "etf";
    const itemMarket = market === "US" ? "US_ETF" : "ETF";
    return [
      {
        code: etf.code,
        name: etf.name,
        market: itemMarket,
        type: itemType,
      },
    ];
  }, [etf, market]);

  const oneYearRange = useMemo(() => {
    const end = new Date();
    const endStr = end.toISOString().split("T")[0];
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    const startStr = start.toISOString().split("T")[0];
    return { start: startStr, end: endStr };
  }, []);

  const { data: returnData, isLoading } = useReturnComparison(
    returnItems,
    oneYearRange.start,
    oneYearRange.end
  );

  const seriesData = useMemo(() => {
    if (!returnData?.series || returnData.series.length === 0) return [];
    return returnData.series[0].data;
  }, [returnData]);

  const stats = useMemo(() => {
    if (!returnData?.statistics || returnData.statistics.length === 0) return null;
    return returnData.statistics[0];
  }, [returnData]);

  // SVG Line Chart coordinates calculation
  const chartWidth = 300;
  const chartHeight = 120;
  const topPad = 15;
  const bottomPad = 22;
  const leftPad = 8;
  const rightPad = 8;
  const usableWidth = chartWidth - leftPad - rightPad;
  const usableHeight = chartHeight - topPad - bottomPad;

  const chartCalc = useMemo(() => {
    if (!seriesData || seriesData.length < 2) return null;

    const prices = seriesData.map((d) => d.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;

    const n = seriesData.length;
    const points = seriesData.map((d, i) => {
      const x = leftPad + (i / (n - 1)) * usableWidth;
      const y = topPad + usableHeight - ((d.close - minPrice) / range) * usableHeight;
      return { x, y, close: d.close, date: d.date, returnPct: d.return_pct };
    });

    const pathD = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${chartHeight - bottomPad} L ${points[0].x.toFixed(1)} ${chartHeight - bottomPad} Z`;

    const firstPt = points[0];
    const lastPt = points[points.length - 1];

    // Find highest and lowest points
    let maxPt = points[0];
    let minPt = points[0];
    for (const pt of points) {
      if (pt.close > maxPt.close) maxPt = pt;
      if (pt.close < minPt.close) minPt = pt;
    }

    // 1-year total return
    const totalReturn = ((lastPt.close - firstPt.close) / firstPt.close) * 100;
    const isUp = totalReturn >= 0;

    return {
      points,
      pathD,
      areaD,
      firstPt,
      lastPt,
      maxPt,
      minPt,
      minPrice,
      maxPrice,
      totalReturn,
      isUp,
      startDate: seriesData[0].date,
      endDate: seriesData[seriesData.length - 1].date,
    };
  }, [seriesData, usableWidth, usableHeight]);

  // Format marcap
  const marcapText = useMemo(() => {
    if (!etf.marcap) return null;
    return etf.marcap >= 10000
      ? `${(etf.marcap / 10000).toFixed(1)}조원`
      : `${etf.marcap.toLocaleString()}억원`;
  }, [etf.marcap]);

  const currencySymbol = stats?.currency === "USD" ? "$" : "₩";

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 w-88 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-700 bg-gray-900/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between border-b border-gray-800 pb-2">
        <div className="min-w-0 flex-1 pr-2">
          <h4 className="text-sm font-bold text-white truncate">{etf.name}</h4>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-gray-400">
            <span>{etf.code}</span>
            {etf.sector && (
              <>
                <span>·</span>
                <span className="text-gray-300">{etf.sector}</span>
              </>
            )}
            {marcapText && (
              <>
                <span>·</span>
                <span className="text-gray-400">시총 {marcapText}</span>
              </>
            )}
          </div>
        </div>

        {/* 1Y Return Badge or 1D Badge */}
        {chartCalc ? (
          <div
            className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs font-bold ${
              chartCalc.isUp
                ? "bg-red-950/70 text-red-400 border border-red-800/50"
                : "bg-blue-950/70 text-blue-400 border border-blue-800/50"
            }`}
          >
            1년 {chartCalc.totalReturn >= 0 ? "+" : ""}
            {chartCalc.totalReturn.toFixed(2)}%
          </div>
        ) : etf.returns?.["1D"] != null ? (
          <div
            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-bold ${
              etf.returns["1D"] > 0
                ? "bg-red-950/60 text-red-400 border border-red-800/50"
                : etf.returns["1D"] < 0
                  ? "bg-blue-950/60 text-blue-400 border border-blue-800/50"
                  : "bg-gray-800 text-gray-300"
            }`}
          >
            1D {formatReturn(etf.returns["1D"])}
          </div>
        ) : null}
      </div>

      {/* 1-Year Line Chart Viewport */}
      <div className="relative">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-300">
          <span className="flex items-center gap-1 text-gray-200">
            <span>📈</span> 최근 1년 주가 추이 (실선 차트)
          </span>
          {stats?.end_price != null && (
            <span className="font-mono text-xs font-bold text-gray-100">
              {currencySymbol}
              {stats.currency === "USD"
                ? stats.end_price.toLocaleString("en-US", { minimumFractionDigits: 2 })
                : stats.end_price.toLocaleString("ko-KR")}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-[120px] w-full items-center justify-center rounded-lg bg-gray-950/40">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent mb-1" />
            <span className="ml-2 text-xs text-gray-400">차트 로딩 중...</span>
          </div>
        ) : chartCalc ? (
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full select-none"
            role="img"
            aria-label={`${etf.name} 최근 1년 주가 실선 차트`}
          >
            <defs>
              <linearGradient
                id={`gradient-${etf.code}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={chartCalc.isUp ? "#ef4444" : "#3b82f6"}
                  stopOpacity="0.35"
                />
                <stop
                  offset="100%"
                  stopColor={chartCalc.isUp ? "#ef4444" : "#3b82f6"}
                  stopOpacity="0.0"
                />
              </linearGradient>
            </defs>

            {/* Start Price Baseline (Dashed) */}
            <line
              x1={leftPad}
              y1={chartCalc.firstPt.y}
              x2={chartWidth - rightPad}
              y2={chartCalc.firstPt.y}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.5"
            />

            {/* Area Fill */}
            <path
              d={chartCalc.areaD}
              fill={`url(#gradient-${etf.code})`}
            />

            {/* Main Line */}
            <path
              d={chartCalc.pathD}
              fill="none"
              stroke={chartCalc.isUp ? "#f87171" : "#60a5fa"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Highest point marker */}
            <circle
              cx={chartCalc.maxPt.x}
              cy={chartCalc.maxPt.y}
              r="2.5"
              fill="#ef4444"
            />

            {/* Lowest point marker */}
            <circle
              cx={chartCalc.minPt.x}
              cy={chartCalc.minPt.y}
              r="2.5"
              fill="#3b82f6"
            />

            {/* Last Price Point (Glowing Dot) */}
            <circle
              cx={chartCalc.lastPt.x}
              cy={chartCalc.lastPt.y}
              r="3.5"
              fill={chartCalc.isUp ? "#f87171" : "#60a5fa"}
              stroke="#ffffff"
              strokeWidth="1.5"
            />

            {/* Dates on X-axis */}
            <text
              x={leftPad}
              y={chartHeight - 4}
              fontSize="9"
              fill="#64748b"
              textAnchor="start"
              fontFamily="monospace"
            >
              {chartCalc.startDate}
            </text>
            <text
              x={chartWidth - rightPad}
              y={chartHeight - 4}
              fontSize="9"
              fill="#64748b"
              textAnchor="end"
              fontFamily="monospace"
            >
              {chartCalc.endDate}
            </text>
          </svg>
        ) : (
          <div className="flex h-[120px] w-full items-center justify-center rounded-lg bg-gray-950/40 text-xs text-gray-500">
            시계열 차트 데이터 없음
          </div>
        )}
      </div>

      {/* Footer helper note */}
      <div className="mt-2 flex items-center justify-between border-t border-gray-800/80 pt-1.5 text-[10px] text-sky-400">
        <span>클릭 시 상세 모달 및 3가지 바로가기</span>
        <span>↗</span>
      </div>
    </div>
  );
}
