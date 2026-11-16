# Stack Scout

`stackscout` builds **Stack Scout**, the public-facing tools destination for curated builder tools, services, APIs, MCPs, and CLIs.

This repo remains the GitHub Pages implementation base, but the visible product is no longer a simple internal "Tools Hub" brochure. The private operational console stays outside this public repo.

## Public vs private

- This repo is public-facing only.
- Local launchers, operations state, and review artefacts belong in the private local surface, not this repo.
- Public content must stay safe for GitHub Pages and public browsing.
- Do not rely on `.gitignore` alone to protect private data. Public output is generated from an allowlisted shared source layer.

## Shared source layer

Stack Scout uses a shared source layer inside this repo:

- `content/stackscout/site-source.json`
- `content/stackscout/tools-source.json`
- `content/stackscout/updates-source.json`

These source files drive:

- public manifests in `data/`
- generated static pages across the public site
- an optional private preview export when `STACKSCOUT_PRIVATE_EXPORT_DIR` or `STACKSCOUT_PRIVATE_EXPORT_FILE` is set locally

The public Wire also consumes the classifier-owned routed feed at
`data/news-feed-latest.json`. A build fails if that feed or its newest item is
more than three days old. `data/source-provenance.json` records the exact
consumer path, feed timestamp, newest-item timestamp, and consumed count.

## Build

```bash
npm run build:site
```

This regenerates:

- `index.html`
- `catalog/`
- `categories/`
- `updates/`
- `radar/`
- `collections/`
- `method/`
- `tools/<slug>/`
- `data/*.json`
- `sitemap.xml`

## Checks

```bash
npm run check
```

`npm run check` also runs routed-feed contract tests and the no-publish
launch-safety gate:

```bash
npm run verify:launch
```

That gate scans generated public output for local Windows paths and private surface markers, confirms the public file set exists, checks `.gitignore` still excludes local notes and env files, and verifies the `service-worker.js` cache name matches the current versioned asset revision.

It also proves the newest routed item reached the updates manifest and rendered
Wire, and that visible dates come from the routed source timestamp rather than
the wall clock used to run the build.

GitHub Pages does not support custom response headers such as a Netlify `_headers` file. Keep browser hardening inside static HTML, conservative client code, and dependency-free scripts unless the site moves to a host that can set CSP/HSTS-style headers.

The builder generates `koltregaskes-stackscout-sw-v1-<hash>` from the public inputs
and worker implementation. The launch gate recomputes it, so stale worker names
fail even when source dates have not changed. Activation removes only anchored
names in that exact namespace at the current or an older schema version, or an
exact entry in `LEGACY_CACHE_NAMES`. The 49 legacy names were extracted from
`service-worker.js` history reachable from the supplied main and four launch PR
heads; `tests/fixtures/service-worker-legacy-caches.json` records an observing
commit for each. Never replace this migration list with prefix or date matching.
An unknown cache belongs to someone else unless ownership is established.

## Refresh

```bash
npm run refresh:site
```

This runs the site build, runs checks, and optionally writes private refresh status when `STACKSCOUT_PRIVATE_STATUS_DIR` is set locally.

For unattended Windows refreshes without visible terminal focus theft, use a local-only launcher outside this public repo and set the optional private export/status environment variables there.

When `-Publish` is enabled, the refresh now fails safely unless the checkout is
on `main`, exactly matches the freshly fetched `origin/main`, and contains no
staged changes or working-tree changes outside the case-sensitive generated
public allow-list. It re-fetches immediately before committing and stops
without creating a commit if the remote moved during the build. Recovery must
preserve generated output on a review branch; the automation never resets,
rebases, force-pushes, or resolves conflicts.

`robots.txt` and `404.html` are on that allow-list. An untracked `robots.txt`
edit is what stopped the daily publish from 30 Aug 2026 until the allow-list
change on 6 Oct 2026. Publishes resumed on 11 Oct 2026. Any new file outside
the allow-list will stop publishing the same way.

### Diagnostics and the routed feed

The build reads `data/news-feed-latest.json` and fails if its generated time,
or its newest article when the list is not empty, is more than three days old.
A fresh empty article list is valid.

Article relevance requires an asserted builder-tool change or an open-source
tool description. Source-wide tags cannot supply that evidence. Tool noun
phrases use bounded common modifiers, capitalised names and version/hyphenated
tokens; questions and unrelated prose cannot supply a release on their own.
Unlisted wholly lowercase product names can be missed. This is a deterministic
editorial heuristic, not complete natural-language subject recognition.
In object position, up to two unrecognised descriptor words immediately before
the tool noun are allowed, with no free -ing word. Capitalisation alone is not
name evidence in a Title Case object clause. Explicit version lead-ins and
separately marked question trailers can retain an affirmative release statement.
Builder nouns include compilers, debuggers, databases, build tools, testing
frameworks, developer toolkits/profilers and API clients. Generic toolkits and
frameworks still need a builder qualifier. Numbered releases of a tool,
qualified command-line tools, feature additions to a tool and availability
announcements use bounded object phrases. These editorial rules remain
conservative; measured regression accuracy does not establish production accuracy.

