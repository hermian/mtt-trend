// SPEC-MTT-016: TrendPage 반응형 패딩 테스트
// @MX:ANCHOR 컴포넌트이므로 className만 검증, 로직 변경 없음

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import TrendPage from "../page";

// Mock child components
vi.mock("../_components/TopThemesBar", () => ({
  TopThemesBar: () => <div data-testid="top-themes-bar">TopThemesBar</div>,
}));

vi.mock("../_components/SurgingThemesCard", () => ({
  SurgingThemesCard: () => <div data-testid="surging-themes-card">SurgingThemesCard</div>,
}));

vi.mock("../_components/ThemeTrendChart", () => ({
  ThemeTrendChart: () => <div data-testid="theme-trend-chart">ThemeTrendChart</div>,
}));

vi.mock("../_components/StockAnalysisTabs", () => ({
  StockAnalysisTabs: () => <div data-testid="stock-analysis-tabs">StockAnalysisTabs</div>,
}));

vi.mock("../_components/ThemeStocksPanel", () => ({
  ThemeStocksPanel: () => <div data-testid="theme-stocks-panel">ThemeStocksPanel</div>,
}));

vi.mock("@/hooks/useThemes", () => ({
  useDates: vi.fn().mockReturnValue({
    data: ["2024-01-01"],
    isLoading: false,
    error: null,
  }),
}));

describe("TrendPage - SPEC-MTT-016 반응형 패딩", () => {
  it("TASK-006: 메인 div에 p-3 클래스가 있어야 한다 (모바일 패딩)", () => {
    const { container } = render(<TrendPage />);

    // 최상위 div가 반응형 패딩 클래스를 가져야 함
    const mainDiv = container.querySelector("div");
    expect(mainDiv?.className).toContain("p-3");
  });

  it("TASK-006: 메인 div에 md:p-6 클래스가 있어야 한다 (PC 패딩)", () => {
    const { container } = render(<TrendPage />);

    const mainDiv = container.querySelector("div");
    expect(mainDiv?.className).toContain("md:p-6");
  });

  it("TASK-006: 메인 div에 space-y-4 클래스가 있어야 한다 (모바일 간격)", () => {
    const { container } = render(<TrendPage />);

    const mainDiv = container.querySelector("div");
    expect(mainDiv?.className).toContain("space-y-4");
  });

  it("TASK-006: 메인 div에 md:space-y-6 클래스가 있어야 한다 (PC 간격)", () => {
    const { container } = render(<TrendPage />);

    const mainDiv = container.querySelector("div");
    expect(mainDiv?.className).toContain("md:space-y-6");
  });

  it("TASK-006: 기존 p-6 단독 클래스가 없어야 한다 (반응형 적용 확인)", () => {
    const { container } = render(<TrendPage />);

    const mainDiv = container.querySelector("div");
    // "p-6 space-y-6" 형태가 아닌 "p-3 md:p-6 space-y-4 md:space-y-6" 형태여야 함
    // p-6는 md:p-6 형태로 있어야 하므로, 순수 'p-6 ' 앞에 md:가 없는 경우를 검사
    const classes = mainDiv?.className.split(" ") ?? [];
    expect(classes).not.toContain("p-6");
  });
});
