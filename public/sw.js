// Minimal service worker for kolman.shop.
//
// Strategy:
//   - Navigation requests + same-origin static assets: stale-while-revalidate.
//   - /api/* and non-GET requests: bypass cache (always network).
//
// Bump CACHE_VERSION on each deploy so old assets are evicted. The vite build
// fingerprints JS/CSS filenames so old chunks would otherwise pile up.

const CACHE_VERSION = 'v1'
const CACHE = `kolman-${CACHE_VERSION}`

self.addEventListener('install', (event) => {
  // Activate the new SW immediately on next page load.
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names.filter((n) => n.startsWith('kolman-') && n !== CACHE).map((n) => caches.delete(n)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Bypass non-GET and cross-origin.
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Never cache /api — answers depend on auth + are time-sensitive.
  if (url.pathname.startsWith('/api/')) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    const network = fetch(req)
      .then((res) => {
        // Only cache successful, basic responses (skip 4xx/5xx + opaque).
        if (res.ok && res.type === 'basic') {
          cache.put(req, res.clone()).catch(() => {})
        }
        return res
      })
      .catch(() => cached)
    return cached ?? network
  })())
})
