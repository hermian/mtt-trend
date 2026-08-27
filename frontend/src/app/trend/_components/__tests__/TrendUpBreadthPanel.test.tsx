/**
 * TrendUpBreadthPanel 컴포넌트 단위 테스트
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type * as ApiModule from "@/lib/api";
import * as api from "@/lib/api";
import { TrendUpBreadthPanel } from "../TrendUpBreadthPanel";
// lightweight-charts 모킹
vi.mock("lightweight-charts", () => {
  const mockChart = {
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
      createPriceLine: vi.fn(),
    })),
    timeScale: vi.fn(() => ({
      fitContent: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn(),
      setVisibleLogicalRange: vi.fn(),
    })),
    subscribeCrosshairMove: vi.fn(),
    applyOptions: vi.fn(),
    priceScale: vi.fn(() => ({
      applyOptions: vi.fn(),
    })),
    remove: vi.fn(),
  };
  return {
    createChart: vi.fn(() => mockChart),
    ColorType: { Solid: "solid" },
    CrosshairMode: { Normal: 0 },
    CandlestickSeries: "CandlestickSeries",
    LineSeries: "LineSeries",
    LineStyle: { Solid: 0, Dashed: 2 },
    PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2, IndexedTo100: 3 },
  };
});

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    getTrendUpBreadthData: vi.fn(),
  };
});

const MOCK_RESPONSE: api.TrendUpBreadthResponse = {
  universe: "krx300",
  universe_name: "KRX 300",
  index_data: [
    {
      time: "2026-08-26",
      open: 47000,
      high: 48000,
      low: 46900,
      close: 47665,
      volume: 12000,
      indicators: { sma10: 46500, sma20: 45800, sma50: 44000, sma150: 42000, sma200: 40000 },
    },
    {
      time: "2026-08-27",
      open: 48900,
      high: 49000,
      low: 47800,
      close: 48120,
      volume: 15000,
      indicators: { sma10: 46800, sma20: 46000, sma50: 44200, sma150: 42200, sma200: 40200 },
    },
  ],
  breadth_data: [
    {
      time: "2026-08-26",
      trend_up_ratio: 30.6,
      trend_up_ratio_5ma: 27.5,
      trend_up_stocks: 92,
      total_stocks: 301,
    },
    {
      time: "2026-08-27",
      trend_up_ratio: 37.5,
      trend_up_ratio_5ma: 28.8,
      trend_up_stocks: 113,
      total_stocks: 301,
    },
  ],
  distribution_daily: {
    latest: 37.5,
    percentile: 65.4,
    median: 27.1,
    mean: 28.5,
    min: 3.2,
    max: 75.8,
    total_days: 2000,
    bins: [
      { x_start: 0.0, x_end: 5.0, x_label: "0.0%-5.0%", count: 45, is_latest_bin: false },
      { x_start: 35.0, x_end: 40.0, x_label: "35.0%-40.0%", count: 180, is_latest_bin: true },
      { x_start: 70.0, x_end: 75.0, x_label: "70.0%-75.0%", count: 12, is_latest_bin: false },
    ],
  },
  distribution_5ma: {
    latest: 28.8,
    percentile: 58.2,
    median: 27.3,
    mean: 28.2,
    min: 4.5,
    max: 72.0,
    total_days: 2000,
    bins: [
      { x_start: 0.0, x_end: 5.0, x_label: "0.0%-5.0%", count: 30, is_latest_bin: false },
      { x_start: 25.0, x_end: 30.0, x_label: "25.0%-30.0%", count: 250, is_latest_bin: true },
      { x_start: 70.0, x_end: 75.0, x_label: "70.0%-75.0%", count: 8, is_latest_bin: false },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getTrendUpBreadthData).mockResolvedValue(MOCK_RESPONSE);
});

describe("TrendUpBreadthPanel", () => {
  it("기본 렌더링 시 KRX 300 데이터 및 통계 배지를 올바르게 표시한다", async () => {
    render(<TrendUpBreadthPanel />);

    expect(screen.getByText("Market Breadth")).toBeInTheDocument();
    expect(screen.getByText("Trend-up Breadth")).toBeInTheDocument();

    // 데이터 로딩 완료 대기
    await waitFor(() => {
      expect(screen.getByText("KRX 300 지수 주가")).toBeInTheDocument();
    });

    // 통계치 확인
    expect(screen.getByText("일간 추세상승 비율 분포 (Daily Ratio)")).toBeInTheDocument();
    expect(screen.getByText("5일 이동평균 비율 분포 (5-day MA)")).toBeInTheDocument();
    expect(screen.getByText(/65.4%ile/)).toBeInTheDocument();
    expect(screen.getByText(/58.2%ile/)).toBeInTheDocument();
  });

  it("유니버스 버튼(KOSPI, KOSDAQ, 전체) 클릭 시 해당 유니버스로 데이터를 요청한다", async () => {
    render(<TrendUpBreadthPanel />);

    await waitFor(() => {
      expect(screen.getByText("KRX 300 지수 주가")).toBeInTheDocument();
    });

    // KOSPI 버튼 클릭
    const kospiBtn = screen.getByRole("button", { name: "KOSPI" });
    fireEvent.click(kospiBtn);

    await waitFor(() => {
      expect(api.getTrendUpBreadthData).toHaveBeenCalledWith("kospi", expect.any(String));
    });

    // KOSDAQ 버튼 클릭
    const kosdaqBtn = screen.getByRole("button", { name: "KOSDAQ" });
    fireEvent.click(kosdaqBtn);

    await waitFor(() => {
      expect(api.getTrendUpBreadthData).toHaveBeenCalledWith("kosdaq", expect.any(String));
    });

    // 전체(KOSPI+KOSDAQ) 버튼 클릭
    const allBtn = screen.getByRole("button", { name: "전체 (KOSPI+KOSDAQ)" });
    fireEvent.click(allBtn);

    await waitFor(() => {
      expect(api.getTrendUpBreadthData).toHaveBeenCalledWith("all", expect.any(String));
    });
  });

  it("기간 버튼(1년, 3년, 5년, 전체) 클릭 시 해당 기간 파라미터로 데이터를 갱신한다", async () => {
    render(<TrendUpBreadthPanel />);

    await waitFor(() => {
      expect(screen.getByText("KRX 300 지수 주가")).toBeInTheDocument();
    });

    const oneYearBtn = screen.getByRole("button", { name: "1년" });
    fireEvent.click(oneYearBtn);

    await waitFor(() => {
      expect(api.getTrendUpBreadthData).toHaveBeenCalledWith("krx300", expect.any(String));
    });
  });
});
