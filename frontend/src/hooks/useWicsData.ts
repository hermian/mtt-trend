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
