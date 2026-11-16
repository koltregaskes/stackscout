const test = require('node:test')
const assert = require('node:assert/strict')
const { classifyArticle, tagEntries } = require('../scripts/article-relevance')
const { applySiteFilter } = require('../scripts/refresh-routed-feed')
const filter = { include_tags: ['product_launch', 'open_source', 'mcp', 'api_update'], exclude_tags: ['crypto'], min_importance_score: 0.35 }
for (const row of require('./fixtures/article-round7-review.json').cases) {
  test(`round-seven independent review ${row.id}: ${row.title}`, () => {
    const article = { ...row, url: 'https://example.invalid/story', date: '2026-11-15T10:00:00Z' }
    const admitted = applySiteFilter(tagEntries([article], { name: 'Fixture', tags: ['product_launch'] }), filter, '2026-11-16T00:00:00Z').length === 1
    assert.equal(admitted, row.expected)
  })
}
const positives = [
  'Bright announces version 7.2 of its debugger for Java',
  'Bright ships v3 of its database with typed queries',
  'With release 6, the Bright build tool adds task isolation',
  'Bright introduces a command-line network inspection utility today',
  'Bright unveils its developer profiler with heap snapshots',
  'Bright adds support for Swift to its testing framework',
  'Bright makes its code editor publicly available',
  "Bright's compiler gains structured diagnostics",
  'Bright rolls out an updated API client for Java',
]
const negatives = [
  'Bright releases a report on version 7 of its debugger',
  'Bright releases version 7 of its debugger comparison guide',
  'Bright announces a book about databases',
  'Bright launches a marketing toolkit',
  'Bright launches a photography framework',
  'Bright launches a generic toolkit for gardeners',
  'Bright releases a command-line documentary about tools',
  'Bright releases a command-line for tools',
  'Bright releases command-line debugging tool documentation',
  'Bright releases an API client licence dispute report',
  'Bright adds allegations to its compiler incident report',
  'Bright adds a reference to its compiler documentation',
  'Bright makes its compiler manual publicly available',
  'Bright never makes its compiler generally available',
  'Bright plans to make its compiler generally available',
  'Bright may unveil a new compiler',
  'Has Bright announced its debugger?',
  'Bright compiler gains popularity',
  'Bright compiler gains attention after the conference',
  'Bright compiler gains attention for test execution',
]
for (const title of positives) test(`builder grammar positive: ${title}`, () => assert.ok(classifyArticle({ title }).tags.includes('product_launch')))
for (const title of negatives) test(`tool mention is not a tool change: ${title}`, () => assert.deepEqual(classifyArticle({ title }).tags, []))
test('API clients use the existing API taxonomy', () => {
  assert.ok(classifyArticle({ title: 'Bright releases an updated API client for Rust' }).tags.includes('api_update'))
})
test('builder scope and construction matching is source-independent and stateless', () => {
  const rows = [...positives, ...negatives].map(title => ({ title }))
  assert.deepEqual(rows.map(classifyArticle), rows.slice().reverse().map(classifyArticle).reverse())
  const article = { title: positives[0] }
  assert.deepEqual(tagEntries([article], { name: 'A', tags: [] })[0].tags, tagEntries([article], { name: 'B', tags: ['crypto'] })[0].tags)
})

test('merged acquisition publishes article tags and reduced source coverage together', async () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')
  const { refreshRoutedFeed } = require('../scripts/refresh-routed-feed')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-tagging-coverage-'))
  fs.mkdirSync(path.join(dir, 'config'))
  const sources = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, name: `Source ${i}`, adapter: 'rss', url: `https://example.invalid/${i}`, tags: ['api_update', 'mcp'] }))
  fs.writeFileSync(path.join(dir, 'config/sources.json'), JSON.stringify({ sources }))
  fs.writeFileSync(path.join(dir, 'site-filters.json'), JSON.stringify({ sites: { stackscout: { name: 'Stack Scout', ...filter } } }))
  const outputPath = path.join(dir, 'feed.json'), statusPath = path.join(dir, 'status.json')
  const result = await refreshRoutedFeed({ pipelineDir: dir, outputPath, statusPath, now: '2026-11-16T00:00:00Z', retries: 1,
    fetchImpl: async url => {
      const i = Number(new URL(url).pathname.slice(1))
      return { ok: i !== 0, status: i === 0 ? 404 : 200, text: async () => `<rss><channel>
        <item><title>Bright${i} releases version 3 of its compiler</title><link>${url}/tool</link><pubDate>2026-11-15T10:00:00Z</pubDate></item>
        <item><title>Bright${i} releases a report about its compiler</title><link>${url}/report</link><pubDate>2026-11-15T10:00:00Z</pubDate></item>
      </channel></rss>` }
    } })
  assert.equal(result.wrote, true)
  assert.equal(result.coverage.status, 'degraded')
  assert.equal(result.coverage.failed, 1)
  assert.equal(result.failures.length, 1)
  const published = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  assert.deepEqual(published.acquisition, result.coverage)
  assert.deepEqual(JSON.parse(fs.readFileSync(statusPath, 'utf8')).coverage, result.coverage)
  assert.equal(published.articles.length, 3)
  assert.ok(published.articles.every(row => /releases version 3 of its compiler/.test(row.title)))
  assert.ok(published.articles.every(row => row.tags.includes('product_launch') && !row.tags.includes('api_update') && !row.tags.includes('mcp')))
})
