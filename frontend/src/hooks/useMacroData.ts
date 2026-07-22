import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useMacroData = (
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: ["macroData", startDate, endDate],
    queryFn: () => api.getMacroData(startDate, endDate),
    placeholderData: keepPreviousData,
  });
};
