"use client";

import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { useTop30, useTop30Dates } from "@/hooks/useTop30";
import { Top30Stock } from "@/lib/api";
import { StockNameLink } from "@/components/StockNameLink";

const MARKETS = [
  { id: "all", label: "전체" },
  { id: "kospi", label: "KOSPI" },
  { id: "kosdaq", label: "KOSDAQ" },
] as const;

const COMPARE_DAYS = [1, 5, 20, 60] as const;

const MOVE_THRESHOLD = 5; // 순위 5단계 이상 상승 = '큰 상승' (스펙 round 8)

function formatMarcap(marcap: number | null): string {
  if (marcap == null) return "-";
  const jo = marcap / 10; // 천억원 → 조원
  return `${jo.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조`;
}

function isMover(s: Top30Stock): boolean {
  return s.new_entrant || (s.rank_delta != null && s.rank_delta >= MOVE_THRESHOLD);
}

function isDrop(s: Top30Stock): boolean {
  return s.rank_delta != null && s.rank_delta <= -MOVE_THRESHOLD;
}

export function MarketCapTop30Panel() {
  const { data: datesData } = useTop30Dates();
  const dates = datesData?.dates ?? [];

  // 기준일: 가능일 목록의 최근일 기본값
  const [date, setDate] = useState<string | undefined>(() => dates[dates.length - 1]);
  const resolvedDate = date ?? dates[dates.length - 1];

  const [market, setMarket] = useState<"all" | "kospi" | "kosdaq">("all");
  const [compareDays, setCompareDays] = useState<number>(5);
  const [view, setView] = useState<"chart" | "table">("chart");

  const { data, isLoading, error } = useTop30(resolvedDate ?? null, market, compareDays);

  const chartData = useMemo(() => {
    if (!data || !data.stocks.length) return [];
    return (data.window_dates ?? []).map((d, i) => {
      const point: Record<string, string | number | null> = { date: d };
      for (const s of data.stocks) point[s.code] = s.series[i] ?? null;
      return point;
    });
  }, [data]);

  return (
    <div className="w-full h-full flex flex-col px-3 md:px-6 pr-[20px] md:pr-6">
      {/* Header + Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-2xl font-extrabold text-white tracking-tight">시총 TOP 30 추적</h3>
          <p className="text-gray-400 text-sm mt-1">
            기준일 대비 신규 진입·순위 변동 추적 (비교 기간 {compareDays}거래일)
            {!data?.compare_available && data && (
              <span className="ml-2 text-amber-400">— 비교 데이터 없음(순위변동 정보 없음)</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            기준일
            <select
              value={resolvedDate ?? ""}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-800 text-xs border border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              {dates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            시장
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as typeof market)}
              className="bg-gray-800 text-xs border border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              {MARKETS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            비교 기간
            <select
              value={compareDays}
              onChange={(e) => setCompareDays(Number(e.target.value))}
              className="bg-gray-800 text-xs border border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              {COMPARE_DAYS.map((c) => (
                <option key={c} value={c}>{c}거래일</option>
              ))}
            </select>
          </label>

          <div className="flex bg-black/30 p-1 rounded-lg border border-gray-800">
            {(["chart", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                  view === v ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {v === "chart" ? "차트" : "표"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 mt-3">
        {isLoading && !data && (
          <div className="flex items-center justify-center h-full text-gray-400 animate-pulse text-sm">로딩 중...</div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full text-red-400 text-sm">
            데이터를 불러오지 못했습니다. (백엔드 /api/trend/top30 확인)
          </div>
        )}
        {!isLoading && !error && data && data.stocks.length === 0 && (
          <div className="flex items-center justify-center h-full text-amber-400 text-sm">
            표시할 시가총액 데이터가 없습니다. DB 동기화(DB Sync)를 확인해 주세요.
          </div>
        )}
        {data && data.stocks.length > 0 && view === "chart" && (
          <ResponsiveContainer width="100%" height="100%" minHeight={520}>
            <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} />
              <YAxis reversed domain={[1, 30]} stroke="#6b7280" tick={{ fontSize: 10 }} label={{
                value: "순위 (1=최상위)",
                angle: -90,
                position: "insideLeft",
                style: { fill: "#6b7280", fontSize: 10 },
              }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#9ca3af" }}
              />
              <Legend />
              {data.stocks.map((s) => {
                const mover = isMover(s);
                const drop = isDrop(s);
                return (
                  <Line
                    key={s.code}
                    type="stepAfter"
                    dataKey={s.code}
                    name={`#${s.rank} ${s.name}${s.new_entrant ? " (신규진입)" : ""}`}
                    stroke={
                      mover ? "#34d399" : drop ? "#f87171" : "#4b5563"
                    }
                    strokeWidth={mover ? 2.5 : 1}
                    strokeOpacity={mover ? 1 : 0.35}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
        {data && data.stocks.length > 0 && view === "table" && (
          <div className="overflow-auto h-full custom-scrollbar rounded-xl border border-gray-800">
            <table className="w-full text-sm text-gray-200">
              <thead className="sticky top-0 bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">순위</th>
                  <th className="px-3 py-2 text-left">등락</th>
                  <th className="px-3 py-2 text-left">종목</th>
                  <th className="px-3 py-2 text-left">시장</th>
                  <th className="px-3 py-2 text-right">시가총액</th>
                </tr>
              </thead>
              <tbody>
                {data.stocks.map((s) => {
                  const mover = isMover(s);
                  const drop = isDrop(s);
                  return (
                    <tr key={s.code} className={`border-b border-gray-800/60 ${mover ? "bg-emerald-900/10" : ""}`}>
                      <td className="px-3 py-2 font-mono">{s.rank}</td>
                      <td className="px-3 py-2 font-mono">
                        {s.new_entrant ? (
                          <span className="text-emerald-400 font-bold text-xs px-1.5 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50">
                            신규진입
                          </span>
                        ) : s.rank_delta != null && s.rank_delta > 0 ? (
                          <span className="text-emerald-400">▲ {s.rank_delta}</span>
                        ) : s.rank_delta != null && s.rank_delta < 0 ? (
                          <span className="text-red-400">▼ {Math.abs(s.rank_delta)}</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        <StockNameLink name={s.name} />
                        {mover && <span className="ml-2 text-[10px] text-emerald-400 font-bold">● 강조</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        {s.market === "KQ" ? "KOSDAQ" : s.market}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">{formatMarcap(s.marcap)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}