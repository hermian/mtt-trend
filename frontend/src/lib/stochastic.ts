export interface StochBar {
  time: string;
  high: number;
  low: number;
  close: number;
}

export interface StochPeriodConfig {
  kPeriod: number; // N
  kSmoothing: number; // M
  dSmoothing: number; // T
}

export interface StochPoint {
  time: string;
  k: number;
  d: number;
}

export interface MultiStochResult {
  short: StochPoint[]; // 5, 3, 3
  mid: StochPoint[];   // 10, 6, 6
  long: StochPoint[];  // 20, 12, 12
  shortSeries: { time: string; value: number }[];
  midSeries: { time: string; value: number }[];
  longSeries: { time: string; value: number }[];
}

/**
 * Calculates Slow Stochastic (%K, %D) for a given (N, M, T) config.
 * - Fast %K = (Close - LowestLow(N)) / (HighestHigh(N) - LowestLow(N)) * 100
 * - Slow %K = SMA(Fast %K, M)
 * - Slow %D = SMA(Slow %K, T)
 */
export function calculateStochasticSlow(
  bars: StochBar[],
  config: StochPeriodConfig
): StochPoint[] {
  if (!bars || bars.length === 0) return [];

  const { kPeriod, kSmoothing, dSmoothing } = config;
  const n = bars.length;

  // 1. Fast %K
  const fastK = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const startIdx = Math.max(0, i - kPeriod + 1);
    let lowestLow = bars[startIdx].low;
    let highestHigh = bars[startIdx].high;

    for (let j = startIdx + 1; j <= i; j++) {
      if (bars[j].low < lowestLow) lowestLow = bars[j].low;
      if (bars[j].high > highestHigh) highestHigh = bars[j].high;
    }

    const range = highestHigh - lowestLow;
    if (range > 1e-10) {
      fastK[i] = ((bars[i].close - lowestLow) / range) * 100;
    } else {
      fastK[i] = 50.0;
    }
  }

  // 2. Slow %K = SMA(Fast %K, M)
  const slowK = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const startIdx = Math.max(0, i - kSmoothing + 1);
    const count = i - startIdx + 1;
    let sum = 0;
    for (let j = startIdx; j <= i; j++) {
      sum += fastK[j];
    }
    slowK[i] = sum / count;
  }

  // 3. Slow %D = SMA(Slow %K, T)
  const result: StochPoint[] = new Array<StochPoint>(n);
  for (let i = 0; i < n; i++) {
    const startIdx = Math.max(0, i - dSmoothing + 1);
    const count = i - startIdx + 1;
    let sum = 0;
    for (let j = startIdx; j <= i; j++) {
      sum += slowK[j];
    }
    const slowD = sum / count;
    result[i] = {
      time: bars[i].time,
      k: slowK[i],
      d: slowD,
    };
  }

  return result;
}

export const STOCH_CONFIGS = {
  short: { kPeriod: 5, kSmoothing: 3, dSmoothing: 3 },
  mid: { kPeriod: 10, kSmoothing: 6, dSmoothing: 6 },
  long: { kPeriod: 20, kSmoothing: 12, dSmoothing: 12 },
} as const;

/**
 * Calculates 3 Stochastic Slow waves:
 * - Short: 5, 3, 3
 * - Mid: 10, 6, 6
 * - Long: 20, 12, 12
 */
export function calculateMultiStochasticSlow(bars: StochBar[]): MultiStochResult {
  const seenTimes = new Set<string>();
  const validBars: StochBar[] = [];

  for (const b of bars || []) {
    if (
      b.time &&
      b.high != null &&
      b.low != null &&
      b.close != null &&
      Number.isFinite(b.high) &&
      Number.isFinite(b.low) &&
      Number.isFinite(b.close) &&
      !seenTimes.has(b.time)
    ) {
      seenTimes.add(b.time);
      validBars.push(b);
    }
  }

  // Ensure chronological order
  validBars.sort((a, b) => (a.time < b.time ? -1 : 1));

  const short = calculateStochasticSlow(validBars, STOCH_CONFIGS.short);
  const mid = calculateStochasticSlow(validBars, STOCH_CONFIGS.mid);
  const long = calculateStochasticSlow(validBars, STOCH_CONFIGS.long);

  return {
    short,
    mid,
    long,
    shortSeries: short.map((p) => ({ time: p.time, value: p.k })),
    midSeries: mid.map((p) => ({ time: p.time, value: p.k })),
    longSeries: long.map((p) => ({ time: p.time, value: p.k })),
  };
}
