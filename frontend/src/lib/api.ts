import axios from "axios";

// @MX:NOTE: API 기본 URL은 환경 변수 NEXT_PUBLIC_API_URL에서 로드되며, 기본값은 로컬호스트입니다.
// @MX:ANCHOR: API 클라이언트 설정 (fan_in: 모든 API 함수)
// @MX:REASON: 이 설정은 모든 API 호출의 기반이 되는 중앙 집중식 구성점입니다.

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

export type DataSource = "52w_high" | "mtt";

// API 기본 설정 상수
const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  TIMEOUT: 10000,
  DEFAULT_STALE_TIME: 5 * 60 * 1000, // 5분
} as const;

// Axios instance with base URL from env
// @MX:ANCHOR: API 객체 내보내기 (fan_in: useThemes, useStocks hooks + page.tsx)
// @MX:REASON: 이 api 객체는 애플리케이션의 모든 API 호출 진입점입니다.
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

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
};

// 설정을 내보내어 훅에서 재사용 가능하게 함
export { API_CONFIG };

export default apiClient;
