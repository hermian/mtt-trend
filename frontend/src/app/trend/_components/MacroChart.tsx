"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  SeriesType,
  LineStyle,
} from "lightweight-charts";
import { useMacroData } from "@/hooks/useMacroData";
import type { MacroDataPoint } from "@/lib/api";
import { hpFilterSeries, HP_LAMBDA_DAILY } from "@/lib/hpFilter";

/** HP 장기추세·이탈도를 적용할 지수 (FinJump DSTOA005001 / DSTOA006001) */
const INDEX_HP_IDS = new Set(["sp500", "nasdaq100", "kospi"]);

/** ISM PMI histogram: 확장(>=50) / 수축(<50) */
const ISM_EXPAND_COLOR = "#a855f7";
const ISM_CONTRACT_COLOR = "#f43f5e";

interface MacroChartProps {
  /** @deprecated 차트 높이는 컨테이너 flex 영역을 ResizeObserver로 측정합니다 */
  height?: number;
}

/** 선택 가능한 매크로 지표 정의 */
interface IndicatorDef {
  id: keyof Omit<MacroDataPoint, "date">;
  label: string;
  color: string;
  area?: boolean;
  /** 월간 등 희소 지표 — 값 변경일만 Histogram (normalized 시 Line 폴백) */
  histogram?: boolean;
  raw: (v: number) => string;
}

const INDICATORS: IndicatorDef[] = [
  { id: "sp500", label: "S&P 500", color: "#38bdf8", area: true, raw: (v) => `SPX ${v.toFixed(0)}` },
  { id: "nasdaq100", label: "NDX", color: "#22d3ee", raw: (v) => `NDX ${v.toFixed(0)}` },
  { id: "kospi", label: "KOSPI", color: "#f87171", raw: (v) => `KOSPI ${v.toFixed(0)}` },
  {
    id: "export_avg",
    label: "일평균수출",
    color: "#6366f1",
    raw: (v) => `수출 $${v.toFixed(1)}억`,
  },
  {
    id: "ism_pmi",
    label: "ISM PMI",
    color: ISM_EXPAND_COLOR,
    histogram: true,
    raw: (v) => `ISM ${v.toFixed(1)}`,
  },
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
  { id: "fed_funds", label: "Fed Funds", color: "#67e8f9", raw: (v) => `FF ${v.toFixed(2)}%` },
  { id: "bok_base", label: "BOK Base", color: "#fb7185", raw: (v) => `BOK ${v.toFixed(2)}%` },
  { id: "wti", label: "WTI", color: "#f97316", raw: (v) => `WTI $${v.toFixed(2)}` },
  { id: "brent", label: "Brent", color: "#ea580c", raw: (v) => `Brent $${v.toFixed(2)}` },
  { id: "wti_fred", label: "WTI (FRED)", color: "#fdba74", raw: (v) => `WTI-F $${v.toFixed(2)}` },
  { id: "brent_fred", label: "Brent (FRED)", color: "#c2410c", raw: (v) => `Brent-F $${v.toFixed(2)}` },
  { id: "usdkrw", label: "USD/KRW", color: "#34d399", raw: (v) => `₩${v.toFixed(1)}` },
  { id: "usdjpy", label: "USD/JPY", color: "#a3e635", raw: (v) => `¥${v.toFixed(2)}` },
  { id: "usdcny", label: "USD/CNY", color: "#facc15", raw: (v) => `¥${v.toFixed(3)}` },
  { id: "eurusd", label: "EUR/USD", color: "#c084fc", raw: (v) => `€${v.toFixed(4)}` },
  { id: "dxy", label: "DXY", color: "#94a3b8", raw: (v) => `DXY ${v.toFixed(2)}` },
];

const DEFAULT_SELECTED = new Set(["sp500", "high_yield", "cnn_fgi"]);

/** HY Spread 이동평균 창 (거래일) */
const HY_MA_WINDOW = 200;
/**
 * API 조회 시 표시 기간보다 앞에 붙일 캘린더 일수.
 * 200 거래일 ≈ 280캘린더 + 여유. HP 양끝 왜곡 완화에도 사용.
 */
