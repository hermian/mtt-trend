"use client";

import { memo, useState } from "react";
import clsx from "clsx";
import type { HeatmapGrouping, HeatmapPeriod, HeatmapSizeBy, HeatmapColorBy } from "@/lib/api";

export interface HeatmapControls {
  grouping: HeatmapGrouping;
  period: HeatmapPeriod;
  sizeBy: HeatmapSizeBy;
  colorBy: HeatmapColorBy;
  startDate: string | null;
  endDate: string | null;
  marcapMin: number | null;
  marcapMax: number | null;
  tradeValueMin: number | null;
  minTradeValueGrowth: number | null;
  minRet: number | null;
  minRs: number | null;
  mmt: number[] | null;
  limit: number;
}

interface ControlBarProps {
  value: HeatmapControls;
  onChange: (patch: Partial<HeatmapControls>) => void;
  onSaveDefault?: () => void;
  onResetDefault?: () => void;
}

const GROUPINGS: Array<{ id: HeatmapGrouping; label: string }> = [
  { id: "sector", label: "섹터" },
  { id: "industry", label: "업종" },
  { id: "theme", label: "테마" },
  { id: "theme2", label: "테마2" },
  { id: "kospi", label: "KOSPI" },
  { id: "kosdaq", label: "KOSDAQ" },
];

const PERIODS: Array<{ id: HeatmapPeriod; label: string }> = [
  { id: "1D", label: "1일" },
  { id: "5D", label: "5일" },
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "12M", label: "12M" },
  { id: "CUSTOM", label: "기간 지정" },
];

const SIZE_BY_OPTIONS: Array<{ id: HeatmapSizeBy; label: string; tip: string }> = [
  { id: "marcap", label: "시가총액", tip: "타일 크기를 시가총액 기준으로 표시합니다" },
  { id: "trade_value", label: "거래대금", tip: "타일 크기를 선택 기간의 일평균 거래대금 기준으로 표시합니다" },
];

const COLOR_BY_OPTIONS: Array<{ id: HeatmapColorBy; label: string; tip: string }> = [
  { id: "return", label: "주가 수익률", tip: "타일 색상을 주가 등락률(빨강=상승, 파랑=하락) 기준으로 표시합니다" },
  { id: "trade_value_growth", label: "거래대금 증가율", tip: "타일 색상을 직전 동기간 대비 거래대금 증가율(빨강=급증, 파랑=감소) 기준으로 표시합니다" },
];

const TRADE_VALUE_GROWTH_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "전체", value: null },
  { label: "0%+(증가)", value: 0 },
  { label: "30%+", value: 30 },
  { label: "50%+", value: 50 },
  { label: "100%+(2배)", value: 100 },
  { label: "200%+(3배)", value: 200 },
];

const TRADE_VALUE_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "전체", value: null },
  { label: "50억+", value: 50 },
  { label: "100억+", value: 100 },
  { label: "300억+", value: 300 },
  { label: "500억+", value: 500 },
  { label: "1000억+", value: 1000 },
];

const MARCAP_PRESETS: Array<{
  label: string;
  min: number | null;
  max: number | null;
}> = [
  { label: "전체", min: null, max: null },
  { label: "1000억+", min: 1000, max: null },
  { label: "3000억+", min: 3000, max: null },
  { label: "5000억+", min: 5000, max: null },
  { label: "1조+", min: 10000, max: null },
  { label: "5조+", min: 50000, max: null },
];

const MIN_RET_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "전체", value: null },
  { label: "2%+", value: 2 },
  { label: "3%+", value: 3 },
  { label: "4%+", value: 4 },
  { label: "5%+", value: 5 },
  { label: "10%+", value: 10 },
];

const RS_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "전체", value: null },
  { label: "70+", value: 70 },
  { label: "80+", value: 80 },
  { label: "85+", value: 85 },
  { label: "90+", value: 90 },
  { label: "95+", value: 95 },
];

const MMT_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "전체", value: null },
  { label: "-2", value: -2 },
  { label: "-1", value: -1 },
  { label: "0", value: 0 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
];

