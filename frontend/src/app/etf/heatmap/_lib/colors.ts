import type { PeriodKey } from "./types";

/** 기간별 최대 강도(|%|). 이 값 이상은 가장 진한 색 */
const PERIOD_SCALE: Record<PeriodKey, number> = {
  "1D": 1,
  MTD: 5,
  YTD: 20,
  "3M": 10,
  "6M": 15,
  "1Y": 25,
  "3Y": 50,
  "5Y": 80,
};

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function mixRgb(
  from: [number, number, number],
  to: [number, number, number],
  t: number
): string {
  return `rgb(${lerp(from[0], to[0], t)}, ${lerp(from[1], to[1], t)}, ${lerp(from[2], to[2], t)})`;
}

/**
 * 수익률 → 히트맵 색상
 * 범례와 동일: |값|이 작으면 연한색, 크면 진한 빨강/초록
 */
export function getHeatStyle(
  val: number | null,
  period: PeriodKey = "1D"
): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  if (val === null) {
    return {
      backgroundColor: "rgb(17, 24, 39)",
      color: "rgb(107, 114, 128)",
      borderColor: "rgb(31, 41, 55)",
    };
  }
  if (val === 0) {
    return {
      backgroundColor: "rgb(55, 65, 81)",
      color: "rgb(209, 213, 219)",
      borderColor: "rgb(75, 85, 99)",
    };
  }

  const scale = PERIOD_SCALE[period] ?? 1;
  const intensity = Math.min(Math.abs(val) / scale, 1);

  if (val > 0) {
    // 연한 민트 → 진한 녹색 (범례 +0.1% ~ +1%+)
    const bg = mixRgb([220, 252, 231], [21, 128, 61], intensity);
    const color = intensity > 0.45 ? "rgb(240, 253, 244)" : "rgb(20, 83, 45)";
    return {
      backgroundColor: bg,
      color,
      borderColor: mixRgb([167, 243, 208], [22, 101, 52], intensity),
    };
  }

  // 연한 분홍 → 진한 빨강 (범례 -0.1% ~ -1%)
  const bg = mixRgb([254, 226, 226], [185, 28, 28], intensity);
  const color = intensity > 0.45 ? "rgb(255, 241, 242)" : "rgb(127, 29, 29)";
  return {
    backgroundColor: bg,
    color,
    borderColor: mixRgb([254, 202, 202], [153, 27, 27], intensity),
  };
}

export function formatReturn(val: number | null): string {
  if (val === null) return "N/A";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

/** 범례용 스톱 (현재 기간 스케일 기준) */
export function getLegendStops(period: PeriodKey): { label: string; value: number }[] {
  const s = PERIOD_SCALE[period] ?? 1;
  const fmt = (v: number) => `${v > 0 ? "+" : ""}${Number(v.toFixed(1))}%`;
  return [
    { label: fmt(-s), value: -s },
    { label: fmt(-s * 0.7), value: -s * 0.7 },
    { label: fmt(-s * 0.4), value: -s * 0.4 },
    { label: fmt(-s * 0.1), value: -s * 0.1 },
    { label: "0", value: 0 },
    { label: fmt(s * 0.1), value: s * 0.1 },
    { label: fmt(s * 0.4), value: s * 0.4 },
    { label: fmt(s * 0.7), value: s * 0.7 },
    { label: fmt(s), value: s },
  ];
}
