"use client";

import { useState } from "react";
import { useThemesSurging } from "@/hooks/useThemes";
import { SurgingTheme, DataSource } from "@/lib/api";

// @MX:ANCHOR: 급등 테마 탐지 카드 컴포넌트 (fan_in: trend/page.tsx)
// @MX:REASON: 이 컴포넌트는 급등 테마 데이터를 시각화하는 주요 UI 진입점입니다.

interface SurgingThemesCardProps {
  date: string;
  source?: DataSource;
  onThemeClick?: (themeName: string) => void;
  selectedTheme?: string | null;
}

export function SurgingThemesCard({ date, source = "52w_high", onThemeClick, selectedTheme }: SurgingThemesCardProps) {
  const [threshold, setThreshold] = useState(10);
  const { data: themesData, isLoading, error } = useThemesSurging(date, threshold, source);
  
  // 'kodex_leverage', 'kosdaq_leverage' 테마 제외 필터링 추가
  const themes = themesData ? themesData.filter(t => t.theme_name !== "kodex_leverage" && t.theme_name !== "kosdaq_leverage") : [];

  // 로딩 상태 (R-03-1)
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-700 rounded animate-pulse h-16" />
          ))}
        </div>
      </div>
    );
  }

  // 에러 상태 (R-03-3)
  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 flex items-center justify-center h-48">
        <p className="text-red-400">데이터를 불러오는데 실패했습니다</p>
      </div>
    );
  }

  // 빈 상태 (R-03-2)
  if (!themes || themes.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 flex flex-col items-center justify-center h-48">
        <p className="text-gray-400 mb-2">
          현재 기준(+{threshold}) 이상 급등한 테마가 없습니다
        </p>
        <p className="text-gray-500 text-sm">기준값을 낮추면 더 많은 테마를 확인할 수 있습니다</p>
      </div>
    );
  }

  // 데이터 렌더링 (R-01-1, R-01-2, R-01-3)
  return (
    <div className="bg-gray-800 rounded-xl p-6">
      {/* Threshold 슬라이더 (R-01-3) */}
      <div className="mb-6 flex items-center gap-4">
        <label htmlFor="threshold-slider" className="text-sm text-gray-400 whitespace-nowrap">
          기준: +{threshold}
        </label>
        <input
          id="threshold-slider"
          type="range"
          min="5"
          max="50"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* 급등 테마 테이블 (R-01-1) */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">테마명</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">RS 변화량</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">현재 평균 RS</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">5일 평균 RS</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">종목 수</th>
            </tr>
          </thead>
          <tbody>
            {themes.map((theme) => {
              const isSelected = selectedTheme === theme.theme_name;
              return (
                <tr 
                  key={theme.theme_name} 
                  className={`border-b border-gray-700 last:border-b-0 hover:bg-gray-700 transition-colors cursor-pointer ${isSelected ? "bg-blue-900/20" : ""}`}
                  onClick={() => onThemeClick?.(theme.theme_name)}
                >
                  <td className={`py-3 px-4 font-medium ${isSelected ? "text-blue-400" : "text-white"}`}>
                    {theme.theme_name}
                  </td>
                  <td className="py-3 px-4 text-right text-green-400 font-medium">
                  +{theme.rs_change?.toFixed(1) || "0.0"}
                </td>
                <td className="py-3 px-4 text-right text-gray-300">
                  {theme.avg_rs?.toFixed(1) || "0.0"}
                </td>
                <td className="py-3 px-4 text-right text-gray-400">
                  {theme.avg_rs_5d?.toFixed(1) || "0.0"}
                </td>
                <td className="py-3 px-4 text-right text-gray-300">
                  {theme.stock_count ?? 0}개
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