const LIMITS: Array<{ id: number; label: string }> = [
  { id: 50, label: "상위 50" },
  { id: 100, label: "상위 100" },
  { id: 200, label: "상위 200" },
  { id: 300, label: "상위 300" },
  { id: 400, label: "상위 400" },
  { id: 500, label: "상위 500" },
  { id: 0, label: "전체" },
];

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getDefaultDates(): { start: string; end: string } {
  const now = new Date();
  const end = formatDate(now);
  const d = new Date(now);
  d.setMonth(d.getMonth() - 1);
  const start = formatDate(d);
  return { start, end };
}

function getPresetDates(preset: "1M" | "3M" | "YTD" | "1Y"): { start: string; end: string } {
  const now = new Date();
  const end = formatDate(now);
  if (preset === "YTD") {
    return { start: `${now.getFullYear()}-01-01`, end };
  }
  const d = new Date(now);
  if (preset === "1M") d.setMonth(d.getMonth() - 1);
  if (preset === "3M") d.setMonth(d.getMonth() - 3);
  if (preset === "1Y") d.setFullYear(d.getFullYear() - 1);
  return { start: formatDate(d), end };
}

function btnClass(active: boolean): string {
  return clsx(
    "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap",
    active
      ? "bg-sky-600 text-white"
      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
  );
}

