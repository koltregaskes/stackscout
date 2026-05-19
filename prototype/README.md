# Stack Gazette prototype

A self-contained vanilla port of `StackScout Prototype.html` from the May 2026 design pack, renamed from "Stack Scout" → **Stack Gazette** because `stackscout.com` is owned by an active server-monitoring company.

## What this is

A single-file static prototype demonstrating Phase 1 of [CLAUDE-HANDOFF-2026-05-zine.md](../CLAUDE-HANDOFF-2026-05-zine.md):

- 5-mood palette toggle (graphite / midnight / obsidian / slate / carbon) with `localStorage` persistence
- Masthead with "Stack Gazette" wordmark + three-bar stack mark (no issue number, no tagline in chrome)
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

Staged at `W:\Websites\LOCAL-ONLY\stackscout\design-2026-05-19\` (private). The `DESIGN-2026-05-zine.md` and `CLAUDE-HANDOFF-2026-05-zine.md` files at the repo root are copies of the design pack's authoritative spec and build plan, kept under the original "Stack Scout" name as a historical record of the round 03 design.

## Domain

**Recommended: `stackgazette.com`** — DNS check returned NXDOMAIN (the strongest signal that a .com is genuinely available rather than parked or owned).

Why renamed from Stack Scout:

- `stackscout.com` resolves to a Vercel-hosted server-monitoring product (in active use, not buyable)
- `stack-scout.com` was the dash-free alternative, but Kol's preference is no dashes
- User wanted a `stack___.com` that exists; "Gazette" matches the broadsheet/editorial mood already in DESIGN.md § 1 ("printed broadsheet at night")

Other clean alternatives that came back NXDOMAIN if `gazette` doesn't land: `stackbulletin.com`, `stackpulse.com`, `stackdrop.com`. Avoid `stacklog.com`, `stackdaily.com`, `stackedge.com`, `stacktake.com` — all parked on Sedo (priced to extort).

## Logo refresh

The original wordmark was `[10px accent square] Stack Scout`. Refreshed to:

- Three horizontal bars stacked, narrowest on top, full-width middle, medium bottom — literal "stack" mark in the accent colour
- Glow ring removed (the old `box-shadow` halo on the square is gone)
- Hover state: the second word ("Gazette") swaps to accent colour

The mark scales cleanly because it's inline SVG. Light edit if you want a different stack shape — `.brand__mark svg rect` in the CSS.

## Phase 2-4 — outstanding

Per the handoff doc, the remaining work is:

- **Phase 2:** Read from `content/stackscout/site-source.json`, `tools-source.json`, `updates-source.json`. Build per-page templates that render the markup this prototype shows.
- **Phase 3:** Filter pills read from query string and update DOM.
- **Phase 4:** Real data hookup (Kol).

To be tracked in Linear as children of the Stack Gazette launch parent (or KOL-533 if you want it under the same umbrella).

## Naming-rename open items

The repo itself is still `stackscout` (folder, GitHub repo, content/stackscout/, scripts/build-stackscout.js, manifests). Phase 2 should decide:

- Rename the repo on GitHub: `koltregaskes/stackscout` → `koltregaskes/stack-gazette` (or keep the slug for repo continuity and only rename the public brand)
- Rename the content folder `content/stackscout/` → `content/stack-gazette/` and update the build script
- Update the legacy `DESIGN.md`, `SCOPE.md`, and `README.md` at the repo root with the new brand

None of these affect the prototype — they're separate cutover work. Recommended: keep the repo slug as `stackscout` for git history, change only the visible brand. Cheap, low-risk.
