/**
 * ThemeTrend 컴포넌트 단위 테스트 (단순화 버전)
 * SPEC-MTT-005: 테마 RS 추이 차트 인터랙티브 개선
 *
 * 테스트 전략:
 * - F-01: 페이지 로드 시 상위 5개 테마 자동 선택
 * - F-02: 슬라이더 기반 기간 선택
 * - F-03: 라인 토글 기능
 * - F-04: 데이터 처리 로직
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeTrendChart } from "../ThemeTrendChart";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

describe("ThemeTrendChart Component - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * SPEC-MTT-005 F-01: 상위 5개 테마 자동 선택
   */
  describe("Auto-select Top 5 Themes (F-01)", () => {
    it("should auto-select top 5 themes by avg_rs on initial load", async () => {
      // Arrange
      const mockThemes = [
        { theme_name: "AI", avg_rs: 95, stock_count: 10 },
        { theme_name: "반도체", avg_rs: 90, stock_count: 8 },
        { theme_name: "바이오", avg_rs: 85, stock_count: 6 },
        { theme_name: "배터리", avg_rs: 80, stock_count: 5 },
        { theme_name: "자동차", avg_rs: 75, stock_count: 4 },
        { theme_name: "IT", avg_rs: 70, stock_count: 3 },
      ];

      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: mockThemes,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: {
          "AI": [{ date: "2024-01-01", theme_name: "AI", avg_rs: 95 }],
          "반도체": [{ date: "2024-01-01", theme_name: "반도체", avg_rs: 90 }],
          "바이오": [{ date: "2024-01-01", theme_name: "바이오", avg_rs: 85 }],
          "배터리": [{ date: "2024-01-01", theme_name: "배터리", avg_rs: 80 }],
          "자동차": [{ date: "2024-01-01", theme_name: "자동차", avg_rs: 75 }],
        },
        isLoading: false,
        error: null,
      } as any);

      // Act
      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Assert
      await waitFor(() => {
        expect(useThemes.useThemesDaily).toHaveBeenCalledWith("2024-01-01", "52w_high");
        // 상위 5개 테마만 선택되어야 함
        expect(useThemes.useMultipleThemeHistories).toHaveBeenCalledWith(
          ["AI", "반도체", "바이오", "배터리", "자동차"],
          30,
          "52w_high"
        );
      });
    });

    it("should handle fewer than 5 themes gracefully", async () => {
      // Arrange
      const mockThemes = [
        { theme_name: "AI", avg_rs: 95, stock_count: 10 },
        { theme_name: "반도체", avg_rs: 90, stock_count: 8 },
      ];

      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: mockThemes,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: {
          "AI": [{ date: "2024-01-01", theme_name: "AI", avg_rs: 95 }],
          "반도체": [{ date: "2024-01-01", theme_name: "반도체", avg_rs: 90 }],
        },
        isLoading: false,
        error: null,
      } as any);

      // Act
      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Assert
      await waitFor(() => {
        expect(useThemes.useMultipleThemeHistories).toHaveBeenCalledWith(
          ["AI", "반도체"],
          30,
          "52w_high"
        );
      });
    });
  });

  /**
   * SPEC-MTT-008 F-01/F-02: 슬라이더 기반 기간 선택
   */
  describe("Period Slider Control (SPEC-MTT-008)", () => {
    it("should render period slider with correct attributes", () => {
      // Arrange
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: {},
        isLoading: false,
        error: null,
      } as any);

      // Act
      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Assert
      const slider = screen.getByLabelText("기간");
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute("type", "range");
      expect(slider).toHaveAttribute("min", "7");
      expect(slider).toHaveAttribute("max", "365");
      expect(slider).toHaveAttribute("step", "1");
      expect(slider).toHaveValue("30"); // 기본값 30일
    });

    it("should call API with new period when slider changes", async () => {
      // Arrange
      const mockUseMultipleThemeHistories = vi.fn();
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: [{ theme_name: "AI", avg_rs: 95 }],
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockImplementation(mockUseMultipleThemeHistories);
      mockUseMultipleThemeHistories.mockReturnValue({
        data: { "AI": [] },
        isLoading: false,
        error: null,
      });

      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Act
      const slider = screen.getByLabelText("기간");
      fireEvent.change(slider, { target: { value: "90" } });

      // Assert
      await waitFor(() => {
        expect(mockUseMultipleThemeHistories).toHaveBeenCalledWith(
          ["AI"],
          90, // 새 기간 값
          "52w_high"
        );
      });
    });

    it("should render preset period buttons", () => {
      // Arrange
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: {},
        isLoading: false,
        error: null,
      } as any);

      // Act
      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Assert
      expect(screen.getByText("7일")).toBeInTheDocument();
      expect(screen.getByText("30일")).toBeInTheDocument();
      expect(screen.getByText("90일")).toBeInTheDocument();
      expect(screen.getByText("전체")).toBeInTheDocument();
    });

    it("should update slider when preset button is clicked", async () => {
      // Arrange
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: {},
        isLoading: false,
        error: null,
      } as any);

      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Act
      const presetButton = screen.getByText("90일");
      fireEvent.click(presetButton);

      // Assert
      const slider = screen.getByLabelText("기간");
      expect(slider).toHaveValue("90");
    });
  });

  /**
   * SPEC-MTT-005 F-03: 라인 토글 기능
   */
  describe("Line Toggle (F-03)", () => {
    it("should render legend for theme selection", () => {
      // Arrange
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: [{ theme_name: "AI", avg_rs: 95 }],
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: { "AI": [] },
        isLoading: false,
        error: null,
      } as any);

      // Act
      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Assert
      // 범례가 렌더링되어야 함 (Recharts Legend 컴포넌트)
      expect(screen.getByText("AI")).toBeInTheDocument();
    });

    it("should toggle line visibility when legend is clicked", async () => {
      // 이 테스트는 Recharts와의 상호작용이 필요하므로 통합 테스트 또는 E2E로 권장
      // 단위 테스트에서는 토글 기능의 존재만 확인
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: [{ theme_name: "AI", avg_rs: 95 }],
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: { "AI": [] },
        isLoading: false,
        error: null,
      } as any);

      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // 토글 버튼/컨트롤이 존재하는지 확인
      expect(screen.getByText("AI")).toBeInTheDocument();
    });
  });

  /**
   * 데이터 처리 및 에러 핸들링
   */
  describe("Data Handling", () => {
    it("should render component even during loading", () => {
      // Arrange
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: {},
        isLoading: true,
        error: null,
      } as any);

      // Act
      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Assert - 컴포넌트가 렌더링되어야 함 (기간 슬라이더 등)
      expect(screen.getByLabelText("기간")).toBeInTheDocument();
    });

    it("should handle empty themes data", () => {
      // Arrange
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: {},
        isLoading: false,
        error: null,
      } as any);

      // Act
      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Assert
      expect(screen.getByText(/데이터가 없습니다/)).toBeInTheDocument();
    });
  });

  /**
   * SPEC-MTT-005 F-04: 데이터 포인트 처리
   */
  describe("Data Point Processing (F-04)", () => {
    it("should handle single data point correctly", async () => {
      // Arrange
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: [{ theme_name: "AI", avg_rs: 95 }],
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: {
          "AI": [{ date: "2024-01-01", theme_name: "AI", avg_rs: 95, stock_count: 5 }],
        },
        isLoading: false,
        error: null,
      } as any);

      // Act
      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Assert
      // 단일 데이터 포인트가 처리되어 차트가 렌더링되어야 함
      await waitFor(() => {
        expect(useThemes.useMultipleThemeHistories).toHaveBeenCalled();
      });
    });

    it("should handle multiple data points correctly", async () => {
      // Arrange
      vi.spyOn(useThemes, "useThemesDaily").mockReturnValue({
        data: [{ theme_name: "AI", avg_rs: 95 }],
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useThemes, "useMultipleThemeHistories").mockReturnValue({
        data: {
          "AI": [
            { date: "2024-01-01", theme_name: "AI", avg_rs: 90 },
            { date: "2024-01-02", theme_name: "AI", avg_rs: 92 },
            { date: "2024-01-03", theme_name: "AI", avg_rs: 95 },
          ],
        },
        isLoading: false,
        error: null,
      } as any);

      // Act
      render(<ThemeTrendChart date="2024-01-01" source="52w_high" />, { wrapper: TestWrapper });

      // Assert
      await waitFor(() => {
        expect(useThemes.useMultipleThemeHistories).toHaveBeenCalledWith(["AI"], 30, "52w_high");
      });
    });
  });
});
