"use client";

import { useMemo, useState } from "react";
import { useStockHeatmap } from "@/hooks/useStockHeatmap";
import { ControlBar, type HeatmapControls } from "./_components/ControlBar";
import { Legend } from "./_components/Legend";
import { GroupTreemap, StockTreemap } from "./_components/TreemapChart";
import { buildColorScale } from "./_lib/colors";

const GROUPING_TITLES: Record<HeatmapControls["grouping"], string> = {
  sector: "섹터",
  industry: "업종",
  theme: "테마",
  kospi: "KOSPI",
  kosdaq: "KOSDAQ",
};

/** 시장 단일 그룹은 개요 드릴다운 없이 종목 트리맵을 바로 표시 */
const MARKET_GROUPINGS = new Set<HeatmapControls["grouping"]>(["kospi", "kosdaq"]);

export default function StockHeatmapPage() {
  const [controls, setControls] = useState<HeatmapControls>({
    grouping: "sector",
    period: "1D",
    startDate: null,
    endDate: null,
    marcapMin: null,
    marcapMax: null,
    minRet: null,
    limit: 0,
  });

  const [drilledGroup, setDrilledGroup] = useState<string | null>(null);
  const isMarketGrouping = MARKET_GROUPINGS.has(controls.grouping);

  const { data, isFetching, isError, error } = useStockHeatmap({
    grouping: controls.grouping,
    period: controls.period,
    startDate: controls.startDate,
    endDate: controls.endDate,
    marcapMin: controls.marcapMin,
    marcapMax: controls.marcapMax,
    minRet: controls.minRet,
    limit: controls.limit,
  });

  const errorMessage = (() => {
    if (!isError || !error) return null;
    const ax = error as { response?: { data?: { detail?: string } }; message?: string };
    return ax.response?.data?.detail ?? "데이터를 불러오는 중 오류가 발생했습니다.";
  })();

  // Reset drill-down when controls change
  const handleControlChange = (patch: Partial<HeatmapControls>) => {
    setDrilledGroup(null);
    setControls((prev) => ({ ...prev, ...patch }));
  };

  const scale = useMemo(() => {
    const rets = (data?.groups ?? []).flatMap((g) =>
      g.stocks.map((s) => s.ret)
    );
    return buildColorScale(rets, controls.period);
  }, [data, controls.period]);

  const drilledGroupData = useMemo(() => {
    if (!drilledGroup || !data) return null;
    return data.groups.find((g) => g.name === drilledGroup) ?? null;
  }, [drilledGroup, data]);

  // kospi/kosdaq: 단일 그룹 → 종목 트리맵 직행
  const marketGroupData = useMemo(() => {
    if (!isMarketGrouping || !data || data.groups.length === 0) return null;
    return data.groups[0] ?? null;
  }, [isMarketGrouping, data]);

  const showGroupOverview =
    !isError && data && data.groups.length > 0 && !drilledGroup && !isMarketGrouping;
  const showStockTreemap =
    !isError && (drilledGroupData != null || marketGroupData != null);
  const stockTreemapGroup = drilledGroupData ?? marketGroupData;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 p-4 text-gray-100 md:p-6">
      <div className="mb-4 flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          주식 히트맵
        </h1>
        <p className="text-xs text-gray-400 md:text-sm">
          {GROUPING_TITLES[controls.grouping]}별 한국 주식 수익률 ·{" "}
          {data?.period === "CUSTOM" && data?.effective_start_date && data?.effective_end_date ? (
            <span className="font-medium text-sky-400">
              지정 기간 ({data.effective_start_date} ~ {data.effective_end_date})
            </span>
          ) : (
            <>
              {data?.as_of_date ?? "-"}
              {data?.as_of_time ? ` ${data.as_of_time}` : ""} 기준
            </>
          )}{" "}
          · {data?.stock_count ?? 0}종목
          {isFetching && <span className="ml-2 text-gray-500">갱신 중…</span>}
        </p>
        <p className="text-[11px] text-gray-500">
          참고:{" "}
          <a
            href="https://easyinvesting.app/#/heatmap"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-sky-400"
          >
            easyinvesting.app/#/heatmap
          </a>{" "}
          · 박스 클릭 시 네이버 금융으로 이동
        </p>
      </div>

      <div className="space-y-3">
        <ControlBar value={controls} onChange={handleControlChange} />
        <Legend scale={scale} />

        {/* Breadcrumb for drill-down (섹터/업종/테마만) */}
        {drilledGroup && !isMarketGrouping && (
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setDrilledGroup(null)}
              className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
            >
              ← 전체 {GROUPING_TITLES[controls.grouping]}
            </button>
            <span className="text-gray-500">/</span>
            <span className="text-sm font-semibold text-gray-200">
              {drilledGroup}
            </span>
            {drilledGroupData && (
              <span className="text-xs text-gray-500">
                ({drilledGroupData.stock_count}종목)
              </span>
            )}
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-center text-amber-100">
            {errorMessage}
          </div>
        )}

        {showGroupOverview && (
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-2">
            <GroupTreemap
              groups={data.groups}
              scale={scale}
              onDrill={(name) => setDrilledGroup(name)}
            />
          </div>
        )}

        {showStockTreemap && stockTreemapGroup && (
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-2">
            <StockTreemap group={stockTreemapGroup} scale={scale} />
          </div>
        )}

        {!isError && data && data.groups.length === 0 && (
          <div className="flex h-64 items-center justify-center rounded-lg border border-gray-800 text-gray-500">
            조건에 맞는 종목이 없습니다.
          </div>
        )}

        {!data && !isError && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
