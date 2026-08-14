"use client";

import React, { useEffect, useRef, useState } from "react";
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  ColorType, 
  CandlestickSeries, 
  LineSeries, 
  HistogramSeries, 
  BaselineSeries,
  AreaSeries,
  LineStyle
} from "lightweight-charts";
import { useChartData } from "@/hooks/useChartData";
import type { ChartDataPoint } from "@/lib/api";
import { toChartTime, toFiniteNumber } from "./_lib/chartTime";

export interface IndicatorConfig {
  id: string;
  name: string;
  type: "candlestick" | "line" | "histogram" | "area" | "baseline";
  heightRatio: number;
  color?: string;
}

const WEATHER_20PANEL_CONFIGS: IndicatorConfig[] = [
  { id: "main", name: "KOSPI 주가 (OHLC) & SMA 50/100/200", type: "candlestick", heightRatio: 5 },
  { id: "stockbee_mm", name: "Stockbee Market Monitor & Above 40MA (T2108)", type: "line", heightRatio: 1.5 },
  { id: "high52_low52", name: "52주 신고가(Red) / 신저가(Blue Area)", type: "line", heightRatio: 1.5 },
  { id: "bam", name: "BAM (ADR 10 Ratio, 1.0=neutral)", type: "line", heightRatio: 1.5, color: "#3b82f6" },
  { id: "adr14", name: "ADR 14 (%, 100=neutral)", type: "line", heightRatio: 1.5, color: "#ef4444" },
  { id: "high52_low52_net", name: "52주 High-Low Net", type: "line", heightRatio: 1.5, color: "#10b981" },
  { id: "vix_fix", name: "Williams VIX Fix & Fear Area", type: "line", heightRatio: 1.5, color: "#ef4444" },
  { id: "mmt_r", name: "MMT Ratio (%)", type: "line", heightRatio: 1.2, color: "#ef4444" },
  { id: "mmt", name: "MMT (Market Momentum 종목 수)", type: "line", heightRatio: 1.2, color: "#f59e0b" },
  { id: "adl", name: "ADL (Advance-Decline Line)", type: "line", heightRatio: 1.5, color: "#ef4444" },
  { id: "above_sma_short", name: "Above 10/20/50 MA pcts (%)", type: "line", heightRatio: 1.5 },
  { id: "above_sma200", name: "Above 200MA pct (%)", type: "line", heightRatio: 1.2, color: "#f43f5e" },
  { id: "market_amount", name: "KOSPI / KOSDAQ 거래대금 (천억원)", type: "line", heightRatio: 1.5 },
  { id: "market_volume", name: "KOSPI / KOSDAQ 거래량 (천만주)", type: "line", heightRatio: 1.5 },
  { id: "rsi", name: "RSI (14)", type: "line", heightRatio: 1.5, color: "#fbbf24" },
  { id: "macd", name: "MACD (12, 26, 9)", type: "line", heightRatio: 1.5, color: "#3b82f6" },
  { id: "zbt", name: "ZBT (Zweig Breadth Thrust)", type: "line", heightRatio: 1.2, color: "#3b82f6" },
  { id: "mcclellan_oscilator", name: "McClellan Oscillator", type: "line", heightRatio: 1.5 },
  { id: "mcclellan_summation", name: "McClellan Summation Index", type: "line", heightRatio: 1.5, color: "#60a5fa" },
  { id: "saito_ratio", name: "Saito Ratio (종목 수)", type: "line", heightRatio: 1.2, color: "#a855f7" },
];

