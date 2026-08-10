import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type StockHeatmapParams, type StockHeatmapResponse } from "@/lib/api";

export const useStockHeatmap = (params: StockHeatmapParams) => {
  return useQuery<StockHeatmapResponse>({
    queryKey: [
      "stockHeatmap",
      params.grouping,
      params.period,
      params.startDate ?? null,
      params.endDate ?? null,
      params.marcapMin ?? null,
      params.marcapMax ?? null,
      params.minRet ?? null,
      params.limit,
    ],
    queryFn: () => api.getStockHeatmap(params),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};
