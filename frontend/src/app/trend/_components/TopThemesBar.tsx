"use client";

import React, { useState } from "react";
import { useThemesDaily } from "@/hooks/useThemes";
import { ThemeDaily, DataSource } from "@/lib/api";

// @MX:ANCHOR: 테마별 RS 점수 시각화 컴포넌트 (fan_in: trend/page.tsx)
// @MX:REASON: 이 컴포넌트는 상위 테마 데이터를 시각화하는 주요 UI 진입점입니다.
//
// @MX:NOTE: P0-2 후속 — recharts 의존을 제거하고 CSS/flexbox 로 직접 렌더링한다.
// @MX:REASON: 이 컴포넌트는 /trend 오버뷰 탭의 첫 섹션(접힘선 위)이라 next/dynamic
//   으로 지연시킬 수 없었고, 그 결과 recharts 청크(약 406KB)가 초기 페이로드에
//   남아 있었다. 가로 막대 차트는 recharts 없이도 동일하게 표현 가능하므로
//   여기서 recharts 를 걷어내면 해당 청크가 초기 로드에서 완전히 빠진다.
// @MX:WARN: 막대 순서는 `topThemes` 를 다시 reverse 한 순서로 위→아래 렌더한다.
//   recharts vertical BarChart 는 첫 항목을 **아래**에 그렸기 때문에, 기존 동작
//   (높은 RS 가 위)을 유지하려면 이 재역순이 필수다.

// SPEC-MTT-004 F-01: 테마 개수 설정 상수
const MIN_THEME_COUNT = 5;
const MAX_THEME_COUNT = 30;
const DEFAULT_THEME_COUNT = 10;

// @MX:NOTE: SPEC-MTT-013 선택된 테마 강조 투명도
const SELECTED_BAR_OPACITY = 1.0;
const UNSELECTED_BAR_OPACITY = 0.4;

// X축 눈금 (RS 점수 도메인 0-100)
const AXIS_TICKS = [0, 25, 50, 75, 100];

const Y_LABEL_WIDTH = 110;
const RIGHT_GUTTER = 80;
const ROW_HEIGHT = 40;
const AXIS_HEIGHT = 28;

interface TopThemesBarProps {
  date: string;
  source?: DataSource;
  // @MX:NOTE: SPEC-MTT-013 테마 클릭 핸들러
  onThemeClick?: (themeName: string) => void;
  selectedTheme?: string | null;
}

// Compute color based on RS score (blue=low, red=high)
function getBarColor(rsScore: number): string {
  // RS score range 0-100
  // Low: blue (#3B82F6), Mid: purple (#8B5CF6), High: red (#EF4444)
  if (rsScore >= 75) return "#EF4444";
  if (rsScore >= 60) return "#F97316";
  if (rsScore >= 45) return "#EAB308";
  if (rsScore >= 30) return "#8B5CF6";
  return "#3B82F6";
}