export function KospiWeatherChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<any>[]>>(new Map());
  const isSyncingRef = useRef(false);

  const [hoveredData, setHoveredData] = useState<{
    time: string;
    ohlc?: { open: number; high: number; low: number; close: number; volume: number };
    indicators: Record<string, any>;
  } | null>(null);
  const [status, setStatus] = useState<string>("Initializing...");

  const { data: chartData, isLoading, error } = useChartData("kospi", "all");
  const chartDataRef = useRef(chartData);
  useEffect(() => { chartDataRef.current = chartData; }, [chartData]);

  const scrollToLatest = () => {
    const rows = chartDataRef.current?.data;
    if (!rows?.length || chartsRef.current.size === 0) return;
    const times = rows.map((p) => toChartTime(p.time)).filter((t): t is string => t != null);
    if (times.length === 0) return;
    const lastIndex = times.length - 1;
    const startIndex = Math.max(0, lastIndex - 150);
    const range = { from: times[startIndex] as any, to: times[lastIndex] as any };
    isSyncingRef.current = true;
    chartsRef.current.forEach((c) => {
      try {
        c.timeScale().setVisibleRange(range);
        c.timeScale().scrollToPosition(8, false);
      } catch {
        /* empty / invalid range */
      }
    });
    setTimeout(() => { isSyncingRef.current = false; }, 200);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    setStatus("Building KOSPI Weather 20-Panel Engine...");

    const cleanup = () => {
      chartsRef.current.forEach((c) => c.remove());
      chartsRef.current.clear();
      seriesRef.current.clear();
    };
    cleanup();

    try {
      const scrollArea = containerRef.current.querySelector("[data-scroll-area]") as HTMLElement;
      if (!scrollArea) return;

      WEATHER_20PANEL_CONFIGS.forEach((config, index) => {
        const el = scrollArea.querySelector(`[data-chart-id="${config.id}"]`) as HTMLElement;
        if (!el) return;
        const chartHeight = config.id === "main" ? 380 : 95;
        el.style.height = `${chartHeight}px`;

        const chart = createChart(el, {
          autoSize: true,
          height: chartHeight,
          layout: { background: { type: ColorType.Solid, color: "#0f172a" }, textColor: "#94a3b8" },
          grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
          timeScale: { visible: index === WEATHER_20PANEL_CONFIGS.length - 1, borderColor: "#334155", rightOffset: 20, barSpacing: 10 },
          rightPriceScale: { borderColor: "#334155", scaleMargins: { top: 0.1, bottom: 0.1 }, autoScale: true, minimumWidth: 105 },
          handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
          handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
        });

        chartsRef.current.set(config.id, chart);
        const activeSeries: ISeriesApi<any>[] = [];

        const addPanelSeries = (type: any, options: any = {}) => {
          const isMain = config.id === "main";
          let customFormat = options.priceFormat;
          if (!customFormat && (config.id === "adl" || config.id === "market_amount" || config.id === "market_volume")) {
            customFormat = {
              type: "custom",
              formatter: (price: number) => Math.round(price).toLocaleString(),
              minMove: 1,
            };
          }
          const seriesOptions = {
            ...options,
            ...(customFormat ? { priceFormat: customFormat } : {}),
            priceLineVisible: isMain ? (options.priceLineVisible ?? true) : false,
            lastValueVisible: isMain ? (options.lastValueVisible ?? true) : false,
          };
          const s = chart.addSeries(type, seriesOptions);
          return s;
        };

        const addZeroLine = (series: ISeriesApi<any>, price = 0) => {
          try {
            series.createPriceLine({
              price: price,
              color: "#ffffff",
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
            });
          } catch {}
        };

        if (config.id === "main") {
          activeSeries.push(addPanelSeries(CandlestickSeries, {
            upColor: "#ef4444", downColor: "#3b82f6", wickUpColor: "#ef4444", wickDownColor: "#3b82f6", borderVisible: false
          }));
          activeSeries.push(addPanelSeries(LineSeries, { color: "#ef4444", lineWidth: 2 })); // SMA 50 (Red)
          activeSeries.push(addPanelSeries(LineSeries, { color: "#3b82f6", lineWidth: 2 })); // SMA 100 (Blue)
          activeSeries.push(addPanelSeries(LineSeries, { color: "#10b981", lineWidth: 2 })); // SMA 200 (Green)
        } else if (config.id === "stockbee_mm") {
          const s1 = addPanelSeries(LineSeries, { color: "#ef4444", lineWidth: 2, priceScaleId: "left" }); // Stockbee MM (Red, Left Y-axis)
          try {
            s1.createPriceLine({
              price: 1.0,
              color: "#ffffff",
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
            });
          } catch {}
          activeSeries.push(s1);
          activeSeries.push(addPanelSeries(LineSeries, { color: "#10b981", lineWidth: 2, priceScaleId: "right" })); // Above 40MA (Green, Right Y-axis)
        } else if (config.id === "high52_low52") {
          const s1 = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 0 },
            topFillColor1: "rgba(239, 68, 68, 0.5)",
            topFillColor2: "rgba(239, 68, 68, 0.05)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(239, 68, 68, 0.0)",
            bottomFillColor2: "rgba(239, 68, 68, 0.0)",
            bottomLineColor: "#ef4444",
            lineWidth: 2,
          });
          addZeroLine(s1);
          activeSeries.push(s1);

          const s2 = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 0 },
            topFillColor1: "rgba(59, 130, 246, 0.0)",
            topFillColor2: "rgba(59, 130, 246, 0.0)",
            topLineColor: "#3b82f6",
            bottomFillColor1: "rgba(59, 130, 246, 0.05)",
            bottomFillColor2: "rgba(59, 130, 246, 0.5)",
            bottomLineColor: "#3b82f6",
            lineWidth: 2,
          });
          activeSeries.push(s2);
        } else if (config.id === "bam") {
          // 1. Overbought Red Histogram Bars (>= 1.8: VIX FIX style red bars)
          const sHistOver = addPanelSeries(HistogramSeries, {
            color: "rgba(239, 68, 68, 0.75)",
          });
          try {
            sHistOver.createPriceLine({
              price: 1.8,
              color: "#ef4444",
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
            });
          } catch {}
          activeSeries.push(sHistOver);

          // 2. Oversold Blue Histogram Bars (<= 0.5: VIX FIX style blue bars)
          const sHistUnder = addPanelSeries(HistogramSeries, {
            color: "rgba(59, 130, 246, 0.75)",
          });
          try {
            sHistUnder.createPriceLine({
              price: 0.5,
              color: "#3b82f6",
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
            });
          } catch {}
          activeSeries.push(sHistUnder);

          // 3. Main neutral Line (0.5 ~ 1.8: base slate line)
          const sMain = addPanelSeries(LineSeries, {
            color: "#94a3b8",
            lineWidth: 2,
          });
          activeSeries.push(sMain);

          // 4. Overbought Red Line (>= 1.8: top layer bold red line)
          const sOverLine = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 1.8 },
            topFillColor1: "rgba(0, 0, 0, 0)",
            topFillColor2: "rgba(0, 0, 0, 0)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(0, 0, 0, 0)",
            bottomFillColor2: "rgba(0, 0, 0, 0)",
            bottomLineColor: "rgba(0, 0, 0, 0)",
            lineWidth: 3,
          });
          activeSeries.push(sOverLine);

          // 5. Oversold Blue Line (<= 0.5: top layer bold blue line)
          const sUnderLine = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 0.5 },
            topFillColor1: "rgba(0, 0, 0, 0)",
            topFillColor2: "rgba(0, 0, 0, 0)",
            topLineColor: "rgba(0, 0, 0, 0)",
            bottomFillColor1: "rgba(0, 0, 0, 0)",
            bottomFillColor2: "rgba(0, 0, 0, 0)",
            bottomLineColor: "#3b82f6",
            lineWidth: 3,
          });
          activeSeries.push(sUnderLine);
        } else if (config.id === "adr14") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 100 },
            topFillColor1: "rgba(239, 68, 68, 0.4)",
            topFillColor2: "rgba(239, 68, 68, 0.05)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(59, 130, 246, 0.05)",
            bottomFillColor2: "rgba(59, 130, 246, 0.4)",
            bottomLineColor: "#3b82f6",
            lineWidth: 2,
          });
          try {
            s.createPriceLine({ price: 120, color: "#ef4444", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
            s.createPriceLine({ price: 80, color: "#3b82f6", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
          } catch {}
          activeSeries.push(s);
        } else if (config.id === "high52_low52_net") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 0 },
            topFillColor1: "rgba(239, 68, 68, 0.35)",
            topFillColor2: "rgba(239, 68, 68, 0.05)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(59, 130, 246, 0.05)",
            bottomFillColor2: "rgba(59, 130, 246, 0.35)",
            bottomLineColor: "#3b82f6",
            lineWidth: 2,
          });
          addZeroLine(s);
          activeSeries.push(s);
        } else if (config.id === "mmt_r") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 5.0 },
            topFillColor1: "rgba(239, 68, 68, 0.55)",
            topFillColor2: "rgba(239, 68, 68, 0.1)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(0, 0, 0, 0)",
            bottomFillColor2: "rgba(0, 0, 0, 0)",
            bottomLineColor: "#ef4444",
            lineWidth: 2,
          });
          try {
            s.createPriceLine({ price: 5.0, color: "#ef4444", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
          } catch {}
          activeSeries.push(s);
        } else if (config.id === "mmt") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 100 },
            topFillColor1: "rgba(239, 68, 68, 0.55)",
            topFillColor2: "rgba(239, 68, 68, 0.1)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(0, 0, 0, 0)",
            bottomFillColor2: "rgba(0, 0, 0, 0)",
            bottomLineColor: "#ef4444",
            lineWidth: 2,
            autoscaleInfoProvider: () => ({
              priceRange: { minValue: 0, maxValue: 200 },
            }),
          });
          try {
            s.createPriceLine({ price: 100, color: "#ef4444", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
          } catch {}
          activeSeries.push(s);
        } else if (config.id === "above_sma_short") {
          activeSeries.push(addPanelSeries(LineSeries, { color: "#ef4444", lineWidth: 2 })); // 10MA
          activeSeries.push(addPanelSeries(LineSeries, { color: "#22c55e", lineWidth: 2 })); // 20MA
          activeSeries.push(addPanelSeries(LineSeries, { color: "#eab308", lineWidth: 2 })); // 40MA
          activeSeries.push(addPanelSeries(LineSeries, { color: "#3b82f6", lineWidth: 2 })); // 50MA
        } else if (config.id === "above_sma200") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 50 },
            topFillColor1: "rgba(239, 68, 68, 0.45)",
            topFillColor2: "rgba(239, 68, 68, 0.05)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(59, 130, 246, 0.05)",
            bottomFillColor2: "rgba(59, 130, 246, 0.45)",
            bottomLineColor: "#3b82f6",
            lineWidth: 2,
          });
          try {
            s.createPriceLine({ price: 75, color: "#ef4444", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
            s.createPriceLine({ price: 25, color: "#3b82f6", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
          } catch {}
          activeSeries.push(s);
        } else if (config.id === "market_amount" || config.id === "market_volume") {
          activeSeries.push(addPanelSeries(AreaSeries, {
            topColor: "rgba(239, 68, 68, 0.4)",
            bottomColor: "rgba(239, 68, 68, 0.05)",
            lineColor: "#ef4444",
            lineWidth: 2,
          }));
          activeSeries.push(addPanelSeries(AreaSeries, {
            topColor: "rgba(59, 130, 246, 0.3)",
            bottomColor: "rgba(59, 130, 246, 0.05)",
            lineColor: "#3b82f6",
            lineWidth: 2,
          }));
        } else if (config.id === "rsi_14") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 50 },
            topFillColor1: "rgba(239, 68, 68, 0.35)",
            topFillColor2: "rgba(239, 68, 68, 0.05)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(59, 130, 246, 0.05)",
            bottomFillColor2: "rgba(59, 130, 246, 0.35)",
            bottomLineColor: "#3b82f6",
            lineWidth: 2,
          });
          try {
            s.createPriceLine({ price: 70, color: "#ef4444", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
            s.createPriceLine({ price: 30, color: "#3b82f6", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
          } catch {}
          activeSeries.push(s);
        } else if (config.id === "macd") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 0 },
            topFillColor1: "rgba(239, 68, 68, 0.35)",
            topFillColor2: "rgba(239, 68, 68, 0.05)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(59, 130, 246, 0.05)",
            bottomFillColor2: "rgba(59, 130, 246, 0.35)",
            bottomLineColor: "#3b82f6",
            lineWidth: 2,
          });
          addZeroLine(s);
          activeSeries.push(s);
        } else if (config.id === "zbt") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 0.5 },
            topFillColor1: "rgba(239, 68, 68, 0.4)",
            topFillColor2: "rgba(239, 68, 68, 0.05)",
            topLineColor: "#ef4444",
            bottomFillColor1: "rgba(59, 130, 246, 0.05)",
            bottomFillColor2: "rgba(59, 130, 246, 0.4)",
            bottomLineColor: "#3b82f6",
            lineWidth: 2,
          });
          try {
            s.createPriceLine({ price: 0.615, color: "#ef4444", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
            s.createPriceLine({ price: 0.40, color: "#3b82f6", lineStyle: LineStyle.Dashed, axisLabelVisible: false });
          } catch {}
          activeSeries.push(s);
        } else if (config.id === "mcclellan_oscilator" || config.id === "mcclellan_summation") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 0 },
            topFillColor1: "rgba(59, 130, 246, 0.4)",
            topFillColor2: "rgba(59, 130, 246, 0.05)",
            topLineColor: "#60a5fa",
            bottomFillColor1: "rgba(239, 68, 68, 0.05)",
            bottomFillColor2: "rgba(239, 68, 68, 0.4)",
            bottomLineColor: "#f87171",
            lineWidth: 2,
          });
          addZeroLine(s);
          activeSeries.push(s);
        } else if (config.id === "saito") {
          const s = addPanelSeries(BaselineSeries, {
            baseValue: { type: "price", price: 0 },
            topFillColor1: "rgba(59, 130, 246, 0.5)",
            topFillColor2: "rgba(59, 130, 246, 0.05)",
            topLineColor: "#3b82f6",
            bottomFillColor1: "rgba(239, 68, 68, 0.05)",
            bottomFillColor2: "rgba(239, 68, 68, 0.5)",
            bottomLineColor: "#ef4444",
            lineWidth: 2,
          });
          addZeroLine(s);
          activeSeries.push(s);
        } else if (config.id === "vix_fix") {
          activeSeries.push(addPanelSeries(HistogramSeries, { color: "rgba(249, 115, 22, 0.65)" }));
          activeSeries.push(addPanelSeries(LineSeries, { color: "#ef4444", lineWidth: 1 }));
        } else {
          const seriesType = config.type === "histogram" ? HistogramSeries : LineSeries;
          activeSeries.push(addPanelSeries(seriesType, { color: config.color || "#60a5fa", lineWidth: 2 }));
        }

        seriesRef.current.set(config.id, activeSeries);

        chart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.point || param.point.x < 0) {
            setHoveredData(null);
          } else {
            const timeStr = String(param.time).split("T")[0];
            const dataPoint = chartDataRef.current?.data?.find((d) => toChartTime(d.time) === timeStr);
            if (dataPoint) {
              setHoveredData({
                time: timeStr,
                ohlc: { open: dataPoint.open ?? 0, high: dataPoint.high ?? 0, low: dataPoint.low ?? 0, close: dataPoint.close ?? 0, volume: dataPoint.volume ?? 0 },
                indicators: dataPoint.indicators || {},
              });
            }
          }
        });

        chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
          if (isSyncingRef.current || !logicalRange) return;
          isSyncingRef.current = true;
          chartsRef.current.forEach((c) => {
            if (c !== chart) {
              try {
                c.timeScale().setVisibleLogicalRange(logicalRange);
              } catch {
                // ignore
              }
            }
          });
          isSyncingRef.current = false;
        });
      });

      setStatus("Ready");
    } catch (err) {
      console.error(err);
      setStatus("Initialization Error");
    }

    return cleanup;
  }, []);

  useEffect(() => {
    const rows = chartData?.data;
    if (!rows || chartsRef.current.size === 0) return;
    const points: ChartDataPoint[] = rows;

    const linePoints = (pick: (p: ChartDataPoint) => unknown) => {
      const out: { time: string; value: number }[] = [];
      const seen = new Set<string>();
      for (const p of points) {
        const time = toChartTime(p.time);
        const value = toFiniteNumber(pick(p));
        if (!time || value == null || seen.has(time)) continue;
        seen.add(time);
        out.push({ time, value });
      }
      return out.sort((a, b) => (a.time < b.time ? -1 : 1));
    };

    const candlePoints = () => {
      const out: { time: string; open: number; high: number; low: number; close: number }[] = [];
      const seen = new Set<string>();
      for (const p of points) {
        const time = toChartTime(p.time);
        const open = toFiniteNumber(p.open);
        const high = toFiniteNumber(p.high);
        const low = toFiniteNumber(p.low);
        const close = toFiniteNumber(p.close);
        if (!time || open == null || high == null || low == null || close == null || seen.has(time)) continue;
        seen.add(time);
        out.push({ time, open, high, low, close });
      }
      return out.sort((a, b) => (a.time < b.time ? -1 : 1));
    };

    const safeSet = (series: ISeriesApi<any> | undefined, data: unknown[]) => {
      if (!series) return;
      try {
        series.setData(data as any);
      } catch (err) {
        console.error("KospiWeatherChart setData failed", err);
      }
    };

    WEATHER_20PANEL_CONFIGS.forEach((config) => {
      const activeSeries = seriesRef.current.get(config.id);
      if (!activeSeries || activeSeries.length === 0) return;

      if (config.id === "main") {
        const safeSma = (val: unknown, close: number) => {
          const n = typeof val === "number" ? val : Number(val);
          return Number.isFinite(n) && n > 0 ? n : close;
        };
        safeSet(activeSeries[0], candlePoints());
        safeSet(activeSeries[1], linePoints((p) => safeSma(p.indicators?.price_sma50, p.close ?? 0)));
        safeSet(activeSeries[2], linePoints((p) => safeSma(p.indicators?.price_sma100, p.close ?? 0)));
        safeSet(activeSeries[3], linePoints((p) => safeSma(p.indicators?.price_sma200, p.close ?? 0)));
      } else if (config.id === "stockbee_mm") {
        safeSet(activeSeries[0], linePoints((p) => p.indicators?.stockbee_mm));
        safeSet(activeSeries[1], linePoints((p) => p.indicators?.above_sma40));
      } else if (config.id === "high52_low52") {
        safeSet(activeSeries[0], linePoints((p) => (p.indicators?.high52sum !== undefined ? Math.min(p.indicators.high52sum, 200) : undefined)));
        safeSet(activeSeries[1], linePoints((p) => (p.indicators?.low52sum !== undefined ? Math.max(-Math.abs(p.indicators.low52sum), -200) : undefined)));
      } else if (config.id === "high52_low52_net") {
        safeSet(activeSeries[0], linePoints((p) => (p.indicators?.high52_low52 !== undefined ? p.indicators.high52_low52 : (p.indicators?.high52sum !== undefined && p.indicators?.low52sum !== undefined ? p.indicators.high52sum - p.indicators.low52sum : undefined))));
      } else if (config.id === "bam") {
        safeSet(activeSeries[0], linePoints((p) => (p.indicators?.bam !== undefined && p.indicators.bam >= 1.8 ? p.indicators.bam : undefined)));
        safeSet(activeSeries[1], linePoints((p) => (p.indicators?.bam !== undefined && p.indicators.bam <= 0.5 ? p.indicators.bam : undefined)));
        safeSet(activeSeries[2], linePoints((p) => p.indicators?.bam));
        safeSet(activeSeries[3], linePoints((p) => p.indicators?.bam));
        safeSet(activeSeries[4], linePoints((p) => p.indicators?.bam));
      } else if (config.id === "above_sma_short") {
        safeSet(activeSeries[0], linePoints((p) => p.indicators?.above_sma10));
        safeSet(activeSeries[1], linePoints((p) => p.indicators?.above_sma20));
        safeSet(activeSeries[2], linePoints((p) => p.indicators?.above_sma40));
        safeSet(activeSeries[3], linePoints((p) => p.indicators?.above_sma50));
      } else if (config.id === "market_amount") {
        safeSet(activeSeries[0], linePoints((p) => p.indicators?.kospi_amount));
        safeSet(activeSeries[1], linePoints((p) => p.indicators?.kosdaq_amount));
      } else if (config.id === "market_volume") {
        safeSet(activeSeries[0], linePoints((p) => p.indicators?.kospi_volume));
        safeSet(activeSeries[1], linePoints((p) => p.indicators?.kosdaq_volume));
      } else if (config.id === "vix_fix") {
        safeSet(activeSeries[0], linePoints((p) => p.indicators?.vix_fix_fear));
        safeSet(activeSeries[1], linePoints((p) => p.indicators?.vix_fix));
      } else if (config.id === "mmt_r") {
        safeSet(activeSeries[0], linePoints((p) => (p.indicators?.mmt_r !== undefined ? p.indicators.mmt_r : p.indicators?.above_sma40)));
      } else if (config.id === "mmt") {
        safeSet(activeSeries[0], linePoints((p) => (p.indicators?.mmt !== undefined ? p.indicators.mmt : p.indicators?.adv)));
      } else {
        const alias: Record<string, string> = {
          mcclellan_summation: "mcclellan_summation_indicator",
        };
        const key = alias[config.id] || config.id;
        safeSet(activeSeries[0], linePoints((p) => {
          const indicators = p.indicators || {};
          const found = Object.keys(indicators).find((k) => k.toLowerCase() === key.toLowerCase());
          return found ? indicators[found] : undefined;
        }));
      }
    });

    setTimeout(() => { scrollToLatest(); }, 300);
  }, [chartData]);

  const renderTooltip = (config: IndicatorConfig) => {
    if (!hoveredData || !hoveredData.indicators) return null;
    const ind = hoveredData.indicators || {};
    const ohlc = hoveredData.ohlc;

    return (
      <div className="absolute top-1 left-2 z-30 pointer-events-none text-[9px] font-mono bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-700/50 flex gap-2 text-slate-200 shadow-md">
        {config.id === "main" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-emerald-400 font-bold">{hoveredData.time}</span>
            <span className="text-slate-400">O:</span>
            <span className="text-slate-200">{(ohlc?.open ?? 0).toLocaleString()}</span>
            <span className="text-slate-400">H:</span>
            <span className="text-slate-200">{(ohlc?.high ?? 0).toLocaleString()}</span>
            <span className="text-slate-400">L:</span>
            <span className="text-slate-200">{(ohlc?.low ?? 0).toLocaleString()}</span>
            <span className="text-slate-400">C:</span>
            <span className={(ohlc?.close ?? 0) >= (ohlc?.open ?? 0) ? "text-red-400 font-bold" : "text-blue-400 font-bold"}>
              {(ohlc?.close ?? 0).toLocaleString()}
            </span>
            <span className="text-red-400 font-bold ml-2">SMA50: {(ind["price_sma50"] ?? 0).toLocaleString()}</span>
            <span className="text-blue-400 font-bold ml-1">SMA100: {(ind["price_sma100"] ?? 0).toLocaleString()}</span>
            <span className="text-emerald-400 font-bold ml-1">SMA200: {(ind["price_sma200"] ?? 0).toLocaleString()}</span>
          </div>
        ) : config.id === "stockbee_mm" ? (
          <><span className="text-red-400 font-bold">MM: {ind["stockbee_mm"] ?? 0}</span><span className="text-emerald-400 font-bold ml-2">Above 40MA: {ind["above_sma40"] ?? 0}%</span></>
        ) : config.id === "high52_low52" ? (
          <><span className="text-red-400 font-bold">H52: {ind["high52sum"] ?? 0}</span><span className="text-blue-400 font-bold ml-1">L52: {ind["low52sum"] ?? 0}</span></>
        ) : config.id === "high52_low52_net" ? (
          <span className="text-emerald-400 font-bold">H-L Net: {ind["high52_low52"] ?? (ind["high52sum"] !== undefined && ind["low52sum"] !== undefined ? ind["high52sum"] - ind["low52sum"] : 0)}</span>
        ) : config.id === "vix_fix" ? (
          <span className="text-emerald-400 font-bold">VIX FIX: {ind["vix_fix"] ?? 0}</span>
        ) : config.id === "mmt_r" ? (
          <span className="text-emerald-400 font-bold">MMT Ratio: {ind["mmt_r"] ?? ind["above_sma40"] ?? 0}%</span>
        ) : config.id === "mmt" ? (
          <span className="text-emerald-400 font-bold">MMT: {ind["mmt"] ?? ind["adv"] ?? 0}</span>
        ) : config.id === "adl" ? (
          <span className="text-emerald-400 font-bold">ADL: {ind["adl"] !== undefined ? Number(ind["adl"]).toLocaleString() : "-"}</span>
        ) : config.id === "bam" ? (
          <span className="text-emerald-400 font-bold">BAM(ADR10): {ind["bam"] ?? 0}</span>
        ) : config.id === "adr14" ? (
          <span className="text-emerald-400 font-bold">ADR14: {ind["adr14"] ?? "-"}</span>
        ) : config.id === "above_sma_short" ? (
          <><span className="text-red-500 font-bold">10: {ind["above_sma10"] ?? 0}%</span><span className="text-green-500 font-bold ml-1">20: {ind["above_sma20"] ?? 0}%</span><span className="text-yellow-500 font-bold ml-1">40: {ind["above_sma40"] ?? 0}%</span><span className="text-blue-500 font-bold ml-1">50: {ind["above_sma50"] ?? 0}%</span></>
        ) : config.id === "above_sma200" ? (
          <span className="text-emerald-400 font-bold">200: {ind["above_sma200"] ?? 0}%</span>
        ) : config.id === "market_amount" ? (
          <><span className="text-red-400 font-bold">KS대금: {ind["kospi_amount"] ?? 0}천억</span><span className="text-blue-400 font-bold ml-1">KQ대금: {ind["kosdaq_amount"] ?? 0}천억</span></>
        ) : config.id === "market_volume" ? (
          <><span className="text-red-400 font-bold">KS량: {ind["kospi_volume"] ?? 0}천만</span><span className="text-blue-400 font-bold ml-1">KQ량: {ind["kosdaq_volume"] ?? 0}천만</span></>
        ) : config.id === "rsi" ? (
          <span className="text-emerald-400 font-bold">RSI_14: {ind["rsi"] ?? 0}</span>
        ) : config.id === "macd" ? (
          <span className="text-emerald-400 font-bold">MACD: {ind["macd"] ?? 0}</span>
        ) : config.id === "zbt" ? (
          <span className="text-emerald-400 font-bold">ZBT: {ind["zbt"] ?? 0}</span>
        ) : config.id === "mcclellan_oscilator" ? (
          <span className="text-emerald-400 font-bold">McC OSC: {ind["mcclellan_oscilator"] ?? 0}</span>
        ) : config.id === "mcclellan_summation" ? (
          <span className="text-emerald-400 font-bold">McC SUM: {ind["mcclellan_summation"] ?? ind["mcclellan_summation_indicator"] ?? 0}</span>
        ) : config.id === "saito_ratio" ? (
          <span className="text-emerald-400 font-bold">Saito: {ind["saito_ratio"] ?? 0}</span>
        ) : (
          <span className="text-emerald-400 font-bold">{ind[config.id] ?? "-"}</span>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative flex flex-col w-full h-screen bg-slate-950 overflow-hidden border-t border-slate-800">
      <div className="px-3 py-1 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4 shrink-0 h-9">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${status === "Ready" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-blue-500 animate-pulse"}`} />
          <h3 className="font-bold text-slate-100 text-xs uppercase tracking-tight">KOSPI Weather Full-Period (1995~Present)</h3>
          <button onClick={scrollToLatest} className="text-[9px] bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-700 transition-all font-bold uppercase tracking-wider">
            Sync Latest
          </button>
        </div>
      </div>

      <div data-scroll-area className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 relative">
        {isLoading && (
          <div className="absolute inset-0 z-40 bg-slate-950/80 flex items-center justify-center text-emerald-400 text-xs font-mono animate-pulse">
            Loading KOSPI Weather 20-Panel History...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-40 bg-slate-950/90 flex items-center justify-center text-red-400 text-xs font-mono">
            Failed to load KOSPI Weather data.
          </div>
        )}

        {WEATHER_20PANEL_CONFIGS.map((config) => (
          <div key={config.id} className="relative w-full border-b border-slate-800/80 group">
            {renderTooltip(config)}
            <div data-chart-id={config.id} className="w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default KospiWeatherChart;
