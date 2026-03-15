"use client";

import { useState, useEffect } from "react";
import { useDates } from "@/hooks/useThemes";
import { TopThemesBar } from "./_components/TopThemesBar";
import { SurgingThemesCard } from "./_components/SurgingThemesCard";
import { ThemeTrendChart } from "./_components/ThemeTrendChart";
import { StockAnalysisTabs } from "./_components/StockAnalysisTabs";
import { ThemeStocksPanel } from "./_components/ThemeStocksPanel";
import type { DataSource } from "@/lib/api";

// @MX:NOTE: 데이터 소스 전환 시 선택된 날짜를 자동으로 초기화하여 데이터 불일치를 방지합니다.
// @MX:ANCHOR: 트렌드 페이지 기본 컴포넌트 (fan_in: Next.js 라우터)
// @MX:REASON: 이 컴포넌트는 테마 트렌드 대시보드의 메인 진입점입니다.

// @MX:NOTE: SPEC-MTT-013 선택된 테마 상태
// @MX:ANCHOR: 테마 종목 패널 상태 관리 (fan_in: TopThemesBar, ThemeStocksPanel)
// @MX:REASON: 이 상태는 테마 클릭 시 패널 표시/숨김을 제어합니다.

const SOURCE_LABELS: Record<DataSource, string> = {
  "52w_high": "52주 신고가",
  mtt: "MTT 종목",
};

export default function TrendPage() {
  const [source, setSource] = useState<DataSource>("52w_high");
  const { data: dates, isLoading: datesLoading, error: datesError } = useDates(source);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // @MX:NOTE: SPEC-MTT-013 선택된 테마 상태
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  // @MX:NOTE: 데이터 소스 변경 시 날짜를 초기화하고, 데이터 로드 완료 시 최신 날짜를 자동 선택합니다.
  // 데이터 소스 전환과 날짜 자동 선택을 하나의 useEffect로 통합하여 로직을 단순화했습니다.
  useEffect(() => {
    // 데이터 소스 변경 시 날짜 초기화
    setSelectedDate(null);

    // 데이터 로드 완료 시 최신 날짜 자동 선택
    if (dates && dates.length > 0) {
      setSelectedDate(dates[dates.length - 1]);
    }
  }, [source, dates]);

  // @MX:NOTE: SPEC-MTT-013 테마 클릭 핸들러
  function handleThemeClick(themeName: string) {
    // 같은 테마를 재클릭하면 패널 닫기 (토글 동작)
    if (selectedTheme === themeName) {
      setSelectedTheme(null);
    } else {
      setSelectedTheme(themeName);
    }
  }

  // @MX:NOTE: SPEC-MTT-013 패널 닫기 핸들러
  function handleClosePanel() {
    setSelectedTheme(null);
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">52주 고점 테마 트렌드</h1>
          <p className="text-gray-400 text-sm mt-1">
            테마별 RS(상대강도) 분석 대시보드
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Source Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-600">
            {(["52w_high", "mtt"] as DataSource[]).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  source === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {SOURCE_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-3">
            <label htmlFor="date-select" className="text-sm text-gray-400">
              기준일:
            </label>
            {datesLoading ? (
              <div className="h-9 w-36 bg-gray-700 rounded-lg animate-pulse" />
            ) : datesError ? (
              <span className="text-red-400 text-sm">날짜 로드 실패</span>
            ) : (
              <select
                id="date-select"
                value={selectedDate || ""}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {dates?.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {selectedDate ? (
        <>
          {/* Section 2 & 2.5: Top Themes Bar Chart & Surging Themes Card (SPEC-MTT-004 F-02, F-03, F-04) */}
          {/* SPEC-MTT-004 F-02: 2분할 가로 레이아웃 (데스크탑: 50/50, 모바일: 세로 스택) */}
          {/* SPEC-MTT-004 F-03: 동일 높이 유지 (CSS Grid items-stretch) */}
          {/* SPEC-MTT-004 F-04: 콘텐츠 기반 동적 높이 조정 (고정 높이 제거) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Themes Bar Chart */}
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-4">
                테마별 RS 점수 — {SOURCE_LABELS[source]}
              </h2>
              <TopThemesBar
                date={selectedDate}
                source={source}
                onThemeClick={handleThemeClick}
                selectedTheme={selectedTheme}
              />
            </div>

            {/* Surging Themes Card */}
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-4">
                신규 급등 테마 탐지
              </h2>
              <SurgingThemesCard date={selectedDate} source={source} />
            </div>
          </section>

          {/* @MX:NOTE: SPEC-MTT-013 ThemeStocksPanel 슬라이드 다운 패널 */}
          {selectedTheme && (
            <ThemeStocksPanel
              themeName={selectedTheme}
              date={selectedDate}
              source={source}
              onClose={handleClosePanel}
            />
          )}

          {/* Section 3: Theme RS Trend Chart */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              테마 RS 추이
            </h2>
            <ThemeTrendChart date={selectedDate} source={source} />
          </section>

          {/* Section 4: Stock Analysis Tabs */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              종목 분석
            </h2>
            <StockAnalysisTabs date={selectedDate} source={source} />
          </section>
        </>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">날짜를 선택하세요</p>
        </div>
      )}
    </div>
  );
}
