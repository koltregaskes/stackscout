const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

test('snapshot validation stays reproducible and design releases invalidate cached assets', () => {
  const root = path.resolve(__dirname, '..')
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'stackscout-build-'))
  for (const entry of ['content', 'data', 'scripts', 'styles.css', 'app.js', 'pwa.js',
    'manifest.json', 'icon.svg', 'service-worker.js', 'seo-config.json', 'social-preview.png', 'robots.txt']) {
    fs.cpSync(path.join(root, entry), path.join(fixture, entry), { recursive: true })
  }
  const run = (...args) => spawnSync(process.execPath, ['scripts/build-stackscout.js', ...args], {
    cwd: fixture, encoding: 'utf8', env: { ...process.env, STACKSCOUT_ROUTED_FEED_MAX_AGE_DAYS: '',
      STACKSCOUT_PRIVATE_EXPORT_FILE: '', STACKSCOUT_PRIVATE_EXPORT_DIR: '' },
  })
  const snapshot = run('--snapshot')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const cache = () => fs.readFileSync(path.join(fixture, 'service-worker.js'), 'utf8').split('\n')[0]
  const first = cache()
  assert.equal(run('--snapshot').status, 0)
  assert.equal(cache(), first)
  fs.appendFileSync(path.join(fixture, 'styles.css'), '\nbody { outline-offset: 3px; }\n')
  assert.equal(run('--snapshot').status, 0)
  assert.notEqual(cache(), first)
  // Fix the fixture in the past, independently of the actual repository feed.
  const feedPath = path.join(fixture, 'data/news-feed-latest.json')
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'))
  feed.generated = '2000-01-02T00:00:00Z'
  feed.articles.forEach(article => { article.date = '2000-01-01T00:00:00Z' })
  fs.writeFileSync(feedPath, JSON.stringify(feed))
  assert.equal(run('--snapshot').status, 0)
  const live = run()
  assert.notEqual(live.status, 0)
  assert.match(live.stderr, /days old; maximum is 3/)
  feed.articles.forEach(article => { article.date = '1999-01-01T00:00:00Z' })
  fs.writeFileSync(feedPath, JSON.stringify(feed))
  assert.notEqual(run('--snapshot').status, 0, 'snapshot still rejects articles stale at generation')
})
