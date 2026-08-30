import { useQuery } from "@tanstack/react-query";
import {
  api,
  type SupplyDemandResponse,
  type SupplyDemandPriceProfileResponse,
} from "@/lib/api";

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

export interface PriceProfileParams {
  preset?: string;
  start?: string;
  end?: string;
  bins?: number;
}

/** 수급별 매물대 데이터 (기본 1y) */
export const useSupplyDemandPriceProfile = (
  code: string | null | undefined,
  params?: PriceProfileParams,
  enabled: boolean = true
) => {
  const preset = params?.preset ?? "1y";
  const start = params?.start ?? "";
  const end = params?.end ?? "";
  const bins = params?.bins ?? 7;

  return useQuery<SupplyDemandPriceProfileResponse>({
    queryKey: ["supplyDemandPriceProfile", code || "", preset, start, end, bins],
    queryFn: () =>
      api.getSupplyDemandPriceProfile(code!, { preset, start, end, bins }),
    enabled: enabled && !!code,
    staleTime: 2 * 60 * 1000,
  });
};

