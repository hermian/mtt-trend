"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineSeries,
  LineStyle,
} from "lightweight-charts";
import { useReturnComparison } from "@/hooks/useReturnComparison";
import { getStreamlitSearchUrl } from "@/lib/streamlitUrl";
import { etfLink, type MarketKey } from "../_lib/links";
import { formatReturn } from "../_lib/colors";
import { PERIODS, type ETFItem, type PeriodKey } from "../_lib/types";
import { toChartTime } from "@/app/trend/_components/_lib/chartTime";

export interface ETFDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  etf: ETFItem | null;
  market?: MarketKey;
  selectedPeriod?: PeriodKey;
}

export function ETFDetailModal({
  isOpen,
  onClose,
  etf,
  market = "KR",
  selectedPeriod = "1D",
}: ETFDetailModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [hoveredData, setHoveredData] = useState<{
    date: string;
    returnPct: number;
  } | null>(null);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Destination URLs
  const streamlitUrl = useMemo(() => {
    if (!etf) return "";
    const streamlitType = market === "US" ? "us_etf" : "etf";
    return getStreamlitSearchUrl(etf.name, streamlitType);
  }, [etf, market]);

  const avwapUrl = useMemo(() => {
    if (!etf) return "";
    const country = market === "US" ? "us" : "kr";
    return `/trend?tab=avwap&symbol=${encodeURIComponent(etf.code)}&name=${encodeURIComponent(etf.name)}&type=etf&country=${country}`;
  }, [etf, market]);

  const naverUrl = useMemo(() => {
    if (!etf) return "";
    return etfLink(etf, market);
  }, [etf, market]);

  // Request item for 1-year return data
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

  // 1-year date range calculation
  const oneYearRange = useMemo(() => {
    const end = new Date();
    const endStr = end.toISOString().split("T")[0];
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    const startStr = start.toISOString().split("T")[0];
    return { start: startStr, end: endStr };
  }, []);

  const { data: returnData, isLoading, error } = useReturnComparison(
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

  // Initialize and update Lightweight Charts
  useEffect(() => {
    if (!isOpen || !chartContainerRef.current) return;

    // Clean up previous chart
    if (chartApiRef.current) {
      chartApiRef.current.remove();
      chartApiRef.current = null;
      seriesRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 550,
      height: 240,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(51, 65, 85, 0.25)" },
        horzLines: { color: "rgba(51, 65, 85, 0.25)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(148, 163, 184, 0.4)",
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: "rgba(148, 163, 184, 0.4)",
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(51, 65, 85, 0.4)",
        visible: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderColor: "rgba(51, 65, 85, 0.4)",
        timeVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const lineSeries = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: {
        type: "custom",
        formatter: (p: number) => `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`,
      },
    });

    // 0% Base line
    lineSeries.createPriceLine({
      price: 0,
      color: "rgba(148, 163, 184, 0.5)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });

    chartApiRef.current = chart;
    seriesRef.current = lineSeries;

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoveredData(null);
        return;
      }
      const pt = param.seriesData.get(lineSeries) as { value?: number } | undefined;
      if (pt && pt.value !== undefined) {
        let timeStr = "";
        if (typeof param.time === "string") {
          timeStr = param.time;
        } else if (typeof param.time === "number") {
          timeStr = new Date(param.time * 1000).toISOString().split("T")[0];
        } else if (typeof param.time === "object" && param.time !== null && "year" in param.time) {
          const bd = param.time as { year: number; month: number; day: number };
          timeStr = `${bd.year}-${String(bd.month).padStart(2, "0")}-${String(bd.day).padStart(2, "0")}`;
        }
        setHoveredData({
          date: timeStr,
          returnPct: pt.value,
        });
      }
    });

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const w = entries[0].contentRect.width;
      if (w > 0) {
        chart.applyOptions({ width: w });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartApiRef.current = null;
      seriesRef.current = null;
    };
  }, [isOpen]);

  // Set chart data when series data changes
  useEffect(() => {
    if (!seriesRef.current || !chartApiRef.current) return;

    if (seriesData && seriesData.length > 0) {
      const formatted = seriesData
        .map((d) => {
          const t = toChartTime(d.date);
          return t ? { time: t, value: d.return_pct } : null;
        })
        .filter((item): item is { time: NonNullable<ReturnType<typeof toChartTime>>; value: number } => item !== null)
        .sort((a, b) => (String(a.time) > String(b.time) ? 1 : -1));

      // Deduplicate timestamps if any
      const uniqueMap = new Map<any, { time: any; value: number }>();
      for (const item of formatted) {
        uniqueMap.set(item.time, item);
      }
      const uniqueData = Array.from(uniqueMap.values());

      seriesRef.current.setData(uniqueData as any);
      chartApiRef.current.timeScale().fitContent();
    } else {
      seriesRef.current.setData([]);
    }
  }, [seriesData]);

  if (!isOpen || !etf) return null;

  const currentPeriodReturn = etf.returns?.[selectedPeriod] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm animate-in fade-in duration-150 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-5 shadow-2xl transition-all sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="etf-detail-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-800 pb-3.5">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="etf-detail-modal-title"
                className="text-lg font-bold text-gray-100 sm:text-xl truncate"
              >
                {etf.name}
              </h2>
              <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs font-semibold text-gray-300">
                {etf.code}
              </span>
              <span className="rounded bg-sky-950/80 px-2 py-0.5 text-[11px] font-medium text-sky-400 border border-sky-800/40">
                {market === "US" ? "미국 ETF" : market === "GLOBAL" ? "세계 ETF" : "국내 ETF"}
              </span>
              {etf.sector && (
                <span className="rounded bg-gray-800 px-2 py-0.5 text-[11px] text-gray-300">
                  {etf.sector}
                </span>
              )}
            </div>

            {/* Quick stats / Marcap */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
              {etf.marcap ? (
                <span>
                  시총{" "}
                  <strong className="text-gray-200">
                    {etf.marcap >= 10000
                      ? `${(etf.marcap / 10000).toFixed(1)}조원`
                      : `${etf.marcap.toLocaleString()}억원`}
                  </strong>
                </span>
              ) : null}
              <span>
                선택 주기({selectedPeriod}):{" "}
                <strong
                  className={
                    currentPeriodReturn === null
                      ? "text-gray-400"
                      : currentPeriodReturn > 0
                        ? "text-red-400 font-bold"
                        : currentPeriodReturn < 0
                          ? "text-blue-400 font-bold"
                          : "text-gray-200 font-bold"
                  }
                >
                  {formatReturn(currentPeriodReturn)}
                </strong>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 3 Quick Navigation Link Buttons */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-gray-400 mb-2 block">
            🔗 상세 정보 및 차트 바로가기 (새 창 열기)
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {/* 1. App/Streamlit */}
            <a
              href={streamlitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-indigo-700/50 bg-indigo-950/40 p-3 text-left transition-all hover:bg-indigo-900/40 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-950/50 group"
            >
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-200 group-hover:text-white">
                  <span>⚡</span>
                  <span>1. app/streamlit 이동</span>
                </div>
                <p className="mt-0.5 text-[11px] text-indigo-400/80 line-clamp-1">
                  다중 지표 검색
                </p>
              </div>
              <span className="shrink-0 text-sm text-indigo-400 group-hover:translate-x-0.5 group-hover:text-indigo-200 transition-transform">
                ↗
              </span>
            </a>

            {/* 2. AVWAP Chart */}
            <a
              href={avwapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-sky-700/50 bg-sky-950/40 p-3 text-left transition-all hover:bg-sky-900/40 hover:border-sky-500 hover:shadow-lg hover:shadow-sky-950/50 group"
            >
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-200 group-hover:text-white">
                  <span>📈</span>
                  <span>2. AVWAP 차트 이동</span>
                </div>
                <p className="mt-0.5 text-[11px] text-sky-400/80 line-clamp-1">
                  고정 앵커 VWAP 분석
                </p>
              </div>
              <span className="shrink-0 text-sm text-sky-400 group-hover:translate-x-0.5 group-hover:text-sky-200 transition-transform">
                ↗
              </span>
            </a>

            {/* 3. Naver Finance */}
            <a
              href={naverUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-emerald-700/50 bg-emerald-950/40 p-3 text-left transition-all hover:bg-emerald-900/40 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-950/50 group"
            >
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-200 group-hover:text-white">
                  <span>🟢</span>
                  <span>3. 네이버로 이동</span>
                </div>
                <p className="mt-0.5 text-[11px] text-emerald-400/80 line-clamp-1">
                  증권 상세 시세 정보
                </p>
              </div>
              <span className="shrink-0 text-sm text-emerald-400 group-hover:translate-x-0.5 group-hover:text-emerald-200 transition-transform">
                ↗
              </span>
            </a>
          </div>
        </div>

        {/* 1-Year Cumulative Return Line Chart */}
        <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950/60 p-3.5 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <span>📉</span> 최근 1년 수익률 실선 차트
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-500">
                1년 전 기준일 대비 누적 수익률(%) 추이 ({oneYearRange.start} ~ {oneYearRange.end})
              </p>
            </div>

            {/* Hover HUD or Summary Stat */}
            <div className="text-right">
              {hoveredData ? (
                <div className="text-xs">
                  <span className="text-gray-400 font-mono">{hoveredData.date} : </span>
                  <span
                    className={`font-bold font-mono ${
                      hoveredData.returnPct > 0
                        ? "text-red-400"
                        : hoveredData.returnPct < 0
                          ? "text-blue-400"
                          : "text-gray-200"
                    }`}
                  >
                    {hoveredData.returnPct >= 0 ? "+" : ""}
                    {hoveredData.returnPct.toFixed(2)}%
                  </span>
                </div>
              ) : stats ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">1년 수익률:</span>
                  <span
                    className={`font-bold font-mono ${
                      (stats.return_1y ?? stats.period_return ?? 0) > 0
                        ? "text-red-400"
                        : (stats.return_1y ?? stats.period_return ?? 0) < 0
                          ? "text-blue-400"
                          : "text-gray-200"
                    }`}
                  >
                    {stats.return_1y != null
                      ? `${stats.return_1y >= 0 ? "+" : ""}${stats.return_1y.toFixed(2)}%`
                      : stats.period_return != null
                        ? `${stats.period_return >= 0 ? "+" : ""}${stats.period_return.toFixed(2)}%`
                        : "-"}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Chart Viewport */}
          <div className="relative min-h-[240px] w-full">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-950/60 backdrop-blur-xs">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent mb-2" />
                <span className="text-xs text-gray-400">1년 차트 데이터 로딩 중...</span>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/60 p-4 text-center text-xs text-rose-400">
                1년 수익률 차트 데이터를 불러오지 못했습니다.
              </div>
            )}

            {!isLoading && !error && (!seriesData || seriesData.length === 0) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/60 p-4 text-center text-xs text-gray-500">
                해당 기간의 과거 가격 데이터가 존재하지 않습니다.
              </div>
            )}

            <div ref={chartContainerRef} className="h-[240px] w-full" />
          </div>

          {/* Additional Summary Stats */}
          {stats && (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-800/80 pt-2.5 sm:grid-cols-4 text-xs text-gray-400">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500">최고 수익률</span>
                <span className="font-semibold text-red-400 font-mono">
                  {stats.max_return != null ? `+${stats.max_return.toFixed(2)}%` : "-"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500">최저 수익률</span>
                <span className="font-semibold text-blue-400 font-mono">
                  {stats.min_return != null ? `${stats.min_return.toFixed(2)}%` : "-"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500">연간 변동성</span>
                <span className="font-semibold text-gray-300 font-mono">
                  {stats.volatility != null ? `${stats.volatility.toFixed(2)}%` : "-"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500">최근 종가</span>
                <span className="font-semibold text-gray-200 font-mono">
                  {stats.end_price != null
                    ? stats.currency === "USD"
                      ? `$${stats.end_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : `₩${stats.end_price.toLocaleString("ko-KR")}`
                    : "-"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* All Periods Return Grid */}
        <div className="mt-4 border-t border-gray-800 pt-3">
          <div className="mb-1.5 text-[11px] font-semibold text-gray-400">
            주기별 수익률 요약
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 text-xs">
            {PERIODS.map((p) => {
              const val = etf.returns?.[p.key] ?? null;
              return (
                <div
                  key={p.key}
                  className={`rounded-lg border px-2 py-1.5 text-center ${
                    selectedPeriod === p.key
                      ? "border-sky-500/80 bg-sky-950/30"
                      : "border-gray-800 bg-gray-950/40"
                  }`}
                >
                  <div className="text-[10px] text-gray-400">{p.label}</div>
                  <div
                    className={`mt-0.5 font-bold font-mono text-[11px] ${
                      val === null
                        ? "text-gray-500"
                        : val > 0
                          ? "text-red-400"
                          : val < 0
                            ? "text-blue-400"
                            : "text-gray-300"
                    }`}
                  >
                    {formatReturn(val)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="mt-5 flex items-center justify-end border-t border-gray-800 pt-3.5">
          <button
            onClick={onClose}
            className="rounded-xl bg-gray-800 px-5 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
