/** lightweight-charts UTC/BusinessDay 입력은 `YYYY-MM-DD` 만 허용한다. */
export function toChartTime(raw: unknown): string | null {
  if (raw == null) return null;
  const m = String(raw).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
