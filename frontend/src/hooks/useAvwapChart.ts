import { useQuery } from "@tanstack/react-query";
import { api, AvwapChartResponse, StockSearchResult } from "@/lib/api";

export const useAvwapChart = (
  market: string = "kospi",
  interval: string = "1D",
  symbol?: string | null
) => {
  return useQuery<AvwapChartResponse>({
    queryKey: ["avwapChart", market, interval, symbol || ""],
    queryFn: () => api.getAvwapChartData(market, interval, symbol),
    staleTime: 60 * 1000,
  });
};

export const useStockSearch = (
  query: string,
  type: "stock" | "etf" | "all" = "stock"
) => {
  return useQuery<StockSearchResult[]>({
    queryKey: ["stockSearch", query, type],
    queryFn: () => api.searchStocks(query, type),
    enabled: !!query && query.trim().length >= 1,
    staleTime: 5 * 60 * 1000,
  });
};

