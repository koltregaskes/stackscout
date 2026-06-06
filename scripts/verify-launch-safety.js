const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '..')
const PUBLIC_ENTRIES = [
  'index.html',
  'catalog',
  'categories',
  'collections',
  'data',
  'method',
  'radar',
  'tools',
  'updates',
  'app.js',
  'pwa.js',
  'service-worker.js',
  'manifest.json',
  'styles.css',
  'sitemap.xml',
  'icon.svg',
]
const REQUIRED_PUBLIC_FILES = [
  'index.html',
  'catalog/index.html',
  'categories/index.html',
  'collections/index.html',
  'data/page-registry.json',
  'data/tools-manifest.json',
  'data/updates-manifest.json',
  'data/categories-manifest.json',
  'data/methodology-manifest.json',
  'data/collections-manifest.json',
  'data/radar-manifest.json',
  'method/index.html',
  'radar/index.html',
  'updates/index.html',
  'app.js',
  'pwa.js',
  'service-worker.js',
  'manifest.json',
  'styles.css',
  'sitemap.xml',
  'icon.svg',
]
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.svg', '.txt', '.xml'])
const PRIVATE_PATTERNS = [
  { label: 'Kol Windows user path', pattern: /\b[A-Z]:[\\/]Users[\\/](?:koltregaskes|kolin)[\\/][^\s"'<>)]*/i },
  { label: 'W drive estate path', pattern: /\bW:[\\/][^\s"'<>)]*/i },
  { label: 'estate UNC path', pattern: /\\\\(?:\?\\)?(?:nas_storage_1|MINI-PC|localhost|127\.0\.0\.1)[\\/][^\s"'<>)]*/i },
  { label: 'local-only surface marker', pattern: /\b(?:tools-hub-local|LOCAL-ONLY|_local)\b/ },
  { label: 'private operations wording', pattern: /\b(?:manager inbox|review evidence|session state)\b/i },
]
const REQUIRED_GITIGNORE_PATTERNS = ['.env', '.env.*', '*.local.md', '.local/', 'local-hub/']
const REQUIRED_APP_SHELL_ENTRIES = [
  '',
  'index.html',
  'catalog/',
  'categories/',
  'updates/',
  'radar/',
  'collections/',
  'method/',
  'styles.css',
  'app.js',
  'pwa.js',
  'manifest.json',
  'icon.svg',
  'data/page-registry.json',
  'data/tools-manifest.json',
  'data/updates-manifest.json',
  'data/categories-manifest.json',
  'data/methodology-manifest.json',
  'data/collections-manifest.json',
  'data/radar-manifest.json',
]
const MONTH_NUMBERS = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT_DIR, relativePath))
}

function walk(relativePath) {
  const absolutePath = path.join(ROOT_DIR, relativePath)
  if (!fs.existsSync(absolutePath)) {
    return []
  }

  const stat = fs.statSync(absolutePath)
  if (stat.isDirectory()) {
    return fs.readdirSync(absolutePath).flatMap((entry) => walk(path.join(relativePath, entry)))
  }

  return [relativePath]
}

function collectPublicTextFiles() {
  return PUBLIC_ENTRIES.flatMap(walk).filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()))
}

function extractIssueDate() {
  const indexHtml = readText('index.html')
  const issueMatch = indexHtml.match(/Updated ([0-9]{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([0-9]{4})/)
  if (!issueMatch) {
    return new Date().toISOString().slice(0, 10)
  }

  return `${issueMatch[3]}-${MONTH_NUMBERS[issueMatch[2]]}-${issueMatch[1].padStart(2, '0')}`
}

function extractCacheName() {
  const serviceWorker = readText('service-worker.js')
  const cacheMatch = serviceWorker.match(/const CACHE_NAME = ['"]([^'"]+)['"]/)
  if (!cacheMatch) {
    throw new Error('service-worker.js does not declare CACHE_NAME.')
  }

  return cacheMatch[1]
}

function assertNoPrivateLeaks(files) {
  const leaks = []

  for (const file of files) {
    const text = readText(file)
    for (const { label, pattern } of PRIVATE_PATTERNS) {
      if (pattern.test(text)) {
        leaks.push(`${file}: ${label}`)
      }
    }
  }

  if (leaks.length) {
    throw new Error(`Public output contains private/local markers:\n${leaks.join('\n')}`)
  }
}

function assertRequiredFiles() {
  const missing = REQUIRED_PUBLIC_FILES.filter((file) => !exists(file))
  if (missing.length) {
    throw new Error(`Missing required public files:\n${missing.join('\n')}`)
  }
}

function assertServiceWorkerFreshness() {
  const serviceWorker = readText('service-worker.js')
  const cacheName = extractCacheName()
  const cacheDateMatch = cacheName.match(/^stackscout-(\d{4}-\d{2}-\d{2})$/)
  if (!cacheDateMatch) {
    throw new Error(`CACHE_NAME must use stackscout-YYYY-MM-DD format; found ${cacheName}.`)
  }

  const issueDate = extractIssueDate()
  if (cacheDateMatch[1] < issueDate) {
    throw new Error(`CACHE_NAME ${cacheName} is older than visible generated date ${issueDate}.`)
  }

  const missingShellEntries = REQUIRED_APP_SHELL_ENTRIES.filter((entry) => !serviceWorker.includes(`'${entry}'`))
  if (missingShellEntries.length) {
    throw new Error(`service-worker.js is missing app-shell entries:\n${missingShellEntries.join('\n')}`)
  }

  return { cacheName }
}

function assertGitignoreKeepsPrivateNotesOut() {
  const gitignore = readText('.gitignore')
  const missing = REQUIRED_GITIGNORE_PATTERNS.filter((entry) => !gitignore.includes(entry))
  if (missing.length) {
    throw new Error(`.gitignore is missing private/local exclusions:\n${missing.join('\n')}`)
  }
}

function assertReadmeDocumentsLaunchGate() {
  const readme = readText('README.md')
  const requiredPhrases = [
    'npm run verify:launch',
    'GitHub Pages does not support custom response headers',
    'service-worker.js',
  ]
  const missing = requiredPhrases.filter((phrase) => !readme.includes(phrase))
  if (missing.length) {
    throw new Error(`README.md is missing launch-safety guidance:\n${missing.join('\n')}`)
  }
}

function main() {
  assertRequiredFiles()
  const publicFiles = collectPublicTextFiles()
  assertNoPrivateLeaks(publicFiles)
  const freshness = assertServiceWorkerFreshness()
  assertGitignoreKeepsPrivateNotesOut()
  assertReadmeDocumentsLaunchGate()

  console.log(`Stack Scout launch safety passed: ${publicFiles.length} public files scanned, CACHE_NAME=${freshness.cacheName}.`)
}

try {
  main()
} catch (error) {
  console.error(`Stack Scout launch safety failed: ${error.message}`)
  process.exit(1)
}
