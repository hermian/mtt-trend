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
    ],
    categoryLabels: {
      "테마-에너지소재": "에너지소재",
      "테마-소재2": "소재2",
      "테마-산업재": "산업재",
      "테마-경기소비재": "경기소비재",
      "테마-정보기술": "정보기술",
      "테마-커뮤니케이션": "커뮤니케이션",
    },
  },
  {
    id: "group",
    title: "그룹주",
    column: "right",
    categories: ["그룹주"],
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
