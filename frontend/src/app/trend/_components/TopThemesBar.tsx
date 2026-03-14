"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { useThemesDaily } from "@/hooks/useThemes";
import { ThemeDaily, DataSource } from "@/lib/api";

// @MX:ANCHOR: 테마별 RS 점수 시각화 컴포넌트 (fan_in: trend/page.tsx)
// @MX:REASON: 이 컴포넌트는 상위 테마 데이터를 시각화하는 주요 UI 진입점입니다.

// SPEC-MTT-004 F-01: 테마 개수 설정 상수
const MIN_THEME_COUNT = 5;
const MAX_THEME_COUNT = 30;
const DEFAULT_THEME_COUNT = 10;

interface TopThemesBarProps {
  date: string;
  source?: DataSource;
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

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ThemeDaily }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl">
        <p className="text-white font-semibold mb-1">{data.theme_name}</p>
        <p className="text-blue-400 text-sm">
          RS 점수: <span className="text-white">{data.avg_rs.toFixed(1)}</span>
        </p>
        <p className="text-gray-400 text-sm">
          종목 수: <span className="text-white">{data.stock_count}개</span>
        </p>
        {data.change_sum !== undefined && (
          <p className="text-gray-400 text-sm">
            등락합:{" "}
            <span
              className={
                data.change_sum >= 0 ? "text-green-400" : "text-red-400"
              }
            >
              {data.change_sum >= 0 ? "+" : ""}
              {data.change_sum.toFixed(2)}%
            </span>
          </p>
        )}
      </div>
    );
  }
  return null;
}

export function TopThemesBar({ date, source = "52w_high" }: TopThemesBarProps) {
  const { data: themes, isLoading, error } = useThemesDaily(date, source);

  // SPEC-MTT-004 F-01: 상위 테마 표시 개수 동적 설정
  // 범위: 5-30, 기본값: 10
  const [themeCount, setThemeCount] = useState(DEFAULT_THEME_COUNT);

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
  const topThemes = [...themes]
    .sort((a, b) => b.avg_rs - a.avg_rs)
    .slice(0, themeCount)
    .reverse(); // Reverse so highest is at top of horizontal bar chart

  const chartHeight = Math.max(topThemes.length * 40, 300);

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

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={topThemes}
          layout="vertical"
          margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#374151"
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: "#9CA3AF", fontSize: 12 }}
            axisLine={{ stroke: "#4B5563" }}
            tickLine={{ stroke: "#4B5563" }}
            label={{
              value: "RS 점수",
              position: "insideBottom",
              fill: "#9CA3AF",
              fontSize: 12,
              offset: -5,
            }}
          />
          <YAxis
            type="category"
            dataKey="theme_name"
            width={110}
            tick={{ fill: "#D1D5DB", fontSize: 11 }}
            axisLine={{ stroke: "#4B5563" }}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
          />
          <Bar dataKey="avg_rs" radius={[0, 4, 4, 0]}>
            {topThemes.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBarColor(entry.avg_rs)}
              />
            ))}
            <LabelList
              dataKey="stock_count"
              position="right"
              formatter={(value: number) => `${value}종`}
              style={{ fill: "#9CA3AF", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
