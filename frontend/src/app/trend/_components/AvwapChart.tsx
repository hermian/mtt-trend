"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  IPriceLine,
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
import { api, type AvwapPoint, type StockSearchResult } from "@/lib/api";
import { toChartTime, toFiniteNumber } from "./_lib/chartTime";
import { AvwapQuickAnchorPopover } from "./AvwapQuickAnchorPopover";
import { AvwapAnchorManagerModal, type UnifiedAnchorItem } from "./AvwapAnchorManagerModal";
import {
  addLocalCustomAnchor,
  removeLocalCustomAnchor,
  setLocalCustomAnchors,
} from "./_lib/avwapCalc";
import { hpFilterSeries, getHpLambdaForInterval } from "@/lib/hpFilter";

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

export type AvwapMarket = "kospi" | "kosdaq" | "sp500" | "nasdaq100" | "dow";

export const MARKET_BUTTONS: { id: AvwapMarket; label: string }[] = [
  { id: "kospi", label: "KOSPI" },
  { id: "kosdaq", label: "KOSDAQ" },
  { id: "sp500", label: "S&P500" },
  { id: "nasdaq100", label: "NDX" },
  { id: "dow", label: "DOW" },
];

function toDimColor(hexOrRgb: string, alpha: number = 0.5): string {
  if (!hexOrRgb) return `rgba(148, 163, 184, ${alpha})`;
  if (hexOrRgb.startsWith("#")) {
    let hex = hexOrRgb.slice(1);
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    const r = parseInt(hex.slice(0, 2), 16) || 148;
    const g = parseInt(hex.slice(2, 4), 16) || 163;
    const b = parseInt(hex.slice(4, 6), 16) || 184;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (hexOrRgb.startsWith("rgb")) {
    return hexOrRgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  return `rgba(148, 163, 184, ${alpha})`;
}

export function AvwapChart() {
  const [market, setMarket] = useState<AvwapMarket>("kospi");
  const [interval, setInterval] = useState<"1D" | "1W" | "1M" | "1Y">("1D");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [priceScaleMode, setPriceScaleMode] = useState<"log" | "linear">("log");
  const [ddPeriod, setDdPeriod] = useState<"52w" | "3y" | "all">("52w");

  // Stock Search state
  const [searchCountry, setSearchCountry] = useState<"kr" | "us">("kr");
  const [searchType, setSearchType] = useState<"stock" | "etf">("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  const { data: searchResults, isLoading: isSearching } = useStockSearch(searchQuery, searchType, searchCountry);
  const { data: chartData, isLoading, error } = useAvwapChart(market, interval, symbol);


  const containerRef = useRef<HTMLDivElement>(null);
  const verticalGuideRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<any>[]>>(new Map());
  const anchorSeriesMapRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const crosshairPriceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const isSyncingRef = useRef(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isMobileWidth = window.innerWidth < 768;
      setIsMobile(isMobileUA || isMobileWidth);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Toggle state for base vwap, hvwap, lvwap, bb_upper, hp, and individual anchor dates
  const [showVwap, setShowVwap] = useState(true);
  const [showHvwap, setShowHvwap] = useState(true);
  const [showLvwap, setShowLvwap] = useState(true);
  const [showBbUpper, setShowBbUpper] = useState(true);
  const [showHp, setShowHp] = useState(true);
  const [enabledAnchors, setEnabledAnchors] = useState<Set<string>>(new Set());
  const enabledAnchorsRef = useRef<Set<string>>(new Set());
  const showLinesRef = useRef({
    vwap: showVwap,
    hvwap: showHvwap,
    lvwap: showLvwap,
    bb: showBbUpper,
    hp: showHp,
  });

  useEffect(() => {
    enabledAnchorsRef.current = enabledAnchors;
  }, [enabledAnchors]);

  useEffect(() => {
    showLinesRef.current = {
      vwap: showVwap,
      hvwap: showHvwap,
      lvwap: showLvwap,
      bb: showBbUpper,
      hp: showHp,
    };
  }, [showVwap, showHvwap, showLvwap, showBbUpper, showHp]);

  // Click-to-Highlight Line Selection
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const selectedLineIdRef = useRef<string | null>(null);
  const mainLinesMapRef = useRef<Map<string, { id: string; name: string; series: ISeriesApi<any>; color: string; defaultWidth: number }>>(new Map());

  // Click-to-Anchor Picker Mode
  const [isPickerMode, setIsPickerMode] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const isPickerModeRef = useRef(false);

  useEffect(() => {
    isPickerModeRef.current = isPickerMode;
  }, [isPickerMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isPickerMode) setIsPickerMode(false);
        if (selectedLineId) setSelectedLineId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPickerMode, selectedLineId]);



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

  // Initialize enabled anchors when market/symbol/interval changes
  useEffect(() => {
    if (chartData?.anchors) {
      const initial = new Set(
        chartData.anchors
          .filter((a) => !a.id.startsWith("anchor_atl_") && !a.name.includes("역대 최저") && !a.name.includes("ATL"))
          .map((a) => a.id)
      );
      setEnabledAnchors(initial);
    }
  }, [chartData?.market, chartData?.symbol, chartData?.interval]);

  // Ensure newly added custom anchors are automatically enabled
  useEffect(() => {
    if (chartData?.anchors) {
      setEnabledAnchors((prev) => {
        const next = new Set(prev);
        chartData.anchors.forEach((a) => {
          if (!a.id.startsWith("anchor_atl_") && !a.name.includes("역대 최저") && !a.name.includes("ATL")) {
            next.add(a.id);
          }
        });
        return next;
      });
    }
  }, [chartData?.anchors]);

  // Synchronize line styles when selectedLineId changes (highlighting selected line, dimming others)
  useEffect(() => {
    selectedLineIdRef.current = selectedLineId;
    const linesMap = mainLinesMapRef.current;
    if (!linesMap || linesMap.size === 0) return;

    const hasSelection = selectedLineId !== null;

    linesMap.forEach((info, id) => {
      if (!info.series || typeof info.series.applyOptions !== "function") return;
      const isSelected = id === selectedLineId;

      try {
        if (!hasSelection) {
          info.series.applyOptions({
            lineWidth: info.defaultWidth as any,
            color: info.color,
          });
        } else if (isSelected) {
          info.series.applyOptions({
            lineWidth: 4,
            color: info.color,
          });
        } else {
          info.series.applyOptions({
            lineWidth: 1,
            color: toDimColor(info.color, 0.5),
          });
        }
      } catch (err) {
        console.warn("Failed to apply highlight to line series:", err);
      }
    });
  }, [selectedLineId]);

  // Reset highlight on target or interval change
  useEffect(() => {
    setSelectedLineId(null);
  }, [market, symbol, interval]);

  // HP Filter calculation for the current chart points & interval
  const hpResult = useMemo(() => {
    if (!chartData?.points || chartData.points.length < 4) return null;
    const rawPts: { time: string; value: number }[] = [];
    const seen = new Set<string>();
    for (const p of chartData.points) {
      const time = toChartTime(p.date);
      if (!time || seen.has(time) || p.close == null || !Number.isFinite(p.close)) continue;
      seen.add(time);
      rawPts.push({ time, value: p.close });
    }
    rawPts.sort((a, b) => (a.time < b.time ? -1 : 1));
    const lambda = getHpLambdaForInterval(interval);
    return hpFilterSeries(rawPts, lambda);
  }, [chartData?.points, interval]);

  const hpMap = useMemo(() => {
    const map = new Map<string, { trend: number; deviation: number }>();
    if (!hpResult) return map;
    for (let i = 0; i < hpResult.trend.length; i++) {
      const t = hpResult.trend[i];
      const d = hpResult.deviation[i];
      map.set(t.time, { trend: t.value, deviation: d.value });
    }
    return map;
  }, [hpResult]);

  const [hoveredData, setHoveredData] = useState<{
    time: string;
    ohlc?: { open: number; high: number; low: number; close: number; volume: number; changePct?: number | null };
    rsi?: number | null;
    mdd?: number | null;
    dd52w?: number | null;
    dd3y?: number | null;
    h52Chg?: number | null;
    vixFix?: number | null;
    amount?: number | null;
    amountSma50?: number | null;
    vwap?: number | null;
    hvwap?: number | null;
    lvwap?: number | null;
    ma?: Record<string, number | null>;
    hpTrend?: number | null;
    hpDev?: number | null;
  } | null>(null);

  // Select stock from search
  const handleSelectStock = (stock: StockSearchResult) => {
    isSelectingRef.current = true;
    if (stock.market === "ETF" || stock.market === "US_ETF") {
      setSearchType("etf");
    } else {
      setSearchType("stock");
    }
    if (
      stock.market === "US_ETF" ||
      stock.market === "US" ||
      stock.market === "NASDAQ" ||
      stock.market === "NYSE" ||
      stock.market === "AMEX"
    ) {
      setSearchCountry("us");
    } else {
      setSearchCountry("kr");
    }
    setSymbol(stock.code);
    setSearchQuery(`${stock.name} (${stock.code})`);
    setShowDropdown(false);
    setSelectedIndex(-1);
    searchInputRef.current?.blur();
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 150);
  };

  // Clear stock search and return to market index mode
  const handleClearStock = (targetMarket?: AvwapMarket) => {
    isSelectingRef.current = true;
    setSymbol(null);
    setSearchQuery("");
    setShowDropdown(false);
    setSelectedIndex(-1);
    if (targetMarket) {
      setMarket(targetMarket);
    }
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 150);
  };

  const queryClient = useQueryClient();
  const [showQuickAnchorPopover, setShowQuickAnchorPopover] = useState(false);
  const [showAnchorManagerModal, setShowAnchorManagerModal] = useState(false);

  const currentTarget = symbol || market;
  const currentTargetDisplayName =
    chartData?.name || (symbol ? symbol : MARKET_BUTTONS.find((b) => b.id === market)?.label || market.toUpperCase());

  // Unified anchor list for management modal
  const unifiedAnchors: UnifiedAnchorItem[] = useMemo(() => {
    if (!chartData?.anchors) return [];
    return chartData.anchors.map((anc) => {
      const isCustom = anc.id.startsWith("anc_") || !anc.id.startsWith("anchor_");
      return {
        id: anc.id,
        name: anc.name || anc.anchor_date,
        anchor_date: anc.anchor_date,
        color: anc.color,
        isCustom,
        isEnabled: enabledAnchors.has(anc.id),
      };
    });
  }, [chartData?.anchors, enabledAnchors]);

  const handleAddCustomAnchor = async (date: string, label: string, color: string) => {
    try {
      const newAnc = await api.addCustomAnchor({
        market_or_symbol: currentTarget,
        anchor_date: date,
        label: label || undefined,
        color: color || "#ec4899",
        interval_mask: "ALL",
      });
      addLocalCustomAnchor(currentTarget, {
        id: newAnc.id,
        market_or_symbol: currentTarget,
        anchor_date: date,
        label: label || undefined,
        color: color || "#ec4899",
      });
      setEnabledAnchors((prev) => {
        const next = new Set(prev);
        next.add(newAnc.id);
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["avwapChart"] });
    } catch (e) {
      console.error("Failed to add custom anchor:", e);
      alert("앵커 추가에 실패했습니다.");
    }
  };

  const handleUpdateCustomAnchor = async (id: string, date: string, label: string, color: string) => {
    try {
      await api.updateCustomAnchor(id, {
        anchor_date: date,
        label: label || undefined,
        color: color,
      });
      await queryClient.invalidateQueries({ queryKey: ["avwapChart"] });
    } catch (e) {
      console.error("Failed to update custom anchor:", e);
      alert("앵커 수정에 실패했습니다.");
    }
  };

  const handleDeleteAnchor = async (id: string, anchorDate: string, isCustom: boolean = true) => {
    try {
      await api.deleteCustomAnchor(id, currentTarget, anchorDate);
      if (isCustom) {
        removeLocalCustomAnchor(currentTarget, id);
      }
      setEnabledAnchors((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["avwapChart"] });
    } catch (e) {
      console.error("Failed to delete anchor:", e);
      alert("앵커 삭제에 실패했습니다.");
    }
  };

  const handleResetToDefaults = async () => {
    try {
      await api.resetAnchors(currentTarget);
      setLocalCustomAnchors(currentTarget, []);
      await queryClient.invalidateQueries({ queryKey: ["avwapChart"] });
    } catch (e) {
      console.error("Failed to reset anchors:", e);
    }
  };


  // Toggle individual anchor
  const toggleAnchor = (id: string) => {
    setEnabledAnchors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (selectedLineIdRef.current === id) {
          setSelectedLineId(null);
        }
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
      if (
        selectedLineIdRef.current &&
        (selectedLineIdRef.current.startsWith("anc_") || selectedLineIdRef.current.startsWith("anchor_"))
      ) {
        setSelectedLineId(null);
      }
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
      clearCrosshairPriceLines();
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
      crosshairPriceLinesRef.current.clear();
    };
    cleanup();

    const clearCrosshairPriceLines = () => {
      crosshairPriceLinesRef.current.forEach((pl) => {
        try {
          pl.applyOptions({ axisLabelVisible: false });
        } catch {}
      });
    };

    const updateCrosshairPriceLines = (pt: AvwapPoint, prevPt?: AvwapPoint) => {
      const plMap = crosshairPriceLinesRef.current;
      if (!plMap || plMap.size === 0) return;

      // 1. MDD / Drawdown
      const curDd =
        ddPeriod === "52w"
          ? (pt.dd_52w ?? pt.h52_chg ?? pt.mdd)
          : ddPeriod === "3y"
          ? (pt.dd_3y ?? pt.mdd)
          : pt.mdd;
      const mddPl = plMap.get("mdd");
      if (mddPl) {
        if (curDd != null && Number.isFinite(curDd)) {
          mddPl.applyOptions({
            price: curDd,
            axisLabelVisible: true,
            title: "",
          });
        } else {
          mddPl.applyOptions({ axisLabelVisible: false });
        }
      }

      // 2. Main Price (Candle Close)
      const closePl = plMap.get("close");
      if (closePl) {
        if (pt.close != null && Number.isFinite(pt.close)) {
          const isUp = pt.open != null ? pt.close >= pt.open : true;
          closePl.applyOptions({
            price: pt.close,
            color: isUp ? "#ef4444" : "#3b82f6",
            axisLabelVisible: true,
            title: "",
          });
        } else {
          closePl.applyOptions({ axisLabelVisible: false });
        }
      }

      // MAs
      if (pt.ma) {
        Object.entries(pt.ma).forEach(([maName, val]) => {
          const maPl = plMap.get(`ma_${maName}`);
          if (maPl) {
            if (val != null && Number.isFinite(val)) {
              maPl.applyOptions({
                price: val,
                axisLabelVisible: true,
                title: "",
              });
            } else {
              maPl.applyOptions({ axisLabelVisible: false });
            }
          }
        });
      }

      // BB Upper
      const bbPl = plMap.get("bb");
      if (bbPl) {
        if (showLinesRef.current.bb && pt.bb_upper != null && Number.isFinite(pt.bb_upper)) {
          bbPl.applyOptions({
            price: pt.bb_upper,
            axisLabelVisible: true,
            title: "",
          });
        } else {
          bbPl.applyOptions({ axisLabelVisible: false });
        }
      }

      // Base VWAP
      const vwapPl = plMap.get("vwap");
      if (vwapPl) {
        if (showLinesRef.current.vwap && pt.vwap != null && Number.isFinite(pt.vwap)) {
          vwapPl.applyOptions({
            price: pt.vwap,
            axisLabelVisible: true,
            title: "",
          });
        } else {
          vwapPl.applyOptions({ axisLabelVisible: false });
        }
      }

      // HVWAP
      const hvwapPl = plMap.get("hvwap");
      if (hvwapPl) {
        if (showLinesRef.current.hvwap && pt.hvwap != null && Number.isFinite(pt.hvwap)) {
          hvwapPl.applyOptions({
            price: pt.hvwap,
            axisLabelVisible: true,
            title: "",
          });
        } else {
          hvwapPl.applyOptions({ axisLabelVisible: false });
        }
      }

      // LVWAP
      const lvwapPl = plMap.get("lvwap");
      if (lvwapPl) {
        if (showLinesRef.current.lvwap && pt.lvwap != null && Number.isFinite(pt.lvwap)) {
          lvwapPl.applyOptions({
            price: pt.lvwap,
            axisLabelVisible: true,
            title: "",
          });
        } else {
          lvwapPl.applyOptions({ axisLabelVisible: false });
        }
      }

      // HP Trend
      const hpTrendPl = plMap.get("hp_trend");
      const hpInfo = hpMap.get(toChartTime(pt.date) || pt.date);
      if (hpTrendPl) {
        if (showLinesRef.current.hp && hpInfo?.trend != null && Number.isFinite(hpInfo.trend)) {
          hpTrendPl.applyOptions({
            price: hpInfo.trend,
            axisLabelVisible: true,
            title: "",
          });
        } else {
          hpTrendPl.applyOptions({ axisLabelVisible: false });
        }
      }

      // Anchors
      chartData?.anchors?.forEach((anc) => {
        const ancPl = plMap.get(`anc_${anc.id}`);
        if (ancPl) {
          if (enabledAnchorsRef.current.has(anc.id)) {
            const matchVal = anc.values.find((v) => v.date === pt.date)?.value;
            if (matchVal != null && Number.isFinite(matchVal)) {
              ancPl.applyOptions({
                price: matchVal,
                axisLabelVisible: true,
                title: "",
              });
            } else {
              ancPl.applyOptions({ axisLabelVisible: false });
            }
          } else {
            ancPl.applyOptions({ axisLabelVisible: false });
          }
        }
      });

      // HP Dev Panel
      const hpDevPl = plMap.get("hp_dev");
      if (hpDevPl) {
        if (showLinesRef.current.hp && hpInfo?.deviation != null && Number.isFinite(hpInfo.deviation)) {
          hpDevPl.applyOptions({
            price: hpInfo.deviation,
            color: hpInfo.deviation >= 100 ? "#f472b6" : "#3b82f6",
            axisLabelVisible: true,
            title: "",
          });
        } else {
          hpDevPl.applyOptions({ axisLabelVisible: false });
        }
      }

      // 3. Volume & Vol MA
      const isUpBar = prevPt ? pt.close >= prevPt.close : (pt.open != null ? pt.close >= pt.open : true);
      const volPl = plMap.get("vol");
      if (volPl) {
        if (pt.volume != null && Number.isFinite(pt.volume)) {
          volPl.applyOptions({
            price: pt.volume,
            color: isUpBar ? "rgba(239, 68, 68, 0.9)" : "rgba(59, 130, 246, 0.9)",
            axisLabelVisible: true,
            title: "",
          });
        } else {
          volPl.applyOptions({ axisLabelVisible: false });
        }
      }

      const volMaPl = plMap.get("vol_ma");
      if (volMaPl) {
        if (pt.vol_ma != null && Number.isFinite(pt.vol_ma)) {
          volMaPl.applyOptions({
            price: pt.vol_ma,
            axisLabelVisible: true,
            title: "",
          });
        } else {
          volMaPl.applyOptions({ axisLabelVisible: false });
        }
      }

      // 4. Amount & SMA50
      const amtPl = plMap.get("amt");
      if (amtPl) {
        if (pt.amount != null && Number.isFinite(pt.amount)) {
          amtPl.applyOptions({
            price: pt.amount,
            color: isUpBar ? "rgba(239, 68, 68, 0.9)" : "rgba(59, 130, 246, 0.9)",
            axisLabelVisible: true,
            title: "",
          });
        } else {
          amtPl.applyOptions({ axisLabelVisible: false });
        }
      }

      const amtSmaPl = plMap.get("amt_sma");
      if (amtSmaPl) {
        if (pt.amount_sma50 != null && Number.isFinite(pt.amount_sma50)) {
          amtSmaPl.applyOptions({
            price: pt.amount_sma50,
            axisLabelVisible: true,
            title: "",
          });
        } else {
          amtSmaPl.applyOptions({ axisLabelVisible: false });
        }
      }
    };

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
        { id: "main", name: `${targetTitle} 주가 & AVWAP`, height: isMobile ? 360 : 550 },
        ...(showHp ? [{ id: "hp_dev", name: "HP 이탈도 (%)", height: 90 }] : []),
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
                  : panel.id === "hp_dev"
                    ? { top: 0.08, bottom: 0.08 }
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

          // Dynamic hover price line on MDD
          const mddHoverLine = mddSeries.createPriceLine({
            price: 0,
            color: "#38bdf8",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("mdd", mddHoverLine);

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

          const closeHoverLine = candleSeries.createPriceLine({
            price: 0,
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("close", closeHoverLine);

          mainLinesMapRef.current.clear();

          // Moving Averages
          const samplePt = chartData.points[chartData.points.length - 1];
          if (samplePt?.ma) {
            Object.keys(samplePt.ma).forEach((maName) => {
              const color = MA_COLORS[maName] || "#94a3b8";
              const width = maName === "EMA_10" || maName === "SMA_10" || maName === "SMA_3" ? 2 : 1;
              const s = chart.addSeries(LineSeries, {
                color,
                lineWidth: width,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              activeSeries.push(s);
              mainLinesMapRef.current.set(maName, {
                id: maName,
                name: maName,
                series: s,
                color,
                defaultWidth: width,
              });

              const maHoverLine = s.createPriceLine({
                price: 0,
                color,
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                lineVisible: false,
                axisLabelVisible: false,
                title: "",
              });
              crosshairPriceLinesRef.current.set(`ma_${maName}`, maHoverLine);
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
          mainLinesMapRef.current.set("bb", {
            id: "bb",
            name: "BB상단",
            series: bbSeries,
            color: "#06b6d4",
            defaultWidth: 1,
          });
          const bbHoverLine = bbSeries.createPriceLine({
            price: 0,
            color: "#06b6d4",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("bb", bbHoverLine);

          // Base VWAP, HVWAP, LVWAP
          const vwapSeries = chart.addSeries(LineSeries, {
            color: "#ffffff",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(vwapSeries);
          mainLinesMapRef.current.set("vwap", {
            id: "vwap",
            name: "VWAP",
            series: vwapSeries,
            color: "#ffffff",
            defaultWidth: 2,
          });
          const vwapHoverLine = vwapSeries.createPriceLine({
            price: 0,
            color: "#ffffff",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
            axisLabelTextColor: "#000000",
          });
          crosshairPriceLinesRef.current.set("vwap", vwapHoverLine);

          const hvwapSeries = chart.addSeries(LineSeries, {
            color: "#f43f5e",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(hvwapSeries);
          mainLinesMapRef.current.set("hvwap", {
            id: "hvwap",
            name: "HVWAP(최고)",
            series: hvwapSeries,
            color: "#f43f5e",
            defaultWidth: 2,
          });
          const hvwapHoverLine = hvwapSeries.createPriceLine({
            price: 0,
            color: "#f43f5e",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("hvwap", hvwapHoverLine);

          const lvwapSeries = chart.addSeries(LineSeries, {
            color: "#eab308",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(lvwapSeries);
          mainLinesMapRef.current.set("lvwap", {
            id: "lvwap",
            name: "LVWAP(최저)",
            series: lvwapSeries,
            color: "#eab308",
            defaultWidth: 2,
          });
          const lvwapHoverLine = lvwapSeries.createPriceLine({
            price: 0,
            color: "#eab308",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
            axisLabelTextColor: "#000000",
          });
          crosshairPriceLinesRef.current.set("lvwap", lvwapHoverLine);

          // HP Long-term Trend (호드릭-프레스콧 장기추세 분홍 점선)
          const hpTrendSeries = chart.addSeries(LineSeries, {
            color: "#f472b6",
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(hpTrendSeries);
          mainLinesMapRef.current.set("hp_trend", {
            id: "hp_trend",
            name: "HP추세",
            series: hpTrendSeries,
            color: "#f472b6",
            defaultWidth: 2,
          });
          const hpTrendHoverLine = hpTrendSeries.createPriceLine({
            price: 0,
            color: "#f472b6",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("hp_trend", hpTrendHoverLine);

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
              mainLinesMapRef.current.set(anc.id, {
                id: anc.id,
                name: anc.name || `AVWAP (${anc.anchor_date})`,
                series: aSeries,
                color: anc.color,
                defaultWidth: 2,
              });

              const ancHoverLine = aSeries.createPriceLine({
                price: 0,
                color: anc.color,
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                lineVisible: false,
                axisLabelVisible: false,
                title: "",
              });
              crosshairPriceLinesRef.current.set(`anc_${anc.id}`, ancHoverLine);
            });
          }

          // Click-to-Anchor & Line Selection subscription on main price chart
          chart.subscribeClick((param) => {
            if (!param.time) return;
            const clickedDate =
              typeof param.time === "string"
                ? param.time
                : typeof param.time === "object" && "year" in param.time
                ? `${(param.time as any).year}-${String((param.time as any).month).padStart(2, "0")}-${String(
                    (param.time as any).day
                  ).padStart(2, "0")}`
                : null;

            if (!clickedDate) return;

            const isShift = Boolean((param.sourceEvent as any)?.shiftKey);
            if (isPickerModeRef.current || isShift) {
              setPickerDate(clickedDate);
              setShowQuickAnchorPopover(true);
              setIsPickerMode(false);
              isPickerModeRef.current = false;
              return;
            }

            // Line Click Selection: Find closest line near clicked Y coordinate
            if (param.point && candleSeries && typeof (candleSeries as any).priceToCoordinate === "function") {
              const pt = chartData.points.find((p) => p.date === clickedDate);
              if (pt) {
                let closestLineId: string | null = null;
                let minDistance = 16; // 16px tolerance

                const candidates: { id: string; val: number | null | undefined }[] = [];
                if (showLinesRef.current.vwap) candidates.push({ id: "vwap", val: pt.vwap });
                if (showLinesRef.current.hvwap) candidates.push({ id: "hvwap", val: pt.hvwap });
                if (showLinesRef.current.lvwap) candidates.push({ id: "lvwap", val: pt.lvwap });
                if (showLinesRef.current.bb) candidates.push({ id: "bb", val: pt.bb_upper });
                if (showLinesRef.current.hp) {
                  const hpVal = hpMap.get(toChartTime(pt.date) || pt.date)?.trend;
                  if (hpVal != null) candidates.push({ id: "hp_trend", val: hpVal });
                }

                if (pt.ma) {
                  Object.entries(pt.ma).forEach(([maName, val]) => {
                    candidates.push({ id: maName, val });
                  });
                }

                chartData.anchors?.forEach((anc) => {
                  if (enabledAnchorsRef.current.has(anc.id)) {
                    const matchVal = anc.values.find((v) => v.date === clickedDate)?.value;
                    candidates.push({ id: anc.id, val: matchVal });
                  }
                });

                for (const c of candidates) {
                  if (c.val != null && Number.isFinite(c.val)) {
                    const yCoord = (candleSeries as any).priceToCoordinate(c.val);
                    if (yCoord != null) {
                      const dist = Math.abs(yCoord - param.point.y);
                      if (dist < minDistance) {
                        minDistance = dist;
                        closestLineId = c.id;
                      }
                    }
                  }
                }

                if (closestLineId) {
                  setSelectedLineId((prev) => (prev === closestLineId ? null : closestLineId));
                  return;
                }
              }
            }

            // Clicked outside any line -> clear highlight
            setSelectedLineId(null);
          });

        }

        // Panel: HP Deviation (HP 이탈도: (Close / HP추세) × 100)
        else if (panel.id === "hp_dev") {
          const hpDevSeries = chart.addSeries(BaselineSeries, {
            baseValue: { type: "price", price: 100 },
            topLineColor: "#f472b6",
            bottomLineColor: "#f472b6",
            topFillColor1: "rgba(244, 114, 182, 0.30)",
            topFillColor2: "rgba(244, 114, 182, 0.05)",
            bottomFillColor1: "rgba(59, 130, 246, 0.05)",
            bottomFillColor2: "rgba(59, 130, 246, 0.30)",
            lineWidth: 2,
            priceFormat: {
              type: "custom",
              formatter: (price: number) => `${price.toFixed(1)}`,
              minMove: 0.1,
            },
            priceLineVisible: false,
            lastValueVisible: true,
          });
          hpDevSeries.createPriceLine({
            price: 100,
            color: "rgba(148, 163, 184, 0.6)",
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
          });

          const hpDevHoverLine = hpDevSeries.createPriceLine({
            price: 100,
            color: "#f472b6",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("hp_dev", hpDevHoverLine);

          activeSeries.push(hpDevSeries);
        }

        // 3. Panel: Volume & VIX Fix
        else if (panel.id === "volume") {
          const volSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(volSeries);

          const volHoverLine = volSeries.createPriceLine({
            price: 0,
            color: "rgba(239, 68, 68, 0.9)",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("vol", volHoverLine);

          const volMaSeries = chart.addSeries(LineSeries, {
            color: "#60a5fa",
            lineWidth: 1,
            priceFormat: { type: "volume" },
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(volMaSeries);

          const volMaHoverLine = volMaSeries.createPriceLine({
            price: 0,
            color: "#60a5fa",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("vol_ma", volMaHoverLine);

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
          const amtFormat = {
            type: "custom" as const,
            formatter: (price: number) => {
              if (isEokUnit || chartData?.amount_unit === "억원") {
                return price >= 10000 ? `${(price / 10000).toFixed(1)}조` : `${Math.round(price).toLocaleString()}억`;
              }
              if (chartData?.amount_unit === "백만$") {
                return price >= 1000 ? `${(price / 1000).toFixed(1)}B$` : `${Math.round(price).toLocaleString()}M$`;
              }
              if (chartData?.amount_unit === "억$") {
                return price >= 10000 ? `${(price / 10000).toFixed(1)}조$` : `${Math.round(price).toLocaleString()}억$`;
              }
              if (chartData?.amount_unit === "조$") {
                return `${price.toFixed(1)}조$`;
              }
              return `${price.toFixed(1)}조`;
            },
            minMove: isEokUnit ? 1 : 0.1,
          };

          const amtSeries = chart.addSeries(HistogramSeries, {
            priceFormat: amtFormat,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          activeSeries.push(amtSeries);

          const amtHoverLine = amtSeries.createPriceLine({
            price: 0,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("amt", amtHoverLine);

          const amtSmaSeries = chart.addSeries(LineSeries, {
            color: "#f59e0b",
            lineWidth: 2,
            priceFormat: amtFormat,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          activeSeries.push(amtSmaSeries);

          const amtSmaHoverLine = amtSmaSeries.createPriceLine({
            price: 0,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            lineVisible: false,
            axisLabelVisible: false,
            title: "",
          });
          crosshairPriceLinesRef.current.set("amt_sma", amtSmaHoverLine);
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
            clearCrosshairPriceLines();
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
          const ptIdx = chartData.points.findIndex((p) => p.date === tStr);
          const matchedPoint = ptIdx >= 0 ? chartData.points[ptIdx] : undefined;
          const prevPoint = ptIdx > 0 ? chartData.points[ptIdx - 1] : undefined;
          const hpInfo = matchedPoint ? hpMap.get(toChartTime(matchedPoint.date) || matchedPoint.date) : null;
          if (matchedPoint) {
            updateCrosshairPriceLines(matchedPoint, prevPoint);
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
              dd52w: matchedPoint.dd_52w ?? matchedPoint.h52_chg,
              dd3y: matchedPoint.dd_3y,
              h52Chg: matchedPoint.h52_chg,
              vixFix: matchedPoint.vix_fix,
              amount: matchedPoint.amount,
              amountSma50: matchedPoint.amount_sma50,
              vwap: matchedPoint.vwap,
              hvwap: matchedPoint.hvwap,
              lvwap: matchedPoint.lvwap,
              ma: matchedPoint.ma,
              hpTrend: hpInfo?.trend,
              hpDev: hpInfo?.deviation,
            });
          } else {
            setHoveredData(null);
            clearCrosshairPriceLines();
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
        // 1. MDD / Drawdown
        const mddSeriesList = seriesRef.current.get("mdd") || [];
        if (mddSeriesList[0]) {
          const getDrawdown = (p: AvwapPoint) => {
            if (ddPeriod === "52w") return p.dd_52w ?? p.h52_chg ?? p.mdd;
            if (ddPeriod === "3y") return p.dd_3y ?? p.mdd;
            return p.mdd;
          };
          mddSeriesList[0].setData(linePoints(getDrawdown));
        }

        // 2. Main (Candlesticks, MAs, BB Upper, VWAPs, HP Trend, Anchors)
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

          // HP Long-term Trend
          if (mainSeriesList[seriesIdx]) {
            if (showHp && hpResult?.trend) {
              mainSeriesList[seriesIdx].setData(hpResult.trend);
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

        // HP Deviation Panel (이탈도)
        if (showHp) {
          const hpDevSeriesList = seriesRef.current.get("hp_dev") || [];
          if (hpDevSeriesList[0] && hpResult?.deviation) {
            hpDevSeriesList[0].setData(hpResult.deviation);
          }
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
  }, [chartData, interval, market, symbol, isEokUnit, isMobile, showHp, hpResult]);

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
      const hpIdx = bbIdx + 4;

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
      if (mainSeriesList[hpIdx]) {
        if (showHp && hpResult?.trend) {
          mainSeriesList[hpIdx].setData(hpResult.trend);
        } else {
          mainSeriesList[hpIdx].setData([]);
        }
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
  }, [showVwap, showHvwap, showLvwap, showBbUpper, showHp, enabledAnchors, chartData, hpResult]);

  // Update Drawdown (MDD / 52W / 3Y) series dynamically when ddPeriod changes
  useEffect(() => {
    if (!chartData) return;
    const mddSeriesList = seriesRef.current.get("mdd") || [];
    if (!mddSeriesList[0]) return;

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

    const getDrawdown = (p: AvwapPoint) => {
      if (ddPeriod === "52w") return p.dd_52w ?? p.h52_chg ?? p.mdd;
      if (ddPeriod === "3y") return p.dd_3y ?? p.mdd;
      return p.mdd;
    };

    mddSeriesList[0].setData(linePoints(getDrawdown));
  }, [ddPeriod, chartData]);

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

  const latestHpInfo = latestPoint ? hpMap.get(toChartTime(latestPoint.date) || latestPoint.date) : null;

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
    dd52w: latestPoint.dd_52w ?? latestPoint.h52_chg,
    dd3y: latestPoint.dd_3y,
    h52Chg: latestPoint.h52_chg,
    vixFix: latestPoint.vix_fix,
    amount: latestPoint.amount,
    amountSma50: latestPoint.amount_sma50,
    vwap: latestPoint.vwap,
    hvwap: latestPoint.hvwap,
    lvwap: latestPoint.lvwap,
    ma: latestPoint.ma,
    hpTrend: latestHpInfo?.trend,
    hpDev: latestHpInfo?.deviation,
  } : null);

  const formatAmountValue = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "";
    const unit = chartData?.amount_unit || "조원";
    if (isEokUnit || unit === "억원") {
      return val >= 10000 ? `${(val / 10000).toFixed(1)}조` : `${Math.round(val).toLocaleString()}억`;
    }
    if (unit === "백만$") {
      return val >= 1000 ? `${(val / 1000).toFixed(1)}B$` : `${Math.round(val).toLocaleString()}M$`;
    }
    if (unit === "억$") {
      return val >= 10000 ? `${(val / 10000).toFixed(1)}조$` : `${Math.round(val).toLocaleString()}억$`;
    }
    if (unit === "조$") {
      return `${val.toFixed(1)}조$`;
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
            {MARKET_BUTTONS.map((m) => {
              const isSelected = !symbol && market === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleClearStock(m.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Stock / ETF & Country Toggle & Search Box */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Segment Toggle: KR / US */}
            <div className="inline-flex rounded-lg bg-gray-800/80 p-0.5 border border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setSearchCountry("kr");
                  if (symbol && searchCountry === "us") {
                    handleClearStock();
                  }
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  searchCountry === "kr"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                KR
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchCountry("us");
                  if (symbol && searchCountry === "kr") {
                    handleClearStock();
                  }
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  searchCountry === "us"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                US
              </button>
            </div>

            {/* Segment Toggle: 종목 / ETF */}
            <div className="inline-flex rounded-lg bg-gray-800/80 p-0.5 border border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setSearchType("stock");
                  if (symbol && searchType === "etf") {
                    handleClearStock();
                  }
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  searchType === "stock"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                종목
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchType("etf");
                  if (symbol && searchType === "stock") {
                    handleClearStock();
                  }
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  searchType === "etf"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                ETF
              </button>
            </div>

            {/* Search Box with Autocomplete */}
            <div className="relative">
              <div className={`flex items-center bg-gray-800/90 border rounded-lg px-2.5 py-1 text-xs transition-all ${
                symbol
                  ? searchType === "etf"
                    ? "border-purple-500/80 ring-1 ring-purple-500/50"
                    : "border-emerald-500/80 ring-1 ring-emerald-500/50"
                  : searchType === "etf"
                  ? "border-gray-700 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500"
                  : "border-gray-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
              }`}>
                <span className="text-gray-400 mr-1.5">🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={
                    searchCountry === "kr"
                      ? searchType === "etf"
                        ? "국내 ETF명 또는 코드 (예: KODEX 200, 069500)"
                        : "종목명 또는 코드 (예: 삼성전자, 005930)"
                      : searchType === "etf"
                      ? "미국 ETF명 또는 티커 (예: QQQ, SPY, TQQQ)"
                      : "미국 종목명 또는 티커 (예: AAPL, 테슬라, NVDA)"
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    if (isSelectingRef.current) return;
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                    setSelectedIndex(-1);
                  }}
                  onFocus={(e) => {
                    setShowDropdown(true);
                    if (symbol && searchQuery) {
                      e.target.select();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (!showDropdown) {
                        setShowDropdown(true);
                        return;
                      }
                      if (searchResults && searchResults.length > 0) {
                        setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
                      }
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (searchResults && searchResults.length > 0) {
                        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
                      }
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (searchResults && searchResults.length > 0) {
                        const targetStock =
                          selectedIndex >= 0 && selectedIndex < searchResults.length
                            ? searchResults[selectedIndex]
                            : searchResults[0];
                        handleSelectStock(targetStock);
                      } else if (searchQuery.trim()) {
                        isSelectingRef.current = true;
                        setSymbol(searchQuery.trim());
                        setShowDropdown(false);
                        setSelectedIndex(-1);
                        searchInputRef.current?.blur();
                        setTimeout(() => {
                          isSelectingRef.current = false;
                        }, 150);
                      }
                    } else if (e.key === "Escape") {
                      setShowDropdown(false);
                      setSelectedIndex(-1);
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
                    searchResults.map((stk, idx) => (
                      <button
                        key={stk.code}
                        onClick={() => handleSelectStock(stk)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between border-b border-gray-800/50 last:border-0 transition-colors ${
                          selectedIndex === idx ? "bg-gray-800" : "hover:bg-gray-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{stk.name}</span>
                          <span className="text-[11px] text-gray-400 font-mono">{stk.code}</span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            stk.market === "ETF" || stk.market === "US_ETF"
                              ? "bg-purple-900/60 text-purple-300 border border-purple-700/50"
                              : stk.market === "KOSPI"
                              ? "bg-blue-900/60 text-blue-300"
                              : stk.market === "KOSDAQ"
                              ? "bg-emerald-900/60 text-emerald-300"
                              : stk.market === "NASDAQ"
                              ? "bg-sky-900/60 text-sky-300 border border-sky-700/50"
                              : stk.market === "NYSE"
                              ? "bg-amber-900/60 text-amber-300 border border-amber-700/50"
                              : stk.market === "AMEX"
                              ? "bg-rose-900/60 text-rose-300 border border-rose-700/50"
                              : "bg-cyan-900/60 text-cyan-300"
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
            onClick={() => {
              setShowVwap((prev) => {
                if (prev && selectedLineId === "vwap") setSelectedLineId(null);
                return !prev;
              });
            }}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              selectedLineId === "vwap"
                ? "ring-2 ring-white border-white bg-slate-100 text-gray-950 font-bold shadow-md"
                : showVwap
                ? "bg-slate-200 text-gray-900 border-white shadow-sm"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
            title="클릭하여 VWAP 표시 ON/OFF"
          >
            VWAP
          </button>
          <button
            onClick={() => {
              setShowHvwap((prev) => {
                if (prev && selectedLineId === "hvwap") setSelectedLineId(null);
                return !prev;
              });
            }}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              selectedLineId === "hvwap"
                ? "ring-2 ring-rose-400 border-rose-400 bg-rose-500/40 text-rose-200 font-bold shadow-md"
                : showHvwap
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-sm"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
            title="클릭하여 HVWAP 표시 ON/OFF"
          >
            HVWAP(최고)
          </button>
          <button
            onClick={() => {
              setShowLvwap((prev) => {
                if (prev && selectedLineId === "lvwap") setSelectedLineId(null);
                return !prev;
              });
            }}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              selectedLineId === "lvwap"
                ? "ring-2 ring-yellow-400 border-yellow-400 bg-yellow-500/40 text-yellow-200 font-bold shadow-md"
                : showLvwap
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-sm"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
            title="클릭하여 LVWAP 표시 ON/OFF"
          >
            LVWAP(최저)
          </button>
          <button
            onClick={() => {
              setShowBbUpper((prev) => {
                if (prev && selectedLineId === "bb") setSelectedLineId(null);
                return !prev;
              });
            }}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              selectedLineId === "bb"
                ? "ring-2 ring-cyan-400 border-cyan-400 bg-cyan-500/40 text-cyan-200 font-bold shadow-md"
                : showBbUpper
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-sm"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
            title="클릭하여 BB상단 표시 ON/OFF"
          >
            BB상단
          </button>
          <button
            onClick={() => {
              setShowHp((prev) => {
                if (prev && selectedLineId === "hp_trend") setSelectedLineId(null);
                return !prev;
              });
            }}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              selectedLineId === "hp_trend"
                ? "ring-2 ring-pink-400 border-pink-400 bg-pink-500/40 text-pink-200 font-bold shadow-md"
                : showHp
                ? "bg-pink-500/20 text-pink-400 border-pink-500/40 shadow-sm"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
            title="클릭하여 HP(호드릭-프레스콧) 장기추세 및 이탈도 표시 ON/OFF"
          >
            HP필터
          </button>
          <div className="h-4 w-px bg-gray-700 mx-1" />
          <button
            onClick={() => toggleAllAnchors(enabledAnchors.size === 0)}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-all ${
              enabledAnchors.size > 0
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm hover:bg-indigo-500/30"
                : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
            title={
              enabledAnchors.size > 0
                ? "클릭하여 모든 앵커 끄기 (전체 OFF)"
                : "클릭하여 모든 앵커 켜기 (전체 ON)"
            }
          >
            {enabledAnchors.size > 0 ? "앵커 전체 ON" : "앵커 전체 OFF"}
          </button>
        </div>
      </div>

      {/* ── 2. Anchor Badges Bar & Controls ── */}
      <div className="relative bg-gray-900/50 border-b border-gray-800/80 px-4 py-2 flex items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 py-0.5">
          <span className="text-gray-500 font-bold mr-1 flex-shrink-0">
            {isStockMode ? "주요 앵커:" : "변곡점 앵커:"}
          </span>
          {chartData?.anchors && chartData.anchors.map((anc) => {
            const isEnabled = enabledAnchors.has(anc.id);
            const isCustom = anc.id.startsWith("anc_") || !anc.id.startsWith("anchor_");
            const isSelected = selectedLineId === anc.id;
            return (
              <div
                key={anc.id}
                className={`group flex-shrink-0 rounded-full border transition-all flex items-center gap-1 px-2 py-0.5 ${
                  isSelected
                    ? "ring-2 ring-indigo-400 border-indigo-400 font-bold shadow-md bg-indigo-950/70 text-indigo-200"
                    : isEnabled
                    ? isCustom
                      ? "bg-emerald-950/40 text-emerald-300 border-emerald-700/80 font-medium shadow-sm hover:border-emerald-500"
                      : "bg-gray-800 text-white border-gray-600 font-medium hover:border-gray-400"
                    : "bg-gray-900/60 text-gray-500 border-gray-800 hover:text-gray-400"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleAnchor(anc.id)}
                  className="flex items-center gap-1.5 text-left focus:outline-none"
                  title={isEnabled ? "클릭하여 차트 표시 끄기 (OFF)" : "클릭하여 차트 표시 켜기 (ON)"}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isEnabled ? anc.color : "#4b5563" }}
                  />
                  <span className="truncate max-w-[140px]">{anc.name || anc.anchor_date}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetType = isCustom ? "커스텀" : "시스템";
                    if (confirm(`'${anc.name || anc.anchor_date}' ${targetType} 앵커를 삭제(숨김)하시겠습니까?`)) {
                      handleDeleteAnchor(anc.id, anc.anchor_date, isCustom);
                    }
                  }}
                  className="ml-0.5 text-gray-400 hover:text-rose-400 p-0.5 rounded-full hover:bg-gray-800 transition-colors opacity-70 group-hover:opacity-100"
                  title="앵커 삭제(숨김)"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Action Buttons: Add Anchor, Click Picker & Manage */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsPickerMode(!isPickerMode);
              if (showQuickAnchorPopover) setShowQuickAnchorPopover(false);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all text-[11px] ${
              isPickerMode
                ? "bg-emerald-600 text-white ring-2 ring-emerald-400 animate-pulse"
                : "bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-emerald-700/60"
            }`}
            title="차트에서 직접 캔들을 클릭하여 앵커 날짜를 지정합니다 (또는 Shift+클릭)"
          >
            <span>🎯 캔들 클릭</span>
          </button>
          <button
            type="button"
            onClick={() => setShowQuickAnchorPopover(!showQuickAnchorPopover)}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-1 shadow-sm transition-colors text-[11px]"
          >
            <span>+ 앵커 추가</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAnchorManagerModal(true)}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 flex items-center gap-1 transition-colors text-[11px]"
            title="변곡점 앵커 전체 관리"
          >
            <span>⚙ 관리</span>
          </button>

          {/* Quick Add Popover */}
          <AvwapQuickAnchorPopover
            isOpen={showQuickAnchorPopover}
            onClose={() => {
              setShowQuickAnchorPopover(false);
              setPickerDate(null);
            }}
            onAddAnchor={handleAddCustomAnchor}
            defaultDate={pickerDate || chartData?.points?.[chartData.points.length - 1]?.date || ""}
          />
        </div>
      </div>

      {/* Anchor Manager Modal */}
      <AvwapAnchorManagerModal
        isOpen={showAnchorManagerModal}
        onClose={() => setShowAnchorManagerModal(false)}
        targetName={currentTargetDisplayName}
        anchors={unifiedAnchors}
        onToggleAnchor={toggleAnchor}
        onUpdateCustomAnchor={handleUpdateCustomAnchor}
        onDeleteAnchor={handleDeleteAnchor}
        onAddCustomAnchor={handleAddCustomAnchor}
        onResetToDefaults={handleResetToDefaults}
      />


      {/* ── 3. Realtime Status / HUD Header ── */}
      <div className="bg-gray-900/30 px-3 sm:px-4 py-1 sm:py-1.5 border-b border-gray-800/40 text-[11px] sm:text-xs font-mono flex flex-wrap items-center gap-x-2.5 sm:gap-x-4 gap-y-0.5 sm:gap-y-1 text-gray-400 leading-tight sm:leading-normal">
        {chartData && (
          <span className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                chartData.market === "ETF"
                  ? "bg-purple-950/80 text-purple-400 border border-purple-800"
                  : isStockMode
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                  : "bg-blue-950/80 text-blue-400 border border-blue-800"
              }`}
            >
              {chartData.market === "ETF" ? "ETF" : isStockMode ? "종목" : "지수"}
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
              <span className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
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
            {/* Drawdown Header Badge */}
            {(() => {
              const curDd = ddPeriod === "52w"
                ? (activeDisplay.dd52w ?? activeDisplay.h52Chg ?? activeDisplay.mdd)
                : ddPeriod === "3y"
                ? (activeDisplay.dd3y ?? activeDisplay.mdd)
                : activeDisplay.mdd;
              if (curDd === null || curDd === undefined) return null;
              return (
                <span>
                  낙폭({ddPeriod === "52w" ? "52주" : ddPeriod === "3y" ? "3년" : "전기간"}):{" "}
                  <span
                    className={`font-bold ${
                      curDd === 0
                        ? "text-emerald-400"
                        : curDd <= -20
                        ? "text-rose-400"
                        : "text-sky-400"
                    }`}
                  >
                    {curDd.toFixed(1)}%
                  </span>
                  {ddPeriod !== "all" && activeDisplay.mdd !== null && activeDisplay.mdd !== undefined && (
                    <span className="text-gray-400 font-normal text-[11px] ml-1">
                      (전체: {activeDisplay.mdd.toFixed(1)}%)
                    </span>
                  )}
                </span>
              );
            })()}
            {activeDisplay.vixFix !== null && activeDisplay.vixFix !== undefined && (
              <span>VIX Fix: <span className="text-emerald-400 font-bold">{activeDisplay.vixFix.toFixed(1)}%</span></span>
            )}
            {activeDisplay.vwap !== null && activeDisplay.vwap !== undefined && (
              <span>VWAP: <span className="text-slate-200">{activeDisplay.vwap.toLocaleString()}</span></span>
            )}
            {showHp && activeDisplay.hpTrend !== null && activeDisplay.hpTrend !== undefined && (
              <span>
                HP추세: <span className="text-pink-400 font-bold">{activeDisplay.hpTrend.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              </span>
            )}
            {showHp && activeDisplay.hpDev !== null && activeDisplay.hpDev !== undefined && (
              <span>
                HP이탈:{" "}
                <span
                  className={`font-bold ${
                    activeDisplay.hpDev >= 100 ? "text-pink-400" : "text-sky-400"
                  }`}
                >
                  {activeDisplay.hpDev.toFixed(1)}
                </span>
              </span>
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

          {/* Panel 1: Drawdown / MDD */}
          <div className="w-full relative border-b border-gray-800 bg-[#090d16]">
            <div className="absolute top-1.5 left-3 z-10 flex items-center gap-1.5 bg-gray-900/80 px-2 py-0.5 rounded border border-gray-800 backdrop-blur-sm shadow-sm">
              <span className="text-[11px] font-bold text-gray-300">
                낙폭 ({ddPeriod === "52w" ? "52주" : ddPeriod === "3y" ? "3년" : "전기간"})
              </span>
              <div className="flex items-center gap-0.5 ml-1 bg-gray-950 p-0.5 rounded border border-gray-800">
                <button
                  type="button"
                  onClick={() => setDdPeriod("52w")}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    ddPeriod === "52w"
                      ? "bg-sky-600 text-white font-bold shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  52주 (기본)
                </button>
                <button
                  type="button"
                  onClick={() => setDdPeriod("3y")}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    ddPeriod === "3y"
                      ? "bg-sky-600 text-white font-bold shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  3년
                </button>
                <button
                  type="button"
                  onClick={() => setDdPeriod("all")}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    ddPeriod === "all"
                      ? "bg-sky-600 text-white font-bold shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  전기간
                </button>
              </div>
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

            {/* Highlighted Line Guide Badge */}
            {selectedLineId && !isPickerMode && (
              <div className="absolute top-2 right-4 z-20 flex items-center gap-2 bg-indigo-950/90 text-indigo-200 border border-indigo-500/80 px-3 py-1 rounded-lg text-xs font-bold shadow-xl backdrop-blur-md">
                <span>✨ {mainLinesMapRef.current.get(selectedLineId)?.name || selectedLineId} 선 강조 중</span>
                <button
                  type="button"
                  onClick={() => setSelectedLineId(null)}
                  className="ml-1 text-indigo-300 hover:text-white px-1.5 py-0.5 rounded bg-indigo-900/70 text-[10px] border border-indigo-700 hover:bg-indigo-800 transition-colors"
                  title="강조 해제 (ESC 또는 빈 공간 클릭)"
                >
                  ✕ 해제
                </button>
              </div>
            )}

            {/* Picker Mode Guide Badge */}
            {isPickerMode && (
              <div className="absolute top-2 right-4 z-20 flex items-center gap-2 bg-emerald-950/90 text-emerald-300 border border-emerald-500/80 px-3 py-1 rounded-lg text-xs font-bold shadow-lg animate-pulse backdrop-blur-md">
                <span>🎯 앵커로 설정할 캔들을 클릭하세요 (또는 Shift+클릭)</span>
                <button
                  type="button"
                  onClick={() => setIsPickerMode(false)}
                  className="ml-1 text-emerald-400 hover:text-white px-1.5 py-0.5 rounded bg-emerald-900/60 text-[10px]"
                >
                  ESC 취소
                </button>
              </div>
            )}

            <div data-chart-id="main" className={`w-full ${isPickerMode ? "cursor-crosshair" : ""}`} />
          </div>

          {/* Panel HP: HP Deviation (이탈도) */}
          {showHp && (
            <div className="w-full relative border-b border-gray-800 bg-[#090d16]">
              <div className="absolute top-1.5 left-3 z-10 flex items-center gap-1.5 text-[11px] font-bold text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">
                <span className="text-pink-400 font-bold">HP 이탈도</span>
                <span className="text-gray-400 font-mono text-[10px] hidden sm:inline">(100 = 추세 일치, &gt;100 상회, &lt;100 하회)</span>
              </div>
              <div data-chart-id="hp_dev" className="w-full" />
            </div>
          )}

          {/* Panel 3: Volume & VIX Fix */}
          <div className="w-full relative border-b border-gray-800 bg-[#090d16]">
            <div className="absolute top-1.5 left-3 z-10 text-[11px] font-bold text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">
              거래량 (막대) & VIX Fix (초록 점선)
            </div>
            <div data-chart-id="volume" className="w-full" />
          </div>

          {/* Panel 4: Trading Amount (거래대금) & SMA50 */}
          <div className="w-full relative bg-[#090d16]">
            <div className="absolute top-1.5 left-3 z-10 flex items-center gap-1.5 text-[11px] font-bold text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">
              <span>거래대금 ({chartData?.amount_unit || "조원"})</span>
              {Boolean(
                chartData?.amount_unit === "조$" ||
                (!symbol && ["sp500", "nasdaq100", "dow", "dow30"].includes(market.toLowerCase()))
              ) && (
                <span className="text-[10px] font-normal text-amber-300 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-800/60 font-mono">
                  [추정식: 종가(Close) × 거래량(Volume)]
                </span>
              )}
              <span>& SMA (주황 실선)</span>
            </div>
            <div data-chart-id="amount" className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AvwapChart;
