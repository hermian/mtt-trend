"use client";

import { useMemo, useState } from "react";
import { useStockHeatmap } from "@/hooks/useStockHeatmap";
import { ControlBar, type HeatmapControls } from "./_components/ControlBar";
import { Legend } from "./_components/Legend";
import { TreemapChart } from "./_components/TreemapChart";
import { buildColorScale } from "./_lib/colors";

const GROUPING_TITLES: Record<HeatmapControls["grouping"], string> = {
  sector: "섹터",
  industry: "업종",
  theme: "테마",
};

export default function StockHeatmapPage() {
  const [controls, setControls] = useState<HeatmapControls>({
    grouping: "sector",
    period: "1M",
    marcapMin: null,
    marcapMax: null,
    limit: 0,
  });

  const { data, isFetching, isError } = useStockHeatmap({
    grouping: controls.grouping,
    period: controls.period,
    marcapMin: controls.marcapMin,
    marcapMax: controls.marcapMax,
    limit: controls.limit,
  });

  const scale = useMemo(() => {
    const rets = (data?.groups ?? []).flatMap((g) =>
      g.stocks.map((s) => s.ret)
    );
    return buildColorScale(rets, controls.period);
  }, [data, controls.period]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 p-4 text-gray-100 md:p-6">
      <div className="mb-4 flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          주식 히트맵
        </h1>
        <p className="text-xs text-gray-400 md:text-sm">
          {GROUPING_TITLES[controls.grouping]}별 한국 주식 수익률 ·{" "}
          {data?.as_of_date ?? "-"} 기준 · {data?.stock_count ?? 0}종목
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
        <ControlBar
          value={controls}
          onChange={(patch) => setControls((prev) => ({ ...prev, ...patch }))}
        />
        <Legend scale={scale} />

        {isError && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-center text-red-200">
            데이터를 불러오는 중 오류가 발생했습니다.
          </div>
        )}

        {!isError && data && data.groups.length > 0 && (
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-2">
            <TreemapChart groups={data.groups} scale={scale} />
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
