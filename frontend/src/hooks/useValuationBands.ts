import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api, type ValuationIndex, type ValuationMode } from "@/lib/api";

export const useValuationBands = (
  index: ValuationIndex | string,
  mode: ValuationMode | string,
  startDate?: string,
  endDate?: string,
  multiples?: string
) => {
  return useQuery({
    queryKey: ["valuationBands", index, mode, startDate, endDate, multiples],
    queryFn: () =>
      api.getValuationBands({
        index,
        mode,
        startDate,
        endDate,
        multiples,
      }),
    placeholderData: keepPreviousData,
  });
};
