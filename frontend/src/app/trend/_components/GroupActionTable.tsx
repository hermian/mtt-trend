"use client";

import { useState } from "react";
import { useStocksGroupAction } from "@/hooks/useStocks";
import { GroupActionStock, DataSource } from "@/lib/api";
import clsx from "clsx";
import { Tooltip } from "./Tooltip";

interface GroupActionTableProps {
  date: string;
  source?: DataSource;
  timeWindow?: number; // @MX:NOTE: 시간 윈도우 (1-7일)
  rsThreshold?: number; // @MX:NOTE: RS 임계값 (-10~20)
  statusThreshold?: number; // @MX:NOTE: 상태 분류 임계값 (기본값 5)
}

// @MX:NOTE: SPEC-MTT-006 F-04: 슬라이더 레이블 컴포넌트
// @MX:NOTE: SPEC-MTT-007 F-01, F-02, F-03, F-04: 툴팁 지원 추가
function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  rangeLabel,
  onChange,
  unit = "",
  tooltip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  rangeLabel: string;
  onChange: (value: number) => void;
  unit?: string;
  tooltip?: string;
}) {
  const tooltipId = tooltip ? `${label}-tooltip` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <Tooltip content={tooltip} id={tooltipId}>
        <div className="flex items-center gap-2">
          <label
            htmlFor={`${label}-slider`}
            className="text-sm text-gray-400"
            aria-describedby={tooltipId}
          >
            {label}: {value}{unit}
          </label>
          <span className="text-xs text-gray-500">[{rangeLabel}]</span>
        </div>
      </Tooltip>
      <input
        id={`${label}-slider`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-describedby={tooltipId}
        name={label}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}

function RsChangeBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-gray-400">-</span>;
  }
  const isPositive = value > 0;
  const isNeutral = value === 0;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 font-semibold",
        isNeutral
          ? "text-gray-400"
          : isPositive
            ? "text-green-400"
            : "text-red-400"
      )}
    >
      {!isNeutral && (
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
            d={isPositive ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
          />
        </svg>
      )}
      {isPositive ? "+" : ""}
      {value.toFixed(2)}
    </span>
  );
}

function ChangePctCell({ value }: { value: number }) {
  const isPositive = value > 0;
  return (
    <span
      className={clsx(
        "font-medium",
        value > 0
          ? "text-green-400"
          : value < 0
            ? "text-red-400"
            : "text-gray-400"
      )}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

// @MX:ANCHOR: 주식 상태 뱃지 렌더링 (fan_in: GroupActionTable)
// @MX:REASON: 주식 상태에 따른 뱃지 스타일을 일관되게 적용하는 UI 컴포넌트입니다.
function StockStatusBadge({ status }: { status: "new" | "returning" | "neutral" | "new_theme" }) {
  const statusConfig = {
    new_theme: {
      text: "신규 테마",
      className: "bg-purple-500/20 text-purple-300 border-purple-500/30"
    },
    new: {
      text: "신규",
      className: "bg-green-500/20 text-green-300 border-green-500/30"
    },
    returning: {
      text: "재등장",
      className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
    },
    neutral: {
      text: "유지",
      className: "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
  };

  const { text, className } = statusConfig[status];

  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", className)}>
      {text}
    </span>
  );
}

export function GroupActionTable({
  date,
  source = "52w_high",
  timeWindow: initialTimeWindow = 3,
  rsThreshold: initialRsThreshold = 0,
  statusThreshold: initialStatusThreshold = 5
}: GroupActionTableProps) {
  // @MX:NOTE: SPEC-MTT-006 F-04: 슬라이더 상태 관리
  const [timeWindow, setTimeWindow] = useState(initialTimeWindow);
  const [rsThreshold, setRsThreshold] = useState(initialRsThreshold);
  const [statusThreshold, setStatusThreshold] = useState(initialStatusThreshold);

  // @MX:NOTE: SPEC-MTT-006 F-04: 시간 윈도우/RS 임계값 변경 시 API 재호출
  const { data: stocks, isLoading, error } = useStocksGroupAction(date, source, timeWindow, rsThreshold);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-red-400">
        <p>데이터를 불러오는데 실패했습니다</p>
      </div>
    );
  }

  if (!stocks || stocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <p>그룹 액션 탐지 데이터가 없습니다</p>
      </div>
    );
  }

  // Sort by rs_score desc (null values treated as 0)
  const sorted = [...stocks].sort((a, b) => (b.rs_score ?? 0) - (a.rs_score ?? 0));

  // Separate new vs returning stocks based on theme_rs_change
  // Positive = gaining momentum (new), negative = losing (returning to baseline)
  // @MX:ANCHOR: 주식 상태 분류 로직 (fan_in: 렌더링 로직)
  // @MX:REASON: 이 함수는 주식의 테마 RS 변화량에 따라 상태를 분류하는 핵심 비즈니스 로직입니다.
  // @MX:NOTE: SPEC-MTT-006 파라미터화: statusThreshold로 분류 기준 조정
  const getStockStatus = (
    stock: GroupActionStock,
    threshold: number
  ): "new" | "returning" | "neutral" | "new_theme" => {
    // 신규 등장 테마 (어제 데이터 없음)
    if (stock.theme_rs_change === null) {
      return "new_theme";
    }
    if (stock.theme_rs_change > threshold) return "new";
    if (stock.theme_rs_change < -threshold) return "returning";
    return "neutral";
  };

  return (
    <div>
      {/* @MX:NOTE: SPEC-MTT-006 F-04: UI 파라미터 컨트롤 슬라이더 */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-3">그룹 액션 탐지 파라미터</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SliderControl
            label="시간 윈도우"
            value={timeWindow}
            min={1}
            max={7}
            step={1}
            rangeLabel="1-7"
            onChange={setTimeWindow}
            unit="일"
            tooltip="신규 등장 종목 판정 기간 (일)"
          />
          <SliderControl
            label="RS 임계값"
            value={rsThreshold}
            min={-10}
            max={20}
            step={1}
            rangeLabel="-10~+20"
            onChange={setRsThreshold}
            tooltip="테마 RS 상승 판정 기준 (-10~+20)"
          />
          <SliderControl
            label="상태 임계값"
            value={statusThreshold}
            min={1}
            max={20}
            step={1}
            rangeLabel="1-20"
            onChange={setStatusThreshold}
            tooltip="주식 상태 분류 기준 (1~20). 테마 RS 변화량이 임계값을 초과하면 '신규', -임계값 미만이면 '재등장', 그 외는 '유지'로 분류"
          />
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-3">
        {date} 기준 그룹 액션 탐지 ({stocks.length}개 종목)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                종목명
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                RS점수
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                등락률
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                소속 테마
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                테마RS변화
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((stock, index) => {
              const status = getStockStatus(stock, statusThreshold);
              return (
                <tr
                  key={`${stock.stock_name}-${index}`}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium">
                    {stock.stock_name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "font-semibold",
                        stock.rs_score >= 70
                          ? "text-red-400"
                          : stock.rs_score >= 50
                            ? "text-yellow-400"
                            : "text-blue-400"
                      )}
                    >
                      {stock.rs_score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ChangePctCell value={stock.change_pct} />
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {stock.theme_name}
                  </td>
                  <td className="px-4 py-3">
                    <RsChangeBadge value={stock.theme_rs_change} />
                  </td>
                  <td className="px-4 py-3">
                    <StockStatusBadge status={status} />
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
