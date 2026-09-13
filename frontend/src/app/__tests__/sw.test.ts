import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Service Worker 캐싱 전략 테스트.
 *
 * sw.js 는 ServiceWorkerGlobalScope 에서 실행되므로 여기서는 `self`/`caches`/`fetch` 를
 * 스텁한 뒤 스크립트를 `new Function` 으로 평가해 리스너를 수집한다.
 */

type Listener = (event: any) => void;

const SW_PATH = path.resolve(__dirname, "../../../public/sw.js");

function loadSw(): Record<string, Listener> {
  const listeners: Record<string, Listener> = {};
  const mockSelf = {
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  vi.stubGlobal("self", mockSelf);
  const swCode = fs.readFileSync(SW_PATH, "utf-8");
  const fn = new Function("self", "caches", swCode);
  fn(globalThis.self as any, (globalThis as any).caches);
  return listeners;
}

/** respondWith 로 전달된 promise 와 waitUntil 로 미뤄진 promise 들을 수집하는 이벤트 스텁. */
function makeEvent(url: string) {
  let responded: Promise<Response> | null = null;
  const waited: Promise<any>[] = [];
  const event = {
    request: new Request(url),
    respondWith: (p: Promise<Response>) => {
      responded = p;
    },
    waitUntil: (p: Promise<any>) => {
      waited.push(p);
    },
  };
  return { event, waited, getResponded: () => responded! };
}

describe("Service Worker Caching Strategy", () => {
  let mockCache: { match: any; put: any; keys: any; delete: any };
  let mockCaches: { open: any; keys: any; delete: any };

  beforeEach(() => {
    vi.unstubAllGlobals();
    mockCache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
    };
    mockCaches = {
      open: vi.fn().mockResolvedValue(mockCache),
      keys: vi.fn().mockResolvedValue(["old-cache", "mtt-static-v1"]),
      delete: vi.fn().mockResolvedValue(true),
    };
    vi.stubGlobal("caches", mockCaches);
  });

  it("registers install, activate, and fetch listeners", () => {
    const listeners = loadSw();
    expect(listeners["install"]).toBeDefined();
    expect(listeners["activate"]).toBeDefined();
    expect(listeners["fetch"]).toBeDefined();
  });

  it("serves /_next/static/ from the cache without hitting the network (cache-first)", async () => {
    const listeners = loadSw();
    mockCache.match.mockResolvedValue(new Response("cached-bundle"));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { event, getResponded } = makeEvent(
      "https://example.com/_next/static/chunks/main.js"
    );
    listeners["fetch"](event);

    const result = await getResponded();
    expect(await result.text()).toBe("cached-bundle");
    expect(mockCaches.open).toHaveBeenCalledWith("mtt-static-v1");
    // 캐시 히트면 네트워크를 타지 않아야 한다
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("prefers the network over the cache for /api/charts/ (network-first)", async () => {
    const listeners = loadSw();
    // 캐시에 오래된 데이터가 있어도
    mockCache.match.mockResolvedValue(
      new Response(JSON.stringify({ data: "cached-chart" }), { status: 200 })
    );
    // 네트워크가 최신 데이터를 주면 네트워크 쪽을 반환해야 한다
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: "fresh-chart" }), { status: 200 })
      )
    );

    const { event, waited, getResponded } = makeEvent(
      "https://example.com/api/charts/macro"
    );
    listeners["fetch"](event);

    const body = await (await getResponded()).json();
    expect(body.data).toBe("fresh-chart");
    expect(mockCaches.open).toHaveBeenCalledWith("mtt-charts-api-v1");

    // 캐시 기록은 waitUntil 로 미뤄지므로 응답 후 flush 한다
    await Promise.all(waited);
    expect(mockCache.put).toHaveBeenCalled();
  });

  it("falls back to the cache when the network fails for /api/charts/", async () => {
    const listeners = loadSw();
    mockCache.match.mockResolvedValue(
      new Response(JSON.stringify({ data: "offline-chart" }), { status: 200 })
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { event, getResponded } = makeEvent(
      "https://example.com/api/charts/foreign-flow"
    );
    listeners["fetch"](event);

    const body = await (await getResponded()).json();
    expect(body.data).toBe("offline-chart");
  });

  it("rejects when the network fails and nothing is cached", async () => {
    const listeners = loadSw();
    mockCache.match.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { event, getResponded } = makeEvent(
      "https://example.com/api/charts/macro"
    );
    listeners["fetch"](event);

    await expect(getResponded()).rejects.toThrow("offline");
  });

  it("caps the API cache so Cache Storage cannot grow without bound", async () => {
    const listeners = loadSw();
    // 15개가 이미 들어있는 상태에서 새 응답 1건을 저장하면 12개로 줄여야 한다
    const existing = Array.from(
      { length: 15 },
      (_, i) => new Request(`https://example.com/api/charts/c${i}`)
    );
    mockCache.keys.mockResolvedValue(existing);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: "fresh" }), { status: 200 })
      )
    );

    const { event, waited, getResponded } = makeEvent(
      "https://example.com/api/charts/macro"
    );
    listeners["fetch"](event);
    await getResponded();
    await Promise.all(waited);

    // 15개 중 12개만 남기고 3개를 지운다
    expect(mockCache.delete).toHaveBeenCalledTimes(3);
  });
});
