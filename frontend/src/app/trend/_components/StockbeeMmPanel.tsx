"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { api, StockbeeMmRow } from "@/lib/api";

const US_SHEET_ID = "1O6OhS7ciA8zwfycBfGPbP2fWJnR0pn2UUvFZVDP9jpE";

/** Stockbee 미국 MM 공개 시트 — 연도별 메인 gid (telegram_bot/stockbee_mm.py = 2026) */
export const STOCKBEE_MM_US_YEAR_GIDS: Record<number, number> = {
  2026: 1082103394,
  2025: 780188096,
  2024: 1146204629,
  2023: 632667710,
  2022: 1394777987,
  2021: 1981550515,
  2020: 2093835319,
  2019: 1089581064,
  2018: 280217788,
  2017: 1391207759,
  2016: 233732777,
  2015: 0,
  2014: 1622090416,
};

export function getStockbeeMmUsUrl(year: number): string {
  const gid = STOCKBEE_MM_US_YEAR_GIDS[year] ?? STOCKBEE_MM_US_YEAR_GIDS[2026];
  return `https://docs.google.com/spreadsheets/u/0/d/${US_SHEET_ID}/pubhtml/sheet?headers=false&gid=${gid}`;
}

export const STOCKBEE_MM_US_URL = getStockbeeMmUsUrl(2026);

type MarketTab = "kr" | "us";
/** "1y" = 최근 1년(한국) / 최신 연도 시트(미국) */
type Period = "1y" | number;

type CellTone =
  | "pink"
  | "lightgreen"
  | "red"
  | "green"
  | "none";

const TONE_CLASS: Record<CellTone, string> = {
  none: "",
  pink: "bg-pink-500/40 text-pink-100",
  lightgreen: "bg-emerald-500/35 text-emerald-100",
  red: "bg-red-600/55 text-red-50",
  green: "bg-green-600/55 text-green-50",
};

/** stockbee_mm_pl.style_mm_dataframe 과 동일 규칙 */
function cellTones(row: StockbeeMmRow, strongThreshold = 150): Record<string, CellTone> {
  const tones: Record<string, CellTone> = {};
  const boUp = row.bo_up ?? 0;
  const boDn = row.bo_dn ?? 0;
  const pairTone: CellTone = boDn > boUp ? "pink" : "lightgreen";
  tones.bo_up = pairTone;
  tones.bo_dn = pairTone;
  if (boDn >= strongThreshold) tones.bo_dn = "red";
  if (boUp >= strongThreshold) tones.bo_up = "green";

  const r5 = row.five_d_r;
  if (r5 != null) {
    if (r5 >= 2) tones.five_d_r = "lightgreen";
    else if (r5 <= 0.5) tones.five_d_r = "red";
  }
  const r10 = row.ten_d_r;
  if (r10 != null) {
    if (r10 >= 2) tones.ten_d_r = "lightgreen";
    else if (r10 <= 0.5) tones.ten_d_r = "red";
  }

  const qTone: CellTone =
    (row.q_dn_25p ?? 0) > (row.q_up_25p ?? 0) ? "red" : "lightgreen";
  tones.q_up_25p = qTone;
  tones.q_dn_25p = qTone;

  const mTone: CellTone =
    (row.m_dn_25p ?? 0) > (row.m_up_25p ?? 0) ? "red" : "lightgreen";
  tones.m_up_25p = mTone;
  tones.m_dn_25p = mTone;

  if ((row.m_up_50p ?? 0) >= 10) tones.m_up_50p = "red";
  if ((row.m_dn_50p ?? 0) >= 10) tones.m_dn_50p = "lightgreen";

  const d34Tone: CellTone =
    (row.d34_dn_13p ?? 0) > (row.d34_up_13p ?? 0) * 1.2 ? "red" : "lightgreen";
  tones.d34_up_13p = d34Tone;
  tones.d34_dn_13p = d34Tone;

  if ((row.t2108 ?? 0) >= 80) tones.t2108 = "red";
  else if ((row.t2108 ?? 100) <= 20) tones.t2108 = "lightgreen";

  return tones;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  return Math.round(v).toString();
}

function fmt2(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  return v.toFixed(2);
}

const COLUMNS: Array<{
  key: keyof StockbeeMmRow | "date";
  label: string;
  format: "int" | "2" | "date";
}> = [
  { key: "date", label: "Date", format: "date" },
  { key: "bo_up", label: "bo_up", format: "int" },
  { key: "bo_dn", label: "bo_dn", format: "int" },
  { key: "five_d_r", label: "5d_r", format: "2" },
  { key: "ten_d_r", label: "10d_r", format: "2" },
  { key: "q_up_25p", label: "q_up_25p", format: "int" },
  { key: "q_dn_25p", label: "q_dn_25p", format: "int" },
  { key: "m_up_25p", label: "m_up_25p", format: "int" },
  { key: "m_dn_25p", label: "m_dn_25p", format: "int" },
  { key: "m_up_50p", label: "m_up_50p", format: "int" },
  { key: "m_dn_50p", label: "m_dn_50p", format: "int" },
  { key: "d34_up_13p", label: "34d_up_13p", format: "int" },
  { key: "d34_dn_13p", label: "34d_dn_13p", format: "int" },
  { key: "t2108", label: "T2108", format: "2" },
  { key: "stock_count", label: "주식수", format: "int" },
  { key: "kospi", label: "KOSPI", format: "2" },
];

