# Stack Scout — Handoff to Claude Code

This pack is for Claude Code to build the production site from. Read `DESIGN.md` first for the design spec; this file covers _how to ship it_.

## What this is

A complete, working HTML prototype at `StackScout Prototype.html` plus the design system in `DESIGN.md`. The prototype is build-with-Babel-in-browser React for iteration speed; production must be vanilla HTML/CSS + a thin JS layer, matching the existing `stackscout/` codebase pattern.

## What you're replacing

The existing `stackscout/` repo:
- builds a public site from `content/stackscout/site-source.json` + `tools-source.json` + `updates-source.json`
- via `scripts/build-stackscout.js` → static HTML in `index.html`, `catalog/`, `categories/`, etc.
- with `styles.css` + `app.js` providing the chrome
- targeting GitHub Pages

Keep the shared source layer. Replace the chrome + page templates + IA with the design from this prototype.

## Build order

### Phase 1 · Shell + palette (~half day)

1. Port `wireframes/zine-shell.jsx`'s palette + animation system to vanilla CSS custom properties + a tiny JS module.
   - 5 palette presets are five CSS custom-property classes (`.mood-graphite`, `.mood-midnight`, etc.) on `<html>`.
   - Mood swap = swap class on `<html>`. Persist to `localStorage`. Read on `DOMContentLoaded`.
   - Pull `--ink`, `--muted`, `--rule`, `--rule-strong` to `:root`. Mood classes only set `--bg` and `--accent`.
2. Masthead: wordmark + dot + nav + mood toggle. No issue number, no tagline. Active page state via `data-page` attribute on `<body>`.
3. Footer: live UTC clock chip + "Sources & method →" link to `/sources/`. Marquee with the 6 manifesto lines, CSS-only.
4. Page-header strip: breadcrumb on the left, configurable right slot. Becomes a partial in your template engine.
5. CSS keyframes: `ss-reveal-in`, `ss-rule-in`, `ss-pulse`, `ss-marquee-scroll`, `ss-text-cycle-in`, `ss-spark-rise`. All five live in one stylesheet block.

### Phase 2 · Pages from source manifests (~1–2 days)

Build templates for the 6 pages. Each page reads from the source layer and renders the markup the prototype shows.

| Page | Source | Template should do |
|---|---|---|
| `index.html` (home) | `updates-source.json` (latest 4), `tools-source.json` (5 setlist + 5 list) | Cycling lead uses 4 most recent wire items. Setlist = next-90-days releases. Wire = last 48h. |
| `releases/index.html` | `tools-source.json` | Group by `releaseWindow` (week / month / quarter). Calendar view is a separate URL param or `#calendar` hash. |
| `wire/index.html` | `updates-source.json` | Paginated. Filter via query string (`?kind=funding`). |
| `list/index.html` | `tools-source.json` | Ranked list. Manual rank field; default order if missing. |
| `subscribe/index.html` | static + archive from `updates-source.json` grouped by week | Form posts to whatever subscribe endpoint Kol picks. |
| `sources/index.html` | new `sources-source.json` (Claude Code creates the schema) | Grouped Primary / Secondary / Aggregators + method explainer. |

### Phase 3 · Filters and tags (~half day)

The filter pills in the prototype are visual-only. Make them work.

1. Reads from query string on load.
2. Updates query string + filters DOM on click (no router needed).
3. Tag chips on tool cards / wire items are anchor tags to the filtered URL.

### Phase 4 · Real data hookup (Kol)

The prototype uses placeholder data with intentionally fixed dates. Replace with:

- `tools-source.json` entries — Claude 4.5, Cursor 2.5, GPT-5.5, Suno v5.5, Gemini 3.1 Pro/Flash, etc.
- `updates-source.json` — wire items from official changelogs only.
- `sources-source.json` — new file; see Sources page in prototype for shape.

## Things to preserve from the prototype

| Interaction | Where in prototype |
|---|---|
| Mood toggle (5 swatches) | `zine-shell.jsx` → `ColorToggle` |
| Cycling lead (4 headlines, blur-fade, hover-pause, click-to-jump dots) | `zine-extras.jsx` → `CyclingLead` |
| Magnetic CTA | `zine-extras.jsx` → `MagneticCta` |
| Sparkline | `zine-extras.jsx` → `Sparkline` |
| Count-up numbers | `zine-extras.jsx` → `CountUp` |
| Cursor spotlight on home hero | `zine-shell.jsx` → `Spotlight` |
| Hover stripes on rows | `zine-shell.jsx` → `HoverStripe` |
| Footer marquee, pause on hover | `zine-shell.jsx` → `FooterMarquee` |
| Live UTC clock | `zine-shell.jsx` → `useUtcClock` |
| Film grain overlay | `.ss-grain` class on `<body>` |
| Page transitions | 200ms opacity + 4px translate on `<main>` swap |

## Things to drop from the prototype

- React + Babel — the prototype runs these in-browser for speed. Production is vanilla.
- The `ZineShell` state-machine routing — real URLs only.
- The hard-coded `DATA_HOME` / `DATA_RELEASES` / `DATA_WIRE` / `DATA_LIST` / `DATA_SOURCES` constants — read from the shared source layer.
- `Spotlight`'s mousemove handler attached to a ref — port as a one-line event listener on the home hero element.

## Things to confirm with Kol before shipping

See `DESIGN.md` § 7 "Open questions for Kol".

In particular:

- **Domain** for the wordmark.
- **List page ranking** — manual `rank` field in `tools-source.json` is the assumption.
- **Sources schema** — make a draft `content/stackscout/sources-source.json` based on the Sources page and let Kol fill it.

## Acceptance checklist

- [ ] 6 pages render from source manifests, no hard-coded content in templates.
- [ ] 5 palette moods work, persist across reloads.
- [ ] Filter pills filter (query string + DOM update).
- [ ] Calendar view of Releases works.
- [ ] Sources page renders Primary / Secondary / Aggregators with method explainer.
- [ ] All animations from the table above are intact.
- [ ] No 2px borders, no boxed cards (hairlines only).
- [ ] Every Wire and Release item shows a primary source.
- [ ] No fake decimal scores; verdict labels only.
- [ ] No "Issue 026" or "field log for the AI stack" in the masthead — these were design-round artefacts.
- [ ] Wordmark reads "Stack Scout" (two words), not "StackScout".
- [ ] Lighthouse desktop ≥ 95 perf, ≥ 95 a11y.
- [ ] Service worker + PWA install still works (already in `pwa.js`, `service-worker.js`).
