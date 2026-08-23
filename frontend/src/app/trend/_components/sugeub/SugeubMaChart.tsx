"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
} from "lightweight-charts";
import type { SupplyDemandPoint } from "@/lib/api";
import { toChartTime } from "../_lib/chartTime";
import { MA_COLORS, MA_LINE_WIDTH, CHART_HEIGHTS } from "./constants";
import { createSugeubChartOptions } from "./chartTheme";
import { linkSugeubCharts, applyRangeToCharts, syncRightPriceScaleWidths } from "./sugeubChartSync";
import { SUGEB_LINE_OPTS, toSugeubLineData, type SugeubRangePreset } from "./sugeubChartHelpers";

function rollingMean(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i + 1 < window) return null;
    const slice = values.slice(i + 1 - window, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

export function SugeubMaChart({
  series,
  name,
  rangePreset,
}: {
  series: SupplyDemandPoint[];
  name?: string;
  rangePreset: SugeubRangePreset;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<IChartApi[]>([]);
  const unlinkRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !series.length) return;

    chartsRef.current.forEach((c) => c.remove());
    chartsRef.current = [];
    unlinkRef.current?.();
    unlinkRef.current = null;

    const panels = [
      { id: "price", height: CHART_HEIGHTS.maPrice },
      { id: "osc", height: CHART_HEIGHTS.maOsc },
      { id: "accum", height: CHART_HEIGHTS.maAccum },
    ];

    const closes = series.map((p) => p.close);
    const ma20 = rollingMean(closes, 20);
    const primarySeries: ISeriesApi<"Line">[] = [];

    panels.forEach((panel, idx) => {
      const el = root.querySelector(`[data-sugeub-panel="${panel.id}"]`) as HTMLElement;
      if (!el) return;
      el.style.height = `${panel.height}px`;
      const width = el.clientWidth || 800;
      const chart = createChart(el, createSugeubChartOptions(width, panel.height));
      chartsRef.current.push(chart);

      if (panel.id === "price") {
        const closeS = chart.addSeries(LineSeries, { ...SUGEB_LINE_OPTS, color: MA_COLORS.종가, lineWidth: 1 });
        const maS = chart.addSeries(LineSeries, { ...SUGEB_LINE_OPTS, color: MA_COLORS["종가 20MA"], lineWidth: 2 });
        closeS.setData(
          series
            .map((p) => ({ time: toChartTime(p.date), value: p.close }))
            .filter((d): d is { time: string; value: number } => !!d.time)
        );
        maS.setData(
          series
            .map((p, i) => ({ time: toChartTime(p.date), value: ma20[i] }))
            .filter((d): d is { time: string; value: number } => !!d.time && d.value != null)
        );
        primarySeries.push(closeS);
      } else if (panel.id === "osc") {
        const oscS = chart.addSeries(LineSeries, { ...SUGEB_LINE_OPTS, color: MA_COLORS.oscillator, lineWidth: 1 });
        oscS.setData(toSugeubLineData(series, (p) => p.force_oscillator));
        oscS.createPriceLine({
          price: 0,
          color: "rgba(148,163,184,0.5)",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          lineVisible: true,
          title: "",
        });
        primarySeries.push(oscS);
      } else {
        const first = chart.addSeries(LineSeries, {
          ...SUGEB_LINE_OPTS,
          color: MA_COLORS.세력,
          lineWidth: MA_LINE_WIDTH.세력,
        });
        (["세력", "외국인", "기관계", "개인"] as const).forEach((key, i) => {
          const s =
            i === 0
              ? first
              : chart.addSeries(LineSeries, {
                  ...SUGEB_LINE_OPTS,
                  color: MA_COLORS[key],
                  lineWidth: MA_LINE_WIDTH[key],
                });
          s.setData(toSugeubLineData(series, (p) => p.accumulation_3ma[key]));
        });
        primarySeries.push(first);
      }

      chart.timeScale().applyOptions({
        visible: idx === panels.length - 1,
        rightOffset: 5,
        barSpacing: 6,
      });
    });

    if (chartsRef.current.length > 0) {
      unlinkRef.current = linkSugeubCharts(
        chartsRef.current,
        root,
        chartsRef.current.map((chart, i) => ({ chart, series: primarySeries[i] })),
        series.length,
        rangePreset
      );
    }

    const ro = new ResizeObserver(() => {
      panels.forEach((panel, i) => {
        const el = root.querySelector(`[data-sugeub-panel="${panel.id}"]`) as HTMLElement;
        const chart = chartsRef.current[i];
        if (el && chart) chart.applyOptions({ width: el.clientWidth });
      });
      syncRightPriceScaleWidths(chartsRef.current);
    });
    ro.observe(root);

    return () => {
      ro.disconnect();
      unlinkRef.current?.();
      unlinkRef.current = null;
      chartsRef.current.forEach((c) => c.remove());
      chartsRef.current = [];
    };
  }, [series]);

  useEffect(() => {
    if (!chartsRef.current.length || !series.length) return;
    applyRangeToCharts(chartsRef.current, series.length, rangePreset);
  }, [rangePreset, series.length]);

  return (
    <div ref={containerRef} className="space-y-0 pb-2">
      <div className="text-center text-sm font-semibold text-gray-700 px-2 mb-2">
        {name ? `${name} — ` : ""}종가 · 세력 오실레이터 · 주체별 누적 매집수량(3일 이평)
      </div>
      <div className="border border-gray-200 rounded-t bg-white mx-1 overflow-hidden">
        <div data-sugeub-panel="price" className="w-full" />
      </div>
      <div className="border-x border-gray-200 bg-white mx-1 overflow-hidden">
        <div data-sugeub-panel="osc" className="w-full" />
      </div>
      <div className="border border-gray-200 rounded-b bg-white mx-1 overflow-hidden">
        <div data-sugeub-panel="accum" className="w-full" />
      </div>
    </div>
  );
}
