export const DISPLAY_COLS = [
  "개인", "세력", "외국인", "기관계", "금융투자", "보험", "투신",
  "기타금융", "은행", "연기금", "사모", "기타법인", "기타외국인",
] as const;

export const TABLE_COLS = ["종가", "거래량", ...DISPLAY_COLS] as const;

export const DISPERSION_DEFAULT_VISIBLE = new Set([
  "세력", "외국인", "기관계", "개인",
  "금융투자", "연기금", "사모", "투신", "기타법인",
]);

/** stock_analyzer plotly 원본 색상 (charts.py) */
export const MA_COLORS: Record<string, string> = {
  종가: "#8aa8cf",
  "종가 20MA": "#3d7a37",
  oscillator: "purple",
  세력: "darkgoldenrod",
  외국인: "#d65c5c",
  기관계: "#3a9c3a",
  개인: "#2244cc",
};

export const MA_LINE_WIDTH = {
  세력: 3,
  외국인: 2,
  기관계: 2,
  개인: 3,
} as const satisfies Record<string, 1 | 2 | 3 | 4>;

export const DISPERSION_COLORS: Record<string, string> = {
  세력: "#b8860b",
  외국인: "#cc3333",
  기관계: "#2e8b2e",
  개인: "#2244cc",
  금융투자: "#e67e22",
  연기금: "#16a085",
  사모: "#8e44ad",
  투신: "#c2185b",
  기타법인: "#795548",
  보험: "#607d8b",
  기타금융: "#9e9d24",
  은행: "#00838f",
  기타외국인: "#a1887f",
};

export const NORM_COLORS: Record<string, string> = {
  세력: "#AF7817",
  외국인: "red",
  기관계: "green",
  개인: "blue",
};

export const PRICE_OVERLAY_COLOR = "rgba(40,40,40,0.25)";

export const SUM_PRESETS: { id: "1m" | "3m" | "6m" | "12m"; label: string }[] = [
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "12m", label: "12M" },
];

export const HIGHLIGHT_ROW_LABELS = new Set([
  "1주", "1달", "1분기", "1년",
  "현재보유량", "보유비중", "최대보유량", "지수선도", "분산추이",
]);

export const SUMMARY_ROW_LABELS = new Set([
  "현재보유량", "보유비중", "최대보유량", "지수선도", "분산추이",
]);

/** 원본 plotly 차트 높이 (charts.py) */
export const CHART_HEIGHTS = {
  maPrice: 256,
  maOsc: 128,
  maAccum: 256,
  dispersion: 520,
  norm: 520,
  periodBar: 420,
} as const;
