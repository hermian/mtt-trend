"use client";

import { useThemeStocks } from "@/hooks/useThemes";
import { DataSource } from "@/lib/api";
import { useEffect, useRef, useState } from "react";

// @MX:ANCHOR: 테마 종목 패널 컴포넌트 (fan_in: trend/page.tsx)
// @MX:REASON: 이 컴포넌트는 테마별 종목 목록을 표시하는 주요 UI입니다.

// @MX:NOTE: SPEC-MTT-013 RS 점수 색상 코딩
function getRsScoreColor(rsScore: number | null): string {
  if (rsScore === null) return "text-gray-400";
  if (rsScore >= 75) return "text-red-500";
  if (rsScore >= 60) return "text-orange-500";
  if (rsScore >= 45) return "text-yellow-500";
  if (rsScore >= 30) return "text-purple-500";
  return "text-blue-500";
}

// @MX:NOTE: SPEC-MTT-013 등락률 색상
function getChangePctColor(changePct: number | null): string {
  if (changePct === null) return "text-gray-400";
  if (changePct > 0) return "text-green-400";
  if (changePct < 0) return "text-red-400";
  return "text-gray-400";
}

// @MX:NOTE: SPEC-MTT-013 등락률 포맷
function formatChangePct(changePct: number | null): string {
  if (changePct === null) return "-";
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(2)}%`;
}

interface ThemeStocksPanelProps {
  themeName: string;
  date: string;
  source: DataSource;
  onClose: () => void;
}

export function ThemeStocksPanel({ themeName, date, source, onClose }: ThemeStocksPanelProps) {
  const { data: stocks, isLoading, error } = useThemeStocks(themeName, date, source);
  // @MX:NOTE: 컴포넌트 마운트 시 즉시 패널 열기 (즉시 열기 UX)
  const [isVisible, setIsVisible] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // @MX:NOTE: SPEC-MTT-013 슬라이드 다운 애니메이션 및 높이 계산
  useEffect(() => {
    // 컴포넌트가 열려있으면 항상 높이 계산
    if (isVisible && contentRef.current) {
      const targetHeight = contentRef.current.offsetHeight;
      setHeight(targetHeight);
    }
  }, [isVisible, stocks, isLoading]); // stocks, isLoading 변경 시 높이 재계산

  // 패널이 닫혀 있으면 렌더링하지 않음
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out bg-gray-800 rounded-xl"
      style={{
        maxHeight: `${height}px`,
        opacity: isVisible ? 1 : 0,
      }}
    >
      <div ref={contentRef} className="p-6">
        {/* @MX:NOTE: SPEC-MTT-013 패널 헤더: 테마명 + 종목 수 + 닫기 버튼 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{themeName}</h3>
            {stocks && (
              <span className="text-sm text-gray-400">
                {stocks.length}개 종목
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="종목 패널 닫기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
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
          </button>
        </div>

        {/* @MX:NOTE: SPEC-MTT-013 로딩 상태 */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* @MX:NOTE: SPEC-MTT-013 에러 상태 */}
        {error && (
          <div className="text-center py-8">
            <p className="text-red-400">종목 데이터를 불러오는데 실패했습니다</p>
          </div>
        )}

        {/* @MX:NOTE: SPEC-MTT-013 종목 테이블 */}
        {stocks && stocks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">종목명</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">RS 점수</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">등락률</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock) => (
                  <tr
                    key={stock.stock_name}
                    className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
                  >
                    <td className="py-3 px-4 text-white">{stock.stock_name}</td>
                    <td className={`py-3 px-4 text-right font-medium ${getRsScoreColor(stock.rs_score)}`}>
                      {stock.rs_score !== null ? stock.rs_score.toFixed(1) : "-"}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${getChangePctColor(stock.change_pct)}`}>
                      {formatChangePct(stock.change_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {stocks && stocks.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">해당 테마의 종목 데이터가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