`.github/workflows/refresh-routed-feed.yml` runs every day at 05:15 UTC. It
checks out `shared/website-tools/pipelines/news` from `koltregaskes/ai-resource-hub`,
fetches every entry in `config/sources.json`, and applies the Stack Scout filter
in `site-filters.json`. A successful fetch commits `data/news-feed-latest.json`,
including a fresh empty article list when nothing matches, and the pages
`npm run build:site` writes, including `data/updates-manifest.json`, `index.html`,
and `updates/index.html`. If fewer than half the sources fail and no source
marked `required` is lost, the feed is published with reduced-coverage metadata,
a workflow warning and summary, and a visible "Some sources unavailable" notice.
If at least half fail, any required source fails, or no sources are configured,
the run fails and the previous feed is preserved. Published `acquisition`
metadata lists each source outcome and the attempted/succeeded/failed counts.
The ignored `.local/routed-feed-status.json` also records refused refreshes.
Older feeds without coverage metadata show "Source availability: not recorded
for this feed." A recent feed timestamp alone does not establish source health.
After a commit, the same run requests a GitHub Pages build; this does not prove
public delivery.
The job does not invent articles.

`.github/workflows/routed-feed-freshness.yml` remains the early signal. It runs
at 06:30 UTC and fails once the committed feed is one day old, before the
three-day build gate. `scripts/refresh-stackscout.ps1` still only downloads a
feed when `STACKSCOUT_ROUTED_FEED_URL` is set, and that URL is not published.
The shared routing file lists Stack Scout as a destination at
`sites/stackscout/data`.

`STACKSCOUT_ROUTED_FEED_MAX_AGE_DAYS` is an emergency switch only. Set it to a
positive number of days for one run if you must publish while repairing the
feed writer. Unset it afterwards. It does not replace a current feed.

If `STACKSCOUT_ROUTED_FEED_URL` is set, the refresh downloads that JSON into
`data/news-feed-latest.json` before the build. The download is checked for the
expected site name and article count, and a failed download stops the run.

Every refresh writes `stackscout-refresh-status.json` and
`stackscout-refresh.log`. Set `STACKSCOUT_PRIVATE_STATUS_DIR` to keep them
outside the checkout. Otherwise they are written to the ignored `.local/`
directory. The log includes the build and check output, and the status file
records `steps[].error` with the real process exit code.

## Site structure

Code validation and link checks use `npm run build:site -- --snapshot` to rebuild
the committed feed at its original generation time. This checks its shape and
article ages at generation, without changing dates or claiming it is current.
The publisher and the separate scheduled Canary validate workflow continue to
use `npm run build:site` with the wall clock and the three-day freshness limit.
A green code check does not mean daily news delivery is healthy.

The service worker cache includes an asset revision as well as the feed date,
so design releases update cached CSS and JavaScript without waiting for new news.

- `Home`
- `Top tools`
- `Tool Detail`
- `Categories`
- `Wire`
- `Radar`
- `Collections`
- `Sources & method`

## Launch surface highlights

- editorial signal-desk shell rather than a generic directory layout
- shareable catalog filters via URL query state
- public dossier pages for every tracked tool
- source-linked updates and visible freshness dates
- clearly labelled `Stack Scout Lab` subset for in-house tools
- installable static PWA shell for repeat visits

## Notes

- Stack Scout is curated ecosystem first.
- Our own tools are a clearly labelled `Stack Scout Lab` subset, not the whole point of the site.
- Public verdicts use editorial badges, not fake numeric scoring.
- Update items should prefer official release notes, changelogs, docs, blogs, and first-party repositories.
- The catalog now keeps filter state in the URL so filtered views can be shared directly.

## Local-only and ignored

- `.autolab/` is internal AutoResearch support and remains untracked.
- `.env*` files are local-only except `.env.example`.
- `.local/` and `*.local.md` are working notes and remain ignored.

## SEO contract

Run `node scripts/seo.mjs` after public content changes and `node scripts/seo.mjs --check` before committing. CI checks page canonical URLs, PNG sharing cards, JSON-LD, RSS, sitemap routes, robots and llms.txt. RSS uses source publication dates, never the build clock. Search Console and Bing verification and sitemap submission require the site owner.

The generated 404 page uses the configured Pages base path for its site root, so service-worker registration and assets resolve correctly even at a deep missing URL. The launch suite checks this at 320px and 1280px using offline resource routing and a registration-fetch shim; no worker or server is started. It excludes only the expected navigation HTTP 404 console message.
