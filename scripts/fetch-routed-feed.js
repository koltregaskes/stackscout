/* eslint-disable no-console */
/**
 * Optional routed-feed fetcher.
 *
 * If STACKSCOUT_ROUTED_FEED_URL is set, this script downloads the JSON feed
 * and writes it to data/news-feed-latest.json. It validates basic shape
 * (site, articles, article_count) and only overwrites when the fetch succeeds.
 *
 * Usage:
 *   STACKSCOUT_ROUTED_FEED_URL="https://example.com/stackscout/news.json" node scripts/fetch-routed-feed.js
 */
const fs = require('fs')
const path = require('path')

const OUTPUT_PATH = path.resolve(__dirname, '..', 'data', 'news-feed-latest.json')

async function main() {
  const url = process.env.STACKSCOUT_ROUTED_FEED_URL
  if (!url) {
    console.log('STACKSCOUT_ROUTED_FEED_URL not set; skipping routed-feed fetch.')
    return
  }

  console.log(`Fetching routed feed from ${url} ...`)
  let response
  try {
    response = await fetch(url, { redirect: 'follow' })
  } catch (error) {
    console.error(`Fetch failed: ${error.message}`)
    process.exit(1)
  }

  if (!response.ok) {
    console.error(`Fetch failed: HTTP ${response.status} ${response.statusText}`)
    process.exit(1)
  }

  let feed
  try {
    feed = await response.json()
  } catch (error) {
    console.error(`Fetch failed: could not parse JSON (${error.message})`)
    process.exit(1)
  }

  if (!feed || typeof feed !== 'object' || Array.isArray(feed)) {
    console.error('Fetched feed is not a JSON object.')
    process.exit(1)
  }
  if (feed.site !== 'Stack Scout') {
    console.error(`Fetched feed site must be "Stack Scout", received "${feed.site || 'missing'}".`)
    process.exit(1)
  }
  if (!Array.isArray(feed.articles) || typeof feed.article_count !== 'number') {
    console.error('Fetched feed is missing articles or article_count.')
    process.exit(1)
  }
  if (feed.articles.length !== feed.article_count) {
    console.error(
      `Fetched feed article_count is ${feed.article_count}; expected ${feed.articles.length}.`,
    )
    process.exit(1)
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  console.log(
    `Wrote ${feed.articles.length} articles to ${path.relative(process.cwd(), OUTPUT_PATH)} ` +
      `(${new Date(feed.generated).toISOString()}).`,
  )
}

main().catch((error) => {
  console.error(`Unhandled failure: ${error.message}`)
  process.exit(1)
})

