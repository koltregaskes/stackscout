const assert = require('node:assert/strict')
const test = require('node:test')
const { classifyArticle, tagEntries } = require('../scripts/article-relevance')
const { applySiteFilter } = require('../scripts/refresh-routed-feed')
const cases = require('./fixtures/article-round4-review.json')
const filter = { include_tags: ['product_launch', 'open_source', 'mcp', 'api_update'], exclude_tags: ['crypto'], min_importance_score: 0.35 }
for (const row of cases) test(`round-four ${row.probe}: ${row.title}`, () => {
  const entry = { ...row, url: 'https://example.invalid/story', date: '2026-11-15T10:00:00Z' }
  assert.equal(applySiteFilter(tagEntries([entry], { name: 'Fixture', tags: ['product_launch'] }), filter, '2026-11-16T00:00:00Z').length === 1, row.expected)
})
for (const name of ['Aster Meridian', 'Noma-7', 'Zéphyr 2.4', 'quartz payments']) {
  test(`synthetic names use a general modifier rule: ${name}`, () => {
    assert.ok(classifyArticle({ title: `Fixture vendor releases ${name} SDK` }).tags.includes('product_launch'))
  })
}
for (const title of ['Fixture Launches Aster Campaign For Developer Tools', 'Fixture Introduces A Bill To Regulate AI APIs',
  'Fixture Opens An Office For API Customers']) test(`title case cannot bridge unrelated objects: ${title}`, () => {
  assert.deepEqual(classifyArticle({ title }).tags, [])
})
