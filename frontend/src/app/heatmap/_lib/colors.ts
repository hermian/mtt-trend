/**
 * 한국 주식 관례 색상: 상승=빨강, 하락=파랑.
 * 중립 구간(±neutral)은 회색, 바깥 구간은 데이터 min/max 까지 3등분 강도.
 * (easyinvesting.app 히트맵 방식)
 */

import type { HeatmapPeriod } from "@/lib/api";

/** 기간별 중립 구간 (±%). 이 안이면 회색. */
export const NEUTRAL: Record<HeatmapPeriod, number> = {
  "1D": 1.0,
  "5D": 2.0,
  "1M": 3.3,
  "3M": 6.0,
  "6M": 9.0,
  "12M": 13.0,
  CUSTOM: 3.3,
};

export interface ColorScale {
  neutral: number;
  negBound: number; // <= 0 (p2, 이상치 제외)
  posBound: number; // >= 0 (p98, 이상치 제외)
}

/** 정렬된 배열의 백분위수 (선형 보간). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * 색상 스케일: 중립은 기간 테이블, 경계는 수익률 분포의 p2/p98.
 * (easyinvesting 방식 — 극단적 이상치가 전체 채도를 죽이는 걸 방지.
 *  경계 밖 값은 가장 진한 색으로 포화)
 */
export function buildColorScale(
  rets: Array<number | null>,
  period: HeatmapPeriod
): ColorScale {
  const neutral = NEUTRAL[period] ?? 3.3;
  const valid = rets
    .filter((r): r is number => r !== null)
    .sort((a, b) => a - b);
  const neg = Math.min(0, percentile(valid, 0.02));
  const pos = Math.max(0, percentile(valid, 0.98));
  return { neutral, negBound: neg, posBound: pos };
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function mix(
  from: [number, number, number],
  to: [number, number, number],
  t: number
): string {
  return `rgb(${lerp(from[0], to[0], t)}, ${lerp(from[1], to[1], t)}, ${lerp(
    from[2],
    to[2],
    t
  )})`;
}

// 상승: 연한 빨강 → 진한 빨강 / 하락: 연한 파랑 → 진한 파랑
const UP_LIGHT: [number, number, number] = [254, 226, 226];
const UP_DEEP: [number, number, number] = [153, 27, 28];
const DOWN_LIGHT: [number, number, number] = [219, 234, 254];
const DOWN_DEEP: [number, number, number] = [30, 64, 175];

export const NEUTRAL_FILL = "rgb(55, 65, 81)"; // gray-700
export const NULL_FILL = "rgb(31, 41, 55)"; // gray-800

export function heatColor(
  ret: number | null,
  scale: ColorScale
): { fill: string; text: string } {
  if (ret === null) {
    return { fill: NULL_FILL, text: "rgb(107, 114, 128)" };
  }
  const { neutral, negBound, posBound } = scale;
  if (Math.abs(ret) <= neutral) {
    return { fill: NEUTRAL_FILL, text: "rgb(209, 213, 219)" };
  }
  if (ret > 0) {
    const span = Math.max(posBound - neutral, 1e-9);
    const t = Math.min(1, (ret - neutral) / span);
    return {
      fill: mix(UP_LIGHT, UP_DEEP, t),
      text: t > 0.45 ? "rgb(255, 241, 242)" : "rgb(127, 29, 29)",
    };
  }
  const span = Math.max(-neutral - negBound, 1e-9);
  const t = Math.min(1, (-ret - neutral) / span);
  return {
    fill: mix(DOWN_LIGHT, DOWN_DEEP, t),
    text: t > 0.45 ? "rgb(239, 246, 255)" : "rgb(30, 58, 138)",
  };
}

/** 범례용 stops (값 목록, 왼쪽=음수 최소 → 오른쪽=양수 최대). */
export function legendStops(scale: ColorScale): number[] {
  const { neutral, negBound, posBound } = scale;
  const negSpan = -neutral - negBound;
  const posSpan = posBound - neutral;
  const stops: number[] = [];
  if (negSpan > 0) {
    stops.push(negBound, negBound + negSpan / 3, negBound + (2 * negSpan) / 3);
  }
  stops.push(-neutral, neutral);
  if (posSpan > 0) {
    stops.push(neutral + posSpan / 3, neutral + (2 * posSpan) / 3, posBound);
  }
  return stops;
}

export const UP_DEEP_CSS = "rgb(153, 27, 28)";
export const DOWN_DEEP_CSS = "rgb(30, 64, 175)";
