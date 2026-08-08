"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  SeriesType,
  createChart,
} from "lightweight-charts";
import { useValuationBands } from "@/hooks/useValuationBands";
import type { ValuationBandPoint, ValuationIndex, ValuationMode } from "@/lib/api";

const INDEXES: { id: ValuationIndex; label: string }[] = [
  { id: "kospi", label: "KOSPI" },
  { id: "kospi200", label: "KOSPI200" },
  { id: "kosdaq", label: "KOSDAQ" },
  { id: "kosdaq150", label: "KQ150" },
];

const PERIODS = ["1Y", "2Y", "3Y", "5Y", "10Y", "All"] as const;
type Period = (typeof PERIODS)[number];

const START_YEARS: Record<Exclude<Period, "All">, number> = {
  "1Y": 1,
  "2Y": 2,
  "3Y": 3,
  "5Y": 5,
  "10Y": 10,
};

const CLOSE_COLOR = "#f87171";
const META_COLOR = "#94a3b8"; // date / raw PBR·PER

const BAND_COLORS = [
  "#64748b",
  "#94a3b8",
  "#38bdf8",
  "#fbbf24",
  "#f97316",
  "#ef4444",
  "#a78bfa",
];

function displayStartFor(period: Period): string | undefined {
  if (period === "All") return undefined;
  const d = new Date();
  d.setFullYear(d.getFullYear() - START_YEARS[period]);
  return d.toISOString().slice(0, 10);
}

function bandLabel(mode: ValuationMode, multiple: number): string {
  if (mode === "pbr") return `PBR ${multiple}x`;
  return `PER ${multiple}x`;
}

/** API bands 키와 JS number 문자열 불일치(8 vs 8.0) 흡수 */
function resolveBandKey(
  m: number,
  bands: Record<string, number | null | undefined>
): string {
  const candidates = [
    String(m),
    m.toFixed(1),
    Number.isInteger(m) ? `${m}.0` : String(m),
  ];
  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(bands, k)) return k;
  }
  const hit = Object.keys(bands).find((k) => Number(k) === m);
  return hit ?? String(m);
}

type LegendItem = { label: string; color: string };

function buildLegendItems(
  row: ValuationBandPoint,
  mode: ValuationMode,
  multiples: number[]
): LegendItem[] {
  const items: LegendItem[] = [{ label: row.date, color: META_COLOR }];
  if (row.close != null) {
    items.push({ label: `Close ${row.close.toFixed(2)}`, color: CLOSE_COLOR });
  }
  if (row.pbr != null) {
    items.push({ label: `PBR ${row.pbr.toFixed(2)}`, color: META_COLOR });
  }
  if (row.per != null) {
    items.push({ label: `PER ${row.per.toFixed(2)}`, color: META_COLOR });
  }
  multiples.forEach((m, i) => {
    const key = resolveBandKey(m, row.bands);
    const v = row.bands[key];
    if (v != null) {
      items.push({
        label: `${bandLabel(mode, m)} ${v.toFixed(1)}`,
        color: BAND_COLORS[i % BAND_COLORS.length],
      });
    }
  });
  return items;
}

