"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineSeries,
  IChartApi,
  ISeriesApi,
  SeriesType,
} from "lightweight-charts";
import { useMarketFlowData, useMarketFlowDates } from "@/hooks/useMarketFlowData";

interface MarketFlowChartProps {
  height?: number;
}

interface HoveredData {
  time: string;
  price?: number;
  /** 전일 종가 대비 변동률 (%) */
  changePct?: number | null;
  eminiNasdaqPrice?: number;
  /** E-mini Nasdaq 변동률 (%) */
  eminiNasdaqChangePct?: number | null;
  foreigner?: number;
  institution?: number;
  program?: number;
  individual?: number;
  future_foreigner?: number;
  isKosdaq?: boolean;
}

/** 전일 종가 대비 일중 변동률 (%) */
function calcChangePct(price: number | null | undefined, prevClose: number | null | undefined): number | null {
  if (price == null || prevClose == null || prevClose <= 0 || !Number.isFinite(price)) return null;
  return ((price - prevClose) / prevClose) * 100;
}

/** 오른쪽 Y축 라벨 폭 고정 — 지수/수급 pane의 plot·X축 폭을 맞춤 */
const RIGHT_SCALE_MIN_WIDTH = 88;

const INDEX_OPTIONS = [
  { id: "kospi", name: "KOSPI", color: "#38bdf8" },
  { id: "kospi200", name: "K200", color: "#eab308" },
  { id: "kosdaq", name: "KOSDAQ", color: "#10b981" },
  { id: "kq150", name: "K150", color: "#e879f9" },
] as const;

type IndexType = (typeof INDEX_OPTIONS)[number]["id"];

type SupplySeriesId = "foreigner" | "institution" | "program" | "individual" | "future";

const SUPPLY_LEGEND: ReadonlyArray<{
  id: SupplySeriesId;
  label: string;
  color: string;
  seriesIndex: number;
  /** true면 KOSPI/K200 전용 */
  kospiOnly: boolean;
}> = [
  { id: "foreigner", label: "외국인", color: "#ef4444", seriesIndex: 0, kospiOnly: false },
  { id: "institution", label: "기관", color: "#3b82f6", seriesIndex: 1, kospiOnly: false },
  { id: "program", label: "비차익", color: "#10b981", seriesIndex: 2, kospiOnly: true },
  { id: "individual", label: "개인", color: "#f59e0b", seriesIndex: 3, kospiOnly: false },
  { id: "future", label: "선물외인", color: "#e879f9", seriesIndex: 4, kospiOnly: true },
];

const DEFAULT_SUPPLY_VISIBLE: Record<SupplySeriesId, boolean> = {
  foreigner: true,
  institution: true,
  program: true,
  individual: true,
  future: true,
};

