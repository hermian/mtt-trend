import type { HeatmapControls } from "../_components/ControlBar";

export const HEATMAP_STORAGE_KEY = "stock_heatmap_default_controls";

export const DEFAULT_HEATMAP_CONTROLS: HeatmapControls = {
  grouping: "industry",
  period: "1D",
  startDate: null,
  endDate: null,
  marcapMin: 3000,
  marcapMax: null,
  minRet: 4,
  minRs: null,
  mmt: [1, 2, 3],
  limit: 0,
};

export function loadSavedHeatmapControls(
  fallback: HeatmapControls = DEFAULT_HEATMAP_CONTROLS
): HeatmapControls {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(HEATMAP_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;

    return {
      grouping: parsed.grouping ?? fallback.grouping,
      period: parsed.period ?? fallback.period,
      startDate: parsed.startDate ?? fallback.startDate,
      endDate: parsed.endDate ?? fallback.endDate,
      marcapMin: parsed.marcapMin !== undefined ? parsed.marcapMin : fallback.marcapMin,
      marcapMax: parsed.marcapMax !== undefined ? parsed.marcapMax : fallback.marcapMax,
      minRet: parsed.minRet !== undefined ? parsed.minRet : fallback.minRet,
      minRs: parsed.minRs !== undefined ? parsed.minRs : fallback.minRs,
      mmt: parsed.mmt !== undefined ? parsed.mmt : fallback.mmt,
      limit: typeof parsed.limit === "number" ? parsed.limit : fallback.limit,
    };
  } catch (e) {
    console.warn("Failed to load saved heatmap controls from localStorage:", e);
    return fallback;
  }
}

export function saveHeatmapControls(controls: HeatmapControls): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(HEATMAP_STORAGE_KEY, JSON.stringify(controls));
    return true;
  } catch (e) {
    console.warn("Failed to save heatmap controls to localStorage:", e);
    return false;
  }
}

export function clearSavedHeatmapControls(): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(HEATMAP_STORAGE_KEY);
    return true;
  } catch (e) {
    console.warn("Failed to clear saved heatmap controls:", e);
    return false;
  }
}
