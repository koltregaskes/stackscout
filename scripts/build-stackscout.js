const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '..')
const SOURCE_DIR = path.join(ROOT_DIR, 'content', 'stackscout')
const DATA_DIR = path.join(ROOT_DIR, 'data')
const BUILD_NOW = new Date()
const GENERATED_AT = BUILD_NOW.toISOString().slice(0, 10)
const GENERATED_AT_ISO = BUILD_NOW.toISOString()
const PUBLIC_BASE_URL = 'https://koltregaskes.github.io/stackscout/'
const STATIC_PAGES = [
  ['home', 'Home', 'Editorial front door, featured tools, categories, updates, and the lab subset.', 'index.html'],
  ['catalog', 'Top tools', 'Searchable, filterable catalog of tracked tools and lab products.', 'catalog/index.html'],
  ['categories', 'Categories', 'Landing page for websites, web services, APIs, MCPs, CLIs, and app lanes.', 'categories/index.html'],
  ['updates', 'Wire', 'Recent public activity, releases, direction changes, and noteworthy platform moves.', 'updates/index.html'],
  ['radar', 'Radar', 'The worth-watching layer for tools and systems that are not yet full recommendations.', 'radar/index.html'],
  ['collections', 'Collections', 'Curated use-case groupings that make the catalog easier to navigate.', 'collections/index.html'],
  ['method', 'Sources & method', 'Public badge definitions, freshness rules, and editorial guardrails.', 'method/index.html'],
].map(([key, title, summary, outputPath]) => ({ key, title, summary, outputPath }))
const BADGE_ORDER = ['Recommended', 'Specialist Pick', 'Worth Watching', 'Early but Promising']
const CATEGORY_LABELS = {
  apis: 'APIs',
  mcps: 'MCPs',
  clis: 'CLIs',
  'web-services': 'Web Services',
  'web-apps': 'Web Apps',
  'desktop-apps': 'Desktop Apps',
}

function readJson(relativeFile) {
  return JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, relativeFile), 'utf8'))
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function writeFile(relativePath, content) {
  const outputPath = path.join(ROOT_DIR, relativePath)
  ensureParent(outputPath)
  fs.writeFileSync(outputPath, content, 'utf8')
}

