"use client";

import { buildSectionGroups } from "../_lib/sections";
import type { ETFItem, GroupItem, HeatmapSection, PeriodKey } from "../_lib/types";
import { HeatmapGroup } from "./HeatmapGroup";

interface HeatmapSectionBlockProps {
  section: HeatmapSection;
  groups: GroupItem[];
  period: PeriodKey;
  onHover?: (etf: ETFItem | null) => void;
}

export function HeatmapSectionBlock({
  section,
  groups,
  period,
  onHover,
}: HeatmapSectionBlockProps) {
  const items = buildSectionGroups(groups, section);
  if (items.length === 0) return null;

  return (
    <section className="border-b border-gray-800 py-3 last:border-b-0">
      <header className="mb-2 text-center">
        <h2 className="text-sm font-bold text-gray-100">{section.title}</h2>
      </header>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <HeatmapGroup
            key={item.category}
            label={item.label}
            etfs={item.etfs}
            period={period}
            onHover={onHover}
          />
        ))}
      </div>
    </section>
  );
}
