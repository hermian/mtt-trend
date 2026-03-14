/**
 * TopThemesBar 컴포넌트 테스트
 * SPEC-MTT-002 F-03: 테마 트렌드 화면 - 상위 테마 바 차트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopThemesBar } from "../TopThemesBar";
import * as useThemes from "@/hooks/useThemes";

// Mock useThemes hook
vi.mock("@/hooks/useThemes");

describe("TopThemesBar Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state", () => {
    // Arrange
    vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isFetching: false,
      status: "pending",
      fetchStatus: "idle",
      refetch: vi.fn(),
      remove: vi.fn()
    } as any);

    // Act
    render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText(/로딩 중/i)).toBeInTheDocument();
  });

  it("should render error state", () => {
    // Arrange
    vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to fetch"),
      isFetching: false,
      status: "error",
      fetchStatus: "idle",
      refetch: vi.fn(),
      remove: vi.fn()
    } as any);

    // Act
    render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText(/데이터 로드 실패/i)).toBeInTheDocument();
  });

  it("should render top 15 themes bar chart", () => {
    // Arrange
    const mockThemes = Array.from({ length: 15 }, (_, i) => ({
      date: "2024-01-01",
      theme_name: `Theme ${i + 1}`,
      stock_count: 10 + i,
      avg_rs: 80 + i,
      change_sum: 5.0 + i * 0.5,
      volume_sum: 1000000 + i * 100000
    }));

    vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
      data: mockThemes,
      isLoading: false,
      error: null,
      isFetching: false,
      status: "success",
      fetchStatus: "idle",
      refetch: vi.fn(),
      remove: vi.fn()
    } as any);

    // Act
    render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText("Theme 1")).toBeInTheDocument();
    expect(screen.getByText("Theme 15")).toBeInTheDocument();
  });

  it("should limit to top 15 themes when more are available", () => {
    // Arrange
    const mockThemes = Array.from({ length: 20 }, (_, i) => ({
      date: "2024-01-01",
      theme_name: `Theme ${i + 1}`,
      stock_count: 10 + i,
      avg_rs: 80 + i,
      change_sum: 5.0 + i * 0.5,
      volume_sum: 1000000 + i * 100000
    }));

    vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
      data: mockThemes,
      isLoading: false,
      error: null,
      isFetching: false,
      status: "success",
      fetchStatus: "idle",
      refetch: vi.fn(),
      remove: vi.fn()
    } as any);

    // Act
    const { container } = render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert
    // Theme 16-20 should not be rendered (only top 15)
    expect(screen.queryByText("Theme 16")).not.toBeInTheDocument();
    expect(screen.queryByText("Theme 20")).not.toBeInTheDocument();
  });

  it("should display RS scores correctly", () => {
    // Arrange
    const mockThemes = [
      {
        date: "2024-01-01",
        theme_name: "AI",
        stock_count: 10,
        avg_rs: 85.5,
        change_sum: 5.2,
        volume_sum: 1000000
      }
    ];

    vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
      data: mockThemes,
      isLoading: false,
      error: null,
      isFetching: false,
      status: "success",
      fetchStatus: "idle",
      refetch: vi.fn(),
      remove: vi.fn()
    } as any);

    // Act
    render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText(/85\.5/)).toBeInTheDocument();
  });
});
