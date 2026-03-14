/**
 * TrendPage 통합 테스트
 * SPEC-MTT-002 F-03, F-06: 테마 트렌드 페이지 및 공통 UX
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TrendPage from "../page";
import * as useThemes from "@/hooks/useThemes";

// Mock hooks
vi.mock("@/hooks/useThemes");

// Test wrapper with QueryClientProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe("TrendPage Integration", () => {
  // Default mock implementations for all hooks
  const defaultMockValues = {
    useDates: { data: ["2024-01-01"], isLoading: false, error: null },
    useThemesDaily: { data: [], isLoading: false, error: null },
    useThemesSurging: { data: [], isLoading: false, error: null },
    useMultipleThemeHistories: { data: {}, isLoading: false, error: null },
    useThemeHistory: { data: [], isLoading: false, error: null },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mocks for all hooks
    vi.spyOn(useThemes, "useDates").mockReturnValue(defaultMockValues.useDates as any);
    vi.spyOn(useThemes, "useThemesDaily").mockReturnValue(defaultMockValues.useThemesDaily as any);
    vi.spyOn(useThemes, "useThemesSurging").mockReturnValue(defaultMockValues.useThemesSurging as any);
    vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue(defaultMockValues.useMultipleThemeHistories as any);
    vi.spyOn(useThemes, "useThemeHistory").mockReturnValue(defaultMockValues.useThemeHistory as any);
  });

  // Helper function to find skeleton element
  const findSkeleton = () => document.querySelector(".animate-pulse");

  it("should render page header", () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01", "2024-01-02"],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    // Assert
    expect(screen.getByText("52주 고점 테마 트렌드")).toBeInTheDocument();
    expect(screen.getByText(/테마별 RS\(상대강도\) 분석 대시보드/)).toBeInTheDocument();
  });

  it("should render source toggle buttons", () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01"],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    // Assert
    expect(screen.getByText("52주 신고가")).toBeInTheDocument();
    expect(screen.getByText("MTT 종목")).toBeInTheDocument();
  });

  it("should switch source when button clicked", async () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01"],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    const mttButton = screen.getByText("MTT 종목");
    fireEvent.click(mttButton);

    // Assert
    expect(mttButton).toHaveClass("bg-blue-600");
  });

  it("should reset date when source changes", async () => {
    // Arrange
    const useDatesMock = vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01", "2024-01-02"],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    // Wait for initial date selection
    await waitFor(() => {
      expect(screen.getByDisplayValue("2024-01-02")).toBeInTheDocument();
    });

    // Switch source - use a more specific selector to avoid ambiguity
    const buttons = screen.getAllByText("MTT 종목");
    const mttButton = buttons.find(btn => btn.tagName === "BUTTON");
    if (!mttButton) throw new Error("MTT button not found");

    // Update mock to return empty data for the new source (simulating no dates loaded yet)
    useDatesMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    } as any);

    fireEvent.click(mttButton);

    // Assert - date should be reset (no value selected)
    await waitFor(() => {
      const select = screen.getByRole("combobox");
      // When dates array is empty, no date is selected, so value is ""
      expect(select.value).toBe("");
    });
  });

  it("should set default date to latest when dates load", async () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01", "2024-01-02", "2024-01-03"],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    // Assert - latest date should be selected
    await waitFor(() => {
      expect(screen.getByDisplayValue("2024-01-03")).toBeInTheDocument();
    });
  });

  it("should show loading state for dates", () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    // Assert - skeleton animation should be present
    const skeleton = findSkeleton();
    expect(skeleton).toBeInTheDocument();
  });

  it("should show error state for dates", () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to fetch dates")
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    // Assert
    expect(screen.getByText("날짜 로드 실패")).toBeInTheDocument();
  });

  it("should not render sections when no date is selected", () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    // Assert
    // SPEC-MTT-004: Changed text from "테마별 RS 점수 (상위 15)" to "테마별 RS 점수 — 52주 신고가"
    expect(screen.queryByText(/테마별 RS 점수/)).not.toBeInTheDocument();
    expect(screen.getByText("날짜를 선택하세요")).toBeInTheDocument();
  });

  it("should render all sections when date is selected", async () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01"],
      isLoading: false,
      error: null
    } as any);
    // Provide data for child components to render their content
    vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
      data: [{ date: "2024-01-01", theme_name: "AI", stock_count: 5, avg_rs: 80 }],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    // Wait for date to be selected
    await waitFor(() => {
      expect(screen.getByDisplayValue("2024-01-01")).toBeInTheDocument();
    });

    // Assert - all sections should be visible (SPEC-MTT-003 F-02, SPEC-MTT-004 F-02)
    // SPEC-MTT-004: Section header changed to "테마별 RS 점수 — {source_label}"
    expect(screen.getByText(/테마별 RS 점수/)).toBeInTheDocument();
    expect(screen.getByText("신규 급등 테마 탐지")).toBeInTheDocument();
    expect(screen.getByText("테마 RS 추이")).toBeInTheDocument();
    expect(screen.getByText("종목 분석")).toBeInTheDocument();
  });

  it("should update source label when source changes", async () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01"],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />, { wrapper: TestWrapper });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText("52주 신고가")).toBeInTheDocument();
    });

    // Switch to MTT - use button element specifically
    const buttons = screen.getAllByText("MTT 종목");
    const mttButton = buttons.find(btn => btn.tagName === "BUTTON");
    if (!mttButton) throw new Error("MTT button not found");
    fireEvent.click(mttButton);

    // Assert - button should have active class
    await waitFor(() => {
      expect(mttButton).toHaveClass("bg-blue-600");
    });
  });
});
