"use client";

// SPEC-MTT-016: 모바일 오버레이 사이드바 (md:hidden)
// isOpen 상태에 따라 fixed 오버레이로 표시

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { SyncButton } from "./SyncButton";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    <div
      className={clsx(
        "md:hidden fixed inset-0 z-50",
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      {/* 백드롭 */}
      <div
        data-testid="mobile-sidebar-backdrop"
        className={clsx(
          "absolute inset-0 bg-black transition-opacity duration-300",
          isOpen ? "opacity-50" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 사이드바 패널 */}
      <div
        className={clsx(
          "absolute left-0 top-0 bottom-0 w-64 bg-gray-800 border-r border-gray-700 flex flex-col transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <span className="text-white font-bold text-sm">MTT Trend</span>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname.startsWith(item.href) &&
              (!item.href.includes("tab=chart") || isChartActive);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {/* 심층지표 분석 Button-styled Link */}
          <Link
            href="/trend?tab=chart"
            onClick={onClose}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
              isChartActive
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
            )}
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
            <span className="truncate">심층지표 분석</span>
          </Link>

          {/* Above MA Button-styled Link */}
          <Link
            href="/trend?tab=above_ma"
            onClick={onClose}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
              isAboveMaActive
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
            )}
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
            <span className="truncate">Above MA</span>
          </Link>
          {/* 매크로 지표 Button-styled Link */}
          <Link
            href="/trend?tab=macro"
            onClick={onClose}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
              isMacroActive
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
            )}
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
            <span className="truncate">매크로 지표</span>
          </Link>
          {/* WICS 랭킹 Button-styled Link */}
          <Link
            href="/trend?tab=wics_ranking"
            onClick={onClose}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
              isWicsRankingActive
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
            )}
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
            <span className="truncate">WICS 랭킹</span>
          </Link>
          <Link
            href="/trend?tab=wics_index"
            onClick={onClose}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm h-10 w-full mt-2",
              isWicsIndexActive
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30"
            )}
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
            <span className="truncate">WICS Index</span>
          </Link>

          {/* Sync Button */}
          <div className="pt-2">
            <SyncButton />
          </div>
        </nav>
      </div>
    </div>
  );
}