function ThemeTooltip({ theme }: { theme: ThemeDaily }) {
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl">
      <p className="text-white font-semibold mb-1">{theme.theme_name}</p>
      <p className="text-blue-400 text-sm">
        RS 점수: <span className="text-white">{(theme.avg_rs ?? 0).toFixed(1)}</span>
      </p>
      <p className="text-gray-400 text-sm">
        종목 수: <span className="text-white">{theme.stock_count}개</span>
      </p>
      {theme.change_sum !== undefined && (
        <p className="text-gray-400 text-sm">
          등락합:{" "}
          <span
            className={(theme.change_sum ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
          >
            {(theme.change_sum ?? 0) >= 0 ? "+" : ""}
            {(theme.change_sum ?? 0).toFixed(2)}%
          </span>
        </p>
      )}
    </div>
  );
}

export const TopThemesBar = React.memo(function TopThemesBar({ date, source = "mtt", onThemeClick, selectedTheme }: TopThemesBarProps) {
  const { data: themes, isLoading, error } = useThemesDaily(date, source);

  // SPEC-MTT-004 F-01: 상위 테마 표시 개수 동적 설정
  // 범위: 5-30, 기본값: 10
  const [themeCount, setThemeCount] = useState(DEFAULT_THEME_COUNT);

  // @MX:NOTE: SPEC-MTT-013 호버 툴팁 대상 테마
  const [hoveredTheme, setHoveredTheme] = useState<ThemeDaily | null>(null);

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
              <div
                className="h-6 bg-gray-700 rounded animate-pulse"
                style={{ width: `${Math.random() * 50 + 30}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 flex items-center justify-center h-48">
        <p className="text-red-400">데이터를 불러오는데 실패했습니다</p>
      </div>
    );
  }

  if (!themes || themes.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 flex items-center justify-center h-48">
        <p className="text-gray-400">해당 날짜의 데이터가 없습니다</p>
      </div>
    );
  }

  // Take top N themes (F-01: 동적 설정, 범위 5-30, 기본값 10)
  // 'kodex_leverage', 'kosdaq_leverage' 및 신규 지수 테마 제외 필터링 추가
  const EXCLUDED_THEMES = ["kodex_leverage", "kosdaq_leverage", "kospi", "kospi200", "kosdaq", "kosdaq150"];
  const topThemes = [...themes]
    .filter(t => !EXCLUDED_THEMES.includes(t.theme_name))
    .sort((a, b) => (b.avg_rs ?? 0) - (a.avg_rs ?? 0))
    .slice(0, themeCount)
    .reverse(); // Reverse so highest is at top of horizontal bar chart

  const chartHeight = Math.max(topThemes.length * ROW_HEIGHT, 300);
  // recharts vertical 레이아웃은 첫 항목을 아래에 그리므로, 위→아래 렌더를 위해 재역순
  const rowsTopDown = [...topThemes].reverse();
  const rowHeight = rowsTopDown.length > 0 ? chartHeight / rowsTopDown.length : ROW_HEIGHT;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      {/* SPEC-MTT-004 F-01: 테마 개수 설정 슬라이더 */}
      <div className="mb-4 flex items-center gap-4">
        <label htmlFor="theme-count-slider" className="text-sm text-gray-400 whitespace-nowrap">
          표시: {themeCount}개
        </label>
        <input
          id="theme-count-slider"
          type="range"
          min={MIN_THEME_COUNT}
          max={MAX_THEME_COUNT}
          value={themeCount}
          onChange={(e) => setThemeCount(Number(e.target.value))}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          aria-label="테마 개수 설정"
        />
      </div>

      {/* @MX:NOTE: P0-2 후속 — recharts 대체 CSS 가로 막대 차트 */}
      <div
        data-testid="top-themes-chart"
        className="relative"
        style={{ height: chartHeight + AXIS_HEIGHT }}
      >
        {/* 플롯 영역 */}
        <div className="flex" style={{ height: chartHeight }}>
          {/* Y축: 테마명 */}
          <div className="shrink-0 flex flex-col" style={{ width: Y_LABEL_WIDTH }}>
            {rowsTopDown.map((theme) => (
              <div
                key={`ylab-${theme.theme_name}`}
                className="flex items-center justify-end pr-2"
                style={{ height: rowHeight }}
                title={theme.theme_name}
              >
                <span className="text-[11px] text-gray-300 truncate">{theme.theme_name}</span>
              </div>
            ))}
          </div>

          {/* 플롯 본체 (오른쪽 80px 는 종목 수 라벨용 여백) */}
          <div className="flex-1 relative" style={{ paddingRight: RIGHT_GUTTER }}>
            {/* 세로 그리드 라인 */}
            {AXIS_TICKS.map((t) => (
              <div
                key={`grid-${t}`}
                className="absolute inset-y-0 border-l border-dashed border-gray-700"
                style={{ left: `${t}%` }}
                aria-hidden="true"
              />
            ))}

            {/* 막대 행 */}
            {rowsTopDown.map((theme) => {
              const rs = Math.max(0, Math.min(100, theme.avg_rs ?? 0));
              const isSelected = selectedTheme === theme.theme_name;
              return (
                <div
                  key={`row-${theme.theme_name}`}
                  className="relative"
                  style={{ height: rowHeight }}
                  onMouseEnter={() => setHoveredTheme(theme)}
                  onMouseLeave={() => setHoveredTheme(null)}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${theme.theme_name} RS ${rs.toFixed(1)}`}
                    onClick={() => onThemeClick?.(theme.theme_name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onThemeClick?.(theme.theme_name);
                      }
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 rounded-r cursor-pointer transition-opacity"
                    style={{
                      width: `${rs}%`,
                      backgroundColor: getBarColor(rs),
                      opacity: isSelected ? SELECTED_BAR_OPACITY : UNSELECTED_BAR_OPACITY,
                    }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 text-[11px] text-gray-400 whitespace-nowrap pointer-events-none"
                    style={{ left: `calc(${rs}% + 8px)` }}
                  >
                    {theme.stock_count}종
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* X축 눈금 */}
        <div className="flex" style={{ height: AXIS_HEIGHT }}>
          <div className="shrink-0" style={{ width: Y_LABEL_WIDTH }} />
          <div className="flex-1 relative" style={{ paddingRight: RIGHT_GUTTER }}>
            {AXIS_TICKS.map((t) => (
              <span
                key={`tick-${t}`}
                className="absolute top-1 -translate-x-1/2 text-[11px] text-gray-500"
                style={{ left: `${t}%` }}
              >
                {t}
              </span>
            ))}
            <span className="absolute inset-x-0 top-5 text-center text-[11px] text-gray-500">
              RS 점수
            </span>
          </div>
        </div>

        {/* 툴팁 */}
        {hoveredTheme && (
          <div className="absolute right-2 top-2 z-20 pointer-events-none">
            <ThemeTooltip theme={hoveredTheme} />
          </div>
        )}
      </div>
    </div>
  );
});
