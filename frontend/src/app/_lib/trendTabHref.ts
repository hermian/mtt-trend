import type { ReadonlyURLSearchParams } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export interface TrendStockContext {
  code: string;
  name: string;
  type: "stock" | "etf";
  country: "kr" | "us";
}

/** 사이드바 탭 전환 시 symbol/name 등 종목 컨텍스트 유지 */
export function buildTrendTabHref(
  tab: string,
  searchParams: ReadonlyURLSearchParams | null
): string {
  const params = new URLSearchParams({ tab });
  if (searchParams) {
    for (const key of ["symbol", "name", "type", "country", "market"] as const) {
      const v = searchParams.get(key);
      if (v) params.set(key, v);
    }
  }
  return `/trend?${params.toString()}`;
}

/** AVWAP ↔ AVWAP 수급 탭 간 종목 URL 동기화 */
export function syncTrendStockUrl(
  router: AppRouterInstance,
  searchParams: ReadonlyURLSearchParams | null,
  tab: string,
  stock: TrendStockContext | null
): void {
  const params = new URLSearchParams(searchParams?.toString() || "");
  params.set("tab", tab);
  if (stock) {
    params.set("symbol", stock.code);
    params.set("name", stock.name);
    params.set("type", stock.type);
    params.set("country", stock.country);
  } else {
    params.delete("symbol");
    params.delete("name");
    params.delete("type");
    params.delete("country");
  }
  router.replace(`/trend?${params.toString()}`, { scroll: false });
}

export function stockContextFromResult(
  stock: { code: string; name: string; market: string },
  searchType: "stock" | "etf",
  searchCountry: "kr" | "us"
): TrendStockContext {
  const isEtf =
    stock.market === "ETF" ||
    stock.market === "US_ETF" ||
    searchType === "etf";
  const isUs =
    stock.market === "US_ETF" ||
    stock.market === "US" ||
    stock.market === "NASDAQ" ||
    stock.market === "NYSE" ||
    stock.market === "AMEX" ||
    searchCountry === "us";
  return {
    code: stock.code,
    name: stock.name,
    type: isEtf ? "etf" : "stock",
    country: isUs ? "us" : "kr",
  };
}
