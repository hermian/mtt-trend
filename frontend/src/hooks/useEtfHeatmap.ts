import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { HeatmapData } from "@/app/etf/heatmap/_lib/types";

export const fetchEtfHeatmap = async (market: string): Promise<HeatmapData> => {
  const res = await apiClient.get<HeatmapData>(`/api/etf/heatmap?market=${market}`);
  if (res.data && Array.isArray(res.data.indexes) && Array.isArray(res.data.groups)) {
    return res.data;
  }
  throw new Error("올바르지 않은 데이터 형식입니다.");
};

export const useEtfHeatmap = (market: "KR" | "US" | "GLOBAL") => {
  return useQuery<HeatmapData>({
    queryKey: ["etfHeatmap", market],
    queryFn: () => fetchEtfHeatmap(market),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};
