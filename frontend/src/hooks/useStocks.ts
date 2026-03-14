"use client";

import { useQuery } from "@tanstack/react-query";
import { api, API_CONFIG, PersistentStock, GroupActionStock, DataSource } from "@/lib/api";

// @MX:NOTE: 모든 훅은 API_CONFIG.DEFAULT_STALE_TIME을 사용하여 불필요한 재요청을 방지합니다.
// @MX:ANCHOR: 종목 관련 React Query 훅 (fan_in: StockAnalysisTabs, page.tsx)
// @MX:REASON: 이 훅들은 종목 데이터를 가져오는 주요 진입점입니다.

// Hook for fetching persistent strong stocks
export function useStocksPersistent(days = 5, min = 3, source: DataSource = "52w_high") {
  return useQuery<PersistentStock[]>({
    queryKey: ["stocks", "persistent", days, min, source],
    queryFn: () => api.getStocksPersistent(days, min, source),
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}

// Hook for fetching group action detection stocks
export function useStocksGroupAction(date: string | null, source: DataSource = "52w_high") {
  return useQuery<GroupActionStock[]>({
    queryKey: ["stocks", "group-action", date, source],
    queryFn: () => api.getStocksGroupAction(date!, source),
    enabled: !!date,
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}
