import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AvwapSugeubPanel } from "../AvwapSugeubPanel";
import type { SupplyDemandResponse } from "@/lib/api";

const mockData: SupplyDemandResponse = {
  code: "039490",
  name: "키움증권",
  data_first: "2020-01-02",
  data_last: "2026-08-21",
  sum_period: {
    preset: "3m",
    start: "2026-05-21",
    end: "2026-08-21",
    label: "2026-05-21 ~ 2026-08-21",
  },
  series: [
    {
      date: "2026-08-21",
      close: 100000,
      force_oscillator: 10,
      accumulation_3ma: { 세력: 100, 외국인: 50, 기관계: 40, 개인: -20 },
      dispersion_pct: { 세력: 80, 외국인: 60 },
      norm_accumulation: { 세력: 0.5, 외국인: 0.3 },
    },
  ],
  table_supply: [{ label: "08-21", 종가: 100000, 거래량: 1000000, 개인: -100 }],
  table_lds: [{ label: "5일", 종가: 99000, 거래량: 900000, 개인: -500 }],
  table_dispersion_stats: [{ stat: "mean", 세력: 0.5 }],
  table_dispersion_recent: [{ date: "08-21", 세력: 0.8 }],
  table_dispersion_peak: [{ date: "2024-01-15", 세력: 0.95 }],
  period_sums: [{ investor: "세력", value: 10000 }],
  period_sums_by_preset: {
    "3m": {
      sum_period: {
        preset: "3m",
        start: "2026-05-21",
        end: "2026-08-21",
        label: "2026-05-21 ~ 2026-08-21",
      },
      period_sums: [{ investor: "세력", value: 10000 }],
    },
  },
  columns: ["종가", "거래량", "개인"],
};

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe("AvwapSugeubPanel", () => {
  const defaultProps = {
    symbol: "039490",
    data: mockData,
    isLoading: false,
    error: null,
    sumPreset: "3m" as const,
    onSumPresetChange: vi.fn(),
    customSumStart: "",
    customSumEnd: "",
    onCustomSumStartChange: vi.fn(),
    onCustomSumEndChange: vi.fn(),
    onApplyCustomSum: vi.fn(),
  };

  it("renders supply table, chart sections, and price profile chart", () => {
    renderWithClient(<AvwapSugeubPanel {...defaultProps} />);
    expect(screen.getByText(/키움증권.*039490/)).toBeInTheDocument();
    expect(screen.getByText("수급 분석표 (상세)")).toBeInTheDocument();
    expect(screen.getByText("차트 분석")).toBeInTheDocument();
    expect(screen.getByText("주체별 순매수 합계")).toBeInTheDocument();
    expect(screen.getByText(/키움증권 매물대 분석/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    renderWithClient(
      <AvwapSugeubPanel {...defaultProps} data={undefined} isLoading={true} />
    );
    expect(screen.getByText(/수급 분석 데이터를 로드하는 중/)).toBeInTheDocument();
  });

  it("shows empty state when no symbol", () => {
    renderWithClient(<AvwapSugeubPanel {...defaultProps} symbol={null} data={undefined} />);
    expect(screen.getByText(/종목코드\(예: 005930\)/)).toBeInTheDocument();
  });

  it("calls onSumPresetChange when preset clicked in period sums", () => {
    const onSumPresetChange = vi.fn();
    renderWithClient(<AvwapSugeubPanel {...defaultProps} onSumPresetChange={onSumPresetChange} />);
    const buttons = screen.getAllByRole("button", { name: "6M" });
    // buttons[0] is in SugeubRangeControls, buttons[1] is in SugeubPeriodSumBar, buttons[2] is in SugeubPriceProfileChart
    fireEvent.click(buttons[1]);
    expect(onSumPresetChange).toHaveBeenCalledWith("6m");
  });
});
