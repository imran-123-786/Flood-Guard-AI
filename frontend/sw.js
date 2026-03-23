const CACHE_NAME = "flood-guard-v2";
const RUNTIME_CACHE = "flood-guard-runtime-v2";
const CORE_ASSETS = [
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/feedback.js",
  "./assets/site.webmanifest",
  "./assets/floodguard-favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isApi = url.pathname.startsWith("/api/") || url.port === "5000";
  const isSameOrigin = url.origin === self.location.origin;
  const isStatic =
    isSameOrigin &&
    (url.pathname.endsWith(".html") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".json") ||
      url.pathname.endsWith(".mp4"));

  if (isApi) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('{"status":"offline"}', { status: 503, headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            return res;
          })
          .catch(() => cached || caches.match("./index.html"));
        return cached || networkFetch;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((networkRes) => {
          const isHttp = request.url.startsWith("http");
          if (isHttp && networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkRes;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
