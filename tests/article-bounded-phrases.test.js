const assert = require('node:assert/strict')
const test = require('node:test')
const { classifyArticle, tagEntries } = require('../scripts/article-relevance')
const { applySiteFilter } = require('../scripts/refresh-routed-feed')
const cases = require('./fixtures/article-round5-review.json')
const filter = { include_tags: ['product_launch', 'open_source', 'mcp', 'api_update'], exclude_tags: ['crypto'], min_importance_score: 0.35 }
for (const row of cases) test(`round-five fresh review: ${row.title}`, () => {
  const entry = { ...row, url: 'https://example.invalid/story', date: '2026-11-15T10:00:00Z' }
  assert.equal(applySiteFilter(tagEntries([entry], { name: 'Fixture', tags: ['product_launch'] }), filter, '2026-11-16T00:00:00Z').length === 1, row.expected)
})
for (const tool of ['API', 'SDK', 'CLI']) for (const verb of ['launches', 'releases', 'introduces']) {
  test(`unlisted lowercase prose cannot bridge ${verb} and ${tool}`, () => {
    for (const title of [`Vendor ${verb} research describing the ${tool}`, `Reviewers debate whether the ${tool} ships today`]) {
      assert.deepEqual(classifyArticle({ title }).tags, [])
      assert.deepEqual(classifyArticle({ title: 'Industry discussion', summary: title }).tags, [])
    }
  })
}
for (const qualifier of ['APIs', 'SDKs', 'developer tools', 'package managers']) test(`toolkit requires a builder qualifier: ${qualifier}`, () => {
  assert.ok(classifyArticle({ title: `Vendor launches Aster Toolkit for ${qualifier}` }).tags.includes('product_launch'))
})
for (const title of ['Vendor launches Photography Toolkit', 'Vendor launches Aster Toolkit for gardeners',
  'Vendor releases a report comparing SDKs', 'Will Aster API ship today?', 'Did Aster SDK retire yesterday?']) test(`unasserted or non-builder change: ${title}`, () => {
  assert.deepEqual(classifyArticle({ title }).tags, [])
})
test('an affirmative summary sentence can support a question headline', () => {
  assert.ok(classifyArticle({ title: 'Did the API change?', summary: 'Aster API adds streaming.' }).tags.includes('api_update'))
})
for (const command of ['uv', 'pixi', 'orbit-run']) test(`single-token executable label before CLI: ${command}`, () => {
  for (const title of [`${command} CLI ships`, `Vendor releases ${command} CLI`]) assert.ok(classifyArticle({ title }).tags.includes('product_launch'))
})
test('an earlier tool mention cannot hide reporting prose before a second tool subject', () => {
  assert.deepEqual(classifyArticle({ title: 'API users debate whether the SDK ships today' }).tags, [])
})
test('grammatical function words cannot become capitalised products or executable labels', () => {
  for (const tool of ['API', 'SDK', 'CLI']) for (const prefix of ['Not', 'Whether', 'Unless']) {
    assert.deepEqual(classifyArticle({ title: `${prefix} ${tool} ships` }).tags, [])
  }
})