function writeJson(relativePath, value) {
  writeFile(relativePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeExternalJson(absolutePath, value) {
  ensureParent(absolutePath)
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function syncServiceWorkerCacheName() {
  const serviceWorkerPath = path.join(ROOT_DIR, 'service-worker.js')
  const current = fs.readFileSync(serviceWorkerPath, 'utf8')
  const next = current.replace(
    /const CACHE_NAME = ['"]stackscout-\d{4}-\d{2}-\d{2}['"]/,
    `const CACHE_NAME = 'stackscout-${GENERATED_AT}'`,
  )

  if (next !== current) {
    fs.writeFileSync(serviceWorkerPath, next, 'utf8')
  }
}

function resolvePrivatePreviewExportPath() {
  if (process.env.STACKSCOUT_PRIVATE_EXPORT_FILE) {
    return path.resolve(process.env.STACKSCOUT_PRIVATE_EXPORT_FILE)
  }

  if (process.env.STACKSCOUT_PRIVATE_EXPORT_DIR) {
    return path.join(path.resolve(process.env.STACKSCOUT_PRIVATE_EXPORT_DIR), 'stackscout-publishing.json')
  }

  return null
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function titleCaseFromSlug(slug) {
  return String(slug)
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function categoryLabel(slug) {
  return CATEGORY_LABELS[slug] || titleCaseFromSlug(slug)
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00Z`)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function normaliseRoutePath(routePath) {
  return String(routePath || '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
}

function routeDirectorySegments(routePath) {
  const normalised = normaliseRoutePath(routePath)
  const directory = normalised.endsWith('index.html')
    ? normalised.replace(/index\.html$/, '')
    : normalised.replace(/[^/]+$/, '')

  return directory.split('/').filter(Boolean)
}

function routeHref(fromOutputPath, targetPath, { trimIndex = true } = {}) {
  const fromSegments = routeDirectorySegments(fromOutputPath)
  const targetSegments = normaliseRoutePath(targetPath).split('/').filter(Boolean)

  let shared = 0
  while (
    shared < fromSegments.length &&
    shared < targetSegments.length &&
    fromSegments[shared] === targetSegments[shared]
  ) {
    shared += 1
  }

  const up = fromSegments.slice(shared).map(() => '..')
  const down = targetSegments.slice(shared)
  let href = [...up, ...down].join('/')

  if (!href) {
    return './'
  }

  if (trimIndex) {
    href = href.replace(/index\.html$/, '')
  }

  if (!href) {
    return './'
  }

  if (!href.startsWith('.')) {
    href = `./${href}`
  }

  return href
}

function outputHref(fromOutputPath, targetOutputPath) {
  return routeHref(fromOutputPath, targetOutputPath, { trimIndex: true })
}

function outputQueryHref(fromOutputPath, targetOutputPath, params) {
  const href = outputHref(fromOutputPath, targetOutputPath)
  const query = new URLSearchParams(
    Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString()

  return query ? `${href}?${query}` : href
}

function outputAssetHref(fromOutputPath, assetPath) {
  return routeHref(fromOutputPath, assetPath, { trimIndex: false })
}

function pageUrl(outputPath) {
  const normalised = normaliseRoutePath(outputPath)
  if (normalised === 'index.html') {
    return './'
  }

  return normalised.replace(/index\.html$/, '')
}

function badgeTone(label) {
  if (label === 'Recommended') return 'green'
  if (label === 'Specialist Pick') return 'blue'
  if (label === 'Worth Watching') return 'amber'
  return 'violet'
}

function maturityTone(label) {
  if (label === 'Stable') return 'green'
  if (label === 'Fast-moving') return 'amber'
  if (label === 'Experimental') return 'violet'
  return 'ink'
}

function scopeTone(scope) {
  return scope === 'lab' ? 'violet' : 'ink'
}

function buildPageRegistry(tools, categories, collections) {
  return {
    title: 'Stack Scout // Page Registry',
    generatedAt: GENERATED_AT,
    pages: [
      ...STATIC_PAGES.map((page) => ({
        key: page.key,
        title: page.title,
        summary: page.summary,
        href: pageUrl(page.outputPath),
      })),
      ...categories.map((category) => ({
        key: `category-${category.slug}`,
        title: category.title,
        summary: category.description,
        href: pageUrl(`categories/${category.slug}/index.html`),
        parent: 'categories',
      })),
      ...collections.map((collection) => ({
        key: `collection-${collection.slug}`,
        title: collection.title,
        summary: collection.summary,
        href: pageUrl(`collections/index.html#${collection.slug}`),
        parent: 'collections',
      })),
      ...tools.map((tool) => ({
        key: `tool-${tool.slug}`,
        title: tool.name,
        summary: tool.summary,
        href: pageUrl(`tools/${tool.slug}/index.html`),
        parent: 'catalog',
      })),
    ],
  }
}

function buildToolManifest(tools, categories) {
  return {
    title: 'Stack Scout // Tools Manifest',
    generatedAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    summary: 'Public-safe catalog for Stack Scout.',
    counts: {
      total: tools.length,
      ecosystem: tools.filter((tool) => tool.scope === 'ecosystem').length,
      lab: tools.filter((tool) => tool.scope === 'lab').length,
      categories: categories.length,
    },
    tools,
  }
}

function buildCategoriesManifest(categories, tools) {
  return {
    title: 'Stack Scout // Categories',
    generatedAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    categories: categories.map((category) => ({
      ...category,
      count: tools.filter((tool) => tool.category === category.slug).length,
      href: pageUrl(`categories/${category.slug}/index.html`),
    })),
  }
}

function buildUpdatesManifest(updates, toolIndex) {
  return {
    title: 'Stack Scout // Updates',
    generatedAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    summary: 'Public-safe activity stream seeded from official or first-party sources.',
    items: updates.map((item) => ({
      ...item,
      toolName: toolIndex.get(item.toolSlug)?.name || titleCaseFromSlug(item.toolSlug),
      href: pageUrl(`tools/${item.toolSlug}/index.html`),
    })),
  }
}

function buildMethodologyManifest(site) {
  return {
    title: 'Stack Scout // Methodology',
    generatedAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    thesis: site.methodology.thesis,
    principles: site.methodology.principles,
    badges: site.badges,
    maturity: site.maturity,
    freshnessPolicy: site.methodology.freshnessPolicy,
    reviewLimits: site.methodology.reviewLimits,
  }
}

function buildCollectionsManifest(collections, toolIndex) {
  return {
    title: 'Stack Scout // Collections',
    generatedAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    collections: collections.map((collection) => ({
      ...collection,
      items: collection.items.map((slug) => ({
        slug,
        name: toolIndex.get(slug)?.name || titleCaseFromSlug(slug),
        href: pageUrl(`tools/${slug}/index.html`),
      })),
    })),
  }
}

function buildRadarManifest(radar) {
  return {
    title: 'Stack Scout // Radar',
    generatedAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    items: radar,
  }
}

function buildPublishingPreview(tools, updates, categories) {
  return {
    generatedAt: GENERATED_AT,
    generatedAtIso: GENERATED_AT_ISO,
    title: 'Stack Scout public export preview',
    catalogCount: tools.length,
    updateCount: updates.length,
    categoryCount: categories.length,
    ecosystemCount: tools.filter((tool) => tool.scope === 'ecosystem').length,
    labCount: tools.filter((tool) => tool.scope === 'lab').length,
    newestUpdates: updates.slice(0, 8),
    featuredTools: tools
      .filter((tool) => tool.scope === 'ecosystem')
      .slice(0, 6)
      .map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        badge: tool.badge,
        maturity: tool.maturity,
        lastUpdatedAt: tool.lastUpdatedAt,
      })),
    requiredFields: [
      'slug',
      'name',
      'toolType',
      'category',
      'summary',
      'officialUrl',
      'publisher',
      'platforms',
      'pricing',
      'badge',
      'maturity',
      'lastUpdatedAt',
      'tags',
      'docsUrl',
      'repoUrl',
      'socialLinks',
      'latestTrackedChange',
      'relatedTools',
    ],
    requiredNonEmptyFields: [
      'slug',
      'name',
      'toolType',
      'category',
      'summary',
      'officialUrl',
      'publisher',
      'platforms',
      'pricing',
      'badge',
      'maturity',
      'lastUpdatedAt',
      'tags',
      'docsUrl',
      'socialLinks',
      'latestTrackedChange',
      'relatedTools',
    ],
  }
}

function renderChips(values, tone, prefix = '') {
  return values
    .map((value) => `<span class="chip chip--${tone}">${prefix ? `${escapeHtml(prefix)}: ` : ''}${escapeHtml(value)}</span>`)
    .join('')
}

function renderToolCard(tool, outputPath, compact = false) {
  return `
    <article class="scout-card scout-card--tool" data-card
      data-scope="${escapeHtml(tool.scope)}"
      data-type="${escapeHtml(tool.toolType)}"
      data-category="${escapeHtml(tool.category)}"
      data-pricing="${escapeHtml(tool.pricing)}"
      data-badge="${escapeHtml(tool.badge)}"
      data-date="${escapeHtml(tool.lastUpdatedAt)}"
      data-priority="${escapeHtml(String(BADGE_ORDER.length - BADGE_ORDER.indexOf(tool.badge)))}"
      data-search="${escapeHtml([tool.name, tool.summary, tool.publisher, tool.latestTrackedChange, tool.tags.join(' ')].join(' '))}">
      <div class="scout-card__topline">
        <span class="pill pill--${scopeTone(tool.scope)}">${escapeHtml(tool.scope === 'lab' ? 'Stack Scout Lab' : 'Ecosystem')}</span>
        <span class="pill pill--${badgeTone(tool.badge)}">${escapeHtml(tool.badge)}</span>
      </div>
      <div class="signal-mark signal-mark--${escapeHtml(tool.category)}">
        <span>${escapeHtml(tool.name.slice(0, 2).toUpperCase())}</span>
      </div>
      <div class="scout-card__body">
        <p class="label">${escapeHtml(tool.toolType)} / ${escapeHtml(categoryLabel(tool.category))}</p>
        <h3>${escapeHtml(tool.name)}</h3>
        <p class="summary">${escapeHtml(tool.summary)}</p>
        ${compact ? '' : `<p class="card-note">${escapeHtml(tool.latestTrackedChange)}</p>`}
        <div class="chip-row">${renderChips(tool.bestFor.slice(0, compact ? 2 : 3), 'ink')}</div>
      </div>
      <div class="scout-card__meta">
        <span>${escapeHtml(tool.publisher)}</span>
        <span>${escapeHtml(tool.maturity)}</span>
        <span>${escapeHtml(formatDate(tool.lastUpdatedAt))}</span>
      </div>
      <div class="scout-card__actions">
        <a class="button button--primary" href="${outputHref(outputPath, `tools/${tool.slug}/index.html`)}">Open dossier</a>
        <a class="button button--ghost" href="${escapeHtml(tool.officialUrl)}" target="_blank" rel="noreferrer">Official</a>
      </div>
    </article>
  `
}

