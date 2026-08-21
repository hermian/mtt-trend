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
import { formatMarcap, formatReturn } from "../_lib/format";
import type { StockHeatmapItem } from "@/lib/api";
import { toChartTime } from "@/app/trend/_components/_lib/chartTime";

export interface StockDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockHeatmapItem | null;
  groupName?: string | null;
  periodLabel?: string;
}

export function StockDetailModal({
  isOpen,
  onClose,
  stock,
  groupName,
  periodLabel = "선택 주기",
}: StockDetailModalProps) {
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

  // Destination URLs (3 types)
  const streamlitUrl = useMemo(() => {
    if (!stock) return "";
    return getStreamlitSearchUrl(stock.name, "stock");
  }, [stock]);

  const avwapUrl = useMemo(() => {
    if (!stock) return "";
    return `/trend?tab=avwap&symbol=${encodeURIComponent(stock.code)}&name=${encodeURIComponent(stock.name)}&type=stock&country=kr`;
  }, [stock]);

  const naverUrl = useMemo(() => {
    if (!stock) return "";
    return `https://m.stock.naver.com/domestic/stock/${encodeURIComponent(stock.code)}/total`;
  }, [stock]);

  // Request 1-year return data
  const returnItems = useMemo(() => {
    if (!stock) return [];
    return [
      {
        code: stock.code,
        name: stock.name,
        market: stock.market ?? "KOSPI",
        type: "stock",
      },
    ];
  }, [stock]);

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

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!isOpen || !chartContainerRef.current) return;

    if (chartApiRef.current) {
      chartApiRef.current.remove();
      chartApiRef.current = null;
    }

    const container = chartContainerRef.current;
    const width = container.clientWidth || 600;
    const height = 260;

    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#090d16" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(51, 65, 85, 0.25)", style: LineStyle.Dashed },
        horzLines: { color: "rgba(51, 65, 85, 0.25)", style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: "#334155",
        autoScale: true,
        alignLabels: true,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderColor: "#334155",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: "rgba(148, 163, 184, 0.5)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1e293b",
        },
        horzLine: {
          color: "rgba(148, 163, 184, 0.5)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1e293b",
        },
      },
    });

    chartApiRef.current = chart;

    const lineSeries = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceFormat: {
        type: "custom",
        formatter: (val: number) => `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`,
      },
    });
    seriesRef.current = lineSeries;

    // 0% Baseline
    lineSeries.createPriceLine({
      price: 0,
      color: "rgba(148, 163, 184, 0.6)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });

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

  // Update Series Data
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

  if (!isOpen || !stock) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-detail-title"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-gray-800 bg-gray-950/60 p-4 sm:p-5">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="stock-detail-title"
                className="text-lg font-extrabold text-white sm:text-xl truncate"
              >
                {stock.name}
              </h3>
              <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-300 font-semibold">
                {stock.code}
              </span>
              {stock.market && (
                <span className="rounded bg-sky-950/80 px-2 py-0.5 text-xs font-semibold text-sky-300 border border-sky-800/60">
                  {stock.market}
                </span>
              )}
              {groupName && (
                <span className="rounded bg-indigo-950/80 px-2 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-800/60">
                  {groupName}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
              <div>
                시가총액:{" "}
                <span className="font-semibold text-gray-200">
                  {formatMarcap(stock.marcap)}
                </span>
              </div>
              {stock.ret !== null && stock.ret !== undefined && (
                <div>
                  {periodLabel} 수익률:{" "}
                  <span
                    className={`font-bold font-mono ${
                      stock.ret > 0
                        ? "text-red-400"
                        : stock.ret < 0
                          ? "text-blue-400"
                          : "text-gray-300"
                    }`}
                  >
                    {formatReturn(stock.ret)}
                  </span>
                </div>
              )}
              {stock.rs !== null && stock.rs !== undefined && (
                <div>
                  RS: <span className="font-semibold text-gray-200">{stock.rs}</span>
                </div>
              )}
              {stock.mmt !== null && stock.mmt !== undefined && (
                <div>
                  MMT: <span className="font-semibold text-gray-200">{stock.mmt}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* 3 Destination Links Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <span>🚀</span> 상세 정보 바로가기 (새 창 이동)
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {/* 1. app/streamlit 이동 */}
              <a
                href={streamlitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 to-indigo-900/20 p-3 text-left transition-all hover:border-indigo-400 hover:bg-indigo-900/30 hover:shadow-lg hover:shadow-indigo-950/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-indigo-300 group-hover:text-indigo-200 flex items-center gap-1">
                    <span>⚡</span> 1. app/streamlit 이동
                  </span>
                  <span className="text-xs text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                    ↗
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-400 leading-tight">
                  RS / MMT 다중 지표 및 스크리너 상세 분석
                </p>
              </a>

              {/* 2. AVWAP 차트 이동 */}
              <a
                href={avwapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-950/40 to-sky-900/20 p-3 text-left transition-all hover:border-sky-400 hover:bg-sky-900/30 hover:shadow-lg hover:shadow-sky-950/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-sky-300 group-hover:text-sky-200 flex items-center gap-1">
                    <span>📈</span> 2. AVWAP 차트 이동
                  </span>
                  <span className="text-xs text-sky-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                    ↗
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-400 leading-tight">
                  HP필터 및 Supertrend 기반 AVWAP 추세 차트
                </p>
              </a>

              {/* 3. 네이버로 이동 */}
              <a
                href={naverUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 p-3 text-left transition-all hover:border-emerald-400 hover:bg-emerald-900/30 hover:shadow-lg hover:shadow-emerald-950/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-300 group-hover:text-emerald-200 flex items-center gap-1">
                    <span>🟢</span> 3. 네이버로 이동
                  </span>
                  <span className="text-xs text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                    ↗
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-400 leading-tight">
                  네이버 증권 실시간 호가 및 재무제표 시세
                </p>
              </a>
            </div>
          </div>

          {/* 1-Year Line Chart Section */}
          <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
                  <span>📊</span> 최근 1년 수익률 실선 차트
                </span>
                <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                  누적 수익률 %
                </span>
              </div>

              {/* HUD Hover info */}
              <div className="font-mono text-xs">
                {hoveredData ? (
                  <span className="text-sky-300">
                    <span className="text-gray-400 mr-1.5">{hoveredData.date}</span>
                    <span className="font-bold">
                      {hoveredData.returnPct >= 0 ? "+" : ""}
                      {hoveredData.returnPct.toFixed(2)}%
                    </span>
                  </span>
                ) : stats ? (
                  <span className="text-gray-400">
                    1년 총 수익률:{" "}
                    <span
                      className={`font-bold ${
                        (stats.return_1y ?? 0) >= 0
                          ? "text-red-400"
                          : "text-blue-400"
                      }`}
                    >
                      {(stats.return_1y ?? 0) >= 0 ? "+" : ""}
                      {stats.return_1y?.toFixed(2)}%
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            {/* Chart Viewport */}
            <div className="relative min-h-[260px] w-full rounded-lg overflow-hidden border border-gray-800/80 bg-[#090d16]">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-950/70 backdrop-blur-xs">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent mb-2" />
                  <span className="text-xs text-gray-400">1년 수익률 시계열 로딩 중...</span>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4 text-center text-xs text-rose-400 bg-gray-950/80">
                  차트 데이터를 불러오지 못했습니다.
                </div>
              )}
              <div ref={chartContainerRef} className="w-full h-[260px]" />
            </div>

            {/* 1Y Statistics Summary Bar */}
            {stats && (
              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4 text-xs">
                <div className="rounded-lg bg-gray-900 p-2 border border-gray-800">
                  <span className="text-gray-400 text-[11px]">1년 수익률</span>
                  <div
                    className={`font-bold font-mono text-sm ${
                      (stats.return_1y ?? 0) >= 0 ? "text-red-400" : "text-blue-400"
                    }`}
                  >
                    {(stats.return_1y ?? 0) >= 0 ? "+" : ""}
                    {stats.return_1y?.toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-lg bg-gray-900 p-2 border border-gray-800">
                  <span className="text-gray-400 text-[11px]">최고 수익률</span>
                  <div className="font-bold font-mono text-sm text-red-400">
                    +{stats.max_return?.toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-lg bg-gray-900 p-2 border border-gray-800">
                  <span className="text-gray-400 text-[11px]">최저 수익률</span>
                  <div className="font-bold font-mono text-sm text-blue-400">
                    {stats.min_return?.toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-lg bg-gray-900 p-2 border border-gray-800">
                  <span className="text-gray-400 text-[11px]">연간 변동성</span>
                  <div className="font-bold font-mono text-sm text-gray-200">
                    {stats.volatility?.toFixed(2)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end border-t border-gray-800 bg-gray-950/60 p-3 sm:px-5">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
