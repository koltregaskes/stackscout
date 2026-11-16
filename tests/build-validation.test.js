const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

test('snapshot validation stays reproducible and design releases invalidate cached assets', () => {
  const root = path.resolve(__dirname, '..')
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'stackscout-build-'))
  for (const name of ['STACKSCOUT_ROUTED_FEED_MAX_AGE_DAYS', 'STACKSCOUT_PRIVATE_EXPORT_FILE', 'STACKSCOUT_PRIVATE_EXPORT_DIR']) {
    assert.ok(!process.env[name], `Run this fixture without the build control ${name}`)
  }
  for (const entry of ['content', 'scripts', 'styles.css', 'app.js', 'pwa.js',
    'manifest.json', 'icon.svg', 'service-worker.js', 'seo-config.json', 'site-config.json', 'social-preview.png', 'robots.txt']) {
    fs.cpSync(path.join(root, entry), path.join(fixture, entry), { recursive: true })
  }
  const feedPath = path.join(fixture, 'data/news-feed-latest.json')
  const feed = { site: 'Stack Scout', generated: '2000-01-02T00:00:00Z', article_count: 1,
    articles: [{ title: 'Synthetic SDK release', source: 'Fixture', url: 'https://example.invalid/sdk',
      date: '2000-01-01T00:00:00Z', summary: 'Synthetic fixture article, independent of live data.', tags: ['product_launch'] }] }
  fs.mkdirSync(path.dirname(feedPath), { recursive: true })
  fs.writeFileSync(feedPath, JSON.stringify(feed))
  const run = (...args) => spawnSync(process.execPath, ['scripts/build-stackscout.js', ...args], { cwd: fixture, encoding: 'utf8' })
  const snapshot = run('--snapshot')
  assert.equal(snapshot.status, 0, snapshot.stderr)
  const indexPath = path.join(fixture, 'index.html')
  const schema = '<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'Organization','@id':'https://example.com/#retained'})+'</script>'
  fs.writeFileSync(indexPath, fs.readFileSync(indexPath,'utf8').replace('</head>',schema+'</head>'))
  const seo = spawnSync(process.execPath,['scripts/seo.mjs'],{cwd:fixture,encoding:'utf8'})
  assert.equal(seo.status,0,seo.stderr)
  assert.ok(fs.readFileSync(indexPath,'utf8').includes(schema),'page-owned schema survives SEO generation')
  assert.equal(spawnSync(process.execPath,['scripts/seo.mjs','--check'],{cwd:fixture}).status,0,'SEO generation is idempotent')
  const cache = () => fs.readFileSync(path.join(fixture, 'service-worker.js'), 'utf8').split('\n')[0]
  const first = cache()
  assert.equal(run('--snapshot').status, 0)
  assert.equal(cache(), first)
  fs.appendFileSync(path.join(fixture, 'styles.css'), '\nbody { outline-offset: 3px; }\n')
  assert.equal(run('--snapshot').status, 0)
  assert.notEqual(cache(), first)
  // Fix the fixture in the past, independently of the actual repository feed.
  assert.equal(feed.articles.length, 1, 'stale-article check must not be vacuous')
  assert.equal(run('--snapshot').status, 0)
  const live = run()
  assert.notEqual(live.status, 0)
  assert.match(live.stderr, /days old; maximum is 3/)
  feed.articles.forEach(article => { article.date = '1999-01-01T00:00:00Z' })
  fs.writeFileSync(feedPath, JSON.stringify(feed))
  assert.notEqual(run('--snapshot').status, 0, 'snapshot still rejects articles stale at generation')
  fs.writeFileSync(feedPath, JSON.stringify({ ...feed, article_count: 0, articles: [] }))
  assert.equal(run('--snapshot').status, 0, 'a genuine empty acquisition remains valid')
})
