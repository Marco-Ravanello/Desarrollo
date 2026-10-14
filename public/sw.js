// Modo sin conexión de MuniGestión 3F.
// Guarda en el dispositivo la pantalla de Emergencia Climática y los archivos
// que necesita, para poder abrirla y cargar fichas sin internet. Las fichas en
// sí se guardan en el navegador (ver src/lib/emergency-offline.ts) y se envían
// solas cuando vuelve la conexión.

const CACHE = "muni-emergencia-v1";
const EMERGENCY_PAGE = "/admin/emergency";
// Sin conexión, estas direcciones abren la pantalla de emergencia guardada.
const OFFLINE_FALLBACK_PATHS = ["/", "/dashboard", EMERGENCY_PAGE];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("muni-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || /\.(png|jpe?g|svg|ico|webp|woff2?)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    if (!OFFLINE_FALLBACK_PATHS.includes(url.pathname)) return;
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          // Se guarda solo la pantalla de emergencia abierta con sesión (sin redirecciones ni avisos).
          if (url.pathname === EMERGENCY_PAGE && !url.search && response.ok && response.type === "basic" && !response.redirected) {
            const cache = await caches.open(CACHE);
            await cache.put(EMERGENCY_PAGE, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await caches.match(EMERGENCY_PAGE, { ignoreVary: true, ignoreSearch: true });
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  // Archivos de la app (JS, CSS, fuentes, logo): primero lo guardado, si no, la red.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { ignoreVary: true });
        if (cached) return cached;
        return fetch(request);
      })()
    );
  }
});

// La pantalla de emergencia pide quedar guardada: se descarga la página (con
// la sesión de quien la usa) y los archivos que necesita. Se borran los que
// ya no usa (versiones anteriores de la app).
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "cache-emergency-assets" && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        const candidates = [...data.urls];
        try {
          const page = await fetch(EMERGENCY_PAGE, { credentials: "same-origin" });
          if (page.ok && !page.redirected && new URL(page.url).pathname === EMERGENCY_PAGE) {
            const html = await page.clone().text();
            await cache.put(EMERGENCY_PAGE, page);
            candidates.push(...(html.match(/\/_next\/static\/[^"'\s\\)]+/g) || []));
          }
        } catch {
          // Sin conexión: queda lo que ya estaba guardado.
          return;
        }
        const wanted = new Set(
          candidates
            .map((u) => {
              try {
                const parsed = new URL(u, self.location.origin);
                return parsed.origin === self.location.origin && isStaticAsset(parsed) ? parsed.href : null;
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        );
        const existing = await cache.keys();
        await Promise.all(
          existing
            .filter((req) => new URL(req.url).pathname !== EMERGENCY_PAGE && !wanted.has(req.url))
            .map((req) => cache.delete(req))
        );
        for (const href of wanted) {
          if (await cache.match(href)) continue;
          try {
            const response = await fetch(href);
            if (response.ok) await cache.put(href, response);
          } catch {
            // Se reintenta en la próxima visita.
          }
        }
      })()
    );
  }
  if (data.type === "clear-offline-cache") {
    event.waitUntil(caches.delete(CACHE));
  }
});