function renderUpdateCard(update, tool, outputPath, compact = false) {
  return `
    <article class="activity-card${compact ? ' activity-card--compact' : ''}">
      <div class="activity-card__head">
        <div>
          <p class="label">${escapeHtml(tool.toolType)} / ${escapeHtml(tool.name)}</p>
          <h3>${escapeHtml(update.title)}</h3>
        </div>
        <div class="chip-row">
          <span class="pill pill--ink">${escapeHtml(titleCaseFromSlug(update.kind || 'update'))}</span>
          <span class="pill pill--${badgeTone(tool.badge)}">${escapeHtml(tool.badge)}</span>
        </div>
      </div>
      <p class="summary">${escapeHtml(update.summary)}</p>
      <div class="activity-card__meta">
        <span>${escapeHtml(formatDate(update.publishedAt))}</span>
        <span>${escapeHtml(update.sourceLabel)}</span>
      </div>
      <div class="scout-card__actions">
        <a class="button button--ghost" href="${outputHref(outputPath, `tools/${update.toolSlug}/index.html`)}">Tool page</a>
        <a class="button button--ghost" href="${escapeHtml(update.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </article>
  `
}

function renderCollectionCard(collection, toolIndex, outputPath) {
  return `
    <article class="scout-card scout-card--collection" id="${escapeHtml(collection.slug)}">
      <div class="scout-card__topline">
        <span class="pill pill--ink">Collection</span>
        <span class="pill pill--blue">${collection.items.length} picks</span>
      </div>
      <div class="scout-card__body">
        <p class="label">Use-case grouping</p>
        <h3>${escapeHtml(collection.title)}</h3>
        <p class="summary">${escapeHtml(collection.description)}</p>
        <div class="token-list">
          ${collection.items
            .map((slug) => {
              const tool = toolIndex.get(slug)
              return `<a class="token" href="${outputHref(outputPath, `tools/${slug}/index.html`)}">${escapeHtml(tool ? tool.name : titleCaseFromSlug(slug))}</a>`
            })
            .join('')}
        </div>
      </div>
    </article>
  `
}

function renderCategoryCard(category, tools, outputPath) {
  return `
    <article class="scout-card scout-card--category">
      <div class="scout-card__topline">
        <span class="pill pill--ink">Category</span>
        <span class="pill pill--blue">${tools.length} tracked</span>
      </div>
      <div class="signal-mark signal-mark--${escapeHtml(category.slug)} signal-mark--plain">
        <span>${escapeHtml(category.title.slice(0, 1))}</span>
      </div>
      <div class="scout-card__body">
        <p class="label">Public lane</p>
        <h3>${escapeHtml(category.title)}</h3>
        <p class="summary">${escapeHtml(category.description)}</p>
      </div>
      <div class="scout-card__actions">
        <a class="button button--primary" href="${outputHref(outputPath, `categories/${category.slug}/index.html`)}">Open category</a>
      </div>
    </article>
  `
}

function renderRadarCard(item) {
  return `
    <article class="activity-card">
      <div class="activity-card__head">
        <div>
          <p class="label">Radar</p>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        <span class="pill pill--amber">${escapeHtml(item.status)}</span>
      </div>
      <p class="summary">${escapeHtml(item.summary)}</p>
      <p class="card-note">${escapeHtml(item.reason)}</p>
      <div class="scout-card__actions">
        <a class="button button--ghost" href="${escapeHtml(item.officialUrl)}" target="_blank" rel="noreferrer">Official</a>
        <a class="button button--ghost" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </article>
  `
}

function renderNav(currentKey, outputPath) {
  return STATIC_PAGES.map((page) => {
    const active = currentKey === page.key ? ' aria-current="page"' : ''
    return `<a href="${outputHref(outputPath, page.outputPath)}"${active}>${escapeHtml(page.title)}</a>`
  }).join('')
}

