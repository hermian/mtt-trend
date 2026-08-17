"use client";

import { useQuery } from "@tanstack/react-query";
import { api, API_CONFIG, Top30Response, Top30DatesResponse, Top30MatrixResponse } from "@/lib/api";

// @MX:ANCHOR: 시총 TOP 30 데이터 훅 (fan_in: MarketCapTop30Panel)
// @MX:REASON: 차트/표 뷰가 동일 페이로드를 공유하도록 단일 쿼리로 제공.

// 시가총액 상위 30 랭킹 + 순위 변동/신규 진입 (단일 기준일)
export function useTop30(
  date: string | null,
  market: string,
  compareDays: number
) {
  return useQuery<Top30Response>({
    queryKey: ["top30", date, market, compareDays],
    queryFn: () => api.getTop30(date, market, compareDays),
    enabled: !!date,
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}

// 시가총액 상위 30 멀티 데이트/기간 매트릭스 랭킹 (WICS 랭킹 스타일)
export function useTop30Matrix(
  startDate?: string | null,
  endDate?: string | null,
  market: string = "all",
  timeframe: string = "daily",
  limit: number = 30
) {
  return useQuery<Top30MatrixResponse>({
    queryKey: ["top30", "matrix", startDate, endDate, market, timeframe, limit],
    queryFn: () => api.getTop30Matrix(startDate, endDate, market, timeframe, limit),
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}


// 조회 가능한 거래일/기간 목록 (날짜 선택기용)
export function useTop30Dates(timeframe: string = "daily") {
  return useQuery<Top30DatesResponse>({
    queryKey: ["top30", "dates", timeframe],
    queryFn: () => api.getTop30Dates(timeframe),
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}