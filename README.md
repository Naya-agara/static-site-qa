# Static Site QA

A general-purpose Playwright harness that turns a standard website QA checklist into an automated baseline. Point it at a site's URL and roughly **half the checklist checks itself** — across every page, on every browser, in about a minute. The other half is generated as a per-site markdown checklist for a human, with the already-automated items stripped out.

**Is this plug-and-play?** Mechanically, yes — clone it, install, add a URL, run. The one thing that is *not* zero-config: this repo ships with one real example site (`qz`) already wired up in `sites/index.ts`, so `npm test` with no setup tests *that* site, not yours. Step 3 below replaces it with your own. Everything else — Lighthouse config, the generated checklist's sign-off section — has its own placeholders called out in [Make it yours](#make-it-yours).

---

## Quick start

```bash
# 1. Install
npm install
npx playwright install --with-deps chromium

# 2. See it work — runs the example site (qz) that ships with this repo
SITE=qz npm run test:fast

# 3. Add your own site — copy the template, fill in two fields
cp sites/example.site.ts sites/acme.site.ts
```

Edit `sites/acme.site.ts`:

```ts
import type { SiteConfig } from './types';

const site: SiteConfig = {
  name: 'acme',
  baseURL: 'https://acme.com',
};
export default site;
```

Register it in [`sites/index.ts`](sites/index.ts) — this is the one manual wiring step, and it's deliberate: the `SITE=` filter throws on a typo instead of silently testing nothing, which only works if every site is an explicit, named entry.

```ts
import qz from './qz.site';
import acme from './acme.site';   // ← add

const all: SiteConfig[] = [
  qz,
  acme,                            // ← add
];
```

```bash
# 4. Find its pages, then run
SITE=acme npm run discover     # crawls sitemap.xml, falls back to a homepage link crawl
SITE=acme npm run test:fast    # ← your dev loop from here on
```

Point it at localhost before you push:

```bash
BASE_URL_ACME=http://localhost:3000 SITE=acme npm run test:fast
```

---

## Make it yours

Five things this repo ships with that you'll want to look at before treating it as *your* team's tool, not a demo:

| What | Where | Why it matters |
|---|---|---|
| The `qz` example site | `sites/qz.site.ts`, `sites/index.ts` | Keep it as a worked example or delete it — either way, don't leave it as the only registered site. |
| CI matrix | `.github/workflows/qa.yml` (`strategy.matrix.site`) | **Must list every site name registered in `sites/index.ts`, kept in sync by hand.** A stale entry here throws immediately (`Unknown site(s) in SITE=...`) instead of testing nothing — add your site's name here the same day you register it. |
| Defect tracker / recording tool names | `scripts/checklist.ts` (sign-off section references "Zoho" and "Jam") | Swap for whatever your team actually uses — these are hardcoded strings, not config. |
| Lighthouse target URL | `lighthouserc.json` (`collect.url` defaults to `https://example.com/`) | Point it at your own site before running `npm run lh`. |
| Repo identity | `package.json` (`description`, `name`) | Generic placeholders — rename to fit. |

Everything else — every check, every threshold — is genuinely config-driven per site through `SiteConfig` (see `sites/example.site.ts` for the full, commented list of optional fields). You don't need to touch test files to onboard a new site; you only touch them to add a *new kind* of check (see [Adding your own checks](#adding-your-own-checks)).

---

## What's automated vs. what isn't

This is the important table. **Automation covers about half the checklist. It cannot cover the rest, and pretending otherwise is how checklists get quietly abandoned.**

| Checklist section | Automated | Needs a human |
|---|---|---|
| **Content** | Placeholder/lorem text, heading hierarchy, footer + copyright year, contact links, legal links present, duplicate titles/descriptions/content | Spelling & grammar, facts & dates correct, citations attributed, contact details *accurate*, legal pages *current*, CTA copy sensible |
| **Layout** | Keyboard navigation + focus indicators, layout shift (CLS), visual drift vs baseline, 404 status | Figma comparison, alignment & spacing intent, visual hierarchy, modal/pop-up behaviour, is the 404 *helpful* |
| **Links & CTAs** | Broken links, 404s, generic link text, `target="_blank"` + `rel="noopener"`, duplicate link text → different URLs, links visually distinct from body text | CTA copy compelling, CTA placement, CTA design consistency, visited-link colour, hover/active feel |
| **Interactive components** | Disclosure menus open/close (ARIA `aria-expanded`), carousel next/previous controls advance the active slide, forms enforce required/typed-field validation, form submit controls are keyboard-operable | Multi-step flows (checkout, wizards), a submission actually reaching the inbox/CRM, copy inside a modal |
| **Images & Media** | Broken images, pixelation (source < display size), oversized files, missing/junk alt text, filename-as-alt, image weight, autoplay-with-sound, missing video controls & captions | Alt text *accuracy*, **usage rights & licensing**, captions formatting, interactive media, media disrupting flow |
| **Performance & Compat** | Core Web Vitals (Lighthouse), cross-browser via Playwright projects | Animations appropriate, **form data actually arriving**, Brave specifically |
| **Mobile** | Horizontal overflow (+ names the culprit element), tap target size, font size minimums, viewport meta & zoom blocking, landscape, sticky element coverage | Real-device testing, touch gestures, real-network load, mobile Figma comparison |
| **Accessibility** | WCAG 2.0/2.1 A + AA via axe | Screen reader walkthrough |

Two items deserve to be called out because **no tool will ever cover them**:

- *"Ensure that all images and media have the appropriate usage rights and permissions"*
- *"Check that credit is given where necessary and licenses are adhered to"*

That's legal exposure, and it's a human's signature. It's at the top of the generated manual checklist for that reason.

