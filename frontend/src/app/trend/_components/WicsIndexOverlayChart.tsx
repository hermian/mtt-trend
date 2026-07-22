"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  LineSeries,
  PriceScaleMode,
  createChart,
} from "lightweight-charts";
import { WicsIndexSectorSeries } from "@/lib/api";
import clsx from "clsx";

const TOP_COLORS = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#e879f9",
  "#4ade80",
];

const GHOST_COLOR = "rgba(156, 163, 175, 0.18)";
const SETTLE_MS = 220;
const PRICE_AXIS_HIT_PX = 56;

export type YFitMode = "all" | "focus" | "selected" | "mid";

export interface LeaderboardRow {
  wics: string;
  ret: number;
  color: string;
  rank: number;
}

export type WicsIndexOverlayChartHandle = {
  fitY: () => void;
  zoomY: (factor: number) => void;
};

interface WicsIndexOverlayChartProps {
  sectors: WicsIndexSectorSeries[];
  chartType: "line" | "candle";
  topN: number;
  selected: Set<string>;
  onToggleSelect: (wics: string, multi: boolean) => void;
  showLegend: boolean;
  onLeaderboardChange?: (rows: LeaderboardRow[]) => void;
  height?: number;
  logY?: boolean;
  yFitMode?: YFitMode;
}

type RawPoint = { time: string; close: number };

function toRawMap(sectors: WicsIndexSectorSeries[]): Map<string, RawPoint[]> {
  const map = new Map<string, RawPoint[]>();
  for (const s of sectors) {
    const pts: RawPoint[] = [];
    for (const p of s.points) {
      if (p.close == null || !Number.isFinite(p.close)) continue;
      pts.push({ time: p.time, close: p.close });
    }
    if (pts.length) map.set(s.WICS, pts);
  }
  return map;
}

function rebaseFull(
  pts: RawPoint[],
  t0: string
): { line: { time: string; value: number }[]; base: number } | null {
  const basePt = pts.find((p) => p.time >= t0) ?? pts[0];
  if (!basePt?.close || !Number.isFinite(basePt.close) || basePt.close === 0) return null;
  const base = basePt.close;
  return {
    base,
    line: pts.map((p) => ({ time: p.time, value: (p.close / base) * 100 })),
  };
}

function windowReturn(pts: RawPoint[], t0: string, t1: string): number | null {
  const inRange = pts.filter((p) => p.time >= t0 && p.time <= t1);
  if (inRange.length < 1) return null;
  const a = inRange[0].close;
  const b = inRange[inRange.length - 1].close;
  if (!a || !Number.isFinite(a) || a === 0) return null;
  return b / a - 1;
}

function timesToRange(
  allTimes: string[],
  chart: IChartApi
): { t0: string; t1: string; logical: { from: number; to: number } | null } {
  const logical = chart.timeScale().getVisibleLogicalRange();
  let t0 = allTimes[0];
  let t1 = allTimes[allTimes.length - 1];
  if (logical && allTimes.length) {
    const fromIdx = Math.max(0, Math.min(allTimes.length - 1, Math.floor(logical.from)));
    const toIdx = Math.max(0, Math.min(allTimes.length - 1, Math.ceil(logical.to)));
    t0 = allTimes[fromIdx] ?? t0;
    t1 = allTimes[toIdx] ?? t1;
  }
  return { t0, t1, logical: logical ? { from: logical.from, to: logical.to } : null };
}

function fitNames(
  mode: YFitMode,
  board: LeaderboardRow[],
  selected: Set<string>,
  topN: number
): string[] {
  if (mode === "selected") {
    if (selected.size > 0) return Array.from(selected);
  }
  if (mode === "selected" || mode === "focus") {
    if (selected.size > 0) return Array.from(selected);
    if (topN > 0) return board.slice(0, topN).map((b) => b.wics);
    return board.map((b) => b.wics);
  }
  if (mode === "mid") {
    const drop = Math.min(3, Math.max(1, Math.floor(board.length * 0.05) || 1));
    const rest = board.slice(drop).map((b) => b.wics);
    return rest.length ? rest : board.map((b) => b.wics);
  }
  return board.map((b) => b.wics);
}