function renderDocument({ title, description, currentKey, outputPath, content }) {
  const homeHref = outputHref(outputPath, 'index.html')
  const siteRoot = homeHref === './' ? './' : homeHref
  const sourceHref = outputHref(outputPath, 'method/index.html')
  const rootClass = 'mood-graphite'

  return `<!DOCTYPE html>
<html lang="en" class="${rootClass}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title.replaceAll('StackScout', 'Stack Scout'))}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(title.replaceAll('StackScout', 'Stack Scout'))}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta name="theme-color" content="#14171c" />
    <link rel="icon" type="image/svg+xml" href="${outputAssetHref(outputPath, 'icon.svg')}" />
    <link rel="apple-touch-icon" href="${outputAssetHref(outputPath, 'icon.svg')}" />
    <link rel="manifest" href="${outputAssetHref(outputPath, 'manifest.json')}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${outputAssetHref(outputPath, 'styles.css')}" />
  </head>
  <body data-page="${escapeHtml(currentKey)}" data-site-root="${escapeHtml(siteRoot)}">
    <div class="ss-grain" aria-hidden="true"></div>
    <header class="site-header">
      <a class="site-brand" href="${homeHref}">
        <span class="site-brand__mark" aria-hidden="true"></span>
        <span class="site-brand__wordmark">Stack <span>Scout</span></span>
      </a>
      <div class="site-header__right">
        <nav class="site-nav" aria-label="Primary">${renderNav(currentKey, outputPath)}</nav>
        <div class="mood-switcher" aria-label="Theme">
          <button class="mood-switcher__button is-active" type="button" data-mood="graphite" aria-label="Graphite theme"></button>
          <button class="mood-switcher__button" type="button" data-mood="midnight" aria-label="Midnight theme"></button>
          <button class="mood-switcher__button" type="button" data-mood="obsidian" aria-label="Obsidian theme"></button>
          <button class="mood-switcher__button" type="button" data-mood="slate" aria-label="Slate theme"></button>
          <button class="mood-switcher__button" type="button" data-mood="carbon" aria-label="Carbon theme"></button>
        </div>
      </div>
    </header>
    <main class="page-shell">${content}</main>
    <footer class="site-footer">
      <div class="site-footer__marquee" aria-label="Stack Scout operating principles">
        <div class="site-footer__marquee-track">
          <span>No affiliate theatre</span>
          <span>No fake scores</span>
          <span>Official sources first</span>
          <span>Used or vetted</span>
          <span>Badges over decimal dust</span>
          <span>Curated, not exhaustive</span>
          <span>No affiliate theatre</span>
          <span>No fake scores</span>
          <span>Official sources first</span>
          <span>Used or vetted</span>
          <span>Badges over decimal dust</span>
          <span>Curated, not exhaustive</span>
        </div>
      </div>
      <div class="site-footer__grid">
        <div>
          <p class="site-footer__brand">Stack <span>Scout</span></p>
          <p>A field log for builder tools, official sources, and the stack worth opening.</p>
        </div>
        <nav class="site-footer__links" aria-label="Main pages">
          <span>Main</span>
          <a href="${homeHref}">Home</a>
          <a href="${outputHref(outputPath, 'catalog/index.html')}">Top tools</a>
          <a href="${outputHref(outputPath, 'updates/index.html')}">Wire</a>
          <a href="${outputHref(outputPath, 'collections/index.html')}">Collections</a>
        </nav>
        <nav class="site-footer__links" aria-label="Projects">
          <span>Projects</span>
          <a href="${outputHref(outputPath, 'radar/index.html')}">Radar</a>
          <a href="${sourceHref}">Sources &amp; method</a>
          <a href="https://theairesourcehub.com/" target="_blank" rel="noreferrer">AI Resource Hub</a>
          <a href="https://elusionworks.com/" target="_blank" rel="noreferrer">Elusion Works</a>
        </nav>
        <div class="site-footer__links">
          <span>Contact</span>
          <a href="https://koltregaskes.com/" target="_blank" rel="noreferrer">Kol Tregaskes</a>
          <a href="https://github.com/koltregaskes/stackscout" target="_blank" rel="noreferrer">GitHub</a>
          <a href="${sourceHref}">Method</a>
        </div>
      </div>
      <div class="site-footer__estate" aria-label="Elusion Works umbrella">
        <div>
          <span>Umbrella home</span>
          <a href="https://elusionworks.com/" target="_blank" rel="noreferrer">Elusion Works</a>
        </div>
        <p>The showcase for Kol's websites, tools, games, and web experiments.</p>
        <a href="https://elusionworks.com/" target="_blank" rel="noreferrer">Visit Elusion Works -&gt;</a>
      </div>
      <div class="site-footer__meta">
        <p><span class="live-dot" aria-hidden="true"></span><span id="utcClock">Live UTC</span></p>
        <p>Updated ${escapeHtml(formatDate(GENERATED_AT))} from the Stack Scout shared source layer.</p>
      </div>
    </footer>
    <script src="${outputAssetHref(outputPath, 'pwa.js')}"></script>
    <script src="${outputAssetHref(outputPath, 'app.js')}"></script>
  </body>
</html>
`
}

