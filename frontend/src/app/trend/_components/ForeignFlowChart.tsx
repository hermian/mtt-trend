"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  SeriesType,
  createChart,
} from "lightweight-charts";
import { useForeignFlowData } from "@/hooks/useForeignFlowData";

interface ForeignFlowChartProps {
  height?: number;
}

type PeriodKey =
  | "1Y"
  | "2Y"
  | "3Y"
  | "YTD"
  | "LAST_YEAR"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "CUSTOM";

const PERIOD_BUTTONS: { id: PeriodKey; label: string }[] = [
  { id: "1Y", label: "최근1년" },
  { id: "2Y", label: "최근2년" },
  { id: "3Y", label: "최근3년" },
  { id: "YTD", label: "올해" },
  { id: "LAST_YEAR", label: "작년" },
  { id: "THIS_MONTH", label: "이번달" },
  { id: "LAST_MONTH", label: "지난달" },
];

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeFor(period: PeriodKey): { start?: string; end?: string } {
  const now = new Date();
  const end = fmtDate(now);
  if (period === "1Y") {
    const s = new Date(now);
    s.setFullYear(s.getFullYear() - 1);
    return { start: fmtDate(s), end };
  }
  if (period === "2Y") {
    const s = new Date(now);
    s.setFullYear(s.getFullYear() - 2);
    return { start: fmtDate(s), end };
  }
  if (period === "3Y") {
    const s = new Date(now);
    s.setFullYear(s.getFullYear() - 3);
    return { start: fmtDate(s), end };
  }
  if (period === "YTD") {
    return { start: `${now.getFullYear()}-01-01`, end };
  }
  if (period === "LAST_YEAR") {
    const y = now.getFullYear() - 1;
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  if (period === "THIS_MONTH") {
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return { start: `${now.getFullYear()}-${m}-01`, end };
  }
  if (period === "LAST_MONTH") {
    const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastPrev = new Date(firstThis.getTime() - 86400000);
    const startPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
    return { start: fmtDate(startPrev), end: fmtDate(lastPrev) };
  }
  return {};
}

export const ForeignFlowChart: React.FC<ForeignFlowChartProps> = ({ height = 560 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType>[]>([]);

  const [period, setPeriod] = useState<PeriodKey>("1Y");
  const [etf, setEtf] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedCustom, setAppliedCustom] = useState<{ start?: string; end?: string }>({});

  const range = useMemo(() => {
    if (period === "CUSTOM") return appliedCustom;
    return rangeFor(period);
  }, [period, appliedCustom]);

  const { data, isLoading, error } = useForeignFlowData(range.start, range.end, etf);

  const subtitle = useMemo(() => {
    if (!data?.data?.length) return "";
    const first = data.data[0].date;
    const last = data.data[data.data.length - 1].date;
    return `최근 구간 (${first} ~ ${last}) 외국인 현선물 순매수 추이`;
  }, [data]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#030712" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#374151" },
      leftPriceScale: { visible: true, borderColor: "#374151" },
      timeScale: { borderColor: "#374151" },
      height,
      width: containerRef.current.clientWidth,
    });
    chartRef.current = chart;

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
      seriesRef.current = [];
    };
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data?.data) return;

    seriesRef.current.forEach((s) => chart.removeSeries(s));
    seriesRef.current = [];

    const hist = chart.addSeries(HistogramSeries, {
      priceScaleId: "left",
      priceFormat: { type: "volume" },
    });
    // title을 넣으면 가격축 last-value 라벨이 차트 안쪽에 겹쳐 표시되므로 제외
    // (상단 색상 범례로 구분)
    const ma60 = chart.addSeries(LineSeries, {
      color: "#f97316",
      lineWidth: 2,
      priceScaleId: "left",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const ma120 = chart.addSeries(LineSeries, {
      color: "#22d3ee",
      lineWidth: 2,
      priceScaleId: "left",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const kospi = chart.addSeries(LineSeries, {
      color: "#e5e7eb",
      lineWidth: 2,
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    seriesRef.current = [hist, ma60, ma120, kospi];

    hist.setData(
      data.data
        .filter((d) => d.ma20 != null)
        .map((d) => ({
          time: d.date as any,
          value: d.ma20 as number,
          color: (d.ma20 as number) >= 0 ? "#ef4444" : "#3b82f6",
        }))
    );
    ma60.setData(
      data.data
        .filter((d) => d.ma60 != null)
        .map((d) => ({ time: d.date as any, value: d.ma60 as number }))
    );
    ma120.setData(
      data.data
        .filter((d) => d.ma120 != null)
        .map((d) => ({ time: d.date as any, value: d.ma120 as number }))
    );
    kospi.setData(
      data.data
        .filter((d) => d.kospi != null)
        .map((d) => ({ time: d.date as any, value: d.kospi as number }))
    );

    chart.timeScale().fitContent();
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-extrabold text-white tracking-tight">외국인 현선물 동향</h3>
          <p className="text-gray-400 text-sm mt-1">{subtitle || "외국인 현·선물 순매수(20MA)와 KOSPI"}</p>
          <p className="text-xs text-gray-500 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              <span className="text-red-500 font-semibold">빨강영역</span>
              =현선물 순매수(20MA)
            </span>
            <span className="text-gray-600">·</span>
            <span>
              <span className="text-blue-500 font-semibold">파랑영역</span>
              =현선물 순매도(20MA)
            </span>
            <span className="text-gray-600">·</span>
            <span>
              <span className="text-orange-500 font-semibold">주황</span>=60MA
            </span>
            <span className="text-gray-600">·</span>
            <span>
              <span className="text-cyan-400 font-semibold">하늘</span>=120MA
            </span>
            <span className="text-gray-600">·</span>
            <span>
              <span className="text-gray-200 font-semibold">흰선</span>=KOSPI
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-900/60 p-1 rounded-lg border border-gray-800">
          <button
            type="button"
            onClick={() => setEtf(false)}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              !etf ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            현물
          </button>
          <button
            type="button"
            onClick={() => setEtf(true)}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              etf ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            현물+ETF
          </button>
        </div>
      </div>

      <div className="relative min-h-[200px]">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/40 text-sm text-gray-400">
            Loading…
          </div>
        )}
        {error && (
          <div className="mb-3 text-sm text-red-400">데이터 로드 실패: {(error as Error).message}</div>
        )}
        <div ref={containerRef} className="w-full rounded-xl border border-gray-800 overflow-hidden" />
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {PERIOD_BUTTONS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setPeriod(b.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md border transition-all ${
                period === b.id
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">날짜</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-200"
          />
          <span className="text-xs text-gray-500">~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-200"
          />
          <button
            type="button"
            onClick={() => {
              setPeriod("CUSTOM");
              setAppliedCustom({
                start: customStart || undefined,
                end: customEnd || undefined,
              });
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-md bg-blue-600 text-white"
          >
            검색
          </button>
        </div>
      </div>
    </div>
  );
};
