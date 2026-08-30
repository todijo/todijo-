/* Todijo Stage 1 service worker: public shell assets only; commerce stays network-authoritative. */
const CACHE_VERSION = "phase9-stage1-v1";
const CACHE_PREFIX = "todijo-pwa-";
const SHELL_CACHE = CACHE_PREFIX + "shell-" + CACHE_VERSION;
const STATIC_CACHE = CACHE_PREFIX + "static-" + CACHE_VERSION;
const OFFLINE_PAGES = ["/en/offline", "/fr/offline", "/ar/offline"];
const SHELL_ASSETS = ["/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", ...OFFLINE_PAGES];
const STATIC_DESTINATIONS = new Set(["style", "script", "font", "image"]);
const PUBLIC_IMAGE_PREFIXES = ["/images/", "/icon", "/favicon.ico", "/apple-icon.png"];
const LOCALIZED_PREFIX = /^\/(?:en|fr|ar|ku|tr|de|es|it|nl|zh|fa|hi|pt|ru)(?=\/|$)/i;
const SENSITIVE_PATH = /^\/(?:api(?:\/|$)|checkout(?:\/|$)|cart(?:\/|$)|account(?:\/|$)|dashboard(?:\/|$)|orders?(?:\/|$)|messages(?:\/|$)|notifications(?:\/|$)|favorites(?:\/|$)|seller(?:\/|$)|admin(?:\/|$)|adm-barewbar-182203(?:\/|$)|connect(?:\/|$)|login(?:\/|$)|register(?:\/|$)|forgot-password(?:\/|$)|reset-password(?:\/|$)|verify-email(?:\/|$))/i;

function isSensitivePath(pathname) {
  return SENSITIVE_PATH.test(pathname.replace(LOCALIZED_PREFIX, "") || "/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, STATIC_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function localizedOfflinePath(pathname) {
  const locale = pathname.split("/").filter(Boolean)[0];
  return locale === "fr" || locale === "ar" ? "/" + locale + "/offline" : "/en/offline";
}

function isCacheableStatic(request, url) {
  if (request.method !== "GET" || url.origin !== self.location.origin || isSensitivePath(url.pathname)) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  return STATIC_DESTINATIONS.has(request.destination) && PUBLIC_IMAGE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || isSensitivePath(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await caches.match(localizedOfflinePath(url.pathname), { ignoreSearch: true });
      return cached || new Response("A network connection is required.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }));
    return;
  }

  if (!isCacheableStatic(request, url)) return;
  event.respondWith(caches.open(STATIC_CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  }));
});
