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
  });
};

export const useMarketFlowDates = () => {
  return useQuery({
    queryKey: ["marketFlowDates"],
    queryFn: () => api.getMarketFlowDates(),
  });
};
