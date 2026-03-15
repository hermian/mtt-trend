// SPEC-MTT-016: Sidebar 반응형 클래스 테스트
// PC에서는 보이고, 모바일에서는 숨겨지는 클래스 검증

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

// Next.js 라우터 mock
vi.mock("next/navigation", () => ({
  usePathname: () => "/trend",
}));

// SyncButton mock
vi.mock("../SyncButton", () => ({
  SyncButton: ({ collapsed }: { collapsed?: boolean }) => (
    <div data-testid="sync-button-mock">SyncButton collapsed={String(collapsed)}</div>
  ),
}));

describe("Sidebar", () => {
  it("TASK-005: aside 요소에 hidden 클래스가 있어야 한다 (모바일 숨김)", () => {
    const { container } = render(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside).toBeInTheDocument();
    expect(aside?.className).toContain("hidden");
  });

  it("TASK-005: aside 요소에 md:flex 클래스가 있어야 한다 (PC에서 표시)", () => {
    const { container } = render(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("md:flex");
  });

  it("TASK-005: flex-col 클래스를 여전히 유지해야 한다 (기존 레이아웃 보존)", () => {
    const { container } = render(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("flex-col");
  });

  it("TASK-005: bg-gray-800 클래스를 여전히 유지해야 한다 (기존 스타일 보존)", () => {
    const { container } = render(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("bg-gray-800");
  });
});
