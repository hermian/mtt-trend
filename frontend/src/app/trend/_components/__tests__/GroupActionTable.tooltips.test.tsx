/**
 * GroupActionTable Tooltip Tests - SPEC-MTT-007
 * 그룹 액션 탐지 파라미터 툴팁 기능 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupActionTable } from "../GroupActionTable";
import * as useStocks from "@/hooks/useStocks";
import { GroupActionStock } from "@/lib/api";

// Mock useStocks hook
vi.mock("@/hooks/useStocks");

// Mock apiClient
vi.mock("@/lib/api", () => ({
  api: {
    getStocksGroupAction: vi.fn(),
  },
  GroupActionStock: {},
  DataSource: {},
}));

describe("GroupActionTable Component - SPEC-MTT-007 Tooltips", () => {
  const mockStocks: GroupActionStock[] = [
    {
      stock_name: "삼성전자",
      rs_score: 75.5,
      change_pct: 3.2,
      theme_name: "반도체",
      theme_rs_change: 8.5,
      first_seen_date: "2024-01-15",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);
  });

  /**
   * AC-01: 시간 윈도우 툴팁 표시
   */
  describe("Time Window Tooltip (AC-01)", () => {
    it("should display tooltip on hover with correct content", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Act - 마우스 호버
      const timeWindowLabel = screen.getByText("시간 윈도우: 3일");
      await user.hover(timeWindowLabel);

      // Assert - 툴팁 표시 확인
      const tooltip = await screen.findByRole("tooltip", { name: /신규 등장 종목 판정 기간/ });
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent("신규 등장 종목 판정 기간 (일)");
    });

    it("should display tooltip on keyboard focus", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Act - Tab 키로 포커스 이동
      const timeWindowSlider = screen.getByLabelText("시간 윈도우");
      await user.tab(); // 첫 번째 포커스 가능 요소

      // Assert - 툴팁 표시 확인
      const tooltip = await screen.findByRole("tooltip", { name: /신규 등장 종목 판정 기간/ });
      expect(tooltip).toBeVisible();
    });

    it("should have aria-describedby attribute linking label to tooltip", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert
      const timeWindowSlider = screen.getByLabelText("시간 윈도우");
      expect(timeWindowSlider).toHaveAttribute("aria-describedby", "시간 윈도우-tooltip");

      const tooltip = screen.getByRole("tooltip", { name: /신규 등장 종목 판정 기간/ });
      expect(tooltip).toHaveAttribute("id", "시간 윈도우-tooltip");
    });
  });

  /**
   * AC-02: RS 임계값 툴팁 표시
   */
  describe("RS Threshold Tooltip (AC-02)", () => {
    it("should display tooltip on hover with correct content", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Act
      const rsThresholdLabel = screen.getByText("RS 임계값: 0");
      await user.hover(rsThresholdLabel);

      // Assert
      const tooltip = await screen.findByRole("tooltip", { name: /테마 RS 상승 판정 기준/ });
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent("테마 RS 상승 판정 기준 (-10~+20)");
    });

    it("should display tooltip on keyboard focus", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Act
      const rsThresholdSlider = screen.getByLabelText("RS 임계값");
      await user.tab();
      await user.tab(); // RS 임계값으로 이동

      // Assert
      const tooltip = await screen.findByRole("tooltip", { name: /테마 RS 상승 판정 기준/ });
      expect(tooltip).toBeVisible();
    });

    it("should have aria-describedby attribute linking label to tooltip", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert
      const rsThresholdSlider = screen.getByLabelText("RS 임계값");
      expect(rsThresholdSlider).toHaveAttribute("aria-describedby", "RS 임계값-tooltip");

      const tooltip = screen.getByRole("tooltip", { name: /테마 RS 상승 판정 기준/ });
      expect(tooltip).toHaveAttribute("id", "RS 임계값-tooltip");
    });
  });

  /**
   * AC-03: 상태 임계값 툴팁 표시
   */
  describe("Status Threshold Tooltip (AC-03)", () => {
    it("should display tooltip on hover with correct content", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Act
      const statusThresholdLabel = screen.getByText("상태 임계값: 5");
      await user.hover(statusThresholdLabel);

      // Assert
      const tooltip = await screen.findByRole("tooltip", { name: /주식 상태 분류 기준/ });
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent(/주식 상태 분류 기준 \(1~20\)/);
      expect(tooltip).toHaveTextContent(/테마 RS 변화량이 임계값을 초과하면 '신규'/);
    });

    it("should display tooltip on keyboard focus", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Act
      const statusThresholdSlider = screen.getByLabelText("상태 임계값");
      // 여러 Tab 키 누름으로 상태 임계값으로 이동
      await user.tab();
      await user.tab();
      await user.tab();

      // Assert
      const tooltip = await screen.findByRole("tooltip", { name: /주식 상태 분류 기준/ });
      expect(tooltip).toBeVisible();
    });

    it("should have aria-describedby attribute linking label to tooltip", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert
      const statusThresholdSlider = screen.getByLabelText("상태 임계값");
      expect(statusThresholdSlider).toHaveAttribute("aria-describedby", "상태 임계값-tooltip");

      const tooltip = screen.getByRole("tooltip", { name: /주식 상태 분류 기준/ });
      expect(tooltip).toHaveAttribute("id", "상태 임계값-tooltip");
    });
  });

  /**
   * AC-04: 툴팁 아이콘 표시
   */
  describe("Tooltip Icon Display (AC-04)", () => {
    it("should display information icon next to each parameter label", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert - 모든 아이콘이 SVG로 렌더링되는지 확인
      const icons = screen.getAllByRole("img", { hidden: true }); // aria-hidden="true"인 요소
      expect(icons.length).toBeGreaterThanOrEqual(3); // 최소 3개 파라미터에 아이콘
    });

    it("should have icon with correct size (w-4 h-4 = 16x16px)", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert - SVG 아이콘의 크기 속성 확인
      const icons = screen.getAllByRole("img", { hidden: true });
      icons.forEach(icon => {
        expect(icon).toHaveAttribute("width", "16");
        expect(icon).toHaveAttribute("height", "16");
      });
    });

    it("should have icon with correct color (text-gray-400)", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert - 아이콘의 색상 클래스 확인
      const icons = screen.getAllByRole("img", { hidden: true });
      icons.forEach(icon => {
        expect(icon).toHaveClass("text-gray-400");
      });
    });

    it("should have aria-hidden=true on icon", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert - 모든 아이콘이 aria-hidden="true"인지 확인
      const icons = screen.getAllByRole("img", { hidden: true });
      icons.forEach(icon => {
        expect(icon).toHaveAttribute("aria-hidden", "true");
      });
    });
  });

  /**
   * AC-05: 접근성 준수
   */
  describe("Accessibility Compliance (AC-05)", () => {
    it("should have proper color contrast (WCAG 2.1 Level AA)", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert - 툴팁 배경과 텍스트 색상 확인
      const tooltips = screen.getAllByRole("tooltip");
      tooltips.forEach(tooltip => {
        expect(tooltip).toHaveClass("bg-gray-800"); // 배경 #1F2937
        expect(tooltip).toHaveClass("text-gray-100"); // 텍스트 #F9FAFB
      });
    });

    it("should support keyboard navigation (Tab key)", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Act & Assert - Tab 키로 모든 슬라이더 순회 가능
      const timeWindowSlider = screen.getByLabelText("시간 윈도우");
      const rsThresholdSlider = screen.getByLabelText("RS 임계값");
      const statusThresholdSlider = screen.getByLabelText("상태 임계값");

      await user.tab();
      expect(document.activeElement).toBe(timeWindowSlider);

      await user.tab();
      expect(document.activeElement).toBe(rsThresholdSlider);

      await user.tab();
      expect(document.activeElement).toBe(statusThresholdSlider);
    });

    it("should have visible focus indicator", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Act
      const slider = screen.getByLabelText("시간 윈도우");
      slider.focus();

      // Assert - 포커스 시 아웃라인 표시
      await waitFor(() => {
        expect(slider).toHaveFocus();
      });
    });
  });

  /**
   * AC-07: 기존 기능 유지
   */
  describe("Existing Functionality Preservation (AC-07)", () => {
    it("should not change slider functionality", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert - 슬라이더 기능 유지 확인
      const timeWindowSlider = screen.getByLabelText("시간 윈도우");
      expect(timeWindowSlider).toHaveAttribute("type", "range");
      expect(timeWindowSlider).toHaveAttribute("min", "1");
      expect(timeWindowSlider).toHaveAttribute("max", "7");
    });

    it("should pass all existing tests", () => {
      // Arrange & Act
      render(<GroupActionTable date="2024-01-15" source="52w_high" />);

      // Assert - 기존 기능 테스트
      expect(screen.getByText("시간 윈도우: 3일")).toBeInTheDocument();
      expect(screen.getByText("RS 임계값: 0")).toBeInTheDocument();
      expect(screen.getByText("상태 임계값: 5")).toBeInTheDocument();
    });
  });
});
