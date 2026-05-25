# Stack Scout

`stackscout` builds **Stack Scout**, the public-facing tools destination for curated builder tools, services, APIs, MCPs, and CLIs.

This repo remains the GitHub Pages implementation base, but the visible product is no longer a simple internal "Tools Hub" brochure. The private operational console stays separate in `W:\Repos\_local\surfaces\tools-hub-local`.

## Public vs private

- This repo is public-facing only.
- The local launcher, manager inbox, review evidence, session state, and leak-check operations belong in `tools-hub-local`.
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
- a private preview export written to `W:\Repos\_local\surfaces\tools-hub-local\data\stackscout-publishing.json`

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

`npm run check` also runs the no-publish launch-safety gate:

```bash
npm run verify:launch
```

That gate scans generated public output for local Windows paths and private surface markers, confirms the public file set exists, checks `.gitignore` still excludes local notes and env files, and verifies the `service-worker.js` cache name is not older than the generated issue date.

GitHub Pages does not support custom response headers such as a Netlify `_headers` file. Keep browser hardening inside static HTML, conservative client code, and dependency-free scripts unless the site moves to a host that can set CSP/HSTS-style headers.

Before a public refresh, bump `CACHE_NAME` in `service-worker.js` when generated public content advances. The launch-safety gate fails if the cache date is older than the visible issue date.

## Refresh

```bash
npm run refresh:site
```

This runs the site build, runs checks, and writes private refresh status to `W:\Repos\_local\surfaces\tools-hub-local\data\stackscout-refresh-status.json`.

For unattended Windows refreshes without visible terminal focus theft, use the local-only launcher at `W:\Repos\_My Tools\LOCAL-ONLY\stackscout-refresh\run-stackscout-refresh.cmd`.

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
