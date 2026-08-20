/**
 * Supertrend Indicator Implementation (Pine Script v4 Compatible)
 *
 * TradingView script reference:
 * - Periods = input(10, "ATR Period")
 * - src = hl2
 * - Multiplier = input(3.0, "ATR Multiplier")
 * - changeATR = input(true, "Change ATR Calculation Method ?")
 * - showsignals = input(true, "Show Buy/Sell Signals ?")
 * - highlighting = input(true, "Highlighter On/Off ?")
 */

export interface SupertrendConfig {
  atrPeriod: number;
  multiplier: number;
  changeATR: boolean;
  showSignals: boolean;
  highlighting: boolean;
}

export const DEFAULT_SUPERTREND_CONFIG: SupertrendConfig = {
  atrPeriod: 10,
  multiplier: 3.0,
  changeATR: true,
  showSignals: true,
  highlighting: true,
};

export interface SupertrendInputPoint {
  date: string;
  high: number;
  low: number;
  close: number;
}

export interface SupertrendResultPoint {
  time: string;
  value: number;
  trend: 1 | -1;
  up: number;
  dn: number;
  buySignal: boolean;
  sellSignal: boolean;
}

export interface SupertrendSeriesData {
  /** All points with supertrend values and metadata */
  points: SupertrendResultPoint[];
  /** Line data for uptrend segments (trend === 1) */
  upLine: { time: string; value: number }[];
  /** Line data for downtrend segments (trend === -1) */
  dnLine: { time: string; value: number }[];
  /** Buy signals */
  buySignals: { time: string; value: number }[];
  /** Sell signals */
  sellSignals: { time: string; value: number }[];
}

/**
 * Calculates Supertrend indicator matching Pine Script v4 behavior
 */
export function calculateSupertrend(
  data: SupertrendInputPoint[],
  config: Partial<SupertrendConfig> = {}
): SupertrendSeriesData {
  const mergedConfig: SupertrendConfig = {
    ...DEFAULT_SUPERTREND_CONFIG,
    ...config,
  };

  const { atrPeriod, multiplier, changeATR, showSignals } = mergedConfig;
  const n = data.length;

  if (n === 0) {
    return {
      points: [],
      upLine: [],
      dnLine: [],
      buySignals: [],
      sellSignals: [],
    };
  }

  // 1. Calculate True Range (TR)
  const tr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const high = data[i].high;
    const low = data[i].low;
    if (i === 0) {
      tr[i] = high - low;
    } else {
      const prevClose = data[i - 1].close;
      tr[i] = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
    }
  }

  // 2. Calculate ATR (Wilder's RMA if changeATR=true, else SMA)
  const atr: number[] = new Array(n);
  if (changeATR) {
    // Wilder's RMA (Pine Script ta.rma)
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (i < atrPeriod) {
        sum += tr[i];
        atr[i] = sum / (i + 1);
      } else {
        atr[i] = (atr[i - 1] * (atrPeriod - 1) + tr[i]) / atrPeriod;
      }
    }
  } else {
    // Simple Moving Average (SMA)
    let windowSum = 0;
    for (let i = 0; i < n; i++) {
      windowSum += tr[i];
      if (i >= atrPeriod) {
        windowSum -= tr[i - atrPeriod];
        atr[i] = windowSum / atrPeriod;
      } else {
        atr[i] = windowSum / (i + 1);
      }
    }
  }

  // 3. Calculate Trailing Bands & Trend Flip
  const points: SupertrendResultPoint[] = [];
  const upLine: { time: string; value: number }[] = [];
  const dnLine: { time: string; value: number }[] = [];
  const buySignals: { time: string; value: number }[] = [];
  const sellSignals: { time: string; value: number }[] = [];

  let prevUp = 0;
  let prevDn = 0;
  let prevTrend: 1 | -1 = 1;

  for (let i = 0; i < n; i++) {
    const time = data[i].date;
    const high = data[i].high;
    const low = data[i].low;
    const close = data[i].close;
    const src = (high + low) / 2.0;

    const basicUp = src - multiplier * atr[i];
    const basicDn = src + multiplier * atr[i];

    let up = basicUp;
    let dn = basicDn;
    let trend: 1 | -1 = 1;

    if (i === 0) {
      up = basicUp;
      dn = basicDn;
      trend = 1;
    } else {
      const prevClose = data[i - 1].close;
      const up1 = prevUp;
      const dn1 = prevDn;

      up = prevClose > up1 ? Math.max(basicUp, up1) : basicUp;
      dn = prevClose < dn1 ? Math.min(basicDn, dn1) : basicDn;

      if (prevTrend === -1 && close > dn1) {
        trend = 1;
      } else if (prevTrend === 1 && close < up1) {
        trend = -1;
      } else {
        trend = prevTrend;
      }
    }

    const buySignal = i > 0 && trend === 1 && prevTrend === -1;
    const sellSignal = i > 0 && trend === -1 && prevTrend === 1;
    const value = trend === 1 ? up : dn;

    const pt: SupertrendResultPoint = {
      time,
      value,
      trend,
      up,
      dn,
      buySignal,
      sellSignal,
    };
    points.push(pt);

    if (trend === 1) {
      upLine.push({ time, value });
    } else {
      dnLine.push({ time, value });
    }

    if (showSignals) {
      if (buySignal) {
        buySignals.push({ time, value: low });
      } else if (sellSignal) {
        sellSignals.push({ time, value: high });
      }
    }

    prevUp = up;
    prevDn = dn;
    prevTrend = trend;
  }

  return {
    points,
    upLine,
    dnLine,
    buySignals,
    sellSignals,
  };
}
