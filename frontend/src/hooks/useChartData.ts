import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useChartData = (
  symbol: string,
  indicators?: string,
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: ["chartData", symbol, indicators, startDate, endDate],
    queryFn: () => api.getChartData(symbol, indicators, startDate, endDate),
    enabled: !!symbol,
  });
};
