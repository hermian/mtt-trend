/**
 * ATR% Multiple from 50MA (ATR_M) Indicator Implementation
 * Reference: https://github.com/hermian/screener/issues/294
 * Note reference: https://note.com/oratnek_ill/n/nb94a38050088
 *
 * Formula:
 * - SMA50 = ta.sma(close, 50)
 * - ATR14 = ta.atr(14) (Wilder's RMA 14 of True Range)
 * - Disparity% = (Close - SMA50) / SMA50
 * - ATR% = ATR14 / Close
 * - ATR_M = Disparity% / ATR% = ((Close - SMA50) / SMA50) / (ATR14 / Close)
 *
 * Interpretation:
 * - 1 ~ 2x: 변동성 축소(수렴) 구간
 * - 2 ~ 4x: 추세 초입 확장 구간
 * - 7x 이상: 과열 (Overextended) 구간 (분할 익절 검토)
 * - 10x 이상: 극단적 클라이맥스/오버슈팅 구간 (강력 차익 실현 신호)
 */

export interface AtrMultipleInputPoint {
  time: string;
  high: number;
  low: number;
  close: number;
}

export interface AtrMultiplePoint {
  time: string;
  value: number;
  sma50: number;
  atr14: number;
  disparityPct: number;
  atrPct: number;
  label: string;
  color: string;
}

export interface AtrMultipleConfig {
  smaPeriod?: number; // 기본 50
  atrPeriod?: number; // 기본 14
}

export interface AtrMultipleResult {
  points: AtrMultiplePoint[];
  series: { time: string; value: number }[];
}

export function getAtrMultipleStatus(val: number): { label: string; color: string } {
  if (val >= 10) {
    return { label: "극단과열 (클라이맥스)", color: "#ef4444" };
  }
  if (val >= 7) {
    return { label: "과열 (분할익절)", color: "#f97316" };
  }
  if (val >= 4) {
    return { label: "추세확장", color: "#eab308" };
  }
  if (val >= 2) {
    return { label: "추세초입", color: "#22c55e" };
  }
  if (val >= 0) {
    return { label: "수렴/상승", color: "#38bdf8" };
  }
  return { label: "50MA하회", color: "#94a3b8" };
}

export function calculateAtrMultiple(
  data: AtrMultipleInputPoint[],
  config: AtrMultipleConfig = {}
): AtrMultipleResult {
  const smaPeriod = config.smaPeriod ?? 50;
  const atrPeriod = config.atrPeriod ?? 14;

  if (!data || data.length === 0) {
    return { points: [], series: [] };
  }

  // Filter valid points
  const validPoints = data.filter(
    (p) =>
      p &&
      p.time &&
      p.close != null &&
      Number.isFinite(p.close) &&
      p.high != null &&
      Number.isFinite(p.high) &&
      p.low != null &&
      Number.isFinite(p.low)
  );

  const n = validPoints.length;
  if (n < smaPeriod) {
    return { points: [], series: [] };
  }

  // 1. Calculate True Range (TR)
  const tr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const high = validPoints[i].high;
    const low = validPoints[i].low;
    if (i === 0) {
      tr[i] = high - low;
    } else {
      const prevClose = validPoints[i - 1].close;
      tr[i] = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
    }
  }

  // 2. Wilder's RMA for ATR(14)
  const atr: number[] = new Array(n);
  let sumTr = 0;
  for (let i = 0; i < n; i++) {
    if (i < atrPeriod) {
      sumTr += tr[i];
      atr[i] = sumTr / (i + 1);
    } else {
      atr[i] = (atr[i - 1] * (atrPeriod - 1) + tr[i]) / atrPeriod;
    }
  }

  // 3. SMA50
  const sma: (number | null)[] = new Array(n).fill(null);
  let windowSum = 0;
  for (let i = 0; i < n; i++) {
    windowSum += validPoints[i].close;
    if (i >= smaPeriod) {
      windowSum -= validPoints[i - smaPeriod].close;
    }
    if (i >= smaPeriod - 1) {
      sma[i] = windowSum / smaPeriod;
    }
  }

  // 4. ATR Multiple Calculation
  const points: AtrMultiplePoint[] = [];
  const series: { time: string; value: number }[] = [];

  for (let i = smaPeriod - 1; i < n; i++) {
    const currentSma = sma[i];
    const currentAtr = atr[i];
    const currentClose = validPoints[i].close;
    const time = validPoints[i].time;

    if (
      currentSma == null ||
      currentSma <= 0 ||
      currentAtr <= 0 ||
      currentClose <= 0
    ) {
      continue;
    }

    const disparity = (currentClose - currentSma) / currentSma;
    const atrPct = currentAtr / currentClose;
    const value = disparity / atrPct;

    if (!Number.isFinite(value)) continue;

    const status = getAtrMultipleStatus(value);
    const pt: AtrMultiplePoint = {
      time,
      value,
      sma50: currentSma,
      atr14: currentAtr,
      disparityPct: disparity * 100,
      atrPct: atrPct * 100,
      label: status.label,
      color: status.color,
    };

    points.push(pt);
    series.push({ time, value });
  }

  return { points, series };
}
