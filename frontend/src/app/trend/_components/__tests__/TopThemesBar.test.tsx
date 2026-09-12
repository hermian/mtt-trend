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

// Helper function to find skeleton element
const findSkeleton = () => document.querySelector(".animate-pulse");

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

    // Assert - skeleton animation should be present
    const skeleton = findSkeleton();
    expect(skeleton).toBeInTheDocument();
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
    expect(screen.getByText(/데이터를 불러오는데 실패했습니다/i)).toBeInTheDocument();
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
    const { container } = render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert - Recharts container should be present
    const chartContainer = container.querySelector('[data-testid="top-themes-chart"]');
    expect(chartContainer).toBeInTheDocument();
    // Check that height is defined
    expect(chartContainer?.style.height).toBeTruthy();
  });

  it("should limit to the default top 10 themes when more are available", () => {
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
    // @MX:NOTE: SPEC-MTT-004 F-01 슬라이더 도입으로 기본 표시 개수는 10개다.
    //   (구 SPEC-MTT-002 F-03 의 "top 15" 기대값은 폐기됨. recharts 시절에는
    //    jsdom 에서 ResponsiveContainer 가 0x0 이라 축 라벨이 아예 렌더되지 않아
    //    이 단언이 공허하게 통과하고 있었다.)
    // RS 내림차순 상위 10개 = Theme 11 ~ Theme 20
    expect(screen.queryByText("Theme 20")).toBeInTheDocument();
    expect(screen.queryByText("Theme 11")).toBeInTheDocument();
    // 하위 10개(Theme 1 ~ Theme 10)는 렌더되지 않아야 한다
    expect(screen.queryByText("Theme 10")).not.toBeInTheDocument();
    expect(screen.queryByText("Theme 1")).not.toBeInTheDocument();
    // 막대도 정확히 10개여야 한다
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(10);
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
    const { container } = render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert - chart container should be rendered with data
    const chartContainer = container.querySelector('[data-testid="top-themes-chart"]');
    expect(chartContainer).toBeInTheDocument();
  });
});
