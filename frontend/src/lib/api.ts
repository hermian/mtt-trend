import axios from "axios";

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

// Axios instance with base URL from env
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 10000,
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

  // GET /api/stocks/group-action?date= → { date, stocks: GroupActionStock[] }
  getStocksGroupAction: async (date: string, source: DataSource = "52w_high"): Promise<GroupActionStock[]> => {
    const { data } = await apiClient.get<{ date: string; stocks: GroupActionStock[] }>(
      "/api/stocks/group-action",
      { params: { date, source } }
    );
    return data.stocks;
  },
};

export default apiClient;
