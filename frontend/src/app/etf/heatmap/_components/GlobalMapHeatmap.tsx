"use client";

import { heatColor, type ColorScale } from "@/app/heatmap/_lib/colors";
import { formatReturn } from "../_lib/colors";
import { etfLink } from "../_lib/links";
import type { HeatmapData, ETFItem, PeriodKey } from "../_lib/types";

// Absolute coordinates mapped on a 700x330 grid wrapper
// Adjusted to ensure adequate vertical gaps and prevent overlapping in dense regions
export const GLOBAL_COORDINATES: Record<string, { top: string; left: string }> = {
  // North America
  BBCA: { top: "27%", left: "21%" }, // Canada
  QQQ: { top: "40%", left: "16%" },  // US Tech
  SPY: { top: "40%", left: "26%" },  // US
  EWW: { top: "51%", left: "21%" },  // Mexico

  // South America
  EPU: { top: "64%", left: "27%" },  // Peru
  ECH: { top: "76%", left: "27%" },  // Chile
  EWZ: { top: "67%", left: "35%" },  // Brazil
  ILF: { top: "85%", left: "35%" },  // Latin America

  // Europe & Middle East
  VGK: { top: "22%", left: "33%" },  // Eurozone
  EWU: { top: "32%", left: "38%" },  // UK
  EWN: { top: "32%", left: "44%" },  // Netherlands
  EWG: { top: "32%", left: "50%" },  // Germany
  EPOL: { top: "32%", left: "56%" }, // Poland
  EDEN: { top: "22%", left: "44%" }, // Denmark
  EWD: { top: "22%", left: "50%" },  // Sweden
  EWQ: { top: "42%", left: "38%" },  // France
  EWL: { top: "42%", left: "44%" },  // Switzerland
  EWP: { top: "52%", left: "38%" },  // Spain
  EWI: { top: "52%", left: "44%" },  // Italy
  EIS: { top: "52%", left: "50%" },  // Israel
  KSA: { top: "52%", left: "56%" },  // Saudi Arabia

  // Africa
  AFK: { top: "65%", left: "44%" },  // Africa
  EZA: { top: "79%", left: "50%" },  // South Africa

  // Asia & Oceania
  ASHR: { top: "32%", left: "67%" }, // China A
  MCHI: { top: "32%", left: "73%" }, // China
  EWY: { top: "42%", left: "79%" },  // Korea
  EWJ: { top: "42%", left: "85%" },  // Japan
  VPL: { top: "22%", left: "85%" },  // Asia
  EWT: { top: "52%", left: "79%" },  // Taiwan
  EWH: { top: "52%", left: "73%" },  // Hong Kong
  INDA: { top: "62%", left: "61%" }, // India
  THD: { top: "62%", left: "67%" },  // Thailand
  VNM: { top: "62%", left: "73%" },  // Vietnam
  EPHE: { top: "62%", left: "85%" }, // Philippines
  EWM: { top: "72%", left: "67%" },  // Malaysia
  EIDO: { top: "72%", left: "73%" }, // Indonesia
  ASEA: { top: "85%", left: "61%" }, // ASEAN
  EWS: { top: "80%", left: "67%" },  // Singapore
  EWA: { top: "76%", left: "79%" },  // Australia
  ENZL: { top: "85%", left: "85%" }, // New Zealand
};

interface GlobalMapHeatmapProps {
  data: HeatmapData;
  period: PeriodKey;
  scale: ColorScale;
  onHover?: (etf: ETFItem | null) => void;
}

// Compact cell layout customized for the world map overlay to prevent vertical text wrap/overlapping
function CompactHeatmapCell({
  etf,
  period,
  scale,
  onHover,
}: {
  etf: ETFItem;
  period: PeriodKey;
  scale: ColorScale;
  onHover?: (etf: ETFItem | null) => void;
}) {
  const val = etf.returns?.[period] ?? null;
  const { fill, text } = heatColor(val, scale);

  return (
    <a
      href={etfLink(etf, "GLOBAL")}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => onHover?.(etf)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(etf)}
      onBlur={() => onHover?.(null)}
      className="flex w-full flex-col overflow-hidden rounded-sm border border-gray-800/80 text-left transition-transform hover:z-10 hover:scale-[1.03] focus:outline-none"
      title={`${etf.name} (${etf.code})`}
    >
      <span className="truncate bg-gray-850 px-1 py-0.5 text-[8.5px] font-medium leading-none text-gray-200 text-center block w-full">
        {etf.name}
      </span>
      <span
        className="flex flex-col items-center justify-center px-1 py-0.5 leading-none"
        style={{
          backgroundColor: fill,
          color: text,
        }}
      >
        <span className="font-mono text-[8px] opacity-80">{etf.code}</span>
        <span className="text-[10px] font-bold tabular-nums mt-0.5">
          {formatReturn(val)}
        </span>
      </span>
    </a>
  );
}

export function GlobalMapHeatmap({ data, period, scale, onHover }: GlobalMapHeatmapProps) {
  // Collect all ETFs from the groups
  const allEtfs = data.groups.flatMap((g) => g.etfs);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-800 bg-[#030712] p-4 scrollbar-thin">
      <div className="relative mx-auto aspect-[700/330] w-[1000px] select-none xl:w-full">
        {/* SVG World Map Background */}
        <img
          src="/world-map.svg"
          alt="World Map Background"
          className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-80"
        />

        {/* Absolute Overlay of ETF Cells */}
        {allEtfs.map((etf) => {
          const coords = GLOBAL_COORDINATES[etf.code];
          if (!coords) return null;

          return (
            <div
              key={etf.code}
              className="absolute w-[62px] md:w-[68px] -translate-x-1/2 -translate-y-1/2"
              style={{
                top: coords.top,
                left: coords.left,
              }}
            >
              <CompactHeatmapCell
                etf={etf}
                period={period}
                scale={scale}
                onHover={onHover}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}