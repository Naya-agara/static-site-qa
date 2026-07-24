import type { SiteConfig } from './types';

/**
 * Copy this file to `sites/<yourname>.site.ts`, then:
 *   1. Add an import + entry in `sites/index.ts`.
 *   2. SITE=<yourname> npm run discover
 *   3. SITE=<yourname> npm run test:fast
 *
 * `name` and `baseURL` are the only required fields — everything else below
 * is an override for when a default is wrong for this particular site.
 * Delete whatever you don't need; the commented blocks show the full shape.
 */
const site: SiteConfig = {
  name: 'example',
  baseURL: 'https://example.com',

  // --- Explicit pages -----------------------------------------------------
  // Optional. `npm run discover` fills this in from sitemap.xml automatically.
  // List a page here only when you want to assert its title/h1, or when it
  // needs a `readySelector` (something async — a hero video, a chart — that
  // the smoke/visual tests should wait for before checking the page).
  //
  // pages: [
  //   { path: '/', title: /example/i, h1: 'Welcome' },
  //   { path: '/pricing', readySelector: '[data-pricing-table]' },
  // ],

  // --- Discovery ------------------------------------------------------------
  // discover: {
  //   maxPages: 25,                    // raise deliberately — every page multiplies across ~9 tiers x 3 viewports
  //   include: ['^/blog/'],             // only crawl paths matching these
  //   exclude: ['^/blog/tag/'],         // drop paths matching these
  // },

  // --- Global nav -------------------------------------------------------
  // Asserts the header/footer nav contains these links on every page.
  // globalNav: {
  //   selector: 'header nav',
  //   expected: ['Home', 'Pricing', 'Contact'],
  // },

  // --- Content ------------------------------------------------------------
  // content: {
  //   placeholderPatterns: ['acme corp'],  // extra placeholder strings to fail on
  //   requiredLinks: ['privacy', 'terms'], // link text/href that must exist somewhere on the homepage
  //   skipContactCheck: false,             // set true if this site genuinely has no contact info
  // },

  // --- Links --------------------------------------------------------------
  // links: {
  //   externalOpensNewTab: true,          // default true; set false for sites whose subsidiaries share a tab intentionally
  //   genericTextDenylist: ['tap here'],  // extra generic link phrases to flag
  // },

  // --- Media ----------------------------------------------------------------
  // media: {
  //   maxImageKB: 300, // fail images heavier than this
  // },

  // --- Mobile ---------------------------------------------------------------
  // mobile: {
  //   minTapTarget: 44, // WCAG 2.5.5 default
  //   minFontSize: 12,
  // },

  // --- Visual regression ------------------------------------------------
  // visual: {
  //   mask: ['.carousel', '[data-testimonial]'], // hide elements that always change
  //   maxDiffPixelRatio: 0.01,
  //   disableAnimations: true,
  // },

  // --- Accessibility ------------------------------------------------------
  // a11y: {
  //   disableRules: ['color-contrast'], // waive a rule — put a ticket link in a comment here, not just the rule name
  //   tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  // },

  // --- SEO ------------------------------------------------------------------
  // seo: {
  //   requireCanonical: true,
  //   requireOpenGraph: true,
  //   requireRobotsAndSitemap: true,
  // },

  // --- Design references ---------------------------------------------------
  // Not automated — printed into the generated manual checklist for the reviewer.
  // design: {
  //   figmaDesktop: 'https://figma.com/file/...',
  //   figmaMobile: 'https://figma.com/file/...',
  //   uiDev: 'https://staging.example.com',
  // },

  // --- Opt out of a tier entirely ------------------------------------------
  // Use sparingly — a skip should have a reason, e.g. a staging domain that's
  // intentionally noindexed so `seo` assertions don't make sense yet.
  // skip: ['seo'],
};

export default site;