export const ControlBar = memo(function ControlBar({
  value,
  onChange,
  onSaveDefault,
  onResetDefault,
}: ControlBarProps) {
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [tradeValInput, setTradeValInput] = useState("");
  const [tradeValGrowthInput, setTradeValGrowthInput] = useState("");
  const [retInput, setRetInput] = useState("");
  const [rsInput, setRsInput] = useState("");

  const [customStart, setCustomStart] = useState(value.startDate ?? "");
  const [customEnd, setCustomEnd] = useState(value.endDate ?? "");

  const applyCustom = () => {
    const min = minInput.trim() === "" ? null : Number(minInput);
    const max = maxInput.trim() === "" ? null : Number(maxInput);
    onChange({
      marcapMin: min !== null && Number.isFinite(min) && min >= 0 ? min : null,
      marcapMax: max !== null && Number.isFinite(max) && max > 0 ? max : null,
    });
  };

  const applyCustomTradeVal = () => {
    const val = tradeValInput.trim() === "" ? null : Number(tradeValInput);
    onChange({
      tradeValueMin: val !== null && Number.isFinite(val) && val >= 0 ? val : null,
    });
  };

  const applyCustomTradeValGrowth = () => {
    const val = tradeValGrowthInput.trim() === "" ? null : Number(tradeValGrowthInput);
    onChange({
      minTradeValueGrowth: val !== null && Number.isFinite(val) ? val : null,
    });
  };

  const applyCustomRet = () => {
    const ret = retInput.trim() === "" ? null : Number(retInput);
    onChange({
      minRet: ret !== null && Number.isFinite(ret) ? ret : null,
    });
  };

  const applyCustomRs = () => {
    const rs = rsInput.trim() === "" ? null : Number(rsInput);
    onChange({
      minRs: rs !== null && Number.isFinite(rs) && rs >= 0 && rs <= 99 ? rs : null,
    });
  };

  const applyDateRange = () => {
    if (!customStart.trim()) return;
    onChange({
      period: "CUSTOM",
      startDate: customStart.trim(),
      endDate: customEnd.trim() || null,
    });
  };

  const handleSelectPeriod = (pId: HeatmapPeriod) => {
    if (pId !== "CUSTOM") {
      onChange({ period: pId, startDate: null, endDate: null });
    } else {
      const defaults = getDefaultDates();
      const start = customStart || defaults.start;
      const end = customEnd || defaults.end;
      setCustomStart(start);
      setCustomEnd(end);
      onChange({ period: "CUSTOM", startDate: start, endDate: end });
    }
  };

  const handleApplyPreset = (preset: "1M" | "3M" | "YTD" | "1Y") => {
    const { start, end } = getPresetDates(preset);
    setCustomStart(start);
    setCustomEnd(end);
    onChange({ period: "CUSTOM", startDate: start, endDate: end });
  };

  const handleSelectGrouping = (groupingId: HeatmapGrouping) => {
    if (groupingId === "theme2") {
      // 테마2 버튼: 기본값은 1일, 시가총액 전체, 수익률 전체, RS 필터 전체, MMT 필터 전체, 표시 개수 전체
      setMinInput("");
      setMaxInput("");
      setTradeValInput("");
      setTradeValGrowthInput("");
      setRetInput("");
      setRsInput("");
      setCustomStart("");
      setCustomEnd("");
      onChange({
        grouping: "theme2",
        period: "1D",
        sizeBy: "marcap",
        colorBy: "return",
        startDate: null,
        endDate: null,
        marcapMin: null,
        marcapMax: null,
        tradeValueMin: null,
        minTradeValueGrowth: null,
        minRet: null,
        minRs: null,
        mmt: null,
        limit: 0,
      });
    } else {
      onChange({ grouping: groupingId });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3">
      {/* 그룹 기준 */}
      <div className="flex items-center gap-1">
        {GROUPINGS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={btnClass(value.grouping === g.id)}
            onClick={() => handleSelectGrouping(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* 기간 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={btnClass(value.period === p.id)}
              onClick={() => handleSelectPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {value.period === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-700 bg-gray-800/80 px-2.5 py-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-400">시작</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                className="cursor-pointer rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-sky-500 focus:outline-none [color-scheme:dark]"
              />
              <span className="font-medium text-gray-400">~ 종료</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                className="cursor-pointer rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-sky-500 focus:outline-none [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={applyDateRange}
                className="rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-sky-500"
              >
                조회
              </button>
            </div>

            <div className="flex items-center gap-1 border-l border-gray-700 pl-2">
              <button
                type="button"
                onClick={() => handleApplyPreset("1M")}
                className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                1개월전
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("3M")}
                className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                3개월전
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("YTD")}
                className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                YTD(올해)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("1Y")}
                className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                1년전
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 크기 기준 */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">크기 기준</span>
        {SIZE_BY_OPTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            title={s.tip}
            className={btnClass(value.sizeBy === s.id)}
            onClick={() => onChange({ sizeBy: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 색상 기준 */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">색상 기준</span>
        {COLOR_BY_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.tip}
            className={btnClass(value.colorBy === c.id)}
            onClick={() => onChange({ colorBy: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 시가총액 */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">시가총액</span>
        {MARCAP_PRESETS.map((m) => (
          <button
            key={m.label}
            type="button"
            className={btnClass(
              value.marcapMin === m.min && value.marcapMax === m.max
            )}
            onClick={() => onChange({ marcapMin: m.min, marcapMax: m.max })}
          >
            {m.label}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">직접입력</span>
        <input
          type="number"
          min={0}
          placeholder="최저"
          value={minInput}
          onChange={(e) => setMinInput(e.target.value)}
          className="w-20 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">억 ~</span>
        <input
          type="number"
          min={0}
          placeholder="최대"
          value={maxInput}
          onChange={(e) => setMaxInput(e.target.value)}
          className="w-20 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">억</span>
        <button
          type="button"
          onClick={applyCustom}
          className="rounded-md bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-600"
        >
          적용
        </button>
      </div>

      {/* 거래대금 필터 */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">
          거래대금{value.period === "1D" ? "" : "(일평균)"}
        </span>
        {TRADE_VALUE_PRESETS.map((t) => (
          <button
            key={t.label}
            type="button"
            className={btnClass(value.tradeValueMin === t.value)}
            onClick={() => {
              setTradeValInput("");
              onChange({ tradeValueMin: t.value });
            }}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">직접입력</span>
        <input
          type="number"
          min={0}
          placeholder="최저"
          value={tradeValInput}
          onChange={(e) => setTradeValInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyCustomTradeVal();
          }}
          className="w-16 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">억 이상</span>
        <button
          type="button"
          onClick={applyCustomTradeVal}
          className="rounded-md bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-600"
        >
          적용
        </button>
      </div>

      {/* 거래대금 증가율 필터 */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">
          대금 증가{value.period === "1D" ? "(20MA대비)" : "(직전대비)"}
        </span>
        {TRADE_VALUE_GROWTH_PRESETS.map((tg) => (
          <button
            key={tg.label}
            type="button"
            className={btnClass(value.minTradeValueGrowth === tg.value)}
            onClick={() => {
              setTradeValGrowthInput("");
              onChange({ minTradeValueGrowth: tg.value });
            }}
          >
            {tg.label}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">직접입력</span>
        <input
          type="number"
          placeholder="최저"
          value={tradeValGrowthInput}
          onChange={(e) => setTradeValGrowthInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyCustomTradeValGrowth();
          }}
          className="w-16 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">% 이상</span>
        <button
          type="button"
          onClick={applyCustomTradeValGrowth}
          className="rounded-md bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-600"
        >
          적용
        </button>
      </div>

      {/* 수익률 */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">수익률</span>
        {MIN_RET_PRESETS.map((r) => (
          <button
            key={r.label}
            type="button"
            className={btnClass(value.minRet === r.value)}
            onClick={() => {
              setRetInput("");
              onChange({ minRet: r.value });
            }}
          >
            {r.label}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">직접입력</span>
        <input
          type="number"
          step="any"
          placeholder="최저"
          value={retInput}
          onChange={(e) => setRetInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyCustomRet();
          }}
          className="w-16 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">% 이상</span>
        <button
          type="button"
          onClick={applyCustomRet}
          className="rounded-md bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-600"
        >
          적용
        </button>
      </div>

      {/* RS Rating */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">RS 필터</span>
        {RS_PRESETS.map((r) => (
          <button
            key={r.label}
            type="button"
            className={btnClass(value.minRs === r.value)}
            onClick={() => {
              setRsInput("");
              onChange({ minRs: r.value });
            }}
          >
            {r.label}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">직접입력</span>
        <input
          type="number"
          min={0}
          max={99}
          placeholder="최저"
          value={rsInput}
          onChange={(e) => setRsInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyCustomRs();
          }}
          className="w-16 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">이상</span>
        <button
          type="button"
          onClick={applyCustomRs}
          className="rounded-md bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-600"
        >
          적용
        </button>
      </div>

      {/* MMT 필터 */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">MMT 필터</span>
        {MMT_PRESETS.map((m) => {
          const active =
            m.value === null
              ? !value.mmt || value.mmt.length === 0
              : Boolean(value.mmt?.includes(m.value));

          const handleClick = () => {
            if (m.value === null) {
              onChange({ mmt: null });
              return;
            }
            const current = value.mmt ?? [];
            const exists = current.includes(m.value);
            let next: number[];
            if (exists) {
              next = current.filter((v) => v !== m.value);
            } else {
              next = [...current, m.value].sort((a, b) => a - b);
            }
            if (next.length === 0 || next.length === 6) {
              onChange({ mmt: null });
            } else {
              onChange({ mmt: next });
            }
          };

          return (
            <button
              key={m.label}
              type="button"
              className={btnClass(active)}
              onClick={handleClick}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 표시 개수 */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs text-gray-500">표시 개수</span>
        {LIMITS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={btnClass(value.limit === l.id)}
            onClick={() => onChange({ limit: l.id })}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* 기본값 설정 액션 버튼 */}
      {(onSaveDefault || onResetDefault) && (
        <div className="ml-auto flex items-center gap-1.5 border-t border-gray-800 pt-2 sm:border-t-0 sm:pt-0">
          {onSaveDefault && (
            <button
              type="button"
              onClick={onSaveDefault}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-600/60 bg-emerald-950/70 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-900 hover:text-white active:bg-emerald-800"
              title="현재 설정된 필터 조건을 다음 접속 시 기본값으로 저장합니다"
            >
              <span>💾</span> 기본값 저장
            </button>
          )}
          {onResetDefault && (
            <button
              type="button"
              onClick={onResetDefault}
              className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800/80 px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
              title="기본 필터 설정으로 초기화합니다"
            >
              <span>🔄</span> 초기화
            </button>
          )}
        </div>
      )}
    </div>
  );
});
