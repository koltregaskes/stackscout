const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

test('generated privacy route has contact, dated notice and search/agent discovery', () => {
  const privacy = read('privacy/index.html')
  assert.ok(privacy.includes(`mailto:${require('../site-config.json').contactEmail}`))
  for (const phrase of ['GitHub Pages', 'fonts.googleapis.com', 'fonts.gstatic.com', 'Cache Storage', 'localStorage',
    'not active', 'ICO complaints route', '2026-11-15', 'a proposal']) assert.ok(privacy.includes(phrase), phrase)
  const url = 'https://koltregaskes.github.io/stackscout/privacy/'
  assert.ok(privacy.includes(`<link rel="canonical" href="${url}">`))
  assert.ok(privacy.includes(`property="og:url" content="${url}"`))
  assert.ok(read('sitemap.xml').includes(`<loc>${url}</loc>`))
  assert.ok(read('llms.txt').includes(`[Privacy notice](${url})`))
  assert.ok(JSON.parse(read('data/page-registry.json')).pages.some(page => page.href === 'privacy/'))
})

test('SVG and manifest external references are guarded too', async () => {
  const { inspectPrivacyHosts } = await import('../scripts/check-privacy-hosts.mjs')
  const os = require('node:os')
  for (const [file, source] of [['icon.svg', '<svg><image href="https://surprise.invalid/x"/></svg>'],
    ['manifest.json', '{"icons":[{"src":"https://surprise.invalid/x"}]}']]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-privacy-assets-'))
    fs.mkdirSync(path.join(dir, 'privacy'))
    fs.writeFileSync(path.join(dir, 'privacy/index.html'), '<code data-privacy-role="load" data-privacy-host="fonts.gstatic.com">fonts.gstatic.com</code><footer><a href="/privacy/">Privacy notice</a></footer>')
    fs.writeFileSync(path.join(dir, 'seo-config.json'), '{"base":"https://site.invalid/"}')
    fs.writeFileSync(path.join(dir, file), source)
    assert.ok((await inspectPrivacyHosts(dir)).errors.some(error => error.includes('surprise.invalid')), file)
  }
})
