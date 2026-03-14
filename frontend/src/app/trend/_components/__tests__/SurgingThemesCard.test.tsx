/**
 * SurgingThemesCard 컴포넌트 테스트
 * SPEC-MTT-003 F-01, F-04: 신규 급등 테마 탐지 UI 컴포넌트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SurgingThemesCard } from "../SurgingThemesCard";
import * as useThemes from "@/hooks/useThemes";

// Mock useThemes hook
vi.mock("@/hooks/useThemes");

describe("SurgingThemesCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test 1: 데이터 렌더링 (R-01-1, R-01-2)
   * 급등 테마 목록이 올바르게 표시되는지 확인
   */
  it("should render surging themes with correct data", () => {
    // Arrange
    const mockThemes = [
      {
        date: "2024-01-01",
        theme_name: "반도체",
        avg_rs: 85.2,
        avg_rs_5d: 70.1,
        rs_change: 15.1,
        stock_count: 12
      },
      {
        date: "2024-01-01",
        theme_name: "AI",
        avg_rs: 78.5,
        avg_rs_5d: 65.0,
        rs_change: 13.5,
        stock_count: 8
      }
    ];

    vi.spyOn(useThemes, "useThemesSurging").mockReturnValue({
      data: mockThemes,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<SurgingThemesCard date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText("반도체")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    // RS 변화량이 + 접두사와 녹색으로 표시되어야 함
    expect(screen.getByText(/\+15\.1/)).toBeInTheDocument();
    expect(screen.getByText(/\+13\.5/)).toBeInTheDocument();
    // 평균 RS 점수 표시
    expect(screen.getByText("85.2")).toBeInTheDocument();
    expect(screen.getByText("70.1")).toBeInTheDocument();
  });

  /**
   * Test 2: 로딩 상태 (R-03-1)
   * 로딩 중 스켈레톤 UI가 표시되는지 확인
   */
  it("should render loading skeleton", () => {
    // Arrange
    vi.spyOn(useThemes, "useThemesSurging").mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    // Act
    render(<SurgingThemesCard date="2024-01-01" source="52w_high" />);

    // Assert
    // 스켈레톤 요소가 렌더링되어야 함 (animate-pulse 클래스 확인)
    const skeletonElements = document.querySelectorAll(".animate-pulse");
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  /**
   * Test 3: 빈 상태 (R-03-2)
   * 급등 테마 없을 때 안내 메시지가 표시되는지 확인
   */
  it("should render empty state message", () => {
    // Arrange
    vi.spyOn(useThemes, "useThemesSurging").mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<SurgingThemesCard date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText(/현재 기준\(\+10\) 이상 급등한 테마가 없습니다/)).toBeInTheDocument();
    expect(screen.getByText(/기준값을 낮추면 더 많은 테마를 확인할 수 있습니다/)).toBeInTheDocument();
  });

  /**
   * Test 4: 에러 상태 (R-03-3)
   * API 실패 시 에러 메시지가 표시되는지 확인
   */
  it("should render error state", () => {
    // Arrange
    vi.spyOn(useThemes, "useThemesSurging").mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to fetch"),
    } as any);

    // Act
    render(<SurgingThemesCard date="2024-01-01" source="52w_high" />);

    // Assert
    expect(screen.getByText(/데이터를 불러오는데 실패했습니다/)).toBeInTheDocument();
  });

  /**
   * Test 5: Threshold 변경 (R-01-3)
   * 슬라이더 값 변경 시 threshold 상태가 업데이트되는지 확인
   */
  it("should update threshold when slider changes", () => {
    // Arrange - 데이터가 있어야 슬라이더가 표시됨
    const mockThemes = [
      {
        date: "2024-01-01",
        theme_name: "반도체",
        avg_rs: 85.2,
        avg_rs_5d: 70.1,
        rs_change: 15.1,
        stock_count: 12
      }
    ];

    vi.spyOn(useThemes, "useThemesSurging").mockReturnValue({
      data: mockThemes,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<SurgingThemesCard date="2024-01-01" source="52w_high" />);

    // 기본값 확인 - 정규식 대신 함수 사용 (텍스트가 여러 노드로 나뉨)
    expect(screen.getByText((content) => content.includes("기준:") && content.includes("+10"))).toBeInTheDocument();

    // 슬라이더 찾기 - label로 찾기
    const slider = screen.getByLabelText(/기준:/);

    // Assert & Act
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("min", "5");
    expect(slider).toHaveAttribute("max", "50");
    expect(slider).toHaveAttribute("value", "10");

    // 슬라이더 값 변경 (fireEvent 사용)
    fireEvent.change(slider, { target: { value: "20" } });

    // 변경된 값이 표시되어야 함
    expect(screen.getByText((content) => content.includes("기준:") && content.includes("+20"))).toBeInTheDocument();
  });
});
