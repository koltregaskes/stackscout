const assert = require('node:assert/strict')
const test = require('node:test')
const { classifyArticle, tagEntries } = require('../scripts/article-relevance')
const { applySiteFilter } = require('../scripts/refresh-routed-feed')
const cases = require('./fixtures/article-round3-review.json')
const filter = { include_tags: ['product_launch', 'open_source', 'mcp', 'api_update'], exclude_tags: ['crypto'], min_importance_score: 0.35 }
for (const row of cases) test(`round-three review: ${row.title}`, () => {
  const entry = { title: row.title, summary: row.summary, url: 'https://example.invalid/story', date: '2026-11-15T10:00:00Z' }
  const tagged = tagEntries([entry], { name: 'Fixture', tags: ['api_update', 'product_launch'] })
  assert.equal(applySiteFilter(tagged, filter, '2026-11-16T00:00:00Z').length === 1, row.expected)
})
for (const title of ['Provider deprecates the API', 'Provider is deprecating the API', 'API deprecation announced',
  'Provider sunsets the API', 'Provider is sunsetting the API', 'API sunset announced',
  'Provider retires the API', 'Provider is retiring the API', 'API retirement announced',
  'API end-of-life announced', 'API reaches end of life', 'End of life for the API', 'Deprecation of the API',
  'API reached end of life', 'API is retired', 'API has been deprecated', 'API will be sunset']) {
  test(`API lifecycle form: ${title}`, () => assert.ok(classifyArticle({ title }).tags.includes('api_update')))
}
test('classification stays deterministic across input order', () => {
  const expected = cases.map(row => classifyArticle(row))
  assert.deepEqual([...cases].reverse().map(row => classifyArticle(row)).reverse(), expected)
})
