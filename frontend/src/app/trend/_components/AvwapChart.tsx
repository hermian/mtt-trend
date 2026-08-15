"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
} from "lightweight-charts";
import { useAvwapChart } from "@/hooks/useAvwapChart";
import type { AvwapPoint } from "@/lib/api";
import { toChartTime, toFiniteNumber } from "./_lib/chartTime";

const MA_COLORS: Record<string, string> = {
  EMA_10: "#c084fc", // Purple
  EMA_21: "#f97316", // Orange
  SMA_50: "#ef4444", // Red
  SMA_150: "#3b82f6", // Blue
  SMA_200: "#10b981", // Green
  SMA_10: "#ef4444",
  SMA_30: "#3b82f6",
  SMA_40: "#10b981",
  SMA_6: "#ef4444",
  SMA_12: "#3b82f6",
  SMA_24: "#10b981",
  SMA_3: "#ef4444",
  SMA_5: "#3b82f6",
};

export function AvwapChart() {
  const [market, setMarket] = useState<"kospi" | "kosdaq">("kospi");
  const [interval, setInterval] = useState<"1D" | "1W" | "1M" | "1Y">("1D");

  const { data: chartData, isLoading, error } = useAvwapChart(market, interval);

  const containerRef = useRef<HTMLDivElement>(null);
  const verticalGuideRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<any>[]>>(new Map());
  const anchorSeriesMapRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const isSyncingRef = useRef(false);

  // Toggle state for base vwap, hvwap, lvwap, bb_upper, and individual anchor dates
  const [showVwap, setShowVwap] = useState(true);
  const [showHvwap, setShowHvwap] = useState(true);
  const [showLvwap, setShowLvwap] = useState(true);
  const [showBbUpper, setShowBbUpper] = useState(true);
  const [enabledAnchors, setEnabledAnchors] = useState<Set<string>>(new Set());

  // Initialize enabled anchors when data changes
  useEffect(() => {
    if (chartData?.anchors) {
      setEnabledAnchors(new Set(chartData.anchors.map((a) => a.id)));
    }
  }, [chartData]);

  const [hoveredData, setHoveredData] = useState<{
    time: string;
    ohlc?: { open: number; high: number; low: number; close: number; volume: number; changePct?: number | null };
    rsi?: number | null;
    vixFix?: number | null;
    amount?: number | null;
    amountSma50?: number | null;
    vwap?: number | null;
    hvwap?: number | null;
    lvwap?: number | null;
    ma?: Record<string, number | null>;
  } | null>(null);

  // Toggle individual anchor
  const toggleAnchor = (id: string) => {
    setEnabledAnchors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllAnchors = (enable: boolean) => {
    if (enable && chartData?.anchors) {
      setEnabledAnchors(new Set(chartData.anchors.map((a) => a.id)));
    } else {
      setEnabledAnchors(new Set());
    }
  };

  // Build chart layout when chartData arrives
  useEffect(() => {
    if (!containerRef.current || !chartData || chartData.points.length === 0) return;

    const scrollArea = containerRef.current;
    let onCustomWheel: (e: WheelEvent) => void;

    const cleanup = () => {
      if (onCustomWheel) {
        scrollArea.removeEventListener("wheel", onCustomWheel);
      }
      chartsRef.current.forEach((c) => c.remove());
      chartsRef.current.clear();
      seriesRef.current.clear();
      anchorSeriesMapRef.current.clear();
    };
    cleanup();

    try {
      // Zoom & Pan handler with wheel
      onCustomWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey || e.altKey) {
          e.preventDefault();
          const firstChart = chartsRef.current.values().next().value;
          if (!firstChart) return;
          const currentRange = firstChart.timeScale().getVisibleLogicalRange();
          if (!currentRange) return;

          const delta = e.deltaY;
          const zoomFactor = delta > 0 ? 1.15 : 0.85;
          const length = currentRange.to - currentRange.from;
          const newLength = Math.max(10, Math.min(10000, length * zoomFactor));
          const diff = newLength - length;

          const rect = scrollArea.getBoundingClientRect();
          const cursorRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const newFrom = currentRange.from - diff * cursorRatio;
          const newTo = currentRange.to + diff * (1 - cursorRatio);

          isSyncingRef.current = true;
          chartsRef.current.forEach((c) => {
            try {
              c.timeScale().setVisibleLogicalRange({ from: newFrom, to: newTo });
            } catch {}
          });
          isSyncingRef.current = false;
        } else if (e.shiftKey) {
          e.preventDefault();
          const firstChart = chartsRef.current.values().next().value;
          if (!firstChart) return;
          const currentRange = firstChart.timeScale().getVisibleLogicalRange();
          if (!currentRange) return;

          const length = currentRange.to - currentRange.from;
          const shiftAmount = (e.deltaY || e.deltaX) * (length / 600);
          const newFrom = currentRange.from + shiftAmount;
          const newTo = currentRange.to + shiftAmount;

          isSyncingRef.current = true;
          chartsRef.current.forEach((c) => {
            try {
              c.timeScale().setVisibleLogicalRange({ from: newFrom, to: newTo });
            } catch {}
          });
          isSyncingRef.current = false;
        }
      };

      scrollArea.addEventListener("wheel", onCustomWheel, { passive: false });

      const panels = [
        { id: "rsi", name: "RSI (14)", height: 90 },
        { id: "main", name: `${market.toUpperCase()} 주가 & AVWAP`, height: 420 },
        { id: "volume", name: "거래량 & VIX Fix", height: 110 },
        { id: "amount", name: "거래대금 (조원) & SMA50", height: 180 },
      ];

      panels.forEach((panel, index) => {
        const el = scrollArea.querySelector(`[data-chart-id="${panel.id}"]`) as HTMLElement;
        if (!el) return;
        el.style.height = `${panel.height}px`;

        const chart = createChart(el, {
          autoSize: true,
          height: panel.height,
          layout: {
            background: { type: ColorType.Solid, color: "#090d16" },
            textColor: "#94a3b8",
          },
          grid: {
            vertLines: { color: "#1e293b" },
            horzLines: { color: "#1e293b" },
          },
          timeScale: {
            visible: index === panels.length - 1,
            borderColor: "#334155",
            rightOffset: 15,
            barSpacing: interval === "1D" ? 6 : interval === "1W" ? 10 : interval === "1M" ? 14 : 20,
          },
          rightPriceScale: {
            borderColor: "#334155",
            scaleMargins: panel.id === "amount" 
              ? { top: 0.05, bottom: 0 } 
              : panel.id === "volume" 
                ? { top: 0.08, bottom: 0 } 
                : { top: 0.1, bottom: 0.1 },
            autoScale: true,
            minimumWidth: 85,
          },
          leftPriceScale: {
            visible: panel.id === "volume",
            borderColor: "#334155",
            scaleMargins: { top: 0.2, bottom: 0.1 },
            autoScale: true,
            minimumWidth: 50,
          },
          handleScroll: {
            mouseWheel: false,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: false,
            pinch: true,
          },
          crosshair: {
            vertLine: { visible: false },
            horzLine: {
              visible: true,
              style: LineStyle.Dashed,
              width: 1,
              color: "#94a3b8",
              labelVisible: true,
            },
          },
        });

        chartsRef.current.set(panel.id, chart);
        const activeSeries: ISeriesApi<any>[] = [];

        // 1. Panel: RSI
        if (panel.id === "rsi") {
          const rsiSeries = chart.addSeries(LineSeries, {
            color: "#fbbf24",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          // Add 70 / 30 / 50 threshold lines
          try {
            rsiSeries.createPriceLine({ price: 70, color: "#ef4444", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" });
            rsiSeries.createPriceLine({ price: 30, color: "#3b82f6", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" });
            rsiSeries.createPriceLine({ price: 50, color: "#475569", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });
          } catch {}
          activeSeries.push(rsiSeries);
        }

        // 2. Panel: Main Price (Candlestick + MAs + BB + AVWAP)
        else if (panel.id === "main") {
          const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#ef4444",
            downColor: "#3b82f6",
            wickUpColor: "#ef4444",
            wickDownColor: "#3b82f6",
            borderVisible: false,
          });
          activeSeries.push(candleSeries);

          // Moving Averages
          const samplePoint = chartData.points[chartData.points.length - 1];
          if (samplePoint && samplePoint.ma) {
            Object.keys(samplePoint.ma).forEach((maKey) => {
              const color = MA_COLORS[maKey] || "#94a3b8";
              const s = chart.addSeries(LineSeries, {
                color,
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              activeSeries.push(s);
            });
          }

          // BB Upper
          const bbSeries = chart.addSeries(LineSeries, {
            color: "#64748b",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(bbSeries);

          // Base VWAP (White), HVWAP (Red), LVWAP (Yellow)
          const vwapSeries = chart.addSeries(LineSeries, {
            color: "#f8fafc",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          activeSeries.push(vwapSeries);

          const hvwapSeries = chart.addSeries(LineSeries, {
            color: "#f43f5e",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          activeSeries.push(hvwapSeries);

          const lvwapSeries = chart.addSeries(LineSeries, {
            color: "#eab308",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          activeSeries.push(lvwapSeries);

          // Anchor series
          if (chartData.anchors) {
            chartData.anchors.forEach((anc) => {
              const aSeries = chart.addSeries(LineSeries, {
                color: anc.color,
                lineWidth: 1,
                lineStyle: LineStyle.Solid,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              anchorSeriesMapRef.current.set(anc.id, aSeries);
            });
          }
        }

        // 3. Panel: Volume & VIX Fix
        else if (panel.id === "volume") {
          const volSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(volSeries);

          const volMaSeries = chart.addSeries(LineSeries, {
            color: "#60a5fa",
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(volMaSeries);

          const vixSeries = chart.addSeries(LineSeries, {
            color: "#10b981",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceScaleId: "left",
            priceLineVisible: false,
            lastValueVisible: true,
          });
          activeSeries.push(vixSeries);
        }

        // 4. Panel: Trading Amount (거래대금, 조원) & Amount SMA50
        else if (panel.id === "amount") {
          const amtSeries = chart.addSeries(HistogramSeries, {
            priceFormat: {
              type: "custom",
              formatter: (price: number) => `${price.toFixed(1)}조`,
              minMove: 0.1,
            },
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(amtSeries);

          const amtSmaSeries = chart.addSeries(LineSeries, {
            color: "#f59e0b",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          activeSeries.push(amtSmaSeries);
        }

        seriesRef.current.set(panel.id, activeSeries);

        // TimeScale sync
        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncingRef.current || !range) return;
          isSyncingRef.current = true;
          chartsRef.current.forEach((otherChart, otherId) => {
            if (otherId !== panel.id) {
              try {
                otherChart.timeScale().setVisibleLogicalRange(range);
              } catch {}
            }
          });
          isSyncingRef.current = false;
        });

        // Crosshair move & Vertical sync line
        chart.subscribeCrosshairMove((param) => {
          if (!param.point || !param.time) {
            if (verticalGuideRef.current) {
              verticalGuideRef.current.style.display = "none";
            }
            return;
          }

          if (verticalGuideRef.current) {
            const chartRect = el.getBoundingClientRect();
            const containerRect = scrollArea.getBoundingClientRect();
            const x = param.point.x + (chartRect.left - containerRect.left);
            verticalGuideRef.current.style.display = "block";
            verticalGuideRef.current.style.left = `${x}px`;
          }

          // Format hovered time
          const tStr = typeof param.time === "string" ? param.time : "";
          const matchedPoint = chartData.points.find((p) => p.date === tStr);
          if (matchedPoint) {
            setHoveredData({
              time: matchedPoint.date,
              ohlc: {
                open: matchedPoint.open,
                high: matchedPoint.high,
                low: matchedPoint.low,
                close: matchedPoint.close,
                volume: matchedPoint.volume,
                changePct: matchedPoint.change_pct,
              },
              rsi: matchedPoint.rsi,
              vixFix: matchedPoint.vix_fix,
              amount: matchedPoint.amount,
              amountSma50: matchedPoint.amount_sma50,
              vwap: matchedPoint.vwap,
              hvwap: matchedPoint.hvwap,
              lvwap: matchedPoint.lvwap,
              ma: matchedPoint.ma,
            });
          }
        });
      });

      // Helper to generate clean, sorted { time, value } data for lightweight-charts
      const linePoints = (pick: (p: AvwapPoint) => unknown) => {
        const out: { time: string; value: number }[] = [];
        const seen = new Set<string>();
        for (const p of chartData.points) {
          const time = toChartTime(p.date);
          const value = toFiniteNumber(pick(p));
          if (!time || value == null || seen.has(time)) continue;
          seen.add(time);
          out.push({ time, value });
        }
        return out.sort((a, b) => (a.time < b.time ? -1 : 1));
      };

      // Populate Series Data
      const pts = chartData.points;
      if (pts.length > 0) {
        // 1. RSI
        const rsiSeries = seriesRef.current.get("rsi")?.[0];
        if (rsiSeries) {
          rsiSeries.setData(linePoints((p) => p.rsi));
        }

        // 2. Main Candle + MAs + BB + VWAP
        const mainSeriesList = seriesRef.current.get("main") || [];
        if (mainSeriesList.length > 0) {
          const candleSeries = mainSeriesList[0];
          const candleData = pts
            .map((p) => {
              const time = toChartTime(p.date);
              if (!time) return null;
              return {
                time,
                open: p.open,
                high: p.high,
                low: p.low,
                close: p.close,
              };
            })
            .filter((c): c is NonNullable<typeof c> => c !== null);
          candleSeries.setData(candleData);

          let sIdx = 1;
          const samplePoint = pts[pts.length - 1];
          if (samplePoint?.ma) {
            Object.keys(samplePoint.ma).forEach((maKey) => {
              const maS = mainSeriesList[sIdx++];
              if (maS) {
                maS.setData(linePoints((p) => p.ma[maKey]));
              }
            });
          }

          // BB Upper
          const bbS = mainSeriesList[sIdx++];
          if (bbS) {
            bbS.setData(showBbUpper ? linePoints((p) => p.bb_upper) : []);
          }

          // Base VWAP
          const vwapS = mainSeriesList[sIdx++];
          if (vwapS) {
            vwapS.setData(showVwap ? linePoints((p) => p.vwap) : []);
          }

          // HVWAP
          const hvwapS = mainSeriesList[sIdx++];
          if (hvwapS) {
            hvwapS.setData(showHvwap ? linePoints((p) => p.hvwap) : []);
          }

          // LVWAP
          const lvwapS = mainSeriesList[sIdx++];
          if (lvwapS) {
            lvwapS.setData(showLvwap ? linePoints((p) => p.lvwap) : []);
          }
        }

        // Anchor series
        if (chartData.anchors) {
          chartData.anchors.forEach((anc) => {
            const aS = anchorSeriesMapRef.current.get(anc.id);
            if (aS) {
              if (enabledAnchors.has(anc.id)) {
                const aData = anc.values
                  .map((v) => {
                    const time = toChartTime(v.date);
                    const value = toFiniteNumber(v.value);
                    if (!time || value == null) return null;
                    return { time, value };
                  })
                  .filter((v): v is NonNullable<typeof v> => v !== null);
                aS.setData(aData);
              } else {
                aS.setData([]);
              }
            }
          });
        }

        // 3. Volume & VIX Fix
        const volSeriesList = seriesRef.current.get("volume") || [];
        if (volSeriesList.length >= 3) {
          const volS = volSeriesList[0];
          const volMaS = volSeriesList[1];
          const vixS = volSeriesList[2];

          const volData = pts
            .map((p, i) => {
              const time = toChartTime(p.date);
              if (!time) return null;
              const isUp = i === 0 || p.close >= pts[i - 1].close;
              return {
                time,
                value: p.volume,
                color: isUp ? "rgba(239, 68, 68, 0.6)" : "rgba(59, 130, 246, 0.6)",
              };
            })
            .filter((v): v is NonNullable<typeof v> => v !== null);
          volS.setData(volData);

          volMaS.setData(linePoints((p) => p.vol_ma));
          vixS.setData(linePoints((p) => p.vix_fix));
        }

        // 4. Amount (거래대금) & Amount SMA50
        const amtSeriesList = seriesRef.current.get("amount") || [];
        if (amtSeriesList.length >= 2) {
          const amtS = amtSeriesList[0];
          const amtSmaS = amtSeriesList[1];

          const amtData = pts
            .map((p, i) => {
              const time = toChartTime(p.date);
              if (!time || p.amount == null) return null;
              const isUp = i === 0 || p.close >= pts[i - 1].close;
              return {
                time,
                value: p.amount,
                color: isUp ? "rgba(239, 68, 68, 0.6)" : "rgba(59, 130, 246, 0.6)",
              };
            })
            .filter((v): v is NonNullable<typeof v> => v !== null);
          amtS.setData(amtData);

          amtSmaS.setData(linePoints((p) => p.amount_sma50));
        }

        // Initial visible range (show last 250 bars for 1D/1W, or all for 1M/1Y)
        const firstChart = chartsRef.current.values().next().value;
        if (firstChart) {
          const totalBars = pts.length;
          const displayCount = interval === "1D" ? 252 : interval === "1W" ? 150 : totalBars;
          const from = Math.max(0, totalBars - displayCount);
          const to = totalBars + 5;
          firstChart.timeScale().setVisibleLogicalRange({ from, to });
        }
      }
    } catch (err) {
      console.error("Error setting up AVWAP charts:", err);
    }

    return () => {
      cleanup();
    };
  }, [chartData, market, interval]);

  // Handle dynamic toggles of VWAP, HVWAP, LVWAP, BB Upper, and Anchors without rebuilding charts
  useEffect(() => {
    if (!chartData || chartData.points.length === 0) return;
    const pts = chartData.points;
    const mainSeriesList = seriesRef.current.get("main") || [];
    if (mainSeriesList.length === 0) return;

    const linePoints = (pick: (p: AvwapPoint) => unknown) => {
      const out: { time: string; value: number }[] = [];
      const seen = new Set<string>();
      for (const p of chartData.points) {
        const time = toChartTime(p.date);
        const value = toFiniteNumber(pick(p));
        if (!time || value == null || seen.has(time)) continue;
        seen.add(time);
        out.push({ time, value });
      }
      return out.sort((a, b) => (a.time < b.time ? -1 : 1));
    };

    let sIdx = 1;
    const samplePoint = pts[pts.length - 1];
    if (samplePoint?.ma) {
      sIdx += Object.keys(samplePoint.ma).length;
    }

    // BB Upper
    const bbS = mainSeriesList[sIdx++];
    if (bbS) {
      bbS.setData(showBbUpper ? linePoints((p) => p.bb_upper) : []);
    }

    // Base VWAP
    const vwapS = mainSeriesList[sIdx++];
    if (vwapS) {
      vwapS.setData(showVwap ? linePoints((p) => p.vwap) : []);
    }

    // HVWAP
    const hvwapS = mainSeriesList[sIdx++];
    if (hvwapS) {
      hvwapS.setData(showHvwap ? linePoints((p) => p.hvwap) : []);
    }

    // LVWAP
    const lvwapS = mainSeriesList[sIdx++];
    if (lvwapS) {
      lvwapS.setData(showLvwap ? linePoints((p) => p.lvwap) : []);
    }

    // Anchors
    if (chartData.anchors) {
      chartData.anchors.forEach((anc) => {
        const aS = anchorSeriesMapRef.current.get(anc.id);
        if (aS) {
          if (enabledAnchors.has(anc.id)) {
            const aData = anc.values
              .map((v) => {
                const time = toChartTime(v.date);
                const value = toFiniteNumber(v.value);
                if (!time || value == null) return null;
                return { time, value };
              })
              .filter((v): v is NonNullable<typeof v> => v !== null);
            aS.setData(aData);
          } else {
            aS.setData([]);
          }
        }
      });
    }
  }, [showVwap, showHvwap, showLvwap, showBbUpper, enabledAnchors, chartData]);

  // Last available point for summary header when not hovering
  const latestPoint = useMemo(() => {
    if (!chartData?.points || chartData.points.length === 0) return null;
    return chartData.points[chartData.points.length - 1];
  }, [chartData]);

  const activeDisplay = hoveredData || (latestPoint ? {
    time: latestPoint.date,
    ohlc: {
      open: latestPoint.open,
      high: latestPoint.high,
      low: latestPoint.low,
      close: latestPoint.close,
      volume: latestPoint.volume,
      changePct: latestPoint.change_pct,
    },
    rsi: latestPoint.rsi,
    vixFix: latestPoint.vix_fix,
    amount: latestPoint.amount,
    amountSma50: latestPoint.amount_sma50,
    vwap: latestPoint.vwap,
    hvwap: latestPoint.hvwap,
    lvwap: latestPoint.lvwap,
    ma: latestPoint.ma,
  } : null);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white select-none">
      {/* ── 1. Top Control Bar ── */}
      <div className="bg-gray-900/80 border-b border-gray-800 p-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md sticky top-0 z-20">
        {/* Left: Market & Interval Selectors */}
        <div className="flex items-center gap-3">
          {/* Market Toggle */}
          <div className="inline-flex rounded-lg bg-gray-800/80 p-1 border border-gray-700">
            {(["kospi", "kosdaq"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMarket(m)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all uppercase ${
                  market === m
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Interval Toggle */}
          <div className="inline-flex rounded-lg bg-gray-800/80 p-1 border border-gray-700">
            {[
              { id: "1D", label: "일봉" },
              { id: "1W", label: "주봉" },
              { id: "1M", label: "월봉" },
              { id: "1Y", label: "년봉" },
            ].map((it) => (
              <button
                key={it.id}
                onClick={() => setInterval(it.id as any)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  interval === it.id
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Quick Anchor & Indicator Toggles */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            onClick={() => setShowVwap(!showVwap)}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              showVwap
                ? "bg-slate-200 text-gray-900 border-white shadow-sm"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
          >
            VWAP
          </button>
          <button
            onClick={() => setShowHvwap(!showHvwap)}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              showHvwap
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-sm"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
          >
            HVWAP(최고)
          </button>
          <button
            onClick={() => setShowLvwap(!showLvwap)}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              showLvwap
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-sm"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
          >
            LVWAP(최저)
          </button>
          <button
            onClick={() => setShowBbUpper(!showBbUpper)}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              showBbUpper
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-sm"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
          >
            BB상단
          </button>
          <div className="h-4 w-px bg-gray-700 mx-1" />
          <button
            onClick={() => toggleAllAnchors(true)}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 text-[11px]"
          >
            앵커 전체ON
          </button>
          <button
            onClick={() => toggleAllAnchors(false)}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 text-[11px]"
          >
            앵커 전체OFF
          </button>
        </div>
      </div>

      {/* ── 2. Preset Anchor Badges Bar ── */}
      {chartData?.anchors && chartData.anchors.length > 0 && (
        <div className="bg-gray-900/50 border-b border-gray-800/80 px-4 py-2 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-[11px]">
          <span className="text-gray-500 font-bold mr-1 flex-shrink-0">변곡점 앵커:</span>
          {chartData.anchors.map((anc) => {
            const isEnabled = enabledAnchors.has(anc.id);
            return (
              <button
                key={anc.id}
                onClick={() => toggleAnchor(anc.id)}
                className={`flex-shrink-0 px-2 py-0.5 rounded-full border transition-all flex items-center gap-1.5 ${
                  isEnabled
                    ? "bg-gray-800 text-white border-gray-600 font-medium"
                    : "bg-gray-900/60 text-gray-500 border-gray-800 hover:text-gray-400"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isEnabled ? anc.color : "#4b5563" }}
                />
                <span>{anc.anchor_date}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 3. Realtime Status / HUD Header ── */}
      <div className="bg-gray-900/30 px-4 py-1.5 border-b border-gray-800/40 text-xs font-mono flex flex-wrap items-center gap-4 text-gray-400">
        {activeDisplay && (
          <>
            <span className="text-blue-400 font-bold">{activeDisplay.time}</span>
            {activeDisplay.ohlc && (
              <span className="flex items-center gap-2">
                <span>O: <span className="text-gray-200">{activeDisplay.ohlc.open.toLocaleString()}</span></span>
                <span>H: <span className="text-gray-200">{activeDisplay.ohlc.high.toLocaleString()}</span></span>
                <span>L: <span className="text-gray-200">{activeDisplay.ohlc.low.toLocaleString()}</span></span>
                <span>C: <span className={`font-bold ${(activeDisplay.ohlc.changePct || 0) >= 0 ? "text-red-400" : "text-blue-400"}`}>
                  {activeDisplay.ohlc.close.toLocaleString()}
                </span></span>
                {activeDisplay.ohlc.changePct !== null && activeDisplay.ohlc.changePct !== undefined && (
                  <span className={`font-semibold ${(activeDisplay.ohlc.changePct || 0) >= 0 ? "text-red-400" : "text-blue-400"}`}>
                    ({activeDisplay.ohlc.changePct >= 0 ? `+${activeDisplay.ohlc.changePct}` : activeDisplay.ohlc.changePct}%)
                  </span>
                )}
                <span>Vol: <span className="text-gray-200">{(activeDisplay.ohlc.volume / 1e4).toFixed(0)}만</span></span>
              </span>
            )}
            {activeDisplay.amount !== null && activeDisplay.amount !== undefined && (
              <span>거래대금: <span className="text-amber-400 font-bold">{activeDisplay.amount.toFixed(1)}조</span> {activeDisplay.amountSma50 !== null && activeDisplay.amountSma50 !== undefined ? <span className="text-gray-400 text-[11px]">(SMA: {activeDisplay.amountSma50.toFixed(1)}조)</span> : null}</span>
            )}
            {activeDisplay.rsi !== null && activeDisplay.rsi !== undefined && (
              <span>RSI(14): <span className="text-amber-400 font-bold">{activeDisplay.rsi.toFixed(1)}</span></span>
            )}
            {activeDisplay.vixFix !== null && activeDisplay.vixFix !== undefined && (
              <span>VIX Fix: <span className="text-emerald-400 font-bold">{activeDisplay.vixFix.toFixed(1)}%</span></span>
            )}
            {activeDisplay.vwap !== null && activeDisplay.vwap !== undefined && (
              <span>VWAP: <span className="text-slate-200">{activeDisplay.vwap.toLocaleString()}</span></span>
            )}
          </>
        )}
      </div>

      {/* ── 4. Main Chart Canvas Area ── */}
      <div className="flex-1 relative overflow-hidden bg-gray-950">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 backdrop-blur-sm z-30 text-emerald-400 font-mono text-sm gap-2">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>KOSPI/KOSDAQ AVWAP 데이터를 로드하는 중...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-30 text-rose-400 text-sm font-medium">
            <span>차트 데이터를 불러오는 데 실패했습니다.</span>
          </div>
        )}

        <div
          ref={containerRef}
          className="w-full h-full overflow-y-auto custom-scrollbar flex flex-col relative"
        >
          {/* Vertical Guide Sync Line */}
          <div
            ref={verticalGuideRef}
            className="absolute top-0 bottom-0 w-[1px] bg-slate-400/80 pointer-events-none z-30 hidden"
            style={{ borderLeft: "1px dashed rgba(148, 163, 184, 0.7)" }}
          />

          {/* Panel 1: RSI */}
          <div className="w-full relative border-b border-gray-800 bg-[#090d16]">
            <div className="absolute top-1.5 left-3 z-10 text-[11px] font-bold text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">
              RSI (14)
            </div>
            <div data-chart-id="rsi" className="w-full" />
          </div>

          {/* Panel 2: Main Candlestick & AVWAP */}
          <div className="w-full relative border-b border-gray-800 bg-[#090d16]">
            <div className="absolute top-2 left-3 z-10 flex items-center gap-2 text-xs font-bold text-gray-300 bg-gray-900/70 px-2.5 py-1 rounded border border-gray-700/80 backdrop-blur-sm">
              <span className="text-white uppercase">{market}</span>
              <span className="text-blue-400">{interval}</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-400">AVWAP & MAs</span>
            </div>
            <div data-chart-id="main" className="w-full" />
          </div>

          {/* Panel 3: Volume & VIX Fix */}
          <div className="w-full relative border-b border-gray-800 bg-[#090d16]">
            <div className="absolute top-1.5 left-3 z-10 text-[11px] font-bold text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">
              거래량 (막대) & VIX Fix (초록 점선, 좌측 축)
            </div>
            <div data-chart-id="volume" className="w-full" />
          </div>

          {/* Panel 4: Trading Amount (거래대금) & SMA50 */}
          <div className="w-full relative bg-[#090d16]">
            <div className="absolute top-1.5 left-3 z-10 text-[11px] font-bold text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">
              거래대금 (조원) & SMA (주황 실선)
            </div>
            <div data-chart-id="amount" className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AvwapChart;