export const ValuationBandChart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType>[]>([]);

  const [index, setIndex] = useState<ValuationIndex>("kospi");
  const [mode, setMode] = useState<ValuationMode>("pbr");
  const [period, setPeriod] = useState<Period>("5Y");
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const startDate = useMemo(() => displayStartFor(period), [period]);
  const { data, isLoading, error } = useValuationBands(index, mode, startDate);

  const legendItems = useMemo(() => {
    if (!data?.data?.length) return [] as LegendItem[];
    const row =
      (hoverDate && data.data.find((p) => p.date === hoverDate)) ||
      data.data[data.data.length - 1];
    return buildLegendItems(row, mode, data.multiples);
  }, [data, mode, hoverDate]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#030712" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "#374151",
        entireTextOnly: false,
      },
      timeScale: { borderColor: "#374151" },
      width: el.clientWidth,
      height: Math.max(el.clientHeight, 420),
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: Math.max(containerRef.current.clientHeight, 420),
      });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data?.data) return;

    seriesRef.current.forEach((s) => chart.removeSeries(s));
    seriesRef.current = [];

    const closeSeries = chart.addSeries(LineSeries, {
      color: CLOSE_COLOR,
      lineWidth: 2,
      title: "",
      priceLineVisible: false,
      lastValueVisible: true,
    });
    closeSeries.setData(
      data.data
        .filter((p) => p.close != null)
        .map((p) => ({
          time: p.date as `${number}-${number}-${number}`,
          value: p.close as number,
        }))
    );
    seriesRef.current.push(closeSeries);

    data.multiples.forEach((m, i) => {
      const color = BAND_COLORS[i % BAND_COLORS.length];
      const isFair = Math.abs(m - (mode === "pbr" ? 1.0 : 12.0)) < 1e-9;
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: isFair ? 2 : 1,
        lineStyle: isFair ? LineStyle.Solid : LineStyle.Dashed,
        title: "",
        priceLineVisible: false,
        lastValueVisible: true,
      });
      const points = data.data
        .map((p) => {
          const key = resolveBandKey(m, p.bands);
          const v = p.bands[key];
          if (v == null || Number.isNaN(v)) return null;
          return {
            time: p.date as `${number}-${number}-${number}`,
            value: v,
          };
        })
        .filter(
          (x): x is { time: `${number}-${number}-${number}`; value: number } =>
            x != null
        );
      series.setData(points);
      seriesRef.current.push(series);
    });

    chart.timeScale().fitContent();

    const onMove = (param: { time?: unknown }) => {
      if (!param.time) {
        setHoverDate(null);
        return;
      }
      const d = String(param.time);
      setHoverDate(data.data.some((p) => p.date === d) ? d : null);
    };
    chart.subscribeCrosshairMove(onMove as never);
    return () => {
      chart.unsubscribeCrosshairMove(onMove as never);
    };
  }, [data, mode]);

  const subtitle = useMemo(() => {
    if (!data?.data?.length) return "BPS≈Close/PBR · EPS≈Close/PER · 결측 구간 보간 없음";
    const first = data.data[0].date;
    const last = data.data[data.data.length - 1].date;
    return `${index.toUpperCase()} ${mode.toUpperCase()} 밴드 · ${first} ~ ${last}`;
  }, [data, index, mode]);

  return (
    <div className="w-full h-full flex flex-col gap-4 min-h-[520px]">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            Valuation Bands (PER / PBR)
          </h3>
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            {INDEXES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(item.id)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  index === item.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            {(["pbr", "per"] as ValuationMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${
                  mode === m
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  period === p
                    ? "bg-slate-600 text-white"
                    : "bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-5 text-xs font-mono leading-relaxed flex flex-wrap gap-x-2 gap-y-1">
        {legendItems.map((item, i) => (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? <span className="text-gray-600">·</span> : null}
            <span style={{ color: item.color }}>{item.label}</span>
          </span>
        ))}
      </div>

      <div className="relative flex-1 min-h-[420px] flex gap-2">
        <div className="relative flex-1 min-h-[420px] rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
          {(isLoading || error || !data?.data?.length) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/70 text-sm text-gray-400">
              {error
                ? "데이터를 불러오지 못했습니다"
                : isLoading
                  ? "로딩 중…"
                  : "표시할 데이터가 없습니다 (index_fundamental)"}
            </div>
          )}
          <div ref={containerRef} className="w-full h-full min-h-[420px]" />
        </div>
        {data?.multiples?.length ? (
          <div className="hidden sm:flex flex-col justify-center gap-2 shrink-0 w-28 text-[11px]">
            <span className="flex items-center gap-1.5" style={{ color: CLOSE_COLOR }}>
              <span
                className="inline-block w-3 h-0.5"
                style={{ backgroundColor: CLOSE_COLOR }}
              />
              Close
            </span>
            {data.multiples.map((m, i) => {
              const color = BAND_COLORS[i % BAND_COLORS.length];
              return (
                <span
                  key={m}
                  className="flex items-center gap-1.5"
                  style={{ color }}
                >
                  <span
                    className="inline-block w-3 h-0.5"
                    style={{ backgroundColor: color }}
                  />
                  {bandLabel(mode, m)}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};
