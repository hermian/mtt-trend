// SPEC-MTT-016: MobileHeader 컴포넌트 테스트
// 모바일 전용 헤더 - 햄버거 버튼 + 타이틀

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileHeader } from "../MobileHeader";

describe("MobileHeader", () => {
  it("TASK-003: 햄버거 버튼을 렌더링해야 한다", () => {
    const onMenuOpen = vi.fn();
    render(<MobileHeader onMenuOpen={onMenuOpen} />);

    // 햄버거 버튼이 존재해야 함 (aria-label 또는 role로 찾기)
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("TASK-003: 햄버거 버튼 클릭 시 onMenuOpen이 호출되어야 한다", () => {
    const onMenuOpen = vi.fn();
    render(<MobileHeader onMenuOpen={onMenuOpen} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(onMenuOpen).toHaveBeenCalledTimes(1);
  });

  it("TASK-003: MTT Trend 텍스트를 렌더링해야 한다", () => {
    const onMenuOpen = vi.fn();
    render(<MobileHeader onMenuOpen={onMenuOpen} />);

    expect(screen.getByText("MTT Trend")).toBeInTheDocument();
  });

  it("TASK-003: md:hidden 클래스를 가진 컨테이너가 있어야 한다", () => {
    const onMenuOpen = vi.fn();
    const { container } = render(<MobileHeader onMenuOpen={onMenuOpen} />);

    // 루트 요소가 md:hidden 클래스를 가져야 함
    const header = container.firstChild as HTMLElement;
    expect(header?.className).toContain("md:hidden");
  });

  it("TASK-003: fixed top-0 클래스를 가진 컨테이너가 있어야 한다", () => {
    const onMenuOpen = vi.fn();
    const { container } = render(<MobileHeader onMenuOpen={onMenuOpen} />);

    const header = container.firstChild as HTMLElement;
    expect(header?.className).toContain("fixed");
    expect(header?.className).toContain("top-0");
  });

  it("TASK-003: h-14 높이 클래스를 가져야 한다", () => {
    const onMenuOpen = vi.fn();
    const { container } = render(<MobileHeader onMenuOpen={onMenuOpen} />);

    const header = container.firstChild as HTMLElement;
    expect(header?.className).toContain("h-14");
  });

  it("TASK-003: z-40 클래스를 가져야 한다", () => {
    const onMenuOpen = vi.fn();
    const { container } = render(<MobileHeader onMenuOpen={onMenuOpen} />);

    const header = container.firstChild as HTMLElement;
    expect(header?.className).toContain("z-40");
  });
});
