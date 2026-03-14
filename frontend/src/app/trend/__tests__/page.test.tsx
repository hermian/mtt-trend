/**
 * TrendPage 통합 테스트
 * SPEC-MTT-002 F-03, F-06: 테마 트렌드 페이지 및 공통 UX
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TrendPage from "../page";
import * as useThemes from "@/hooks/useThemes";

// Mock hooks
vi.mock("@/hooks/useThemes");

describe("TrendPage Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render page header", () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01", "2024-01-02"],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />);

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
    render(<TrendPage />);

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
    render(<TrendPage />);

    const mttButton = screen.getByText("MTT 종목");
    fireEvent.click(mttButton);

    // Assert
    expect(mttButton).toHaveClass("bg-blue-600");
  });

  it("should reset date when source changes", async () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01", "2024-01-02"],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />);

    // Wait for initial date selection
    await waitFor(() => {
      expect(screen.getByDisplayValue("2024-01-02")).toBeInTheDocument();
    });

    // Switch source
    const mttButton = screen.getByText("MTT 종목");
    fireEvent.click(mttButton);

    // Assert - date should be reset (no value selected)
    await waitFor(() => {
      const select = screen.getByRole("combobox");
      expect(select).toHaveValue("");
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
    render(<TrendPage />);

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
    render(<TrendPage />);

    // Assert
    expect(screen.getByText(/로딩 중/i)).toBeInTheDocument();
  });

  it("should show error state for dates", () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to fetch dates")
    } as any);

    // Act
    render(<TrendPage />);

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
    render(<TrendPage />);

    // Assert
    expect(screen.queryByText("테마별 RS 점수 (상위 15)")).not.toBeInTheDocument();
    expect(screen.getByText("날짜를 선택하세요")).toBeInTheDocument();
  });

  it("should render all sections when date is selected", async () => {
    // Arrange
    vi.spyOn(useThemes, "useDates").mockReturnValue({
      data: ["2024-01-01"],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<TrendPage />);

    // Wait for date to be selected
    await waitFor(() => {
      expect(screen.getByDisplayValue("2024-01-01")).toBeInTheDocument();
    });

    // Assert - all sections should be visible (SPEC-MTT-003 F-02)
    expect(screen.getByText("테마별 RS 점수 (상위 15)")).toBeInTheDocument();
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
    render(<TrendPage />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText("52주 신고가")).toBeInTheDocument();
    });

    // Switch to MTT
    fireEvent.click(screen.getByText("MTT 종목"));

    // Assert - label should update
    await waitFor(() => {
      expect(screen.getByText(/MTT 종목/)).toBeInTheDocument();
    });
  });
});
