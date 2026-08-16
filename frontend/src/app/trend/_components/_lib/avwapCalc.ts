import type { AvwapPoint } from "@/lib/api";

export interface CustomAnchorItem {
  id: string;
  market_or_symbol: string;
  anchor_date: string;
  label?: string | null;
  color: string;
  interval_mask?: string;
  is_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

const LOCAL_STORAGE_KEY_PREFIX = "mtt_avwap_custom_anchors_";

export function getLocalCustomAnchors(target: string): CustomAnchorItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${target.toLowerCase()}`);
    if (!raw) return [];
    return JSON.parse(raw) as CustomAnchorItem[];
  } catch (e) {
    console.warn("Failed to read custom anchors from localStorage:", e);
    return [];
  }
}

export function setLocalCustomAnchors(target: string, anchors: CustomAnchorItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${target.toLowerCase()}`, JSON.stringify(anchors));
  } catch (e) {
    console.warn("Failed to save custom anchors to localStorage:", e);
  }
}

export function addLocalCustomAnchor(target: string, anchor: CustomAnchorItem): void {
  const current = getLocalCustomAnchors(target);
  const exists = current.some((a) => a.id === anchor.id || a.anchor_date === anchor.anchor_date);
  if (!exists) {
    setLocalCustomAnchors(target, [...current, anchor]);
  }
}

export function removeLocalCustomAnchor(target: string, idOrDate: string): void {
  const current = getLocalCustomAnchors(target);
  setLocalCustomAnchors(
    target,
    current.filter((a) => a.id !== idOrDate && a.anchor_date !== idOrDate)
  );
}

/**
 * Client-side AVWAP computation for 0ms instant updates.
 */
export function computeClientAvwap(
  points: AvwapPoint[],
  anchorDate: string
): { date: string; value: number }[] {
  if (!points || points.length === 0) return [];
  const result: { date: string; value: number }[] = [];
  let cumTypicalVol = 0;
  let cumVol = 0;
  let started = false;

  for (const pt of points) {
    if (!started && pt.date >= anchorDate) {
      started = true;
    }
    if (started) {
      const vol = pt.volume > 0 ? pt.volume : 1.0;
      const tp = (pt.high + pt.low + pt.close + pt.open) / 4.0;
      cumTypicalVol += tp * vol;
      cumVol += vol;
      const vwapVal = cumVol > 0 ? cumTypicalVol / cumVol : pt.close;
      result.push({
        date: pt.date,
        value: Number(vwapVal.toFixed(2)),
      });
    }
  }
  return result;
}
