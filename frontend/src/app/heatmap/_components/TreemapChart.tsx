"use client";

import { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import type { StockHeatmapGroup, StockHeatmapItem } from "@/lib/api";
import { squarify, type Rect } from "../_lib/treemap";
import { heatColor, type ColorScale } from "../_lib/colors";
import { formatMarcap, formatReturn, textWidth, truncate } from "../_lib/format";

interface TreemapChartProps {
  groups: StockHeatmapGroup[];
  scale: ColorScale;
}

interface HoverState {
  stock: StockHeatmapItem;
  group: string;
  x: number;
  y: number;
}

interface SelectedState {
  stock: StockHeatmapItem;
  group: string;
}

const HEADER_H = 22;
const PAD = 1;

export function TreemapChart({ groups, scale }: TreemapChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selected, setSelected] = useState<SelectedState | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouch(
        "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia("(pointer: coarse)").matches
      );
    }
  }, []);

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
    const outer = squarify(
      groups.map((g) => ({ g, weight: g.weight })),
      { x: 0, y: 0, w: width, h: height }
    );
    return outer.map(({ item, rect }) => {
      const showHeader = rect.h >= 48 && rect.w >= 70;
      const headerH = showHeader ? HEADER_H : 0;
      const inner: Rect = {
        x: rect.x + PAD,
        y: rect.y + PAD + headerH,
        w: Math.max(0, rect.w - 2 * PAD),
        h: Math.max(0, rect.h - 2 * PAD - headerH),
      };
      const cells = squarify(
        item.g.stocks.map((s) => ({ s, weight: s.weight })),
        inner
      );
      return { group: item.g, rect, showHeader, cells };
    });
  }, [groups, width, height]);

  const handleStockClick = (
    e: React.MouseEvent,
    stock: StockHeatmapItem,
    groupName: string
  ) => {
    const isTouchEvent =
      isTouch || (e.nativeEvent as PointerEvent).pointerType === "touch";

    if (isTouchEvent) {
      e.stopPropagation();
      setSelected((prev) =>
        prev?.stock.code === stock.code ? null : { stock, group: groupName }
      );
    } else {
      window.open(
        `https://finance.naver.com/item/main.nhn?code=${stock.code}`,
        "_blank",
        "noopener"
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
        aria-label="주식 히트맵 트리맵"
        className="block select-none"
      >
        {layout.map(({ group, rect, showHeader, cells }) => {
          const metrics = `${formatReturn(group.avg_return)}${
            group.rs !== null ? `  RS ${group.rs}` : ""
          }`;
          const nameMax = rect.w - 10 - textWidth(metrics, 11) - 6;
          return (
            <g key={group.name}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                fill="#0d1424"
                stroke="#1f2937"
                strokeWidth={1}
              />
              {showHeader && (
                <>
                  {nameMax > 18 && (
                    <text
                      x={rect.x + 5}
                      y={rect.y + 15}
                      fontSize={11}
                      fontWeight={700}
                      fill="#e5e7eb"
                    >
                      {truncate(group.name, nameMax, 11)}
                    </text>
                  )}
                  <text
                    x={rect.x + rect.w - 5}
                    y={rect.y + 15}
                    fontSize={11}
                    fontWeight={600}
                    fill="#9ca3af"
                    textAnchor="end"
                  >
                    {metrics}
                  </text>
                </>
              )}
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
                      if (!isTouch) {
                        setHover({
                          stock: item.s,
                          group: group.name,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }
                    }}
                    onMouseLeave={() => setHover(null)}
                    onClick={(e) => handleStockClick(e, item.s, group.name)}
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
            </g>
          );
        })}
      </svg>

      {/* 데스크톱 마우스 호버 툴팁 */}
      {hover && !selected && !isTouch && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 text-xs shadow-xl"
          style={{
            left: Math.min(hover.x + 14, window.innerWidth - 240),
            top: Math.min(hover.y + 14, window.innerHeight - 140),
          }}
        >
          <div className="font-bold text-gray-100">
            {hover.stock.name}
            <span className="ml-2 font-normal text-gray-500">
              {hover.stock.code} · {hover.stock.market}
            </span>
          </div>
          <div className="mt-1 text-gray-500">{hover.group}</div>
          <div className="mt-1 flex gap-3">
            <span
              className={
                hover.stock.ret === null
                  ? "text-gray-400"
                  : hover.stock.ret > 0
                    ? "text-red-400"
                    : hover.stock.ret < 0
                      ? "text-blue-400"
                      : "text-gray-300"
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
          <div className="mt-1 text-[10px] text-gray-600">
            클릭 시 네이버 금융으로 이동
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
              <div className="mt-0.5 text-xs text-gray-400">
                {selected.group}
              </div>
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
              href={`https://finance.naver.com/item/main.nhn?code=${selected.stock.code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:bg-emerald-700"
            >
              네이버 증권에서 보기 ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

