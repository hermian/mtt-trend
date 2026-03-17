import { apiClient, API_CONFIG } from "./apiClient";
import type { SyncResponse, SyncStatusResponse } from "@/types/sync";

// @MX:NOTE: API 기본 URL은 환경 변수 NEXT_PUBLIC_API_URL에서 로드되며, 기본값은 로컬호스트입니다.
// @MX:ANCHOR: API 객체 내보내기 (fan_in: useThemes, useStocks hooks + page.tsx)
// @MX:REASON: 이 api 객체는 애플리케이션의 모든 API 호출 진입점입니다.

// TypeScript interfaces matching backend Pydantic schemas
export interface ThemeDaily {
  date: string;
  theme_name: string;
  stock_count: number | null;
  avg_rs: number | null;
  change_sum: number | null;
  volume_sum: number | null;
}

export interface ThemeHistory {
  date: string;
  theme_name: string;
  avg_rs: number | null;
  stock_count: number | null;
  change_sum: number | null;
}

export interface PersistentStock {
  stock_name: string;
  appearance_count: number;
  avg_rs: number | null;
  themes: string[];
  // SPEC-MTT-017: 조회 윈도우 내 가장 최신 날짜 기준 등락률
  change_pct?: number | null;
  // SPEC-MTT-017: 소속 테마들의 RS변화량 평균
  theme_rs_change?: number | null;
}

export interface GroupActionStock {
  stock_name: string;
  rs_score: number | null;
  change_pct: number | null;
  theme_name: string;
  theme_rs_change: number | null;
  first_seen_date: string | null;
  status_threshold: number; // @MX:NOTE: 상태 분류 임계값 (SPEC-MTT-006)
}

export interface SurgingTheme {
  date: string;
  theme_name: string;
  avg_rs: number | null;
  avg_rs_5d: number | null;
  rs_change: number | null;
  stock_count: number | null;
}

export interface IntersectionStock {
  stock_name: string;
  rs_score_52w: number | null;
  rs_score_mtt: number | null;
  change_pct_52w: number | null;
  change_pct_mtt: number | null;
}

export interface IntersectionTheme {
  theme_name: string;
  intersection_stock_count: number;
  avg_rs_52w: number | null;
  avg_rs_mtt: number | null;
  stock_count_52w: number | null;
  stock_count_mtt: number | null;
  intersection_stocks: IntersectionStock[];
}

// @MX:NOTE: SPEC-MTT-013 테마 종목 데이터 인터페이스
export interface ThemeStock {
  stock_name: string;
  rs_score: number | null;
  change_pct: number | null;
}

// @MX:NOTE: SPEC-MTT-013 테마 종목 응답 인터페이스
export interface ThemeStocksResponse {
  theme_name: string;
  date: string;
  stocks: ThemeStock[];
}

export interface IntersectionResponse {
  date: string;
  themes: IntersectionTheme[];
}

export type DataSource = "52w_high" | "mtt";

// API functions for each endpoint
export const api = {
  // GET /api/dates → { dates: string[] }
  getDates: async (source: DataSource = "52w_high"): Promise<string[]> => {
    const { data } = await apiClient.get<{ dates: string[] }>("/api/dates", { params: { source } });
    return data.dates;
  },

  // GET /api/themes/daily?date= → { date, themes: ThemeDaily[] }
  getThemesDaily: async (date: string, source: DataSource = "52w_high"): Promise<ThemeDaily[]> => {
    const { data } = await apiClient.get<{ date: string; themes: ThemeDaily[] }>(
      "/api/themes/daily",
      { params: { date, source } }
    );
    return data.themes;
  },

  // GET /api/themes/surging?date=&threshold=10 → { date, threshold, themes: SurgingTheme[] }
  getThemesSurging: async (
    date: string,
    threshold = 10,
    source: DataSource = "52w_high"
  ): Promise<SurgingTheme[]> => {
    const { data } = await apiClient.get<{ date: string; threshold: number; themes: SurgingTheme[] }>(
      "/api/themes/surging",
      { params: { date, threshold, source } }
    );
    return data.themes;
  },

  // GET /api/themes/{name}/history?days=30 → { theme_name, days, history: ThemeHistory[] }
  getThemeHistory: async (
    name: string,
    days = 30,
    source: DataSource = "52w_high"
  ): Promise<ThemeHistory[]> => {
    const { data } = await apiClient.get<{ theme_name: string; days: number; history: ThemeHistory[] }>(
      `/api/themes/${encodeURIComponent(name)}/history`,
      { params: { days, source } }
    );
    return data.history;
  },

  // GET /api/stocks/persistent?days=5&min=3 → { days, min_appearances, stocks: PersistentStock[] }
  getStocksPersistent: async (
    days = 5,
    min = 3,
    source: DataSource = "52w_high"
  ): Promise<PersistentStock[]> => {
    const { data } = await apiClient.get<{ days: number; min_appearances: number; stocks: PersistentStock[] }>(
      "/api/stocks/persistent",
      { params: { days, min, source } }
    );
    return data.stocks;
  },

  // @MX:NOTE: SPEC-MTT-006 파라미터화: timeWindow, rsThreshold 지원
  // GET /api/stocks/group-action?date=&timeWindow=&rsThreshold= → { date, stocks: GroupActionStock[] }
  getStocksGroupAction: async (
    date: string,
    source: DataSource = "52w_high",
    timeWindow: number = 3,
    rsThreshold: number = 0
  ): Promise<GroupActionStock[]> => {
    const { data } = await apiClient.get<{ date: string; stocks: GroupActionStock[] }>(
      "/api/stocks/group-action",
      {
        params: {
          date,
          source,
          timeWindow, // @MX:NOTE: 시간 윈도우 (1-7일, 기본값 3)
          rsThreshold // @MX:NOTE: RS 임계값 (-10~20, 기본값 0)
        }
      }
    );
    return data.stocks;
  },

  // @MX:NOTE: SPEC-MTT-012 교집합 추천 API
  // GET /api/stocks/intersection?date= → { date, themes: IntersectionTheme[] }
  getIntersection: async (
    date: string | undefined = undefined,
    source: DataSource = "52w_high"
  ): Promise<IntersectionTheme[]> => {
    const { data } = await apiClient.get<IntersectionResponse>(
      "/api/stocks/intersection",
      {
        params: date ? { date, source } : { source }
      }
    );
    return data.themes;
  },

  // @MX:NOTE: SPEC-MTT-009 동기화 API
  // POST /api/sync → SyncResponse
  syncData: async (): Promise<SyncResponse> => {
    const { data } = await apiClient.post<SyncResponse>("/api/sync");
    return data;
  },

  // GET /api/sync/status → SyncStatusResponse
  getSyncStatus: async (): Promise<SyncStatusResponse> => {
    const { data } = await apiClient.get<SyncStatusResponse>("/api/sync/status");
    return data;
  },

  // @MX:NOTE: SPEC-MTT-013 테마 종목 조회 API
  // GET /api/themes/{name}/stocks?date=&source= → ThemeStocksResponse
  getThemeStocks: async (
    name: string,
    date: string,
    source: DataSource = "52w_high"
  ): Promise<ThemeStock[]> => {
    const { data } = await apiClient.get<ThemeStocksResponse>(
      `/api/themes/${encodeURIComponent(name)}/stocks`,
      {
        params: { date, source }
      }
    );
    return data.stocks;
  },
};

export { API_CONFIG };
export default apiClient;
