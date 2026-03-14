"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useThemesDaily, useMultipleThemeHistories } from "@/hooks/useThemes";
import { DataSource } from "@/lib/api";
import clsx from "clsx";

interface ThemeTrendChartProps {
  date: string;
  source?: DataSource;
}

type PeriodOption = { label: string; days: number };

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: "7일", days: 7 },
  { label: "30일", days: 30 },
  { label: "전체", days: 365 },
];

// Color palette for multiple theme lines
const LINE_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#F97316", // orange
  "#EC4899", // pink
  "#84CC16", // lime
  "#6366F1", // indigo
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl max-w-xs">
        <p className="text-gray-400 text-xs mb-2">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-300 truncate">{entry.name}:</span>
            <span className="text-white font-medium ml-auto">
              {entry.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

/**
 * Custom Legend 컴포넌트
 * @MX:NOTE: F-03 Legend 더블클릭으로 테마 라인 비활성화/활성화 토글
 */
interface CustomLegendProps {
  payload?: Array<{ value: string; color: string; dataKey?: string }>;
  disabledThemes: Set<string>;
  onToggleTheme: (theme: string) => void;
}

function CustomLegend({ payload, disabledThemes, onToggleTheme }: CustomLegendProps) {
  if (!payload) return null;

  return (
    <ul className="flex flex-wrap gap-4 justify-center">
      {payload.map((entry) => {
        const isDisabled = disabledThemes.has(entry.value);
        return (
          <li
            key={entry.value}
            className={clsx(
              "cursor-pointer flex items-center gap-1 transition-opacity",
              isDisabled ? "opacity-30 line-through" : ""
            )}
            onDoubleClick={() => onToggleTheme(entry.value)}
          >
            <span className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }} />
            <span className="text-sm">{entry.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ThemeTrendChart({ date, source = "52w_high" }: ThemeTrendChartProps) {
  // @MX:NOTE: 소스별로 선택된 테마와 사용자 수정 플래그를 저장하여 상태 유지
  const [selectedThemesBySource, setSelectedThemesBySource] = useState<Record<DataSource, string[]>>({
    "52w_high": [],
    mtt: [],
  });
  const [isUserModifiedBySource, setIsUserModifiedBySource] = useState<Record<DataSource, boolean>>({
    "52w_high": false,
    mtt: false,
  });

  // 현재 소스의 선택된 테마와 사용자 수정 플래그
  const selectedThemes = selectedThemesBySource[source] || [];
  const isUserModified = isUserModifiedBySource[source] || false;

  // @MX:NOTE: 비활성화된 테마를 추적하는 상태 (더블클릭 토글용)
  const [disabledThemesBySource, setDisabledThemesBySource] = useState<Record<DataSource, Set<string>>>({
    "52w_high": new Set(),
    mtt: new Set(),
  });
  const disabledThemes = disabledThemesBySource[source] || new Set();

  const [period, setPeriod] = useState<PeriodOption>(PERIOD_OPTIONS[1]); // Default 30일
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: dailyThemes, isLoading: themesLoading } = useThemesDaily(date, source);

  // @MX:NOTE: 소스 변경 시 상태 복원 및 초기 로드 시 자동 선택
  useEffect(() => {
    // 해당 소스의 현재 선택 상태를 가져옴�
    const currentThemes = selectedThemesBySource[source] || [];
    const currentIsUserModified = isUserModifiedBySource[source] || false;

    // 자동 선택: 사용자가 수동으로 변경한 적이 없고, 데이터가 있고, 선택된 테마가 없는 경우
    if (!currentIsUserModified && dailyThemes && dailyThemes.length > 0 && currentThemes.length === 0) {
      const top5Themes = dailyThemes.slice(0, 5).map((t) => t.theme_name);
      setSelectedThemesBySource((prev) => ({
        ...prev,
        [source]: top5Themes,
      }));
    }
  }, [dailyThemes, source]); // source와 dailyThemes 변경 시 실행

  // Available themes for selection
  const availableThemes = useMemo(() => {
    if (!dailyThemes) return [];
    return dailyThemes
      .map((t) => t.theme_name)
      .filter((name) =>
        name.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [dailyThemes, searchQuery]);

  // Fetch history for selected themes
  const { data: historiesData, isLoading: historiesLoading } =
    useMultipleThemeHistories(selectedThemes, period.days, source);

  // Merge all theme histories into a single dataset for recharts
  const chartData = useMemo(() => {
    if (!historiesData || selectedThemes.length === 0) return [];

    // Collect all unique dates
    const allDates = new Set<string>();
    selectedThemes.forEach((theme) => {
      const history = historiesData[theme] || [];
      history.forEach((h) => allDates.add(h.date));
    });

    // Sort dates ascending
    const sortedDates = Array.from(allDates).sort();

    // Build chart data points
    return sortedDates.map((date) => {
      const point: { date: string; [key: string]: number | string } = { date };
      selectedThemes.forEach((theme) => {
        const history = historiesData[theme] || [];
        const entry = history.find((h) => h.date === date);
        if (entry) {
          point[theme] = entry.avg_rs;
        }
      });
      return point;
    });
  }, [historiesData, selectedThemes]);

  const toggleTheme = (theme: string) => {
    // 사용자가 수동으로 변경했음을 표시 (현재 소스에 대해서만)
    setIsUserModifiedBySource((prev) => ({
      ...prev,
      [source]: true,
    }));

    setSelectedThemesBySource((prev) => {
      const current = prev[source] || [];
      if (current.includes(theme)) {
        return {
          ...prev,
          [source]: current.filter((t) => t !== theme),
        };
      }
      if (current.length >= 10) {
        alert("최대 10개의 테마를 선택할 수 있습니다.");
        return prev;
      }
      return {
        ...prev,
        [source]: [...current, theme],
      };
    });
    // 테마 선택이 변경되면 비활성화 상태 초기화
    setDisabledThemesBySource((prev) => ({
      ...prev,
      [source]: new Set(),
    }));
  };

  const removeTheme = (theme: string) => {
    // 사용자가 수동으로 변경했음을 표시
    setIsUserModifiedBySource((prev) => ({
      ...prev,
      [source]: true,
    }));

    setSelectedThemesBySource((prev) => {
      const current = prev[source] || [];
      return {
        ...prev,
        [source]: current.filter((t) => t !== theme),
      };
    });
    // 테마 선택이 변경되면 비활성화 상태 초기화
    setDisabledThemesBySource((prev) => ({
      ...prev,
      [source]: new Set(),
    }));
  };

  // @MX:NOTE: F-03 라인 더블클릭으로 비활성화/활성화 토글
  const toggleThemeDisabled = (theme: string) => {
    setDisabledThemesBySource((prev) => {
      const current = prev[source] || new Set();
      const newSet = new Set(current);
      if (newSet.has(theme)) {
        newSet.delete(theme);
      } else {
        newSet.add(theme);
      }
      return {
        ...prev,
        [source]: newSet,
      };
    });
  };

  // @MX:NOTE: F-04 단일 데이터 포인트 감지 (데이터가 1개만 있는 테마)
  const isSinglePointTheme = (theme: string): boolean => {
    if (!historiesData || !historiesData[theme]) return false;
    return historiesData[theme].length === 1;
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-start">
        {/* Theme Multi-Select */}
        <div className="flex-1 min-w-48 relative">
          <label className="block text-xs text-gray-400 mb-1">
            테마 선택 (최대 10개)
          </label>
          <div
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 cursor-pointer flex flex-wrap gap-1 min-h-[38px]"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {selectedThemes.length === 0 ? (
              <span className="text-gray-400 text-sm">테마를 선택하세요...</span>
            ) : (
              selectedThemes.map((theme) => (
                <span
                  key={theme}
                  className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTheme(theme);
                  }}
                >
                  {theme}
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </span>
              ))
            )}
          </div>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-hidden">
              <div className="p-2 border-b border-gray-600">
                <input
                  type="text"
                  placeholder="테마 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-gray-600 text-white text-sm px-3 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <ul className="overflow-y-auto max-h-48">
                {themesLoading ? (
                  <li className="px-3 py-2 text-gray-400 text-sm">
                    로딩 중...
                  </li>
                ) : availableThemes.length === 0 ? (
                  <li className="px-3 py-2 text-gray-400 text-sm">
                    결과 없음
                  </li>
                ) : (
                  availableThemes.map((theme) => {
                    const isSelected = selectedThemes.includes(theme);
                    return (
                      <li
                        key={theme}
                        className={clsx(
                          "px-3 py-2 cursor-pointer text-sm flex items-center justify-between",
                          isSelected
                            ? "bg-blue-600/30 text-blue-300"
                            : "text-gray-300 hover:bg-gray-600"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTheme(theme);
                        }}
                      >
                        <span>{theme}</span>
                        {isSelected && (
                          <svg
                            className="w-4 h-4 text-blue-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Period Selector */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">기간</label>
          <div className="flex rounded-lg overflow-hidden border border-gray-600">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setPeriod(opt)}
                className={clsx(
                  "px-4 py-2 text-sm transition-colors",
                  period.label === opt.label
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Area - click outside to close dropdown */}
      <div onClick={() => setDropdownOpen(false)}>
        {selectedThemes.length === 0 && !dailyThemes || dailyThemes?.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>데이터가 없습니다</p>
          </div>
        ) : selectedThemes.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>위에서 테마를 선택하면 RS 추이 차트가 표시됩니다</p>
          </div>
        ) : historiesLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>선택한 테마의 데이터가 없습니다</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#9CA3AF", fontSize: 11 }}
                axisLine={{ stroke: "#4B5563" }}
                tickLine={{ stroke: "#4B5563" }}
                tickFormatter={(v) => {
                  // Format date to MM/DD
                  const parts = String(v).split("-");
                  if (parts.length >= 3) {
                    return `${parts[1]}/${parts[2]}`;
                  }
                  return v;
                }}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#9CA3AF", fontSize: 11 }}
                axisLine={{ stroke: "#4B5563" }}
                tickLine={{ stroke: "#4B5563" }}
                label={{
                  value: "RS 점수",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#9CA3AF",
                  fontSize: 11,
                  offset: 10,
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                content={<CustomLegend disabledThemes={disabledThemes} onToggleTheme={toggleThemeDisabled} />}
                wrapperStyle={{
                  paddingTop: "8px",
                  fontSize: "12px",
                  color: "#D1D5DB",
                }}
              />
              {selectedThemes.map((theme, index) => {
                const isDisabled = disabledThemes.has(theme);
                const isSinglePoint = isSinglePointTheme(theme);
                return (
                  <Line
                    key={theme}
                    type="monotone"
                    dataKey={theme}
                    stroke={LINE_COLORS[index % LINE_COLORS.length]}
                    strokeWidth={2}
                    strokeOpacity={isDisabled ? 0.2 : 1}
                    // @MX:NOTE: F-04 단일 데이터 포인트는 dot 표시, 다중 포인트는 dot=false
                    dot={isSinglePoint ? { r: 8, strokeWidth: 2 } : false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
