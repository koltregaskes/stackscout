# StackScout: design system

**Status:** Adopted 10 November 2026. Kol said on 8 November that he would go with Claude's design calls.
**Live:** https://koltregaskes.github.io/stackscout/ (GitHub Pages, no custom domain yet)
**Replaces:** the earlier undated "Design Direction". It keeps the scout-desk idea and "badges, not fake scores", goes back to a single accent and settles the font drift.

---

## 0. Concept

A scout's field log for builder tools. Each page reads like a dossier from a field notebook. Headings are condensed and stencil-like, body text is plain and sturdy, and every fact that can go stale (version, date, source) sits on a mono line. One acid-lime highlighter marks what is recommended and where to click. Each tool gets a verdict, not a score. In light mode the page becomes the notebook itself: khaki paper and green ink.

## 1. Purpose and audience

- **What it is:** a curated public catalogue of builder tools: services, APIs, MCP servers and CLIs. It has verdicts, a "Wire" of recent changes, a radar and collections.
- **Who it is for:** developers and AI builders choosing tools, and Kol's readers who want his picks.
- **The job:** find a tool for a job fast, trust the verdict, see how fresh it is.
- **Not:** an app store, an affiliate list or a live telemetry dashboard.

## 2. Brand voice

- Field-report tone: short, sharp, evidence first. The verdict comes first, then why, then sources.
- Every claim carries a date. "Checked 2 Nov 2026" beats "up to date".
- Badges (Recommended, Watch, Lab, Skip) instead of decimal scores.
- UK English. Example verdict: *Recommended. Fast, honest pricing, MCP support landed in v0.98. Checked 25 Oct 2026.*

## 3. Colour tokens

One accent: **acid lime**. The five visitor "moods" and the ice, ember and violet accents are retired. There is one look, and light or dark follows the visitor's device setting. There is no theme switcher.

```css
:root {                       /* dark: field desk at night (default) */
  color-scheme: dark;
  --bg:            oklch(15% 0.012 155);   /* #070d09 */
  --surface:       oklch(19% 0.014 155);
  --surface-2:     oklch(23% 0.016 155);
  --text:          oklch(95% 0.012 120);   /* #edf0e7 */
  --text-2:        oklch(81% 0.014 140);
  --text-3:        oklch(70% 0.014 145);
  --line:          oklch(31% 0.016 155);
  --line-strong:   oklch(50% 0.018 155);
  --accent:        oklch(90% 0.2 132);     /* #abf95f acid lime */
  --accent-strong: oklch(95% 0.11 132);
  --accent-ink:    oklch(15% 0.012 155);
  --focus:         var(--accent);
  --badge-watch:   oklch(84% 0.12 85);
  --badge-skip:    oklch(72% 0.13 30);
}
@media (prefers-color-scheme: light) {
  :root {                     /* light: the field notebook */
    color-scheme: light;
    --bg:            oklch(96% 0.012 110); /* #f2f3ea khaki paper */
    --surface:       oklch(99% 0.006 110);
    --surface-2:     oklch(92% 0.018 110);
    --text:          oklch(20% 0.02 155);
    --text-2:        oklch(36% 0.022 155);
    --text-3:        oklch(45% 0.02 155);
    --line:          oklch(85% 0.016 120);
    --line-strong:   oklch(60% 0.02 130);
    --accent:        oklch(47% 0.13 140); /* #2c6b1c field green */
    --accent-strong: oklch(40% 0.12 140);
    --accent-ink:    oklch(98% 0.006 110);
    --badge-watch:   oklch(50% 0.1 75);
    --badge-skip:    oklch(50% 0.15 30);
  }
}
```

Lime on dark is 15.3:1, and field green on paper is 5.78:1. Lime is a highlighter: in dark mode it may be text, but in light mode it is only ever a background behind `--text`.

**Atmosphere:** a faint graph-paper grid (1px `--line` at 32px) behind the home page only. No gradients, no glow, no big shadows, no grain.

## 4. Typography

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..800&family=Public+Sans:ital,wght@0,400..600;1,400&family=Martian+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Voice | Family | Settings | Use |
|---|---|---|---|
| Display | Archivo | width 75, weight 800, uppercase for H1/H2 | Headlines, the wordmark, section heads |
| Display (small) | Archivo | width 87.5, weight 700 | Card titles |
| Body | Public Sans | 400 to 600 | Verdicts, descriptions, nav, buttons |
| Mono | Martian Mono | 400, 500 | Versions, dates, sources, badges, filter state |

This set is unique to StackScout. Newsreader and Fraunces belong to Ghost in the Models, and Plex to the AI Resource Hub.

**Scale** (major third, 1.25):

