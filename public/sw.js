// Runtime caching only: a precache would go stale against hashed asset names.

const CACHE = "rep-track-v1";
const NAVIGATION_TIMEOUT_MS = 10_000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    handleNavigation(event);
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            void caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    })(),
  );
});

function handleNavigation(event) {
  const { request } = event;
  const network = fetch(request, { signal: AbortSignal.timeout(NAVIGATION_TIMEOUT_MS) }).then(
    (response) => {
      // Fetch spec, HTTP fetch: manual-redirect navigations treat a followed redirect as a network error.
      const copy = response.ok && !response.redirected ? response.clone() : null;
      return { response, copy };
    },
  );

  event.waitUntil(
    network.then(async ({ copy }) => {
      if (!copy) return;
      const cache = await caches.open(CACHE);
      await cache.put(request, copy);
    }),
  );

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        return (await network).response;
      } catch {
        return (await caches.match("/")) ?? Response.error();
      }
    })(),
  );
}
