const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { importFromFile, validateFeedShape } = require('../scripts/fetch-routed-feed')

function feed(generated, count = 1) {
  return {
    generated,
    site: 'Stack Scout',
    article_count: count,
    articles: Array.from({ length: count }, (_, index) => ({
      title: `Item ${index + 1}`,
      url: `https://example.com/${index + 1}`,
      date: generated,
    })),
  }
}

function makeDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stackscout-feed-'))
  const source = path.join(root, 'source')
  const data = path.join(root, 'data')
  fs.mkdirSync(source)
  fs.mkdirSync(data)
  return { source, data, output: path.join(data, 'news-feed-latest.json') }
}

test('validateFeedShape rejects the wrong site and a mismatched count', () => {
  assert.match(validateFeedShape({ ...feed('2026-10-31T12:00:00Z'), site: 'Other' }), /site must be/)
  assert.match(validateFeedShape({ ...feed('2026-10-31T12:00:00Z'), article_count: 3 }), /article_count is 3/)
  assert.match(validateFeedShape({ ...feed('2026-10-31T12:00:00Z'), generated: 'nope' }), /generated timestamp/)
  assert.equal(validateFeedShape(feed('2026-10-31T12:00:00Z')), null)
})

test('importFromFile writes a newer feed and copies only missing dated companions', () => {
  const { source, data, output } = makeDirs()
  fs.writeFileSync(output, JSON.stringify(feed('2026-10-24T17:46:06Z')))
  fs.writeFileSync(path.join(source, 'news-feed-latest.json'), JSON.stringify(feed('2026-10-31T12:00:31Z', 2)))
  fs.writeFileSync(path.join(source, 'news-feed-2026-10-31.json'), '{}')
  fs.writeFileSync(path.join(source, 'digest-2026-10-31.md'), 'new digest')
  fs.writeFileSync(path.join(source, 'digest-2026-10-24.md'), 'pipeline copy')
  fs.writeFileSync(path.join(source, 'notes.txt'), 'ignored')
  fs.writeFileSync(path.join(data, 'digest-2026-10-24.md'), 'committed copy')

  const result = importFromFile(path.join(source, 'news-feed-latest.json'), { outputPath: output, dataDir: data })

  assert.equal(result.articleCount, 2)
  assert.equal(result.generated, '2026-10-31T12:00:31.000Z')
  assert.deepEqual(result.companions, ['digest-2026-10-31.md', 'news-feed-2026-10-31.json'])
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).article_count, 2)
  assert.equal(fs.readFileSync(path.join(data, 'digest-2026-10-24.md'), 'utf8'), 'committed copy')
  assert.equal(fs.existsSync(path.join(data, 'notes.txt')), false)
})

test('importFromFile refuses a source older than the current feed', () => {
  const { source, data, output } = makeDirs()
  const current = JSON.stringify(feed('2026-10-31T12:00:31Z'))
  fs.writeFileSync(output, current)
  fs.writeFileSync(path.join(source, 'news-feed-latest.json'), JSON.stringify(feed('2026-10-24T17:46:06Z')))

  assert.throws(
    () => importFromFile(path.join(source, 'news-feed-latest.json'), { outputPath: output, dataDir: data }),
    /older than the current/,
  )
  assert.equal(fs.readFileSync(output, 'utf8'), current)
})

test('importFromFile leaves the current feed alone when the source is invalid', () => {
  const { source, data, output } = makeDirs()
  const current = JSON.stringify(feed('2026-10-24T17:46:06Z'))
  fs.writeFileSync(output, current)
  fs.writeFileSync(path.join(source, 'news-feed-latest.json'), JSON.stringify({ ...feed('2026-10-31T12:00:31Z'), site: 'Repo Foundry' }))

  assert.throws(
    () => importFromFile(path.join(source, 'news-feed-latest.json'), { outputPath: output, dataDir: data }),
    /site must be "Stack Scout"/,
  )
  assert.equal(fs.readFileSync(output, 'utf8'), current)
})
