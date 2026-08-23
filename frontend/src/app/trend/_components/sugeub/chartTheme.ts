import { ColorType, CrosshairMode, LineStyle } from "lightweight-charts";

/** stock_analyzer plotly_white 테마 (원본 종목분석기) */
export const SUGEB_CHART_LAYOUT = {
  background: { type: ColorType.Solid, color: "#ffffff" },
  textColor: "#333333",
  fontSize: 11,
} as const;

export const SUGEB_GRID = {
  vertLines: { color: "#e5e7eb", style: LineStyle.Solid },
  horzLines: { color: "#e5e7eb", style: LineStyle.Solid },
} as const;

export const SUGEB_CROSSHAIR = {
  mode: CrosshairMode.Normal,
  vertLine: {
    color: "rgba(107, 114, 128, 0.5)",
    width: 1 as const,
    style: LineStyle.Dashed,
    labelBackgroundColor: "#f3f4f6",
  },
  horzLine: {
    color: "rgba(107, 114, 128, 0.5)",
    width: 1 as const,
    style: LineStyle.Dashed,
    labelBackgroundColor: "#f3f4f6",
  },
};

export function createSugeubChartOptions(width: number, height: number) {
  return {
    width,
    height,
    layout: SUGEB_CHART_LAYOUT,
    grid: SUGEB_GRID,
    rightPriceScale: {
      borderColor: "#d1d5db",
      autoScale: true,
      alignLabels: true,
      minimumWidth: 72,
    },
    leftPriceScale: { visible: false },
    timeScale: {
      borderColor: "#d1d5db",
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 5,
      barSpacing: 6,
      fixLeftEdge: false,
      fixRightEdge: false,
    },
    crosshair: SUGEB_CROSSHAIR,
  };
}
