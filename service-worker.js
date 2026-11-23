const CACHE_NAME = 'koltregaskes-stackscout-sw-v1-6784d4d135df'
const CACHE_VERSION = 1
// Exact CACHE_NAME literals from this site's supplied Git history. Never migrate by prefix.
const LEGACY_CACHE_NAMES = new Set([
  "stackscout-2026-05-25",
  "stackscout-2026-06-04",
  "stackscout-2026-06-11",
  "stackscout-2026-06-12",
  "stackscout-2026-06-14",
  "stackscout-2026-07-25",
  "stackscout-2026-07-26",
  "stackscout-2026-07-29",
  "stackscout-2026-08-22",
  "stackscout-2026-08-23",
  "stackscout-2026-08-24",
  "stackscout-2026-08-25",
  "stackscout-2026-08-26",
  "stackscout-2026-08-27",
  "stackscout-2026-08-28",
  "stackscout-2026-08-29",
  "stackscout-2026-10-11",
  "stackscout-2026-10-12",
  "stackscout-2026-10-13",
  "stackscout-2026-10-14",
  "stackscout-2026-10-15",
  "stackscout-2026-10-16",
  "stackscout-2026-10-17",
  "stackscout-2026-10-18",
  "stackscout-2026-10-19",
  "stackscout-2026-10-20",
  "stackscout-2026-10-21",
  "stackscout-2026-10-22",
  "stackscout-2026-10-23",
  "stackscout-2026-10-23-933f6826b3e0",
  "stackscout-2026-10-23-a60be12f3e0d",
  "stackscout-2026-10-26",
  "stackscout-2026-10-26-e6e2aec7d89e",
  "stackscout-2026-11-13-8dca71cffa1c",
  "stackscout-2026-11-13-95e22c919bf4",
  "stackscout-2026-11-13-bbde904fbc24",
  "stackscout-2026-11-13-be39a0703933",
  "stackscout-2026-11-13-ca7177380528",
  "stackscout-2026-11-13-ece43429f9cc",
  "stackscout-2026-11-13-f1006fd4f757",
  "stackscout-2026-11-13-f3313d4ffbc3",
  "stackscout-2026-11-14-7452641ecf85",
  "stackscout-2026-11-15-30183c338428",
  "stackscout-2026-11-15-4334534cbb21",
  "stackscout-2026-11-15-48f29d8cf0ad",
  "stackscout-2026-11-15-ebe90cd7a44d",
  "stackscout-2026-11-15-f396928215c5",
  "stackscout-v1",
  "tools-hub-v1",
])

function ownsObsoleteCache(name) {
  if (name === CACHE_NAME) return false
  if (LEGACY_CACHE_NAMES.has(name)) return true
  const version = /^koltregaskes-stackscout-sw-v([1-9]\d*)-[a-f0-9]{12}$/.exec(name)
  return !!version && Number(version[1]) <= CACHE_VERSION
}
const APP_SHELL = [
  '',
  'index.html',
  'catalog/',
  'categories/',
  'updates/',
  'radar/',
  'collections/',
  'method/',
  'styles.css',
  'app.js',
  'pwa.js',
  'manifest.json',
  'icon.svg',
  'data/page-registry.json',
  'data/source-provenance.json',
  'data/tools-manifest.json',
  'data/updates-manifest.json',
  'data/categories-manifest.json',
  'data/methodology-manifest.json',
  'data/collections-manifest.json',
  'data/radar-manifest.json',
]

function scopedUrl(pathname) {
  return new URL(pathname, self.registration.scope).toString()
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(APP_SHELL.map((entry) => scopedUrl(entry))),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter(ownsObsoleteCache).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url)
  const scopeUrl = new URL(self.registration.scope)
  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname) || event.request.method !== 'GET') {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(event.request)
        return cached || cache.match(scopedUrl('index.html'))
      }),
    )
    return
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) {
        return cached
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response
        }

        const copy = response.clone()
        event.waitUntil(cache.put(event.request, copy))
        return response
      })
    }),
  )
})
