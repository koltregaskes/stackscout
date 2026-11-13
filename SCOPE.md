# StackScout — Strategic Scope Brief

**Status:** v1 DRAFT, awaiting Kol's review and amendment
**Last updated:** 2026-05-16
**Author:** Claude (website manager)
**Purpose:** Capture the strategic context for `stackscout` so future design + content briefs (especially Claude Design handoffs) start from a shared understanding.

This is **not** a design brief and not an implementation plan. The repo already has a solid `DESIGN.md` (StackScout's identity, fonts, colour system). This brief covers product context, audience, and content sources.

---

## Product identity

**Repo:** `stackscout` (on disk at `W:\Websites\sites\stackscout`)
**Public brand:** StackScout
**Domain:** TBD
**Stack:** Static HTML + vanilla CSS/JS with a shared source layer (JSON-driven content generation). Per existing structure: `catalog/`, `categories/`, `collections/`, `content/`, `data/`, `app.js`, `assets/`.
**Deploy:** GitHub Pages from the public repo
**Private counterpart:** `W:\Repos\_local\surfaces\stackscout-local` (operational console — out of scope here)

**One-sentence pitch:** StackScout is a curated scout-desk for builder tools — APIs, MCPs, CLIs, services — where every entry has been used or vetted by Kol, not just listed.

The design identity is already locked in StackScout's existing `DESIGN.md`:

- **Tone:** Editorial, sharp, credible, product-intelligence-first
- **Aesthetic:** Field log: dark field desk or khaki notebook (follows the device setting); one acid-lime accent
- **Type:** Archivo condensed (display) / Public Sans (body) / Martian Mono (metadata)
- **Position:** Scout desk / field report, not generic app gallery or directory grid

---

## What lives here

The shared source layer is the spine:

- `content/stackscout/site-source.json` — site-wide config
- `content/stackscout/tools-source.json` — the catalogue
- `content/stackscout/updates-source.json` — what's new this week

These source files drive:
- Public manifests in `data/`
- Generated static pages across the public site

The directory shape — `catalog/`, `categories/`, `collections/` — implies three taxonomies layered over the catalogue:

1. **Catalog** — flat list of all tools
2. **Categories** — type-based grouping (APIs, MCPs, CLIs, services, libraries, etc.)
3. **Collections** — themed groupings curated by Kol (e.g. "agent infrastructure", "AI art pipeline", "indie-dev stack")

---

## Why this site exists

Three converging needs:

1. **Personal toolkit, made public.** Kol uses a substantial stack of AI tools, dev tools, services, MCPs. Friends + the wider community keep asking what he uses. StackScout is the "here, this is my stack, and here's why" answer at scale.

2. **Editorial trust gap in tool listings.** Most tool directories (Product Hunt, Toolify.ai, Futurepedia, Pixly.ai) are exhaustive but unopinionated. StackScout's value is the opposite: opinionated, vetted, used-not-listed.

3. **Tool freshness.** AI/dev tooling churns weekly. The `updates-source.json` rail keeps the site live without requiring Kol to redesign the chrome each time.

---

## Differentiator

| Site type | What they do | What StackScout does differently |
|---|---|---|
| Product Hunt / Futurepedia | Comprehensive launch listings | Curated by a real practitioner; vetting matters more than completeness |
| Awesome lists on GitHub | Long alphabetical reference | Editorial commentary + collections + an update rail |
| Toolify.ai / There's An AI For That | AI-only, ad-driven | Broader tool stack (APIs/MCPs/CLIs/services); no ad-driven incentives |
| Stack Share | Engineering team stacks | One person's stack, with reasoning; collections beat checkmarks |

Combination of **curation + editorial voice + updates cadence + a clear taxonomy** is the gap.

---

## Content sources Claude Design needs to know about

### The shared source layer

`content/stackscout/tools-source.json` defines every tool. Each entry presumably has fields like name, category, collection(s), homepage URL, description, Kol's commentary, screenshots, last-reviewed date, status (active / deprecated / replaced).

**Action item for Codex (separate from this brief):** confirm the field set in `tools-source.json` and ensure each tool has a Kol-written `commentary` or `take` field — that's the differentiator. Tools without a take fall short of the editorial promise.

### Updates rail

`updates-source.json` feeds "what's new this week" — new tools added, old tools deprecated, version bumps worth noting. Open question: who writes these updates? Kol, an AI agent watching the tool feeds, or a hybrid?

### Categories taxonomy

The catalogue almost certainly slices into categories like:
- AI models + APIs (LLM providers, image gen, etc.)
- MCPs (Model Context Protocol servers / clients)
- CLIs (developer command-line tools)
- Services (SaaS — hosting, auth, payments)
- Productivity (note-taking, planning, scheduling)
- Creative (Midjourney, Suno, etc. — overlap with Axy Lusion)

**Open question:** confirm with Kol the canonical category list. It informs navigation.

### Collections taxonomy

Themed bundles — Kol's curated playlists of tools that compose. Examples might be:
- "AI agent infrastructure" — Anthropic SDK + Codex + MCP + a database + a queue
- "AI art pipeline" — Midjourney + Photoshop + Topaz + Suno
- "Indie game dev stack" — Godot + Aseprite + Audacity + GitHub Pages
- "Solo founder content stack" — strudel-studio + signal-stack + canvas-planner + Plausible

Each collection is an editorial unit — a Kol-told story about why these tools work together.

---

## Audience

1. **AI / dev practitioners** looking for "what should I use for X?" answers from someone they trust
2. **Other curators / newsletter writers** who borrow recommendations
3. **AI agents** that need a clean catalogue to surface tool recommendations when answering user queries (per the May 2026 Google guidance — schema.org `SoftwareApplication` markup is high-ROI here)

Persona 3 in particular: this is one of the highest-ROI sites in the estate for structured-data SEO. Each tool page with proper `SoftwareApplication` + (optional) `Offer` schema is a strong signal to AI Overviews. See `AGENT-READINESS.md` when Claude writes it for this repo.

---

## Editorial cadence

Open questions for Kol:

- How often is the updates rail refreshed? (Weekly digest? Daily new-tool flag?)
- Who writes tool entries — Kol manually, AI assistant draft + Kol review, or pure auto?
- "Vetted" definition — what does it take for a tool to earn a place? (Personal use? Demo'd once? Recommended by a trusted source?)
- Deprecation rule — when does a tool come off the list?

The answers shape both the design (whether to surface "last reviewed" prominently) and the operational tooling (whether to auto-scrape tool releases).

---

## Relationship to other estate sites

- **`elusion-works`** is the umbrella; expect a cross-link.
- **`ai-resource-hub`** — overlap with StackScout on AI tools specifically. AI Resource Hub is **models + pricing + benchmarks** (the directory + the comparison data). StackScout is **tools + curation + opinion** (the editorial layer). They should reference each other clearly: when AI Resource Hub lists Claude as a model, StackScout's tool entry for "Claude Code" can link back, and vice versa. Don't double up content; cross-link.
- **`axylusion`** — A-List pages already rank AI creative tools. Same risk of overlap. Recommended split: Axy Lusion focuses on **creative tools used in art workflows** (image gen, video, music); StackScout covers **the broader builder stack** (APIs, MCPs, dev tools). The boundary is "is this used to make art?" → Axy Lusion; "is this used to build software / agents?" → StackScout.
- **`repo-foundry`** — adjacent. Repo Foundry tracks repos (code, releases, trending). StackScout tracks tools (often packaged repos, but evaluated as products). Cross-link where a tool maps to a repo.

---

## Open questions for Kol

Before Claude Design touches the design, Kol should confirm:

1. **Canonical categories** — list the categories that should appear as top-level nav.
2. **Updates rail editorial workflow** — manual, agent-assisted, or pure auto?
3. **Vetting bar** — what does a tool need to be Kol-vouched?
4. **Cross-site boundaries** — confirm Axy Lusion / AI Resource Hub split above is right.
5. **Initial catalogue size** — how many tools are already in `tools-source.json` and how many need backfilling before a design pass?
6. **Affiliate / referral links** — does StackScout link bare, or use referral codes where available? Affects schema.org `Offer` markup decisions.
7. **Domain** — `stackscout.com` (or .dev) when ready, or sub-domain?

---

## Definition of "this brief is complete"

- [ ] Canonical category list locked
- [ ] Updates rail editorial workflow agreed
- [ ] Vetting bar defined
- [ ] Cross-site boundaries confirmed with Axy Lusion + AI Resource Hub owners
- [ ] `tools-source.json` populated with at least N tools (Kol picks N — 30? 60?)
- [ ] Each tool has Kol's commentary field filled
- [ ] Domain decision deferred until growth visible (per Kol's stated policy)
- [ ] Claude Design briefed with this scope + the existing `DESIGN.md`
