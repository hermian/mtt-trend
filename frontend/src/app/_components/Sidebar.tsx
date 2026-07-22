"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { SyncButton } from "./SyncButton";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/trend",
    label: "52주 트렌드",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: "/guide",
    label: "사용자 가이드",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);

  const isChartActive =
    pathname.startsWith("/trend") && searchParams.get("tab") === "chart";
  const isAboveMaActive =
    pathname.startsWith("/trend") && searchParams.get("tab") === "above_ma";
  const isMacroActive =
    pathname.startsWith("/trend") && searchParams.get("tab") === "macro";
  const isWicsRankingActive =
    pathname.startsWith("/trend") && searchParams.get("tab") === "wics_ranking";
  const isWicsIndexActive =
    pathname.startsWith("/trend") && searchParams.get("tab") === "wics_index";
  return (
    <aside
      className={clsx(
        "hidden md:flex flex-col bg-gray-800 border-r border-gray-700 transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed && (
          <span className="text-white font-bold text-sm truncate">
            MTT Trend
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {collapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname.startsWith(item.href) &&
            (!item.href.includes("tab=chart") || isChartActive);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        {/* 심층지표 분석 Button-styled Link */}
        <Link
          href="/trend?tab=chart"
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
            isChartActive
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
          )}
          title={collapsed ? "심층지표 분석" : undefined}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          {!collapsed && <span className="truncate">심층지표 분석</span>}
        </Link>

        {/* Above MA Button-styled Link */}
        <Link
          href="/trend?tab=above_ma"
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
            isAboveMaActive
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
          )}
          title={collapsed ? "Above MA" : undefined}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          {!collapsed && <span className="truncate">Above MA</span>}
        </Link>
        {/* 매크로 지표 Button-styled Link */}
        <Link
          href="/trend?tab=macro"
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
            isMacroActive
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
          )}
          title={collapsed ? "매크로 지표" : undefined}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          {!collapsed && <span className="truncate">매크로 지표</span>}
        </Link>
        {/* WICS 랭킹 Button-styled Link */}
        <Link
          href="/trend?tab=wics_ranking"
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
            isWicsRankingActive
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
          )}
          title={collapsed ? "WICS 랭킹" : undefined}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <polyline points="3 6 4 7 6 5" />
            <polyline points="3 12 4 13 6 11" />
            <polyline points="3 18 4 19 6 17" />
          </svg>
          {!collapsed && <span className="truncate">WICS 랭킹</span>}
        </Link>
        {/* WICS Index Explorer */}
        <Link
          href="/trend?tab=wics_index"
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
            isWicsIndexActive
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
          )}
          title={collapsed ? "WICS Index" : undefined}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          {!collapsed && <span className="truncate">WICS Index</span>}
        </Link>

        {/* Sync Button */}
        <div className="pt-2">
          <SyncButton collapsed={collapsed} />
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700">
        {!collapsed && (
          <p className="text-xs text-gray-500 text-center">
            52주 고점 트렌드 분석
          </p>
        )}
      </div>
    </aside>
  );
}
