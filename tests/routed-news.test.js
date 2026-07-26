const assert = require('node:assert/strict')
const test = require('node:test')

const {
  ROUTED_NEWS_PUBLIC_PATH,
  assertRoutedNewsFeed,
  compileRoutedNewsFeed,
  mergeUpdates,
} = require('../scripts/routed-news')

const now = new Date('2026-07-26T12:00:00.000Z')
const routedFeed = {
  generated: '2026-07-25T17:47:29.137Z',
  site: 'Stack Scout',
  article_count: 2,
  articles: [
    {
      title: 'Older update',
      url: 'https://github.com/example/tool/releases/tag/v1.0.0',
      source: 'GitHub Releases Â· Example Tool',
      tags: ['developer_tool'],
      matching_tags: ['tool_update'],
      date: '2026-07-24T19:57:10.000Z',
      summary: '<p>A useful <strong>release</strong>.</p>',
    },
    {
      title: 'Newest update',
      url: 'https://example.com/newest',
      source: 'Example',
      tags: ['api_update'],
      matching_tags: ['tool_update'],
      date: '2026-07-25T01:56:18.000Z',
      summary: "<script>alert('no')</script><p>Fresh public detail.</p>",
    },
  ],
}

test('routed feed compiles public-safe updates with exact provenance', () => {
  const compiled = compileRoutedNewsFeed(routedFeed, { now })

  assert.equal(compiled.provenance.consumerPath, ROUTED_NEWS_PUBLIC_PATH)
  assert.equal(compiled.provenance.generatedAt, '2026-07-25T17:47:29.137Z')
  assert.equal(compiled.provenance.newestItemAt, '2026-07-25T01:56:18.000Z')
  assert.equal(compiled.provenance.consumedItems, 2)
  assert.equal(compiled.updates[0].title, 'Newest update')
  assert.equal(compiled.updates[0].summary, 'Fresh public detail.')
  assert.equal(compiled.updates[1].sourceLabel, 'GitHub Releases · Example Tool')
  assert.equal(compiled.updates[1].projectName, 'Example Tool')
})

test('routed feed rejects stale generation and newest-item dates', () => {
  assert.throws(
    () => assertRoutedNewsFeed({ ...routedFeed, generated: '2026-07-20T00:00:00.000Z' }, { now }),
    /feed is 6\.5 days old/,
  )

  const staleArticles = {
    ...routedFeed,
    articles: routedFeed.articles.map((article) => ({ ...article, date: '2026-07-20T00:00:00.000Z' })),
  }
  assert.throws(
    () => assertRoutedNewsFeed(staleArticles, { now }),
    /newest article is 6\.5 days old/,
  )
})

test('routed feed rejects mismatched article counts', () => {
  assert.throws(
    () => assertRoutedNewsFeed({ ...routedFeed, article_count: 3 }, { now }),
    /article_count is 3; expected 2/,
  )
})

test('routed updates lead the wire and deduplicate static source URLs', () => {
  const compiled = compileRoutedNewsFeed(routedFeed, { now })
  const merged = mergeUpdates(
    [
      {
        id: 'static-duplicate',
        title: 'Stale duplicate',
        sourceUrl: routedFeed.articles[0].url,
        publishedAt: '2026-04-01',
      },
      {
        id: 'static-unique',
        title: 'Static unique',
        sourceUrl: 'https://example.com/static',
        publishedAt: '2026-04-02',
      },
    ],
    compiled.updates,
  )

  assert.equal(merged[0].title, 'Newest update')
  assert.equal(merged.filter((item) => item.sourceUrl === routedFeed.articles[0].url).length, 1)
  assert.equal(merged.at(-1).title, 'Static unique')
})