export const WicsIndexOverlayChart = forwardRef<
  WicsIndexOverlayChartHandle,
  WicsIndexOverlayChartProps
>(function WicsIndexOverlayChart(
  {
    sectors,
    chartType,
    topN,
    selected,
    onToggleSelect,
    showLegend,
    onLeaderboardChange,
    height = 520,
    logY = false,
    yFitMode = "focus",
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const rawRef = useRef<Map<string, RawPoint[]>>(new Map());
  const allTimesRef = useRef<string[]>([]);
  const rangeRef = useRef<{ from: string; to: string } | null>(null);
  const anchorRef = useRef<string | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRef = useRef(false);
  const multiKeyRef = useRef(false);
  const selectedRef = useRef(selected);
  const topNRef = useRef(topN);
  const chartTypeRef = useRef(chartType);
  const yFitModeRef = useRef(yFitMode);
  const logYRef = useRef(logY);
  const onBoardRef = useRef(onLeaderboardChange);
  const onToggleRef = useRef(onToggleSelect);
  const fitPriceScaleRef = useRef<() => void>(() => {});
  const zoomPriceScaleRef = useRef<(f: number) => void>(() => {});

  selectedRef.current = selected;
  topNRef.current = topN;
  chartTypeRef.current = chartType;
  yFitModeRef.current = yFitMode;
  logYRef.current = logY;
  onBoardRef.current = onLeaderboardChange;
  onToggleRef.current = onToggleSelect;

  const [legendItems, setLegendItems] = useState<LeaderboardRow[]>([]);
  const [hover, setHover] = useState<{ time: string; wics: string; value: number } | null>(null);
  const [status, setStatus] = useState<string>("");

  const rawMap = useMemo(() => toRawMap(sectors), [sectors]);
  rawRef.current = rawMap;

  const allTimes = useMemo(() => {
    const set = new Set<string>();
    rawMap.forEach((pts) => pts.forEach((p) => set.add(p.time)));
    return Array.from(set).sort();
  }, [rawMap]);
  allTimesRef.current = allTimes;

  const buildBoard = useCallback((t0: string, t1: string): LeaderboardRow[] => {
    const returns: { wics: string; ret: number }[] = [];
    rawRef.current.forEach((pts, wics) => {
      const ret = windowReturn(pts, t0, t1);
      if (ret != null) returns.push({ wics, ret });
    });
    returns.sort((a, b) => b.ret - a.ret);
    const topNNow = topNRef.current;
    const sel = selectedRef.current;
    const topSet = new Set(
      topNNow > 0 ? returns.slice(0, topNNow).map((r) => r.wics) : returns.map((r) => r.wics)
    );

    const colorOf = (wics: string, rank: number) => {
      if (sel.size > 0) {
        if (!sel.has(wics)) return GHOST_COLOR;
        return TOP_COLORS[Array.from(sel).indexOf(wics) % TOP_COLORS.length];
      }
      if (topNNow === 0) return TOP_COLORS[rank % TOP_COLORS.length];
      if (topSet.has(wics)) {
        const idx = returns.findIndex((r) => r.wics === wics);
        return TOP_COLORS[idx % TOP_COLORS.length];
      }
      return GHOST_COLOR;
    };

    return returns.map((r, i) => ({
      wics: r.wics,
      ret: r.ret,
      color: colorOf(r.wics, i),
      rank: i + 1,
    }));
  }, []);

  const applyStyles = useCallback((board: LeaderboardRow[]) => {
    const sel = selectedRef.current;
    const topNNow = topNRef.current;
    const focus =
      sel.size > 0
        ? sel
        : new Set(
            topNNow > 0
              ? board.slice(0, topNNow).map((b) => b.wics)
              : board.map((b) => b.wics)
          );
    const colorMap = new Map(board.map((b) => [b.wics, b.color]));

    seriesMapRef.current.forEach((series, wics) => {
      const isFocus = focus.has(wics);
      series.applyOptions({
        color: colorMap.get(wics) ?? GHOST_COLOR,
        lineWidth: (isFocus ? (chartTypeRef.current === "candle" ? 3 : 2) : 1) as any,
        lastValueVisible: isFocus && sel.size > 0,
        priceLineVisible: false,
        crosshairMarkerVisible: isFocus,
      });
    });

    setLegendItems(
      board.filter((b) => (sel.size > 0 ? sel.has(b.wics) : topNNow === 0 || b.rank <= topNNow))
    );
    onBoardRef.current?.(board);
  }, []);

  const fitPriceScale = useCallback(() => {
    const chart = chartRef.current;
    const range = rangeRef.current;
    const anchor = anchorRef.current;
    if (!chart || !range || !anchor) return;

    const board = buildBoard(range.from, range.to);
    const names = fitNames(yFitModeRef.current, board, selectedRef.current, topNRef.current);
    if (!names.length) return;

    let min = Infinity;
    let max = -Infinity;
    for (const wics of names) {
      const pts = rawRef.current.get(wics);
      if (!pts) continue;
      const r = rebaseFull(pts, anchor);
      if (!r) continue;
      for (const p of r.line) {
        if (p.time < range.from || p.time > range.to) continue;
        if (!Number.isFinite(p.value) || p.value <= 0) continue;
        min = Math.min(min, p.value);
        max = Math.max(max, p.value);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      chart.priceScale("right").applyOptions({ autoScale: true });
      return;
    }
    const pad = Math.max((max - min) * 0.1, max * 0.01, 0.5);
    let from = min - pad;
    let to = max + pad;
    if (logYRef.current) {
      from = Math.max(from, 1e-6);
      if (to <= from) to = from * 1.2;
    }
    chart.priceScale("right").applyOptions({ autoScale: false });
    try {
      chart.priceScale("right").setVisibleRange({ from, to });
    } catch {
      chart.priceScale("right").applyOptions({ autoScale: true });
    }
  }, [buildBoard]);

  const zoomPriceScale = useCallback(
    (factor: number) => {
      const chart = chartRef.current;
      if (!chart) return;
      const vr = chart.priceScale("right").getVisibleRange();
      if (!vr || !Number.isFinite(vr.from) || !Number.isFinite(vr.to) || vr.to <= vr.from) {
        fitPriceScale();
        return;
      }
      const mid = (vr.from + vr.to) / 2;
      let half = ((vr.to - vr.from) / 2) * factor;
      half = Math.max(half, mid * 0.005, 0.25);
      let from = mid - half;
      let to = mid + half;
      if (logYRef.current) from = Math.max(from, 1e-6);
      chart.priceScale("right").applyOptions({ autoScale: false });
      try {
        chart.priceScale("right").setVisibleRange({ from, to });
      } catch {
        /* ignore */
      }
    },
    [fitPriceScale]
  );

  fitPriceScaleRef.current = fitPriceScale;
  zoomPriceScaleRef.current = zoomPriceScale;

  useImperativeHandle(
    ref,
    () => ({
      fitY: () => fitPriceScaleRef.current(),
      zoomY: (f: number) => zoomPriceScaleRef.current(f),
    }),
    []
  );

  const rebaseToAnchor = useCallback(
    (t0: string, restoreLogical?: { from: number; to: number } | null) => {
      const chart = chartRef.current;
      if (!chart) return;

      applyingRef.current = true;
      anchorRef.current = t0;

      seriesMapRef.current.forEach((series, wics) => {
        const pts = rawRef.current.get(wics);
        if (!pts) return;
        const r = rebaseFull(pts, t0);
        if (!r) return;
        series.setData(r.line as any);
      });

      if (restoreLogical) {
        chart.timeScale().setVisibleLogicalRange(restoreLogical);
      }
      requestAnimationFrame(() => {
        fitPriceScale();
        applyingRef.current = false;
        setStatus("");
      });
    },
    [fitPriceScale]
  );

  const refreshForVisibleRange = useCallback(
    (mode: "live" | "settle") => {
      const chart = chartRef.current;
      const times = allTimesRef.current;
      if (!chart || !times.length) return;

      const { t0, t1, logical } = timesToRange(times, chart);
      rangeRef.current = { from: t0, to: t1 };

      const board = buildBoard(t0, t1);
      applyStyles(board);

      if (mode === "settle") {
        if (anchorRef.current !== t0) {
          setStatus("재기준…");
          rebaseToAnchor(t0, logical);
        } else {
          fitPriceScale();
        }
      }
    },
    [applyStyles, buildBoard, fitPriceScale, rebaseToAnchor]
  );

  useEffect(() => {
    if (!containerRef.current || !rawMap.size || !allTimes.length) return;
    const host = containerRef.current;

    const chart = createChart(host, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(75, 85, 99, 0.2)" },
        horzLines: { color: "rgba(75, 85, 99, 0.2)" },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: {
        borderColor: "rgba(75, 85, 99, 0.4)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
        mode: logYRef.current ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
      timeScale: {
        borderColor: "rgba(75, 85, 99, 0.4)",
        timeVisible: false,
        rightOffset: 4,
      },
      width: host.clientWidth || 800,
      handleScroll: { vertTouchDrag: false },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
    });

    const seriesMap = new Map<string, ISeriesApi<"Line">>();
    rawMap.forEach((pts, wics) => {
      const s = chart.addSeries(LineSeries, {
        color: GHOST_COLOR,
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      s.setData(pts.map((p) => ({ time: p.time as any, value: p.close })));
      seriesMap.set(wics, s);
    });

    chartRef.current = chart;
    seriesMapRef.current = seriesMap;

    const onRange = () => {
      if (applyingRef.current) return;
      refreshForVisibleRange("live");
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        refreshForVisibleRange("settle");
      }, SETTLE_MS);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    chart.subscribeClick((param) => {
      if (!param.point || !param.time) return;
      const t = String(param.time);
      const y = param.point.y;
      const anchor = anchorRef.current ?? rangeRef.current?.from;
      if (!anchor) return;

      let best: string | null = null;
      let bestDist = Infinity;
      seriesMap.forEach((series, wics) => {
        const pts = rawRef.current.get(wics);
        if (!pts) return;
        const r = rebaseFull(pts, anchor);
        if (!r) return;
        const rp = r.line.find((p) => p.time === t);
        if (!rp) return;
        const coord = series.priceToCoordinate(rp.value);
        if (coord == null) return;
        const dist = Math.abs(coord - y);
        if (dist < bestDist) {
          bestDist = dist;
          best = wics;
        }
      });
      if (best && bestDist < 30) {
        onToggleRef.current(best, multiKeyRef.current);
      }
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHover(null);
        return;
      }
      const t = String(param.time);
      const anchor = anchorRef.current ?? rangeRef.current?.from;
      if (!anchor) return;
      let bestWics: string | null = null;
      let bestValue = 0;
      let bestDist = Infinity;
      const y = param.point.y;
      seriesMap.forEach((series, wics) => {
        const pts = rawRef.current.get(wics);
        if (!pts) return;
        const r = rebaseFull(pts, anchor);
        if (!r) return;
        const rp = r.line.find((p) => p.time === t);
        if (!rp) return;
        const coord = series.priceToCoordinate(rp.value);
        if (coord == null) return;
        const dist = Math.abs(coord - y);
        if (dist < bestDist) {
          bestDist = dist;
          bestWics = wics;
          bestValue = rp.value;
        }
      });
      if (bestWics && bestDist < 40) {
        setHover({ time: t, wics: bestWics, value: bestValue });
      } else {
        setHover(null);
      }
    });

    const onWheel = (e: WheelEvent) => {
      const rect = host.getBoundingClientRect();
      const onPriceAxis = e.clientX >= rect.right - PRICE_AXIS_HIT_PX;
      if (!onPriceAxis) return;
      e.preventDefault();
      e.stopPropagation();
      zoomPriceScaleRef.current(e.deltaY < 0 ? 0.85 : 1.18);
    };
    host.addEventListener("wheel", onWheel, { passive: false });

    chart.timeScale().fitContent();
    requestAnimationFrame(() => {
      refreshForVisibleRange("settle");
    });

    const onResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({ width: host.clientWidth });
      }
    };
    const keyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) multiKeyRef.current = true;
    };
    const keyUp = () => {
      multiKeyRef.current = false;
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      host.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current.clear();
      anchorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMap, height]);

  useEffect(() => {
    const range = rangeRef.current;
    if (!range) return;
    const board = buildBoard(range.from, range.to);
    applyStyles(board);
    fitPriceScale();
  }, [selected, topN, chartType, applyStyles, buildBoard, fitPriceScale]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.priceScale("right").applyOptions({
      mode: logY ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
    requestAnimationFrame(() => fitPriceScale());
  }, [logY, fitPriceScale]);

  useEffect(() => {
    fitPriceScale();
  }, [yFitMode, fitPriceScale]);

  return (
    <div className="relative w-full flex-1 min-h-0">
      {showLegend && legendItems.length > 0 && (
        <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1.5 max-w-[72%] pointer-events-none">
          {legendItems.slice(0, 12).map((item) => (
            <span
              key={item.wics}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/55 border border-gray-700/80 text-gray-200"
              style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}
            >
              {item.wics}{" "}
              <span className={item.ret >= 0 ? "text-red-400" : "text-blue-400"}>
                {item.ret >= 0 ? "+" : ""}
                {(item.ret * 100).toFixed(1)}%
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1 pointer-events-none">
        {hover && (
          <div className="text-[11px] font-mono px-2 py-1 rounded bg-black/60 border border-gray-700 text-gray-200">
            {hover.time} · {hover.wics} · {hover.value.toFixed(2)}
          </div>
        )}
        {status && (
          <div className="text-[10px] px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800 text-blue-300">
            {status}
          </div>
        )}
      </div>
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  );
});

export function LeaderboardPanel({
  rows,
  selected,
  onToggle,
  height,
}: {
  rows: LeaderboardRow[];
  selected: Set<string>;
  onToggle: (wics: string, multi: boolean) => void;
  /** Match chart canvas height so list scrolls inside, not the page */
  height: number;
}) {
  return (
    <div
      style={{ height }}
      className="flex flex-col bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden w-[220px] shrink-0"
    >
      <div className="px-3 py-2 border-b border-gray-800 text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
        창 수익률
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar">
        {rows.map((r) => {
          const active = selected.has(r.wics);
          return (
            <button
              key={r.wics}
              type="button"
              // preventDefault on mousedown: avoids focus scroll-into-view that pushes the chart up
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                onToggle(r.wics, e.metaKey || e.ctrlKey);
              }}
              className={clsx(
                "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] border-b border-gray-800/40 hover:bg-gray-800/60 transition-colors",
                active && "bg-gray-800/80 ring-1 ring-inset ring-yellow-500/40"
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: r.color === GHOST_COLOR ? "#6b7280" : r.color,
                }}
              />
              <span className="flex-1 truncate text-gray-300">
                {r.rank}. {r.wics}
              </span>
              <span
                className={clsx(
                  "font-mono shrink-0",
                  r.ret >= 0 ? "text-red-400" : "text-blue-400"
                )}
              >
                {r.ret >= 0 ? "+" : ""}
                {(r.ret * 100).toFixed(1)}%
              </span>
            </button>
          );
        })}
        {!rows.length && <p className="p-3 text-[11px] text-gray-500">데이터 없음</p>}
      </div>
    </div>
  );
}
