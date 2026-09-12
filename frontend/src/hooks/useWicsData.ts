import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useWicsMonths = () => {
  return useQuery({
    queryKey: ["wicsMonths"],
    queryFn: () => api.getWicsMonths(),
  });
};

export const useWicsRankings = (startMonth?: string, endMonth?: string) => {
  return useQuery({
    queryKey: ["wicsRankings", startMonth, endMonth],
    queryFn: () => api.getWicsRankings(startMonth, endMonth),
    // 구간이 정해지기 전에는 호출하지 않는다. WicsRankingPanel 의 startMonth/endMonth 는
    // months 로딩 후에 설정되므로, 가드가 없으면 마운트 시점에 파라미터 없이 호출되어
    // 전체 이력(15.6MB)을 받아온 뒤 버린다.
    enabled: !!startMonth && !!endMonth,
  });
};

export const useWicsWeeks = () => {
  return useQuery({
    queryKey: ["wicsWeeks"],
    queryFn: () => api.getWicsWeeks(),
  });
};

export const useWicsWeeklyRankings = (startWeek?: string, endWeek?: string) => {
  return useQuery({
    queryKey: ["wicsWeeklyRankings", startWeek, endWeek],
    queryFn: () => api.getWicsWeeklyRankings(startWeek, endWeek),
    // 주간도 동일: weeks 로딩 전 파라미터 없는 호출을 막는다.
    enabled: !!startWeek && !!endWeek,
  });
};

export const useWicsIndex = (
  wics: string | null,
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: ["wicsIndex", wics, startDate, endDate],
    queryFn: () => api.getWicsIndex(wics!, startDate, endDate),
    enabled: !!wics,
  });
};

export const useWicsIndexAll = (opts: {
  tf: string;
  weight: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ["wicsIndexAll", opts.tf, opts.weight, opts.startDate, opts.endDate],
    queryFn: () =>
      api.getWicsIndexAll({
        tf: opts.tf,
        weight: opts.weight,
        startDate: opts.startDate,
        endDate: opts.endDate,
      }),
    enabled: opts.enabled !== false,
  });
};

export const useWicsIndexMeta = () => {
  return useQuery({
    queryKey: ["wicsIndexMeta"],
    queryFn: () => api.getWicsIndexMeta(),
  });
};
