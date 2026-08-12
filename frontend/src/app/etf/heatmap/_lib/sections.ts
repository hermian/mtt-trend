import type { GroupItem, HeatmapSection } from "./types";

/**
 * 한국 ETF 히트맵 섹션 묶음 (스노우볼72 유사 구조).
 * category 키는 backend etf_heatmap_config 와 일치해야 한다.
 */
export const KR_SECTIONS: HeatmapSection[] = [
  // —— 좌열: 국내 → 레버리지 → 채권 → 해외/대체 ——
  {
    id: "kr-equity",
    title: "한국주식",
    column: "left",
    categories: ["대표", "스타일", "배당", "기타"],
  },
  {
    id: "leverage",
    title: "레버리지 & 인버스",
    column: "left",
    categories: ["KOSPI 200", "KOSDAQ 150"],
  },
  {
    id: "bond",
    title: "채권",
    column: "left",
    categories: ["채권", "국채 선물"],
  },
  {
    id: "overseas",
    title: "해외주식",
    column: "left",
    categories: [
      "해외대표",
      "해외스타일",
      "해외산업",
      "해외지역",
      "중국",
      "해외레버리지/인버스",
    ],
    categoryLabels: {
      해외대표: "대표",
      해외스타일: "스타일",
      해외산업: "산업",
      해외지역: "지역",
      중국: "중국",
      "해외레버리지/인버스": "미국선물 레버리지",
    },
  },
  {
    id: "overseas-bond",
    title: "해외채권",
    column: "left",
    // 단일 카테고리 — 서브라벨 없이 타일만 표시
    categories: ["해외채권"],
    categoryLabels: { 해외채권: "" },
  },
  {
    id: "alts",
    title: "대체자산",
    column: "left",
    categories: ["외환", "부동산", "원자재"],
  },
  // —— 우열: 산업별 → 테마 → 그룹주 ——
  {
    id: "sector",
    title: "산업별",
    column: "right",
    categories: [
      "대표 섹터(23종)",
      "에너지소재",
      "소재2",
      "산업재",
      "경기소비재",
      "필수소비재",
      "헬스케어",
      "금융",
      "정보기술",
      "커뮤니케이션",
    ],
  },
  {
    id: "theme",
    title: "테마",
    column: "right",
    categories: [
      "테마-에너지소재",
      "테마-소재2",
      "테마-산업재",
      "테마-경기소비재",
      "테마-정보기술",
      "테마-커뮤니케이션",
      "소부장",
    ],
    categoryLabels: {
      "테마-에너지소재": "에너지소재",
      "테마-소재2": "소재2",
      "테마-산업재": "산업재",
      "테마-경기소비재": "경기소비재",
      "테마-정보기술": "정보기술",
      "테마-커뮤니케이션": "커뮤니케이션",
      "소부장": "소부장",
    },
  },
  {
    id: "group",
    title: "그룹주",
    column: "right",
    categories: ["그룹주"],
  },
];

