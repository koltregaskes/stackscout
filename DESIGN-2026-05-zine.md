# Stack Scout — Design specification

**Status:** Round 03 — page-by-page prototype, ready for Claude Code build  
**Owner:** Kol  
**Designer pass:** Claude (Anthropic)  
**Last updated:** 19 May 2026

The prototype that this document describes lives at `StackScout Prototype.html` with all components under `wireframes/`. The existing `stackscout/` codebase (vanilla HTML + `styles.css` + `app.js` driven by JSON manifests) is the production target — this design replaces the chrome and IA of that codebase but keeps the shared source layer underneath.

---

## 1. Identity

| | |
|---|---|
| **Name** | Stack Scout (two words, not "StackScout") |
| **Tagline** | _A field log for the AI stack._ (Used sparingly — not in every header.) |
| **Tone** | Editorial · independent · used-not-listed · sharp without being shouty |
| **Mood** | Dark editorial. Closer to a printed broadsheet at night than a SaaS dashboard. |
| **What it is not** | A directory · an aggregator · "Product Hunt for AI" · ad-funded |

The page identifies the site to the reader with the wordmark + accent dot in the masthead. No issue numbers in the masthead (these belonged to a previous round and have been removed). The tagline appears only on the Subscribe and Sources pages where it earns its place.

---

## 2. Information architecture

Top-level navigation, left to right in the masthead:

| Slug | Label | What it is |
|---|---|---|
| `home` | Home | Front page — cycling lead news, the day's wire, the setlist of upcoming releases, the weekly stance. |
| `releases` | Releases | Every shipping date being tracked. Toggles between **List** view (grouped by window) and **Calendar** view (3-month strip). Filter rail at the top. |
| `wire` | Wire | 48-hour activity stream from primary sources. Filter rail at the top. |
| `list` | Top tools | A short, opinionated ranked list. Curated, not algorithmic. Filtered by editorial verdict. |
| `subscribe` | Subscribe | Email signup + past-issue archive. |

Footer-only entry point (not in the top nav):

| `sources` | Sources & method | Where the data comes from + what "Verified / Window / Confirmed / Shipped" mean. |

### Page-shape contract (non-home pages)

Every non-home page begins with:

1. `<PageHeader crumbs={["Stack Scout", "<page>"]} rightSlot={…}>` — a narrow strip with a breadcrumb on the left and a stat/clock/view-toggle on the right.
2. A 22px-padded filter rail (where relevant).
3. A hairline `<Rule>`.
4. The content list.

**Non-home pages do not get a hero block.** The breadcrumb + filter rail is the chrome; the data is the content. (This was a Round 02 mistake — the hero box on Releases and Wire wasted vertical space.)

---

## 3. Visual system

### 3.1 Palette

Five **mood** palettes, swap-able from the toolbar in the masthead top-right. The toggle changes only `background` and `accent`. Everything else is fixed across moods so nothing flickers on swap.

| ID | Name | Background | Accent | Use |
|---|---|---|---|---|
| `graphite` | Graphite | `#14171c` | `#6dbab1` | **Default.** Warm charcoal + dusty teal. |
| `midnight` | Midnight | `#0f1622` | `#7fb8d2` | Cool blue-black + steel. |
| `obsidian` | Obsidian | `#0a0c0f` | `#6dd5b8` | Near-black + mint. Darkest option. |
| `slate` | Slate | `#1a1d22` | `#8ec2a8` | Warm grey + sage. |
| `carbon` | Carbon | `#181b22` | `#88bdd1` | Deep blue-grey + powder blue. |

Fixed across all moods:

```css
--ink: #ede5d3;                  /* cream body text */
--muted: #7d8086;                /* metadata, captions */
--rule:  rgba(237,229,211,0.18); /* dashed hairlines */
--rule-strong: rgba(237,229,211,0.45); /* solid hairlines, primary divisions */
```

The accent is reserved for: hero verb (e.g. _without the wobble_), active nav underline, active filter pill, hover stripes, sparkline bars, the subscribe button, list-page rank numbers, calendar release dots, the live-pulse dot, and `::selection`. Nothing else.

### 3.2 Type

| Role | Family | Notes |
|---|---|---|
| Display + body | **Newsreader** | Variable, italic supported. Used for everything that reads like prose. |
| Captions / labels / nav / marquee / mono | **IBM Plex Mono** | All caps, ~0.16–0.22em letter-spacing. The other voice of the site. |

There is no third font. Headings are weight 500–700, italic when emphatic. Body sizes scale from 14px (Lede small) to 96px (page hero). Bigger heroes use Newsreader Italic for the highlighted verb only.

