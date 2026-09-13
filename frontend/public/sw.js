// Service Worker for MTT Trend PWA
const CACHE_NAME = "mtt-static-v1";
const API_CACHE_NAME = "mtt-charts-api-v1";
// 차트 응답은 최대 ~4MB 라 상한이 없으면 Cache Storage 가 무한히 커진다.
const API_CACHE_MAX_ENTRIES = 12;

// Cache API 는 삽입 순서를 유지하므로 앞쪽(오래된 것)부터 지운다.
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key))
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip non-http/https requests (e.g. chrome-extension)
  if (!url.protocol.startsWith("http")) return;

  // 1. Next.js immutable static assets (/_next/static/*) -> Cache First
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })
    );
    return;
  }

  // 2. Chart API endpoints (/api/charts/*) -> Network First (실패 시 캐시 폴백)
  //    SWR 은 재검증 결과를 저장만 하고 이미 반환한 응답을 다시 그리지 않으므로
  //    '한 번 로드 뒤처진 데이터'를 보여준다(두 번 새로고침해야 최신). 시장 데이터는
  //    장 마감 후 1회 갱신되므로 최신성을 우선하고, 캐시는 오프라인 폴백으로만 쓴다.
  //    캐시 기록은 event.waitUntil 로 미뤄 응답 지연에 영향을 주지 않는다.
  if (url.pathname.startsWith("/api/charts/")) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const forCache = networkResponse.clone();
            event.waitUntil(
              cache
                .put(request, forCache)
                .then(() => trimCache(cache, API_CACHE_MAX_ENTRIES))
                .catch(() => {})
            );
          }
          return networkResponse;
        } catch (err) {
          const cachedResponse = await cache.match(request);
          if (cachedResponse) return cachedResponse;
          throw err;
        }
      })
    );
    return;
  }

  // 3. Default: Network pass-through
  event.respondWith(fetch(request));
});
