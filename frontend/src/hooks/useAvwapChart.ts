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

export const useStockSearch = (query: string) => {
  return useQuery<StockSearchResult[]>({
    queryKey: ["stockSearch", query],
    queryFn: () => api.searchStocks(query),
    enabled: !!query && query.trim().length >= 1,
    staleTime: 5 * 60 * 1000,
  });
};
