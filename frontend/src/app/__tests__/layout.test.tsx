// SPEC-MTT-016: layout.tsx 테스트
// 1. viewport export 분리
// 2. LayoutClient 통합

import { describe, it, expect, vi } from "vitest";

// LayoutClient mock
vi.mock("../_components/LayoutClient", () => ({
  LayoutClient: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout-client-mock">{children}</div>
  ),
}));

describe("layout.tsx viewport export", () => {
  it("TASK-001: metadata 객체에 viewport 속성이 없어야 한다", async () => {
    // layout.tsx는 서버 컴포넌트이므로 동적 import로 테스트
    const layoutModule = await import("../layout");
    const { metadata } = layoutModule;

    // metadata에 viewport 속성이 없어야 함
    expect(metadata).not.toHaveProperty("viewport");
  });

  it("TASK-001: viewport 이름의 별도 export가 존재해야 한다", async () => {
    const layoutModule = await import("../layout");

    // viewport가 별도로 export되어야 함
    expect(layoutModule).toHaveProperty("viewport");
  });

  it("TASK-001: viewport export는 width와 initialScale 속성을 가져야 한다", async () => {
    const layoutModule = await import("../layout");
    const { viewport } = layoutModule as any;

    expect(viewport).toBeDefined();
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
  });

  it("TASK-001: metadata는 title과 description을 유지해야 한다", async () => {
    const layoutModule = await import("../layout");
    const { metadata } = layoutModule;

    expect(metadata.title).toBe("52주 트렌드 대시보드");
    expect(metadata.description).toBe("52주 고점 기반 테마 트렌드 분석 대시보드");
  });
});

describe("layout.tsx LayoutClient 통합", () => {
  it("TASK-007: Sidebar 직접 import가 없어야 한다", async () => {
    // layout.tsx 소스 코드를 읽어서 Sidebar import가 없는지 확인
    const fs = await import("fs");
    const path = await import("path");
    const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    // Sidebar import가 없어야 함
    expect(layoutContent).not.toContain("import { Sidebar }");
    expect(layoutContent).not.toContain("from \"./_components/Sidebar\"");
  });

  it("TASK-007: LayoutClient import가 있어야 한다", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    // LayoutClient import가 있어야 함
    expect(layoutContent).toContain("LayoutClient");
  });

  it("TASK-007: LayoutClient 컴포넌트를 JSX에서 사용해야 한다", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    // <LayoutClient> JSX 사용이 있어야 함
    expect(layoutContent).toContain("<LayoutClient>");
  });
});
