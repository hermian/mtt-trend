import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useMarketFlowData = (
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: ["marketFlowData", startDate, endDate],
    queryFn: () => api.getMarketFlowData(startDate, endDate),
    placeholderData: keepPreviousData,
    enabled: !!startDate,
    refetchInterval: 60 * 1000, // 1분마다 자동 갱신
  });
};

export const useMarketFlowDates = () => {
  return useQuery({
    queryKey: ["marketFlowDates"],
    queryFn: () => api.getMarketFlowDates(),
    refetchInterval: 60 * 1000,
  });
};