function renderHome(site, tools, updates, categories, collections, outputPath) {
  const featuredTools = site.home.featureSlugs.map((slug) => tools.find((tool) => tool.slug === slug)).filter(Boolean)
  const labTools = tools.filter((tool) => tool.scope === 'lab')
  const latestUpdates = updates.slice(0, 6)
  const spotlightUpdate = updates[0]
  const spotlightTool = spotlightUpdate ? tools.find((tool) => tool.slug === spotlightUpdate.toolSlug) : null
  const toolIndex = new Map(tools.map((tool) => [tool.slug, tool]))
  const recommendedCount = tools.filter((tool) => tool.badge === 'Recommended').length
  const mcpCount = tools.filter((tool) => tool.category === 'mcps').length
  const labCount = labTools.length

  return renderDocument({
    title: 'Stack Scout // Home',
    description: site.brand.description,
    currentKey: 'home',
    outputPath,
    content: `
      <section class="hero hero--home hero--launch">
        <div class="hero__copy" data-reveal>
          <p class="eyebrow">${escapeHtml(site.brand.heroEyebrow)}</p>
          <h1>${escapeHtml(site.brand.heroTitle)}</h1>
          <p class="hero__lede">${escapeHtml(site.brand.heroLede)}</p>
          <div class="hero__actions">
            <a class="button button--primary" href="${outputHref(outputPath, 'catalog/index.html')}">Explore catalog</a>
            <a class="button button--ghost" href="${outputHref(outputPath, 'updates/index.html')}">See updates</a>
            <a class="button button--ghost" href="${outputQueryHref(outputPath, 'catalog/index.html', { badge: 'Recommended', scope: 'ecosystem' })}">Open recommended picks</a>
            <button id="installAppBtn" class="button button--ghost" type="button" hidden>Install site</button>
          </div>
          <div class="hero__command-row">
            <a class="token token--link" href="${outputQueryHref(outputPath, 'catalog/index.html', { category: 'mcps' })}">Browse MCPs</a>
            <a class="token token--link" href="${outputQueryHref(outputPath, 'catalog/index.html', { category: 'apis' })}">Browse APIs</a>
            <a class="token token--link" href="${outputQueryHref(outputPath, 'catalog/index.html', { scope: 'lab' })}">Open lab tools</a>
            <a class="token token--link" href="${outputHref(outputPath, 'collections/index.html')}#creator-stack">Creator stack</a>
          </div>
        </div>
        <div class="hero__rail" data-reveal>
          <article class="hero-panel hero-panel--lead">
            <p class="label">Lead signal</p>
            <h2>${escapeHtml(spotlightUpdate?.title || 'Fresh public movement')}</h2>
            <p class="summary">${escapeHtml(spotlightUpdate?.summary || site.brand.description)}</p>
            <div class="hero-panel__meta">
              <span>${escapeHtml(spotlightTool?.name || 'Stack Scout')}</span>
              <span>${escapeHtml(spotlightUpdate ? formatDate(spotlightUpdate.publishedAt) : formatDate(GENERATED_AT))}</span>
              <span>${escapeHtml(spotlightUpdate?.sourceLabel || 'Stack Scout')}</span>
            </div>
            <div class="hero__actions">
              ${spotlightTool ? `<a class="button button--primary" href="${outputHref(outputPath, `tools/${spotlightTool.slug}/index.html`)}">Open dossier</a>` : ''}
              ${spotlightUpdate ? `<a class="button button--ghost" href="${escapeHtml(spotlightUpdate.sourceUrl)}" target="_blank" rel="noreferrer">Read source</a>` : ''}
            </div>
          </article>
          <article class="hero-panel hero-panel--metrics">
            <p class="label">At a glance</p>
            <div class="hero-stat-grid">
              <div class="hero-stat-tile">
                <span>Tracked</span>
                <strong>${tools.length}</strong>
                <p>${tools.filter((tool) => tool.scope === 'ecosystem').length} ecosystem tools</p>
              </div>
              <div class="hero-stat-tile">
                <span>Recommended</span>
                <strong>${recommendedCount}</strong>
                <p>Current strongest public picks</p>
              </div>
              <div class="hero-stat-tile">
                <span>MCPs</span>
                <strong>${mcpCount}</strong>
                <p>Agent-ready protocol surfaces</p>
              </div>
              <div class="hero-stat-tile">
                <span>Lab</span>
                <strong>${labCount}</strong>
                <p>Clearly labelled in-house tools</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="signal-strip" data-reveal>
        ${site.home.heroFacts.map((fact) => `<article class="signal-chip"><p>${escapeHtml(fact)}</p></article>`).join('')}
      </section>

      <section class="section-block" data-reveal>
        <div class="section-head">
          <div>
            <p class="eyebrow">Featured tools this week</p>
            <h2>The current front line.</h2>
          </div>
          <p class="section-copy">A rotating set of ecosystem tools that feel especially relevant right now.</p>
        </div>
        <div class="home-split">
          <div class="card-grid card-grid--featured">${featuredTools.map((tool) => renderToolCard(tool, outputPath)).join('')}</div>
          <aside class="brief-column">
            <article class="brief-panel">
              <p class="label">Quick starts</p>
              <h3>Open the catalog with intent.</h3>
              <div class="brief-list">
                <a class="brief-link" href="${outputQueryHref(outputPath, 'catalog/index.html', { scope: 'ecosystem', badge: 'Recommended' })}">
                  <span>Recommended ecosystem tools</span>
                  <strong>${recommendedCount} picks</strong>
                </a>
                <a class="brief-link" href="${outputQueryHref(outputPath, 'catalog/index.html', { category: 'mcps' })}">
                  <span>MCPs worth trying</span>
                  <strong>${mcpCount} tracked</strong>
                </a>
                <a class="brief-link" href="${outputQueryHref(outputPath, 'catalog/index.html', { scope: 'lab' })}">
                  <span>Stack Scout Lab</span>
                  <strong>${labCount} public builds</strong>
                </a>
                <a class="brief-link" href="${outputHref(outputPath, 'collections/index.html')}#offline-friendly">
                  <span>Offline-friendly shortlist</span>
                  <strong>4 picks</strong>
                </a>
              </div>
            </article>
            <article class="brief-panel">
              <p class="label">Workflow lanes</p>
              <h3>Start from the job, not the logo.</h3>
              <div class="brief-list">
                ${categories
                  .map(
                    (category) => `
                      <a class="brief-link" href="${outputHref(outputPath, `categories/${category.slug}/index.html`)}">
                        <span>${escapeHtml(category.title)}</span>
                        <strong>${tools.filter((tool) => tool.category === category.slug).length} tracked</strong>
                      </a>
                    `,
                  )
                  .join('')}
              </div>
            </article>
          </aside>
        </div>
      </section>

      <section class="section-block" data-reveal>
        <div class="section-head">
          <div>
            <p class="eyebrow">Categories</p>
            <h2>Find a lane before you drown in tabs.</h2>
          </div>
          <p class="section-copy">Stack Scout works best when you enter through a workflow lane, not a random pile of names.</p>
        </div>
        <div class="card-grid card-grid--categories">
          ${categories.map((category) => renderCategoryCard(category, tools.filter((tool) => tool.category === category.slug), outputPath)).join('')}
        </div>
      </section>

      <section class="section-block" data-reveal>
        <div class="section-head">
          <div>
            <p class="eyebrow">Streaming activity</p>
            <h2>What moved recently.</h2>
          </div>
          <p class="section-copy">A lighter public activity stream sourced from official changelogs, release notes, blogs, and first-party repos.</p>
        </div>
        <div class="newsroom-grid">
          <div class="activity-grid">
            ${latestUpdates.slice(0, 3).map((update) => renderUpdateCard(update, toolIndex.get(update.toolSlug), outputPath, true)).join('')}
          </div>
          <aside class="brief-column">
            <article class="brief-panel">
              <p class="label">Signal stream</p>
              <h3>Fresh public movement.</h3>
              <div class="brief-list">
                ${latestUpdates
                  .slice(3, 6)
                  .map(
                    (update) => `
                      <a class="brief-link" href="${outputHref(outputPath, `tools/${update.toolSlug}/index.html`)}">
                        <span>${escapeHtml(update.title)}</span>
                        <strong>${escapeHtml(formatDate(update.publishedAt))}</strong>
                      </a>
                    `,
                  )
                  .join('')}
              </div>
            </article>
          </aside>
        </div>
      </section>

      <section class="section-block" data-reveal>
        <div class="section-head">
          <div>
            <p class="eyebrow">From the lab</p>
            <h2>A clearly labelled subset of our own tools.</h2>
          </div>
          <p class="section-copy">These sit alongside the broader ecosystem rather than replacing it.</p>
        </div>
        <div class="card-grid card-grid--lab">${labTools.map((tool) => renderToolCard(tool, outputPath, true)).join('')}</div>
      </section>

      <section class="section-block" data-reveal>
        <div class="section-head">
          <div>
            <p class="eyebrow">Collections</p>
            <h2>Useful starting packs.</h2>
          </div>
          <p class="section-copy">Curated paths that are easier to share than a raw filtered search link.</p>
        </div>
        <div class="card-grid card-grid--collections">
          ${site.home.featuredCollections
            .map((slug) => collections.find((collection) => collection.slug === slug))
            .filter(Boolean)
            .map((collection) => renderCollectionCard(collection, toolIndex, outputPath))
            .join('')}
        </div>
      </section>
    `,
  })
}

