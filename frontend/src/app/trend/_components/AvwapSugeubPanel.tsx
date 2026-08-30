"use client";

import React, { useMemo, useState } from "react";
import type { PeriodSumItem, SupplyDemandResponse, SupplyDemandSumPeriod } from "@/lib/api";
import type { SupplySumPreset } from "@/hooks/useSupplyDemand";
import { SugeubTables } from "./sugeub/SugeubTables";
import { SugeubMaChart } from "./sugeub/SugeubMaChart";
import { SugeubDispersionChart } from "./sugeub/SugeubDispersionChart";
import { SugeubPeriodSumBar } from "./sugeub/SugeubPeriodSumBar";
import { SugeubPriceProfileChart } from "./sugeub/SugeubPriceProfileChart";
import { SugeubRangeControls } from "./sugeub/SugeubRangeControls";
import { DEFAULT_SUGEB_RANGE, type SugeubRangePreset } from "./sugeub/sugeubChartHelpers";
import { DISPERSION_DEFAULT_VISIBLE, DISPLAY_COLS } from "./sugeub/constants";

export interface AvwapSugeubPanelProps {
  symbol?: string | null;
  data: SupplyDemandResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  periodSums?: PeriodSumItem[];
  sumPeriod?: SupplyDemandSumPeriod;
  isPeriodSumsLoading?: boolean;
  sumPreset: SupplySumPreset;
  customSumApplied?: boolean;
  onSumPresetChange: (preset: SupplySumPreset) => void;
  customSumStart: string;
  customSumEnd: string;
  onCustomSumStartChange: (v: string) => void;
  onCustomSumEndChange: (v: string) => void;
  onApplyCustomSum: () => void;
}

export function AvwapSugeubPanel({
  symbol,
  data,
  isLoading,
  error,
  periodSums,
  sumPeriod,
  isPeriodSumsLoading,
  sumPreset,
  customSumApplied = false,
  onSumPresetChange,
  customSumStart,
  customSumEnd,
  onCustomSumStartChange,
  onCustomSumEndChange,
  onApplyCustomSum,
}: AvwapSugeubPanelProps) {
  const series = useMemo(() => data?.series ?? [], [data?.series]);
  const [chartRange, setChartRange] = useState<SugeubRangePreset>(DEFAULT_SUGEB_RANGE);
  const [dispersionVisible, setDispersionVisible] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    DISPLAY_COLS.forEach((c) => {
      init[c] = DISPERSION_DEFAULT_VISIBLE.has(c);
    });
    return init;
  });

  if (!symbol) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[320px] text-gray-500 text-sm px-6 text-center">
        <p className="text-base font-medium text-gray-700">종목코드(예: 005930)나 종목명(예: 삼성전자)을 입력하세요.</p>
        <p className="text-xs text-gray-400 mt-2">AVWAP 차트에서 선택한 KR 종목과 자동 연동됩니다.</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[320px] text-blue-600 font-mono text-sm gap-2">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span>수급 분석 데이터를 로드하는 중...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[320px] text-red-600 text-sm px-4 text-center">
        <span>수급 데이터를 불러오는 데 실패했습니다.</span>
        <span className="text-gray-500 text-xs mt-2">sugeub DB 및 marcap 시세 DB를 확인하세요.</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const activePeriodSums = periodSums ?? data.period_sums;
  const activeSumPeriod = sumPeriod ?? data.sum_period;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-[1300px] mx-auto px-2 sm:px-4 py-3 sm:py-6">
        <div className="bg-white rounded-lg shadow-md px-3 sm:px-6 py-5 sm:py-8 space-y-8 sm:space-y-12">
          <header className="text-center space-y-2">
            <h2 className="text-xl font-bold text-gray-800">종목 분석기</h2>
            <p className="text-sm text-gray-600">
              {data.name}({data.code})
            </p>
            <p className="text-xs text-gray-400">
              데이터: {data.data_first} ~ {data.data_last}
            </p>
          </header>

          <SugeubTables
            tableSupply={data.table_supply}
            tableLds={data.table_lds}
            tableDispersionRecent={data.table_dispersion_recent}
            tableDispersionPeak={data.table_dispersion_peak}
          />

          <section className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 text-center border-b-2 border-gray-200 pb-2">
              차트 분석
              <span className="block text-xs font-normal text-gray-500 mt-1">
                (범례 클릭 = 토글 · 상단 기간 버튼 = 뷰 전환)
              </span>
            </h3>
            <SugeubRangeControls value={chartRange} onChange={setChartRange} />
            <div className="space-y-6">
              <SugeubMaChart series={series} name={data.name} rangePreset={chartRange} />
              <SugeubDispersionChart
                series={series}
                name={data.name}
                rangePreset={chartRange}
                visible={dispersionVisible}
                onToggleVisible={(key) =>
                  setDispersionVisible((v) => ({ ...v, [key]: !v[key] }))
                }
              />
            </div>
          </section>

          <section>
            <SugeubPeriodSumBar
              periodSums={activePeriodSums}
              sumPeriod={activeSumPeriod}
              activePreset={sumPreset}
              customSumApplied={customSumApplied}
              isLoading={isPeriodSumsLoading}
              onPresetChange={onSumPresetChange}
              customStart={customSumStart}
              customEnd={customSumEnd}
              onCustomStartChange={onCustomSumStartChange}
              onCustomEndChange={onCustomSumEndChange}
              onApplyCustom={onApplyCustomSum}
            />
          </section>

          <section>
            <SugeubPriceProfileChart
              code={data.code}
              name={data.name}
              defaultFirstDate={data.data_first}
              defaultLastDate={data.data_last}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
