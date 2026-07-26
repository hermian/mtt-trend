"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { HeatmapCell } from "./_components/HeatmapCell";
import { HeatmapSectionBlock } from "./_components/HeatmapSectionBlock";
import { HeatmapTooltip } from "./_components/HeatmapTooltip";
import { ColorLegend } from "./_components/ColorLegend";
import { PeriodFilter } from "./_components/PeriodFilter";
import { GlobalMapHeatmap } from "./_components/GlobalMapHeatmap";
import { KR_SECTIONS, US_SECTIONS } from "./_lib/sections";
import type { ETFItem, HeatmapData, PeriodKey } from "./_lib/types";

const TABS = [
  { id: "KR" as const, label: "한국 ETF", enabled: true },
  { id: "US" as const, label: "미국 ETF", enabled: true },
  { id: "GLOBAL" as const, label: "세계 ETF", enabled: true },
];

export default function ETFHeatmapPage() {
  const [activeTab, setActiveTab] = useState<"KR" | "US" | "GLOBAL">("KR");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("1D");
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredEtf, setHoveredEtf] = useState<ETFItem | null>(null);

  useEffect(() => {
    if (activeTab !== "KR" && activeTab !== "US" && activeTab !== "GLOBAL") return;
    setLoading(true);
    setData(null); // Clear previous market's data to prevent flashing old layouts
    apiClient
      .get<HeatmapData>(`/api/etf/heatmap?market=${activeTab}`)
      .then((res) => {
        if (
          res.data &&
          Array.isArray(res.data.indexes) &&
          Array.isArray(res.data.groups)
        ) {
          setData(res.data);
          setError(null);
        } else {
          setError("올바르지 않은 데이터 형식입니다.");
        }
      })
      .catch((err) => {
        console.error(err);
        setError("데이터를 불러오는 중 오류가 발생했습니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeTab]);

  const sections = activeTab === "US" ? US_SECTIONS : KR_SECTIONS;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 p-4 text-gray-100 md:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            ETF 히트맵
          </h1>
          <p className="mt-1 text-xs text-gray-400 md:text-sm">
            자산군·섹터별 수익률을 한눈에 비교합니다. (
            {data?.as_of_date || "-"} 기준)
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            참고:{" "}
            <a
              href="https://snowball72.com/etf/heatmap"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-400 underline transition-colors"
            >
              https://snowball72.com/etf/heatmap
            </a>
          </p>
        </div>
        <PeriodFilter value={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      {/* Market Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={!tab.enabled}
            onClick={() => tab.enabled && setActiveTab(tab.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-semibold transition-colors ${
              !tab.enabled
                ? "cursor-not-allowed text-gray-600"
                : activeTab === tab.id
                  ? "border-b-2 border-sky-500 text-sky-400"
                  : "border-b-2 border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
            {!tab.enabled && (
              <span className="ml-1 text-[10px] font-normal">(준비중)</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-center text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          {activeTab === "GLOBAL" ? (
            <GlobalMapHeatmap
              data={data}
              period={selectedPeriod}
              onHover={setHoveredEtf}
            />
          ) : (
            <>
              {/* Indexes */}
              {data.indexes?.length > 0 && (
                <section className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                  <h2 className="mb-2 text-sm font-bold text-gray-100">시장 지수</h2>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                    {data.indexes.map((idx) => (
                      <HeatmapCell
                        key={idx.code}
                        etf={idx}
                        period={selectedPeriod}
                        label={idx.name}
                        onHover={setHoveredEtf}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Section bundles — 좌: 국내/해외/대체, 우: 산업별/테마/그룹주 */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 px-3">
                  {sections.filter((s) => s.column === "left").map((section) => (
                    <HeatmapSectionBlock
                      key={section.id}
                      section={section}
                      groups={data.groups}
                      period={selectedPeriod}
                      onHover={setHoveredEtf}
                    />
                  ))}
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 px-3">
                  {sections.filter((s) => s.column === "right").map((section) => (
                    <HeatmapSectionBlock
                      key={section.id}
                      section={section}
                      groups={data.groups}
                      period={selectedPeriod}
                      onHover={setHoveredEtf}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom Section (e.g. US leverage) */}
              {sections.some((s) => s.column === "bottom") && (
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 px-3">
                  {sections
                    .filter((s) => s.column === "bottom")
                    .map((section) => (
                      <HeatmapSectionBlock
                        key={section.id}
                        section={section}
                        groups={data.groups}
                        period={selectedPeriod}
                        onHover={setHoveredEtf}
                      />
                    ))}
                </div>
              )}
            </>
          )}

          <ColorLegend period={selectedPeriod} />
        </div>
      )}

      {hoveredEtf && <HeatmapTooltip etf={hoveredEtf} />}
    </div>
  );
}