function renderCatalog(tools, categories, outputPath) {
  const toolTypes = [...new Set(tools.map((tool) => tool.toolType))].sort()
  const pricingOptions = [...new Set(tools.map((tool) => tool.pricing))].sort()
  const badges = [...new Set(tools.map((tool) => tool.badge))]
  const newestTracked = [...tools].sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt))[0]

  return renderDocument({
    title: 'Stack Scout // Top tools',
    description: 'Searchable Stack Scout catalog of tracked ecosystem tools and lab products.',
    currentKey: 'catalog',
    outputPath,
    content: `
      <section class="hero hero--inner">
        <div class="hero__copy" data-reveal>
          <p class="eyebrow">Catalog</p>
          <h1>Search first. Scroll second.</h1>
          <p class="hero__lede">The catalog is intentionally selective. It should feel closer to a scout desk than an app store.</p>
          <div class="hero__actions">
            <a class="button button--primary" href="${outputHref(outputPath, 'updates/index.html')}">Open updates</a>
            <a class="button button--ghost" href="${outputHref(outputPath, 'method/index.html')}">Read method</a>
          </div>
        </div>
        <div class="hero__rail" data-reveal>
          <article class="hero-panel hero-panel--lead">
            <p class="label">Newest tracked change</p>
            <h2>${escapeHtml(newestTracked.name)}</h2>
            <p class="summary">${escapeHtml(newestTracked.latestTrackedChange)}</p>
            <div class="hero-panel__meta">
              <span>${escapeHtml(newestTracked.badge)}</span>
              <span>${escapeHtml(formatDate(newestTracked.lastUpdatedAt))}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="section-block" data-reveal>
        <div class="catalog-layout">
          <aside class="catalog-sidebar">
            <div class="catalog-panel">
              <p class="label">Find your lane</p>
              <div class="catalog-toolbar">
                <label class="filter-field filter-field--search">
                  <span>Search</span>
                  <input id="catalogSearch" type="search" placeholder="Search names, summaries, tags, publishers, or latest changes" />
                </label>
                <label class="filter-field">
                  <span>Scope</span>
                  <select id="scopeFilter">
                    <option value="">All</option>
                    <option value="ecosystem">Ecosystem</option>
                    <option value="lab">Stack Scout Lab</option>
                  </select>
                </label>
                <label class="filter-field">
                  <span>Type</span>
                  <select id="typeFilter">
                    <option value="">All</option>
                    ${toolTypes.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}
                  </select>
                </label>
                <label class="filter-field">
                  <span>Category</span>
                  <select id="categoryFilter">
                    <option value="">All</option>
                    ${categories.map((category) => `<option value="${escapeHtml(category.slug)}">${escapeHtml(category.title)}</option>`).join('')}
                  </select>
                </label>
                <label class="filter-field">
                  <span>Pricing</span>
                  <select id="pricingFilter">
                    <option value="">All</option>
                    ${pricingOptions.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}
                  </select>
                </label>
                <label class="filter-field">
                  <span>Badge</span>
                  <select id="badgeFilter">
                    <option value="">All</option>
                    ${badges.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}
                  </select>
                </label>
                <label class="filter-field">
                  <span>Sort</span>
                  <select id="sortFilter">
                    <option value="priority">Editorial priority</option>
                    <option value="newest">Newest tracked change</option>
                    <option value="name">Name</option>
                  </select>
                </label>
              </div>
            </div>
            <div class="catalog-panel">
              <p class="label">Preset views</p>
              <div class="brief-list">
                <a class="brief-link" href="${outputQueryHref(outputPath, 'catalog/index.html', { scope: 'ecosystem', badge: 'Recommended' })}">
                  <span>Recommended ecosystem tools</span>
                  <strong>Fastest route to the strongest picks</strong>
                </a>
                <a class="brief-link" href="${outputQueryHref(outputPath, 'catalog/index.html', { category: 'mcps' })}">
                  <span>MCPs worth trying</span>
                  <strong>Agent-ready protocol surfaces</strong>
                </a>
                <a class="brief-link" href="${outputQueryHref(outputPath, 'catalog/index.html', { scope: 'lab' })}">
                  <span>Stack Scout Lab</span>
                  <strong>Clearly labelled in-house tools</strong>
                </a>
                <a class="brief-link" href="${outputQueryHref(outputPath, 'catalog/index.html', { pricing: 'Usage-based' })}">
                  <span>Usage-based APIs</span>
                  <strong>Paid model and platform surfaces</strong>
                </a>
              </div>
            </div>
          </aside>
          <div class="catalog-main">
            <div class="catalog-results">
              <p id="catalogResultCount">${tools.length} entries</p>
              <p>URL state updates as filters change, so every filtered view is linkable.</p>
            </div>
            <div id="catalogGrid" class="card-grid card-grid--catalog">${tools.map((tool) => renderToolCard(tool, outputPath)).join('')}</div>
          </div>
        </div>
      </section>
    `,
  })
}

