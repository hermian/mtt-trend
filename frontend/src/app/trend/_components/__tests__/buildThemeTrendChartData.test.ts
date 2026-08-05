/**
 * 테마 RS 추이 차트 데이터 병합 테스트
 * 버그: 희소 테마(지주사)의 비연속 일자(7/8, 7/23, 8/5)가 연속처럼 표시됨
 */
import {
  buildThemeTrendChartData,
  subtractDays,
} from "../buildThemeTrendChartData";

describe("buildThemeTrendChartData", () => {
  describe("subtractDays", () => {
    it("includes end date in N-day window", () => {
      // 30일 윈도우, end=2026-08-05 → start=2026-07-07
      expect(subtractDays("2026-08-05", 30)).toBe("2026-07-07");
    });
  });

  /**
   * 재현: 지주사처럼 드문 날짜만 있어도, X축에 중간 거래일이 채워지고
   * 데이터 없는 날은 null이어야 한다 (선이 연속처럼 이어지지 않음)
   */
  it("fills missing trading days with null for sparse themes (지주사 gap bug)", () => {
    const availableDates = [
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-23",
      "2026-07-27",
      "2026-07-29",
      "2026-07-30",
      "2026-08-05",
    ];

    const histories = {
      지주사: [
        { date: "2026-07-07", avg_rs: 70 },
        { date: "2026-07-08", avg_rs: 72 },
        { date: "2026-07-23", avg_rs: 75 },
        { date: "2026-08-05", avg_rs: 80 },
      ],
    };

    const chartData = buildThemeTrendChartData(
      ["지주사"],
      histories,
      availableDates,
      "2026-08-05",
      30
    );

    // X축에 중간 거래일이 포함되어야 함 (균등 4포인트가 아님)
    expect(chartData.length).toBeGreaterThan(4);
    expect(chartData.map((p) => p.date)).toEqual(
      availableDates.filter((d) => d >= "2026-07-07" && d <= "2026-08-05")
    );

    // 데이터 있는 날
    const byDate = Object.fromEntries(chartData.map((p) => [p.date, p["지주사"]]));
    expect(byDate["2026-07-08"]).toBe(72);
    expect(byDate["2026-07-23"]).toBe(75);
    expect(byDate["2026-08-05"]).toBe(80);

    // 중간 빈 날은 null (connectNulls=false 시 선 끊김)
    expect(byDate["2026-07-09"]).toBeNull();
    expect(byDate["2026-07-16"]).toBeNull();
    expect(byDate["2026-07-27"]).toBeNull();
    expect(byDate["2026-07-30"]).toBeNull();
  });

  it("sets null for themes missing on dates that other themes have", () => {
    const availableDates = ["2026-07-08", "2026-07-23", "2026-08-05"];
    const histories = {
      지주사: [
        { date: "2026-07-08", avg_rs: 72 },
        { date: "2026-08-05", avg_rs: 80 },
      ],
      AI: [
        { date: "2026-07-08", avg_rs: 90 },
        { date: "2026-07-23", avg_rs: 91 },
        { date: "2026-08-05", avg_rs: 92 },
      ],
    };

    const chartData = buildThemeTrendChartData(
      ["지주사", "AI"],
      histories,
      availableDates,
      "2026-08-05",
      30
    );

    expect(chartData).toEqual([
      { date: "2026-07-08", 지주사: 72, AI: 90 },
      { date: "2026-07-23", 지주사: null, AI: 91 },
      { date: "2026-08-05", 지주사: 80, AI: 92 },
    ]);
  });

  it("falls back to history dates when availableDates is empty", () => {
    const histories = {
      지주사: [
        { date: "2026-07-08", avg_rs: 72 },
        { date: "2026-08-05", avg_rs: 80 },
      ],
    };

    const chartData = buildThemeTrendChartData(
      ["지주사"],
      histories,
      [],
      "2026-08-05",
      30
    );

    expect(chartData).toEqual([
      { date: "2026-07-08", 지주사: 72 },
      { date: "2026-08-05", 지주사: 80 },
    ]);
  });

  it("returns empty when no themes selected", () => {
    expect(
      buildThemeTrendChartData([], { AI: [] }, ["2026-08-05"], "2026-08-05", 30)
    ).toEqual([]);
  });

  it("excludes dates outside the period window", () => {
    const availableDates = ["2026-06-01", "2026-07-20", "2026-08-05"];
    const histories = {
      AI: [
        { date: "2026-06-01", avg_rs: 50 },
        { date: "2026-07-20", avg_rs: 60 },
        { date: "2026-08-05", avg_rs: 70 },
      ],
    };

    const chartData = buildThemeTrendChartData(
      ["AI"],
      histories,
      availableDates,
      "2026-08-05",
      30
    );

    expect(chartData.map((p) => p.date)).toEqual(["2026-07-20", "2026-08-05"]);
    expect(chartData.find((p) => p.date === "2026-06-01")).toBeUndefined();
  });
});
