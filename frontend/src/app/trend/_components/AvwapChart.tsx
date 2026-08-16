"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  LineStyle,
  PriceScaleMode,
} from "lightweight-charts";
import { useAvwapChart, useStockSearch } from "@/hooks/useAvwapChart";
import type { AvwapPoint, StockSearchResult } from "@/lib/api";
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
  const [symbol, setSymbol] = useState<string | null>(null);
  const [priceScaleMode, setPriceScaleMode] = useState<"log" | "linear">("log");

  // Stock Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isLoading: isSearching } = useStockSearch(searchQuery);
  const { data: chartData, isLoading, error } = useAvwapChart(market, interval, symbol);

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

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialize enabled anchors when data changes (ATL anchor defaults to off)
  useEffect(() => {
    if (chartData?.anchors) {
      setEnabledAnchors(
        new Set(
          chartData.anchors
            .filter((a) => !a.id.startsWith("anchor_atl_") && !a.name.includes("역대 최저") && !a.name.includes("ATL"))
            .map((a) => a.id)
        )
      );
    }
  }, [chartData]);

  const [hoveredData, setHoveredData] = useState<{
    time: string;
    ohlc?: { open: number; high: number; low: number; close: number; volume: number; changePct?: number | null };
    rsi?: number | null;
    mdd?: number | null;
    h52Chg?: number | null;
    vixFix?: number | null;
    amount?: number | null;
    amountSma50?: number | null;
    vwap?: number | null;
    hvwap?: number | null;
    lvwap?: number | null;
    ma?: Record<string, number | null>;
  } | null>(null);

  // Select stock from search
  const handleSelectStock = (stock: StockSearchResult) => {
    setSymbol(stock.code);
    setSearchQuery(`${stock.name} (${stock.code})`);
    setShowDropdown(false);
  };

  // Clear stock search and return to market index mode
  const handleClearStock = (targetMarket?: "kospi" | "kosdaq") => {
    setSymbol(null);
    setSearchQuery("");
    setShowDropdown(false);
    if (targetMarket) {
      setMarket(targetMarket);
    }
  };

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

  const isStockMode = !!chartData?.symbol;
  const isEokUnit = chartData?.amount_unit === "억원";

  // Build chart layout when chartData arrives
  useEffect(() => {
    if (!containerRef.current || !chartData || chartData.points.length === 0) return;

    const scrollArea = containerRef.current;
    let onCustomWheel: (e: WheelEvent) => void;

    const handleMouseLeave = () => {
      if (verticalGuideRef.current) {
        verticalGuideRef.current.style.display = "none";
      }
      setHoveredData(null);
    };
    scrollArea.addEventListener("mouseleave", handleMouseLeave);

    const cleanup = () => {
      if (onCustomWheel) {
        scrollArea.removeEventListener("wheel", onCustomWheel);
      }
      scrollArea.removeEventListener("mouseleave", handleMouseLeave);
      chartsRef.current.forEach((c) => c.remove());
      chartsRef.current.clear();
      seriesRef.current.clear();
      anchorSeriesMapRef.current.clear();
    };
    cleanup();

    try {
      const syncRightPriceScaleWidths = () => {
        let maxW = 95;
        chartsRef.current.forEach((c) => {
          try {
            const w = c.priceScale("right").width();
            if (w > maxW) maxW = w;
          } catch {}
        });
        chartsRef.current.forEach((c) => {
          try {
            c.priceScale("right").applyOptions({ minimumWidth: maxW });
          } catch {}
        });
      };

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
              c.priceScale("right").applyOptions({ autoScale: true });
            } catch {}
          });
          syncRightPriceScaleWidths();
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
              c.priceScale("right").applyOptions({ autoScale: true });
            } catch {}
          });
          syncRightPriceScaleWidths();
          isSyncingRef.current = false;
        }
      };

      scrollArea.addEventListener("wheel", onCustomWheel, { passive: false });

      const targetTitle = chartData.name || (chartData.symbol ? chartData.symbol : market.toUpperCase());
      const amountUnitLabel = chartData.amount_unit || "조원";

      const panels = [
        { id: "mdd", name: "MDD (%)", height: 90 },
        { id: "main", name: `${targetTitle} 주가 & AVWAP`, height: 550 },
        { id: "volume", name: "거래량 & VIX Fix", height: 110 },
        { id: "amount", name: `거래대금 (${amountUnitLabel}) & SMA50`, height: 180 },
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
                ? { top: 0.05, bottom: 0 } 
                : panel.id === "main"
                  ? { top: 0.02, bottom: 0.02 }
                  : { top: 0.05, bottom: 0.05 },
            autoScale: true,
            minimumWidth: 95,
            mode: panel.id === "main"
              ? (priceScaleMode === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal)
              : PriceScaleMode.Normal,
          },
          leftPriceScale: {
            visible: false,
          },
          handleScroll: {
            mouseWheel: false,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false,
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
              labelVisible: true,
              style: LineStyle.Dotted,
              width: 1,
              color: "rgba(148, 163, 184, 0.5)",
            },
          },
        });

        chartsRef.current.set(panel.id, chart);
        const activeSeries: ISeriesApi<any>[] = [];

        // 1. Panel: MDD (%)
        if (panel.id === "mdd") {
          const mddSeries = chart.addSeries(BaselineSeries, {
            baseValue: { type: "price", price: 0 },
            topLineColor: "#38bdf8",
            bottomLineColor: "#38bdf8",
            topFillColor1: "rgba(56, 189, 248, 0.0)",
            topFillColor2: "rgba(56, 189, 248, 0.0)",
            bottomFillColor1: "rgba(56, 189, 248, 0.35)",
            bottomFillColor2: "rgba(56, 189, 248, 0.08)",
            lineWidth: 2,
            priceFormat: {
              type: "custom",
              formatter: (price: number) => `${price.toFixed(1)}%`,
              minMove: 0.1,
            },
            priceLineVisible: false,
            lastValueVisible: true,
          });
          mddSeries.createPriceLine({
            price: 0,
            color: "rgba(148, 163, 184, 0.6)",
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
          });
          mddSeries.createPriceLine({
            price: -10,
            color: "rgba(234, 179, 8, 0.3)",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
          });
          mddSeries.createPriceLine({
            price: -20,
            color: "rgba(249, 115, 22, 0.3)",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
          });
          mddSeries.createPriceLine({
            price: -30,
            color: "rgba(239, 68, 68, 0.3)",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
          });
          activeSeries.push(mddSeries);
        }

        // 2. Panel: Main Price & AVWAP
        else if (panel.id === "main") {
          // Candlestick series (Up: Red, Down: Blue)
          const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#ef4444",
            downColor: "#3b82f6",
            borderUpColor: "#ef4444",
            borderDownColor: "#3b82f6",
            wickUpColor: "#ef4444",
            wickDownColor: "#3b82f6",
          });
          activeSeries.push(candleSeries);

          // Moving Averages
          const samplePt = chartData.points[chartData.points.length - 1];
          if (samplePt?.ma) {
            Object.keys(samplePt.ma).forEach((maName) => {
              const color = MA_COLORS[maName] || "#94a3b8";
              const s = chart.addSeries(LineSeries, {
                color,
                lineWidth: maName === "EMA_10" || maName === "SMA_10" || maName === "SMA_3" ? 2 : 1,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              activeSeries.push(s);
            });
          }

          // BB Upper line
          const bbSeries = chart.addSeries(LineSeries, {
            color: "#06b6d4",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(bbSeries);

          // Base VWAP, HVWAP, LVWAP
          const vwapSeries = chart.addSeries(LineSeries, {
            color: "#ffffff",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(vwapSeries);

          const hvwapSeries = chart.addSeries(LineSeries, {
            color: "#f43f5e",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(hvwapSeries);

          const lvwapSeries = chart.addSeries(LineSeries, {
            color: "#eab308",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(lvwapSeries);

          // Preset / Dynamic AVWAP Anchors
          if (chartData.anchors) {
            chartData.anchors.forEach((anc) => {
              const aSeries = chart.addSeries(LineSeries, {
                color: anc.color,
                lineWidth: 2,
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
            priceScaleId: "overlay",
            priceLineVisible: false,
            lastValueVisible: false,
          });
          chart.priceScale("overlay").applyOptions({
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true,
          });
          activeSeries.push(vixSeries);
        }

        // 4. Panel: Trading Amount (거래대금) & Amount SMA50
        else if (panel.id === "amount") {
          const amtSeries = chart.addSeries(HistogramSeries, {
            priceFormat: {
              type: "custom",
              formatter: (price: number) => {
                if (isEokUnit) {
                  return price >= 10000 ? `${(price / 10000).toFixed(1)}조` : `${Math.round(price).toLocaleString()}억`;
                }
                return `${price.toFixed(1)}조`;
              },
              minMove: isEokUnit ? 1 : 0.1,
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

        // TimeScale sync & dynamic vertical autoScale on scroll/pan
        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (!range) return;

          try {
            chart.priceScale("right").applyOptions({ autoScale: true });
          } catch {}

          if (isSyncingRef.current) return;
          isSyncingRef.current = true;
          chartsRef.current.forEach((otherChart, otherId) => {
            if (otherId !== panel.id) {
              try {
                otherChart.timeScale().setVisibleLogicalRange(range);
                otherChart.priceScale("right").applyOptions({ autoScale: true });
              } catch {}
            }
          });
          syncRightPriceScaleWidths();
          isSyncingRef.current = false;
        });

        // Crosshair move & Vertical sync line
        chart.subscribeCrosshairMove((param) => {
          if (!param.point || !param.time || param.point.x < 0) {
            if (verticalGuideRef.current) {
              verticalGuideRef.current.style.display = "none";
            }
            setHoveredData(null);
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
              mdd: matchedPoint.mdd,
              h52Chg: matchedPoint.h52_chg,
              vixFix: matchedPoint.vix_fix,
              amount: matchedPoint.amount,
              amountSma50: matchedPoint.amount_sma50,
              vwap: matchedPoint.vwap,
              hvwap: matchedPoint.hvwap,
              lvwap: matchedPoint.lvwap,
              ma: matchedPoint.ma,
            });
          } else {
            setHoveredData(null);
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

      // Populate data into series
      const pts = chartData.points;
      if (pts.length > 0) {
        // 1. MDD
        const mddSeriesList = seriesRef.current.get("mdd") || [];
        if (mddSeriesList[0]) {
          mddSeriesList[0].setData(linePoints((p) => p.mdd));
        }

        // 2. Main (Candlesticks, MAs, BB Upper, VWAPs, Anchors)
        const mainSeriesList = seriesRef.current.get("main") || [];
        if (mainSeriesList.length > 0) {
          // Candlestick
          const candleData = pts
            .map((p) => {
              const time = toChartTime(p.date);
              if (!time) return null;
              return { time, open: p.open, high: p.high, low: p.low, close: p.close };
            })
            .filter((v): v is NonNullable<typeof v> => v !== null);
          mainSeriesList[0].setData(candleData);

          // MAs
          let seriesIdx = 1;
          const samplePt = pts[pts.length - 1];
          if (samplePt?.ma) {
            Object.keys(samplePt.ma).forEach((maName) => {
              if (mainSeriesList[seriesIdx]) {
                mainSeriesList[seriesIdx].setData(linePoints((p) => p.ma[maName]));
                seriesIdx++;
              }
            });
          }

          // BB Upper
          if (mainSeriesList[seriesIdx]) {
            if (showBbUpper) {
              mainSeriesList[seriesIdx].setData(linePoints((p) => p.bb_upper));
            } else {
              mainSeriesList[seriesIdx].setData([]);
            }
            seriesIdx++;
          }

          // Base VWAP
          if (mainSeriesList[seriesIdx]) {
            if (showVwap) {
              mainSeriesList[seriesIdx].setData(linePoints((p) => p.vwap));
            } else {
              mainSeriesList[seriesIdx].setData([]);
            }
            seriesIdx++;
          }

          // HVWAP
          if (mainSeriesList[seriesIdx]) {
            if (showHvwap) {
              mainSeriesList[seriesIdx].setData(linePoints((p) => p.hvwap));
            } else {
              mainSeriesList[seriesIdx].setData([]);
            }
            seriesIdx++;
          }

          // LVWAP
          if (mainSeriesList[seriesIdx]) {
            if (showLvwap) {
              mainSeriesList[seriesIdx].setData(linePoints((p) => p.lvwap));
            } else {
              mainSeriesList[seriesIdx].setData([]);
            }
            seriesIdx++;
          }

          // Anchors
          chartData.anchors?.forEach((anc) => {
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

        requestAnimationFrame(() => {
          syncRightPriceScaleWidths();
        });
      }
    } catch (err) {
      console.error("Error setting up AVWAP charts:", err);
    }

    return () => {
      cleanup();
    };
  }, [chartData, interval, market, symbol, isEokUnit]);

  // Update dynamic visibility of optional lines without rebuilding charts
  useEffect(() => {
    if (!chartData) return;
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

    const mainSeriesList = seriesRef.current.get("main") || [];
    if (mainSeriesList.length > 0) {
      const samplePt = chartData.points[chartData.points.length - 1];
      const maCount = samplePt?.ma ? Object.keys(samplePt.ma).length : 0;
      const bbIdx = 1 + maCount;
      const vwapIdx = bbIdx + 1;
      const hvwapIdx = bbIdx + 2;
      const lvwapIdx = bbIdx + 3;

      if (mainSeriesList[bbIdx]) {
        mainSeriesList[bbIdx].setData(showBbUpper ? linePoints((p) => p.bb_upper) : []);
      }
      if (mainSeriesList[vwapIdx]) {
        mainSeriesList[vwapIdx].setData(showVwap ? linePoints((p) => p.vwap) : []);
      }
      if (mainSeriesList[hvwapIdx]) {
        mainSeriesList[hvwapIdx].setData(showHvwap ? linePoints((p) => p.hvwap) : []);
      }
      if (mainSeriesList[lvwapIdx]) {
        mainSeriesList[lvwapIdx].setData(showLvwap ? linePoints((p) => p.lvwap) : []);
      }

      chartData.anchors?.forEach((anc) => {
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

  // Update Y-axis price scale mode (log vs linear) dynamically
  useEffect(() => {
    const mainChart = chartsRef.current.get("main");
    if (!mainChart) return;
    try {
      mainChart.priceScale("right").applyOptions({
        mode: priceScaleMode === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
        autoScale: true,
      });
    } catch (e) {
      console.error("Error applying priceScale mode:", e);
    }
  }, [priceScaleMode]);

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
    mdd: latestPoint.mdd,
    h52Chg: latestPoint.h52_chg,
    vixFix: latestPoint.vix_fix,
    amount: latestPoint.amount,
    amountSma50: latestPoint.amount_sma50,
    vwap: latestPoint.vwap,
    hvwap: latestPoint.hvwap,
    lvwap: latestPoint.lvwap,
    ma: latestPoint.ma,
  } : null);

  const formatAmountValue = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "";
    if (isEokUnit) {
      return val >= 10000 ? `${(val / 10000).toFixed(1)}조` : `${Math.round(val).toLocaleString()}억`;
    }
    return `${val.toFixed(1)}조`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white select-none">
      {/* ── 1. Top Control Bar ── */}
      <div className="bg-gray-900/80 border-b border-gray-800 p-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md sticky top-0 z-20">
        {/* Left: Market & Interval Selectors & Stock Search */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Market Toggle (Index mode) */}
          <div className="inline-flex rounded-lg bg-gray-800/80 p-1 border border-gray-700">
            {(["kospi", "kosdaq"] as const).map((m) => {
              const isSelected = !symbol && market === m;
              return (
                <button
                  key={m}
                  onClick={() => handleClearStock(m)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all uppercase ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Stock Search Box with Autocomplete */}
          <div className="relative">
            <div className={`flex items-center bg-gray-800/90 border rounded-lg px-2.5 py-1 text-xs transition-all ${
              symbol ? "border-emerald-500/80 ring-1 ring-emerald-500/50" : "border-gray-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
            }`}>
              <span className="text-gray-400 mr-1.5">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="종목명 또는 코드 (예: 삼성전자, 005930)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (searchResults && searchResults.length > 0) {
                      handleSelectStock(searchResults[0]);
                    } else if (searchQuery.trim()) {
                      setSymbol(searchQuery.trim());
                      setShowDropdown(false);
                    }
                  }
                }}
                className="bg-transparent text-white placeholder-gray-500 focus:outline-none w-48 sm:w-56 text-xs"
              />
              {(searchQuery || symbol) && (
                <button
                  onClick={() => handleClearStock()}
                  className="text-gray-400 hover:text-white ml-1 p-0.5"
                  title="지수 모드로 복귀"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {showDropdown && searchQuery.trim().length >= 1 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 top-full mt-1 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar"
              >
                {isSearching ? (
                  <div className="p-3 text-xs text-gray-400 text-center">검색 중...</div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((stk) => (
                    <button
                      key={stk.code}
                      onClick={() => handleSelectStock(stk)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-800 flex items-center justify-between border-b border-gray-800/50 last:border-0 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{stk.name}</span>
                        <span className="text-[11px] text-gray-400 font-mono">{stk.code}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          stk.market === "KOSPI"
                            ? "bg-blue-900/60 text-blue-300"
                            : "bg-emerald-900/60 text-emerald-300"
                        }`}
                      >
                        {stk.market}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-xs text-gray-400 text-center">검색 결과가 없습니다</div>
                )}
              </div>
            )}
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

          {/* Price Scale Mode Toggle (Log / Linear) */}
          <div className="inline-flex rounded-lg bg-gray-800/80 p-1 border border-gray-700">
            {(["log", "linear"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPriceScaleMode(mode)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  priceScaleMode === mode
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
                title={mode === "log" ? "로그 스케일 (기본)" : "선형 스케일"}
              >
                {mode === "log" ? "로그(Log)" : "선형(Linear)"}
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
          <span className="text-gray-500 font-bold mr-1 flex-shrink-0">
            {isStockMode ? "주요 앵커:" : "변곡점 앵커:"}
          </span>
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
                <span>{anc.name || anc.anchor_date}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 3. Realtime Status / HUD Header ── */}
      <div className="bg-gray-900/30 px-4 py-1.5 border-b border-gray-800/40 text-xs font-mono flex flex-wrap items-center gap-4 text-gray-400">
        {chartData && (
          <span className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isStockMode
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                  : "bg-blue-950/80 text-blue-400 border border-blue-800"
              }`}
            >
              {isStockMode ? "종목" : "지수"}
            </span>
            <span className="text-gray-200 font-bold">
              {chartData.name}
              {chartData.symbol ? ` (${chartData.symbol})` : ""}
            </span>
          </span>
        )}
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
              <span>거래대금: <span className="text-amber-400 font-bold">{formatAmountValue(activeDisplay.amount)}</span> {activeDisplay.amountSma50 !== null && activeDisplay.amountSma50 !== undefined ? <span className="text-gray-400 text-[11px]">(SMA: {formatAmountValue(activeDisplay.amountSma50)})</span> : null}</span>
            )}
            {activeDisplay.mdd !== null && activeDisplay.mdd !== undefined && (
              <span>
                MDD:{" "}
                <span
                  className={`font-bold ${
                    activeDisplay.mdd === 0
                      ? "text-emerald-400"
                      : activeDisplay.mdd <= -20
                      ? "text-rose-400"
                      : "text-sky-400"
                  }`}
                >
                  {activeDisplay.mdd.toFixed(1)}%
                </span>
              </span>
            )}
            {activeDisplay.h52Chg !== null && activeDisplay.h52Chg !== undefined && (
              <span>
                52HChg:{" "}
                <span
                  className={`font-bold ${
                    activeDisplay.h52Chg === 0
                      ? "text-emerald-400"
                      : activeDisplay.h52Chg <= -20
                      ? "text-rose-400"
                      : "text-sky-400"
                  }`}
                >
                  {activeDisplay.h52Chg >= 0 ? `+${activeDisplay.h52Chg.toFixed(1)}%` : `${activeDisplay.h52Chg.toFixed(1)}%`}
                </span>
              </span>
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
            <span>AVWAP 차트 데이터를 로드하는 중...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-30 text-rose-400 text-sm font-medium">
            <span>차트 데이터를 불러오는 데 실패했습니다. (종목코드 또는 백엔드 상태를 확인하세요)</span>
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

          {/* Panel 1: MDD */}
          <div className="w-full relative border-b border-gray-800 bg-[#090d16]">
            <div className="absolute top-1.5 left-3 z-10 text-[11px] font-bold text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">
              MDD (%)
            </div>
            <div data-chart-id="mdd" className="w-full" />
          </div>

          {/* Panel 2: Main Candlestick & AVWAP */}
          <div className="w-full relative border-b border-gray-800 bg-[#090d16]">
            <div className="absolute top-2 left-3 z-10 flex items-center gap-2 text-xs font-bold text-gray-300 bg-gray-900/70 px-2.5 py-1 rounded border border-gray-700/80 backdrop-blur-sm">
              <span className="text-white uppercase">
                {chartData?.name || (symbol ? symbol : market)}
              </span>
              <span className="text-blue-400">{interval}</span>
              <span className="text-purple-400 font-mono text-[11px]">[{priceScaleMode.toUpperCase()}]</span>
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
              거래대금 ({chartData?.amount_unit || "조원"}) & SMA (주황 실선)
            </div>
            <div data-chart-id="amount" className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AvwapChart;
