// SPEC-MTT-016: MobileSidebar 컴포넌트 테스트
// 모바일 오버레이 사이드바 - isOpen 상태에 따라 표시/숨김

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileSidebar } from "../MobileSidebar";

// Next.js 라우터 mock
vi.mock("next/navigation", () => ({
  usePathname: () => "/trend",
}));

// Next.js Link mock
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, className }: any) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

describe("MobileSidebar", () => {
  it("TASK-004: isOpen=false 일 때 사이드바 패널이 화면 밖에 있어야 한다", () => {
    const onClose = vi.fn();
    render(<MobileSidebar isOpen={false} onClose={onClose} />);

    // -translate-x-full 클래스로 패널이 숨겨짐
    const panel = document.querySelector("[class*='translate']");
    // 패널이 숨겨진 상태여야 함
    expect(panel?.className).toContain("-translate-x-full");
  });

  it("TASK-004: isOpen=true 일 때 사이드바 패널이 보여야 한다", () => {
    const onClose = vi.fn();
    render(<MobileSidebar isOpen={true} onClose={onClose} />);

    // translate-x-0 클래스로 패널이 표시됨
    const panel = document.querySelector("[class*='translate']");
    expect(panel?.className).toContain("translate-x-0");
    expect(panel?.className).not.toContain("-translate-x-full");
  });

  it("TASK-004: 백드롭 클릭 시 onClose가 호출되어야 한다", () => {
    const onClose = vi.fn();
    render(<MobileSidebar isOpen={true} onClose={onClose} />);

    // 백드롭 요소 클릭
    const backdrop = document.querySelector("[data-testid='mobile-sidebar-backdrop']");
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("TASK-004: md:hidden 클래스를 가진 컨테이너가 있어야 한다", () => {
    const onClose = vi.fn();
    const { container } = render(<MobileSidebar isOpen={false} onClose={onClose} />);

    const root = container.firstChild as HTMLElement;
    expect(root?.className).toContain("md:hidden");
  });

  it("TASK-004: isOpen=true 일 때 fixed inset-0 클래스를 가져야 한다", () => {
    const onClose = vi.fn();
    const { container } = render(<MobileSidebar isOpen={true} onClose={onClose} />);

    const root = container.firstChild as HTMLElement;
    expect(root?.className).toContain("fixed");
    expect(root?.className).toContain("inset-0");
  });

  it("TASK-004: z-50 클래스를 가져야 한다", () => {
    const onClose = vi.fn();
    const { container } = render(<MobileSidebar isOpen={true} onClose={onClose} />);

    const root = container.firstChild as HTMLElement;
    expect(root?.className).toContain("z-50");
  });

  it("TASK-004: 네비게이션 아이템들이 렌더링되어야 한다", () => {
    const onClose = vi.fn();
    render(<MobileSidebar isOpen={true} onClose={onClose} />);

    // 52주 트렌드 링크가 있어야 함
    expect(screen.getByText("52주 트렌드")).toBeInTheDocument();
  });

  it("TASK-004: 닫기 버튼이 있어야 한다", () => {
    const onClose = vi.fn();
    render(<MobileSidebar isOpen={true} onClose={onClose} />);

    // 닫기 버튼(X 버튼)이 있어야 함
    const closeButton = screen.getByRole("button", { name: /닫기|close/i });
    expect(closeButton).toBeInTheDocument();
  });

  it("TASK-004: 닫기 버튼 클릭 시 onClose가 호출되어야 한다", () => {
    const onClose = vi.fn();
    render(<MobileSidebar isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /닫기|close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
