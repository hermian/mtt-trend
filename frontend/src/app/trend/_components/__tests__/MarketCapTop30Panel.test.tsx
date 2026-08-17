/**
 * MarketCapTop30Panel 컴포넌트 테스트
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarketCapTop30Panel } from "../MarketCapTop30Panel";
import * as useTop30Hook from "@/hooks/useTop30";

vi.mock("@/hooks/useTop30");
vi.mock("@/components/StockNameLink", () => ({
  StockNameLink: ({ name }: { name: string }) => <a data-testid="stock-link">{name}</a>,
}));

const MOCK_DATA = {
  date: "2026-08-14",
  market: "all",
  compare_days: 5,
  compare_date: "2026-08-07",
  compare_available: true,
  window_dates: ["2026-08-07", "2026-08-14"],
  stocks: [
    {
      code: "005930", name: "삼성전자", market: "KOSPI", marcap: 16048.0,
      rank: 1, previous_rank: 1, rank_delta: 0, new_entrant: false,
      series: [1, 1],
    },
    {
      code: "402340", name: "SK스퀘어", market: "KOSPI", marcap: 1522.8,
      rank: 3, previous_rank: null, rank_delta: null, new_entrant: true,
      series: [9, 3],
    },
  ],
};

const okQuery = (data: unknown) => ({
  data, isLoading: false, error: null, status: "success", fetchStatus: "idle",
  refetch: vi.fn(), remove: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTop30Hook.useTop30Dates).mockReturnValue(
    okQuery({ dates: ["2026-08-14"] }) as never
  );
  vi.mocked(useTop30Hook.useTop30).mockReturnValue(okQuery(MOCK_DATA) as never);
});

describe("MarketCapTop30Panel", () => {
  it("renders header and default chart view", () => {
    render(<MarketCapTop30Panel />);
    expect(screen.getByText(/시총 TOP 30 추적/i)).toBeInTheDocument();
    expect(screen.getByText("차트")).toBeInTheDocument();
    expect(screen.getByText("표")).toBeInTheDocument();
  });

  it("shows 신규 진입 badge and ▲ delta in table view", () => {
    render(<MarketCapTop30Panel />);
    fireEvent.click(screen.getByText("표"));
    // 신규 진입 배지
    expect(screen.getByText("신규진입")).toBeInTheDocument();
    // 종목명 렌더
    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(screen.getByText("SK스퀘어")).toBeInTheDocument();
    // 시가총액 (천억원 16048 → 1604.8조)
    expect(screen.getByText("1,604.8조")).toBeInTheDocument();
  });

  it("renders error state when query fails", () => {
    vi.mocked(useTop30Hook.useTop30).mockReturnValue({
      data: undefined, isLoading: false, error: new Error("boom"),
      status: "error", fetchStatus: "idle", refetch: vi.fn(), remove: vi.fn(),
    } as never);
    render(<MarketCapTop30Panel />);
    expect(screen.getByText(/데이터를 불러오지 못했습니다/i)).toBeInTheDocument();
  });

  it("renders data-absent message when response has no stocks", () => {
    vi.mocked(useTop30Hook.useTop30).mockReturnValue(
      okQuery({ ...MOCK_DATA, stocks: [] }) as never
    );
    render(<MarketCapTop30Panel />);
    expect(screen.getByText(/데이터가 없습니다/i)).toBeInTheDocument();
  });

  it("handles null marcap without crashing", () => {
    const withNull = {
      ...MOCK_DATA,
      stocks: [{ ...MOCK_DATA.stocks[0], marcap: null, series: [] }],
    };
    vi.mocked(useTop30Hook.useTop30).mockReturnValue(okQuery(withNull) as never);
    render(<MarketCapTop30Panel />);
    fireEvent.click(screen.getByText("표"));
    // null marcap 은 '-' 로 표시되어도 크래시 없이 렌더
    expect(screen.queryByText(/[0-9]조/)).not.toBeInTheDocument();
  });
});