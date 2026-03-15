"use client";

// SPEC-MTT-016: 모바일 전용 헤더 (md:hidden)
// 햄버거 메뉴 버튼 + "MTT Trend" 텍스트

interface MobileHeaderProps {
  onMenuOpen: () => void;
}

export function MobileHeader({ onMenuOpen }: MobileHeaderProps) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
      <span className="text-white font-bold text-sm">MTT Trend</span>
      <button
        onClick={onMenuOpen}
        aria-label="메뉴 열기"
        className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        {/* 햄버거 아이콘 */}
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
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </header>
  );
}
