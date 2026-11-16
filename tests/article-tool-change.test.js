const assert = require('node:assert/strict')
const test = require('node:test')
const { classifyArticle, tagEntries } = require('../scripts/article-relevance')
const { applySiteFilter } = require('../scripts/refresh-routed-feed')
const cases = require('./fixtures/article-tool-change-review.json')
const filter = { include_tags: ['product_launch', 'open_source', 'mcp', 'api_update'], exclude_tags: ['crypto'], min_importance_score: 0.35 }

for (const entry of cases) test(`independent review: ${entry.name}`, () => {
  const article = { title: entry.title, summary: entry.summary, url: 'https://example.invalid/story', date: '2026-11-15T10:00:00Z' }
  const tagged = tagEntries([article], { name: 'Example', tags: ['product_launch', 'open_source'] })
  assert.equal(applySiteFilter(tagged, filter, '2026-11-16T00:00:00Z').length === 1, entry.expected)
  if (!entry.expected) assert.deepEqual(classifyArticle(article), { tags: [], importance: 0 })
})

for (const title of ['Company launches a new SDK', 'The API adds streaming helpers', 'A model endpoint update for developers',
  'Company introduces a TypeScript SDK', 'New SDK v2.0 released', 'MCP Server reached 1.0.0']) {
  test(`a tool is directly changed: ${title}`, () => {
    const result = classifyArticle({ title })
    assert.ok(result.tags.includes('product_launch'))
    assert.equal(result.importance, 0.7)
  })
}

for (const [title, summary] of [
  ['Company launches an office for API developers', 'Its SDK is already available.'],
  ['Court releases a ruling about an API', 'Existing SDK users await guidance.'],
  ['Company launches an API advertising campaign', 'Existing SDK users are its audience.'],
  ['Company launches advertising campaign', 'An existing MCP server provides the data.'],
  ['New SDK release cancelled', 'An API is already available.'],
  ['Company will not release an SDK', 'It sells API access.'],
  ['Open-source campaign opens a new office', 'The company has an API.'],
]) test(`incidental tool words cannot borrow an unrelated change: ${title}`, () => {
  assert.deepEqual(classifyArticle({ title, summary, metadata: ['SDK', 'product_launch', 'mcp', 'open_source'] }), { tags: [], importance: 0 })
})

test('an SDK release does not update an API incidentally mentioned elsewhere', () => {
  assert.deepEqual(classifyArticle({ title: 'Company launches a new SDK', summary: 'Its existing API remains available.' }), { tags: ['product_launch'], importance: 0.7 })
})

test('bare article-level tags cannot supply missing tool-change evidence', () => {
  assert.deepEqual(classifyArticle({ title: 'Company launches a campaign', metadata: ['SDK', 'api_update', 'product_launch'] }), { tags: [], importance: 0 })
})
