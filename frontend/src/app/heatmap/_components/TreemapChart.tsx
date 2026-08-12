"use client";

import { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import type { StockHeatmapGroup, StockHeatmapItem } from "@/lib/api";
import { squarify, type Rect } from "../_lib/treemap";
import { heatColor, type ColorScale } from "../_lib/colors";
import { formatMarcap, formatReturn, truncate } from "../_lib/format";

/* ──────────────────────────────────────────────────────────────────────────
 * Group-level treemap  (Step 1)
 * Each cell = one group (sector / industry / theme), sized by weight,
 * coloured by avg_return.  Clicking a cell drills into the group.
 * ──────────────────────────────────────────────────────────────────────── */

interface GroupTreemapProps {
  groups: StockHeatmapGroup[];
  scale: ColorScale;
  onDrill: (groupName: string) => void;
}

interface GroupHoverState {
  group: StockHeatmapGroup;
  x: number;
  y: number;
}

export function GroupTreemap({ groups, scale, onDrill }: GroupTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [hover, setHover] = useState<GroupHoverState | null>(null);

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
      { x: 0, y: 0, w: width, h: height },
    );
  }, [groups, width, height]);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="그룹별 히트맵"
        className="block select-none"
      >
        {layout.map(({ item, rect }) => {
          const g = item.g as StockHeatmapGroup;
          const ret = g.avg_return ?? 0;
          const { fill, text } = heatColor(ret, scale);
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;

          // Progressive disclosure based on box size
          const showName = rect.w > 50 && rect.h > 28;
          const showRet = rect.w > 60 && rect.h > 44;
          const showRS = rect.w > 60 && rect.h > 58 && g.rs !== null;
          const showCount = rect.w > 70 && rect.h > 72;

          // Font sizes scale with box width
          const nameFs = Math.min(14, Math.max(9, rect.w / 8));
          const retFs = Math.min(13, Math.max(9, rect.w / 9));
          const subFs = Math.min(11, Math.max(8, rect.w / 11));

          // Compute total text block height for vertical centering
          const lineHeights: number[] = [];
          if (showName) lineHeights.push(nameFs);
          if (showRet) lineHeights.push(retFs);
          if (showRS) lineHeights.push(subFs);
          if (showCount) lineHeights.push(subFs);
          const lineGap = 3;
          const totalH = lineHeights.reduce((s, h) => s + h, 0) + lineGap * Math.max(0, lineHeights.length - 1);
          let curY = cy - totalH / 2;

          const nameMaxW = rect.w - 12;

          return (
            <g
              key={g.name}
              className="cursor-pointer"
              onClick={() => onDrill(g.name)}
              onMouseMove={(e) => {
                if ((e.nativeEvent as PointerEvent).pointerType !== "touch") {
                  setHover({
                    group: g,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }
              }}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                fill={fill}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={1}
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
                  opacity={0.9}
                >
                  {formatReturn(g.avg_return)}
                </text>
              )}
              {showRet && showRS && (curY += retFs + lineGap)}
              {showRS && (
                <text
                  x={cx}
                  y={curY + subFs * 0.85}
                  fontSize={subFs}
                  fill={text}
                  textAnchor="middle"
                  pointerEvents="none"
                  opacity={0.7}
                >
                  RS {g.rs}
                </text>
              )}
              {showRS && showCount && (curY += subFs + lineGap)}
              {showCount && (
                <text
                  x={cx}
                  y={curY + subFs * 0.85}
                  fontSize={subFs}
                  fill={text}
                  textAnchor="middle"
                  pointerEvents="none"
                  opacity={0.6}
                >
                  {g.stock_count}종목
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* 데스크톱 마우스 호버 툴팁 / 팝업 */}
      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm"
          style={{
            left: Math.max(10, Math.min(hover.x + 14, window.innerWidth - 240)),
            top: Math.max(10, Math.min(hover.y + 14, window.innerHeight - 140)),
          }}
        >
          <div className="font-bold text-gray-100">{hover.group.name}</div>
          <div className="mt-1 flex gap-3 text-gray-300">
            <span>
              평균 수익률{" "}
              <span
                className={
                  hover.group.avg_return === null
                    ? "text-gray-400"
                    : hover.group.avg_return > 0
                      ? "font-semibold text-red-400"
                      : hover.group.avg_return < 0
                        ? "font-semibold text-blue-400"
                        : "font-semibold text-gray-300"
                }
              >
                {formatReturn(hover.group.avg_return)}
              </span>
            </span>
            <span>{hover.group.stock_count}종목</span>
            {hover.group.rs !== null && (
              <span className="text-gray-400">RS {hover.group.rs}</span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-sky-400">
            클릭하여 종목 목록 보기 ↗
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Stock-level treemap  (Step 2 – drill-down)
 * Shows individual stocks inside a single group.
 * ──────────────────────────────────────────────────────────────────────── */

interface StockTreemapProps {
  group: StockHeatmapGroup;
  scale: ColorScale;
}

interface HoverState {
  stock: StockHeatmapItem;
  x: number;
  y: number;
}

interface SelectedState {
  stock: StockHeatmapItem;
}

export function StockTreemap({ group, scale }: StockTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selected, setSelected] = useState<SelectedState | null>(null);

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

  const cells = useMemo(() => {
    return squarify(
      group.stocks.map((s) => ({ s, weight: s.weight })),
      { x: 0, y: 0, w: width, h: height },
    );
  }, [group, width, height]);

  const handleStockClick = (
    e: React.MouseEvent,
    stock: StockHeatmapItem,
  ) => {
    const isTouchEvent = (e.nativeEvent as PointerEvent).pointerType === "touch";

    if (isTouchEvent) {
      e.stopPropagation();
      setSelected((prev) =>
        prev?.stock.code === stock.code ? null : { stock },
      );
    } else {
      window.open(
        `http://hermian.duckdns.org:15888/?search=${encodeURIComponent(stock.name)}`,
        "_blank",
        "noopener",
      );
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onClick={() => setSelected(null)}
    >
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${group.name} 종목 히트맵`}
        className="block select-none"
      >
        {cells.map(({ item, rect: cr }) => {
          const { fill, text } = heatColor(item.s.ret, scale);
          const fs = cr.w > 95 ? 11 : 9.5;
          const showRet = cr.w > 58 && cr.h > 36;
          const showName = showRet || (cr.w > 36 && cr.h > 16);
          const isSelectedCell = selected?.stock.code === item.s.code;

          return (
            <g
              key={item.s.code}
              className="cursor-pointer"
              onMouseMove={(e) => {
                if ((e.nativeEvent as PointerEvent).pointerType !== "touch") {
                  setHover({
                    stock: item.s,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }
              }}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => handleStockClick(e, item.s)}
            >
              <rect
                x={cr.x}
                y={cr.y}
                width={cr.w}
                height={cr.h}
                fill={fill}
                stroke={isSelectedCell ? "#ffffff" : "rgba(0,0,0,0.4)"}
                strokeWidth={isSelectedCell ? 2 : 0.5}
              />
              {showName && (
                <text
                  x={cr.x + 3}
                  y={cr.y + fs + 2}
                  fontSize={fs}
                  fontWeight={600}
                  fill={text}
                  pointerEvents="none"
                >
                  {truncate(item.s.name, cr.w - 6, fs)}
                </text>
              )}
              {showRet && (
                <text
                  x={cr.x + 3}
                  y={cr.y + fs * 2 + 4}
                  fontSize={fs - 1}
                  fill={text}
                  pointerEvents="none"
                >
                  {formatReturn(item.s.ret)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* 데스크톱 마우스 호버 툴팁 */}
      {hover && !selected && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm"
          style={{
            left: Math.max(10, Math.min(hover.x + 14, window.innerWidth - 240)),
            top: Math.max(10, Math.min(hover.y + 14, window.innerHeight - 150)),
          }}
        >
          <div className="font-bold text-gray-100">
            {hover.stock.name}
            <span className="ml-2 font-normal text-gray-400">
              {hover.stock.code} · {hover.stock.market}
            </span>
          </div>
          <div className="mt-1 text-gray-400">{group.name}</div>
          <div className="mt-1 flex gap-3">
            <span
              className={
                hover.stock.ret === null
                  ? "text-gray-400"
                  : hover.stock.ret > 0
                    ? "text-red-400 font-semibold"
                    : hover.stock.ret < 0
                      ? "text-blue-400 font-semibold"
                      : "text-gray-300 font-semibold"
              }
            >
              {formatReturn(hover.stock.ret)}
            </span>
            <span className="text-gray-300">
              시총 {formatMarcap(hover.stock.marcap)}
            </span>
            {hover.stock.rs !== null && (
              <span className="text-gray-400">RS {hover.stock.rs}</span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-sky-400">
            클릭 시 상세 정보 이동 ↗
          </div>
        </div>
      )}

      {/* 모바일/터치 선택 팝업 카드 */}
      {selected && (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 rounded-xl border border-gray-700 bg-gray-900/95 p-4 shadow-2xl backdrop-blur-md sm:absolute sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-80 sm:-translate-x-1/2 sm:-translate-y-1/2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-base font-bold text-gray-100">
                {selected.stock.name}
                <span className="text-xs font-normal text-gray-400">
                  {selected.stock.code} · {selected.stock.market}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-gray-400">{group.name}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3 text-sm">
            <div className="flex gap-3">
              <span
                className={
                  selected.stock.ret === null
                    ? "font-semibold text-gray-400"
                    : selected.stock.ret > 0
                      ? "font-semibold text-red-400"
                      : selected.stock.ret < 0
                        ? "font-semibold text-blue-400"
                        : "font-semibold text-gray-300"
                }
              >
                {formatReturn(selected.stock.ret)}
              </span>
              <span className="text-gray-300">
                시총 {formatMarcap(selected.stock.marcap)}
              </span>
              {selected.stock.rs !== null && (
                <span className="text-gray-400">RS {selected.stock.rs}</span>
              )}
            </div>
          </div>

          <div className="mt-3">
            <a
              href={`http://hermian.duckdns.org:15888/?search=${encodeURIComponent(selected.stock.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:bg-emerald-700"
            >
              상세 정보 보기 ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
