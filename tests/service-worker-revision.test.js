const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { serviceWorkerCacheName } = require('../scripts/service-worker-cache')
const root = path.resolve(__dirname, '..')

test('cache revision is reproducible, versioned and changes with worker or design bytes', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-cache-revision-'))
  const files = ['styles.css', 'app.js', 'pwa.js', 'manifest.json', 'icon.svg',
    'scripts/build-stackscout.js', 'scripts/service-worker-cache.js', 'data/news-feed-latest.json',
    'content/stackscout/site-source.json', 'content/stackscout/tools-source.json',
    'content/stackscout/updates-source.json', 'service-worker.js']
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true })
    fs.copyFileSync(path.join(root, file), path.join(fixture, file))
  }
  const first = serviceWorkerCacheName(fixture)
  assert.match(first, /^koltregaskes-stackscout-sw-v1-[a-f0-9]{12}$/)
  assert.equal(first, serviceWorkerCacheName(fixture))
  const workerPath = path.join(fixture, 'service-worker.js')
  fs.writeFileSync(workerPath, fs.readFileSync(workerPath, 'utf8').replace(/const CACHE_NAME = '[^']+'/, `const CACHE_NAME = '${first}'`))
  assert.equal(first, serviceWorkerCacheName(fixture))
  fs.appendFileSync(workerPath, '\n// A new worker implementation\n')
  const workerRevision = serviceWorkerCacheName(fixture)
  assert.notEqual(workerRevision, first)
  fs.appendFileSync(path.join(fixture, 'styles.css'), '\nbody { outline-offset: 3px; }\n')
  assert.notEqual(serviceWorkerCacheName(fixture), workerRevision)
})

test('the committed name equals the expected revision, including worker behaviour', () => {
  const actual = /^const CACHE_NAME = '([^']+)'/m.exec(fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8'))[1]
  assert.equal(actual, serviceWorkerCacheName(root))
})
