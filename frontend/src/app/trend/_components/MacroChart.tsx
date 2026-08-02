"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineSeries,
  AreaSeries,
  IChartApi,
  ISeriesApi,
  SeriesType,
  LineStyle,
} from "lightweight-charts";
import { useMacroData } from "@/hooks/useMacroData";
import type { MacroDataPoint } from "@/lib/api";

interface MacroChartProps {
  height?: number;
}

/** 선택 가능한 매크로 지표 정의 */
interface IndicatorDef {
  id: keyof Omit<MacroDataPoint, "date">;
  label: string;
  color: string;
  area?: boolean;
  raw: (v: number) => string;
}

const INDICATORS: IndicatorDef[] = [
  { id: "sp500", label: "S&P 500", color: "#38bdf8", area: true, raw: (v) => `SPX ${v.toFixed(0)}` },
  { id: "nasdaq100", label: "NDX", color: "#22d3ee", raw: (v) => `NDX ${v.toFixed(0)}` },
  { id: "kospi", label: "KOSPI", color: "#f87171", raw: (v) => `KOSPI ${v.toFixed(0)}` },
  { id: "cnn_fgi", label: "CNN FGI", color: "#eab308", raw: (v) => `FGI ${v.toFixed(0)}` },
  { id: "kr_fgi", label: "K FGI", color: "#f59e0b", raw: (v) => `KFGI ${v.toFixed(0)}` },
  { id: "high_yield", label: "HY Spread", color: "#f43f5e", raw: (v) => `HY ${v.toFixed(2)}%` },
  { id: "vix", label: "VIX", color: "#a78bfa", raw: (v) => `VIX ${v.toFixed(1)}` },
  { id: "vkospi", label: "VKOSPI", color: "#2dd4bf", raw: (v) => `VKOSPI ${v.toFixed(1)}` },
  { id: "pcr", label: "PCR", color: "#fb923c", raw: (v) => `PCR ${v.toFixed(2)}` },
  { id: "move", label: "MOVE", color: "#f472b6", raw: (v) => `MOVE ${v.toFixed(0)}` },
  { id: "us_2y", label: "US 2Y", color: "#60a5fa", raw: (v) => `2Y ${v.toFixed(2)}%` },
  { id: "us_10y", label: "US 10Y", color: "#818cf8", raw: (v) => `10Y ${v.toFixed(2)}%` },
  { id: "us_spread", label: "US 2-10", color: "#4ade80", raw: (v) => `2-10 ${v.toFixed(2)}%` },
  { id: "kr_10y", label: "KR 10Y", color: "#fbbf24", raw: (v) => `KR10 ${v.toFixed(2)}%` },
  { id: "usdkrw", label: "USD/KRW", color: "#34d399", raw: (v) => `₩${v.toFixed(1)}` },
  { id: "usdjpy", label: "USD/JPY", color: "#a3e635", raw: (v) => `¥${v.toFixed(2)}` },
  { id: "usdcny", label: "USD/CNY", color: "#facc15", raw: (v) => `¥${v.toFixed(3)}` },
  { id: "eurusd", label: "EUR/USD", color: "#c084fc", raw: (v) => `€${v.toFixed(4)}` },
  { id: "dxy", label: "DXY", color: "#94a3b8", raw: (v) => `DXY ${v.toFixed(2)}` },
];

const DEFAULT_SELECTED = new Set(["sp500", "high_yield", "cnn_fgi"]);

/** 기간 프리셋 (단일 선택, 공통 X축 시간 필터) */
type Period = string;
const PERIODS: Period[] = ["5D", "1M", "3M", "6M", "YTD", "1Y", "2Y", "5Y", "All"];

const START_DAYS: Record<string, number> = {
  "5D": 5, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "2Y": 730, "5Y": 1825,
};

function startDateFor(period: Period): string | undefined {
  if (period === "All") return undefined;
  if (period === "YTD") {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  }
  const d = new Date();
  d.setDate(d.getDate() - START_DAYS[period]);
  return d.toISOString().slice(0, 10);
}

function getVal(id: IndicatorDef["id"], p: MacroDataPoint): number | undefined {
  return p[id] as number | undefined;
}

