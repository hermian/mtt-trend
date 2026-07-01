import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useAboveMaData = (
  market: string,
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: ["aboveMaData", market, startDate, endDate],
    queryFn: () => api.getAboveMaData(market, startDate, endDate),
    enabled: !!market,
    refetchInterval: 60 * 1000, // Auto-refresh every 1 minute
  });
};
