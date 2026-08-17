import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_HEATMAP_CONTROLS,
  HEATMAP_STORAGE_KEY,
  loadSavedHeatmapControls,
  saveHeatmapControls,
  clearSavedHeatmapControls,
} from "../_lib/storage";
import type { HeatmapControls } from "../_components/ControlBar";

describe("Heatmap storage utility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns default fallback controls when storage is empty", () => {
    const controls = loadSavedHeatmapControls();
    expect(controls).toEqual(DEFAULT_HEATMAP_CONTROLS);
  });

  it("saves controls to localStorage successfully", () => {
    const customControls: HeatmapControls = {
      grouping: "theme",
      period: "5D",
      startDate: null,
      endDate: null,
      marcapMin: 5000,
      marcapMax: null,
      minRet: 10,
      minRs: 90,
      mmt: [2, 3],
      limit: 100,
    };

    const saved = saveHeatmapControls(customControls);
    expect(saved).toBe(true);

    const loaded = loadSavedHeatmapControls();
    expect(loaded).toEqual(customControls);
  });

  it("clears saved controls and returns default on next load", () => {
    const customControls: HeatmapControls = {
      ...DEFAULT_HEATMAP_CONTROLS,
      grouping: "kospi",
      period: "1M",
    };

    saveHeatmapControls(customControls);
    expect(loadSavedHeatmapControls().grouping).toBe("kospi");

    clearSavedHeatmapControls();
    expect(localStorage.getItem(HEATMAP_STORAGE_KEY)).toBeNull();
    expect(loadSavedHeatmapControls()).toEqual(DEFAULT_HEATMAP_CONTROLS);
  });

  it("gracefully falls back on corrupted JSON in localStorage", () => {
    localStorage.setItem(HEATMAP_STORAGE_KEY, "invalid-json{");
    const loaded = loadSavedHeatmapControls();
    expect(loaded).toEqual(DEFAULT_HEATMAP_CONTROLS);
  });
});
