export interface MacdPoint {
  time: string;
  macd: number;
  signal: number;
  histogram: number;
  color: string;
}

export interface MacdConfig {
  fastPeriod?: number; // 기본 12
  slowPeriod?: number; // 기본 26
  signalPeriod?: number; // 기본 9
}

export interface MacdResult {
  points: MacdPoint[];
  macdSeries: { time: string; value: number }[];
  signalSeries: { time: string; value: number }[];
  histogramSeries: { time: string; value: number; color: string }[];
}

/**
 * Calculates MACD (Fast EMA - Slow EMA), Signal Line (EMA of MACD), and 4-color Histogram.
 *
 * Histogram Color Rules:
 * - Positive (>= 0): Green (#22c55e), or Gray (#9ca3af) if smaller than previous bar
 * - Negative (< 0): Red (#ef4444), or Pink (#f472b6) if smaller magnitude (shrinking) than previous bar
 */
export function calculateMacd(
  rawPoints: { time: string; close: number }[],
  config: MacdConfig = {}
): MacdResult {
  const fastPeriod = config.fastPeriod ?? 12;
  const slowPeriod = config.slowPeriod ?? 26;
  const signalPeriod = config.signalPeriod ?? 9;

  if (!rawPoints || rawPoints.length === 0) {
    return { points: [], macdSeries: [], signalSeries: [], histogramSeries: [] };
  }

  // Filter valid items
  const validPoints = rawPoints.filter(
    (p) => p.time && p.close != null && Number.isFinite(p.close)
  );

  if (validPoints.length === 0) {
    return { points: [], macdSeries: [], signalSeries: [], histogramSeries: [] };
  }

  const n = validPoints.length;
  const alphaFast = 2 / (fastPeriod + 1);
  const alphaSlow = 2 / (slowPeriod + 1);
  const alphaSignal = 2 / (signalPeriod + 1);

  // 1. Fast EMA & Slow EMA
  const emaFast = new Array<number>(n);
  const emaSlow = new Array<number>(n);
  const macdValues = new Array<number>(n);

  emaFast[0] = validPoints[0].close;
  emaSlow[0] = validPoints[0].close;
  macdValues[0] = 0; // fast - slow initially 0

  for (let i = 1; i < n; i++) {
    const c = validPoints[i].close;
    emaFast[i] = c * alphaFast + emaFast[i - 1] * (1 - alphaFast);
    emaSlow[i] = c * alphaSlow + emaSlow[i - 1] * (1 - alphaSlow);
    macdValues[i] = emaFast[i] - emaSlow[i];
  }

  // 2. Signal Line (EMA of MACD)
  const signalValues = new Array<number>(n);
  signalValues[0] = macdValues[0];

  for (let i = 1; i < n; i++) {
    signalValues[i] = macdValues[i] * alphaSignal + signalValues[i - 1] * (1 - alphaSignal);
  }

  // 3. Histogram & Colors
  const points: MacdPoint[] = [];
  const macdSeries: { time: string; value: number }[] = [];
  const signalSeries: { time: string; value: number }[] = [];
  const histogramSeries: { time: string; value: number; color: string }[] = [];

  for (let i = 0; i < n; i++) {
    const time = validPoints[i].time;
    const macd = macdValues[i];
    const signal = signalValues[i];
    const hist = macd - signal;
    const prevHist = i > 0 ? points[i - 1].histogram : null;

    let color: string;
    if (hist >= 0) {
      // +일 때: 이전보다 작으면 회색, 크거나 같으면 녹색
      if (prevHist !== null && prevHist >= 0 && hist < prevHist) {
        color = "#9ca3af"; // 회색
      } else {
        color = "#22c55e"; // 녹색
      }
    } else {
      // -일 때: 이전보다 작으면(음수 막대 크기가 줄어듦) 분홍, 그렇지 않으면 빨강
      if (prevHist !== null && prevHist < 0 && hist > prevHist) {
        color = "#f472b6"; // 분홍
      } else {
        color = "#ef4444"; // 빨강
      }
    }

    const pt: MacdPoint = { time, macd, signal, histogram: hist, color };
    points.push(pt);
    macdSeries.push({ time, value: macd });
    signalSeries.push({ time, value: signal });
    histogramSeries.push({ time, value: hist, color });
  }

  return { points, macdSeries, signalSeries, histogramSeries };
}
