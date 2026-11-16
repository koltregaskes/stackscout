const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']
const LINK_HOSTS = [
  'blog.n8n.io', 'cli.github.com', 'developers.cloudflare.com', 'developers.openai.com',
  'docs.anthropic.com', 'docs.github.com', 'docs.n8n.io', 'elusionworks.com', 'github.com',
  'help.make.com', 'huggingface.co', 'ico.org.uk', 'koltregaskes.com', 'n8n.io', 'openai.com',
  'platform.openai.com', 'playwright.dev', 'policies.google.com', 'techcrunch.com',
  'theairesourcehub.com', 'www.anthropic.com', 'www.digg.com', 'www.make.com', 'www.perplexity.ai',
]
const METADATA_HOSTS = ['schema.org', 'www.w3.org']

function renderPrivacyContent(contactEmail, escapeHtml) {
  const hosts = (list, role) => list.map(host => `<li><code data-privacy-host="${host}" data-privacy-role="${role}">${host}</code></li>`).join('')
  return `
    <section class="hero hero--inner">
      <div class="hero__copy">
        <p class="eyebrow">About your data</p>
        <h1>Privacy notice</h1>
        <p class="hero__lede">Stack Scout is run by Kol Tregaskes. This notice describes the static site's current code and its external connections.</p>
        <p>Last updated: <time datetime="2026-11-15">15 November 2026</time>.</p>
        <p>For privacy questions or rights requests, use the existing contact route: <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>.</p>
      </div>
    </section>
    <section class="section-block detail-grid">
      <div class="detail-main">
        <article class="detail-panel">
          <h2>Hosting and request logs</h2>
          <p>This site is hosted on GitHub Pages at koltregaskes.github.io/stackscout/. GitHub receives requests needed to deliver pages and files. These requests can include your IP address, requested URL, browser information, referring site and request time. GitHub may keep logs for operating and securing its service.</p>
          <p>See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub's privacy statement</a>. Provider log retention and processing locations have not been independently verified for this notice. GitHub's current policy explains its own handling, including any international transfers. A Cloudflare proxy is a proposal, not an active part of this site's code or documented hosting route.</p>
        </article>
        <article class="detail-panel">
          <h2>Fonts and other connections</h2>
          <p>Pages load Archivo, Public Sans and Martian Mono through Google Fonts. Loading a page connects to fonts.googleapis.com for styles and fonts.gstatic.com for font files. Google can receive your IP address, browser information and request metadata. The page sets a strict-origin-when-cross-origin referrer policy. Google Fonts is an external request even though this site has no analytics.</p>
          <p>See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's privacy policy</a> for its handling and any international transfers. Its current retention periods have not been verified here. No other third-party script, image, video, embedded widget or analytics host is loaded by the current built pages. The host lists below distinguish font requests from links and metadata.</p>
        </article>
        <article class="detail-panel">
          <h2>Service worker and browser storage</h2>
          <p>The site registers a service worker and supports installation as a web app. It uses Cache Storage to save the main Stack Scout routes, styles, scripts, manifest, icon and generated catalogue and update metadata. It also caches successful same-origin asset requests made by controlled pages. Navigation tries the network first and can fall back to a cached page or the home page when offline. Cached content can be older than the online version.</p>
          <p>These files are held on your device, not uploaded as browsing history by the site's code. Cache data remains until your browser removes it, you clear website data, or a later worker update replaces caches. You can manage this in your browser's website data and service-worker settings; storage is shared with other sites on the same GitHub Pages origin.</p>
          <p>The current client code does not set cookies or use localStorage or sessionStorage. Catalogue filters and sorting use page memory and the URL query string. A shared or bookmarked URL carries those choices and can appear in browser history or in hosting logs when loaded.</p>
        </article>
        <article class="detail-panel">
          <h2>Analytics, contact and outbound links</h2>
          <p>No analytics collector or analytics script is implemented in the code today. Planned cookieless analytics work, tracked as #1498 and #367, is not active. This notice must be reviewed before analytics is enabled. No profiling or automated decisions are implemented by the site.</p>
          <p>Choosing an external link sends you to another operator, whose privacy terms apply. External links use noreferrer where marked in the code; your browser may still send the destination its usual connection information. A mailto link opens your mail application. If you send an email, your address and message are processed to answer it. Do not include sensitive information unnecessarily.</p>
          <p>The site has no contact form or account database. This repository does not establish the retention period for correspondence in the operator's mailbox. Ask through the contact route for details. Hosting and mail providers may process data outside the UK under their own arrangements.</p>
        </article>
        <article class="detail-panel">
          <h2>Your UK data protection rights</h2>
          <p>Where the UK GDPR applies, you can ask for access to your personal data, correction, erasure, restriction and, where applicable, portability. You can object to processing based on legitimate interests and withdraw consent where processing relies on consent. Rights depend on the circumstances and are not all absolute.</p>
          <p>Site delivery, security and answering correspondence serve legitimate interests in running the site and responding to readers. Handling statutory rights requests may also be required by law. Contact Kol using the email above to exercise your rights or ask about the basis for specific processing. You can complain to the UK's Information Commissioner's Office through <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">the ICO complaints route</a>.</p>
        </article>
      </div>
      <aside class="detail-side">
        <div class="detail-panel">
          <h2>Hosts used by this version</h2>
          <p>Hosting: koltregaskes.github.io. Automatic third-party font requests:</p>
          <ul class="text-list">${hosts(FONT_HOSTS, 'load')}</ul>
          <p>Outbound links, including provider policies and the complaints route. These hosts are contacted when you follow a link, not installed as trackers:</p>
          <ul class="text-list">${hosts(LINK_HOSTS, 'navigation')}</ul>
          <p>Metadata vocabulary and SVG namespace identifiers. Their presence does not itself make a browser request:</p>
          <ul class="text-list">${hosts(METADATA_HOSTS, 'metadata')}</ul>
        </div>
      </aside>
    </section>`
}

module.exports = { renderPrivacyContent }
