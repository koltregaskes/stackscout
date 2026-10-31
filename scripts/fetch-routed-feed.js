/* eslint-disable no-console */
/**
 * Optional routed-feed importer.
 *
 * Copies the classifier-owned routed feed into data/news-feed-latest.json
 * before the build. Two sources are supported:
 *
 *   STACKSCOUT_ROUTED_FEED_URL   download the JSON feed over HTTP(S)
 *   STACKSCOUT_ROUTED_FEED_FILE  read the JSON feed from a local file, such as
 *                                the news pipeline's output folder
 *
 * The URL wins when both are set. The feed is checked for the expected site
 * name and article count, and is only written when that check passes. A feed
 * older than the one already in data/ is refused, so a stale source can never
 * roll the site back. The three-day freshness gate in routed-news.js still
 * applies at build time.
 *
 * For a local file source, dated companions in the same folder
 * (news-feed-YYYY-MM-DD.json and digest-YYYY-MM-DD.md) are copied into data/
 * when data/ does not already have them. Existing dated files are never
 * overwritten.
 *
 * Usage:
 *   STACKSCOUT_ROUTED_FEED_URL="https://example.com/stackscout/news.json" node scripts/fetch-routed-feed.js
 *   STACKSCOUT_ROUTED_FEED_FILE="F:\\path\\to\\news-feed-latest.json" node scripts/fetch-routed-feed.js
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.resolve(__dirname, '..', 'data')
const OUTPUT_PATH = path.join(DATA_DIR, 'news-feed-latest.json')
const DATED_COMPANION_PATTERN = /^(?:news-feed-\d{4}-\d{2}-\d{2}\.json|digest-\d{4}-\d{2}-\d{2}\.md)$/

function validateFeedShape(feed) {
  if (!feed || typeof feed !== 'object' || Array.isArray(feed)) {
    return 'Routed feed is not a JSON object.'
  }
  if (feed.site !== 'Stack Scout') {
    return `Routed feed site must be "Stack Scout", received "${feed.site || 'missing'}".`
  }
  if (!Array.isArray(feed.articles) || typeof feed.article_count !== 'number') {
    return 'Routed feed is missing articles or article_count.'
  }
  if (feed.articles.length !== feed.article_count) {
    return `Routed feed article_count is ${feed.article_count}; expected ${feed.articles.length}.`
  }
  if (Number.isNaN(new Date(feed.generated).getTime())) {
    return 'Routed feed has no valid generated timestamp.'
  }
  return null
}

function readExistingGenerated(outputPath) {
  try {
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8').replace(/^\uFEFF/, ''))
    const time = new Date(existing?.generated).getTime()
    return Number.isNaN(time) ? null : time
  } catch {
    return null
  }
}

function writeFeed(feed, outputPath = OUTPUT_PATH) {
  const shapeError = validateFeedShape(feed)
  if (shapeError) {
    throw new Error(shapeError)
  }

  const incomingTime = new Date(feed.generated).getTime()
  const existingTime = readExistingGenerated(outputPath)
  if (existingTime != null && incomingTime < existingTime) {
    throw new Error(
      `Routed feed source was generated ${new Date(incomingTime).toISOString()}, ` +
        `older than the current ${new Date(existingTime).toISOString()}. Refusing to replace it.`,
    )
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  return { articleCount: feed.articles.length, generated: new Date(incomingTime).toISOString() }
}

function copyDatedCompanions(sourceDir, dataDir = DATA_DIR) {
  const copied = []
  for (const name of fs.readdirSync(sourceDir).sort()) {
    if (!DATED_COMPANION_PATTERN.test(name)) {
      continue
    }
    const destination = path.join(dataDir, name)
    if (fs.existsSync(destination)) {
      continue
    }
    fs.copyFileSync(path.join(sourceDir, name), destination)
    copied.push(name)
  }
  return copied
}

function importFromFile(filePath, { outputPath = OUTPUT_PATH, dataDir = DATA_DIR } = {}) {
  const resolved = path.resolve(filePath)
  let feed
  try {
    feed = JSON.parse(fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new Error(`Could not read routed feed file ${resolved}: ${error.message}`)
  }

  const written = writeFeed(feed, outputPath)
  const companions = copyDatedCompanions(path.dirname(resolved), dataDir)
  return { ...written, companions }
}

async function importFromUrl(url, { outputPath = OUTPUT_PATH } = {}) {
  let response
  try {
    response = await fetch(url, { redirect: 'follow' })
  } catch (error) {
    throw new Error(`Fetch failed: ${error.message}`)
  }
  if (!response.ok) {
    throw new Error(`Fetch failed: HTTP ${response.status} ${response.statusText}`)
  }

  let feed
  try {
    feed = await response.json()
  } catch (error) {
    throw new Error(`Fetch failed: could not parse JSON (${error.message})`)
  }

  return { ...writeFeed(feed, outputPath), companions: [] }
}

async function main() {
  const url = process.env.STACKSCOUT_ROUTED_FEED_URL
  const file = process.env.STACKSCOUT_ROUTED_FEED_FILE

  let result
  if (url) {
    console.log(`Fetching routed feed from ${url} ...`)
    result = await importFromUrl(url)
  } else if (file) {
    console.log(`Importing routed feed from ${file} ...`)
    result = importFromFile(file)
  } else {
    console.log('Neither STACKSCOUT_ROUTED_FEED_URL nor STACKSCOUT_ROUTED_FEED_FILE is set; skipping routed-feed import.')
    return
  }

  console.log(
    `Wrote ${result.articleCount} articles to ${path.relative(process.cwd(), OUTPUT_PATH)} (${result.generated}).`,
  )
  if (result.companions.length > 0) {
    console.log(`Copied ${result.companions.length} dated companion file(s): ${result.companions.join(', ')}`)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}

module.exports = {
  copyDatedCompanions,
  importFromFile,
  validateFeedShape,
  writeFeed,
}
