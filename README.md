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

That gate scans generated public output for local Windows paths and private surface markers, confirms the public file set exists, checks `.gitignore` still excludes local notes and env files, and verifies the `service-worker.js` cache name is not older than the generated issue date.

It also proves the newest routed item reached the updates manifest and rendered
Wire, and that visible dates come from the routed source timestamp rather than
the wall clock used to run the build.

GitHub Pages does not support custom response headers such as a Netlify `_headers` file. Keep browser hardening inside static HTML, conservative client code, and dependency-free scripts unless the site moves to a host that can set CSP/HSTS-style headers.

Before a public refresh, bump `CACHE_NAME` in `service-worker.js` when generated public content advances. The launch-safety gate fails if the cache date is older than the visible issue date.

## Refresh

```bash
npm run refresh:site
```

This runs the site build, runs checks, and optionally writes private refresh status when `STACKSCOUT_PRIVATE_STATUS_DIR` is set locally.

For unattended Windows refreshes without visible terminal focus theft, use a local-only launcher outside this public repo and set the optional private export/status environment variables there.

When `-Publish` is enabled, the refresh now fails safely unless the checkout is
on `main`, exactly matches the freshly fetched `origin/main`, and contains no
changes outside the generated public allow-list. It re-fetches immediately
before committing and stops without creating a commit if the remote moved
during the build. Recovery must preserve generated output on a review branch;
the automation never resets, rebases, force-pushes, or resolves conflicts.

## Site structure

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