| Token | Size | Line height | Notes |
|---|---|---|---|
| `--step-5` | `clamp(2.5rem, 1.6rem + 4vw, 4.25rem)` | 0.95 | Page H1 |
| `--step-4` | `clamp(2rem, 1.5rem + 2vw, 3rem)` | 1.0 | Inner-page and dossier H1 |
| `--step-3` | 1.5625rem | 1.1 | Section heads |
| `--step-2` | 1.25rem | 1.3 | Card titles |
| `--step-0` | 1rem | 1.6 | Body |
| `--step--1` | 0.875rem | 1.5 | Card descriptions, nav |
| `--step--2` | 0.75rem | 1.4 | Mono metadata. **Floor: nothing smaller than 12px** |

## 5. Spacing and radius

- Base 4px: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Shell `min(1320px, 100vw - 40px)`.
- **Small radii only.** `--radius-sm` 2px (badges, chips, inputs, buttons), `--radius-md` 6px (cards, panels). Nothing larger. Round dots (brand mark, status dot) are the only circles.

## 6. Core components

**Header.** Not a SaaS navbar. On the left is the `STACK SCOUT` wordmark in Archivo 800 width 75, with "Scout" in the accent and a small accent dot. On the right is the nav. A rule runs underneath. No theme switcher.

**Nav.** Home, Top tools, Categories, Wire, Radar, Collections, Sources & method, in Public Sans 500 at 0.875rem. The active page gets a 3px accent underline and `aria-current="page"`. On a phone the nav wraps.

**Tool card.** Rows are ruled with a 1px `--line`. The top row holds the badge and the category in mono. Then come the tool name (`--step-2`), a one-line verdict, and a footer row with the version and "checked" date in mono. The links say "Open dossier" and "Official".

**Badge.** Mono, 0.75rem, uppercase, 2px radius. Accent border and text on a 10% accent tint, and always the word (RECOMMENDED, WATCH, LAB, SKIP), never colour alone.

**Tool dossier.** On desktop, a main column (verdict, why, how to start, recent movement) sits beside a fact panel (type, pricing, licence, links, sources, last checked). Single column on a phone.

**Wire item.** Date (mono), tool, what changed, source link. One ruled row each.

**Button.** A text link with an underline rule, in Public Sans 600. Primary is accent; secondary is `--text-2`.

**Filters.** Search and selects on `--surface`, 2px radius. Filter state lives in the URL. The result count is announced (`aria-live="polite"`).

**Footer ticker.** The "operating principles" strip scrolls, so it has a visible **Pause/Play** button (`aria-pressed`). It starts paused for visitors who ask for reduced motion. Hover does not pause it; the button does.

**Footer.** Brand line, main pages, projects, contact, the Elusion Works umbrella, and the updated date.

## 7. Imagery rules

- No hero images, no illustrations. Tool logos only, at 32px, on a neutral tile, from the vendor's press kit, with the tool name as text beside them.
- Screenshots in dossiers are allowed: 16:10, captioned with the date taken.
- Charts (radar, timelines) are inline SVG in `--text-2`, with the accent for the highlighted series only.

## 8. Homepage shape

The thesis line ("A field log for the tools worth opening.") comes first, then the lead signal (the newest Wire item) and the at-a-glance counts, then quick paths into the catalogue, then featured tools and what moved recently.

## 9. Accessibility

Shared estate standard, all in place as of 10 Nov 2026:

- [x] `<html lang="en-GB">`.
- [x] Skip link to `#main` as the first focusable element.
- [x] Visible focus: 3px `--focus` outline on every focusable element.
- [x] All text at least 4.5:1 against its real background in both modes (large text at least 3:1). Checked on the rendered pages, not just the tokens.
- [x] No text smaller than 12px.
- [x] Moving content has a visible pause button, and motion stops for reduced-motion visitors.
- [x] Badges carry words, never colour alone.
- [x] Filter result count is announced.
- [x] Lime is never text in light mode.

## 10. Do and don't

**Do**
- Date every verdict and every Wire item.
- Prefer official sources and link them.
- Keep the lab subset labelled.

**Don't**
- Use scores out of ten or star ratings.
- Call anything "live telemetry".
- Bring back the moods, a theme switcher or extra accents.
- Leak private notes, local paths or manager messages.

## 11. Decision log

- **8 Nov 2026:** five moods retired in favour of one look that follows the device; acid lime kept as the only accent; fonts settled on Archivo, Public Sans and Martian Mono.
- **10 Nov 2026:** adopted in the repo. `--text-3` nudged (70% dark, 45% light) for contrast headroom.
- **Later:** an own domain, after the Cloudflare decision.
