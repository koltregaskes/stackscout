const crypto = require('crypto')

const ROUTED_NEWS_PUBLIC_PATH = 'data/news-feed-latest.json'
const DEFAULT_MAX_ROUTED_NEWS_AGE_DAYS = 3

const NAMED_HTML_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

function decodeHtmlEntities(value) {
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lowerEntity = entity.toLowerCase()
    if (lowerEntity.startsWith('#x')) {
      const codePoint = Number.parseInt(lowerEntity.slice(2), 16)
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
    }
    if (lowerEntity.startsWith('#')) {
      const codePoint = Number.parseInt(lowerEntity.slice(1), 10)
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
    }
    return NAMED_HTML_ENTITIES[lowerEntity] ?? match
  })
}

function normaliseMojibake(value) {
  return String(value || '')
    .replaceAll('Â·', '·')
    .replaceAll('â€™', '’')
    .replaceAll('â€œ', '“')
    .replaceAll('â€', '”')
    .replaceAll('â€“', '–')
    .replaceAll('â€”', '—')
    .replaceAll('â€¦', '…')
}

function cleanPublicText(value) {
  return decodeHtmlEntities(
    normaliseMojibake(value)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(?:p|li|h[1-6])>/gi, '. ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .replace(/(?:\.\s*){2,}/g, '. ')
    .trim()
}

function truncate(value, maxLength = 360) {
  const text = String(value || '').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function parseDate(value, label) {
  const parsed = new Date(value || '')
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Stack Scout routed news ${label} is missing or invalid.`)
  }
  return parsed
}

function projectName(article) {
  const source = cleanPublicText(article.source)
  const namedSource = source.split('·').at(-1)?.trim()
  if (namedSource) return namedSource

  try {
    return new URL(article.url).hostname.replace(/^www\./, '')
  } catch {
    return 'External source'
  }
}

function updateKind(article) {
  const tags = new Set([...(article.tags || []), ...(article.matching_tags || [])])
  if (/\/releases?\//i.test(article.url)) return 'release'
  if (tags.has('product_launch')) return 'launch'
  if (tags.has('api_update')) return 'api update'
  if (tags.has('mcp')) return 'mcp update'
  return 'tool update'
}

function stableId(article, publishedAt) {
  const digest = crypto
    .createHash('sha256')
    .update(`${article.url}\n${article.title}\n${publishedAt}`)
    .digest('hex')
    .slice(0, 16)
  return `routed-${digest}`
}

function assertRoutedNewsFeed(
  feed,
  {
    now = new Date(),
    maxAgeDays = DEFAULT_MAX_ROUTED_NEWS_AGE_DAYS,
    expectedSite = 'Stack Scout',
  } = {},
) {
  if (!feed || typeof feed !== 'object' || Array.isArray(feed)) {
    throw new Error('Stack Scout routed news feed is missing.')
  }
  if (feed.site !== expectedSite) {
    throw new Error(`Stack Scout routed news feed site must be "${expectedSite}", received "${feed.site || 'missing'}".`)
  }
  if (!Array.isArray(feed.articles) || feed.articles.length === 0) {
    throw new Error('Stack Scout routed news feed has no articles.')
  }
  if (Number(feed.article_count) !== feed.articles.length) {
    throw new Error(
      `Stack Scout routed news article_count is ${feed.article_count}; expected ${feed.articles.length}.`,
    )
  }

  const nowDate = parseDate(now, 'verification clock')
  const generatedAt = parseDate(feed.generated, 'generated timestamp')
  const maxAgeMs = Number(maxAgeDays) * 86_400_000
  const futureToleranceMs = 5 * 60_000
  const generatedAgeMs = nowDate.getTime() - generatedAt.getTime()

  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    throw new Error('Stack Scout routed news maximum age must be a positive number of days.')
  }
  if (generatedAgeMs < -futureToleranceMs) {
    throw new Error('Stack Scout routed news generated timestamp is in the future.')
  }
  if (generatedAgeMs > maxAgeMs) {
    throw new Error(
      `Stack Scout routed news feed is ${(generatedAgeMs / 86_400_000).toFixed(1)} days old; maximum is ${maxAgeDays}.`,
    )
  }

  const articleDates = feed.articles.map((article, index) => {
    if (!article?.title || !article?.url) {
      throw new Error(`Stack Scout routed news article ${index + 1} is missing title or URL.`)
    }

    let parsedUrl
    try {
      parsedUrl = new URL(article.url)
    } catch {
      throw new Error(`Stack Scout routed news article ${index + 1} has an invalid URL.`)
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Stack Scout routed news article ${index + 1} URL must use HTTP or HTTPS.`)
    }

    return parseDate(article.date, `article ${index + 1} date`)
  })

  const newestItemAt = new Date(Math.max(...articleDates.map((date) => date.getTime())))
  const newestItemAgeMs = nowDate.getTime() - newestItemAt.getTime()
  if (newestItemAgeMs < -futureToleranceMs) {
    throw new Error('Stack Scout routed news newest article timestamp is in the future.')
  }
  if (newestItemAgeMs > maxAgeMs) {
    throw new Error(
      `Stack Scout routed news newest article is ${(newestItemAgeMs / 86_400_000).toFixed(1)} days old; maximum is ${maxAgeDays}.`,
    )
  }

  return {
    consumerPath: ROUTED_NEWS_PUBLIC_PATH,
    generatedAt: generatedAt.toISOString(),
    newestItemAt: newestItemAt.toISOString(),
    itemCount: feed.articles.length,
  }
}

function compileRoutedNewsFeed(feed, options = {}) {
  const provenance = assertRoutedNewsFeed(feed, options)
  const updates = feed.articles
    .map((article) => {
      const publishedAtIso = parseDate(article.date, 'article date').toISOString()
      const publishedAt = publishedAtIso.slice(0, 10)
      const sourceLabel = cleanPublicText(article.source) || projectName(article)
      const sourceProject = projectName(article)
      const rawTitle = cleanPublicText(article.title)
      const title = /^v?\d+(?:[.-]\d+)*/i.test(rawTitle)
        ? `${sourceProject} ${rawTitle}`
        : rawTitle
      const summary = truncate(cleanPublicText(article.summary || article.title))

      return {
        id: stableId(article, publishedAtIso),
        toolSlug: null,
        kind: updateKind(article),
        title,
        summary: summary || `Routed public update from ${sourceProject}.`,
        publishedAt,
        sourceLabel,
        sourceUrl: article.url,
        projectName: sourceProject,
        externalSignal: true,
      }
    })
    .filter((item) => item.title && item.summary)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))

  if (updates.length === 0) {
    throw new Error('Stack Scout routed news feed produced no public-safe updates.')
  }

  return {
    updates,
    provenance: {
      ...provenance,
      consumedItems: updates.length,
    },
  }
}

function mergeUpdates(staticUpdates, routedUpdates) {
  const seenUrls = new Set()
  return [...routedUpdates, ...staticUpdates]
    .filter((item) => {
      const key = item.sourceUrl || item.id
      if (seenUrls.has(key)) return false
      seenUrls.add(key)
      return true
    })
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
}

module.exports = {
  DEFAULT_MAX_ROUTED_NEWS_AGE_DAYS,
  ROUTED_NEWS_PUBLIC_PATH,
  assertRoutedNewsFeed,
  cleanPublicText,
  compileRoutedNewsFeed,
  mergeUpdates,
}