function renderToolDetail(tool, relatedTools, toolUpdates, outputPath) {
  return renderDocument({
    title: `Stack Scout // ${tool.name}`,
    description: tool.summary,
    currentKey: 'catalog',
    outputPath,
    content: `
      <section class="hero hero--detail">
        <div class="hero__copy" data-reveal>
          <div class="chip-row">
            <span class="chip chip--${scopeTone(tool.scope)}">${escapeHtml(tool.scope === 'lab' ? 'Stack Scout Lab' : 'Ecosystem')}</span>
            <span class="chip chip--${badgeTone(tool.badge)}">${escapeHtml(tool.badge)}</span>
            <span class="chip chip--${maturityTone(tool.maturity)}">${escapeHtml(tool.maturity)}</span>
          </div>
          <p class="eyebrow">${escapeHtml(tool.toolType)} / ${escapeHtml(categoryLabel(tool.category))}</p>
          <h1>${escapeHtml(tool.name)}</h1>
          <p class="hero__lede">${escapeHtml(tool.summary)}</p>
          <div class="hero__actions">
            <a class="button button--primary" href="${escapeHtml(tool.officialUrl)}" target="_blank" rel="noreferrer">Open official</a>
            ${tool.docsUrl ? `<a class="button button--ghost" href="${escapeHtml(tool.docsUrl)}" target="_blank" rel="noreferrer">Docs</a>` : ''}
            ${tool.repoUrl ? `<a class="button button--ghost" href="${escapeHtml(tool.repoUrl)}" target="_blank" rel="noreferrer">Repo</a>` : ''}
          </div>
          <div class="chip-row">${renderChips(tool.bestFor, 'ink', 'Best for')}</div>
        </div>
        <div class="hero__rail" data-reveal>
          <article class="hero-panel">
            <span class="label">Publisher</span>
            <strong>${escapeHtml(tool.publisher)}</strong>
            <p class="summary">${escapeHtml(tool.toolType)} / ${escapeHtml(categoryLabel(tool.category))}</p>
          </article>
          <article class="hero-panel">
            <span class="label">Pricing</span>
            <strong>${escapeHtml(tool.pricing)}</strong>
            <p class="summary">${tool.platforms.length} platform signal${tool.platforms.length === 1 ? '' : 's'}</p>
          </article>
          <article class="hero-panel">
            <span class="label">Latest tracked change</span>
            <strong>${escapeHtml(formatDate(tool.lastUpdatedAt))}</strong>
            <p>${escapeHtml(tool.latestTrackedChange)}</p>
          </article>
        </div>
      </section>

      <section class="section-block detail-grid" data-reveal>
        <div class="detail-main">
          <div class="section-head">
            <div>
              <p class="eyebrow">Why it matters</p>
              <h2>Stack Scout verdict</h2>
            </div>
          </div>
          <div class="detail-panel detail-panel--prose">
            <p class="lead">${escapeHtml(tool.verdict)}</p>
            <p>${escapeHtml(tool.latestTrackedChange)}</p>
          </div>
          <div class="detail-panel detail-panel--prose">
            <p class="label">Platforms</p>
            <div class="token-list">${tool.platforms.map((platform) => `<span class="token">${escapeHtml(platform)}</span>`).join('')}</div>
            <p class="label">Tags</p>
            <div class="token-list">${tool.tags.map((tag) => `<span class="token">${escapeHtml(tag)}</span>`).join('')}</div>
          </div>
        </div>
        <aside class="detail-side">
          <div class="detail-panel">
            <span class="label">Links</span>
            <div class="link-stack">
              <a href="${escapeHtml(tool.officialUrl)}" target="_blank" rel="noreferrer">Official site</a>
              ${tool.docsUrl ? `<a href="${escapeHtml(tool.docsUrl)}" target="_blank" rel="noreferrer">Documentation</a>` : ''}
              ${tool.repoUrl ? `<a href="${escapeHtml(tool.repoUrl)}" target="_blank" rel="noreferrer">Repository</a>` : ''}
              ${tool.socialLinks.map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`).join('')}
            </div>
          </div>
          <div class="detail-panel">
            <span class="label">Related tools</span>
            <div class="token-list">
              ${relatedTools.length
                ? relatedTools.map((item) => `<a class="token" href="${outputHref(outputPath, `tools/${item.slug}/index.html`)}">${escapeHtml(item.name)}</a>`).join('')
                : '<span class="token">No related tools yet</span>'}
            </div>
          </div>
        </aside>
      </section>

      <section class="section-block" data-reveal>
        <div class="section-head">
          <div>
            <p class="eyebrow">Recent updates</p>
            <h2>Tracked activity</h2>
          </div>
        </div>
        <div class="activity-grid">
          ${toolUpdates.length
            ? toolUpdates.map((item) => renderUpdateCard(item, tool, outputPath)).join('')
            : '<div class="empty-state">No public update entries yet for this tool.</div>'}
        </div>
      </section>

      <section class="section-block" data-reveal>
        <div class="section-head">
          <div>
            <p class="eyebrow">Related tools</p>
            <h2>What sits nearby.</h2>
          </div>
        </div>
        <div class="card-grid">
          ${relatedTools.length
            ? relatedTools.map((item) => renderToolCard(item, outputPath, true)).join('')
            : '<div class="empty-state">No related tools wired yet.</div>'}
        </div>
      </section>
    `,
  })
}

function renderCategoriesIndex(categories, tools, outputPath) {
  return renderDocument({
    title: 'Stack Scout // Categories',
    description: 'All public Stack Scout lanes in one place.',
    currentKey: 'categories',
    outputPath,
    content: `
      <section class="hero hero--inner">
        <div class="hero__copy" data-reveal>
          <p class="eyebrow">Categories</p>
          <h1>Start with the lane, not the logo.</h1>
          <p class="hero__lede">The categories page is a better way into the catalog if you know the problem you are trying to solve.</p>
        </div>
      </section>
      <section class="section-block" data-reveal>
        <div class="card-grid card-grid--categories">
          ${categories.map((category) => renderCategoryCard(category, tools.filter((tool) => tool.category === category.slug), outputPath)).join('')}
        </div>
      </section>
    `,
  })
}

function renderCategoryDetail(category, tools, outputPath) {
  return renderDocument({
    title: `Stack Scout // ${category.title}`,
    description: category.description,
    currentKey: 'categories',
    outputPath,
    content: `
      <section class="hero hero--inner">
        <div class="hero__copy" data-reveal>
          <p class="eyebrow">Category</p>
          <h1>${escapeHtml(category.title)}</h1>
          <p class="hero__lede">${escapeHtml(category.description)}</p>
        </div>
        <div class="hero__rail" data-reveal>
          <div class="hero-stat">
            <span class="label">Tracked here</span>
            <strong>${tools.length}</strong>
            <p>${tools.filter((tool) => tool.scope === 'ecosystem').length} ecosystem tools and ${tools.filter((tool) => tool.scope === 'lab').length} lab entries.</p>
          </div>
        </div>
      </section>
      <section class="section-block" data-reveal>
        <div class="card-grid">${tools.map((tool) => renderToolCard(tool, outputPath)).join('')}</div>
      </section>
    `,
  })
}

function renderUpdates(updates, toolIndex, outputPath) {
  return renderDocument({
    title: 'Stack Scout // Wire',
    description: 'Recent public activity from the Stack Scout cohort.',
    currentKey: 'updates',
    outputPath,
    content: `
      <section class="hero hero--inner">
        <div class="hero__copy" data-reveal>
          <p class="eyebrow">Updates</p>
          <h1>Follow movement, not noise.</h1>
          <p class="hero__lede">Every item here comes from an official or first-party source, with dates visible and no fake "live" claims.</p>
        </div>
      </section>
      <section class="section-block" data-reveal>
        <div class="activity-grid">${updates.map((update) => renderUpdateCard(update, toolIndex.get(update.toolSlug), outputPath)).join('')}</div>
      </section>
    `,
  })
}

