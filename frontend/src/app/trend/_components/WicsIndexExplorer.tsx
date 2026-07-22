"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWicsIndexAll, useWicsIndexMeta } from "@/hooks/useWicsData";
import {
  LeaderboardPanel,
  LeaderboardRow,
  WicsIndexOverlayChart,
  WicsIndexOverlayChartHandle,
  YFitMode,
} from "./WicsIndexOverlayChart";
import clsx from "clsx";

type Tf = "D" | "W" | "M";
type Weight = "MC" | "EW";
type ChartType = "line" | "candle";

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center bg-black/30 p-1 rounded-lg border border-gray-800">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.title}
          onClick={() => onChange(o.id)}
          className={clsx(
            "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
            value === o.id ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const WicsIndexExplorer: React.FC = () => {
  const chartRef = useRef<WicsIndexOverlayChartHandle>(null);
  const [tf, setTf] = useState<Tf>("D");
  const [weight, setWeight] = useState<Weight>("MC");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [topN, setTopN] = useState<number>(5);
  const [showLegend, setShowLegend] = useState(true);
  const [loadAll, setLoadAll] = useState(false);
  const [logY, setLogY] = useState(false);
  const [yFitMode, setYFitMode] = useState<YFitMode>("focus");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [chartHeight, setChartHeight] = useState(520);

  useEffect(() => {
    const update = () => setChartHeight(Math.max(420, window.innerHeight - 240));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { data: meta } = useWicsIndexMeta();

  const queryRange = useMemo(() => {
    if (!loadAll) {
      return { startDate: undefined as string | undefined, endDate: undefined as string | undefined };
    }
    return { startDate: meta?.min_date, endDate: meta?.max_date };
  }, [loadAll, meta?.min_date, meta?.max_date]);

  const { data, isLoading, error, isFetching } = useWicsIndexAll({
    tf,
    weight,
    startDate: queryRange.startDate,
    endDate: queryRange.endDate,
  });

  const onToggleSelect = useCallback((wics: string, multi: boolean) => {
    setSelected((prev) => {
      if (!multi) {
        if (prev.size === 1 && prev.has(wics)) return new Set();
        return new Set([wics]);
      }
      const next = new Set(prev);
      if (next.has(wics)) next.delete(wics);
      else next.add(wics);
      return next;
    });
  }, []);

  const clearSelection = () => setSelected(new Set());

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 p-3 md:p-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 bg-gray-900/60 border border-gray-800 rounded-xl p-3">
        <ToggleGroup
          value={tf}
          onChange={setTf}
          options={[
            { id: "D", label: "일" },
            { id: "W", label: "주" },
            { id: "M", label: "월" },
          ]}
        />
        <ToggleGroup
          value={chartType}
          onChange={setChartType}
          options={[
            { id: "line", label: "라인" },
            { id: "candle", label: "강조" },
          ]}
        />
        <ToggleGroup
          value={weight}
          onChange={setWeight}
          options={[
            { id: "MC", label: "시총" },
            { id: "EW", label: "동일" },
          ]}
        />
        <div className="flex items-center bg-black/30 p-1 rounded-lg border border-gray-800">
          {([5, 10, 0] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTopN(n)}
              className={clsx(
                "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                topN === n ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
              )}
            >
              {n === 0 ? "전체" : `Top${n}`}
            </button>
          ))}
        </div>

        <ToggleGroup
          value={yFitMode}
          onChange={setYFitMode}
          options={[
            { id: "focus", label: "강조맞춤", title: "TopN ∪ 선택만 Y 맞춤" },
            { id: "selected", label: "선택맞춤", title: "선택한 섹터만 Y 맞춤" },
            { id: "mid", label: "중위권", title: "상위 제외 후 Y 맞춤 (아래에서 올라오는 후보)" },
            { id: "all", label: "전체맞춤", title: "전 섹터 Y 맞춤" },
          ]}
        />

        <div className="flex items-center bg-black/30 p-1 rounded-lg border border-gray-800">
          <button
            type="button"
            title="Y 확대"
            onClick={() => chartRef.current?.zoomY(0.8)}
            className="px-2 py-1 text-xs font-bold rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
          >
            Y+
          </button>
          <button
            type="button"
            title="Y 축소"
            onClick={() => chartRef.current?.zoomY(1.25)}
            className="px-2 py-1 text-xs font-bold rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
          >
            Y−
          </button>
          <button
            type="button"
            title="현재 모드로 Y 재맞춤"
            onClick={() => chartRef.current?.fitY()}
            className="px-2 py-1 text-xs font-bold rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
          >
            맞춤
          </button>
        </div>

        <button
          type="button"
          onClick={() => setLogY((v) => !v)}
          className={clsx(
            "px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all",
            logY
              ? "bg-violet-700/80 text-white border-violet-500"
              : "bg-black/30 text-gray-500 border-gray-800 hover:text-gray-300"
          )}
          title="로그 Y축 토글"
        >
          로그Y
        </button>

        <button
          type="button"
          onClick={() => setShowLegend((v) => !v)}
          className={clsx(
            "px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all",
            showLegend
              ? "bg-gray-700 text-white border-gray-600"
              : "bg-black/30 text-gray-500 border-gray-800 hover:text-gray-300"
          )}
        >
          범례
        </button>
        <button
          type="button"
          onClick={() => setLoadAll((v) => !v)}
          className={clsx(
            "px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all",
            loadAll
              ? "bg-blue-700/80 text-white border-blue-600"
              : "bg-black/30 text-gray-500 border-gray-800 hover:text-gray-300"
          )}
          title="기본은 최근 구간, 켜면 DB 전체 기간"
        >
          {loadAll ? "전체기간" : "최근구간"}
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/30"
          >
            선택 해제 ({selected.size})
          </button>
        )}
        <div className="ml-auto text-[10px] text-gray-500 font-mono max-w-[280px] text-right leading-snug">
          PC: 우측 가격축 휠=Y줌 · 축 드래그
          <br />
          모바일: Y+/Y−/맞춤
          {isFetching && !isLoading ? " · updating…" : ""}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl p-4">
          지수 로드 실패: {String(error)}
        </div>
      )}

      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm animate-pulse">
          WICS 지수 로딩 중…
        </div>
      )}

      {!isLoading && data && data.sectors.length > 0 && (
        <div className="flex-1 min-h-0 flex gap-3 items-start overflow-hidden">
          <div className="flex-1 min-w-0 bg-gray-900/40 border border-gray-800 rounded-xl p-2 flex flex-col overflow-hidden">
            <WicsIndexOverlayChart
              ref={chartRef}
              sectors={data.sectors}
              chartType={chartType}
              topN={topN}
              selected={selected}
              onToggleSelect={onToggleSelect}
              showLegend={showLegend}
              onLeaderboardChange={setBoard}
              height={chartHeight}
              logY={logY}
              yFitMode={yFitMode}
            />
            <p className="text-[10px] text-gray-600 px-2 pt-1 shrink-0">
              Source: stock_master.db / wics_daily_index · tf={data.tf} · weight={data.weight} ·{" "}
              {data.sectors.length} sectors
              {meta?.min_date ? ` · ${meta.min_date} ~ ${meta.max_date}` : ""}
              {logY ? " · logY" : ""}
            </p>
          </div>
          <LeaderboardPanel
            rows={board}
            selected={selected}
            onToggle={onToggleSelect}
            height={chartHeight}
          />
        </div>
      )}

      {!isLoading && data && data.sectors.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm px-6 text-center">
          wics_daily_index 비어 있음. screener에서{" "}
          <code className="mx-1 text-gray-400">python -m script.wics_daily_index</code> 실행 후
          다시 시도하세요.
        </div>
      )}
    </div>
  );
};
