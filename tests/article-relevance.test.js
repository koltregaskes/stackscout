const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { classifyArticle, tagEntries } = require('../scripts/article-relevance')
const { parseRss, applySiteFilter } = require('../scripts/refresh-routed-feed')
const root = path.resolve(__dirname, '..')
const filter = { include_tags: ['product_launch', 'open_source', 'mcp', 'api_update'], exclude_tags: ['crypto'], min_importance_score: 0.35 }

test('source-wide tags and filter minimums cannot give a general story relevance', () => {
  const source = { name: 'Test', tags: ['product_launch', 'open_source'] }
  const [entry] = tagEntries([{ title: 'A CEO spoke at dinner', summary: 'General AI news' }], source, 1)
  assert.deepEqual(entry.tags, [])
  assert.equal(entry.importance, 0)
})

test('all 15 supplied source-wide-tagged news items are excluded by article evidence', () => {
  const feed = require('./fixtures/source-tagging-existing-feed.json')
  assert.equal(feed.articles.length, 15)
  for (const entry of feed.articles) assert.deepEqual(classifyArticle(entry).tags, [], entry.title)
})

test('tool releases and open-source tools receive only supported article-level tags', () => {
  assert.deepEqual(classifyArticle({ title: 'A new SDK release for developers' }), { tags: ['product_launch'], importance: 0.7 })
  assert.deepEqual(classifyArticle({ title: 'An open-source command-line utility' }), { tags: ['open_source'], importance: 0.5 })
  assert.deepEqual(classifyArticle({ title: 'API update for developers' }), { tags: ['product_launch', 'api_update'], importance: 0.7 })
  assert.deepEqual(classifyArticle({ title: 'A model release for chat users' }), { tags: [], importance: 0 })
})

test('RSS and Atom categories are article metadata; source metadata is not used', () => {
  for (const category of ['<category>SDK product_launch</category>', '<category term="SDK product_launch"/>']) {
    const entries = parseRss(`<feed><entry><title>A platform change</title><link href="https://example.com/item"/><published>2026-04-16</published>${category}</entry></feed>`, {})
    assert.deepEqual(tagEntries(entries, { name: 'Example', tags: ['open_source'] })[0].tags, ['product_launch'])
  }
})

test('builder evidence still respects explicit exclusions and importance thresholds', () => {
  const tagged = tagEntries([{ title: 'Crypto API launch', url: 'https://example.com/x', date: '2026-04-16' }], { name: 'Example' })
  assert.equal(applySiteFilter(tagged, filter, '2026-04-17').length, 0)
  const good = tagEntries([{ title: 'SDK launch', url: 'https://example.com/x', date: '2026-04-16' }], { name: 'Example' })
  assert.equal(applySiteFilter(good, { ...filter, min_importance_score: 0.8 }, '2026-04-17').length, 0)
})

test('a stored first-party MCP release goes from article to final update and rendered link', () => {
  const { compileRoutedNewsFeed, escapeHtml } = require('../scripts/routed-news')
  const saved = require('../content/stackscout/updates-source.json').find(item => item.id === 'github-mcp-server-1-0')
  const article = { title: saved.title, summary: saved.summary, url: saved.sourceUrl, date: saved.publishedAt }
  const tagged = tagEntries([article], { name: saved.sourceLabel, tags: ['funding'] })
  assert.deepEqual(tagged[0].tags, ['product_launch', 'mcp'])
  const articles = applySiteFilter(tagged, filter, '2026-04-17')
  const compiled = compileRoutedNewsFeed({ site: 'Stack Scout', generated: '2026-04-17T00:00:00Z', article_count: 1, articles }, { now: '2026-04-17' })
  assert.equal(compiled.updates[0].sourceUrl, saved.sourceUrl)
  assert.ok(fs.readFileSync(path.join(root, 'updates/index.html'), 'utf8').includes(`href="${escapeHtml(saved.sourceUrl)}"`))
  assert.deepEqual(classifyArticle(article), classifyArticle(article))
})

test('every dossier shows missing verification and the original tracked-change date', () => {
  for (const tool of require('../content/stackscout/tools-source.json')) {
    const html = fs.readFileSync(path.join(root, 'tools', tool.slug, 'index.html'), 'utf8')
    assert.ok(html.includes('Last verified: not recorded'), tool.slug)
    const date = new Date(`${tool.lastUpdatedAt}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    assert.ok(html.includes(date), tool.slug)
    assert.ok(html.includes('not a verification review'), tool.slug)
  }
})
