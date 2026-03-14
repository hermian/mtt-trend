/**
 * StockAnalysisTabs 컴포넌트 테스트
 * SPEC-MTT-002 F-05: 종목 분석 탭
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StockAnalysisTabs } from "../StockAnalysisTabs";
import * as useStocks from "@/hooks/useStocks";
import * as useThemes from "@/hooks/useThemes";

// Mock hooks
vi.mock("@/hooks/useStocks");
vi.mock("@/hooks/useThemes");

describe("StockAnalysisTabs Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render tab buttons", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksPersistent").mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    } as any);
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<StockAnalysisTabs date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText("지속 강세 종목")).toBeInTheDocument();
    expect(screen.getByText("그룹 액션")).toBeInTheDocument();
  });

  it("should switch tabs when clicked", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksPersistent").mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    } as any);
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<StockAnalysisTabs date="2024-01-01" source="52w_high" />);

    // Initial tab should be "지속 강세 종목"
    const persistentTab = screen.getByText("지속 강세 종목");
    expect(persistentTab).toHaveClass("bg-blue-600");

    // Click on "그룹 액션" tab
    const groupActionTab = screen.getByText("그룹 액션");
    fireEvent.click(groupActionTab);

    // Assert - tab should be active
    expect(groupActionTab).toHaveClass("bg-blue-600");
  });

  it("should render persistent stocks table", () => {
    // Arrange
    const mockStocks = [
      {
        stock_name: "Samsung Electronics",
        appearance_count: 5,
        avg_rs: 90.0,
        themes: ["AI", "Semiconductor"]
      }
    ];

    vi.spyOn(useStocks, "useStocksPersistent").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null
    } as any);
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<StockAnalysisTabs date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText("Samsung Electronics")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/90\.0/)).toBeInTheDocument();
  });

  it("should render group action table", () => {
    // Arrange
    const mockStocks = [
      {
        stock_name: "SK Hynix",
        rs_score: 95.0,
        change_pct: 3.5,
        theme_name: "Semiconductor",
        theme_rs_change: 5.0,
        first_seen_date: "2024-01-01"
      }
    ];

    vi.spyOn(useStocks, "useStocksPersistent").mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    } as any);
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<StockAnalysisTabs date="2024-01-01" source="52w_high" />);

    // Switch to group action tab
    fireEvent.click(screen.getByText("그룹 액션"));

    // Assert
    expect(screen.getByText("SK Hynix")).toBeInTheDocument();
    expect(screen.getByText(/95\.0/)).toBeInTheDocument();
    expect(screen.getByText(/3\.5/)).toBeInTheDocument();
  });

  it("should show loading state", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksPersistent").mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null
    } as any);
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<StockAnalysisTabs date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText(/로딩 중/i)).toBeInTheDocument();
  });

  it("should show error state", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksPersistent").mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to fetch")
    } as any);
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null
    } as any);

    // Act
    render(<StockAnalysisTabs date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText(/데이터 로드 실패/i)).toBeInTheDocument();
  });
});
