"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HeatmapData, ETFItem, PeriodKey } from "../_lib/types";
import { squarify } from "@/app/heatmap/_lib/treemap";
import { buildColorScale, heatColor, type ColorScale } from "@/app/heatmap/_lib/colors";
import { formatReturn, truncate } from "@/app/heatmap/_lib/format";

interface ETFTreemapViewProps {
  data: HeatmapData;
  period: PeriodKey;
  market: "KR" | "US";
  onHover: (etf: ETFItem | null) => void;
}

export interface TransformedETFGroup {
  name: string;
  weight: number;
  avg_return: number | null;
  etf_count: number;
  etfs: Array<{
    code: string;
    name: string;
    sector?: string;
    marcap?: number;
    ret: number | null;
    weight: number;
    url?: string;
    raw: ETFItem;
  }>;
}

export function ETFTreemapView({
  data,
  period,
  market,
  onHover,
}: ETFTreemapViewProps) {
  const [drilledGroup, setDrilledGroup] = useState<string | null>(null);
  const [krViewMode, setKrViewMode] = useState<"representatives" | "categories">("representatives");

  // Period map for ColorScale
  const heatmapPeriod = period === "1D" ? "1D" : period === "1W" ? "5D" : "1M";

  // Transform HeatmapData into Treemap structure based on selected period
  const transformedGroups = useMemo<TransformedETFGroup[]>(() => {
    if (!data || !data.groups) return [];

    return data.groups.map((group) => {
      const validEtfs = group.etfs.map((etf) => {
        const ret = etf.returns[period] ?? null;
        return {
          code: etf.code,
          name: etf.name,
          sector: etf.sector,
          marcap: etf.marcap,
          ret,
          weight: etf.marcap && etf.marcap > 0 ? etf.marcap : 1,
          url: etf.url,
          raw: etf,
        };
      });

      const retNums = validEtfs
        .map((e) => e.ret)
        .filter((r): r is number => r !== null);

      const avg_return =
        retNums.length > 0
          ? roundVal(retNums.reduce((a, b) => a + b, 0) / retNums.length)
          : null;

      const groupWeight = validEtfs.reduce((acc, curr) => acc + curr.weight, 0);

      return {
        name: group.category,
        weight: groupWeight,
        avg_return,
        etf_count: validEtfs.length,
        etfs: validEtfs,
      };
    });
  }, [data, period]);

  // Special Representative 23 Sector Group for KR
  const repGroup = useMemo(() => {
    if (market !== "KR" || !transformedGroups.length) return null;
    const repData = transformedGroups.find((g) => g.name === "대표 섹터(23종)");
    if (!repData) return null;
    return repData;
  }, [market, transformedGroups]);

  // Color scale
  const scale = useMemo(() => {
    const allReturns = transformedGroups.flatMap((g) =>
      g.etfs.map((e) => e.ret)
    );
    return buildColorScale(allReturns, heatmapPeriod);
  }, [transformedGroups, heatmapPeriod]);

  const drilledGroupData = useMemo(() => {
    if (!drilledGroup) return null;
    return transformedGroups.find((g) => g.name === drilledGroup) ?? null;
  }, [drilledGroup, transformedGroups]);

  return (
    <div className="space-y-3">
      {/* Sub-Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* KR View Mode Switcher */}
        {market === "KR" && repGroup && (
          <div className="flex items-center rounded-lg border border-gray-800 bg-gray-900/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setKrViewMode("representatives");
                setDrilledGroup(null);
              }}
              className={`rounded-md px-3 py-1.5 font-semibold transition-all ${
                krViewMode === "representatives" && !drilledGroup
                  ? "bg-sky-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              🏷️ 23대 대표 업종 뷰 ({repGroup.etfs.length}개 ETF)
            </button>
            <button
              type="button"
              onClick={() => setKrViewMode("categories")}
              className={`rounded-md px-3 py-1.5 font-semibold transition-all ${
                krViewMode === "categories" || drilledGroup
                  ? "bg-sky-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              📂 전체 카테고리 뷰 (드릴다운)
            </button>
          </div>
        )}

        {/* Breadcrumb for drill-down */}
        {drilledGroup && (
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setDrilledGroup(null)}
              className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
            >
              ← 전체 카테고리
            </button>
            <span className="text-gray-500">/</span>
            <span className="text-sm font-semibold text-gray-200">
              {drilledGroup}
            </span>
            {drilledGroupData && (
              <span className="text-xs text-gray-500">
                ({drilledGroupData.etf_count}개 ETF)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Treemap render */}
      <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-2">
        {market === "KR" && krViewMode === "representatives" && !drilledGroup && repGroup ? (
          <StockTreemap
            group={repGroup}
            scale={scale}
            market={market}
            onHover={onHover}
            showSectorBadge={true}
          />
        ) : !drilledGroup ? (
          <GroupTreemap
            groups={transformedGroups}
            scale={scale}
            onDrill={(name) => setDrilledGroup(name)}
          />
        ) : (
          drilledGroupData && (
            <StockTreemap
              group={drilledGroupData}
              scale={scale}
              market={market}
              onHover={onHover}
            />
          )
        )}
      </div>
    </div>
  );
}

function roundVal(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Group Treemap Component
 * ──────────────────────────────────────────────────────────────────────── */

interface GroupTreemapProps {
  groups: TransformedETFGroup[];
  scale: ColorScale;
  onDrill: (groupName: string) => void;
}

function GroupTreemap({ groups, scale, onDrill }: GroupTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.max(480, Math.min(width * 0.6, 800));

  const layout = useMemo(() => {
    return squarify(
      groups.map((g) => ({ g, weight: g.weight })),
      { x: 0, y: 0, w: width, h: height }
    );
  }, [groups, width, height]);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="ETF 카테고리별 히트맵"
        className="block select-none"
      >
        {layout.map(({ item, rect }) => {
          const g = item.g;
          const ret = g.avg_return;
          const { fill, text } = heatColor(ret, scale);
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;

          const showName = rect.w > 45 && rect.h > 24;
          const showRet = rect.w > 55 && rect.h > 40;
          const showCount = rect.w > 65 && rect.h > 56;

          const nameFs = Math.min(14, Math.max(9, rect.w / 8));
          const retFs = Math.min(13, Math.max(9, rect.w / 9));
          const subFs = Math.min(11, Math.max(8, rect.w / 11));

          const lineHeights: number[] = [];
          if (showName) lineHeights.push(nameFs);
          if (showRet) lineHeights.push(retFs);
          if (showCount) lineHeights.push(subFs);
          const lineGap = 3;
          const totalH =
            lineHeights.reduce((s, h) => s + h, 0) +
            lineGap * Math.max(0, lineHeights.length - 1);
          let curY = cy - totalH / 2;

          const nameMaxW = rect.w - 10;

          return (
            <g
              key={g.name}
              className="cursor-pointer transition-opacity hover:opacity-90"
              onClick={() => onDrill(g.name)}
            >
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                fill={fill}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={1.5}
                rx={2}
              />
              {showName && (
                <text
                  x={cx}
                  y={curY + nameFs * 0.85}
                  fontSize={nameFs}
                  fontWeight={700}
                  fill={text}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {truncate(g.name, nameMaxW, nameFs)}
                </text>
              )}
              {showName && showRet && (curY += nameFs + lineGap)}
              {showRet && (
                <text
                  x={cx}
                  y={curY + retFs * 0.85}
                  fontSize={retFs}
                  fontWeight={600}
                  fill={text}
                  textAnchor="middle"
                  pointerEvents="none"
                  opacity={0.95}
                >
                  {formatReturn(g.avg_return)}
                </text>
              )}
              {showRet && showCount && (curY += retFs + lineGap)}
              {showCount && (
                <text
                  x={cx}
                  y={curY + subFs * 0.85}
                  fontSize={subFs}
                  fill={text}
                  textAnchor="middle"
                  pointerEvents="none"
                  opacity={0.7}
                >
                  {g.etf_count}개 ETF
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Individual ETF Stock / Sector Treemap Component
 * ──────────────────────────────────────────────────────────────────────── */

interface StockTreemapProps {
  group: TransformedETFGroup;
  scale: ColorScale;
  market: "KR" | "US";
  onHover: (etf: ETFItem | null) => void;
  showSectorBadge?: boolean;
}

function StockTreemap({ group, scale, market, onHover, showSectorBadge = false }: StockTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.max(520, Math.min(width * 0.62, 850));

  const layout = useMemo(() => {
    return squarify(
      group.etfs.map((e) => ({ item: e, weight: e.weight })),
      { x: 0, y: 0, w: width, h: height }
    );
  }, [group.etfs, width, height]);

  const handleTileClick = (e: React.MouseEvent, item: TransformedETFGroup["etfs"][number]) => {
    if (market === "KR") {
      window.open(`https://finance.naver.com/item/main.naver?code=${item.code}`, "_blank");
    } else {
      const codeUrl = item.url || item.code;
      window.open(`https://m.stock.naver.com/worldstock/stock/${codeUrl}/total`, "_blank");
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${group.name} ETF 목록`}
        className="block select-none"
      >
        {layout.map(({ item, rect }) => {
          const etf = item.item;
          const ret = etf.ret;
          const { fill, text } = heatColor(ret, scale);
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;

          const showSectorHeader = showSectorBadge && etf.sector && rect.w > 45 && rect.h > 24;
          const showName = rect.w > 40 && rect.h > (showSectorHeader ? 38 : 24);
          const showRet = rect.w > 50 && rect.h > (showSectorHeader ? 54 : 40);
          const showSubText = rect.w > 65 && rect.h > (showSectorHeader ? 70 : 54);

          const headerFs = Math.min(13, Math.max(9, rect.w / 7.5));
          const nameFs = Math.min(12, Math.max(8.5, rect.w / 8.5));
          const retFs = Math.min(13, Math.max(9, rect.w / 8.5));
          const subFs = Math.min(10, Math.max(8, rect.w / 11));

          const lineHeights: number[] = [];
          if (showSectorHeader) lineHeights.push(headerFs);
          if (showName) lineHeights.push(nameFs);
          if (showRet) lineHeights.push(retFs);
          if (showSubText) lineHeights.push(subFs);
          const lineGap = 2;
          const totalH =
            lineHeights.reduce((s, h) => s + h, 0) +
            lineGap * Math.max(0, lineHeights.length - 1);
          let curY = cy - totalH / 2;

          const nameMaxW = rect.w - 8;

          // Format marcap string (e.g. 84793 -> 8.5조원, 7428 -> 7,428억원)
          const marcapStr = etf.marcap
            ? etf.marcap >= 10000
              ? `${(etf.marcap / 10000).toFixed(1)}조`
              : `${etf.marcap.toLocaleString()}억`
            : etf.code;

          return (
            <g
              key={etf.code}
              className="cursor-pointer transition-opacity hover:opacity-90"
              onClick={(evt) => handleTileClick(evt, etf)}
              onMouseEnter={() => onHover(etf.raw)}
              onMouseLeave={() => onHover(null)}
            >
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                fill={fill}
                stroke="rgba(0,0,0,0.6)"
                strokeWidth={1}
                rx={2}
              />
              {/* Sector Header (e.g. [반도체]) */}
              {showSectorHeader && (
                <text
                  x={cx}
                  y={curY + headerFs * 0.85}
                  fontSize={headerFs}
                  fontWeight={800}
                  fill={text}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  [{etf.sector}]
                </text>
              )}
              {showSectorHeader && showName && (curY += headerFs + lineGap)}

              {/* ETF Name */}
              {showName && (
                <text
                  x={cx}
                  y={curY + nameFs * 0.85}
                  fontSize={nameFs}
                  fontWeight={showSectorHeader ? 500 : 700}
                  fill={text}
                  textAnchor="middle"
                  pointerEvents="none"
                  opacity={showSectorHeader ? 0.9 : 1}
                >
                  {truncate(etf.name, nameMaxW, nameFs)}
                </text>
              )}
              {showName && showRet && (curY += nameFs + lineGap)}

              {/* Return Rate */}
              {showRet && (
                <text
                  x={cx}
                  y={curY + retFs * 0.85}
                  fontSize={retFs}
                  fontWeight={700}
                  fill={text}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {formatReturn(etf.ret)}
                </text>
              )}
              {showRet && showSubText && (curY += retFs + lineGap)}

              {/* SubText (MarCap or Code) */}
              {showSubText && (
                <text
                  x={cx}
                  y={curY + subFs * 0.85}
                  fontSize={subFs}
                  fill={text}
                  textAnchor="middle"
                  pointerEvents="none"
                  opacity={0.75}
                >
                  {marcapStr}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
