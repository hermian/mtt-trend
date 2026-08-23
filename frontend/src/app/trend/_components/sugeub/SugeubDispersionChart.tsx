"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
} from "lightweight-charts";
import type { SupplyDemandPoint } from "@/lib/api";
import {
  DISPERSION_COLORS,
  DISPLAY_COLS,
  CHART_HEIGHTS,
  PRICE_OVERLAY_COLOR,
} from "./constants";
import { createSugeubChartOptions } from "./chartTheme";
import { applyRangeToCharts } from "./sugeubChartSync";
import { SUGEB_LINE_OPTS, toSugeubLineData, type SugeubRangePreset } from "./sugeubChartHelpers";

const MAJOR_KEYS = new Set(["세력", "외국인", "기관계", "개인"]);

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function seriesStyle(key: string, visible: boolean, focusedKey: string | null) {
  const base = DISPERSION_COLORS[key] || "#94a3b8";
  const major = MAJOR_KEYS.has(key);
  const isFocused = focusedKey === key;
  const hasFocus = focusedKey !== null;

  if (!visible) {
    return {
      color: base,
      lineWidth: (major ? 2 : 1) as 1 | 2 | 3 | 4,
      lineStyle: major ? LineStyle.Solid : LineStyle.Dashed,
      visible: false,
    };
  }
  if (hasFocus && !isFocused) {
    return {
      color: withAlpha(base, 0.18),
      lineWidth: 1 as const,
      lineStyle: major ? LineStyle.Solid : LineStyle.Dashed,
      visible: true,
    };
  }
  return {
    color: base,
    lineWidth: (isFocused ? (major ? 3 : 2) : major ? 2 : 1) as 1 | 2 | 3 | 4,
    lineStyle: major ? LineStyle.Solid : LineStyle.Dashed,
    visible: true,
  };
}

export function SugeubDispersionChart({
  series,
  name,
  rangePreset,
  visible,
  onToggleVisible,
}: {
  series: SupplyDemandPoint[];
  name?: string;
  rangePreset: SugeubRangePreset;
  visible: Record<string, boolean>;
  onToggleVisible: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const priceSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const applySeriesStyles = useCallback(() => {
    seriesMapRef.current.forEach((s, key) => {
      s.applyOptions(seriesStyle(key, visible[key] ?? false, focusedKey));
    });
    if (priceSeriesRef.current) {
      priceSeriesRef.current.applyOptions({
        color: focusedKey ? withAlpha(PRICE_OVERLAY_COLOR, 0.12) : PRICE_OVERLAY_COLOR,
        lineWidth: focusedKey ? 1 : 2,
      });
    }
  }, [visible, focusedKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !series.length) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesMapRef.current.clear();
      priceSeriesRef.current = null;
    }

    const width = el.clientWidth || 800;
    const chart = createChart(el, createSugeubChartOptions(width, CHART_HEIGHTS.dispersion));
    chartRef.current = chart;

    DISPLAY_COLS.forEach((key) => {
      const s = chart.addSeries(LineSeries, {
        ...SUGEB_LINE_OPTS,
        ...seriesStyle(key, visible[key] ?? false, focusedKey),
      });
      s.setData(toSugeubLineData(series, (p) => p.dispersion_pct[key]));
      seriesMapRef.current.set(key, s);
    });

    const priceS = chart.addSeries(LineSeries, {
      ...SUGEB_LINE_OPTS,
      color: PRICE_OVERLAY_COLOR,
      lineWidth: 2,
      priceScaleId: "close",
    });
    priceSeriesRef.current = priceS;
    chart.priceScale("close").applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.1 },
    });
    priceS.setData(toSugeubLineData(series, (p) => p.close));

    applyRangeToCharts([chart], series.length, rangePreset);

    chart.subscribeClick((param) => {
      if (!param.point || param.time === undefined) {
        setFocusedKey(null);
        return;
      }
      const threshold = 14;
      let bestKey: string | null = null;
      let bestDist = threshold;
      seriesMapRef.current.forEach((s, key) => {
        if (!(visibleRef.current[key] ?? false)) return;
        const item = param.seriesData?.get(s);
        const value = item && "value" in item ? item.value : null;
        if (typeof value !== "number") return;
        const y = s.priceToCoordinate(value);
        if (y === null) return;
        const dist = Math.abs(y - param.point!.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestKey = key;
        }
      });
      if (bestKey) {
        setFocusedKey((prev) => (prev === bestKey ? null : bestKey));
      } else {
        setFocusedKey(null);
      }
    });

    const ro = new ResizeObserver(() => {
      if (chartRef.current && el) chartRef.current.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current.clear();
      priceSeriesRef.current = null;
    };
    // focusedKey는 applySeriesStyles effect에서 반영 — 차트 재생성 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  useEffect(() => {
    if (chartRef.current && series.length) {
      applyRangeToCharts([chartRef.current], series.length, rangePreset);
    }
  }, [rangePreset, series.length]);

  useEffect(() => {
    applySeriesStyles();
  }, [applySeriesStyles]);

  const handleLegendClick = (key: string) => {
    if (!visible[key]) {
      onToggleVisible(key);
    }
    setFocusedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="px-1 pb-4">
      <div className="text-center text-sm font-semibold text-gray-700 mb-2">
        {name ? `${name} — ` : ""}주체별 분산비율
      </div>
      <div className="rounded border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap gap-1.5 justify-center mb-2">
          {DISPLAY_COLS.map((key) => {
            const isVisible = visible[key] ?? false;
            const isFocused = focusedKey === key;
            const color = DISPERSION_COLORS[key];
            return (
              <button
                key={key}
                type="button"
                title="클릭: 하이라이트 · 더블클릭: 표시/숨김"
                onClick={() => handleLegendClick(key)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onToggleVisible(key);
                  if (focusedKey === key && !visible[key]) {
                    setFocusedKey(null);
                  }
                }}
                className={`px-2 py-0.5 text-[10px] rounded-full border transition-all ${
                  isFocused
                    ? "font-bold shadow-sm scale-105"
                    : isVisible
                    ? "border-gray-400 text-gray-800 bg-gray-100"
                    : "border-gray-200 text-gray-400 bg-white opacity-60"
                }`}
                style={{
                  color: isVisible || isFocused ? color : undefined,
                  borderColor: isFocused ? color : undefined,
                  boxShadow: isFocused ? `0 0 0 2px ${withAlpha(color, 0.35)}` : undefined,
                }}
              >
                {key}
              </button>
            );
          })}
        </div>
        <div
          ref={containerRef}
          data-chart-id="sugeub-dispersion"
          className="w-full cursor-crosshair"
        />
      </div>
    </div>
  );
}
