# Stack Scout prototype

A self-contained vanilla port of `StackScout Prototype.html` from the May 2026 design pack.

## What this is

A single-file static prototype demonstrating Phase 1 of [CLAUDE-HANDOFF-2026-05-zine.md](../CLAUDE-HANDOFF-2026-05-zine.md):

- 5-mood palette toggle (graphite / midnight / obsidian / slate / carbon) with `localStorage` persistence
- Masthead with "Stack Scout" wordmark + accent dot (no issue number, no tagline)
- Footer marquee + live UTC clock
- Film grain overlay
- Reveal / cycling-lead / sparkline / hover-stripe / magnetic-CTA / cursor-spotlight animations
- Page-switch transitions across Home / Releases / Wire / Top tools / Subscribe
- Home page rendered with placeholder data (cycling lead, also-today, setlist, wire, against/with banner)
- Releases / Wire / List / Subscribe stubbed with the right chrome and a phase-2 note

## What this is NOT

- Wired to the JSON source layer yet (`content/stackscout/*-source.json`)
- A replacement for the live `index.html` at the repo root — the deployed site is untouched
- Production-final — open questions in [DESIGN-2026-05-zine.md § 7](../DESIGN-2026-05-zine.md) need Kol's call before cutover

## How to view

Open `prototype/index.html` directly in a browser, or serve the repo:

```powershell
cd W:\Websites\sites\stackscout
python -m http.server 4173
# open http://127.0.0.1:4173/prototype/
```

## Source design pack

Staged at `W:\Websites\LOCAL-ONLY\stackscout\design-2026-05-19\` (private). The `DESIGN-2026-05-zine.md` and `CLAUDE-HANDOFF-2026-05-zine.md` files at the repo root are copies of the design pack's authoritative spec and build plan.

## Domain

Recommendation: `stack-scout.com` (matches the two-word brand from DESIGN.md § 1; `stackscout.com` is already taken by a server-monitoring company). Update CNAME + canonical when confirmed.

## Phase 2-4 — outstanding

Per the handoff doc, the remaining work is:

- **Phase 2:** Read from `content/stackscout/site-source.json`, `tools-source.json`, `updates-source.json`. Build per-page templates that render the markup this prototype shows.
- **Phase 3:** Filter pills read from query string and update DOM.
- **Phase 4:** Real data hookup (Kol).

To be tracked in Linear as children of the Stack Scout launch parent.
