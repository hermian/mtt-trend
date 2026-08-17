import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReturnComparisonPanel } from "../ReturnComparisonPanel";
import * as api from "@/lib/api";
import type { ReactNode } from "react";

// Mock lightweight-charts
vi.mock("lightweight-charts", () => {
  return {
    createChart: vi.fn(() => ({
      applyOptions: vi.fn(),
      addSeries: vi.fn(() => ({
        setData: vi.fn(),
        update: vi.fn(),
      })),
      removeSeries: vi.fn(),
      timeScale: vi.fn(() => ({
        fitContent: vi.fn(),
      })),
      subscribeCrosshairMove: vi.fn(),
      remove: vi.fn(),
    })),
    ColorType: { Solid: "solid" },
    LineSeries: "Line",
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
  };
});

vi.mock("@/lib/api");

const MOCK_DATA = {
  start_date: "2025-08-01",
  end_date: "2026-08-14",
  series: [
    {
      code: "005930",
      name: "삼성전자",
      market: "KOSPI",
      type: "stock",
      currency: "KRW",
      color: "#3b82f6",
      data: [
        { date: "2025-08-01", close: 70000, return_pct: 0.0 },
        { date: "2026-08-14", close: 77000, return_pct: 10.0 },
      ],
    },
    {
      code: "NVDA",
      name: "NVIDIA",
      market: "US",
      type: "us_stock",
      currency: "USD",
      color: "#f97316",
      data: [
        { date: "2025-08-01", close: 100, return_pct: 0.0 },
        { date: "2026-08-14", close: 120, return_pct: 20.0 },
      ],
    },
  ],
  statistics: [
    {
      code: "005930",
      name: "삼성전자",
      start_price: 70000,
      end_price: 77000,
      currency: "KRW",
      return_1w: 1.5,
      return_1m: 3.2,
      return_3m: 5.0,
      return_6m: 8.1,
      return_1y: 10.0,
      return_ytd: 7.2,
      period_return: 10.0,
      max_return: 12.0,
      min_return: -2.0,
      mean_return: 5.5,
      volatility: 1.2,
    },
    {
      code: "NVDA",
      name: "NVIDIA",
      start_price: 100,
      end_price: 120,
      currency: "USD",
      return_1w: 2.0,
      return_1m: 4.5,
      return_3m: 10.0,
      return_6m: 15.0,
      return_1y: 20.0,
      return_ytd: 18.0,
      period_return: 20.0,
      max_return: 22.0,
      min_return: -1.0,
      mean_return: 11.0,
      volatility: 2.5,
    },
  ],
  correlations: {
    "3M": { labels: ["삼성전자", "NVIDIA"], matrix: [[1.0, 0.45], [0.45, 1.0]] },
    "6M": { labels: ["삼성전자", "NVIDIA"], matrix: [[1.0, 0.50], [0.50, 1.0]] },
    "12M": { labels: ["삼성전자", "NVIDIA"], matrix: [[1.0, 0.55], [0.55, 1.0]] },
    "3Y": { labels: ["삼성전자", "NVIDIA"], matrix: [[1.0, 0.40], [0.40, 1.0]] },
  },
  rolling_correlations: {
    "3M": [
      {
        pair: "삼성전자 vs NVIDIA",
        data: [
          { date: "2026-08-13", corr: 0.44 },
          { date: "2026-08-14", corr: 0.45 },
        ],
      },
    ],
    "6M": [],
    "12M": [],
    "3Y": [],
  },
};

describe("ReturnComparisonPanel Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.api.compareReturns).mockResolvedValue(MOCK_DATA as never);
    vi.mocked(api.api.searchStocks).mockResolvedValue([
      { code: "000660", name: "SK하이닉스", market: "KOSPI" },
    ]);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ReturnComparisonPanel />
      </QueryClientProvider>
    );

  it("renders header, controls, comparison items, and table", async () => {
    renderComponent();

    expect(screen.getByText("종목 수익률 비교 & 상관계수 분석")).toBeInTheDocument();
    expect(screen.getByText("비교 대상 (2/10):")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("기간별 수익률 및 기술 통계 요약")).toBeInTheDocument();
    });

    // Check table content
    expect(screen.getAllByText("삼성전자").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NVIDIA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+10.00%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+20.00%").length).toBeGreaterThan(0);
  });

  it("supports removing and clearing comparison items", async () => {
    renderComponent();

    const deleteButtons = screen.getAllByTitle("삭제");
    expect(deleteButtons.length).toBe(2);

    // Click delete on first item
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText("비교 대상 (1/10):")).toBeInTheDocument();

    // Click clear all
    const clearAllBtn = screen.getByText("전체 비우기");
    fireEvent.click(clearAllBtn);
    expect(screen.getByText("비교 대상 (0/10):")).toBeInTheDocument();
    expect(screen.getByText(/비교할 종목을 위 검색창에서 검색하여 추가해주세요/)).toBeInTheDocument();
  });

  it("supports period shortcut buttons", async () => {
    renderComponent();

    const m3Btn = screen.getByRole("button", { name: "3개월" });
    fireEvent.click(m3Btn);

    expect(m3Btn).toHaveClass("bg-blue-600");
  });

  it("renders correlation section when multiple items exist", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("종목간 상관계수 분석")).toBeInTheDocument();
    });

    // Check period tabs
    expect(screen.getByText("3M")).toBeInTheDocument();
    expect(screen.getByText("6M")).toBeInTheDocument();
    expect(screen.getByText("12M")).toBeInTheDocument();
    expect(screen.getByText("3Y")).toBeInTheDocument();
  });
});