const FETCH_WARMUP_DAYS = 320;

/** 기간 프리셋 (단일 선택, 공통 X축 시간 필터) */
type Period = string;
const PERIODS: Period[] = ["5D", "1M", "3M", "6M", "YTD", "1Y", "2Y", "5Y", "All"];

const START_DAYS: Record<string, number> = {
  "5D": 5, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "2Y": 730, "5Y": 1825,
};

/** 화면에 보여줄 기간의 시작일 */
function displayStartFor(period: Period): string | undefined {
  if (period === "All") return undefined;
  if (period === "YTD") {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  }
  const d = new Date();
  d.setDate(d.getDate() - START_DAYS[period]);
  return d.toISOString().slice(0, 10);
}

/** MA/HP 워밍업을 포함한 API 조회 시작일 */
function fetchStartFor(period: Period): string | undefined {
  const display = displayStartFor(period);
  if (!display) return undefined;
  const d = new Date(display + "T00:00:00");
  d.setDate(d.getDate() - FETCH_WARMUP_DAYS);
  return d.toISOString().slice(0, 10);
}

function getVal(id: IndicatorDef["id"], p: MacroDataPoint): number | undefined {
  return p[id] as number | undefined;
}

interface TimePoint {
  time: string;
  value: number;
}

function sliceFrom(data: TimePoint[], fromTime?: string): TimePoint[] {
  if (!fromTime) return data;
  return data.filter((p) => p.time >= fromTime);
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

/** HP 이탈도 맵 (이미 계산된 deviation 시리즈에서 해당 시각 값 추출) */
function collectHpDevAt(
  time: string,
  hpDevById: Map<string, TimePoint[]>,
): Record<string, number> | undefined {
  if (hpDevById.size === 0) return undefined;
  const out: Record<string, number> = {};
  hpDevById.forEach((pts, id) => {
    const hit = pts.find((p) => p.time === time);
    if (hit) out[id] = hit.value;
  });
  return Object.keys(out).length ? out : undefined;
}

/** raw → 표시용(정규화 시 기준=display 첫값) */
function toDisplayScale(pts: TimePoint[], base?: number): TimePoint[] {
  if (base == null || base === 0) return pts;
  return pts.map((p) => ({ time: p.time, value: (p.value / base) * 100 }));
}

function toIsmHistogramData(
  pts: TimePoint[],
): { time: string; value: number; color: string }[] {
  return pts.map((p) => ({
    time: p.time,
    value: p.value,
    color: p.value >= 50 ? ISM_EXPAND_COLOR : ISM_CONTRACT_COLOR,
  }));
}

/**
 * 시리즈에 원본·MA·HP 반영.
 * fullPts로 MA/HP를 계산한 뒤 displayStart 이후만 그려 앞구간 잘림을 막는다.
 */
function applySeriesData(
  ind: IndicatorDef,
  series: {
    main: ISeriesApi<SeriesType>;
    ma?: ISeriesApi<SeriesType>;
    hpTrend?: ISeriesApi<SeriesType>;
    hpDev?: ISeriesApi<SeriesType>;
  },
  fullPts: FakePoint[],
  displayStart: string | undefined,
  normalized: boolean,
  hpEnabled: boolean,
): TimePoint[] | undefined {
  const fullRaw = buildSeries(ind.id, fullPts);
  const useHistogram = !!ind.histogram && !normalized;
  // Histogram은 일별 ffill을 그대로 그려 인접 bar가 월 단위 블록으로 보이게 함.
  // (월 1포인트만 쓰면 일봉 축에서 bar가 하루 폭으로 너무 얇음)
  const displayRaw = sliceFrom(fullRaw, displayStart);
  const base = normalized && displayRaw.length ? displayRaw[0].value : undefined;

  if (useHistogram) {
    series.main.setData(toIsmHistogramData(displayRaw) as any);
  } else {
    series.main.setData(toDisplayScale(displayRaw, base) as any);
  }

  if (series.ma) {
    const maFull = movingAverage(fullRaw, HY_MA_WINDOW);
    series.ma.setData(toDisplayScale(sliceFrom(maFull, displayStart), base) as any);
  }

  if (hpEnabled && INDEX_HP_IDS.has(ind.id) && series.hpTrend && fullRaw.length >= 4) {
    const { trend, deviation } = hpFilterSeries(fullRaw, HP_LAMBDA_DAILY);
    series.hpTrend.setData(toDisplayScale(sliceFrom(trend, displayStart), base) as any);
    const displayDev = sliceFrom(deviation, displayStart);
    if (series.hpDev) series.hpDev.setData(displayDev as any);
    return displayDev;
  }
  return undefined;
}

/** 시계열 raw 변환 (정규화는 applySeriesData에서 display 기준으로 처리) */
function buildSeries(key: IndicatorDef["id"], points: FakePoint[]): TimePoint[] {
  return points
    .map((p) => ({ time: p.time, raw: getVal(key, p as MacroDataPoint) as number }))
    .filter((r) => r.raw != null && !Number.isNaN(r.raw))
    .map((r) => ({ time: r.time, value: r.raw }));
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

/* 호버 범례에 실제 날짜 time을 매핑하기 위한 어댑터 */
type FakePoint = MacroDataPoint & { time: string };

interface HoveredData {
  time: string;
  values: Record<string, number>;
  /** HP 이탈도 (지수/추세×100), 키는 지표 id */
  hpDev?: Record<string, number>;
}

export const MacroChart: React.FC<MacroChartProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  /** 레이아웃 폭을 받는 셸 — 차트 호스트와 분리해 ResizeObserver가 실제 가용 폭을 읽게 함 */
  const shellRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<
    Map<
      string,
      {
        main: ISeriesApi<SeriesType>;
        ma?: ISeriesApi<SeriesType>;
        hpTrend?: ISeriesApi<SeriesType>;
        hpDev?: ISeriesApi<SeriesType>;
      }
    >
  >(new Map());
  const chartDataRef = useRef<FakePoint[] | null>(null);
  /** MA/HP 계산용 전체(워밍업 포함) 데이터 */
  const fullDataRef = useRef<FakePoint[] | null>(null);
  /** 호버 범례용 HP 이탈도 캐시 (차트 재생성·데이터 갱신 시 갱신) */
  const hpDevCacheRef = useRef<Map<string, TimePoint[]>>(new Map());
  const displayStartRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState<string>("Initializing...");
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<string>>(DEFAULT_SELECTED);
  const [period, setPeriod] = useState<Period>("2Y");
  const [normalized, setNormalized] = useState<boolean>(false);
  /** HP 필터 ON — 지수에 장기추세 오버레이 + 이탈 패널 (FinJump DSTOA005001/6001) */
  const [hpEnabled, setHpEnabled] = useState<boolean>(true);
  /** 셸 크기 추적 — 폭/높이가 바뀌면 차트 재생성 (고정 height prop은 컨트롤 바 확장 시 잘림) */
  const [chartWidth, setChartWidth] = useState(0);
  const [chartHeight, setChartHeight] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  /* 레이아웃 폭·높이 추적 — 컨트롤 바 줄 수 변화에도 차트 영역이 남은 공간에 맞춤 */
  useEffect(() => {
    const shell = shellRef.current;
    const outer = containerRef.current;
    if (!shell) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const publish = () => {
      const rect = shell.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w >= 10) setChartWidth((prev) => (Math.abs(prev - w) <= 1 ? prev : w));
      if (h >= 10) setChartHeight((prev) => (Math.abs(prev - h) <= 1 ? prev : h));
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(publish, 50);
    };
    publish();
    const ro = new ResizeObserver(schedule);
    ro.observe(shell);
    if (outer) ro.observe(outer);
    window.addEventListener("resize", schedule);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const displayStart = useMemo(() => displayStartFor(period), [period]);
  const fetchStart = useMemo(() => fetchStartFor(period), [period]);
  const { data: chartData, isLoading, error, isFetching } = useMacroData(fetchStart);

  const fullFormattedData = useMemo<FakePoint[]>(() => {
    if (!chartData || !chartData.data) return [];
    return [...chartData.data]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((p) => ({ ...p, time: p.date }));
  }, [chartData]);

  /** 화면에 그릴 구간 (워밍업 제외) */
  const formattedData = useMemo<FakePoint[]>(() => {
    if (!displayStart) return fullFormattedData;
    return fullFormattedData.filter((p) => p.time >= displayStart);
  }, [fullFormattedData, displayStart]);

  useEffect(() => {
    displayStartRef.current = displayStart;
    if (fullFormattedData.length > 0) fullDataRef.current = fullFormattedData;
    if (formattedData.length > 0) chartDataRef.current = formattedData;
  }, [fullFormattedData, formattedData, displayStart]);

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

  /* 차트 + 시리즈 재구성 (지표/정규화/폭 변경 시 재생성 → 폭 불일치 원천 제거) */
  useEffect(() => {
    const shell = shellRef.current;
    const host = hostRef.current;
    if (!shell || !host || chartWidth < 10 || chartHeight < 10) return;

    setStatus("Building Charts...");
    seriesRef.current.clear();
    host.replaceChildren();

    const initialW = chartWidth;
    const initialH = chartHeight;

    const chart = createChart(host, {
      autoSize: false,
      width: initialW,
      height: initialH,
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#cbd5e1",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      timeScale: {
        visible: true,
        borderColor: "#334155",
        rightOffset: 8,
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

    const hpActiveIndices = hpEnabled
      ? activeIndicators.filter((i) => INDEX_HP_IDS.has(i.id))
      : [];
    const showHpPane = hpActiveIndices.length > 0;

    // 이탈도 패널 (FinJump DSTOA006001) — 지수 HP ON일 때만
    let hpDevPaneIndex = 0;
    if (showHpPane) {
      const mainPane = chart.panes()[0];
      mainPane.setStretchFactor(3);
      const devPane = chart.addPane(true);
      devPane.setStretchFactor(1);
      hpDevPaneIndex = devPane.paneIndex();
    }

    const hpDevCache = hpDevCacheRef.current;
    hpDevCache.clear();

    const publishHover = (pt: FakePoint | undefined) => {
      if (!pt) {
        setHoveredData(null);
        return;
      }
      setHoveredData({
        time: pt.date,
        values: collectValuesFor(pt, activeIndicators),
        hpDev: collectHpDevAt(pt.time, hpDevCacheRef.current),
      });
    };

    // 호버 시 범례 갱신
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0) {
        const arr = chartDataRef.current;
        publishHover(arr && arr.length ? arr[arr.length - 1] : undefined);
        return;
      }
      const pt = chartDataRef.current?.find((p) => p.time === param.time);
      publishHover(pt);
    });

    // 정규화된 시리즈는 공통 % 축(right)에, raw는 각자 고유 스케일에 배치
    activeIndicators.forEach((ind, i) => {
      const scaleId = normalized ? "right" : i === 0 ? "right" : i === 1 ? "left" : `macro_overlay_${i}`;

      const isArea = !!ind.area && !normalized; // 면적은 raw 상태에서만 가독성 있음
      const isHistogram = !!ind.histogram && !normalized;
      const formatter = normalized ? (v: number) => `${v.toFixed(1)}%` : ind.raw;
      const commonOpts: any = {
        color: ind.color,
        lineWidth: 2,
        priceLineVisible: false,
        priceScaleId: scaleId,
        priceFormat: { type: "custom", formatter },
      };

      const main = isHistogram
        ? chart.addSeries(HistogramSeries, {
            priceLineVisible: false,
            priceScaleId: scaleId,
            priceFormat: { type: "custom", formatter },
            base: 0,
          })
        : isArea
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

      // ISM PMI: 확장/수축 기준선 50 (축 라벨은 차트 안을 가리므로 숨김)
      if (ind.id === "ism_pmi" && !normalized) {
        main.createPriceLine({
          price: 50,
          color: "#94a3b8",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: "",
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

      // 하이일드 스프레드 200일 이동평균 (HP 추세와 동일: 분홍 점선)
      let ma: ISeriesApi<SeriesType> | undefined;
      if (ind.id === "high_yield") {
        ma = chart.addSeries(LineSeries, {
          color: "#f472b6",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          priceScaleId: scaleId,
          priceFormat: { type: "custom", formatter },
        });
      }

      // HP 장기추세 (FinJump DSTOA005001: 지수 + 분홍/점선 추세)
      let hpTrend: ISeriesApi<SeriesType> | undefined;
      let hpDev: ISeriesApi<SeriesType> | undefined;
      if (hpEnabled && INDEX_HP_IDS.has(ind.id)) {
        const isPrimaryHp = hpActiveIndices[0]?.id === ind.id;
        hpTrend = chart.addSeries(LineSeries, {
          // FinJump DSTOA005001 분홍 추세 — 첫 지수만 분홍, 나머지는 지표색 점선
          color: isPrimaryHp ? "#f472b6" : ind.color,
          lineWidth: isPrimaryHp ? 2 : 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          priceScaleId: scaleId,
          priceFormat: { type: "custom", formatter },
        });
        if (showHpPane) {
          hpDev = chart.addSeries(
            LineSeries,
            {
              color: ind.color,
              lineWidth: 2,
              priceLineVisible: false,
              priceScaleId: "right",
              priceFormat: {
                type: "custom",
                formatter: (v: number) => `${v.toFixed(1)}`,
              },
            },
            hpDevPaneIndex,
          );
          // 기준선 100 (추세 일치)
          if (hpActiveIndices[0]?.id === ind.id) {
            hpDev.createPriceLine({
              price: 100,
              color: "#64748b",
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
              title: "",
            });
          }
        }
      }

      seriesRef.current.set(ind.id, { main, ma, hpTrend, hpDev });
    });

    // 구성 직후 현재 데이터를 즉시 반영 (full로 MA/HP 계산 → display 구간만 표시)
    const fullPts = fullDataRef.current || [];
    const displayPts = chartDataRef.current || [];
    const dStart = displayStartRef.current;
    activeIndicators.forEach((ind) => {
      const series = seriesRef.current.get(ind.id);
      if (!series) return;
      const deviation = applySeriesData(ind, series, fullPts, dStart, normalized, hpEnabled);
      if (deviation) hpDevCache.set(ind.id, deviation);
    });

    setStatus("Ready");
    const last = displayPts[displayPts.length - 1];
    if (last) {
      setHoveredData({
        time: last.date,
        values: collectValuesFor(last, activeIndicators),
        hpDev: collectHpDevAt(last.time, hpDevCacheRef.current),
      });
    }

    setTimeout(() => scrollToLatest(), 50);
    return () => {
      // cleanup에서만 remove — effect 시작 시 재호출하면 disposed 차트 이중 제거로 크래시남
      chart.remove();
      if (chartRef.current === chart) chartRef.current = null;
      seriesRef.current.clear();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, normalized, isMobile, chartWidth, chartHeight, hpEnabled, displayStart]);

  /* 데이터 갱신 시 기존 시리즈에 반영 */
  useEffect(() => {
    if (formattedData.length === 0 || seriesRef.current.size === 0) return;
    const hpDevCache = hpDevCacheRef.current;
    hpDevCache.clear();
    activeIndicators.forEach((ind) => {
      const series = seriesRef.current.get(ind.id);
      if (!series) return;
      const deviation = applySeriesData(
        ind,
        series,
        fullFormattedData,
        displayStart,
        normalized,
        hpEnabled,
      );
      if (deviation) hpDevCache.set(ind.id, deviation);
    });

    const last = formattedData[formattedData.length - 1];
    if (last) {
      setHoveredData({
        time: last.date,
        values: collectValuesFor(last, activeIndicators),
        hpDev: collectHpDevAt(last.time, hpDevCache),
      });
    }

    setTimeout(() => scrollToLatest(), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formattedData, fullFormattedData, displayStart]);

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
      className={`relative flex flex-col w-full min-h-0 ${isMobile ? "h-[min(560px,calc(100dvh-10rem))]" : "h-[650px]"} bg-slate-900 overflow-hidden border border-slate-800 rounded-xl shadow-2xl`}
    >
      {/* Control bar — 지표는 wrap(3줄 등). 차트 높이는 남은 flex 영역으로 맞춤 */}
      <div className="px-3 py-1.5 md:px-4 md:py-2 border-b border-slate-800 bg-slate-800/40 flex flex-col gap-1.5 md:gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 shrink-0 rounded-full ${isLoading || isFetching ? "bg-blue-500 animate-pulse" : error ? "bg-red-500" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"}`}></div>
          <h3 className="font-bold text-slate-200 text-sm uppercase tracking-tighter truncate">
            Macro & Sentiment Analytics
          </h3>
        </div>

        {/* 지표 토글 — 줄바꿈 허용 (스크롤 없음) */}
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
          <div className="flex items-center gap-1 mr-1 flex-wrap" role="group" aria-label="Period">
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
            type="button"
            onClick={() => setHpEnabled((v) => !v)}
            className={`text-[9px] px-2 py-0.5 rounded border font-bold tracking-tighter uppercase transition-all ${
              hpEnabled
                ? "bg-pink-600 text-white border-pink-500"
                : "bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600"
            }`}
            title="S&P500/NDX/KOSPI에 HP 장기추세(τ)와 추세 대비 이탈(지수/추세×100) 표시 — FinJump DSTOA005001·DSTOA006001"
          >
            {hpEnabled ? "HP ON" : "HP OFF"}
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
        <div className="px-3 py-1 md:px-4 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-slate-300 shrink-0">
          <span className="text-slate-400 mr-1">{hoveredData.time}</span>
          {activeIndicators.map((ind) => {
            const v = hoveredData.values[ind.id];
            if (v == null) return null;
            const hp = hoveredData.hpDev?.[ind.id];
            return (
              <span key={ind.id} style={{ color: ind.color }} className="font-bold">
                {ind.label}: <span className="text-slate-100">{ind.raw(v)}</span>
                {hp != null && (
                  <span className="text-pink-300 font-normal ml-1">
                    (이탈 {hp.toFixed(1)})
                  </span>
                )}
              </span>
            );
          })}
          {normalized && <span className="text-purple-400 italic">(정규화: 기준일=100)</span>}
          {hpEnabled && activeIndicators.some((i) => INDEX_HP_IDS.has(i.id)) && (
            <span className="text-pink-400/80 italic">분홍선=HP추세 · 하단=이탈(100=추세)</span>
          )}
        </div>
      )}

      {/* Main chart area — flex-1로 남은 높이만 사용 (고정 520px 제거) */}
      <div data-scroll-area className="flex-1 min-h-0 overflow-hidden bg-slate-950 flex flex-col p-2 md:p-4 relative">
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

        <div className="relative flex-1 min-h-0 bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-inner">
          <div className="absolute top-2 left-3 z-20 pointer-events-none max-w-[90%]">
            <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest line-clamp-1">
              {normalized
                ? "Normalized (% change from start) — 공통 % 스케일"
                : hpEnabled
                  ? "다중 스케일 + HP/200MA 분홍점선 · 하단 이탈=(지수/추세)×100"
                  : "다중 스케일 오버레이 — HY Spread 200MA(분홍 점선)"}
            </span>
          </div>
          {/* 셸이 flex로 남은 높이를 채움 → ResizeObserver가 실제 h를 차트에 전달 */}
          <div ref={shellRef} className="absolute inset-0 w-full h-full">
            <div ref={hostRef} data-chart-id="macro" className="absolute inset-0" />
          </div>
        </div>
      </div>
    </div>
  );
};