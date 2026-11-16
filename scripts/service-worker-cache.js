const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function serviceWorkerCacheName(root) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')
  const worker = read('service-worker.js')
  const version = /^const CACHE_VERSION = ([1-9]\d*)$/m.exec(worker)?.[1]
  if (!version || !/^const CACHE_NAME = '[^']+'$/m.test(worker)) throw new Error('Worker cache declarations are missing or invalid.')
  const revision = crypto.createHash('sha256')
  for (const file of ['styles.css', 'app.js', 'pwa.js', 'manifest.json', 'icon.svg',
    'scripts/build-stackscout.js', 'scripts/service-worker-cache.js', 'scripts/privacy-content.js', 'data/news-feed-latest.json',
    'content/stackscout/site-source.json', 'content/stackscout/tools-source.json',
    'content/stackscout/updates-source.json']) {
    revision.update(file + '\0').update(read(file))
  }
  // Include worker behaviour and the exact migration list, excluding the computed
  // name itself so rebuilding is deterministic rather than self-referential.
  revision.update(worker.replace(/^const CACHE_NAME = '[^']+'$/m, "const CACHE_NAME = '<revision>'"))
  return `koltregaskes-stackscout-sw-v${version}-${revision.digest('hex').slice(0, 12)}`
}

module.exports = { serviceWorkerCacheName }
