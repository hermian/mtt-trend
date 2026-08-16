import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GroupTreemap, StockTreemap } from "../_components/TreemapChart";
import type { StockHeatmapGroup } from "@/lib/api";

const mockGroup: StockHeatmapGroup = {
  name: "반도체",
  stock_count: 5,
  weight: 100,
  avg_return: 3.5,
  rs: 88,
  stocks: [
    {
      code: "005930",
      name: "삼성전자",
      market: "KOSPI",
      marcap: 4000000,
      ret: 2.5,
      weight: 50,
      rs: 85,
    },
    {
      code: "000660",
      name: "SK하이닉스",
      market: "KOSPI",
      marcap: 1000000,
      ret: 4.5,
      weight: 50,
      rs: 92,
    },
  ],
};

const mockScale = {
  min: -5,
  max: 5,
  zero: 0,
};

describe("TreemapChart Hover Popups", () => {
  it("renders hover popup for GroupTreemap on mouse move", () => {
    const onDrill = vi.fn();
    render(<GroupTreemap groups={[mockGroup]} scale={mockScale} onDrill={onDrill} />);

    const groupTile = screen.getByRole("img", { name: "그룹별 히트맵" }).querySelector("g");
    expect(groupTile).not.toBeNull();

    if (groupTile) {
      fireEvent.mouseMove(groupTile, { clientX: 100, clientY: 100 });
      expect(screen.getAllByText("반도체").length).toBeGreaterThan(1);
      expect(screen.getAllByText("삼성전자").length).toBeGreaterThan(0);
      expect(screen.getAllByText("SK하이닉스").length).toBeGreaterThan(0);
      expect(screen.getByText("+2.50%")).toBeDefined();
      expect(screen.getByText("+4.50%")).toBeDefined();
      expect(screen.getByText("RS 85")).toBeDefined();
      expect(screen.getByText("RS 92")).toBeDefined();
      expect(screen.getByText("클릭하여 종목 목록 보기 ↗")).toBeDefined();

      fireEvent.mouseLeave(groupTile);
      expect(screen.queryByText("클릭하여 종목 목록 보기 ↗")).toBeNull();
    }
  });

  it("renders hover popup showing first 5 stocks with stats and remainder count when > 5 stocks", () => {
    const largeGroup: StockHeatmapGroup = {
      name: "IT서비스",
      stock_count: 7,
      weight: 100,
      avg_return: 2.0,
      rs: 75,
      stocks: [
        { code: "1", name: "종목1", market: "KOSPI", marcap: 1000, ret: 1, weight: 10, rs: 70 },
        { code: "2", name: "종목2", market: "KOSPI", marcap: 900, ret: 2, weight: 9, rs: 71 },
        { code: "3", name: "종목3", market: "KOSPI", marcap: 800, ret: 3, weight: 8, rs: 72 },
        { code: "4", name: "종목4", market: "KOSPI", marcap: 700, ret: 4, weight: 7, rs: 73 },
        { code: "5", name: "종목5", market: "KOSPI", marcap: 600, ret: 5, weight: 6, rs: 74 },
        { code: "6", name: "종목6", market: "KOSPI", marcap: 500, ret: 6, weight: 5, rs: 75 },
        { code: "7", name: "종목7", market: "KOSPI", marcap: 400, ret: 7, weight: 4, rs: 76 },
      ],
    };

    const onDrill = vi.fn();
    render(<GroupTreemap groups={[largeGroup]} scale={mockScale} onDrill={onDrill} />);

    const groupTile = screen.getByRole("img", { name: "그룹별 히트맵" }).querySelector("g");
    expect(groupTile).not.toBeNull();

    if (groupTile) {
      fireEvent.mouseMove(groupTile, { clientX: 100, clientY: 100 });
      expect(screen.getByText("종목1")).toBeDefined();
      expect(screen.getByText("종목5")).toBeDefined();
      expect(screen.queryByText("종목6")).toBeNull();
      expect(screen.getByText("외 2개 더보기")).toBeDefined();
    }
  });

  it("renders hover popup for StockTreemap on mouse move", () => {
    render(<StockTreemap group={mockGroup} scale={mockScale} />);

    const stockTiles = screen.getByRole("img", { name: "반도체 종목 히트맵" }).querySelectorAll("g");
    expect(stockTiles.length).toBeGreaterThan(0);

    const firstTile = stockTiles[0];
    fireEvent.mouseMove(firstTile, { clientX: 150, clientY: 150 });

    expect(screen.getAllByText("삼성전자").length).toBeGreaterThan(1);
    expect(screen.getByText("클릭 시 상세 정보 이동 ↗")).toBeDefined();

    fireEvent.mouseLeave(firstTile);
    expect(screen.queryByText("클릭 시 상세 정보 이동 ↗")).toBeNull();
  });
});
