import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopThemesBar } from "./TopThemesBar";

// Mock the useThemesDaily hook
vi.mock("@/hooks/useThemes", () => ({
  useThemesDaily: vi.fn(),
}));

import { useThemesDaily } from "@/hooks/useThemes";

// Mock data
const mockThemes = [
  {
    theme_name: "Theme 1",
    avg_rs: 90,
    stock_count: 10,
    change_sum: 5.5,
  },
  {
    theme_name: "Theme 2",
    avg_rs: 80,
    stock_count: 8,
    change_sum: 3.2,
  },
  {
    theme_name: "Theme 3",
    avg_rs: 70,
    stock_count: 6,
    change_sum: 2.1,
  },
  {
    theme_name: "Theme 4",
    avg_rs: 60,
    stock_count: 5,
    change_sum: 1.5,
  },
  {
    theme_name: "Theme 5",
    avg_rs: 50,
    stock_count: 4,
    change_sum: 1.0,
  },
  {
    theme_name: "Theme 6",
    avg_rs: 40,
    stock_count: 3,
    change_sum: 0.8,
  },
  {
    theme_name: "Theme 7",
    avg_rs: 30,
    stock_count: 2,
    change_sum: 0.5,
  },
  {
    theme_name: "Theme 8",
    avg_rs: 20,
    stock_count: 1,
    change_sum: 0.3,
  },
  {
    theme_name: "Theme 9",
    avg_rs: 15,
    stock_count: 1,
    change_sum: 0.2,
  },
  {
    theme_name: "Theme 10",
    avg_rs: 10,
    stock_count: 1,
    change_sum: 0.1,
  },
  {
    theme_name: "Theme 11",
    avg_rs: 8,
    stock_count: 1,
    change_sum: 0.0,
  },
  {
    theme_name: "Theme 12",
    avg_rs: 6,
    stock_count: 1,
    change_sum: 0.0,
  },
];

describe("TopThemesBar - SPEC-MTT-004 F-01: 상위 테마 표시 개수 동적 설정", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-01-1: 기본값으로 상위 10개 테마 표시
   * Given: 컴포넌트가 마운트될 때
   * When: 사용자가 표시 개수를 설정하지 않은 경우
   * Then: 상위 10개 테마가 표시되어야 한다
   */
  it("AC-01-1: 기본값으로 상위 10개 테마 표시", async () => {
    // Arrange
    vi.mocked(useThemesDaily).mockReturnValue({
      data: mockThemes,
      isLoading: false,
      error: null,
    });

    // Act
    render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert
    await waitFor(() => {
      // 기본값 10이 표시되는지 확인 (슬라이더 라벨)
      const countLabel = screen.getByText(/표시: 10개/);
      expect(countLabel).toBeInTheDocument();

      // 슬라이더의 기본값 확인
      const slider = screen.getByRole("slider", { name: /테마 개수 설정/ });
      expect(slider).toHaveAttribute("value", "10");

      // 차트 컨테이너가 렌더링되었는지 확인
      const chartContainer = document.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  /**
   * AC-01-2: 테마 개수 설정값 변경 (20개로 변경 시 즉시 업데이트)
   * Given: 컴포넌트가 마운트되고 10개가 표시된 상태
   * When: 사용자가 슬라이더를 20으로 변경하면
   * Then: 상위 20개 테마가 즉시 표시되어야 한다
   */
  it("AC-01-2: 테마 개수 설정값 변경 (20개로 변경 시 즉시 업데이트)", async () => {
    // Arrange
    vi.mocked(useThemesDaily).mockReturnValue({
      data: mockThemes,
      isLoading: false,
      error: null,
    });

    // Act
    render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // 기본 상태 확인
    await waitFor(() => {
      expect(screen.getByText(/표시: 10개/)).toBeInTheDocument();
    });

    // 슬라이더 찾기
    const slider = screen.getByRole("slider", { name: /테마 개수 설정/ });
    expect(slider).toBeInTheDocument();

    // 슬라이더 값을 20으로 변경 (fireEvent 사용 - range input)
    fireEvent.input(slider, { target: { value: "20" } });

    // Assert
    await waitFor(() => {
      // 변경된 값 20이 표시되는지 확인
      const updatedLabel = screen.getByText(/표시: 20개/);
      expect(updatedLabel).toBeInTheDocument();
    });
  });

  /**
   * AC-01-3: 설정 범위 제한 (최소 5, 최대 30)
   * Given: 컴포넌트가 마운트된 상태
   * When: 사용자가 슬라이더의 최소/최대값을 확인하면
   * Then: min=5, max=30으로 설정되어야 한다
   */
  it("AC-01-3: 설정 범위 제한 (최소 5, 최대 30)", async () => {
    // Arrange
    vi.mocked(useThemesDaily).mockReturnValue({
      data: mockThemes,
      isLoading: false,
      error: null,
    });

    // Act
    render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // Assert
    await waitFor(() => {
      const slider = screen.getByRole("slider", { name: /테마 개수 설정/ });
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute("min", "5");
      expect(slider).toHaveAttribute("max", "30");
    });
  });

  /**
   * AC-01-4: 데이터 수 초과 방어 처리
   * Given: 컴포넌트가 마운트되고 실제 데이터가 12개인 상태
   * When: 사용자가 표시 개수를 20으로 설정하면
   * Then: 에러 없이 실제 데이터 수인 12개만 표시되어야 한다
   */
  it("AC-01-4: 데이터 수 초과 방어 처리", async () => {
    // Arrange
    const limitedThemes = mockThemes.slice(0, 12);
    vi.mocked(useThemesDaily).mockReturnValue({
      data: limitedThemes,
      isLoading: false,
      error: null,
    });

    // Act
    render(<TopThemesBar date="2024-01-01" source="52w_high" />);

    // 슬라이더를 20으로 변경 (fireEvent 사용 - range input)
    const slider = screen.getByRole("slider", { name: /테마 개수 설정/ });
    fireEvent.input(slider, { target: { value: "20" } });

    // Assert
    await waitFor(() => {
      // 슬라이더 값이 20으로 변경되었는지 확인
      expect(slider).toHaveAttribute("value", "20");

      // 라벨이 20개로 표시되는지 확인
      const updatedLabel = screen.getByText(/표시: 20개/);
      expect(updatedLabel).toBeInTheDocument();

      // 에러 메시지가 표시되지 않아야 함
      expect(screen.queryByText(/에러/)).not.toBeInTheDocument();

      // 차트가 정상적으로 렌더링되어야 함
      const chartContainer = document.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });
});
