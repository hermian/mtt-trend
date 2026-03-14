/**
 * GroupActionTable 컴포넌트 테스트
 * 신규 테마 주식 상태 버그 수정 (theme_rs_change === null인 경우 "신규 테마"로 표시)
 * SPEC-MTT-006 F-04: UI 파라미터 컨트롤 슬라이더 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

// SPEC-MTT-006 F-04: UI 파라미터 컨트롤 테스트
describe("GroupActionTable Component - SPEC-MTT-006 F-04: UI Parameter Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockStocks: GroupActionStock[] = [
    {
      stock_name: "삼성전자",
      rs_score: 75.5,
      change_pct: 3.2,
      theme_name: "반도체",
      theme_rs_change: 8.5,
      first_seen_date: "2024-01-15",
      status_threshold: 5,
    },
  ];

  /**
   * Test 1: 시간 윈도우 슬라이더 존재 확인
   * 페이지 렌더링 시 시간 윈도우 슬라이더가 표시되어야 함
   */
  it("should render time window slider with correct attributes", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    const timeWindowSlider = screen.getByLabelText("시간 윈도우");
    expect(timeWindowSlider).toBeInTheDocument();
    expect(timeWindowSlider).toHaveAttribute("type", "range");
    expect(timeWindowSlider).toHaveAttribute("min", "1");
    expect(timeWindowSlider).toHaveAttribute("max", "7");
    expect(timeWindowSlider).toHaveAttribute("step", "1");
  });

  /**
   * Test 2: 시간 윈도우 기본값 표시
   * 슬라이더 기본값이 3이어야 함
   */
  it("should display time window default value as 3", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    const timeWindowSlider = screen.getByLabelText("시간 윈도우");
    expect(timeWindowSlider).toBeInTheDocument();
    expect(timeWindowSlider).toHaveValue("3");
    // 레이블 텍스트 확인
    expect(screen.getByText("시간 윈도우: 3일")).toBeInTheDocument();
  });

  /**
   * Test 3: RS 임계값 슬라이더 존재 확인
   * 페이지 렌더링 시 RS 임계값 슬라이더가 표시되어야 함
   */
  it("should render RS threshold slider with correct attributes", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    const rsThresholdSlider = screen.getByLabelText("RS 임계값");
    expect(rsThresholdSlider).toBeInTheDocument();
    expect(rsThresholdSlider).toHaveAttribute("type", "range");
    expect(rsThresholdSlider).toHaveAttribute("min", "-10");
    expect(rsThresholdSlider).toHaveAttribute("max", "20");
    expect(rsThresholdSlider).toHaveAttribute("step", "1");
  });

  /**
   * Test 4: RS 임계값 기본값 표시
   * 슬라이더 기본값이 0이어야 함
   */
  it("should display RS threshold default value as 0", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    const rsThresholdSlider = screen.getByLabelText("RS 임계값");
    expect(rsThresholdSlider).toHaveValue("0");
  });

  /**
   * Test 5: 상태 임계값 슬라이더 존재 확인
   * 페이지 렌더링 시 상태 임계값 슬라이더가 표시되어야 함
   */
  it("should render status threshold slider with correct attributes", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    const statusThresholdSlider = screen.getByLabelText("상태 임계값");
    expect(statusThresholdSlider).toBeInTheDocument();
    expect(statusThresholdSlider).toHaveAttribute("type", "range");
    expect(statusThresholdSlider).toHaveAttribute("min", "1");
    expect(statusThresholdSlider).toHaveAttribute("max", "20");
    expect(statusThresholdSlider).toHaveAttribute("step", "1");
  });

  /**
   * Test 6: 상태 임계값 기본값 표시
   * 슬라이더 기본값이 5이어야 함
   */
  it("should display status threshold default value as 5", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    const statusThresholdSlider = screen.getByLabelText("상태 임계값");
    expect(statusThresholdSlider).toHaveValue("5");
  });

  /**
   * Test 7: 시간 윈도우 슬라이더 조작 시 API 재호출
   * 시간 윈도우 슬라이더를 변경하면 새 값으로 API가 호출되어야 함
   */
  it("should call API with new time window value when slider changes", async () => {
    // Arrange
    const mockUseStocksGroupAction = vi.fn();
    vi.spyOn(useStocks, "useStocksGroupAction").mockImplementation(mockUseStocksGroupAction);

    mockUseStocksGroupAction.mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    });

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    const timeWindowSlider = screen.getByLabelText("시간 윈도우");
    fireEvent.change(timeWindowSlider, { target: { value: "5" } });

    // Assert
    await waitFor(() => {
      expect(mockUseStocksGroupAction).toHaveBeenCalledWith(
        "2024-01-15",
        "52w_high",
        5,  // 새 timeWindow 값
        0   // 기본 rsThreshold
      );
    });
  });

  /**
   * Test 8: RS 임계값 슬라이더 조작 시 API 재호출
   * RS 임계값 슬라이더를 변경하면 새 값으로 API가 호출되어야 함
   */
  it("should call API with new RS threshold value when slider changes", async () => {
    // Arrange
    const mockUseStocksGroupAction = vi.fn();
    vi.spyOn(useStocks, "useStocksGroupAction").mockImplementation(mockUseStocksGroupAction);

    mockUseStocksGroupAction.mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    });

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    const rsThresholdSlider = screen.getByLabelText("RS 임계값");
    fireEvent.change(rsThresholdSlider, { target: { value: "10" } });

    // Assert
    await waitFor(() => {
      expect(mockUseStocksGroupAction).toHaveBeenCalledWith(
        "2024-01-15",
        "52w_high",
        3,   // 기본 timeWindow
        10   // 새 rsThreshold 값
      );
    });
  });

  /**
   * Test 9: 상태 임계값 슬라이더 조작 시 API 미호출
   * 상태 임계값은 클라이언트에서만 사용되므로 API 인자에 포함되지 않아야 함
   */
  it("should NOT call API when status threshold slider changes (client-side only)", () => {
    // Arrange
    const mockUseStocksGroupAction = vi.fn(() => ({
      data: mockStocks,
      isLoading: false,
      error: null,
    }));
    vi.spyOn(useStocks, "useStocksGroupAction").mockImplementation(mockUseStocksGroupAction);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // 상태 임계값 슬라이더 변경
    const statusThresholdSlider = screen.getByLabelText("상태 임계값");
    fireEvent.change(statusThresholdSlider, { target: { value: "10" } });

    // Assert - API 함수의 모든 호출을 확인하고, statusThreshold가 인자에 없는지 확인
    const allCalls = mockUseStocksGroupAction.mock.calls;
    allCalls.forEach(call => {
      // call은 [date, source, timeWindow, rsThreshold] 형태
      // statusThreshold는 포함되지 않아야 함 (4개 인자만 있어야 함)
      expect(call.length).toBe(4); // date, source, timeWindow, rsThreshold

      // statusThreshold가 인자에 포함되지 않는지 확인
      const hasStatusThresholdParam = call.some(arg => arg === 10 || arg === "10");
      expect(hasStatusThresholdParam).toBe(false);
    });
  });

  /**
   * Test 10: 현재 슬라이더 값 표시
   * 각 슬라이더 옆에 현재 값이 텍스트로 표시되어야 함
   */
  it("should display current value next to each slider", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert - 레이블과 값이 함께 표시되는지 확인
    expect(screen.getByText("시간 윈도우: 3일")).toBeInTheDocument();
    expect(screen.getByText("RS 임계값: 0")).toBeInTheDocument();
    expect(screen.getByText("상태 임계값: 5")).toBeInTheDocument();
  });

  /**
   * Test 11: 슬라이더 범위 표시
   * 각 슬라이더의 최소/최대 범위가 표시되어야 함
   */
  it("should display slider range labels", () => {
    // Arrange
    vi.spyOn(useStocks, "useStocksGroupAction").mockReturnValue({
      data: mockStocks,
      isLoading: false,
      error: null,
    } as any);

    // Act
    render(<GroupActionTable date="2024-01-15" source="52w_high" />);

    // Assert
    expect(screen.getByText(/\[1-7\]/)).toBeInTheDocument();    // 시간 윈도우 범위
    expect(screen.getByText(/\[-10~\+20\]/)).toBeInTheDocument(); // RS 임계값 범위
    expect(screen.getByText(/\[1-20\]/)).toBeInTheDocument();   // 상태 임계값 범위
  });
});
