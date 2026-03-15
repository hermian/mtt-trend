// SPEC-MTT-016: LayoutClient 컴포넌트 테스트
// 모바일 메뉴 open/close 상태 관리 + 컴포넌트 렌더링

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayoutClient } from "../LayoutClient";

// Next.js 라우터 mock
vi.mock("next/navigation", () => ({
  usePathname: () => "/trend",
}));

// Sidebar mock (PC 전용)
vi.mock("../Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar-mock">Sidebar</div>,
}));

// MobileHeader mock
vi.mock("../MobileHeader", () => ({
  MobileHeader: ({ onMenuOpen }: { onMenuOpen: () => void }) => (
    <button data-testid="mobile-header-mock" onClick={onMenuOpen}>
      MobileHeader
    </button>
  ),
}));

// MobileSidebar mock
vi.mock("../MobileSidebar", () => ({
  MobileSidebar: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="mobile-sidebar-mock" data-open={String(isOpen)}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

describe("LayoutClient", () => {
  it("TASK-002: children을 렌더링해야 한다", () => {
    render(
      <LayoutClient>
        <div data-testid="test-children">Test Content</div>
      </LayoutClient>
    );

    expect(screen.getByTestId("test-children")).toBeInTheDocument();
  });

  it("TASK-002: Sidebar 컴포넌트를 렌더링해야 한다", () => {
    render(
      <LayoutClient>
        <div>children</div>
      </LayoutClient>
    );

    expect(screen.getByTestId("sidebar-mock")).toBeInTheDocument();
  });

  it("TASK-002: MobileHeader 컴포넌트를 렌더링해야 한다", () => {
    render(
      <LayoutClient>
        <div>children</div>
      </LayoutClient>
    );

    expect(screen.getByTestId("mobile-header-mock")).toBeInTheDocument();
  });

  it("TASK-002: MobileSidebar 컴포넌트를 렌더링해야 한다", () => {
    render(
      <LayoutClient>
        <div>children</div>
      </LayoutClient>
    );

    expect(screen.getByTestId("mobile-sidebar-mock")).toBeInTheDocument();
  });

  it("TASK-002: 초기 상태에서 MobileSidebar는 닫혀 있어야 한다", () => {
    render(
      <LayoutClient>
        <div>children</div>
      </LayoutClient>
    );

    const mobileSidebar = screen.getByTestId("mobile-sidebar-mock");
    expect(mobileSidebar).toHaveAttribute("data-open", "false");
  });

  it("TASK-002: MobileHeader 클릭 시 MobileSidebar가 열려야 한다", () => {
    render(
      <LayoutClient>
        <div>children</div>
      </LayoutClient>
    );

    const mobileHeaderBtn = screen.getByTestId("mobile-header-mock");
    fireEvent.click(mobileHeaderBtn);

    const mobileSidebar = screen.getByTestId("mobile-sidebar-mock");
    expect(mobileSidebar).toHaveAttribute("data-open", "true");
  });

  it("TASK-002: MobileSidebar 닫기 시 다시 닫혀야 한다", () => {
    render(
      <LayoutClient>
        <div>children</div>
      </LayoutClient>
    );

    // 열기
    const mobileHeaderBtn = screen.getByTestId("mobile-header-mock");
    fireEvent.click(mobileHeaderBtn);

    // 닫기
    const closeBtn = screen.getByText("Close");
    fireEvent.click(closeBtn);

    const mobileSidebar = screen.getByTestId("mobile-sidebar-mock");
    expect(mobileSidebar).toHaveAttribute("data-open", "false");
  });

  it("TASK-002: main 요소에 pt-14 md:pt-0 클래스가 있어야 한다", () => {
    render(
      <LayoutClient>
        <div>children</div>
      </LayoutClient>
    );

    // main 요소 찾기
    const main = document.querySelector("main");
    expect(main).toBeInTheDocument();
    expect(main?.className).toContain("pt-14");
    expect(main?.className).toContain("md:pt-0");
  });
});
