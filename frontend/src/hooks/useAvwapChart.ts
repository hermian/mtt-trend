import { useQuery } from "@tanstack/react-query";
import { api, AvwapChartResponse } from "@/lib/api";

export const useAvwapChart = (
  market: string = "kospi",
  interval: string = "1D"
) => {
  return useQuery<AvwapChartResponse>({
    queryKey: ["avwapChart", market, interval],
    queryFn: () => api.getAvwapChartData(market, interval),
    staleTime: 60 * 1000,
  });
};
