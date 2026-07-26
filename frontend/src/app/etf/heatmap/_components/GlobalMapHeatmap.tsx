"use client";

import { HeatmapCell } from "./HeatmapCell";
import type { HeatmapData, ETFItem, PeriodKey } from "../_lib/types";

// Absolute coordinates mapped on a 1100x600 grid wrapper
export const GLOBAL_COORDINATES: Record<string, { top: string; left: string }> = {
  // North America
  BBCA: { top: "33%", left: "17%" }, // Canada
  QQQ: { top: "40%", left: "10%" },  // US Tech
  SPY: { top: "40%", left: "22%" },  // US
  EWW: { top: "48%", left: "17%" },  // Mexico

  // South America
  EPU: { top: "62%", left: "23%" },  // Peru
  ECH: { top: "71%", left: "23%" },  // Chile
  EWZ: { top: "64%", left: "33%" },  // Brazil
  ILF: { top: "78%", left: "33%" },  // Latin America

  // Europe & Middle East
  VGK: { top: "27%", left: "33%" },  // Eurozone
  EWU: { top: "34%", left: "38%" },  // UK
  EWN: { top: "34%", left: "44%" },  // Netherlands
  EWG: { top: "34%", left: "50%" },  // Germany
  EPOL: { top: "34%", left: "56%" }, // Poland
  EDEN: { top: "27%", left: "44%" }, // Denmark
  EWD: { top: "27%", left: "50%" },  // Sweden
  EWQ: { top: "41%", left: "38%" },  // France
  EWL: { top: "41%", left: "44%" },  // Switzerland
  EWP: { top: "48%", left: "38%" },  // Spain
  EWI: { top: "48%", left: "44%" },  // Italy
  EIS: { top: "48%", left: "50%" },  // Israel
  KSA: { top: "48%", left: "56%" },  // Saudi Arabia

  // Africa
  AFK: { top: "63%", left: "44%" },  // Africa
  EZA: { top: "71%", left: "50%" },  // South Africa

  // Asia & Oceania
  ASHR: { top: "34%", left: "69%" }, // China A
  MCHI: { top: "34%", left: "75%" }, // China
  EWY: { top: "41%", left: "81%" },  // Korea
  EWJ: { top: "41%", left: "87%" },  // Japan
  VPL: { top: "27%", left: "87%" },  // Asia
  EWT: { top: "48%", left: "81%" },  // Taiwan
  EWH: { top: "48%", left: "75%" },  // Hong Kong
  INDA: { top: "56%", left: "63%" }, // India
  THD: { top: "56%", left: "69%" },  // Thailand
  VNM: { top: "56%", left: "75%" },  // Vietnam
  EPHE: { top: "56%", left: "87%" }, // Philippines
  EWM: { top: "63%", left: "69%" },  // Malaysia
  EIDO: { top: "63%", left: "75%" }, // Indonesia
  ASEA: { top: "77%", left: "63%" }, // ASEAN
  EWS: { top: "71%", left: "69%" },  // Singapore
  EWA: { top: "70%", left: "81%" },  // Australia
  ENZL: { top: "77%", left: "87%" }, // New Zealand
};

interface GlobalMapHeatmapProps {
  data: HeatmapData;
  period: PeriodKey;
  onHover?: (etf: ETFItem | null) => void;
}

export function GlobalMapHeatmap({ data, period, onHover }: GlobalMapHeatmapProps) {
  // Collect all ETFs from the groups
  const allEtfs = data.groups.flatMap((g) => g.etfs);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-800 bg-[#030712] p-4 scrollbar-thin">
      <div className="relative mx-auto aspect-[1100/600] w-[1000px] select-none xl:w-full">
        {/* SVG World Map Background */}
        <img
          src="/world-map.svg"
          alt="World Map Background"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-40"
        />

        {/* Absolute Overlay of ETF Cells */}
        {allEtfs.map((etf) => {
          const coords = GLOBAL_COORDINATES[etf.code];
          if (!coords) return null;

          return (
            <div
              key={etf.code}
              className="absolute w-[58px] -translate-x-1/2 -translate-y-1/2 lg:w-[64px]"
              style={{
                top: coords.top,
                left: coords.left,
              }}
            >
              <HeatmapCell
                etf={etf}
                period={period}
                label={etf.name}
                onHover={onHover}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
