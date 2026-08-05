/**
 * 테마 RS 추이 차트 데이터 병합
 * @MX:NOTE: 데이터가 없는 날짜는 null로 채워 선이 끊기도록 함 (connectNulls=false 전제)
 * @MX:REASON: 희소 테마(예: 지주사)가 7/8→7/23→8/5처럼 비연속 일자만 있어도
 *   X축에 중간 거래일이 없으면 균등 간격으로 연속처럼 보인다.
 */

export interface ThemeHistoryPoint {
  date: string;
  avg_rs?: number | null;
}

export type ThemeHistoriesMap = Record<string, ThemeHistoryPoint[]>;

export type ChartDataPoint = {
  date: string;
  [theme: string]: string | number | null;
};

/** YYYY-MM-DD에서 days일 이전 날짜 반환 */
export function subtractDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - (days - 1)); // period일 포함 (endDate 기준 N일 윈도우)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 선택 테마 히스토리 + 전체 거래일을 병합해 차트용 시계열을 만든다.
 * - availableDates: 해당 source의 전체 데이터 일자 (거래일 X축)
 * - endDate/periodDays: 조회 윈도우 [endDate-(period-1), endDate]
 * - 테마별 값이 없으면 null (선 끊김)
 */
export function buildThemeTrendChartData(
  selectedThemes: string[],
  historiesData: ThemeHistoriesMap | undefined,
  availableDates: string[] | undefined,
  endDate: string,
  periodDays: number
): ChartDataPoint[] {
  if (!historiesData || selectedThemes.length === 0 || !endDate) return [];

  const startDate = subtractDays(endDate, periodDays);

  // 테마별 date → avg_rs 맵
  const historyByTheme = new Map<string, Map<string, number | null>>();
  selectedThemes.forEach((theme) => {
    const map = new Map<string, number | null>();
    (historiesData[theme] || []).forEach((h) => {
      map.set(h.date, h.avg_rs ?? null);
    });
    historyByTheme.set(theme, map);
  });

  // X축: 기간 내 전체 거래일. 없으면 선택 테마 히스토리 일자만 사용 (폴백)
  let axisDates: string[];
  if (availableDates && availableDates.length > 0) {
    axisDates = availableDates
      .filter((d) => d >= startDate && d <= endDate)
      .sort();
  } else {
    const allDates = new Set<string>();
    selectedThemes.forEach((theme) => {
      (historiesData[theme] || []).forEach((h) => {
        if (h.date >= startDate && h.date <= endDate) allDates.add(h.date);
      });
    });
    axisDates = Array.from(allDates).sort();
  }

  if (axisDates.length === 0) return [];

  return axisDates.map((date) => {
    const point: ChartDataPoint = { date };
    selectedThemes.forEach((theme) => {
      const value = historyByTheme.get(theme)?.get(date);
      // 해당 날짜에 테마 데이터가 없으면 null → 라인 끊김
      point[theme] = value !== undefined ? value : null;
    });
    return point;
  });
}
