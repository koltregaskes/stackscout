const CACHE_NAME = 'stackscout-2026-05-25'
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
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin || event.request.method !== 'GET') {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request)
        return cached || caches.match(scopedUrl('index.html'))
      }),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response
        }

        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        return response
      })
    }),
  )
})
