import { useQuery } from "@tanstack/react-query";
import { api, type SupplyDemandResponse } from "@/lib/api";

export type SupplySumPreset = "1m" | "3m" | "6m" | "12m";

/** 종목 수급 본문 — sum 파라미터 없이 1회만 로드 (프리셋 합계는 응답에 포함) */
export const supplyDemandQueryKey = (code: string | null | undefined) =>
  ["supplyDemand", code || ""] as const;

export const useSupplyDemand = (
  code: string | null | undefined,
  enabled: boolean = true
) => {
  return useQuery<SupplyDemandResponse>({
    queryKey: supplyDemandQueryKey(code),
    queryFn: () => api.getSupplyDemand(code!),
    enabled: enabled && !!code,
    staleTime: 5 * 60 * 1000,
  });
};

/** 커스텀 기간 순매수 합계만 (소형 응답) */
export const useSupplyDemandCustomPeriodSums = (
  code: string | null | undefined,
  sumStart: string,
  sumEnd: string,
  enabled: boolean
) => {
  return useQuery({
    queryKey: ["supplyDemandPeriodSums", code || "", sumStart, sumEnd],
    queryFn: () => api.getSupplyDemandPeriodSums(code!, sumStart, sumEnd),
    enabled: enabled && !!code && !!sumStart && !!sumEnd,
    staleTime: 60 * 1000,
  });
};
