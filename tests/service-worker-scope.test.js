const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const script = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8')
const current = /const CACHE_NAME = '([^']+)'/.exec(script)[1]
const scope = 'https://koltregaskes.github.io/stackscout/'
const historical = require('./fixtures/service-worker-legacy-caches.json')

function worker(seeds = []) {
  const handlers = {}, stores = new Map(), network = [], writes = []
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map())
    return stores.get(name)
  }
  store('another-site-v1').set(`${scope}collision.css`, 'other cache')
  for (const name of seeds) store(name).set('preserved', name)
  store(current).set(`${scope}index.html`, 'offline home')
  vm.runInNewContext(script, {
    URL,
    self: { registration: { scope }, location: { origin: new URL(scope).origin },
      clients: { claim: async () => {} }, skipWaiting: async () => {},
      addEventListener: (name, fn) => { handlers[name] = fn } },
    caches: { keys: async () => [...stores.keys()], delete: async (name) => stores.delete(name),
      match: () => { throw new Error('origin-wide cache lookup is forbidden') },
      open: async (name) => ({
        match: async (request) => store(name).get(typeof request === 'string' ? request : request.url),
        put: async (request, response) => { store(name).set(request.url, response); writes.push(request.url) },
        addAll: async (urls) => urls.forEach(url => store(name).set(url, 'precache')),
      }) },
    fetch: async (request) => { network.push(request.url); throw new Error('offline') },
  })
  const dispatch = async (type, request) => {
    const pending = []; let answered = false, response
    handlers[type]({ request, waitUntil: p => pending.push(p), respondWith: p => { answered = true; response = p } })
    await Promise.all(pending)
    return { answered, response: await response }
  }
  return { dispatch, stores, network, writes }
}

test('activation removes only obsolete Stack Scout caches on a shared origin', async () => {
  const w = worker()
  await w.dispatch('activate')
  assert.deepEqual([...w.stores.keys()].sort(), ['another-site-v1', current].sort())
  assert.equal(w.stores.get('another-site-v1').get(`${scope}collision.css`), 'other cache')
})

test('activation preserves colliding names and unlisted date-shaped legacy names', async () => {
  const collisions = ['stackscout-legacy', 'stackscout-other', 'stackscoutx-2026-11-15',
    'stackscout-old', 'stackscout-2026-01-01-old', 'stackscout-2026-11-15-ffffffffffff',
    'koltregaskes-stackscout-sw-v1-bad-hash', 'koltregaskes-stackscout-sw-v01-0123456789ab',
    'koltregaskes-stackscout-sw-v1-0123456789ab-extra', 'koltregaskes-stackscout-sw-v2-0123456789ab']
  const w = worker(collisions)
  await w.dispatch('activate')
  for (const name of collisions) assert.equal(w.stores.get(name)?.get('preserved'), name, name)
})

test('migration removes every exact historical CACHE_NAME and only matching obsolete namespace revisions', async () => {
  assert.equal(historical.length, 49)
  assert.ok(historical.some(entry => entry.name === 'stackscout-2026-11-15-48f29d8cf0ad'))
  const obsolete = 'koltregaskes-stackscout-sw-v1-0123456789ab'
  assert.notEqual(current, obsolete)
  const w = worker([...historical.map(entry => entry.name), obsolete])
  await w.dispatch('activate')
  for (const entry of historical) assert.equal(w.stores.has(entry.name), false, entry.name)
  assert.equal(w.stores.has(obsolete), false)
  assert.equal(w.stores.has(current), true)
  assert.equal(w.stores.has('another-site-v1'), true)
})

test('outside-scope, sibling-prefix, cross-origin and non-GET requests are untouched', async () => {
  const w = worker()
  for (const url of ['https://koltregaskes.github.io/other/', 'https://koltregaskes.github.io/stackscout-other/x',
    'https://koltregaskes.github.io/stackscout', 'https://example.com/stackscout/']) {
    assert.equal((await w.dispatch('fetch', { url, method: 'GET', mode: 'navigate' })).answered, false)
  }
  assert.equal((await w.dispatch('fetch', { url: scope, method: 'POST' })).answered, false)
  assert.deepEqual(w.network, [])
  assert.deepEqual(w.writes, [])
})

test('offline navigation and assets look only in the named site cache', async () => {
  const w = worker()
  const result = await w.dispatch('fetch', { url: `${scope}catalog/`, method: 'GET', mode: 'navigate' })
  assert.equal(result.response, 'offline home')
  w.stores.get(current).set(`${scope}styles.css`, 'own CSS')
  assert.equal((await w.dispatch('fetch', { url: `${scope}styles.css`, method: 'GET' })).response, 'own CSS')
  await assert.rejects(w.dispatch('fetch', { url: `${scope}collision.css`, method: 'GET' }), /offline/)
})

test('registration resolves an explicit root scope from a deep route', async () => {
  let registered
  await vm.runInNewContext(fs.readFileSync(path.join(root, 'pwa.js'), 'utf8') + '\nregisterStackScoutServiceWorker()', {
    URL, console, document: { baseURI: `${scope}tools/example/`, body: { dataset: { siteRoot: '../../' } },
      getElementById: () => null },
    navigator: { serviceWorker: { register: async (...args) => { registered = args } } },
  })
  assert.equal(registered[0], `${scope}service-worker.js`)
  assert.equal(registered[1].scope, scope)
})
