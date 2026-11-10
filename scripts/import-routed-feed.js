/* eslint-disable no-console */
/**
 * Import the routed Stack Scout news feed from the shared news router's
 * output folder into this repo's data/ folder.
 *
 * Since the 25 Oct 2026 repo move, the news router writes Stack Scout's feed
 * to a pipeline-output folder outside this checkout instead of straight into
 * data/. Without this import the build kept reading the last feed that landed
 * in data/ (24 Oct) and failed its freshness check every day.
 *
 * Source folder: first CLI argument, or STACKSCOUT_ROUTED_FEED_DIR.
 * The feed is validated (shape and freshness) before anything is written, and
 * an older feed never replaces a newer one already in data/.
 *
 * Usage:
 *   node scripts/import-routed-feed.js "F:\Repos\websites\_pipeline-output\stackscout\data"
 */
const fs = require('fs')
const path = require('path')

const { assertRoutedNewsFeed } = require('./routed-news')

const DEFAULT_TARGET_DIR = path.resolve(__dirname, '..', 'data')

function readFeed(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  return JSON.parse(text)
}

function readFeedIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null
  try {
    return readFeed(filePath)
  } catch {
    return null
  }
}

function importRoutedFeed({ sourceDir, targetDir = DEFAULT_TARGET_DIR, now = new Date() } = {}) {
  if (!sourceDir) {
    throw new Error('No routed feed source folder given (argument or STACKSCOUT_ROUTED_FEED_DIR).')
  }
  const sourceLatest = path.join(sourceDir, 'news-feed-latest.json')
  if (!fs.existsSync(sourceLatest)) {
    throw new Error(`Routed feed not found at ${sourceLatest}.`)
  }

  const feed = readFeed(sourceLatest)
  if (feed.site !== 'Stack Scout') {
    throw new Error(`Routed feed site must be "Stack Scout", received "${feed.site || 'missing'}".`)
  }
  // Throws with a clear message if the router itself has gone stale.
  const provenance = assertRoutedNewsFeed(feed, { now })

  const targetLatest = path.join(targetDir, 'news-feed-latest.json')
  const current = readFeedIfPresent(targetLatest)
  const currentGenerated = current ? new Date(current.generated).getTime() : NaN
  const sourceGenerated = new Date(feed.generated).getTime()
  if (Number.isFinite(currentGenerated) && currentGenerated >= sourceGenerated) {
    return { imported: false, reason: 'already-current', generatedAt: provenance.generatedAt, files: [] }
  }

  const day = provenance.generatedAt.slice(0, 10)
  const copies = [
    ['news-feed-latest.json', 'news-feed-latest.json'],
    [`news-feed-${day}.json`, `news-feed-${day}.json`],
    [`digest-${day}.md`, `digest-${day}.md`],
  ]

  fs.mkdirSync(targetDir, { recursive: true })
  const written = []
  for (const [fromName, toName] of copies) {
    const from = path.join(sourceDir, fromName)
    if (!fs.existsSync(from)) continue
    fs.copyFileSync(from, path.join(targetDir, toName))
    written.push(toName)
  }

  return { imported: true, generatedAt: provenance.generatedAt, itemCount: provenance.itemCount, files: written }
}

if (require.main === module) {
  try {
    const sourceDir = process.argv[2] || process.env.STACKSCOUT_ROUTED_FEED_DIR
    const result = importRoutedFeed({ sourceDir })
    if (result.imported) {
      console.log(
        `Imported routed feed generated ${result.generatedAt} (${result.itemCount} items): ${result.files.join(', ')}.`,
      )
    } else {
      console.log(`Routed feed in data/ is already current (${result.generatedAt}); nothing imported.`)
    }
  } catch (error) {
    console.error(`Routed feed import failed: ${error.message}`)
    process.exit(1)
  }
}

module.exports = { importRoutedFeed }
