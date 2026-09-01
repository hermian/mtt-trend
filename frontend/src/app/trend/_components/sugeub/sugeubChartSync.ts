import type { IChartApi } from "lightweight-charts";
import {
  DEFAULT_SUGEB_RANGE,
  logicalRangeForPreset,
  type SugeubRangePreset,
} from "./sugeubChartHelpers";

/** 다패널 차트 오른쪽 Y축 눈금 폭 통일 (플롯 영역 정렬) */
export function syncRightPriceScaleWidths(charts: IChartApi[]): void {
  let maxW = 72;
  charts.forEach((c) => {
    try {
      const w = c.priceScale("right").width();
      if (w > maxW) maxW = w;
    } catch {
      /* ignore */
    }
  });
  charts.forEach((c) => {
    try {
      c.priceScale("right").applyOptions({ minimumWidth: maxW });
    } catch {
      /* ignore */
    }
  });
}

/** TimeScale + crosshair + wheel 줌/팬을 패널 간 동기화 */
export function linkSugeubCharts(
  charts: IChartApi[],
  container: HTMLElement,
  primarySeriesPerChart: Array<{ chart: IChartApi; series: Parameters<IChartApi["setCrosshairPosition"]>[2] }>,
  seriesLength: number,
  rangePreset: SugeubRangePreset = DEFAULT_SUGEB_RANGE
): () => void {
  const isSyncing = { current: false };

  charts.forEach((chart, idx) => {
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return;
      try {
        chart.priceScale("right").applyOptions({ autoScale: true });
      } catch {
        /* ignore */
      }
      if (isSyncing.current) return;
      isSyncing.current = true;
      charts.forEach((other, oi) => {
        if (oi === idx) return;
        try {
          other.timeScale().setVisibleLogicalRange(range);
          other.priceScale("right").applyOptions({ autoScale: true });
        } catch {
          /* ignore */
        }
      });
      syncRightPriceScaleWidths(charts);
      isSyncing.current = false;
    });

    chart.subscribeCrosshairMove((param) => {
      if (isSyncing.current) return;
      isSyncing.current = true;
      charts.forEach((other, oi) => {
        if (oi === idx) return;
        try {
          if (param.time && primarySeriesPerChart[oi]?.series) {
            other.setCrosshairPosition(NaN, param.time, primarySeriesPerChart[oi].series);
          } else {
            other.clearCrosshairPosition();
          }
        } catch {
          /* ignore */
        }
      });
      isSyncing.current = false;
    });
  });

  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) return;
    e.preventDefault();
    const first = charts[0];
    if (!first) return;
    const currentRange = first.timeScale().getVisibleLogicalRange();
    if (!currentRange) return;

    if (e.ctrlKey || e.metaKey || e.altKey) {
      const delta = e.deltaY;
      const zoomFactor = delta > 0 ? 1.15 : 0.85;
      const length = currentRange.to - currentRange.from;
      const newLength = Math.max(10, Math.min(10000, length * zoomFactor));
      const diff = newLength - length;
      const rect = container.getBoundingClientRect();
      const cursorRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newFrom = currentRange.from - diff * cursorRatio;
      const newTo = currentRange.to + diff * (1 - cursorRatio);
      isSyncing.current = true;
      charts.forEach((c) => {
        try {
          c.timeScale().setVisibleLogicalRange({ from: newFrom, to: newTo });
          c.priceScale("right").applyOptions({ autoScale: true });
        } catch {
          /* ignore */
        }
      });
      syncRightPriceScaleWidths(charts);
      isSyncing.current = false;
    } else if (e.shiftKey) {
      const length = currentRange.to - currentRange.from;
      const shiftAmount = (e.deltaY || e.deltaX) * (length / 600);
      const newFrom = currentRange.from + shiftAmount;
      const newTo = currentRange.to + shiftAmount;
      isSyncing.current = true;
      charts.forEach((c) => {
        try {
          c.timeScale().setVisibleLogicalRange({ from: newFrom, to: newTo });
          c.priceScale("right").applyOptions({ autoScale: true });
        } catch {
          /* ignore */
        }
      });
      syncRightPriceScaleWidths(charts);
      isSyncing.current = false;
    }
  };

  container.addEventListener("wheel", onWheel, { passive: false });

  const applyPreset = (preset: SugeubRangePreset) => {
    const range = logicalRangeForPreset(seriesLength, preset);
    isSyncing.current = true;
    charts.forEach((c) => {
      try {
        c.timeScale().setVisibleLogicalRange(range);
      } catch {
        /* ignore */
      }
    });
    isSyncing.current = false;
    syncRightPriceScaleWidths(charts);
  };

  applyPreset(rangePreset);

  return () => {
    container.removeEventListener("wheel", onWheel);
  };
}

export function applyRangeToCharts(
  charts: IChartApi[],
  seriesLength: number,
  preset: SugeubRangePreset
): void {
  const range = logicalRangeForPreset(seriesLength, preset);
  charts.forEach((c) => {
    try {
      c.timeScale().setVisibleLogicalRange(range);
      try {
        c.priceScale("right").applyOptions({ autoScale: true });
      } catch {
        /* ignore */
      }
      try {
        c.priceScale("close").applyOptions({ autoScale: true });
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  });
  syncRightPriceScaleWidths(charts);
}
