import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useForeignFlowData = (
  startDate?: string,
  endDate?: string,
  etf: boolean = false
) => {
  return useQuery({
    queryKey: ["foreignFlowData", startDate, endDate, etf],
    queryFn: () => api.getForeignFlowData(startDate, endDate, etf),
    placeholderData: keepPreviousData,
  });
};
