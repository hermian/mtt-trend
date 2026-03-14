/**
 * GroupActionTable 컴포넌트 테스트
 * 신규 테마 주식 상태 버그 수정 (theme_rs_change === null인 경우 "신규 테마"로 표시)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GroupActionTable } from "../GroupActionTable";
import * as useStocks from "@/hooks/useStocks";
import { GroupActionStock } from "@/lib/api";

// Mock useStocks hook
vi.mock("@/hooks/useStocks");

describe("GroupActionTable Component - Stock Status Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test 1: 신규 테마 상태 (theme_rs_change === null)
   * 어제 데이터가 없는 새로운 테마의 경우 "신규 테마" 상태를 반환해야 함
   */
  it("should return 'new_theme' status when theme_rs_change is null", () => {
    // Arrange
    const mockStock: GroupActionStock = {
      stock_name: "삼성전자",
      rs_score: 75.5,
      change_pct: 3.2,
      theme_name: "신규테마",
      theme_rs_change: null, // 신규 테마 (어제 데이터 없음)
      first_seen_date: "2024-01-15",
    };

    const mockStocks = [mockStock];

    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    // "신규 테마" 뱃지가 표시되어야 함
    const newThemeBadge = screen.getByText("신규 테마");
    expect(newThemeBadge).toBeInTheDocument();
    expect(newThemeBadge).toHaveClass("bg-purple-500/20", "text-purple-300", "border-purple-500/30");
  });

  /**
   * Test 2: 신규 상태 (theme_rs_change > 5)
   * 테마 RS 변화가 5보다 큰 경우 "신규" 상태를 반환해야 함
   */
  it("should return 'new' status when theme_rs_change > 5", () => {
    // Arrange
    const mockStock: GroupActionStock = {
      stock_name: "SK하이닉스",
      rs_score: 68.2,
      change_pct: 2.5,
      theme_name: "반도체",
      theme_rs_change: 8.5, // 신규 모멘텀 획득
      first_seen_date: "2024-01-10",
    };

    const mockStocks = [mockStock];

    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    // "신규" 뱃지가 표시되어야 함
    const newBadge = screen.getByText("신규");
    expect(newBadge).toBeInTheDocument();
    expect(newBadge).toHaveClass("bg-green-500/20", "text-green-300", "border-green-500/30");
  });

  /**
   * Test 3: 재등장 상태 (theme_rs_change < -5)
   * 테마 RS 변화가 -5보다 작은 경우 "재등장" 상태를 반환해야 함
   */
  it("should return 'returning' status when theme_rs_change < -5", () => {
    // Arrange
    const mockStock: GroupActionStock = {
      stock_name: "LG화학",
      rs_score: 55.8,
      change_pct: -1.2,
      theme_name: "배터리",
      theme_rs_change: -7.3, // 모멘텀 상실 후 재등장
      first_seen_date: "2024-01-05",
    };

    const mockStocks = [mockStock];

    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    // "재등장" 뱃지가 표시되어야 함
    const returningBadge = screen.getByText("재등장");
    expect(returningBadge).toBeInTheDocument();
    expect(returningBadge).toHaveClass("bg-yellow-500/20", "text-yellow-300", "border-yellow-500/30");
  });

  /**
   * Test 4: 유지 상태 (-5 <= theme_rs_change <= 5)
   * 테마 RS 변화가 -5와 5 사이인 경우 "유지" 상태를 반환해야 함
   */
  it("should return 'neutral' status when -5 <= theme_rs_change <= 5", () => {
    // Arrange
    const mockStocks: GroupActionStock[] = [
      {
        stock_name: "현대차",
        rs_score: 62.5,
        change_pct: 1.8,
        theme_name: "자동차",
        theme_rs_change: 3.2, // 유지 범위 내
        first_seen_date: "2024-01-08",
      },
      {
        stock_name: "기아",
        rs_score: 58.3,
        change_pct: 0.5,
        theme_name: "자동차",
        theme_rs_change: 0.0, // 정확히 0
        first_seen_date: "2024-01-08",
      },
      {
        stock_name: "삼성SDI",
        rs_score: 60.1,
        change_pct: -0.8,
        theme_name: "배터리",
        theme_rs_change: -2.5, // 음수지만 유지 범위 내
        first_seen_date: "2024-01-12",
      },
    ];

    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    // 모든 종목이 "유지" 뱃지를 표시해야 함
    const neutralBadges = screen.getAllByText("유지");
    expect(neutralBadges).toHaveLength(3);
    neutralBadges.forEach(badge => {
      expect(badge).toHaveClass("bg-gray-500/20", "text-gray-300", "border-gray-500/30");
    });
  });

  /**
   * Test 5: 경계값 테스트
   * theme_rs_change가 정확히 5 또는 -5인 경우 "유지" 상태여야 함
   */
  it("should return 'neutral' status for boundary values (5 and -5)", () => {
    // Arrange
    const mockStocks: GroupActionStock[] = [
      {
        stock_name: "카카오",
        rs_score: 65.4,
        change_pct: 2.1,
        theme_name: "IT",
        theme_rs_change: 5.0, // 정확히 5
        first_seen_date: "2024-01-10",
      },
      {
        stock_name: "네이버",
        rs_score: 63.8,
        change_pct: 1.5,
        theme_name: "IT",
        theme_rs_change: -5.0, // 정확히 -5
        first_seen_date: "2024-01-10",
      },
    ];

    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    const neutralBadges = screen.getAllByText("유지");
    expect(neutralBadges).toHaveLength(2);
  });

  /**
   * Test 6: 혼합 상태 테스트
   * 다양한 상태를 가진 주식들이 올바르게 렌더링되어야 함
   */
  it("should render all status types correctly in mixed scenarios", () => {
    // Arrange
    const mockStocks: GroupActionStock[] = [
      {
        stock_name: "신규테마종목",
        rs_score: 70.0,
        change_pct: 5.0,
        theme_name: "신규테마",
        theme_rs_change: null, // 신규 테마
        first_seen_date: "2024-01-15",
      },
      {
        stock_name: "모멘텀종목",
        rs_score: 75.5,
        change_pct: 3.2,
        theme_name: "반도체",
        theme_rs_change: 10.5, // 신규
        first_seen_date: "2024-01-10",
      },
      {
        stock_name: "유지종목",
        rs_score: 62.0,
        change_pct: 1.0,
        theme_name: "자동차",
        theme_rs_change: 2.0, // 유지
        first_seen_date: "2024-01-08",
      },
      {
        stock_name: "재등장종목",
        rs_score: 55.0,
        change_pct: -2.0,
        theme_name: "바이오",
        theme_rs_change: -8.5, // 재등장
        first_seen_date: "2024-01-05",
      },
    ];

    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    expect(screen.getByText("신규 테마")).toBeInTheDocument();
    expect(screen.getByText("신규")).toBeInTheDocument();
    expect(screen.getByText("유지")).toBeInTheDocument();
    expect(screen.getByText("재등장")).toBeInTheDocument();
  });

  /**
   * Test 7: RsChangeBadge 렌더링
   * theme_rs_change가 null인 경우 RsChangeBadge가 "-"를 표시해야 함
   */
  it("should render RsChangeBadge with '-' when theme_rs_change is null", () => {
    // Arrange
    const mockStock: GroupActionStock = {
      stock_name: "삼성전자",
      rs_score: 75.5,
      change_pct: 3.2,
      theme_name: "신규테마",
      theme_rs_change: null,
      first_seen_date: "2024-01-15",
    };

    const mockStocks = [mockStock];

    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    // 테마RS변화 열에 "-"가 표시되어야 함
    const dashElements = screen.getAllByText("-");
    expect(dashElements.length).toBeGreaterThan(0);
  });
});