/** 특정 시점에서 선택된 지표들의 값 맵 구성 (호버/최신 범례) */
function collectValuesFor(pt: MacroDataPoint, ids: IndicatorDef[]): Record<string, number> {
  const out: Record<string, number> = {};
  ids.forEach((ind) => {
    const v = getVal(ind.id, pt);
    if (v != null) out[ind.id] = v;
  });
  return out;
}

/** 시계열을 (초기값=100) 또는 raw로 변환 */
function buildSeries(key: IndicatorDef["id"], normalized: boolean, points: FakePoint[]): TimePoint[] {
  const rows = points
    .map((p) => ({ time: p.time, raw: getVal(key, p as MacroDataPoint) as number }))
    .filter((r) => r.raw != null && !Number.isNaN(r.raw));
  if (normalized && rows.length) {
    const base = rows[0].raw;
    return rows.map((r) => ({ time: r.time, value: (r.raw / base) * 100 }));
  }
  return rows.map((r) => ({ time: r.time, value: r.raw }));
}

/** window일 이동평균 */
function movingAverage(data: TimePoint[], window: number): TimePoint[] {
  const out: TimePoint[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].value;
    if (i >= window) sum -= data[i - window].value;
    if (i >= window - 1) out.push({ time: data[i].time, value: sum / window });
  }
  return out;
}

interface TimePoint {
  time: string;
  value: number;
}

/* 호버 범례에 실제 날짜 time을 매핑하기 위한 어댑터 */
type FakePoint = MacroDataPoint & { time: string };

interface HoveredData {
  time: string;
  values: Record<string, number>;
}