function KoreaTable({ rows }: { rows: StockbeeMmRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-12 text-center">
        데이터가 없습니다. marcap `job-stockbee --backfill` 후 일일 job이 DB를 채워야 합니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="min-w-full text-xs font-mono">
        <thead className="bg-gray-900/80 sticky top-0 z-10">
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className="px-2 py-2 text-right text-gray-400 font-semibold whitespace-nowrap border-b border-gray-800 first:text-left"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tones = cellTones(row);
            return (
              <tr key={row.date} className="border-b border-gray-800/80 hover:bg-gray-900/40">
                {COLUMNS.map((c) => {
                  const raw = row[c.key as keyof StockbeeMmRow];
                  const text =
                    c.format === "date"
                      ? String(raw ?? "-")
                      : c.format === "2"
                        ? fmt2(raw as number | null | undefined)
                        : fmtInt(raw as number | null | undefined);
                  const tone =
                    c.key === "date" ? "none" : tones[c.key] ?? "none";
                  return (
                    <td
                      key={c.key}
                      className={clsx(
                        "px-2 py-1.5 whitespace-nowrap tabular-nums",
                        c.key === "date" ? "text-left text-gray-300" : "text-right text-gray-200",
                        TONE_CLASS[tone]
                      )}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UsIframe({ year }: { year: number }) {
  const url = getStockbeeMmUsUrl(year);
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex justify-end">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-900/30"
        >
          원본 열기 ↗
        </a>
      </div>
      <iframe
        key={url}
        title={`Stockbee MM US ${year}`}
        src={url}
        className="w-full flex-1 min-h-[640px] rounded-xl border border-gray-800 bg-white"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}

const US_YEARS = Object.keys(STOCKBEE_MM_US_YEAR_GIDS)
  .map(Number)
  .sort((a, b) => b - a);

export function StockbeeMmPanel() {
  const [market, setMarket] = useState<MarketTab>("kr");
  const [period, setPeriod] = useState<Period>("1y");
  const [rows, setRows] = useState<StockbeeMmRow[]>([]);
  const [krYears, setKrYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = useMemo(() => {
    if (market === "us") return US_YEARS;
    return krYears.length > 0 ? krYears : US_YEARS;
  }, [market, krYears]);

  const usYear = useMemo(() => {
    if (typeof period === "number") return period;
    return US_YEARS[0] ?? 2026;
  }, [period]);

  useEffect(() => {
    if (market !== "kr") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const yearParam = typeof period === "number" ? period : undefined;
    api
      .getStockbeeMm({ year: yearParam })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data ?? []);
        if (res.years?.length) setKrYears(res.years);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load Stockbee MM");
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market, period]);

  // 미국 탭에서 없는 연도가 선택된 경우 최신 연도로 보정
  useEffect(() => {
    if (market !== "us") return;
    if (period === "1y") return;
    if (!STOCKBEE_MM_US_YEAR_GIDS[period]) {
      setPeriod("1y");
    }
  }, [market, period]);

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2 bg-gray-900/60 p-2 rounded-xl border border-gray-800">
          {(
            [
              { id: "kr" as const, label: "한국" },
              { id: "us" as const, label: "미국" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMarket(t.id)}
              className={clsx(
                "text-xs px-4 py-2 rounded-lg font-bold transition-all",
                market === t.id
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-semibold uppercase tracking-wide">기간</span>
          <select
            value={period === "1y" ? "1y" : String(period)}
            onChange={(e) => {
              const v = e.target.value;
              setPeriod(v === "1y" ? "1y" : Number(v));
            }}
            className="bg-gray-800 text-gray-200 text-xs border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="1y">
              {market === "kr" ? "최근 1년" : `최신 (${US_YEARS[0] ?? 2026})`}
            </option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </label>

        {market === "kr" && !loading && !error && (
          <span className="text-[11px] text-gray-500 font-mono">
            {rows.length}일
          </span>
        )}
      </div>

      {market === "kr" ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading && (
            <p className="text-sm text-gray-500 py-12 text-center">로딩 중…</p>
          )}
          {error && (
            <p className="text-sm text-red-400 py-8 text-center">{error}</p>
          )}
          {!loading && !error && <KoreaTable rows={rows} />}
        </div>
      ) : (
        <UsIframe year={usYear} />
      )}
    </div>
  );
}
