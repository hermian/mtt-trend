export interface ReturnData {
  "1D": number | null;
  "1W": number | null;
  MTD: number | null;
  YTD: number | null;
  "3M": number | null;
  "6M": number | null;
  "1Y": number | null;
  "3Y": number | null;
  "5Y": number | null;
}

export interface ETFItem {
  code: string;
  name: string;
  /** 네이버 worldstock 종목 코드(예: QQQ.O, SCHD.K). 없으면 code 사용. */
  url?: string;
  /** 업종/섹터명 (대표 23종 섹터 ETF용) */
  sector?: string;
  /** 시가총액 (억원 단위) */
  marcap?: number;
  returns: ReturnData;
}

export interface GroupItem {
  category: string;
  etfs: ETFItem[];
}

export interface HeatmapData {
  market: string;
  as_of_date: string;
  indexes: ETFItem[];
  groups: GroupItem[];
}

export const PERIODS = [
  { key: "1D", label: "1일" },
  { key: "1W", label: "1주" },
  { key: "MTD", label: "이달" },
  { key: "YTD", label: "올해" },
  { key: "3M", label: "3개월" },
  { key: "6M", label: "6개월" },
  { key: "1Y", label: "1년" },
  { key: "3Y", label: "3년" },
  { key: "5Y", label: "5년" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export interface HeatmapSection {
  id: string;
  title: string;
  /** API group.category 키 목록 (표시 라벨은 categoryLabels로 덮어쓸 수 있음) */
  categories: string[];
  /** category 키 → 화면 표시명 */
  categoryLabels?: Record<string, string>;
  /** 데스크톱 2열 레이아웃 위치 */
  column?: "left" | "right" | "bottom";
  /** 그리드 열 개수 (기본값: 5) */
  gridCols?: number;
}
