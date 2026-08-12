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
      expect(screen.getByText("클릭하여 종목 목록 보기 ↗")).toBeDefined();

      fireEvent.mouseLeave(groupTile);
      expect(screen.queryByText("클릭하여 종목 목록 보기 ↗")).toBeNull();
    }
  });

  it("renders hover popup for StockTreemap on mouse move", () => {
    render(<StockTreemap group={mockGroup} scale={mockScale} />);

    const stockTiles = screen.getByRole("img", { name: "반도체 종목 히트맵" }).querySelectorAll("g");
    expect(stockTiles.length).toBeGreaterThan(0);

    const firstTile = stockTiles[0];
    fireEvent.mouseMove(firstTile, { clientX: 150, clientY: 150 });

    expect(screen.getAllByText("삼성전자").length).toBeGreaterThan(1);
    expect(screen.getByText("클릭 시 네이버 금융으로 이동 ↗")).toBeDefined();

    fireEvent.mouseLeave(firstTile);
    expect(screen.queryByText("클릭 시 네이버 금융으로 이동 ↗")).toBeNull();
  });
});
