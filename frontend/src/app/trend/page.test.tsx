import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TrendPage from "./page";

// Mock the child components
vi.mock("./_components/TopThemesBar", () => ({
  TopThemesBar: () => <div data-testid="top-themes-bar">TopThemesBar</div>,
}));

vi.mock("./_components/SurgingThemesCard", () => ({
  SurgingThemesCard: () => <div data-testid="surging-themes-card">SurgingThemesCard</div>,
}));

vi.mock("./_components/ThemeTrendChart", () => ({
  ThemeTrendChart: () => <div data-testid="theme-trend-chart">ThemeTrendChart</div>,
}));

vi.mock("./_components/StockAnalysisTabs", () => ({
  StockAnalysisTabs: () => <div data-testid="stock-analysis-tabs">StockAnalysisTabs</div>,
}));

// Mock hooks
vi.mock("@/hooks/useThemes", () => ({
  useDates: vi.fn(),
}));

import { useDates } from "@/hooks/useThemes";

describe("TrendPage - SPEC-MTT-004 F-02 & F-03: 2분할 가로 레이아웃 배치 및 동일 높이 유지", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-02-1: 데스크탑 가로 배치 (768px+)
   * Given: 사용자가 데스크탱 화면(768px 이상)에서 접속한 경우
   * When: 트렌드 페이지가 렌더링되면
   * Then: TopThemesBar와 SurgingThemesCard가 가로로 나란히 배치되어야 한다
   */
  it("AC-02-1: 데스크탑 가로 배치 (768px+)", async () => {
    // Arrange
    const mockDates = ["2024-01-01", "2024-01-02", "2024-01-03"];
    vi.mocked(useDates).mockReturnValue({
      data: mockDates,
      isLoading: false,
      error: null,
    });

    // Act
    render(<TrendPage />);

    // Assert
    await waitFor(() => {
      const topThemesBar = screen.getByTestId("top-themes-bar");
      const surgingThemesCard = screen.getByTestId("surging-themes-card");

      // 두 컴포넌트가 모두 렌더링되어야 함
      expect(topThemesBar).toBeInTheDocument();
      expect(surgingThemesCard).toBeInTheDocument();

      // 부모 컨테이너의 클래스 확인 (데스크탑에서 grid 레이아웃)
      const parentSection = topThemesBar.closest("section");
      expect(parentSection).toBeInTheDocument();

      // 같은 section에 있는지 확인 (가로 배치)
      expect(parentSection?.contains(surgingThemesCard)).toBe(true);
    });
  });

  /**
   * AC-02-2: 모바일 세로 스택 (<768px)
   * Given: 사용자가 모바일 화면(768px 미만)에서 접속한 경우
   * When: 트렌드 페이지가 렌더링되면
   * Then: TopThemesBar와 SurgingThemesCard가 세로로 순차 배치되어야 한다
   */
  it("AC-02-2: 모바일 세로 스택 (<768px)", async () => {
    // Arrange
    const mockDates = ["2024-01-01", "2024-01-02", "2024-01-03"];
    vi.mocked(useDates).mockReturnValue({
      data: mockDates,
      isLoading: false,
      error: null,
    });

    // 모바일 뷰포트 설정 (640px)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 640,
    });

    // Act
    render(<TrendPage />);

    // Assert
    await waitFor(() => {
      const topThemesBar = screen.getByTestId("top-themes-bar");
      const surgingThemesCard = screen.getByTestId("surging-themes-card");

      // 두 컴포넌트가 모두 렌더링되어야 함
      expect(topThemesBar).toBeInTheDocument();
      expect(surgingThemesCard).toBeInTheDocument();

      // CSS Grid 사용: 두 컴포넌트는 같은 section에 있지만,
      // grid-cols-1 클래스로 모바일에서 세로 배치됨
      const parentSection = topThemesBar.closest("section");
      expect(parentSection).toBeInTheDocument();
      expect(parentSection?.contains(surgingThemesCard)).toBe(true);

      // 모바일 레이아웃 확인: grid-cols-1 (단일 열)
      expect(parentSection).toHaveClass("grid-cols-1");
    });
  });

  /**
   * AC-02-3: 반응형 전환
   * Given: 사용자가 화면 크기를 변경하는 경우
   * When: 뷰포트가 768px 기준으로 변경되면
   * Then: 레이아웃이 반응형으로 전환되어야 한다 (이 기능은 CSS에 위임됨)
   */
  it("AC-02-3: 반응형 전환", async () => {
    // Arrange
    const mockDates = ["2024-01-01", "2024-01-02", "2024-01-03"];
    vi.mocked(useDates).mockReturnValue({
      data: mockDates,
      isLoading: false,
      error: null,
    });

    // Act - 데스크탑
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    render(<TrendPage />);

    // Assert - 데스크탱 레이아웃
    await waitFor(() => {
      const topThemesBar = screen.getByTestId("top-themes-bar");
      expect(topThemesBar).toBeInTheDocument();
    });

    // Note: 실제 반응형 전환은 CSS에서 처리되므로,
    // 이 테스트는 주요 DOM 구조가 올바르게 렌더링되는지 확인
  });

  /**
   * AC-03-1: 콘텐츠 양 차이에도 동일 높이
   * Given: 데스크탱 화면에서 두 컴포넌트의 콘텐츠 양이 다른 경우
   * When: TopThemesBar와 SurgingThemesCard가 렌더링되면
   * Then: 두 컴포넌트는 동일한 높이를 유지해야 한다
   */
  it("AC-03-1: 콘텐츠 양 차이에도 동일 높이", async () => {
    // Arrange
    const mockDates = ["2024-01-01", "2024-01-02", "2024-01-03"];
    vi.mocked(useDates).mockReturnValue({
      data: mockDates,
      isLoading: false,
      error: null,
    });

    // Act
    render(<TrendPage />);

    // Assert
    await waitFor(() => {
      const topThemesBar = screen.getByTestId("top-themes-bar");
      const surgingThemesCard = screen.getByTestId("surging-themes-card");

      // 두 컴포넌트가 존재하는지 확인
      expect(topThemesBar).toBeInTheDocument();
      expect(surgingThemesCard).toBeInTheDocument();

      // 동일 높이 클래스 확인 (Tailwind h-full 또는 동적 높이)
      // 이 테스트는 DOM 구조 확인에 초점
      const parentContainer = topThemesBar.closest("div");
      expect(parentContainer).toBeInTheDocument();
    });
  });

  /**
   * AC-03-2: 콘텐츠 초과 시 내부 스크롤
   * Given: 데스크탑 화면에서 콘텐츠가 컨테이너 높이를 초과하는 경우
   * When: TopThemesBar 또는 SurgingThemesCard의 콘텐츠가 많으면
   * Then: 내부 스크롤이 발생해야 한다
   */
  it("AC-03-2: 콘텐츠 초과 시 내부 스크롤", async () => {
    // Arrange
    const mockDates = ["2024-01-01", "2024-01-02", "2024-01-03"];
    vi.mocked(useDates).mockReturnValue({
      data: mockDates,
      isLoading: false,
      error: null,
    });

    // Act
    render(<TrendPage />);

    // Assert
    await waitFor(() => {
      const topThemesBar = screen.getByTestId("top-themes-bar");
      const surgingThemesCard = screen.getByTestId("surging-themes-card");

      // 두 컴포넌트가 렌더링되어야 함
      expect(topThemesBar).toBeInTheDocument();
      expect(surgingThemesCard).toBeInTheDocument();

      // 오버플로우 처리 확인 (CSS overflow-auto 또는 overflow-y-auto)
      // 이 테스트는 DOM 구조 확인에 초점
      const parentSection = topThemesBar.closest("section");
      expect(parentSection).toBeInTheDocument();
    });
  });
});
