"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  LineSeries,
  createChart,
} from "lightweight-charts";
import { useWicsIndex } from "@/hooks/useWicsData";
import clsx from "clsx";

interface WicsIndexChartProps {
  wics: string;
  weight: "MC" | "EW";
  onWeightChange?: (w: "MC" | "EW") => void;
  startDate?: string;
  endDate?: string;
  height?: number;
}

function rebaseTo100(
  points: { time: string; value: number }[]
): { time: string; value: number }[] {
  if (points.length === 0) return [];
  const base = points[0].value;
  if (!base || !Number.isFinite(base) || base === 0) return points;
  return points.map((p) => ({
    time: p.time,
    value: (p.value / base) * 100,
  }));
}

export const WicsIndexChart: React.FC<WicsIndexChartProps> = ({
  wics,
  weight,
  onWeightChange,
  startDate,
  endDate,
  height = 280,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [hover, setHover] = useState<{ time: string; value: number } | null>(null);

  const { data, isLoading, error } = useWicsIndex(wics, startDate, endDate);

  const seriesData = useMemo(() => {
    if (!data?.data?.length) return [];
    const key = weight === "MC" ? "MC_Index" : "EW_Index";
    const raw = data.data
      .filter((p) => p[key] != null && Number.isFinite(p[key]!))
      .map((p) => ({ time: p.date, value: p[key]! as number }))
      .sort((a, b) => (a.time > b.time ? 1 : -1));
    return rebaseTo100(raw);
  }, [data, weight]);

  const last = seriesData.length ? seriesData[seriesData.length - 1] : null;
  const changePct =
    last && seriesData[0]
      ? ((last.value / seriesData[0].value) - 1) * 100
      : null;

  useEffect(() => {
    if (!containerRef.current || seriesData.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(75, 85, 99, 0.25)" },
        horzLines: { color: "rgba(75, 85, 99, 0.25)" },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: "rgba(75, 85, 99, 0.4)" },
      timeScale: { borderColor: "rgba(75, 85, 99, 0.4)", timeVisible: false },
      width: containerRef.current.clientWidth || containerRef.current.parentElement?.clientWidth || 600,
    });

    const series = chart.addSeries(LineSeries, {
      color: weight === "MC" ? "#60a5fa" : "#34d399",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    series.setData(seriesData as any);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        setHover(null);
        return;
      }
      const point = param.seriesData.get(series) as { value?: number } | undefined;
      if (point?.value == null) {
        setHover(null);
        return;
      }
      setHover({ time: String(param.time), value: point.value });
    });

    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, wics, seriesData, weight]);

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white truncate">{wics}</h3>
            <span className="text-[10px] text-gray-500 font-mono uppercase">
              index · start=100
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {hover ? (
              <>
                {hover.time}: <span className="text-gray-200 font-mono">{hover.value.toFixed(2)}</span>
              </>
            ) : last ? (
              <>
                종가{" "}
                <span className="text-gray-200 font-mono">{last.value.toFixed(2)}</span>
                {changePct != null && (
                  <span
                    className={clsx(
                      "ml-2 font-mono",
                      changePct > 0 ? "text-red-400" : changePct < 0 ? "text-blue-400" : "text-gray-400"
                    )}
                  >
                    {changePct > 0 ? "+" : ""}
                    {changePct.toFixed(1)}%
                  </span>
                )}
              </>
            ) : (
              "섹터 지수"
            )}
          </p>
        </div>

        {onWeightChange && (
          <div className="flex items-center bg-black/30 p-1 rounded-lg border border-gray-800">
            <button
              type="button"
              onClick={() => onWeightChange("MC")}
              className={clsx(
                "px-3 py-1 text-xs font-bold rounded-md transition-all",
                weight === "MC" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
              )}
            >
              시총가중
            </button>
            <button
              type="button"
              onClick={() => onWeightChange("EW")}
              className={clsx(
                "px-3 py-1 text-xs font-bold rounded-md transition-all",
                weight === "EW" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
              )}
            >
              동일가중
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="h-[280px] flex items-center justify-center text-xs text-gray-500">
          지수 로딩 중…
        </div>
      )}
      {error && (
        <div className="h-[120px] flex items-center justify-center text-xs text-red-400">
          지수 로드 실패: {String(error)}
        </div>
      )}
      {!isLoading && !error && seriesData.length === 0 && (
        <div className="h-[120px] flex items-center justify-center text-xs text-gray-500 px-4 text-center">
          지수 데이터 없음. screener에서 `python -m script.wics_daily_index` 실행 후
          stock_master.db의 wics_daily_index를 확인하세요.
        </div>
      )}
      {!isLoading && !error && seriesData.length > 0 && (
        <div ref={containerRef} className="w-full" style={{ height }} />
      )}
    </div>
  );
};
