const test = require('node:test')
const assert = require('node:assert/strict')
const { classifyArticle, tagEntries } = require('../scripts/article-relevance')
const { applySiteFilter } = require('../scripts/refresh-routed-feed')
const rows = require('./fixtures/article-round6-review.json')
const filter = { include_tags: ['product_launch', 'open_source', 'mcp', 'api_update'], exclude_tags: ['crypto'], min_importance_score: 0.35 }
for (const row of rows) test(`round-six reviewer: ${row.title}`, () => {
  const article = { ...row, url: 'https://example.invalid/story', date: '2026-11-15T10:00:00Z' }
  assert.equal(applySiteFilter(tagEntries([article], { name: 'Fixture', tags: ['product_launch'] }), filter, '2026-11-16T00:00:00Z').length === 1, row.expected)
})
for (const title of ['Does Beacon release an SDK: what do you think?', 'Is Beacon SDK released: why the debate?',
  'Beacon plans to release an SDK: what happens next?', 'Beacon releases a statement: what happens to the API?']) {
  test(`question commentary cannot manufacture an assertion: ${title}`, () => assert.deepEqual(classifyArticle({ title }).tags, []))
}
for (const title of ['With version 4, the Beacon SDK adds streaming.', 'In v3.2, the Beacon API adds streaming.',
  'Since release 2.1, the Beacon CLI adds completion.', 'Beacon releases typed SDK, But why does it matter?']) {
  test(`bounded version qualifier: ${title}`, () => assert.ok(classifyArticle({ title }).tags.includes('product_launch')))
}
for (const title of ['With version 4, a report describes SDK updates.', 'In v3.2, developers discuss API retirement.',
  'Beacon launches plain small remote SDK', 'plain remote SDK ships today', 'Beacon releases study comparing API']) {
  test(`descriptors remain object-local and bounded: ${title}`, () => assert.deepEqual(classifyArticle({ title }).tags, []))
}
test('clause casing does not leak between articles or summaries', () => {
  const articles = [...rows, ...rows.slice().reverse()]
  assert.deepEqual(articles.map(classifyArticle), articles.slice().reverse().map(classifyArticle).reverse())
  assert.deepEqual(classifyArticle(rows[0]), classifyArticle(rows[0]))
})
