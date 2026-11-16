const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { refreshRoutedFeed } = require('../scripts/refresh-routed-feed')
const { makeCoverage, validateCoverage, coverageMessage, coverageReport } = require('../scripts/source-coverage')
const { compileRoutedNewsFeed } = require('../scripts/routed-news')
const root = path.resolve(__dirname, '..')
const now = '2026-04-17T12:00:00Z'

async function refresh(failCount, required = false, count = 4, title = 'SDK release') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-coverage-'))
  fs.mkdirSync(path.join(dir, 'config'))
  const sources = Array.from({ length: count }, (_, i) => ({ id: `source-${i}`, name: `Source ${i}`, required: required && i === 0,
    adapter: 'rss', url: `https://example.com/${i}`, tags: ['product_launch'] }))
  fs.writeFileSync(path.join(dir, 'config/sources.json'), JSON.stringify({ sources }))
  fs.writeFileSync(path.join(dir, 'site-filters.json'), JSON.stringify({ sites: { stackscout: { name: 'Stack Scout', include_tags: ['product_launch'] } } }))
  const outputPath = path.join(dir, 'feed.json'), statusPath = path.join(dir, 'status.json')
  fs.writeFileSync(outputPath, 'previous feed bytes\n')
  const result = await refreshRoutedFeed({ pipelineDir: dir, outputPath, statusPath, now, retries: 1,
    fetchImpl: async url => ({ ok: Number(new URL(url).pathname.slice(1)) >= failCount,
      status: Number(new URL(url).pathname.slice(1)) < failCount ? 404 : 200,
      text: async () => `<rss><channel><item><title>${title}</title><link>${url}/story</link><pubDate>2026-04-17T10:00:00Z</pubDate></item></channel></rss>` }) })
  return { result, outputPath, statusPath, dir }
}

for (const [failed, status, wrote, level] of [[0, 'healthy', true, 'notice'], [1, 'degraded', true, 'warning'], [2, 'failed', false, 'error'], [4, 'failed', false, 'error']]) {
  test(`${failed} of 4 failed: ${status}, ${level}, publish=${wrote}`, async () => {
    const { result, outputPath, statusPath } = await refresh(failed)
    assert.equal(result.wrote, wrote)
    assert.equal(result.coverage.status, status)
    assert.equal(result.coverage.attempted, 4)
    assert.equal(result.coverage.failed, failed)
    assert.equal(result.coverage.succeeded, 4 - failed)
    assert.equal(result.coverage.sources.filter(s => s.outcome === 'failure').length, failed)
    assert.deepEqual(JSON.parse(fs.readFileSync(statusPath)).coverage, result.coverage)
    const report = coverageReport(result.coverage)
    assert.equal(report.level, level)
    assert.equal(report.exitCode, wrote ? 0 : 1)
    const cli = spawnSync(process.execPath, [path.join(root, 'scripts/report-source-status.js'), statusPath], { encoding: 'utf8' })
    assert.equal(cli.status, report.exitCode)
    assert.ok(cli.stdout.includes(`::${level} title=Routed feed source coverage::`))
    if (wrote) {
      assert.deepEqual(JSON.parse(fs.readFileSync(outputPath)).acquisition, result.coverage)
      assert.equal(compileRoutedNewsFeed(result.feed, { now }).provenance.coverage.status, status)
    } else {
      assert.equal(fs.readFileSync(outputPath, 'utf8'), 'previous feed bytes\n')
      assert.equal(result.feed, null)
    }
  })
}

test('a single required-source loss fails despite a healthy majority; no configured sources also fails', async () => {
  assert.equal((await refresh(1, true)).result.coverage.status, 'failed')
  assert.equal((await refresh(0, false, 0)).result.coverage.status, 'failed')
})

test('malformed entities remain valid source text while coverage thresholds preserve feed bytes', async () => {
  const title = 'SDK release &#x110000; &#xD800; &#12abc;'
  const degraded = await refresh(1, false, 4, title)
  assert.equal(degraded.result.coverage.status, 'degraded')
  assert.equal(degraded.result.coverage.succeeded, 3)
  assert.equal(degraded.result.wrote, true)
  assert.ok(degraded.result.feed.articles.every(article => article.title === title))
  const failed = await refresh(2, false, 4, title)
  assert.equal(failed.result.coverage.status, 'failed')
  assert.equal(failed.result.coverage.succeeded, 2)
  assert.equal(failed.result.wrote, false)
  assert.equal(failed.result.feed, null)
  assert.equal(fs.readFileSync(failed.outputPath, 'utf8'), 'previous feed bytes\n')
})

test('invalid or forged coverage cannot silently become healthy', () => {
  const good = makeCoverage([{ id: 'one', name: 'One', required: false, outcome: 'failure' }])
  assert.throws(() => validateCoverage({ ...good, status: 'healthy' }), /do not match/)
  assert.throws(() => validateCoverage({ ...good, failed: 0 }), /do not match/)
  assert.throws(() => validateCoverage({ sources: [{ id: 'x', outcome: 'unknown' }] }), /Invalid/)
  assert.throws(() => compileRoutedNewsFeed({ site: 'Stack Scout', generated: now, article_count: 0, articles: [], acquisition: good }, { now }), /too low/)
  assert.match(coverageMessage(null), /not recorded/)
})

test('a degraded feed renders the visible notice and exact coverage in generated output', async () => {
  const { result } = await refresh(1)
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-degraded-build-'))
  for (const name of ['scripts', 'content', 'styles.css', 'app.js', 'pwa.js', 'manifest.json', 'icon.svg', 'service-worker.js', 'seo-config.json', 'site-config.json', 'social-preview.png', 'robots.txt']) {
    fs.cpSync(path.join(root, name), path.join(fixture, name), { recursive: true })
  }
  fs.mkdirSync(path.join(fixture, 'data'))
  fs.writeFileSync(path.join(fixture, 'data/news-feed-latest.json'), JSON.stringify(result.feed))
  const built = spawnSync(process.execPath, ['scripts/build-stackscout.js', '--snapshot'], { cwd: fixture, encoding: 'utf8' })
  assert.equal(built.status, 0, built.stderr)
  for (const page of ['index.html', 'updates/index.html']) {
    const html = fs.readFileSync(path.join(fixture, page), 'utf8')
    assert.ok(html.includes('Some sources unavailable: 1 of 4 sources failed during this feed refresh. Coverage is reduced.'))
    assert.ok(html.includes('role="status"'))
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture, 'data/source-provenance.json'))).news.coverage, result.coverage)
})

test('workflow always reports acquisition coverage; missing status fails closed', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/refresh-routed-feed.yml'), 'utf8')
  assert.match(workflow, /Report source coverage[^\n]*\n\s+if: always\(\)\n\s+run: node scripts\/report-source-status\.js/)
  const missing = spawnSync(process.execPath, [path.join(root, 'scripts/report-source-status.js'), path.join(os.tmpdir(), 'ss-status-not-created')], { encoding: 'utf8' })
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /Source status is missing or invalid/)
})
