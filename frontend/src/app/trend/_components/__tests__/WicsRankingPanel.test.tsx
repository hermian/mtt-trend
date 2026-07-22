import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WicsRankingPanel } from "../WicsRankingPanel";
import * as useWicsData from "@/hooks/useWicsData";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock hooks
vi.mock("@/hooks/useWicsData");

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe("WicsRankingPanel Component - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(useWicsData, "useWicsWeeks").mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useWicsData, "useWicsWeeklyRankings").mockReturnValue({
      data: { months: [] },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useWicsData, "useWicsIndex").mockReturnValue({
      data: { WICS: "", data: [] },
      isLoading: false,
      error: null,
    } as any);
  });

  it("should render loading spinner when loading months", () => {
    vi.spyOn(useWicsData, "useWicsMonths").mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    vi.spyOn(useWicsData, "useWicsRankings").mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(
      <TestWrapper>
        <WicsRankingPanel />
      </TestWrapper>
    );

    expect(screen.getByText("WICS 랭킹 데이터를 로드하고 있습니다...")).toBeInTheDocument();
  });

  it("should render rankings when months and rankings are loaded", () => {
    vi.spyOn(useWicsData, "useWicsMonths").mockReturnValue({
      data: ["2026-06", "2026-07"],
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useWicsData, "useWicsRankings").mockReturnValue({
      data: {
        months: [
          {
            YearMonth: "2026-07",
            rankings: [
              {
                WICS: "반도체와반도체장비",
                Rank_EW: 1,
                Rank_MC: 1,
                EW_12m_Return: 0.2,
                MC_12m_Return: 0.3,
                Top2_Share: 0.5,
              },
              {
                WICS: "가구",
                Rank_EW: 2,
                Rank_MC: 2,
                EW_12m_Return: -0.1,
                MC_12m_Return: -0.2,
                Top2_Share: 0.6,
              },
            ],
          },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    render(
      <TestWrapper>
        <WicsRankingPanel />
      </TestWrapper>
    );

    // Verify header components
    expect(screen.getByText("시작월")).toBeInTheDocument();
    expect(screen.getByText("종료월")).toBeInTheDocument();

    // Verify cell content
    expect(screen.getByText("반도체와반도체장비")).toBeInTheDocument();
    expect(screen.getByText("가구")).toBeInTheDocument();

    // Verify rank labels
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("should highlight the same WICS across months when clicked", async () => {
    vi.spyOn(useWicsData, "useWicsMonths").mockReturnValue({
      data: ["2026-07"],
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useWicsData, "useWicsRankings").mockReturnValue({
      data: {
        months: [
          {
            YearMonth: "2026-07",
            rankings: [
              {
                WICS: "반도체와반도체장비",
                Rank_EW: 1,
                Rank_MC: 1,
                EW_12m_Return: 0.2,
                MC_12m_Return: 0.3,
                Top2_Share: 0.5,
              },
            ],
          },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    render(
      <TestWrapper>
        <WicsRankingPanel />
      </TestWrapper>
    );

    const cell = screen.getByText("반도체와반도체장비");
    expect(cell).toBeInTheDocument();

    // Click to highlight
    fireEvent.click(cell);

    // Check that matched class is applied (e.g. ring-2 ring-yellow-400)
    const container = cell.closest("div[class*='cursor-pointer']");
    expect(container).toHaveClass("ring-2");
    expect(container).toHaveClass("ring-yellow-400");
  });

  it("should calculate and render 3M and 2M rising badges correctly", () => {
    vi.spyOn(useWicsData, "useWicsMonths").mockReturnValue({
      data: ["2026-04", "2026-05", "2026-06", "2026-07"],
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useWicsData, "useWicsRankings").mockReturnValue({
      data: {
        months: [
          {
            YearMonth: "2026-04",
            rankings: [
              { WICS: "A", Rank_EW: 1, Rank_MC: 1, MC_12m_Return: 0.1 },
              { WICS: "B", Rank_EW: 2, Rank_MC: 2, MC_12m_Return: 0.3 },
            ],
          },
          {
            YearMonth: "2026-05",
            rankings: [
              { WICS: "A", Rank_EW: 1, Rank_MC: 1, MC_12m_Return: 0.2 },
              { WICS: "B", Rank_EW: 2, Rank_MC: 2, MC_12m_Return: 0.5 },
            ],
          },
          {
            YearMonth: "2026-06",
            rankings: [
              { WICS: "A", Rank_EW: 1, Rank_MC: 1, MC_12m_Return: 0.3 },
              { WICS: "B", Rank_EW: 2, Rank_MC: 2, MC_12m_Return: 0.4 },
            ],
          },
          {
            YearMonth: "2026-07",
            rankings: [
              { WICS: "A", Rank_EW: 1, Rank_MC: 1, MC_12m_Return: 0.4 },
              { WICS: "B", Rank_EW: 2, Rank_MC: 2, MC_12m_Return: 0.6 },
            ],
          },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    render(
      <TestWrapper>
        <WicsRankingPanel />
      </TestWrapper>
    );

    // WICS "A" return: 0.2 -> 0.3 -> 0.4 (3 consecutive months of rising data). Should render 3M▲ badge.
    // WICS "B" return: 0.5 -> 0.4 (fell) -> 0.6 (2 consecutive months of rising data). Should render 2M▲ badge.
    expect(screen.getAllByText("3M▲")[0]).toBeInTheDocument();
    expect(screen.getAllByText("2M▲")[0]).toBeInTheDocument();
  });
});