export const MacroChart: React.FC<MacroChartProps> = ({ height = 520 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, { main: ISeriesApi<SeriesType>; ma?: ISeriesApi<SeriesType> }>>(new Map());
  const chartDataRef = useRef<FakePoint[] | null>(null);
  const [status, setStatus] = useState<string>("Initializing...");
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<string>>(DEFAULT_SELECTED);
  const [period, setPeriod] = useState<Period>("2Y");
  const [normalized, setNormalized] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  const startDate = useMemo(() => startDateFor(period), [period]);
  const { data: chartData, isLoading, error, isFetching } = useMacroData(startDate);

  const formattedData = useMemo<FakePoint[]>(() => {
    if (!chartData || !chartData.data) return [];
    return [...chartData.data]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((p) => ({ ...p, time: p.date }));
  }, [chartData]);

  useEffect(() => {
    if (formattedData.length > 0) chartDataRef.current = formattedData;
  }, [formattedData]);

  const activeIndicators = useMemo(
    () => INDICATORS.filter((i) => selected.has(i.id)),
    [selected],
  );

  const scrollToLatest = () => {
    if (!chartDataRef.current?.length || !chartRef.current) return;
    // 기간 프리셋으로 이미 필터된 데이터를 전체 표시 (고정 250봉 뷰포트는 2Y 등을 잘라먹음)
    try {
      chartRef.current.timeScale().fitContent();
    } catch {
      /* empty */
    }
  };

  /* 차트 + 시리즈 재구성 (지표 선택 / 정규화 모드 변경 시) */
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-chart-id="macro"]`) as HTMLElement;
    if (!el) return;

    setStatus("Building Charts...");
    seriesRef.current.clear();

    const chart = createChart(el, {
      width: el.clientWidth || containerRef.current.clientWidth || 800,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#cbd5e1",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      timeScale: {
        visible: true,
        borderColor: "#334155",
        rightOffset: 20,
        barSpacing: 6,
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: "#334155",
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: true,
        visible: true,
      },
      leftPriceScale: {
        borderColor: "#334155",
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: true,
        visible: true,
      },
      handleScale: isMobile
        ? { pinch: true, mouseWheel: false, axisPressedMouseMove: false }
        : { axisPressedMouseMove: true, pinch: true, mouseWheel: true },
      handleScroll: isMobile ? { horzTouchDrag: true, vertTouchDrag: false } : true,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { labelVisible: true, color: "#64748b", width: 1, style: 1 },
        horzLine: { color: "#64748b", width: 1, style: 1 },
      },
    });
    chartRef.current = chart;

    // 호버 시 범례 갱신
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0) {
        const arr = chartDataRef.current;
        if (arr && arr.length) {
          const last = arr[arr.length - 1];
          setHoveredData({ time: last.date, values: collectValuesFor(last, activeIndicators) });
        } else {
          setHoveredData(null);
        }
        return;
      }
      const pt = chartDataRef.current?.find((p) => p.time === param.time);
      if (pt) setHoveredData({ time: pt.date, values: collectValuesFor(pt, activeIndicators) });
    });

    // 정규화된 시리즈는 공통 % 축(right)에, raw는 각자 고유 스케일에 배치
    activeIndicators.forEach((ind, i) => {
      const scaleId = normalized ? "right" : i === 0 ? "right" : i === 1 ? "left" : `macro_overlay_${i}`;

      const isArea = !!ind.area && !normalized; // 면적은 raw 상태에서만 가독성 있음
      const formatter = normalized ? (v: number) => `${v.toFixed(1)}%` : ind.raw;
      const commonOpts: any = {
        color: ind.color,
        lineWidth: 2,
        priceLineVisible: false,
        priceScaleId: scaleId,
        priceFormat: { type: "custom", formatter },
      };

      const main = isArea
        ? chart.addSeries(AreaSeries, {
            ...commonOpts,
            topColor: `${ind.color}40`,
            bottomColor: `${ind.color}00`,
          })
        : chart.addSeries(LineSeries, commonOpts);

      if (!normalized && scaleId !== "right") {
        chart.priceScale(scaleId).applyOptions({
          autoScale: true,
          scaleMargins: { top: 0.15, bottom: 0.15 },
        });
      }

      // CNN / K FGI 고정 0~100 범위
      if ((ind.id === "cnn_fgi" || ind.id === "kr_fgi") && !normalized) {
        main.applyOptions({
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
        });
        main.createPriceLine({
          price: 75, color: "#ef4444", lineWidth: 1, lineStyle: LineStyle.Dashed,
          axisLabelVisible: true, title: "75",
        });
        main.createPriceLine({
          price: 25, color: "#3b82f6", lineWidth: 1, lineStyle: LineStyle.Dashed,
          axisLabelVisible: true, title: "25",
        });
      }

      // 하이일드 스프레드 200일 이동평균
      let ma: ISeriesApi<SeriesType> | undefined;
      if (ind.id === "high_yield") {
        ma = chart.addSeries(LineSeries, {
          color: "#94a3b8",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
          priceScaleId: scaleId,
          priceFormat: { type: "custom", formatter },
        });
      }

      seriesRef.current.set(ind.id, { main, ma });
    });

    // 구성 직후 현재 데이터를 즉시 반영
    const pts = chartDataRef.current || [];
    activeIndicators.forEach((ind) => {
      const series = seriesRef.current.get(ind.id);
      if (!series) return;
      const data = buildSeries(ind.id, normalized, pts);
      series.main.setData(data as any);
      if (series.ma) series.ma.setData(movingAverage(data, 200) as any);
    });

    setStatus("Ready");
    const last = pts[pts.length - 1];
    if (last) setHoveredData({ time: last.date, values: collectValuesFor(last, activeIndicators) });

    setTimeout(() => scrollToLatest(), 300);
    return () => {
      // cleanup에서만 remove — effect 시작 시 재호출하면 disposed 차트 이중 제거로 크래시남
      chart.remove();
      if (chartRef.current === chart) chartRef.current = null;
      seriesRef.current.clear();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, normalized, isMobile, height]);

  /* 데이터 갱신 시 기존 시리즈에 반영 */
  useEffect(() => {
    if (formattedData.length === 0 || seriesRef.current.size === 0) return;
    activeIndicators.forEach((ind) => {
      const series = seriesRef.current.get(ind.id);
      if (!series) return;
      const data = buildSeries(ind.id, normalized, formattedData);
      series.main.setData(data as any);
      if (series.ma) series.ma.setData(movingAverage(data, 200) as any);
    });

    const last = formattedData[formattedData.length - 1];
    if (last) setHoveredData({ time: last.date, values: collectValuesFor(last, activeIndicators) });

    setTimeout(() => scrollToLatest(), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formattedData]);

  /* Resize */
  useEffect(() => {
    if (!containerRef.current) return;
    const updateDimensions = () => {
      if (!containerRef.current || !chartRef.current) return;
      const el = containerRef.current.querySelector(`[data-chart-id="macro"]`);
      if (el && (el as HTMLElement).clientWidth > 0) {
        chartRef.current.applyOptions({ width: (el as HTMLElement).clientWidth });
      }
    };
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    window.addEventListener("resize", updateDimensions);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  const toggleIndicator = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full ${isMobile ? "h-[430px]" : "h-[650px]"} bg-slate-900 overflow-hidden border border-slate-800 rounded-xl shadow-2xl`}
    >
      {/* Control bar */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 shrink-0 min-h-11 md:h-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`w-2.5 h-2.5 rounded-full ${isLoading || isFetching ? "bg-blue-500 animate-pulse" : error ? "bg-red-500" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"}`}></div>
          <h3 className="font-bold text-slate-200 text-sm uppercase tracking-tighter truncate">
            Macro & Sentiment Analytics
          </h3>
        </div>

        {/* 지표 토글 */}
        <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Indicators">
          {INDICATORS.map((ind) => {
            const active = selected.has(ind.id);
            return (
              <button
                key={ind.id}
                type="button"
                onClick={() => toggleIndicator(ind.id)}
                style={{
                  borderColor: active ? ind.color : "#475569",
                  color: active ? ind.color : "#94a3b8",
                  backgroundColor: active ? `${ind.color}1a` : "transparent",
                }}
                className="text-[9px] px-2 py-0.5 rounded border font-bold tracking-tighter uppercase transition-all"
              >
                {ind.label}
              </button>
            );
          })}
        </div>

        {/* 기간 프리셋 + 정규화 토글 */}
        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex items-center gap-1 mr-1" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`text-[9px] px-2 py-0.5 rounded border font-bold tracking-tighter uppercase transition-all ${
                  period === p
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => setNormalized((v) => !v)}
            className={`text-[9px] px-2 py-0.5 rounded border font-bold tracking-tighter uppercase transition-all ${
              normalized
                ? "bg-purple-600 text-white border-purple-500"
                : "bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600"
            }`}
            title="각 지표를 시작=100(%)로 리베이스해 공통 % 축에 겹쳐 비교"
          >
            {normalized ? "정규화 %" : "원본"}
          </button>
          <button
            onClick={scrollToLatest}
            className="text-[9px] bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-600 transition-all font-bold tracking-tighter uppercase"
          >
            Sync
          </button>
        </div>
      </div>

      {/* Hover legend */}
      {hoveredData && activeIndicators.length > 0 && (
        <div className="px-4 py-1 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-slate-300">
          <span className="text-slate-400 mr-1">{hoveredData.time}</span>
          {activeIndicators.map((ind) => {
            const v = hoveredData.values[ind.id];
            if (v == null) return null;
            return (
              <span key={ind.id} style={{ color: ind.color }} className="font-bold">
                {ind.label}: <span className="text-slate-100">{ind.raw(v)}</span>
              </span>
            );
          })}
          {normalized && <span className="text-purple-400 italic">(정규화: 기준일=100)</span>}
        </div>
      )}

      {/* Main chart area */}
      <div data-scroll-area className="flex-1 overflow-y-auto indicator-scroll-area bg-slate-950 flex flex-col p-4 gap-4 relative">
        {(isLoading || (isFetching && formattedData.length === 0)) && (
          <div className="absolute inset-0 z-30 bg-slate-950/70 flex items-center justify-center text-slate-400 font-medium animate-pulse">
            차트 데이터를 불러오는 중입니다...
          </div>
        )}

        {error && !isLoading && !isFetching && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 flex items-center justify-center text-red-400 font-medium">
            데이터를 불러오는 데 실패했습니다.
          </div>
        )}

        {activeIndicators.length === 0 && !isLoading && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 flex items-center justify-center text-slate-400 font-medium">
            표시할 지표를 선택해 주세요.
          </div>
        )}

        <div className="relative bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-inner pb-1.5">
          <div className="absolute top-2.5 left-3.5 z-20 pointer-events-none">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {normalized
                ? "Normalized (% change from start) — 공통 % 스케일"
                : "다중 스케일 오버레이 (각 지표별 Y축) — 하이일드에 200MA 표시"}
            </span>
          </div>
          <div data-chart-id="macro" className="w-full relative" style={{ height }}></div>
        </div>
      </div>
    </div>
  );
};