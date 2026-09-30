import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import StockHeatmapPage from "../page";
import * as useStockHeatmapModule from "@/hooks/useStockHeatmap";
import type { StockHeatmapResponse } from "@/lib/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/hooks/useStockHeatmap");

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ),
  });
}

const mockHeatmapData: StockHeatmapResponse = {
  grouping: "theme2",
  period: "1D",
  size_by: "marcap",
  color_by: "return",
  as_of_date: "2026-09-30",
  as_of_time: "15:30",
  stock_count: 2,
  groups: [
    {
      name: "반도체소재",
      stock_count: 2,
      weight: 100,
      avg_return: 3.5,
      avg_trade_value_growth: 45.2,
      rs: 88,
      stocks: [
        {
          code: "005930",
          name: "삼성전자",
          market: "KOSPI",
          marcap: 4000000,
          trade_value: 120000,
          trade_value_growth: 30.5,
          ret: 2.5,
          weight: 60,
          rs: 85,
        },
        {
          code: "000660",
          name: "SK하이닉스",
          market: "KOSPI",
          marcap: 1000000,
          trade_value: 80000,
          trade_value_growth: 60.0,
          ret: 4.5,
          weight: 40,
          rs: 92,
        },
      ],
    },
    {
      name: "2차전지",
      stock_count: 1,
      weight: 50,
      avg_return: -1.2,
      avg_trade_value_growth: -10.0,
      rs: 60,
      stocks: [
        {
          code: "373220",
          name: "LG에너지솔루션",
          market: "KOSPI",
          marcap: 2000000,
          trade_value: 50000,
          trade_value_growth: -10.0,
          ret: -1.2,
          weight: 100,
          rs: 60,
        },
      ],
    },
  ],
};

describe("StockHeatmapPage Drill-down State Persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useStockHeatmapModule, "useStockHeatmap").mockReturnValue({
      data: mockHeatmapData,
      isFetching: false,
      isError: false,
      error: null,
    } as any);
  });

  it("preserves drilledGroup when toggling sizeBy between marcap and trade_value", async () => {
    renderWithQuery(<StockHeatmapPage />);

    // 1. '테마2' 그룹화 선택
    const theme2Button = screen.getByRole("button", { name: "테마2" });
    fireEvent.click(theme2Button);

    // 2. 그룹별 히트맵 렌더링 확인
    expect(screen.getByRole("img", { name: "그룹별 히트맵" })).toBeDefined();

    // 3. '반도체소재' 그룹 타일 클릭하여 드릴다운
    const semiconductorTile = screen.getByText("반도체소재");
    fireEvent.click(semiconductorTile);

    // 4. 종목별 히트맵(반도체소재 종목 히트맵)으로 진입 확인
    expect(screen.getByRole("img", { name: "반도체소재 종목 히트맵" })).toBeDefined();
    expect(screen.getByText("← 전체 테마2")).toBeDefined();

    // 5. '거래대금' 크기 버튼 클릭 (sizeBy 변경)
    const tradeValueButton = screen.getByRole("button", { name: "거래대금" });
    fireEvent.click(tradeValueButton);

    // 6. 드릴다운이 풀리지 않고 '반도체소재 종목 히트맵' 및 브레드크럼이 그대로 유지되어야 함!
    expect(screen.getByRole("img", { name: "반도체소재 종목 히트맵" })).toBeDefined();
    expect(screen.getByText("← 전체 테마2")).toBeDefined();
  });

  it("preserves drilledGroup when changing colorBy", async () => {
    renderWithQuery(<StockHeatmapPage />);

    // '반도체소재' 그룹 타일 클릭
    const semiconductorTile = screen.getByText("반도체소재");
    fireEvent.click(semiconductorTile);

    expect(screen.getByRole("img", { name: "반도체소재 종목 히트맵" })).toBeDefined();

    // '거래대금 증가율' 색상 버튼 클릭
    const growthButton = screen.getByRole("button", { name: "거래대금 증가율" });
    fireEvent.click(growthButton);

    // 드릴다운 상태 유지 확인
    expect(screen.getByRole("img", { name: "반도체소재 종목 히트맵" })).toBeDefined();
  });

  it("preserves drilledGroup when changing colorBy to split and updates Legend and subtitle", async () => {
    renderWithQuery(<StockHeatmapPage />);

    // '반도체소재' 그룹 타일 클릭
    const semiconductorTile = screen.getByText("반도체소재");
    fireEvent.click(semiconductorTile);

    expect(screen.getByRole("img", { name: "반도체소재 종목 히트맵" })).toBeDefined();

    // '수익률+대금(반반)' 색상 버튼 클릭
    const splitButton = screen.getByRole("button", { name: "수익률+대금(반반)" });
    fireEvent.click(splitButton);

    // 드릴다운 상태 유지 확인
    expect(screen.getByRole("img", { name: "반도체소재 종목 히트맵" })).toBeDefined();

    // 상단 요약 설명 텍스트 업데이트 확인
    expect(screen.getByText(/수익률\(좌\)\+대금증가\(우\) 분할 색상/)).toBeDefined();

    // Legend에 두 개의 분할 배지 표시 확인
    expect(screen.getByText("좌측 50%")).toBeDefined();
    expect(screen.getByText("우측 50%")).toBeDefined();
  });

  it("resets drilledGroup when grouping actually changes", async () => {
    renderWithQuery(<StockHeatmapPage />);

    // '반도체소재' 그룹 타일 클릭
    const semiconductorTile = screen.getByText("반도체소재");
    fireEvent.click(semiconductorTile);

    expect(screen.getByRole("img", { name: "반도체소재 종목 히트맵" })).toBeDefined();

    // 그룹 분류를 '섹터'로 변경
    const sectorButton = screen.getByRole("button", { name: "섹터" });
    fireEvent.click(sectorButton);

    // grouping이 바뀌었으므로 드릴다운이 해제되어 그룹별 히트맵으로 복귀해야 함
    await waitFor(() => {
      expect(screen.queryByRole("img", { name: "반도체소재 종목 히트맵" })).toBeNull();
      expect(screen.getByRole("img", { name: "그룹별 히트맵" })).toBeDefined();
    });
  });

  it("safely resets drilledGroup if the group no longer exists in fetched data", async () => {
    const hookSpy = vi.spyOn(useStockHeatmapModule, "useStockHeatmap");
    const { rerender } = renderWithQuery(<StockHeatmapPage />);

    // '반도체소재' 그룹 타일 클릭
    const semiconductorTile = screen.getByText("반도체소재");
    fireEvent.click(semiconductorTile);

    expect(screen.getByRole("img", { name: "반도체소재 종목 히트맵" })).toBeDefined();

    // 필터 변경 등으로 반도체소재 그룹이 사라진 데이터로 갱신
    hookSpy.mockReturnValue({
      data: {
        ...mockHeatmapData,
        groups: [mockHeatmapData.groups[1]], // '2차전지'만 남음
      },
      isFetching: false,
      isError: false,
      error: null,
    } as any);

    rerender(<StockHeatmapPage />);

    await waitFor(() => {
      expect(screen.queryByRole("img", { name: "반도체소재 종목 히트맵" })).toBeNull();
      expect(screen.getByRole("img", { name: "그룹별 히트맵" })).toBeDefined();
    });
  });
});