### 3.3 Structure

- **No boxed containers.** Sections divide on whitespace + hairline rules.
- **No coloured cards.** No drop shadows.
- **One accent per page.** Everything else stays in the cream/muted scale.
- **Sources visible.** Every release and wire item must show its primary source.
- **No fake decimal scores.** Verdicts are editorial labels: _Recommended · Worth watching · Specialist pick · Shipped_.
- **Filter pills, not chiclets.** Round 999, 1px border, accent fill at 10% opacity when active.

---

## 4. Interactions & motion

Every animation lives in `wireframes/zine-shell.jsx` (`<style>` block at the top of `<ZineShell>`) or `wireframes/zine-extras.jsx` (component primitives).

| Element | Source | Behaviour |
|---|---|---|
| Mood toggle | `ColorToggle` in `zine-shell.jsx` | Cross-fades `background` (500ms) and `accent` (400ms) across every consumer. Active swatch scales 1.08 with a `${accent}55` glow ring. |
| Page transitions | `ZineShell.navTo` | 200ms fade + 4px rise on switch. |
| Hairline rules | `Rule` (`zine-shell.jsx`) | Pure CSS keyframe — `scaleX(0 → 1)` over 1.1s on mount. Not gated on IntersectionObserver. |
| Reveal blocks | `Reveal` (`zine-shell.jsx`) | Pure CSS keyframe — fade-up 14px over 700ms on mount, with a configurable `delay`. |
| Cursor spotlight | `Spotlight` (`zine-shell.jsx`) | Scoped to the home hero. Radial gradient at the accent colour follows the cursor. |
| Hover stripes | `HoverStripe` (`zine-shell.jsx`) | Setlist / Wire / Also-today rows grow a 3px accent bar on the left on hover. |
| Marquee | `FooterMarquee` (`zine-shell.jsx`) | 38s horizontal scroll, pauses on hover. |
| Live UTC clock | `useUtcClock` (`zine-shell.jsx`) | Updates every 30 s. Powers the "Live · HH:MM UTC" footer chip. |
| Pulse dot | `PulseDot` (`zine-extras.jsx`) | 2.4s ease-in-out infinite pulse, accent-coloured. |
| Count-up | `CountUp` (`zine-extras.jsx`) | rAF-driven, ease-out-cubic. Counts 0 → `to` over 1.2s on mount. |
| Sparkline | `Sparkline` (`zine-extras.jsx`) | 3px bars, scale-up entry animation staggered 40ms per bar. |
| Magnetic CTA | `MagneticCta` (`zine-extras.jsx`) | Translates toward the cursor at 25% strength on hover, snaps back on leave. |
| Cycling lead | `CyclingLead` (`zine-extras.jsx`) | Auto-rotates 4 lead candidates every 9s. Blur-fade entry on each rotation. Hover the hero to pause. Indicator dots are clickable. |
| Filter pills | `FilterRail` (`zine-pages.jsx`) | Active state: 10% accent fill + 1px accent border. 240ms colour fade between states. |
| Subscribe email focus | `SubscribePage` | Underline rule moves from `RULE` to `accent` on focus (240ms). |
| Selection highlight | global CSS | `::selection { background: accent; color: bg; }` per palette. |
| Film grain | `.ss-grain` | Fixed, viewport-wide, 3.5% opacity, mix-blend `overlay`. SVG-noise data URI. |

**What is _not_ animated:** type swaps, palette accent in body text (it cuts cleanly to avoid the "fade through grey" effect), and footer marquee speed.

---

## 5. Page specs

### 5.1 Home

| Block | Notes |
|---|---|
| **Hero** | `CyclingLead` — 4 headlines auto-rotating every 9 s. Lead image placeholder right-side. Cursor spotlight scoped to this region. |
| **Also today** | 3 short news items in an "Also today ▾" strip below the hero. |
| **Setlist** | 5 upcoming tracked releases. Each row has rank · title + studio · 9-day mention sparkline · tag · date. |
| **Wire** | 5 recent wire items with a "Last 48 hours" pulse-dot label. |
| **Against / With** | Single italic banner — the weekly stance. Magnetic CTA on the right. |

### 5.2 Releases

| Block | Notes |
|---|---|
| **PageHeader** | Breadcrumb `Stack Scout / Releases`. Right slot has `StatRow` (3 count-ups + live dot) + List/Calendar view toggle. |
| **Filter rail** | `All · Models · IDE · Image · Audio · Video · Voice · Confirmed only · Recommended`. |
| **List view** | Releases grouped by window (`This week · June · Q3 2026`). Sticky group label on the left, list on the right. |
| **Calendar view** | 3-month strip (May / Jun / Jul). Release days marked with an accent dot + title. Today highlighted with `${accent}14`. |

