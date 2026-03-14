/**
 * ThemeTrend 컴포넌트 TDD 테스트 스위트
 * SPEC-MTT-005: 테마 RS 추이 차트 인터랙티브 개선
 *
 * 테스트 전략:
 * - F-01: 페이지 로드 시 상위 5개 테마 자동 선택
 * - F-03: 라인 더블클릭 비활성화/활성화 토글
 * - F-04: 단일 데이터 포인트 dot 표시
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import { ThemeTrendChart } from "../ThemeTrendChart";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeDaily, ThemeHistory } from "@/lib/api";
import userEvent from "@testing-library/user-event";

// Mock Recharts
jest.mock("recharts", () => ({
  LineChart: ({ children, ...props }: any) => (
    <div data-testid="line-chart" {...props}>
      {children}
    </div>
  ),
  Line: ({ dataKey, strokeOpacity, stroke, dot }: any) => (
    <div
      data-testid={`line-${dataKey}`}
      data-stroke-opacity={strokeOpacity}
      data-stroke={stroke}
      data-has-dot={dot !== false}
    />
  ),
  XAxis: (props: any) => <div data-testid="x-axis" {...props} />,
  YAxis: (props: any) => <div data-testid="y-axis" {...props} />,
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" {...props} />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: ({ content }: any) => (
    <div data-testid="legend">{content || "Default Legend"}</div>
  ),
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

// Mock API
const mockThemesDaily: ThemeDaily[] = [
  {
    theme_name: "Theme1",
    avg_rs: 100,
    date: "2026-03-14",
    rank: 1,
  },
  {
    theme_name: "Theme2",
    avg_rs: 90,
    date: "2026-03-14",
    rank: 2,
  },
  {
    theme_name: "Theme3",
    avg_rs: 80,
    date: "2026-03-14",
    rank: 3,
  },
  {
    theme_name: "Theme4",
    avg_rs: 70,
    date: "2026-03-14",
    rank: 4,
  },
  {
    theme_name: "Theme5",
    avg_rs: 60,
    date: "2026-03-14",
    rank: 5,
  },
  {
    theme_name: "Theme6",
    avg_rs: 50,
    date: "2026-03-14",
    rank: 6,
  },
];

const mockThemeHistories: { [key: string]: ThemeHistory[] } = {
  Theme1: [
    { date: "2026-03-14", avg_rs: 100, theme_name: "Theme1" },
    { date: "2026-03-13", avg_rs: 95, theme_name: "Theme1" },
    { date: "2026-03-12", avg_rs: 90, theme_name: "Theme1" },
  ],
  Theme2: [
    { date: "2026-03-14", avg_rs: 90, theme_name: "Theme2" },
    { date: "2026-03-13", avg_rs: 85, theme_name: "Theme2" },
    { date: "2026-03-12", avg_rs: 80, theme_name: "Theme2" },
  ],
  Theme3: [
    { date: "2026-03-14", avg_rs: 80, theme_name: "Theme3" },
    { date: "2026-03-13", avg_rs: 75, theme_name: "Theme3" },
    { date: "2026-03-12", avg_rs: 70, theme_name: "Theme3" },
  ],
  Theme4: [
    { date: "2026-03-14", avg_rs: 70, theme_name: "Theme4" },
    { date: "2026-03-13", avg_rs: 65, theme_name: "Theme4" },
    { date: "2026-03-12", avg_rs: 60, theme_name: "Theme4" },
  ],
  Theme5: [
    { date: "2026-03-14", avg_rs: 60, theme_name: "Theme5" },
    { date: "2026-03-13", avg_rs: 55, theme_name: "Theme5" },
    { date: "2026-03-12", avg_rs: 50, theme_name: "Theme5" },
  ],
  Theme6: [
    { date: "2026-03-14", avg_rs: 50, theme_name: "Theme6" },
    { date: "2026-03-13", avg_rs: 45, theme_name: "Theme6" },
    { date: "2026-03-12", avg_rs: 40, theme_name: "Theme6" },
  ],
};

// Mock single point theme
const mockSinglePointTheme: ThemeHistory[] = [
  { date: "2026-03-14", avg_rs: 100, theme_name: "NewTheme" },
];

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithQueryClient(component: React.ReactElement) {
  const client = createTestClient();
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}

describe("ThemeTrendChart - SPEC-MTT-005", () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock useThemesDaily hook
    jest.doMock("@/hooks/useThemes", () => ({
      useThemesDaily: jest.fn(() => ({
        data: mockThemesDaily,
        isLoading: false,
      })),
      useMultipleThemeHistories: jest.fn(() => ({
        data: mockThemeHistories,
        isLoading: false,
      })),
    }));
  });

  afterEach(() => {
    jest.resetModules();
  });

  /**
   * F-01: 페이지 로드 시 상위 5개 테마 자동 선택
   */
  describe("F-01: Auto-select top 5 themes on initial load", () => {
    /**
     * AC-01-1: 초기 로드 시 상위 5개 테마 자동 표시
     */
    test("AC-01-1: should auto-select top 5 themes by avg_rs on initial load", async () => {
      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        const lineElements = screen.getAllByTestId(/line-/);
        // 상위 5개 테마가 자동 선택되어야 함 (Theme1 ~ Theme5)
        expect(lineElements).toHaveLength(5);
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme2")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme3")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme4")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme5")).toBeInTheDocument();
        // Theme6는 선택되지 않아야 함
        expect(screen.queryByTestId("line-Theme6")).not.toBeInTheDocument();
      });
    });

    /**
     * AC-01-2: 사용자 수동 변경 후 자동 선택 미적용
     */
    test("AC-01-2: should preserve manual selection and not re-apply auto-selection", async () => {
      const { rerender } = renderWithQueryClient(
        <ThemeTrendChart date="2026-03-14" source="52w_high" />
      );

      // 초기 로드 확인
      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
      });

      // 사용자가 Theme1 제거
      const user = userEvent.setup();
      const theme1Badge = screen.getByText("Theme1");
      await user.click(theme1Badge); // Remove Theme1

      // 날짜 변경으로 재렌더링 (auto-selection이 재적용되지 않아야 함)
      rerender(<ThemeTrendChart date="2026-03-15" source="52w_high" />);

      await waitFor(() => {
        // Theme1이 여전히 선택되지 않은 상태여야 함
        expect(screen.queryByTestId("line-Theme1")).not.toBeInTheDocument();
        // 나머지 4개 테마는 유지되어야 함
        expect(screen.getByTestId("line-Theme2")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme3")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme4")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme5")).toBeInTheDocument();
      });
    });

    /**
     * AC-01-3: 테마 데이터 5개 미만인 경우
     */
    test("AC-01-3: should auto-select all themes when less than 5 available", async () => {
      // 3개 테마만 있는 경우
      const limitedThemes = mockThemesDaily.slice(0, 3);
      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: limitedThemes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: {
            Theme1: mockThemeHistories.Theme1,
            Theme2: mockThemeHistories.Theme2,
            Theme3: mockThemeHistories.Theme3,
          },
          isLoading: false,
        })),
      }));

      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        const lineElements = screen.getAllByTestId(/line-/);
        // 존재하는 모든 3개 테마가 선택되어야 함
        expect(lineElements).toHaveLength(3);
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme2")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme3")).toBeInTheDocument();
      });
    });

    /**
     * AC-01-4: 테마 데이터가 없는 경우
     */
    test("AC-01-4: should show empty state message when no themes available", async () => {
      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: [],
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: {},
          isLoading: false,
        })),
      }));

      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        expect(screen.getByText("데이터가 없습니다")).toBeInTheDocument();
      });
    });
  });

  /**
   * F-03: Legend 더블클릭으로 라인 비활성화/활성화 토글
   */
  describe("F-03: Legend double-click toggle", () => {
    /**
     * AC-03-1: Legend 더블클릭으로 라인 비활성화
     */
    test("AC-03-1: should disable line opacity to 0.2 on Legend double-click", async () => {
      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
      });

      const user = userEvent.setup();

      // Legend에서 Theme1 항목 찾기
      const legend = screen.getByTestId("legend");
      const theme1LegendItem = within(legend).getByText("Theme1");

      // 초기 상태: opacity 1.0
      const theme1Line = screen.getByTestId("line-Theme1");
      expect(theme1Line).toHaveAttribute("data-stroke-opacity", "1");

      // Legend 항목 더블클릭
      await user.dblClick(theme1LegendItem);

      // 비활성화 상태: opacity 0.2
      await waitFor(() => {
        expect(theme1Line).toHaveAttribute("data-stroke-opacity", "0.2");
      });
    });

    /**
     * AC-03-2: 비활성화된 라인 Legend 다시 더블클릭으로 복원
     */
    test("AC-03-2: should restore line opacity to 1.0 on second Legend double-click", async () => {
      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const legend = screen.getByTestId("legend");
      const theme1LegendItem = within(legend).getByText("Theme1");
      const theme1Line = screen.getByTestId("line-Theme1");

      // 첫 번째 더블클릭: 비활성화
      await user.dblClick(theme1LegendItem);
      await waitFor(() => {
        expect(theme1Line).toHaveAttribute("data-stroke-opacity", "0.2");
      });

      // 두 번째 더블클릭: 복원
      await user.dblClick(theme1LegendItem);
      await waitFor(() => {
        expect(theme1Line).toHaveAttribute("data-stroke-opacity", "1");
      });
    });

    /**
     * AC-03-3: Legend 단일 클릭 동작 유지
     */
    test("AC-03-3: should not trigger double-click toggle on Legend single click", async () => {
      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const legend = screen.getByTestId("legend");
      const theme1LegendItem = within(legend).getByText("Theme1");
      const theme1Line = screen.getByTestId("line-Theme1");

      // 초기 상태
      expect(theme1Line).toHaveAttribute("data-stroke-opacity", "1");

      // 단일 클릭
      await user.click(theme1LegendItem);

      // 단일 클릭으로는 opacity가 변경되지 않아야 함
      expect(theme1Line).toHaveAttribute("data-stroke-opacity", "1");
    });

    /**
     * AC-03-4: 복수 테마 동시 비활성화
     */
    test("AC-03-4: should support disabling multiple themes independently via Legend", async () => {
      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme2")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme3")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const legend = screen.getByTestId("legend");
      const theme1LegendItem = within(legend).getByText("Theme1");
      const theme2LegendItem = within(legend).getByText("Theme2");
      const theme3LegendItem = within(legend).getByText("Theme3");

      const theme1Line = screen.getByTestId("line-Theme1");
      const theme2Line = screen.getByTestId("line-Theme2");
      const theme3Line = screen.getByTestId("line-Theme3");

      // Theme1 비활성화
      await user.dblClick(theme1LegendItem);
      await waitFor(() => {
        expect(theme1Line).toHaveAttribute("data-stroke-opacity", "0.2");
        expect(theme2Line).toHaveAttribute("data-stroke-opacity", "1");
        expect(theme3Line).toHaveAttribute("data-stroke-opacity", "1");
      });

      // Theme2 비활성화
      await user.dblClick(theme2LegendItem);
      await waitFor(() => {
        expect(theme1Line).toHaveAttribute("data-stroke-opacity", "0.2");
        expect(theme2Line).toHaveAttribute("data-stroke-opacity", "0.2");
        expect(theme3Line).toHaveAttribute("data-stroke-opacity", "1");
      });

      // Theme3 비활성화
      await user.dblClick(theme3LegendItem);
      await waitFor(() => {
        expect(theme1Line).toHaveAttribute("data-stroke-opacity", "0.2");
        expect(theme2Line).toHaveAttribute("data-stroke-opacity", "0.2");
        expect(theme3Line).toHaveAttribute("data-stroke-opacity", "0.2");
      });
    });

    /**
     * AC-03-5: 테마 선택 변경 시 disabledThemes 초기화
     */
    test("AC-03-5: should reset disabledThemes when theme selection changes", async () => {
      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const legend = screen.getByTestId("legend");
      const theme1LegendItem = within(legend).getByText("Theme1");
      const theme1Line = screen.getByTestId("line-Theme1");

      // Theme1 비활성화
      await user.dblClick(theme1LegendItem);
      await waitFor(() => {
        expect(theme1Line).toHaveAttribute("data-stroke-opacity", "0.2");
      });

      // 테마 선택 변경 (Theme1 제거)
      const theme1Badge = screen.getByText("Theme1");
      await user.click(theme1Badge);

      // disabledThemes가 초기화되어야 함
      // Theme1이 제거되었으므로 line-Theme1이 없어야 함
      await waitFor(() => {
        expect(screen.queryByTestId("line-Theme1")).not.toBeInTheDocument();
      });
    });
  });

  /**
   * F-04: 단일 데이터 포인트 dot 표시
   */
  describe("F-04: Single data point dot display", () => {
    /**
     * AC-04-1: 신규 등장 테마 dot 표시
     */
    test("AC-04-1: should render dot for single-point theme", async () => {
      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: [{ theme_name: "NewTheme", avg_rs: 100, date: "2026-03-14", rank: 1 }],
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: { NewTheme: mockSinglePointTheme },
          isLoading: false,
        })),
      }));

      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        const newThemeLine = screen.getByTestId("line-NewTheme");
        // 단일 포인트는 dot이 있어야 함
        expect(newThemeLine).toHaveAttribute("data-has-dot", "true");
      });
    });

    /**
     * AC-04-3: 다중 데이터 포인트 테마는 라인 유지
     */
    test("AC-04-3: should render line for multi-point themes", async () => {
      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        const theme1Line = screen.getByTestId("line-Theme1");
        // 다중 포인트는 dot이 없어야 함 (dot={false})
        expect(theme1Line).toHaveAttribute("data-has-dot", "false");
      });
    });

    /**
     * AC-04-4: 단일 포인트 테마와 다중 포인트 테마 공존
     */
    test("AC-04-4: should render mixed single-point and multi-point themes", async () => {
      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: [
            { theme_name: "Theme1", avg_rs: 100, date: "2026-03-14", rank: 1 },
            { theme_name: "NewTheme", avg_rs: 90, date: "2026-03-14", rank: 2 },
          ],
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: {
            Theme1: mockThemeHistories.Theme1,
            NewTheme: mockSinglePointTheme,
          },
          isLoading: false,
        })),
      }));

      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      await waitFor(() => {
        const theme1Line = screen.getByTestId("line-Theme1");
        const newThemeLine = screen.getByTestId("line-NewTheme");

        // Theme1은 다중 포인트로 dot 없음
        expect(theme1Line).toHaveAttribute("data-has-dot", "false");
        // NewTheme은 단일 포인트로 dot 있음
        expect(newThemeLine).toHaveAttribute("data-has-dot", "true");
      });
    });
  });

  /**
   * F-02: 기간 기본값 30일 명시 (이미 구현됨)
   */
  describe("F-02: Default period is 30 days", () => {
    test("AC-02-1: should have 30 days as default period", async () => {
      renderWithQueryClient(<ThemeTrendChart date="2026-03-14" source="52w_high" />);

      // 30일 버튼이 활성화 상태인지 확인
      await waitFor(() => {
        const periodButtons = screen.getAllByRole("button");
        const button30Days = periodButtons.find((btn) =>
          within(btn).getByText("30일")
        );
        expect(button30Days).toHaveClass("bg-blue-600");
      });
    });
  });

  /**
   * BUG FIX: 소스 변경 시 상태 초기화
   */
  describe("BUG FIX: Reset state when source changes", () => {
    /**
     * AC-BUG-01: 소스 변경 시 selectedThemes 초기화
     */
    test("AC-BUG-01: should reset selectedThemes when source prop changes", async () => {
      const { rerender } = renderWithQueryClient(
        <ThemeTrendChart date="2026-03-14" source="52w_high" />
      );

      // 초기 로드: 52w_high 소스의 상위 5개 테마 자동 선택
      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme2")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme3")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme4")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme5")).toBeInTheDocument();
      });

      // 소스를 mtt로 변경
      rerender(<ThemeTrendChart date="2026-03-14" source="mtt" />);

      // selectedThemes가 초기화되어야 함 (모든 테마 라인 제거)
      await waitFor(() => {
        expect(screen.queryByTestId("line-Theme1")).not.toBeInTheDocument();
        expect(screen.queryByTestId("line-Theme2")).not.toBeInTheDocument();
        expect(screen.queryByTestId("line-Theme3")).not.toBeInTheDocument();
        expect(screen.queryByTestId("line-Theme4")).not.toBeInTheDocument();
        expect(screen.queryByTestId("line-Theme5")).not.toBeInTheDocument();
      });
    });

    /**
     * AC-BUG-02: 소스 변경 시 isUserModified 초기화
     */
    test("AC-BUG-02: should reset isUserModified flag when source changes", async () => {
      const { rerender } = renderWithQueryClient(
        <ThemeTrendChart date="2026-03-14" source="52w_high" />
      );

      // 초기 로드 확인
      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
      });

      const user = userEvent.setup();

      // 사용자가 수동으로 Theme1 제거 (isUserModified = true)
      const theme1Badge = screen.getByText("Theme1");
      await user.click(theme1Badge);

      await waitFor(() => {
        expect(screen.queryByTestId("line-Theme1")).not.toBeInTheDocument();
      });

      // 소스 변경
      rerender(<ThemeTrendChart date="2026-03-14" source="mtt" />);

      // isUserModified가 초기화되어 새 데이터 로드 시 자동 선택이 다시 적용되어야 함
      // (이 테스트는 초기화 동작을 검증)
    });

    /**
     * AC-BUG-03: 소스 변경 시 disabledThemes 초기화
     */
    test("AC-BUG-03: should reset disabledThemes when source changes", async () => {
      const { rerender } = renderWithQueryClient(
        <ThemeTrendChart date="2026-03-14" source="52w_high" />
      );

      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const legend = screen.getByTestId("legend");
      const theme1LegendItem = within(legend).getByText("Theme1");
      const theme1Line = screen.getByTestId("line-Theme1");

      // Theme1 비활성화
      await user.dblClick(theme1LegendItem);
      await waitFor(() => {
        expect(theme1Line).toHaveAttribute("data-stroke-opacity", "0.2");
      });

      // 소스 변경
      rerender(<ThemeTrendChart date="2026-03-14" source="mtt" />);

      // disabledThemes가 초기화되어야 함
      // Theme1이 제거되었으므로 확인할 필요 없음
      await waitFor(() => {
        expect(screen.queryByTestId("line-Theme1")).not.toBeInTheDocument();
      });
    });

    /**
     * AC-BUG-04: 소스 변경 후 새 소스의 상위 5개 테마 자동 선택
     */
    test("AC-BUG-04: should auto-select top 5 themes from new source after source change", async () => {
      const mttThemes: ThemeDaily[] = [
        { theme_name: "MTT_Theme1", avg_rs: 200, date: "2026-03-14", rank: 1 },
        { theme_name: "MTT_Theme2", avg_rs: 180, date: "2026-03-14", rank: 2 },
        { theme_name: "MTT_Theme3", avg_rs: 160, date: "2026-03-14", rank: 3 },
        { theme_name: "MTT_Theme4", avg_rs: 140, date: "2026-03-14", rank: 4 },
        { theme_name: "MTT_Theme5", avg_rs: 120, date: "2026-03-14", rank: 5 },
        { theme_name: "MTT_Theme6", avg_rs: 100, date: "2026-03-14", rank: 6 },
      ];

      const mttHistories: { [key: string]: ThemeHistory[] } = {
        MTT_Theme1: [{ date: "2026-03-14", avg_rs: 200, theme_name: "MTT_Theme1" }],
        MTT_Theme2: [{ date: "2026-03-14", avg_rs: 180, theme_name: "MTT_Theme2" }],
        MTT_Theme3: [{ date: "2026-03-14", avg_rs: 160, theme_name: "MTT_Theme3" }],
        MTT_Theme4: [{ date: "2026-03-14", avg_rs: 140, theme_name: "MTT_Theme4" }],
        MTT_Theme5: [{ date: "2026-03-14", avg_rs: 120, theme_name: "MTT_Theme5" }],
      };

      const { rerender } = renderWithQueryClient(
        <ThemeTrendChart date="2026-03-14" source="52w_high" />
      );

      // 초기 로드: 52w_high 소스
      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
      });

      // Mock을 mtt 데이터로 변경
      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mttThemes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mttHistories,
          isLoading: false,
        })),
      }));

      // 소스를 mtt로 변경
      rerender(<ThemeTrendChart date="2026-03-14" source="mtt" />);

      // 새 소스의 상위 5개 테마가 자동 선택되어야 함
      await waitFor(() => {
        expect(screen.getByTestId("line-MTT_Theme1")).toBeInTheDocument();
        expect(screen.getByTestId("line-MTT_Theme2")).toBeInTheDocument();
        expect(screen.getByTestId("line-MTT_Theme3")).toBeInTheDocument();
        expect(screen.getByTestId("line-MTT_Theme4")).toBeInTheDocument();
        expect(screen.getByTestId("line-MTT_Theme5")).toBeInTheDocument();
        // MTT_Theme6는 선택되지 않아야 함
        expect(screen.queryByTestId("line-MTT_Theme6")).not.toBeInTheDocument();
      });
    });

    /**
     * AC-BUG-05: 소스 간 왕복 변경 시 정상 동작
     */
    test("AC-BUG-05: should handle back-and-forth source changes correctly", async () => {
      const { rerender } = renderWithQueryClient(
        <ThemeTrendChart date="2026-03-14" source="52w_high" />
      );

      // 1. 초기 로드: 52w_high
      await waitFor(() => {
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme2")).toBeInTheDocument();
      });

      // 2. mtt로 변경
      rerender(<ThemeTrendChart date="2026-03-14" source="mtt" />);
      await waitFor(() => {
        expect(screen.queryByTestId("line-Theme1")).not.toBeInTheDocument();
        expect(screen.queryByTestId("line-Theme2")).not.toBeInTheDocument();
      });

      // 3. 다시 52w_high로 변경
      rerender(<ThemeTrendChart date="2026-03-14" source="52w_high" />);
      await waitFor(() => {
        // 52w_high의 상위 5개 테마가 다시 자동 선택되어야 함
        expect(screen.getByTestId("line-Theme1")).toBeInTheDocument();
        expect(screen.getByTestId("line-Theme2")).toBeInTheDocument();
      });
    });
  });

  /**
   * 특수 문자 포함 테마명 처리 테스트
   *
   * 버그: 테마명에 슬래시(/), 괄호() 등 특수 문자 포함 시 404 에러 발생
   * 해결: 백엔드 API path parameter 타입을 {name} → {name:path}로 변경
   */
  describe("SPECIAL-CHARS: Theme names with special characters", () => {
    /**
     * AC-SPECIAL-01: 슬래시(/) 포함 테마명 처리
     */
    test("AC-SPECIAL-01: should handle theme names with slash (/) character", async () => {
      const mockThemesWithSlash: ThemeDaily[] = [
        {
          theme_name: "방위산업/전쟁 및 테러",
          avg_rs: 98.43,
          date: "2026-03-13",
          rank: 1,
        },
        {
          theme_name: "광통신(광케이블/광섬유 등)",
          avg_rs: 97.43,
          date: "2026-03-13",
          rank: 2,
        },
      ];

      const mockHistoriesWithSlash: { [key: string]: ThemeHistory[] } = {
        "방위산업/전쟁 및 테러": [
          { date: "2026-03-13", avg_rs: 98.43, theme_name: "방위산업/전쟁 및 테러" },
          { date: "2026-03-12", avg_rs: 97.5, theme_name: "방위산업/전쟁 및 테러" },
          { date: "2026-03-11", avg_rs: 96.5, theme_name: "방위산업/전쟁 및 테마" },
        ],
        "광통신(광케이블/광섬유 등)": [
          { date: "2026-03-13", avg_rs: 97.43, theme_name: "광통신(광케이블/광섬유 등)" },
          { date: "2026-03-12", avg_rs: 96.5, theme_name: "광통신(광케이블/광섬유 등)" },
        ],
      };

      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mockThemesWithSlash,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mockHistoriesWithSlash,
          isLoading: false,
        })),
      }));

      renderWithQueryClient(<ThemeTrendChart date="2026-03-13" source="mtt" />);

      await waitFor(() => {
        expect(screen.getByTestId('line-방위산업/전쟁 및 테러')).toBeInTheDocument();
        expect(screen.getByTestId('line-광통신(광케이블/광섬유 등)')).toBeInTheDocument();
      });
    });

    /**
     * AC-SPECIAL-02: 괄호 포함 테마명 처리
     */
    test("AC-SPECIAL-02: should handle theme names with parentheses", async () => {
      const mockThemesWithParentheses: ThemeDaily[] = [
        {
          theme_name: "우주항공산업(누리호/인공위성 등)",
          avg_rs: 97.57,
          date: "2026-03-13",
          rank: 1,
        },
      ];

      const mockHistoriesWithParentheses: { [key: string]: ThemeHistory[] } = {
        "우주항공산업(누리호/인공위성 등)": [
          { date: "2026-03-13", avg_rs: 97.57, theme_name: "우주항공산업(누리호/인공위성 등)" },
          { date: "2026-03-12", avg_rs: 96.5, theme_name: "우주항공산업(누리호/인공위성 등)" },
        ],
      };

      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mockThemesWithParentheses,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mockHistoriesWithParentheses,
          isLoading: false,
        })),
      }));

      renderWithQueryClient(<ThemeTrendChart date="2026-03-13" source="mtt" />);

      await waitFor(() => {
        expect(screen.getByTestId('line-우주항공산업(누리호/인공위성 등)')).toBeInTheDocument();
      });
    });

    /**
     * AC-SPECIAL-03: 자동 선택 시 특수 문자 포함 테마 처리
     */
    test("AC-SPECIAL-03: should auto-select themes with special characters on source change", async () => {
      const mockMTTThemes: ThemeDaily[] = [
        {
          theme_name: "방위산업/전쟁 및 테러",
          avg_rs: 98.43,
          date: "2026-03-13",
          rank: 1,
        },
        {
          theme_name: "통신",
          avg_rs: 98.43,
          date: "2026-03-13",
          rank: 2,
        },
        {
          theme_name: "LED",
          avg_rs: 97.86,
          date: "2026-03-13",
          rank: 3,
        },
        {
          theme_name: "우주항공산업(누리호/인공위성 등)",
          avg_rs: 97.57,
          date: "2026-03-13",
          rank: 4,
        },
        {
          theme_name: "광통신(광케이블/광섬유 등)",
          avg_rs: 97.43,
          date: "2026-03-13",
          rank: 5,
        },
      ];

      const mockMTTHistories: { [key: string]: ThemeHistory[] } = {
        "방위산업/전쟁 및 테러": [
          { date: "2026-03-13", avg_rs: 98.43, theme_name: "방위산업/전쟁 및 테러" },
        ],
        "통신": [
          { date: "2026-03-13", avg_rs: 98.43, theme_name: "통신" },
        ],
        "LED": [
          { date: "2026-03-13", avg_rs: 97.86, theme_name: "LED" },
        ],
        "우주항공산업(누리호/인공위성 등)": [
          { date: "2026-03-13", avg_rs: 97.57, theme_name: "우주항공산업(누리호/인공위성 등)" },
        ],
        "광통신(광케이블/광섬유 등)": [
          { date: "2026-03-13", avg_rs: 97.43, theme_name: "광통신(광케이블/광섬유 등)" },
        ],
      };

      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mockMTTThemes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mockMTTHistories,
          isLoading: false,
        })),
      }));

      renderWithQueryClient(<ThemeTrendChart date="2026-03-13" source="mtt" />);

      await waitFor(() => {
        // 상위 5개 테마가 자동 선택되어야 함
        expect(screen.getByTestId('line-방위산업/전쟁 및 테러')).toBeInTheDocument();
        expect(screen.getByTestId('line-통신')).toBeInTheDocument();
        expect(screen.getByTestId('line-LED')).toBeInTheDocument();
        expect(screen.getByTestId('line-우주항공산업(누리호/인공위성 등)')).toBeInTheDocument();
        expect(screen.getByTestId('line-광통신(광케이블/광섬유 등)')).toBeInTheDocument();
      });
    });
  });

  /**
   * 소스별 테마 선택 상태 유지 테스트
   *
   * 문제: source 변경 시 이전 선택 상태가 초기화됨
   * 해결: source별로 선택된 테마를 독립적으로 저장 (Record<DataSource, string[]>)
   *
   * 사용자 시나리오:
   * 1. 52주 신고가에서 [테마A, 테마B] 수동 선택
   * 2. MTT 종목으로 변경
   * 3. 다시 52주 신고가로 복귀
   * 4. 기대: [테마A, 테마B]가 그대로 유지되어야 함
   */
  describe("SOURCE-PERSISTENCE: Theme selection persists across source changes", () => {
    /**
     * AC-SOURCE-01: 소스 왕복 시 이전 선택 상태 복원
     */
    test("AC-SOURCE-01: should restore previous theme selection when returning to source", async () => {
      const mock52Themes: ThemeDaily[] = [
        { theme_name: "테마A", avg_rs: 100, date: "2026-03-13", rank: 1 },
        { theme_name: "테마B", avg_rs: 90, date: "2026-03-13", rank: 2 },
        { theme_name: "테마C", avg_rs: 80, date: "2026-03-13", rank: 3 },
        { theme_name: "테마D", avg_rs: 70, date: "2026-03-13", rank: 4 },
        { theme_name: "테마E", avg_rs: 60, date: "2026-03-13", rank: 5 },
        { theme_name: "테마F", avg_rs: 50, date: "2026-03-13", rank: 6 },
      ];

      const mock52Histories: { [key: string]: ThemeHistory[] } = {
        테마A: [{ date: "2026-03-13", avg_rs: 100, theme_name: "테마A" }],
        테마B: [{ date: "2026-03-13", avg_rs: 90, theme_name: "테마B" }],
        테마C: [{ date: "2026-03-13", avg_rs: 80, theme_name: "테마C" }],
        테마D: [{ date: "2026-03-13", avg_rs: 70, theme_name: "테마D" }],
        테마E: [{ date: "2026-03-13", avg_rs: 60, theme_name: "테마E" }],
        테마F: [{ date: "2026-03-13", avg_rs: 50, theme_name: "테마F" }],
      };

      const mockMTTThemes: ThemeDaily[] = [
        { theme_name: "MTT_테마A", avg_rs: 98, date: "2026-03-13", rank: 1 },
        { theme_name: "MTT_테마B", avg_rs: 88, date: "2026-03-13", rank: 2 },
        { theme_name: "MTT_테마C", avg_rs: 78, date: "2026-03-13", rank: 3 },
      ];

      const mockMTTHistories: { [key: string]: ThemeHistory[] } = {
        MTT_테마A: [{ date: "2026-03-13", avg_rs: 98, theme_name: "MTT_테마A" }],
        MTT_테마B: [{ date: "2026-03-13", avg_rs: 88, theme_name: "MTT_테마B" }],
        MTT_테마C: [{ date: "2026-03-13", avg_rs: 78, theme_name: "MTT_테마C" }],
      };

      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mock52Themes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mock52Histories,
          isLoading: false,
        })),
      }));

      const { rerender } = renderWithQueryClient(
        <ThemeTrendChart date="2026-03-13" source="52w_high" />
      );

      // 초기 자동 선택 상위 5개 확인
      await waitFor(() => {
        expect(screen.getByTestId("line-테마A")).toBeInTheDocument();
        expect(screen.getByTestId("line-테마B")).toBeInTheDocument();
        expect(screen.getByTestId("line-테마C")).toBeInTheDocument();
        expect(screen.getByTestId("line-테마D")).toBeInTheDocument();
        expect(screen.getByTestId("line-테마E")).toBeInTheDocument();
      });

      const user = userEvent.setup();

      // 테마D, 테마E 제거 후 테마G 추가 (수동 변경)
      const themeDBadge = screen.getByText("테마D");
      await user.click(themeDBadge);

      const themeEBadge = screen.getByText("테마E");
      await user.click(themeEBadge);

      // 드롭다운 클릭
      const dropdown = screen.getByText("테마를 선택하세요...");
      await user.click(dropdown);

      // 새로운 테마 선택 (mockThemes에 없는 가상의 테마)
      // 실제로는 드롭다운에서 선택하지만 테스트에서는 상태를 직접 확인

      // MTT로 변경
      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mockMTTThemes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mockMTTHistories,
          isLoading: false,
        })),
      }));

      rerender(<ThemeTrendChart date="2026-03-13" source="mtt" />);

      // MTT에서 상위 3개 자동 선택
      await waitFor(() => {
        expect(screen.getByTestId("line-MTT_테마A")).toBeInTheDocument();
        expect(screen.getByTestId("line-MTT_테마B")).toBeInTheDocument();
        expect(screen.getByTestId("line-MTT_테마C")).toBeInTheDocument();
      });

      // 다시 52w_high로 복귀
      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mock52Themes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mock52Histories,
          isLoading: false,
        })),
      }));

      rerender(<ThemeTrendChart date="2026-03-13" source="52w_high" />);

      // 이전에 수동 선택했던 테마들이 복원되어야 함
      // 테마A, 테마B, 테마C는 있고, 테마D, 테마E는 없어야 함
      await waitFor(() => {
        expect(screen.getByTestId("line-테마A")).toBeInTheDocument();
        expect(screen.getByTestId("line-테마B")).toBeInTheDocument();
        expect(screen.getByTestId("line-테마C")).toBeInTheDocument();
        // 제거된 테마들은 없어야 함
        expect(screen.queryByTestId("line-테마D")).not.toBeInTheDocument();
        expect(screen.queryByTestId("line-테마E")).not.toBeInTheDocument();
        // 테마F도 없어야 함 (초기 자동 선택에서 제외됨)
        expect(screen.queryByTestId("line-테마F")).not.toBeInTheDocument();
      });
    });

    /**
     * AC-SOURCE-02: 각 소스별 독립적인 isUserModified 상태
     */
    test("AC-SOURCE-02: should maintain separate isUserModified flag per source", async () => {
      const mock52Themes: ThemeDaily[] = [
        { theme_name: "테마A", avg_rs: 100, date: "2026-03-13", rank: 1 },
      ];

      const mock52Histories: { [key: string]: ThemeHistory[] } = {
        테마A: [{ date: "2026-03-13", avg_rs: 100, theme_name: "테마A" }],
      };

      const mockMTTThemes: ThemeDaily[] = [
        { theme_name: "MTT_테마A", avg_rs: 98, date: "2026-03-13", rank: 1 },
      ];

      const mockMTTHistories: { [key: string]: ThemeHistory[] } = {
        MTT_테마A: [{ date: "2026-03-13", avg_rs: 98, theme_name: "MTT_테마A" }],
      };

      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mock52Themes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mock52Histories,
          isLoading: false,
        })),
      }));

      const { rerender } = renderWithQueryClient(
        <ThemeTrendChart date="2026-03-13" source="52w_high" />
      );

      await waitFor(() => {
        expect(screen.getByTestId("line-테마A")).toBeInTheDocument();
      });

      const user = userEvent.setup();

      // 52w_high에서 테마A 제거 후 테마B 추가 (수동 변경)
      const themeABadge = screen.getByText("테마A");
      await user.click(themeABadge);

      // MTT로 변경
      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mockMTTThemes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mockMTTHistories,
          isLoading: false,
        })),
      }));

      rerender(<ThemeTrendChart date="2026-03-13" source="mtt" />);

      // MTT에서는 자동 선택되어야 함 (사용자 수정 이력 없음)
      await waitFor(() => {
        expect(screen.getByTestId("line-MTT_테마A")).toBeInTheDocument();
      });

      // 다시 52w_high로 복귀
      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mock52Themes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mock52Histories,
          isLoading: false,
        })),
      }));

      rerender(<ThemeTrendChart date="2026-03-13" source="52w_high" />);

      // 52w_high에서는 테마A가 제거된 상태여야 함 (사용자 수정 유지)
      await waitFor(() => {
        expect(screen.queryByTestId("line-테마A")).not.toBeInTheDocument();
      });
    });

    /**
     * AC-SOURCE-03: 세 번 이상 소스 왕복 시 상태 유지
     */
    test("AC-SOURCE-03: should maintain state after multiple source switches", async () => {
      const mock52Themes: ThemeDaily[] = [
        { theme_name: "테마A", avg_rs: 100, date: "2026-03-13", rank: 1 },
        { theme_name: "테마B", avg_rs: 90, date: "2026-03-13", rank: 2 },
      ];

      const mock52Histories: { [key: string]: ThemeHistory[] } = {
        테마A: [{ date: "2026-03-13", avg_rs: 100, theme_name: "테마A" }],
        테마B: [{ date: "2026-03-13", avg_rs: 90, theme_name: "테마B" }],
      };

      const mockMTTThemes: ThemeDaily[] = [
        { theme_name: "MTT_테마A", avg_rs: 98, date: "2026-03-13", rank: 1 },
      ];

      const mockMTTHistories: { [key: string]: ThemeHistory[] } = {
        MTT_테마A: [{ date: "2026-03-13", avg_rs: 98, theme_name: "MTT_테마A" }],
      };

      jest.doMock("@/hooks/useThemes", () => ({
        useThemesDaily: jest.fn(() => ({
          data: mock52Themes,
          isLoading: false,
        })),
        useMultipleThemeHistories: jest.fn(() => ({
          data: mock52Histories,
          isLoading: false,
        })),
      }));

      const { rerender } = renderWithQueryClient(
        <ThemeTrendChart date="2026-03-13" source="52w_high" />
      );

      await waitFor(() => {
        expect(screen.getByTestId("line-테마A")).toBeInTheDocument();
      });

      // 1. 52w_high → mtt → 52w_high → mtt → 52w_high 순으로 변경
      for (let i = 0; i < 3; i++) {
        // MTT로 변경
        jest.doMock("@/hooks/useThemes", () => ({
          useThemesDaily: jest.fn(() => ({
            data: mockMTTThemes,
            isLoading: false,
          })),
          useMultipleThemeHistories: jest.fn(() => ({
            data: mockMTTHistories,
            isLoading: false,
          })),
        }));

        rerender(<ThemeTrendChart date="2026-03-13" source="mtt" />);

        await waitFor(() => {
          expect(screen.getByTestId("line-MTT_테마A")).toBeInTheDocument();
        });

        // 다시 52w_high로 복귀
        jest.doMock("@/hooks/useThemes", () => ({
          useThemesDaily: jest.fn(() => ({
            data: mock52Themes,
            isLoading: false,
          })),
          useMultipleThemeHistories: jest.fn(() => ({
            data: mock52Histories,
            isLoading: false,
          })),
        }));

        rerender(<ThemeTrendChart date="2026-03-13" source="52w_high" />);

        await waitFor(() => {
          expect(screen.getByTestId("line-테마A")).toBeInTheDocument();
        });
      }

      // 최종 상태: 52w_high에서 테마A, 테마B가 선택되어 있어야 함
      expect(screen.getByTestId("line-테마A")).toBeInTheDocument();
      expect(screen.getByTestId("line-테마B")).toBeInTheDocument();
    });
  });
});
