"use client";

import { useState, useMemo } from "react";
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

export function ThemeTrendChart({ date, source = "52w_high" }: ThemeTrendChartProps) {
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodOption>(PERIOD_OPTIONS[1]); // Default 30일
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: dailyThemes, isLoading: themesLoading } = useThemesDaily(date, source);

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
    setSelectedThemes((prev) => {
      if (prev.includes(theme)) {
        return prev.filter((t) => t !== theme);
      }
      if (prev.length >= 10) {
        alert("최대 10개의 테마를 선택할 수 있습니다.");
        return prev;
      }
      return [...prev, theme];
    });
  };

  const removeTheme = (theme: string) => {
    setSelectedThemes((prev) => prev.filter((t) => t !== theme));
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
        {selectedThemes.length === 0 ? (
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
                wrapperStyle={{
                  paddingTop: "8px",
                  fontSize: "12px",
                  color: "#D1D5DB",
                }}
              />
              {selectedThemes.map((theme, index) => (
                <Line
                  key={theme}
                  type="monotone"
                  dataKey={theme}
                  stroke={LINE_COLORS[index % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