The view toggle is the "calendar" affordance the user asked for. State is local to the page — `useState('list' \| 'calendar')` — so a Calendar URL/query-param routing decision can be made in implementation.

### 5.3 Wire

| Block | Notes |
|---|---|
| **PageHeader** | Breadcrumb `Stack Scout / Wire`. Right slot has live-dot + `CountUp` for items in last 48h and source count. |
| **Filter rail** | `All · Releases · Funding · Pricing · Feature · Update · Delays`. |
| **List** | 3-column rows: kind+when / title+lede / source+tool slug+open link. |
| **Pagination footer** | `← Newer / Older →` plus a `CountUp` "24 of 147 indexed" line. |

### 5.4 List (top tools)

A simple, ranked, opinionated list. Each row: rank (huge italic accent number) · title + studio + tag · summary · editorial verdict + dossier link. Filter rail filters by verdict (`All · Recommended · Worth watching · Specialist pick`).

Inspired by Axy Lusion's top-rated models page. Curated, not algorithmic — the lede says so. Ordering is by Kol's hand.

### 5.5 Subscribe

| Block | Notes |
|---|---|
| **Hero** | "Get the issue in your inbox." Form on the left, archive on the right. |
| **Form** | Email input with hairline underline (accent on focus); accent-filled submit button. Three opt-in checkboxes: Weekly Issue · Release alerts · RSS. |
| **Archive** | Sticky right column with 5 past issues. |

### 5.6 Sources & method

| Block | Notes |
|---|---|
| **Hero** | "One pass through official sources beats five through a feed." |
| **Buckets** | Primary · Secondary · Aggregators. Sticky group label on the left, list on the right. |
| **Method** | Definitions for `Verified · Window · Confirmed · Shipped`. |

Linked from the footer's "Sources & method →" link. Not in the top nav.

---

## 6. File map

```
StackScout Prototype.html          ← entry point
wireframes/
  wf-common.jsx                    ← Placeholder, Tag (shared lo-fi helpers)
  zine-shell.jsx                   ← Palette context, masthead, footer, animations, primitives
  zine-extras.jsx                  ← PageHeader, CountUp, Sparkline, MagneticCta, CyclingLead, PulseDot
  zine-home.jsx                    ← Home page
  zine-pages.jsx                   ← Releases, Wire, List, Subscribe, Sources
  README.md                        ← short summary (this doc is the authoritative spec)
DESIGN.md                          ← THIS FILE
CLAUDE-HANDOFF.md                  ← build instructions for Claude Code
```

The existing `stackscout/` codebase is untouched — Claude Code will port this design onto its build pipeline. See `CLAUDE-HANDOFF.md`.

---

## 7. Open questions for Kol

These are the things the prototype made placeholder calls on. Confirm before Claude Code starts.

1. **Domain.** Currently called "Stack Scout" in the wordmark. Confirm or replace.
2. **"Field log" tagline.** Currently used only on Subscribe and Sources. Keep, soften, or kill?
3. **Mood persistence.** Should the palette choice be sticky per-browser (localStorage) or per-issue (server-set)? Prototype is component-state-only.
4. **List page ranking authority.** Implementation note: Kol ranks by hand; the implementation needs to support a manual `rank` field in `content/stackscout/tools-source.json`.
5. **Wire item retention.** How far back does the public Wire go? Currently shows last 48h with a paginated tail — the rest belongs to the archive on Subscribe.
6. **Cycling lead frequency.** 4 candidates, 9s rotation feels right at desktop; should it stop on mobile, or rotate less often?
7. **Calendar default range.** 3-month strip starting from current month. Long-range (6+ months) demands a different view — defer.
8. **Source bucket policy.** Should Aggregators (HN, Reddit) be linked at all, or just listed?

---

## 8. Round-by-round changelog

- **Round 01** — five distinct homepage directions on a design canvas (Broadsheet, Mission Console, Spine, Pack, Zine). User picked **Zine**.
- **Round 02** — palette study on the chosen Zine; user picked **Charcoal/Graphite + dusty teal**, then revised: dropped the heavy boxes, fixed the hero into a real news block, swapped Fraunces for Newsreader.
- **Round 03** — current. Built shell + Home + Releases + Wire + Subscribe with 5-mood toggle, animations, and the original Brutalist energy dialled down. Then trimmed page heroes from Releases/Wire, added the Calendar view, the List page, and the Sources page; refreshed placeholder data; added cycling lead, sparklines, count-ups, magnetic CTAs, film grain.
