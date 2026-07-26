/** 수익률 → 연속 히트맵 색상 (다크 테마용) */
export function getHeatStyle(val: number | null): {
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
      backgroundColor: "rgb(31, 41, 55)",
      color: "rgb(156, 163, 175)",
      borderColor: "rgb(55, 65, 81)",
    };
  }

  // 강도: |%| 기준 0~8% 클램프 후 보간
  const intensity = Math.min(Math.abs(val) / 8, 1);

  if (val > 0) {
    // 어두운 에메랄드 → 밝은 에메랄드
    const r = Math.round(6 + (16 - 6) * intensity);
    const g = Math.round(46 + (185 - 46) * intensity);
    const b = Math.round(34 + (129 - 34) * intensity);
    const text =
      intensity > 0.55 ? "rgb(236, 253, 245)" : "rgb(167, 243, 208)";
    return {
      backgroundColor: `rgb(${r}, ${g}, ${b})`,
      color: text,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.5)`,
    };
  }

  const r = Math.round(69 + (225 - 69) * intensity);
  const g = Math.round(10 + (29 - 10) * intensity);
  const b = Math.round(10 + (72 - 10) * intensity);
  const text = intensity > 0.55 ? "rgb(255, 241, 242)" : "rgb(254, 205, 211)";
  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: text,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.5)`,
  };
}

export function formatReturn(val: number | null): string {
  if (val === null) return "N/A";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}
