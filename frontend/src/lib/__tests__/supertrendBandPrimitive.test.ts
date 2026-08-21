import { describe, it, expect, vi } from "vitest";
import {
  SupertrendBandPrimitive,
  type SupertrendBandItem,
} from "../supertrendBandPrimitive";

describe("SupertrendBandPrimitive", () => {
  it("initializes with default state", () => {
    const primitive = new SupertrendBandPrimitive();
    expect(primitive.visible).toBe(false);
    expect(primitive.data).toEqual([]);
    expect(primitive.chart).toBeNull();
    expect(primitive.series).toBeNull();
    expect(primitive.paneViews().length).toBe(1);
    expect(primitive.paneViews()[0].zOrder?.()).toBe("bottom");
  });

  it("handles lifecycle attach and detach", () => {
    const primitive = new SupertrendBandPrimitive();
    const mockRequestUpdate = vi.fn();
    const mockChart = { timeScale: vi.fn() } as any;
    const mockSeries = { priceToCoordinate: vi.fn() } as any;

    primitive.attached({
      chart: mockChart,
      series: mockSeries,
      requestUpdate: mockRequestUpdate,
    } as any);

    expect(primitive.chart).toBe(mockChart);
    expect(primitive.series).toBe(mockSeries);

    primitive.setData([
      { time: "2024-01-02", price: 100, supertrend: 95, trend: 1 },
      { time: "2024-01-03", price: 105, supertrend: 97, trend: 1 },
    ]);
    expect(mockRequestUpdate).toHaveBeenCalled();

    primitive.setVisible(true);
    expect(primitive.visible).toBe(true);

    primitive.detached();
    expect(primitive.chart).toBeNull();
    expect(primitive.series).toBeNull();
  });

  it("draws bullish and bearish channel bands onto canvas target", () => {
    const primitive = new SupertrendBandPrimitive();
    const mockTimeScale = {
      timeToCoordinate: vi.fn((time: string) => (time === "2024-01-02" ? 10 : 20)),
    };
    const mockChart = { timeScale: () => mockTimeScale } as any;
    const mockSeries = {
      priceToCoordinate: vi.fn((val: number) => val),
    } as any;

    primitive.attached({
      chart: mockChart,
      series: mockSeries,
      requestUpdate: vi.fn(),
    } as any);

    const data: SupertrendBandItem[] = [
      { time: "2024-01-02", price: 100, supertrend: 95, trend: 1 },
      { time: "2024-01-03", price: 105, supertrend: 97, trend: 1 },
    ];
    primitive.setData(data);
    primitive.setVisible(true);

    const paneView = primitive.paneViews()[0];
    const renderer = paneView.renderer();
    expect(renderer).not.toBeNull();

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      fillStyle: "",
    };

    const mockTarget = {
      useMediaCoordinateSpace: vi.fn((cb: any) => {
        cb({ context: mockCtx, mediaSize: { width: 500, height: 300 } });
      }),
    };

    renderer!.draw(mockTarget as any);

    expect(mockTarget.useMediaCoordinateSpace).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
    expect(mockCtx.fillStyle).toBe("rgba(16, 185, 129, 0.28)");
  });
});