---

## The manual checklist

```bash
SITE=acme npm run checklist   # -> checklists/acme-manual.md
```

Generates a per-site markdown checklist containing **only** the judgement items — with the page list, Figma links, and a table showing what the robot already covered. CI attaches it to every run.

The point isn't the checklist. It's that a reviewer stops re-checking 90 pages of link text by hand and spends that hour on whether the copy is actually any good.

---

## Test tiers

| Tier | File | Project |
|---|---|---|
| smoke | `tests/smoke.spec.ts` | `checks` |
| content | `tests/content.spec.ts` | `checks` |
| links | `tests/links.spec.ts` | `checks` |
| media | `tests/media.spec.ts` | `checks` |
| layout | `tests/layout.spec.ts` | `checks` |
| flows | `tests/flows.spec.ts` | `checks` |
| seo | `tests/seo.spec.ts` | `checks` |
| a11y | `tests/a11y.spec.ts` | `checks` |
| responsive | `tests/responsive.spec.ts` | `responsive` (iPhone 13) |
| visual | `tests/visual.spec.ts` | `desktop`, `tablet`, `mobile` |

Opt a site out with `skip: ['visual', 'media']`.

---

## Commands

```bash
npm run discover            # populate the page list from sitemap.xml
npm run checklist           # generate the human checklist
npm test                    # everything
npm run test:fast           # all desktop checks, no screenshots  ← dev loop
npm run test:content
npm run test:links
npm run test:media
npm run test:layout
npm run test:flows
npm run test:responsive
npm run test:a11y
npm run test:seo
npm run test:visual
npm run test:visual:update  # accept intentional design changes
npm run test:ui             # interactive debugger
npm run report              # open last HTML report
npm run lh                  # Lighthouse CI — edit the url in lighthouserc.json first
```

In CI, every run also publishes its HTML report to GitHub Pages at `https://<owner>.github.io/<repo>/reports/<site>/<run number>/` — a stable, shareable link per run, printed in the run's summary. (One-time setup: repo Settings → Pages → Source → "Deploy from a branch" → `gh-pages`.) The `qa-<site>` artifact from the same run also has the raw report + traces, but expires after 14 days.

Scoping:

```bash
SITE=acme npm test                     # one site
SITE=acme,adidas-ng npm test           # several
npx playwright test -g "about"         # one page
npx playwright test --project=mobile   # one viewport
```

A typo in `SITE=` throws instead of silently testing nothing.

---

## Adding your own checks

This is designed to be extended — the baseline is a floor, not a ceiling.

Every spec follows the same shape:

```ts
for (const site of sites) {
  if (skips(site, 'content')) continue;
  test.describe(`[${site.name}] content`, () => {
    const pages = pagesFor(site);
    for (const page_ of pages) {
      test(`${page_.path} does the thing`, async ({ page }) => {
        await page.goto(urlFor(site, page_));
        // your assertion
      });
    }
  });
}
```

Drop a new `tests/whatever.spec.ts` in, add it to the `checks` project's `testMatch` in `playwright.config.ts`, add the tier name to the `Tier` union in `sites/types.ts`, and it runs against every site and every page automatically. Site-specific config goes in the `SiteConfig` type.

For behaviour that requires clicking through something (a menu, a carousel, a form), feature-detect the target instead of hardcoding a site's markup — `tests/flows.spec.ts` does this by matching on ARIA attributes (`aria-haspopup`, `aria-label="Next slide"`) rather than framework-specific classes, so the same check works across sites and calls `test.skip()` when a page doesn't have that widget at all.

---

## Known limits — read before you trust it

- **Some checks are proxies, not the real thing.** "Pixelated" is inferred from source width vs. display width; it won't catch a genuinely blurry photo at the right dimensions. "Links visually distinct" checks computed styles, not perception.
- **Interactive-flow checks feature-detect their target.** `flows.spec.ts` matches the ARIA disclosure-menu and carousel patterns, not specific frameworks — but a site that doesn't use those patterns at all just skips the check, which isn't the same as passing. It also never performs a real form submission (no third-party endpoint, CAPTCHA, or inbox gets touched from CI) — it only verifies client-side validation and that the submit control is keyboard-reachable.
- **A single-page site (or one whose homepage only links externally) still gets discovered correctly** — `npm run discover` always seeds the homepage path itself, so you're never stuck with an empty page list just because there was nothing to crawl.
- **The first run on a real site will be loud.** Duplicate meta descriptions, junk alt text, and tap targets under 44px are near-universal. Triage into fix-now vs. waive-with-a-ticket, and don't let anyone respond by deleting checks.
- **Console errors fail the build.** On sites with chatty analytics or a chat widget this fires immediately. Filter by pattern in `smoke.spec.ts`; don't remove the check.
- **Visual baselines are Linux-generated to match CI.** Updating them on macOS produces pixel diffs in CI. If a site has anything that moves on its own (a marquee, an autoplaying carousel), mask it via `visual: { mask: [...] }` in that site's config — otherwise every run diffs against the last regardless of any real change. To regenerate baselines correctly without a local Linux/Docker setup, run the `Static Site QA` workflow manually (Actions tab → Run workflow) with `update_snapshots` checked — it regenerates them on the actual `ubuntu-latest` runner and commits them back to the branch.
- **Discovery caps at 25 pages.** Raise `discover.maxPages` deliberately — every page multiplies across ~10 tiers and 3 viewports.
- **`npm run discover` is a separate step** because Playwright builds its test list before any setup hook runs. It's cached; re-run it when the site's page list changes.
- **Brave isn't tested directly.** It's Chromium — the `checks` project is a close proxy, not identical.
