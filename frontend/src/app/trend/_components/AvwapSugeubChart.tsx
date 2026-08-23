"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDebounce } from "@/hooks/useDebounce";
import { useStockSearch } from "@/hooks/useAvwapChart";
import {
  useSupplyDemand,
  useSupplyDemandCustomPeriodSums,
  type SupplySumPreset,
} from "@/hooks/useSupplyDemand";
import type { StockSearchResult } from "@/lib/api";
import { AvwapSugeubPanel } from "./AvwapSugeubPanel";
import { buildTrendTabHref, syncTrendStockUrl } from "@/app/_lib/trendTabHref";

export function AvwapSugeubChart() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const paramSymbol = searchParams?.get("symbol") || null;
  const paramName = searchParams?.get("name") || null;

  const [symbol, setSymbol] = useState<string | null>(paramSymbol);
  const [searchQuery, setSearchQuery] = useState(
    paramSymbol ? (paramName ? `${paramName} (${paramSymbol})` : paramSymbol) : ""
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  const [sumPreset, setSumPreset] = useState<SupplySumPreset>("3m");
  const [customSumStart, setCustomSumStart] = useState("");
  const [customSumEnd, setCustomSumEnd] = useState("");
  const [appliedCustomSum, setAppliedCustomSum] = useState<{ start: string; end: string } | null>(
    null
  );

  useEffect(() => {
    setSymbol(paramSymbol);
    setSearchQuery(
      paramSymbol ? (paramName ? `${paramName} (${paramSymbol})` : paramSymbol) : ""
    );
  }, [paramSymbol, paramName]);

  const debouncedSearchQuery = useDebounce(searchQuery, 150);
  const { data: searchResults, isLoading: isSearching } = useStockSearch(
    debouncedSearchQuery,
    "stock",
    "kr"
  );

  const { data, isLoading, error } = useSupplyDemand(symbol, !!symbol);

  const { data: customPeriodData, isFetching: isCustomPeriodFetching } =
    useSupplyDemandCustomPeriodSums(
      symbol,
      appliedCustomSum?.start ?? "",
      appliedCustomSum?.end ?? "",
      !!appliedCustomSum
    );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectStock = (stock: StockSearchResult) => {
    isSelectingRef.current = true;
    setSymbol(stock.code);
    setSearchQuery(`${stock.name} (${stock.code})`);
    setShowDropdown(false);
    setSelectedIndex(-1);
    setSumPreset("3m");
    setAppliedCustomSum(null);
    setCustomSumStart("");
    setCustomSumEnd("");
    syncTrendStockUrl(router, searchParams, "avwap_sugeub", {
      code: stock.code,
      name: stock.name,
      type: "stock",
      country: "kr",
    });
    searchInputRef.current?.blur();
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 150);
  };

  const periodSumsBundle = useMemo(() => {
    if (!data) return null;
    if (appliedCustomSum && customPeriodData) {
      return {
        period_sums: customPeriodData.period_sums,
        sum_period: customPeriodData.sum_period,
      };
    }
    const preset = data.period_sums_by_preset?.[sumPreset];
    if (preset) return preset;
    return { period_sums: data.period_sums, sum_period: data.sum_period };
  }, [data, sumPreset, appliedCustomSum, customPeriodData]);

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] text-gray-900 select-none">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-sm font-bold text-gray-800 whitespace-nowrap">AVWAP 수급</h1>
          <div className="relative">
            <div className="flex items-center bg-white border border-gray-300 focus-within:border-blue-500 rounded px-2.5 py-1.5 text-sm min-w-[320px] shadow-sm">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="종목코드 또는 종목명 (예: GS, 078930, 삼성전자)"
                value={searchQuery}
                onChange={(e) => {
                  if (isSelectingRef.current) return;
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  setSelectedIndex(-1);
                }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchResults?.length) {
                    e.preventDefault();
                    const target =
                      selectedIndex >= 0 ? searchResults[selectedIndex] : searchResults[0];
                    handleSelectStock(target);
                  }
                }}
                className="bg-transparent outline-none flex-1 text-gray-900 placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (searchResults?.[0]) handleSelectStock(searchResults[0]);
                }}
                className="ml-2 px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                분석
              </button>
            </div>
            {showDropdown && debouncedSearchQuery.trim().length >= 1 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg z-50"
              >
                {isSearching ? (
                  <div className="px-3 py-2 text-xs text-gray-500">검색 중...</div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((item, idx) => (
                    <button
                      key={item.code}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectStock(item)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${
                        idx === selectedIndex ? "bg-blue-50" : ""
                      }`}
                    >
                      <span className="text-gray-800">{item.name}</span>
                      <span className="text-gray-500 ml-2 font-mono">{item.code}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-gray-500">검색 결과 없음</div>
                )}
              </div>
            )}
          </div>
        </div>
        <Link
          href={buildTrendTabHref("avwap", searchParams)}
          className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded bg-blue-50"
        >
          AVWAP 차트 →
        </Link>
      </div>

      <AvwapSugeubPanel
        symbol={symbol}
        data={data}
        isLoading={isLoading}
        error={error}
        periodSums={periodSumsBundle?.period_sums}
        sumPeriod={periodSumsBundle?.sum_period}
        isPeriodSumsLoading={!!appliedCustomSum && isCustomPeriodFetching && !customPeriodData}
        sumPreset={sumPreset}
        customSumApplied={!!appliedCustomSum}
        onSumPresetChange={(preset) => {
          setSumPreset(preset);
          setAppliedCustomSum(null);
          setCustomSumStart("");
          setCustomSumEnd("");
        }}
        customSumStart={customSumStart}
        customSumEnd={customSumEnd}
        onCustomSumStartChange={setCustomSumStart}
        onCustomSumEndChange={setCustomSumEnd}
        onApplyCustomSum={() => {
          if (customSumStart && customSumEnd) {
            setAppliedCustomSum({ start: customSumStart, end: customSumEnd });
          }
        }}
      />
    </div>
  );
}

export default AvwapSugeubChart;