export const MarketFlowChart: React.FC<MarketFlowChartProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<Map<string, IChartApi>>(new Map());
  const seriesRef = useRef<Map<string, ISeriesApi<SeriesType>[]>>(new Map());
  const chartDataRef = useRef<any>(null);
  const selectedIndexRef = useRef<IndexType>("kospi");
  const isSyncingRef = useRef<boolean>(false);
  const [status, setStatus] = useState<string>("Initializing...");
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // 지수 단일 선택 상태 (기본값: KOSPI)
  const [selectedIndex, setSelectedIndex] = useState<IndexType>("kospi");
  // E-mini Nasdaq100 오버레이 표시 여부 (KOSPI/K200 선택 시 기본 true)
  const [nasdaqVisible, setNasdaqVisible] = useState<boolean>(true);
  // 수급 시리즈 범례 토글 (기본: 전부)
  const [visibleSupply, setVisibleSupply] = useState<Record<SupplySeriesId, boolean>>(DEFAULT_SUPPLY_VISIBLE);

  // 날짜 리스트 및 선택 날짜 상태
  const { data: dates } = useMarketFlowDates();
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  // 날짜 데이터 로드 시 기본값으로 가장 최근 날짜 설정
  useEffect(() => {
    if (dates && dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[dates.length - 1]);
    }
  }, [dates, selectedDate]);

  // 전일 종가 산출용: 선택일 직전 거래일 (없으면 선택일만 조회)
  const prevDate = useMemo(() => {
    if (!dates || !selectedDate) return undefined;
    const idx = dates.indexOf(selectedDate);
    return idx > 0 ? dates[idx - 1] : undefined;
  }, [dates, selectedDate]);

  const { data: chartData, isLoading, error } = useMarketFlowData(
    prevDate || selectedDate,
    selectedDate || undefined
  );

  // 지수별 DB 컬럼 매핑 헬퍼
  const getIndexPrice = (p: any, idx: IndexType) => {
    switch (idx) {
      case "kospi":
        return p.kospi_price;
      case "kospi200":
        return p.kospi200_price;
      case "kosdaq":
        return p.kosdaq_price;
      case "kq150":
        return p.kq150_price;
      default:
        return p.kospi_price;
    }
  };

  // 전일 종가 (지수별 + E-mini Nasdaq)
  const prevCloses = useMemo(() => {
    const empty = {
      kospi: null as number | null,
      kospi200: null as number | null,
      kosdaq: null as number | null,
      kq150: null as number | null,
      emini_nasdaq: null as number | null,
    };
    if (!chartData?.data || !prevDate) return empty;
    const prevRows = chartData.data.filter((p) => p.date === prevDate);
    if (prevRows.length === 0) return empty;
    const last = prevRows[prevRows.length - 1];
    return {
      kospi: last.kospi_price ?? null,
      kospi200: last.kospi200_price ?? null,
      kosdaq: last.kosdaq_price ?? null,
      kq150: last.kq150_price ?? null,
      emini_nasdaq: last.emini_nasdaq_price ?? null,
    };
  }, [chartData, prevDate]);

  const prevClosesRef = useRef(prevCloses);
  useEffect(() => {
    prevClosesRef.current = prevCloses;
  }, [prevCloses]);

  const buildHoveredData = (point: any, idx: IndexType): HoveredData => {
    const isKosdaq = idx === "kosdaq" || idx === "kq150";
    const price = getIndexPrice(point, idx) ?? undefined;
    const prevClose = prevClosesRef.current[idx];
    const eminiPrice = point.emini_nasdaq_price ?? undefined;
    const prevEmini = prevClosesRef.current.emini_nasdaq ?? point.firstEmini;
    return {
      time: point.displayTime,
      price,
      changePct: calcChangePct(price, prevClose),
      eminiNasdaqPrice: eminiPrice,
      eminiNasdaqChangePct: calcChangePct(eminiPrice, prevEmini),
      foreigner: isKosdaq ? point.kosdaq_foreigner_val ?? undefined : point.kospi_foreigner_val ?? undefined,
      institution: isKosdaq ? point.kosdaq_institution_val ?? undefined : point.kospi_institution_val ?? undefined,
      program: isKosdaq ? undefined : point.kospi_program_val ?? undefined,
      individual: isKosdaq ? point.kosdaq_individual_val ?? undefined : point.kospi_individual_val ?? undefined,
      future_foreigner: isKosdaq ? undefined : (point.future_foreigner_val ?? undefined),
      isKosdaq,
    };
  };

  // 날짜 내 첫 시점 데이터를 기준으로 0부터 시작하게 가공 (Zero-start) — 선택일만 차트에 사용
  const formattedData = useMemo(() => {
    if (!chartData || !chartData.data || !selectedDate) return [];

    const sorted = [...chartData.data]
      .filter((p) => p.date === selectedDate && p.time >= "09:00" && p.time <= "15:45")
      .sort((a, b) => {
        const timeA = `${a.date}T${a.time}:00`;
        const timeB = `${b.date}T${b.time}:00`;
        return timeA > timeB ? 1 : -1;
      });

    const dayFirstData: Record<string, {
      f: number; i: number; ind: number; p: number; ff: number;
      kq_f: number; kq_i: number; kq_ind: number;
      kospi?: number; kospi200?: number; kosdaq?: number; kq150?: number; emini?: number;
    }> = {};
    sorted.forEach(p => {
      if (!dayFirstData[p.date]) {
        dayFirstData[p.date] = {
          f: p.kospi_foreigner ?? 0,
          i: p.kospi_institution ?? 0,
          ind: p.kospi_individual ?? 0,
          p: p.kospi_program ?? 0,
          ff: p.future_foreigner ?? 0,
          kq_f: p.kosdaq_foreigner ?? 0,
          kq_i: p.kosdaq_institution ?? 0,
          kq_ind: p.kosdaq_individual ?? 0,
          kospi: p.kospi_price ?? undefined,
          kospi200: p.kospi200_price ?? undefined,
          kosdaq: p.kosdaq_price ?? undefined,
          kq150: p.kq150_price ?? undefined,
          emini: p.emini_nasdaq_price ?? undefined,
        };
      } else {
        if (dayFirstData[p.date].kospi == null && p.kospi_price != null && p.kospi_price > 0) {
          dayFirstData[p.date].kospi = p.kospi_price;
        }
        if (dayFirstData[p.date].kospi200 == null && p.kospi200_price != null && p.kospi200_price > 0) {
          dayFirstData[p.date].kospi200 = p.kospi200_price;
        }
        if (dayFirstData[p.date].kosdaq == null && p.kosdaq_price != null && p.kosdaq_price > 0) {
          dayFirstData[p.date].kosdaq = p.kosdaq_price;
        }
        if (dayFirstData[p.date].kq150 == null && p.kq150_price != null && p.kq150_price > 0) {
          dayFirstData[p.date].kq150 = p.kq150_price;
        }
        if (dayFirstData[p.date].emini == null && p.emini_nasdaq_price != null && p.emini_nasdaq_price > 0) {
          dayFirstData[p.date].emini = p.emini_nasdaq_price;
        }
      }
    });

    return sorted.map(p => {
      const dt = new Date(`${p.date}T${p.time}:00+09:00`);
      const first = dayFirstData[p.date];
      return {
        ...p,
        time: Math.floor(dt.getTime() / 1000) as any,
        displayTime: `${p.date} ${p.time}`,
        firstKospi: first?.kospi,
        firstKospi200: first?.kospi200,
        firstKosdaq: first?.kosdaq,
        firstKq150: first?.kq150,
        firstEmini: first?.emini,
        kospi_foreigner_val: (p.kospi_foreigner ?? 0) - first.f,
        kospi_institution_val: (p.kospi_institution ?? 0) - first.i,
        kospi_individual_val: (p.kospi_individual ?? 0) - first.ind,
        kospi_program_val: (p.kospi_program ?? 0) - first.p,
        future_foreigner_val: (p.future_foreigner ?? 0) - first.ff,
        kosdaq_foreigner_val: (p.kosdaq_foreigner ?? 0) - first.kq_f,
        kosdaq_institution_val: (p.kosdaq_institution ?? 0) - first.kq_i,
        kosdaq_individual_val: (p.kosdaq_individual ?? 0) - first.kq_ind,
      };
    });
  }, [chartData, selectedDate]);

  useEffect(() => {
    if (formattedData.length > 0) chartDataRef.current = formattedData;
  }, [formattedData]);

  // 최신 봉 기준으로 범례 초기값 설정 (마우스 이동 전에도 값 표시)
  useEffect(() => {
    if (formattedData.length === 0) {
      setHoveredData(null);
      return;
    }
    const latestPoint = formattedData[formattedData.length - 1];
    setHoveredData(buildHoveredData(latestPoint, selectedIndex));
  }, [formattedData, selectedIndex, prevCloses]);

  // X축 범위를 09:00 ~ 15:45로 고정
  const setChartVisibleRange = () => {
    if (formattedData.length > 0 && chartsRef.current.size > 0) {
      const dateStr = formattedData[0].date;
      const startSec = Math.floor(new Date(`${dateStr}T09:00:00+09:00`).getTime() / 1000);
      const endSec = Math.floor(new Date(`${dateStr}T15:45:00+09:00`).getTime() / 1000);

      setTimeout(() => {
        isSyncingRef.current = true;
        chartsRef.current.forEach(c => {
          c.timeScale().setVisibleRange({
            from: startSec as any,
            to: endSec as any,
          });
        });
        setTimeout(() => { isSyncingRef.current = false; }, 100);
      }, 100);
    }
  };

  // 차트 인스턴스 생성 — 데이터 갱신 시 재생성하지 않음 (폴링 시 깜빡임 방지)
  useEffect(() => {
    // 로딩 UI에는 chart DOM이 없으므로, isLoading이 끝난 뒤에만 생성
    if (isLoading || !containerRef.current || !selectedDate) return;
    setStatus("Building Charts...");
    const cleanup = () => {
      chartsRef.current.forEach(c => c.remove());
      chartsRef.current.clear();
      seriesRef.current.clear();
    };
    cleanup();

    try {
      const scrollArea = containerRef.current.querySelector("[data-scroll-area]") as HTMLElement;
      if (!scrollArea) return;

      const panels = [
        { id: "prices", name: "시장 지수", height: isMobile ? 220 : 320 },
        { id: "supply", name: "수급 트렌드 (억 원)", height: isMobile ? 280 : 380 },
      ];

      panels.forEach((panel) => {
        const el = scrollArea.querySelector(`[data-chart-id="${panel.id}"]`) as HTMLElement;
        if (!el) return;
        el.style.height = `${panel.height}px`;

        const chart = createChart(el, {
          autoSize: true,
          height: panel.height,
          layout: {
            background: { type: ColorType.Solid, color: "#0f172a" },
            textColor: "#cbd5e1",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          },
          grid: {
            vertLines: { color: "#1e293b" },
            horzLines: { color: "#1e293b" },
          },
          timeScale: {
            visible: true,
            borderColor: "#334155",
            rightOffset: 10,
            barSpacing: 6,
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
            tickMarkFormatter: (time: number) => {
              const dt = new Date(time * 1000);
              const formatter = new Intl.DateTimeFormat("ko-KR", {
                timeZone: "Asia/Seoul",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
              });
              return formatter.format(dt);
            }
          },
          rightPriceScale: {
            borderColor: "#334155",
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true,
            visible: true,
            minimumWidth: RIGHT_SCALE_MIN_WIDTH,
          },
          leftPriceScale: {
            visible: false,
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              labelVisible: true,
              color: "#64748b",
              width: 1,
              style: 1,
            },
            horzLine: {
              color: "#64748b",
              width: 1,
              style: 1,
            },
          },
        });

        const activeSeries: ISeriesApi<SeriesType>[] = [];

        if (panel.id === "prices") {
          const opt = INDEX_OPTIONS.find(o => o.id === selectedIndex);
          // 0. Primary Index Series
          const series = chart.addSeries(LineSeries, {
            color: opt?.color || "#cbd5e1",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
          });
          activeSeries.push(series);

          // 1. E-mini Nasdaq 100 Series (동일한 right priceScale 공유하여 Y축 줌/슬라이딩 완벽 동기화)
          const nasdaqSeries = chart.addSeries(LineSeries, {
            color: "#c084fc",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
            crosshairMarkerVisible: true,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          activeSeries.push(nasdaqSeries);
        } else if (panel.id === "supply") {
          chart.applyOptions({
            rightPriceScale: {
              autoScale: true,
              scaleMargins: { top: 0.05, bottom: 0.05 },
              minimumWidth: RIGHT_SCALE_MIN_WIDTH,
            },
          });

          // 0. 외국인 (KOSPI/KOSDAQ)
          const foreigner = chart.addSeries(LineSeries, {
            color: "#ef4444",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 0, minMove: 1 },
          });
          foreigner.createPriceLine({
            price: 0,
            color: "#475569",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: "",
          });
          activeSeries.push(foreigner);

          // 1. 기관 (KOSPI/KOSDAQ)
          const institution = chart.addSeries(LineSeries, {
            color: "#3b82f6",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 0, minMove: 1 },
          });
          activeSeries.push(institution);

          // 2. 비차익 (KOSPI 전용)
          const program = chart.addSeries(LineSeries, {
            color: "#10b981",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 0, minMove: 1 },
          });
          activeSeries.push(program);

          // 3. 개인 (KOSPI/KOSDAQ)
          const individual = chart.addSeries(LineSeries, {
            color: "#f59e0b",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 0, minMove: 1 },
          });
          activeSeries.push(individual);

          // 4. 외국인 선물 (KOSPI 전용)
          const futureForeigner = chart.addSeries(LineSeries, {
            color: "#e879f9",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 0, minMove: 1 },
          });
          activeSeries.push(futureForeigner);
        }

        chartsRef.current.set(panel.id, chart);
        seriesRef.current.set(panel.id, activeSeries);

        // Crosshair move handling
        chart.subscribeCrosshairMove((param) => {
          chartsRef.current.forEach((c) => {
            if (c !== chart) {
              if (!param.time || (param.point && param.point.x < 0)) {
                c.setCrosshairPosition(null as any, null as any, null as any);
              } else {
                c.setCrosshairPosition(null as any, param.time as any, null as any);
              }
            }
          });

          const idx = selectedIndexRef.current;
          if (!param.time || !param.point || param.point.x < 0) {
            const latestPoint = chartDataRef.current?.[chartDataRef.current.length - 1];
            if (latestPoint) {
              setHoveredData(buildHoveredData(latestPoint, idx));
            } else {
              setHoveredData(null);
            }
          } else {
            const currentPoint = chartDataRef.current?.find((p: any) => p.time === param.time);
            if (currentPoint) {
              setHoveredData(buildHoveredData(currentPoint, idx));
            }
          }
        });

        // Visible logical range sync
        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncingRef.current || !range) return;
          isSyncingRef.current = true;
          chartsRef.current.forEach(c => {
            if (c !== chart) c.timeScale().setVisibleLogicalRange(range);
          });
          setTimeout(() => { isSyncingRef.current = false; }, 10);
        });
      });

      setStatus("Active");
      return () => {
        cleanup();
      };
    } catch (e: any) {
      console.error("Error drawing charts:", e);
      setStatus(`Error: ${e.message}`);
    }
  }, [isMobile, selectedIndex, selectedDate, isLoading]);

  // 데이터 바인딩
  useEffect(() => {
    if (formattedData.length === 0 || status !== "Active") return;

    const pricesSeries = seriesRef.current.get("prices");
    if (pricesSeries && pricesSeries.length >= 2) {
      const isKospiOrK200 = selectedIndex === "kospi" || selectedIndex === "kospi200";
      const limitSec = Math.floor(new Date(`${selectedDate}T15:30:00+09:00`).getTime() / 1000);
      const filtered = formattedData
        .filter(d => {
          const price = getIndexPrice(d, selectedIndex);
          return price != null && price > 0 && d.time <= limitSec;
        })
        .map(d => ({ time: d.time, value: getIndexPrice(d, selectedIndex)! }));

      if (filtered.length > 0) {
        const lastPrice = filtered[filtered.length - 1].value;
        const targetTimes = ["15:35", "15:40", "15:45"];

        targetTimes.forEach(tStr => {
          const tSec = Math.floor(new Date(`${selectedDate}T${tStr}:00+09:00`).getTime() / 1000);
          if (formattedData.some(d => d.time === tSec)) {
            filtered.push({ time: tSec, value: lastPrice });
          }
        });
      }

      pricesSeries[0].setData(filtered);

      // E-mini Nasdaq 100 series binding (KOSPI/K200 일중 진폭에 맞춰 Min-Max 진폭 정규화)
      if (isKospiOrK200) {
        const validIndexPoints = filtered.map(d => d.value);
        const kMin = validIndexPoints.length > 0 ? Math.min(...validIndexPoints) : 0;
        const kMax = validIndexPoints.length > 0 ? Math.max(...validIndexPoints) : 0;
        const kRange = kMax - kMin;

        const rawEminiPoints = formattedData
          .filter(d => d.emini_nasdaq_price != null && d.emini_nasdaq_price > 0 && d.time <= limitSec)
          .map(d => ({ time: d.time, price: d.emini_nasdaq_price! }));

        const ePrices = rawEminiPoints.map(d => d.price);
        const eMin = ePrices.length > 0 ? Math.min(...ePrices) : 0;
        const eMax = ePrices.length > 0 ? Math.max(...ePrices) : 0;
        const eRange = eMax - eMin;

        const nasdaqData = rawEminiPoints.map(d => {
          let val = d.price;
          if (kRange > 0 && eRange > 0) {
            val = kMin + ((d.price - eMin) / eRange) * kRange;
          } else if (validIndexPoints.length > 0) {
            val = validIndexPoints[0];
          }
          return { time: d.time, value: val };
        });

        if (nasdaqData.length > 0) {
          const lastNasdaqPrice = nasdaqData[nasdaqData.length - 1].value;
          const targetTimes = ["15:35", "15:40", "15:45"];

          targetTimes.forEach(tStr => {
            const tSec = Math.floor(new Date(`${selectedDate}T${tStr}:00+09:00`).getTime() / 1000);
            if (formattedData.some(d => d.time === tSec)) {
              nasdaqData.push({ time: tSec, value: lastNasdaqPrice });
            }
          });
        }

        pricesSeries[1].setData(nasdaqData);
        pricesSeries[1].applyOptions({ visible: nasdaqVisible });
      } else {
        pricesSeries[1].setData([]);
        pricesSeries[1].applyOptions({ visible: false });
      }
    }

    const supplySeries = seriesRef.current.get("supply");
    if (supplySeries && supplySeries.length >= 5) {
      const isKosdaq = selectedIndex === "kosdaq" || selectedIndex === "kq150";
      supplySeries[0].setData(formattedData.map(d => ({
        time: d.time,
        value: isKosdaq ? (d.kosdaq_foreigner_val ?? 0) : (d.kospi_foreigner_val ?? 0)
      })));
      supplySeries[1].setData(formattedData.map(d => ({
        time: d.time,
        value: isKosdaq ? (d.kosdaq_institution_val ?? 0) : (d.kospi_institution_val ?? 0)
      })));
      // 비차익 — KOSPI/K200만
      if (isKosdaq) {
        supplySeries[2].setData([]);
      } else {
        supplySeries[2].setData(formattedData.map(d => ({
          time: d.time,
          value: d.kospi_program_val ?? 0
        })));
      }
      // 개인 — 전 시장
      supplySeries[3].setData(formattedData.map(d => ({
        time: d.time,
        value: isKosdaq ? (d.kosdaq_individual_val ?? 0) : (d.kospi_individual_val ?? 0)
      })));
      // 선물외인 — KOSPI/K200만
      if (isKosdaq) {
        supplySeries[4].setData([]);
      } else {
        supplySeries[4].setData(formattedData.map(d => ({
          time: d.time,
          value: d.future_foreigner_val ?? 0
        })));
      }
      // 시장 가용성 × 범례 토글
      SUPPLY_LEGEND.forEach((item) => {
        const marketOk = !isKosdaq || !item.kospiOnly;
        supplySeries[item.seriesIndex].applyOptions({
          visible: marketOk && visibleSupply[item.id],
        });
      });
    }

    setChartVisibleRange();

    // 오른쪽 Y축 실제 폭을 측정해 두 pane의 plot/X축 폭을 맞춤
    requestAnimationFrame(() => {
      const pricesChart = chartsRef.current.get("prices");
      const supplyChart = chartsRef.current.get("supply");
      if (!pricesChart || !supplyChart) return;
      const w = Math.max(
        RIGHT_SCALE_MIN_WIDTH,
        pricesChart.priceScale("right").width(),
        supplyChart.priceScale("right").width(),
      );
      pricesChart.priceScale("right").applyOptions({ minimumWidth: w });
      supplyChart.priceScale("right").applyOptions({ minimumWidth: w });
    });
    // visibleSupply는 토글 핸들러에서 즉시 반영; 데이터/시장 변경 시에만 재바인딩
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formattedData, status, selectedIndex, selectedDate]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center bg-slate-900 text-slate-400">
        <span className="animate-pulse">로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center bg-slate-900 text-red-400">
        오류: {(error as any).message || "데이터를 불러오는 데 실패했습니다."}
      </div>
    );
  }

  const fmt = (v: number | undefined, unit = "억") => {
    if (v == null) return "-";
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toLocaleString()}${unit}`;
  };

  // 날짜 좌우 이동 헬퍼
  const handlePrevDay = () => {
    if (!dates || dates.length === 0) return;
    const currIdx = dates.indexOf(selectedDate);
    if (currIdx > 0) {
      setSelectedDate(dates[currIdx - 1]);
    }
  };

  const handleNextDay = () => {
    if (!dates || dates.length === 0) return;
    const currIdx = dates.indexOf(selectedDate);
    if (currIdx >= 0 && currIdx < dates.length - 1) {
      setSelectedDate(dates[currIdx + 1]);
    }
  };

  const isFirstDay = dates ? dates.indexOf(selectedDate) === 0 : true;
  const isLastDay = dates ? dates.indexOf(selectedDate) === dates.length - 1 : true;
  const selectedOpt = INDEX_OPTIONS.find(o => o.id === selectedIndex);
  const isKosdaqSelection = selectedIndex === "kosdaq" || selectedIndex === "kq150";

  const toggleNasdaqSeries = () => {
    setNasdaqVisible((prev) => {
      const next = !prev;
      const pricesSeries = seriesRef.current.get("prices");
      if (pricesSeries && pricesSeries.length >= 2) {
        const isKospiOrK200 = selectedIndex === "kospi" || selectedIndex === "kospi200";
        pricesSeries[1].applyOptions({ visible: isKospiOrK200 && next });
      }
      return next;
    });
  };

  const toggleSupplySeries = (id: SupplySeriesId) => {
    setVisibleSupply((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const series = seriesRef.current.get("supply");
      const item = SUPPLY_LEGEND.find((l) => l.id === id);
      if (series && item) {
        const marketOk = !isKosdaqSelection || !item.kospiOnly;
        series[item.seriesIndex].applyOptions({ visible: marketOk && next[id] });
      }
      return next;
    });
  };

  const supplyLegendItems = SUPPLY_LEGEND.filter(
    (item) => !isKosdaqSelection || !item.kospiOnly
  );

  return (
    <div ref={containerRef} className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
      {/* Chart Header / Date Selector & Index Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-slate-100">시장 지수 & 수급 트렌드</h2>
          <p className="text-xs text-slate-400">코스피/코스닥 지수 및 메이저 수급 추이 (5분봉)</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Index single-select options */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800">
            {INDEX_OPTIONS.map((opt) => {
              const active = selectedIndex === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedIndex(opt.id)}
                  className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  style={active ? { backgroundColor: opt.color } : {}}
                >
                  {opt.name}
                </button>
              );
            })}
          </div>

          {/* Date Selector Navigation */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded border border-slate-800">
            <button
              onClick={handlePrevDay}
              disabled={isFirstDay}
              className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              ←
            </button>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
            >
              {dates?.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button
              onClick={handleNextDay}
              disabled={isLastDay}
              className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Hover Info Board */}
      <div className={`grid grid-cols-2 gap-4 rounded-lg bg-slate-900/50 p-3 sm:grid-cols-3 ${isKosdaqSelection ? "md:grid-cols-5" : "md:grid-cols-8"} text-xs border border-slate-800/40`}>
        <div className="flex flex-col">
          <span className="text-slate-400 font-medium">시간</span>
          <span className="font-semibold text-slate-200">{hoveredData?.time || "-"}</span>
        </div>

        <div className="flex flex-col" style={{ color: selectedOpt?.color }}>
          <span className="font-medium opacity-90">{selectedOpt?.name}</span>
          <span className="font-semibold text-slate-100">
            {hoveredData?.price != null ? hoveredData.price.toFixed(1) : "-"}
          </span>
          {hoveredData?.changePct != null ? (
            <span
              className={`text-[11px] font-bold ${
                hoveredData.changePct > 0
                  ? "text-red-400"
                  : hoveredData.changePct < 0
                    ? "text-blue-400"
                    : "text-slate-400"
              }`}
            >
              {hoveredData.changePct > 0 ? "+" : ""}{hoveredData.changePct.toFixed(2)}%
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">-</span>
          )}
        </div>

        {!isKosdaqSelection && (
          <div className="flex flex-col text-purple-400">
            <span className="font-medium opacity-90">E-mini NQ</span>
            <span className="font-semibold text-slate-100">
              {hoveredData?.eminiNasdaqPrice != null
                ? hoveredData.eminiNasdaqPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                : "-"}
            </span>
            {hoveredData?.eminiNasdaqChangePct != null ? (
              <span
                className={`text-[11px] font-bold ${
                  hoveredData.eminiNasdaqChangePct > 0
                    ? "text-red-400"
                    : hoveredData.eminiNasdaqChangePct < 0
                      ? "text-blue-400"
                      : "text-slate-400"
                }`}
              >
                {hoveredData.eminiNasdaqChangePct > 0 ? "+" : ""}{hoveredData.eminiNasdaqChangePct.toFixed(2)}%
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">-</span>
            )}
          </div>
        )}

        <div className="flex flex-col">
          <span className="text-red-400 font-medium">외국인</span>
          <span className="font-semibold text-red-400">
            {fmt(hoveredData?.foreigner)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-blue-400 font-medium">기관</span>
          <span className="font-semibold text-blue-400">
            {fmt(hoveredData?.institution)}
          </span>
        </div>
        {!hoveredData?.isKosdaq && (
          <div className="flex flex-col">
            <span className="text-emerald-400 font-medium">비차익</span>
            <span className="font-semibold text-emerald-400">
              {fmt(hoveredData?.program)}
            </span>
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-amber-400 font-medium">개인</span>
          <span className="font-semibold text-amber-400">
            {fmt(hoveredData?.individual)}
          </span>
        </div>
        {!hoveredData?.isKosdaq && (
          <div className="flex flex-col">
            <span className="text-fuchsia-400 font-medium">선물외인</span>
            <span className="font-semibold text-fuchsia-400">
              {fmt(hoveredData?.future_foreigner)}
            </span>
          </div>
        )}
      </div>

      {/* Chart container area */}
      <div data-scroll-area className="flex flex-col gap-4">
        <div className="relative">
          <div className="absolute left-2 top-2 z-10 flex items-center gap-3 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-800">
            <span style={{ color: selectedOpt?.color }}>
              ● {selectedOpt?.name}
            </span>
            {!isKosdaqSelection && (
              <button
                type="button"
                onClick={toggleNasdaqSeries}
                title={nasdaqVisible ? "E-mini NQ 숨기기" : "E-mini NQ 표시"}
                aria-pressed={nasdaqVisible}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-opacity hover:bg-slate-800/80 ${
                  nasdaqVisible ? "opacity-100" : "opacity-35 line-through"
                }`}
                style={{ color: "#c084fc" }}
              >
                ● E-mini NQ
              </button>
            )}
          </div>
          <div data-chart-id="prices" className="w-full rounded-lg overflow-hidden border border-slate-900" />
        </div>
        <div className="relative">
          <div
            className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-800"
            role="group"
            aria-label="수급 시리즈 토글"
          >
            {supplyLegendItems.map((item) => {
              const on = visibleSupply[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSupplySeries(item.id)}
                  title={on ? `${item.label} 숨기기` : `${item.label} 표시`}
                  aria-pressed={on}
                  className={`rounded px-1.5 py-0.5 transition-opacity hover:bg-slate-800/80 ${
                    on ? "opacity-100" : "opacity-35 line-through"
                  }`}
                  style={{ color: item.color }}
                >
                  ● {item.label}
                </button>
              );
            })}
            <span className="text-slate-500 ml-1">(억 원)</span>
          </div>
          <div data-chart-id="supply" className="w-full rounded-lg overflow-hidden border border-slate-900" />
        </div>
      </div>
    </div>
  );
};
