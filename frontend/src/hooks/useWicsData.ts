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
