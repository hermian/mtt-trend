"use client";

import { useQuery } from "@tanstack/react-query";
import { api, PersistentStock, GroupActionStock, DataSource } from "@/lib/api";

// Hook for fetching persistent strong stocks
export function useStocksPersistent(days = 5, min = 3, source: DataSource = "52w_high") {
  return useQuery<PersistentStock[]>({
    queryKey: ["stocks", "persistent", days, min, source],
    queryFn: () => api.getStocksPersistent(days, min, source),
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for fetching group action detection stocks
export function useStocksGroupAction(date: string | null, source: DataSource = "52w_high") {
  return useQuery<GroupActionStock[]>({
    queryKey: ["stocks", "group-action", date, source],
    queryFn: () => api.getStocksGroupAction(date!, source),
    enabled: !!date,
    staleTime: 5 * 60 * 1000,
  });
}