export const US_SECTIONS: HeatmapSection[] = [
  // —— 좌열: 미국/글로벌 주식 → 사이즈 및 스타일 → 미국배당/글로벌배당/기타 미국/기타 글로벌 → 미국채권/미국국채/회사채/TIPS → 글로벌채권 ——
  {
    id: "us-equity",
    title: "미국 및 글로벌 주식",
    column: "left",
    categories: ["US-Equity", "Global-Equity"],
    categoryLabels: {
      "US-Equity": "미국 주식",
      "Global-Equity": "글로벌 주식",
    },
  },
  {
    id: "size-style",
    title: "사이즈 및 스타일",
    column: "left",
    categories: [
      "Size-Style-Large",
      "Size-Style-Mid",
      "Size-Style-Small",
      "Size-Style-Global",
      "Size-Style-US-Small",
    ],
    categoryLabels: {
      "Size-Style-Large": "대형 가치/혼합/성장",
      "Size-Style-Mid": "중형 가치/혼합/성장",
      "Size-Style-Small": "소형 가치/혼합/성장",
      "Size-Style-Global": "글로벌 가치/혼합/성장",
      "Size-Style-US-Small": "미국 소형주",
    },
  },
  {
    id: "dividend-others",
    title: "배당 및 기타",
    column: "left",
    categories: [
      "Dividend-US",
      "Dividend-Global",
      "Dividend-Other-US",
      "Dividend-Other-Global",
    ],
    categoryLabels: {
      "Dividend-US": "미국 고배당/배당성장/캐쉬카우",
      "Dividend-Global": "선진국/신흥국 고배당",
      "Dividend-Other-US": "동일비중/펀더멘털/모멘텀 등",
      "Dividend-Other-Global": "선진국/신흥국 로우볼/퀄리티",
    },
  },
  {
    id: "bond",
    title: "채권",
    column: "left",
    categories: [
      "Bond-US-Aggregate",
      "Bond-US-Treasury",
      "Bond-US-Corporate",
      "Bond-US-TIPS",
    ],
    categoryLabels: {
      "Bond-US-Aggregate": "미국 채권 혼합/단기/중기/장기",
      "Bond-US-Treasury": "미국 국채 혼합/단기/중기/장기",
      "Bond-US-Corporate": "미국 회사채 혼합/단기/중기/장기",
      "Bond-US-TIPS": "물가연동/MBS",
    },
  },
  {
    id: "global-bond",
    title: "글로벌 채권",
    column: "left",
    categories: ["Bond-Global"],
    categoryLabels: {
      "Bond-Global": "글로벌/선진국/신흥국대표채/하이일드",
    },
  },
  // —— 우열: 산업별 → 대체자산 및 원자재 ——
  {
    id: "sector",
    title: "산업별",
    column: "right",
    categories: [
      "Sector-Energy",
      "Sector-Materials",
      "Sector-Industrials",
      "Sector-Discretionary",
      "Sector-Staples",
      "Sector-Healthcare",
      "Sector-Financials",
      "Sector-Tech",
      "Sector-Telecom",
      "Sector-Utilities",
    ],
    categoryLabels: {
      "Sector-Energy": "에너지",
      "Sector-Materials": "소재",
      "Sector-Industrials": "산업재",
      "Sector-Discretionary": "경기소비재",
      "Sector-Staples": "필수소비재",
      "Sector-Healthcare": "헬스케어",
      "Sector-Financials": "금융",
      "Sector-Tech": "정보기술 (IT)",
      "Sector-Telecom": "커뮤니케이션",
      "Sector-Utilities": "유틸리티",
    },
  },
  {
    id: "alts",
    title: "대체자산 및 원자재",
    column: "right",
    categories: ["Commodities", "REITs", "Crypto"],
    categoryLabels: {
      Commodities: "원자재/금/은/원유 등",
      REITs: "부동산 (리츠)",
      Crypto: "가상 자산",
    },
  },
  // —— 하단: 레버리지 & 인버스 ——
  {
    id: "leverage",
    title: "레버리지 & 인버스",
    column: "bottom",
    gridCols: 6,
    categories: [
      "Leverage-SPY",
      "Leverage-QQQ",
      "Leverage-DIA",
      "Leverage-IWM",
      "Leverage-TLT",
      "Leverage-IEF",
    ],
    categoryLabels: {
      "Leverage-SPY": "S&P 500",
      "Leverage-QQQ": "NASDAQ 100",
      "Leverage-DIA": "DOW JONES",
      "Leverage-IWM": "RUSSELL 2000",
      "Leverage-TLT": "미국채 (장기)",
      "Leverage-IEF": "미국채 (중기)",
    },
  },
];

export function buildSectionGroups(
  groups: GroupItem[],
  section: HeatmapSection
): { label: string; category: string; etfs: GroupItem["etfs"] }[] {
  const byCategory = new Map(groups.map((g) => [g.category, g]));
  return section.categories
    .map((category) => {
      const group = byCategory.get(category);
      if (!group || group.etfs.length === 0) return null;
      return {
        category,
        label: section.categoryLabels?.[category] ?? category,
        etfs: group.etfs,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
}
