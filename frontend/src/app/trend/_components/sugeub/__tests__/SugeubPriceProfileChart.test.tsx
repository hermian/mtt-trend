import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SugeubPriceProfileChart } from "../SugeubPriceProfileChart";
import * as apiModule from "@/lib/api";

const mockProfileData: apiModule.SupplyDemandPriceProfileResponse = {
  code: "222800",
  name: "심텍",
  market: "KOSDAQ",
  data_first: "2020-01-02",
  data_last: "2026-08-28",
  start: "2025-08-28",
  end: "2026-08-28",
  label: "2025-08-28 ~ 2026-08-28",
  preset: "1y",
  min_price: 42800,
  max_price: 157300,
  step_size: 20000,
  bins: [
    {
      bin_index: 0,
      price_low: 44000,
      price_high: 64000,
      price_label: "44,000 ~ 64,000",
      days: 115,
      거래량: 50000000,
      개인: -2771901,
      외국인: 1167265,
      금융투자: 1687963,
      연기금: -332249,
      기관계: 1355714,
    },
    {
      bin_index: 1,
      price_low: 64000,
      price_high: 84000,
      price_label: "64,000 ~ 84,000",
      days: 26,
      거래량: 20000000,
      개인: -1910841,
      외국인: 817742,
      금융투자: -72645,
      연기금: 664056,
      기관계: 591411,
    },
    {
      bin_index: 2,
      price_low: 84000,
      price_high: 104000,
      price_label: "84,000 ~ 104,000",
      days: 19,
      거래량: 15000000,
      개인: 92913,
      외국인: -831207,
      금융투자: 19820,
      연기금: 60024,
      기관계: 79844,
    },
  ],
  price_series: [
    { date: "2025-08-28", close: 50000, open: 49000, high: 51000, low: 48000, volume: 1000000, change_pct: 0 },
    { date: "2026-01-02", close: 75000, open: 74000, high: 76000, low: 73000, volume: 1500000, change_pct: 2.5 },
    { date: "2026-08-28", close: 95000, open: 94000, high: 97000, low: 93000, volume: 2000000, change_pct: 1.2 },
  ],
  investors: ["개인", "외국인", "금융투자", "연기금", "기관계"],
  total_period_sums: {
    개인: -4589829,
    외국인: 1153800,
    금융투자: 1635138,
    연기금: 391831,
  },
};

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

describe("SugeubPriceProfileChart", () => {
  beforeEach(() => {
    vi.spyOn(apiModule.api, "getSupplyDemandPriceProfile").mockResolvedValue(mockProfileData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders header, subtitle, and default 1Y preset", async () => {
    renderWithClient(<SugeubPriceProfileChart code="222800" name="심텍" />);

    expect(await screen.findByText(/심텍 매물대 분석/)).toBeInTheDocument();
    expect(screen.getByText(/기본 1Y 매물대 \(개인·외국인·기관계 3대 주체 통합\)/)).toBeInTheDocument();
    expect(screen.getByText(/심텍 매물대 - 개인 \/ 외국인 \/ 기관계/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1Y (기본)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /종가 실선 차트/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /기관계 \(통합 바\)/ })).toBeInTheDocument();
  });

  it("renders price bins, bars, and overlaid price line within the same chart", async () => {
    renderWithClient(<SugeubPriceProfileChart code="222800" name="심텍" />);

    expect(await screen.findByText("44,000 ~ 64,000")).toBeInTheDocument();
    expect(screen.getByText("64,000 ~ 84,000")).toBeInTheDocument();
    expect(screen.getByText("84,000 ~ 104,000")).toBeInTheDocument();
    expect(screen.getByText("가격대(원)")).toBeInTheDocument();
    expect(screen.getByText(/순매수\(주\) — 개인 \/ 외국인 \/ 기관계/)).toBeInTheDocument();
  });

  it("allows toggling overlaid close price line on and off", async () => {
    renderWithClient(<SugeubPriceProfileChart code="222800" name="심텍" />);

    const priceLineBtn = await screen.findByRole("button", { name: /종가 실선 차트/ });
    expect(priceLineBtn.className).toContain("bg-slate-900");

    // Toggle off
    fireEvent.click(priceLineBtn);
    expect(priceLineBtn.className).toContain("line-through");

    // Toggle back on
    fireEvent.click(priceLineBtn);
    expect(priceLineBtn.className).toContain("bg-slate-900");
  });

  it("allows switching preset", async () => {
    renderWithClient(<SugeubPriceProfileChart code="222800" name="심텍" />);

    await screen.findByText(/심텍 매물대 분석/);
    const btn6m = screen.getByRole("button", { name: "6M" });
    fireEvent.click(btn6m);

    expect(apiModule.api.getSupplyDemandPriceProfile).toHaveBeenCalledWith(
      "222800",
      expect.objectContaining({ preset: "6m" })
    );
  });

  it("allows entering custom date range and applying", async () => {
    const { container } = renderWithClient(<SugeubPriceProfileChart code="222800" name="심텍" />);

    await screen.findByText(/심텍 매물대 분석/);
    const dateInputs = container.querySelectorAll("input[type='date']");
    expect(dateInputs.length).toBe(2);

    fireEvent.change(dateInputs[0], { target: { value: "2026-01-02" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-08-28" } });

    const applyBtn = screen.getByRole("button", { name: "적용" });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(apiModule.api.getSupplyDemandPriceProfile).toHaveBeenCalledWith(
        "222800",
        expect.objectContaining({
          preset: "custom",
          start: "2026-01-02",
          end: "2026-08-28",
        })
      );
    });
  });

  it("allows toggling investor series", async () => {
    renderWithClient(<SugeubPriceProfileChart code="222800" name="심텍" />);

    await screen.findByText(/심텍 매물대 분석/);
    const gaeinBtn = screen.getByRole("button", { name: "개인" });
    fireEvent.click(gaeinBtn);

    // Clicking toggles opacity / class
    expect(gaeinBtn.className).toContain("line-through");
  });

  it("shows hover summary when mouse enters a price bin row", async () => {
    renderWithClient(<SugeubPriceProfileChart code="222800" name="심텍" />);

    const binText = await screen.findByText("44,000 ~ 64,000");
    const row = binText.closest("div[class*='grid']");
    expect(row).not.toBeNull();

    if (row) {
      fireEvent.mouseEnter(row);
      expect(await screen.findByText(/구간 44,000 ~ 64,000원/)).toBeInTheDocument();
    }
  });
});
