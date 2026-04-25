"use client";

// @MX:NOTE: SPEC-MTT-016 레이아웃 클라이언트. isMobileMenuOpen 상태로 모바일 사이드바 오버레이를 제어한다.
// @MX:ANCHOR: LayoutClient (fan_in: RootLayout, MobileHeader, MobileSidebar)
// SPEC-MTT-016: 모바일 반응형 레이아웃 클라이언트 컴포넌트
// 사이드바 open/close 상태 관리 + 모바일 헤더/오버레이 렌더링

import { useState, Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { MobileSidebar } from "./MobileSidebar";

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={<div className="w-16 md:w-56 bg-gray-800" />}>
        {/* 모바일 전용 헤더 (md:hidden) */}
        <MobileHeader onMenuOpen={() => setIsMobileMenuOpen(true)} />

        {/* PC 전용 사이드바 (hidden md:flex) */}
        <Sidebar />

        {/* 모바일 오버레이 사이드바 (md:hidden) */}
        <MobileSidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      </Suspense>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto bg-gray-900 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
