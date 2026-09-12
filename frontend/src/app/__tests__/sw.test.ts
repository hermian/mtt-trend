import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Service Worker Caching Strategy", () => {
  let listeners: Record<string, Function> = {};
  let mockCaches: {
    open: any;
    keys: any;
    delete: any;
  };
  let mockCache: {
    match: any;
    put: any;
  };

  beforeEach(() => {
    listeners = {};
    mockCache = {
      match: vi.fn(),
      put: vi.fn(),
    };
    mockCaches = {
      open: vi.fn().mockResolvedValue(mockCache),
      keys: vi.fn().mockResolvedValue(["old-cache", "mtt-static-v1"]),
      delete: vi.fn().mockResolvedValue(true),
    };

    // Mock Service Worker global scope
    const mockSelf = {
      addEventListener: (type: string, fn: Function) => {
        listeners[type] = fn;
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    };

    // Global mocks
    vi.stubGlobal("self", mockSelf);
    vi.stubGlobal("caches", mockCaches);
  });

  it("registers install, activate, and fetch listeners", async () => {
    // Load sw.js script in mock environment
    const fs = await import("fs");
    const path = await import("path");
    const swCode = fs.readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf-8");

    // Execute script in mock global scope
    const fn = new Function("self", "caches", swCode);
    fn(globalThis.self, globalThis.caches);

    expect(listeners["install"]).toBeDefined();
    expect(listeners["activate"]).toBeDefined();
    expect(listeners["fetch"]).toBeDefined();
  });

  it("handles /_next/static/ requests with cache-first strategy", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const swCode = fs.readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf-8");

    const fn = new Function("self", "caches", swCode);
    fn(globalThis.self, globalThis.caches);

    const cachedResponse = new Response("cached-bundle");
    mockCache.match.mockResolvedValue(cachedResponse);

    let respondedWithPromise: Promise<Response> | null = null;
    const mockEvent = {
      request: new Request("https://example.com/_next/static/chunks/main.js"),
      respondWith: (promise: Promise<Response>) => {
        respondedWithPromise = promise;
      },
    };

    listeners["fetch"](mockEvent);

    expect(respondedWithPromise).not.toBeNull();
    const result = await respondedWithPromise!;
    expect(await result.text()).toBe("cached-bundle");
    expect(mockCaches.open).toHaveBeenCalledWith("mtt-static-v1");
  });

  it("handles /api/charts/ requests with stale-while-revalidate strategy", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const swCode = fs.readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf-8");

    const fn = new Function("self", "caches", swCode);
    fn(globalThis.self, globalThis.caches);

    const cachedData = new Response(JSON.stringify({ data: "cached-chart" }), { status: 200 });
    mockCache.match.mockResolvedValue(cachedData);

    const networkData = new Response(JSON.stringify({ data: "fresh-chart" }), { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(networkData));

    let respondedWithPromise: Promise<Response> | null = null;
    const mockEvent = {
      request: new Request("https://example.com/api/charts/macro"),
      respondWith: (promise: Promise<Response>) => {
        respondedWithPromise = promise;
      },
    };

    listeners["fetch"](mockEvent);

    expect(respondedWithPromise).not.toBeNull();
    const result = await respondedWithPromise!;
    const body = await result.json();
    // Returns cached version immediately
    expect(body.data).toBe("cached-chart");
    expect(mockCaches.open).toHaveBeenCalledWith("mtt-charts-api-v1");
  });
});
