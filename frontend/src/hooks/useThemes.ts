"use client";

import { useQuery } from "@tanstack/react-query";
import { api, API_CONFIG, ThemeDaily, ThemeHistory, SurgingTheme, ThemeStock, DataSource } from "@/lib/api";

// @MX:NOTE: 모든 훅은 API_CONFIG.DEFAULT_STALE_TIME을 사용하여 불필요한 재요청을 방지합니다.
// @MX:ANCHOR: 테마 관련 React Query 훅 (fan_in: TopThemesBar, ThemeTrendChart, page.tsx)
// @MX:REASON: 이 훅들은 테마 데이터를 가져오는 주요 진입점입니다.

// Hook for fetching available dates
export function useDates(source: DataSource = "52w_high") {
  return useQuery<string[]>({
    queryKey: ["dates", source],
    queryFn: () => api.getDates(source),
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}

// Hook for fetching daily themes for a specific date
export function useThemesDaily(date: string | null, source: DataSource = "52w_high") {
  return useQuery<ThemeDaily[]>({
    queryKey: ["themes", "daily", date, source],
    queryFn: () => api.getThemesDaily(date!, source),
    enabled: !!date,
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}

// Hook for fetching surging themes
export function useThemesSurging(date: string | null, threshold = 10, source: DataSource = "52w_high") {
  return useQuery<SurgingTheme[]>({
    queryKey: ["themes", "surging", date, threshold, source],
    queryFn: () => api.getThemesSurging(date!, threshold, source),
    enabled: !!date,
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}

// Hook for fetching theme history (single theme)
export function useThemeHistory(themeName: string, days = 30, source: DataSource = "52w_high") {
  return useQuery<ThemeHistory[]>({
    queryKey: ["themes", "history", themeName, days, source],
    queryFn: () => api.getThemeHistory(themeName, days, source),
    enabled: !!themeName,
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}

// Hook for fetching multiple theme histories simultaneously
export function useMultipleThemeHistories(themeNames: string[], days = 30, source: DataSource = "52w_high") {
  return useQuery<{ [key: string]: ThemeHistory[] }>({
    queryKey: ["themes", "histories", themeNames, days, source],
    queryFn: async () => {
      const results = await Promise.all(
        themeNames.map((name) => api.getThemeHistory(name, days, source))
      );
      return themeNames.reduce(
        (acc, name, index) => {
          acc[name] = results[index];
          return acc;
        },
        {} as { [key: string]: ThemeHistory[] }
      );
    },
    enabled: themeNames.length > 0,
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}

// @MX:NOTE: SPEC-MTT-013 테마 종목 조회 Hook
// Hook for fetching theme stocks
export function useThemeStocks(themeName: string, date: string | null, source: DataSource = "52w_high") {
  return useQuery<ThemeStock[]>({
    queryKey: ["themes", "stocks", themeName, date, source],
    queryFn: () => api.getThemeStocks(themeName, date!, source),
    enabled: !!themeName && !!date,
    staleTime: API_CONFIG.DEFAULT_STALE_TIME,
  });
}
