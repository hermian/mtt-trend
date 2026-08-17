import { useQuery } from "@tanstack/react-query";
import {
  api,
  ReturnComparisonItem,
  ReturnComparisonRequest,
  ReturnComparisonResponse,
} from "@/lib/api";

export const useReturnComparison = (
  items: ReturnComparisonItem[],
  startDate?: string | null,
  endDate?: string | null,
  enabled: boolean = true
) => {
  const req: ReturnComparisonRequest = {
    items,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };

  const itemKeys = items.map((i) => `${i.code}:${i.type || ""}:${i.market || ""}`).join(",");

  return useQuery<ReturnComparisonResponse>({
    queryKey: ["returnComparison", itemKeys, startDate || "", endDate || ""],
    queryFn: () => api.compareReturns(req),
    enabled: enabled && items.length > 0,
    staleTime: 60 * 1000,
  });
};