function renderRadar(site, outputPath) {
  return renderDocument({
    title: 'Stack Scout // Radar',
    description: 'Worth-watching tools and systems that are not yet full recommendations.',
    currentKey: 'radar',
    outputPath,
    content: `
      <section class="hero hero--inner">
        <div class="hero__copy" data-reveal>
          <p class="eyebrow">Radar</p>
          <h1>Interesting is not the same as ready.</h1>
          <p class="hero__lede">Radar is where Stack Scout puts genuinely interesting systems that still need more evidence before they become default recommendations.</p>
        </div>
      </section>
      <section class="section-block" data-reveal>
        <div class="activity-grid">${site.radar.map((item) => renderRadarCard(item)).join('')}</div>
      </section>
    `,
  })
}

function renderCollections(collections, toolIndex, outputPath) {
  return renderDocument({
    title: 'Stack Scout // Collections',
    description: 'Curated collections that group the Stack Scout catalog by real use case.',
    currentKey: 'collections',
    outputPath,
    content: `
      <section class="hero hero--inner">
        <div class="hero__copy" data-reveal>
          <p class="eyebrow">Collections</p>
          <h1>Shortlists with intent.</h1>
          <p class="hero__lede">Collections are the shareable layer: smaller, more practical starting packs for people who do not want to begin at the full catalog.</p>
        </div>
      </section>
      <section class="section-block" data-reveal>
        <div class="card-grid card-grid--collections">${collections.map((collection) => renderCollectionCard(collection, toolIndex, outputPath)).join('')}</div>
      </section>
    `,
  })
}

function renderMethod(site, outputPath) {
  return renderDocument({
    title: 'Stack Scout // Sources & method',
    description: 'How Stack Scout curates, badges, and updates public entries.',
    currentKey: 'method',
    outputPath,
    content: `
      <section class="hero hero--inner">
        <div class="hero__copy" data-reveal>
          <p class="eyebrow">Method</p>
          <h1>Editorial judgment with visible guardrails.</h1>
          <p class="hero__lede">${escapeHtml(site.methodology.thesis)}</p>
        </div>
      </section>

      <section class="section-block" data-reveal>
        <div class="section-head">
          <div>
            <p class="eyebrow">Principles</p>
            <h2>How Stack Scout decides.</h2>
          </div>
        </div>
        <div class="card-grid card-grid--method">
          ${site.methodology.principles
            .map(
              (item) => `
                <article class="scout-card scout-card--method">
                  <div class="scout-card__body">
                    <p class="label">Principle</p>
                    <h3>${escapeHtml(item.title)}</h3>
                    <p class="summary">${escapeHtml(item.body)}</p>
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="section-block detail-grid" data-reveal>
        <div class="detail-main">
          <div class="section-head">
            <div>
              <p class="eyebrow">Badges</p>
              <h2>Verdict language</h2>
            </div>
          </div>
          <div class="card-grid card-grid--method">
            ${site.badges
              .map(
                (badge) => `
                  <article class="scout-card scout-card--method">
                    <div class="scout-card__topline">
                      <span class="pill pill--${badgeTone(badge.label)}">${escapeHtml(badge.label)}</span>
                    </div>
                    <div class="scout-card__body">
                      <p class="summary">${escapeHtml(badge.description)}</p>
                    </div>
                  </article>
                `,
              )
              .join('')}
          </div>
        </div>
        <aside class="detail-side">
          <div class="detail-panel">
            <span class="label">Freshness policy</span>
            <ul class="text-list">${site.methodology.freshnessPolicy.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
          <div class="detail-panel">
            <span class="label">Review limits</span>
            <ul class="text-list">${site.methodology.reviewLimits.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
        </aside>
      </section>
    `,
  })
}

function buildSitemap(routes) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `  <url><loc>${PUBLIC_BASE_URL}${route}</loc></url>`).join('\n')}
</urlset>
`
}

function main() {
  const privatePreviewExport = resolvePrivatePreviewExportPath()
  const site = readJson('site-source.json')
  const tools = readJson('tools-source.json')
  const updates = readJson('updates-source.json').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const toolIndex = new Map(tools.map((tool) => [tool.slug, tool]))
  const categories = site.categories
  const collections = site.collections

  writeJson('data/page-registry.json', buildPageRegistry(tools, categories, collections))
  writeJson('data/tools-manifest.json', buildToolManifest(tools, categories))
  writeJson('data/updates-manifest.json', buildUpdatesManifest(updates, toolIndex))
  writeJson('data/categories-manifest.json', buildCategoriesManifest(categories, tools))
  writeJson('data/methodology-manifest.json', buildMethodologyManifest(site))
  writeJson('data/collections-manifest.json', buildCollectionsManifest(collections, toolIndex))
  writeJson('data/radar-manifest.json', buildRadarManifest(site.radar))
  syncServiceWorkerCacheName()
  if (privatePreviewExport) {
    writeExternalJson(privatePreviewExport, buildPublishingPreview(tools, updates, categories))
  }

  writeFile('index.html', renderHome(site, tools, updates, categories, collections, 'index.html'))
  writeFile('catalog/index.html', renderCatalog(tools, categories, 'catalog/index.html'))
  writeFile('categories/index.html', renderCategoriesIndex(categories, tools, 'categories/index.html'))
  writeFile('updates/index.html', renderUpdates(updates, toolIndex, 'updates/index.html'))
  writeFile('radar/index.html', renderRadar(site, 'radar/index.html'))
  writeFile('collections/index.html', renderCollections(collections, toolIndex, 'collections/index.html'))
  writeFile('method/index.html', renderMethod(site, 'method/index.html'))

  categories.forEach((category) => {
    writeFile(
      `categories/${category.slug}/index.html`,
      renderCategoryDetail(category, tools.filter((tool) => tool.category === category.slug), `categories/${category.slug}/index.html`),
    )
  })

  tools.forEach((tool) => {
    writeFile(
      `tools/${tool.slug}/index.html`,
      renderToolDetail(
        tool,
        tool.relatedTools.map((slug) => toolIndex.get(slug)).filter(Boolean),
        updates.filter((item) => item.toolSlug === tool.slug),
        `tools/${tool.slug}/index.html`,
      ),
    )
  })

  const sitemapRoutes = [
    '',
    'catalog/',
    'categories/',
    'updates/',
    'radar/',
    'collections/',
    'method/',
    ...categories.map((category) => `categories/${category.slug}/`),
    ...tools.map((tool) => `tools/${tool.slug}/`),
  ]

  writeFile('sitemap.xml', buildSitemap(sitemapRoutes))
  console.log(
    `Stack Scout build complete. Generated ${tools.length} tool pages, ${categories.length} category pages, and ${updates.length} updates.`,
  )
}

main()
