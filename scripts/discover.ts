/**
 * Discovers a site's pages so a dev only has to supply a URL.
 *
 *   SITE=acme npx tsx scripts/discover.ts
 *   npm run discover                          # all sites
 *
 * Strategy: sitemap.xml (following sitemap indexes) -> homepage link crawl.
 * Writes .discovered/<site>.json, which the specs read at collection time.
 *
 * Run this before `npm test` on a new site. It's cached, so it's a one-off
 * until the site's page list changes.
 */
import { chromium } from '@playwright/test';
import { sites } from '../sites';
import { resolveBaseURL, type PageSpec, type SiteConfig } from '../sites/types';
import { writeDiscovered, normalise } from '../lib/pages';

const DEFAULT_EXCLUDE = [
  '\\.(pdf|zip|jpg|jpeg|png|gif|svg|webp|mp4|xml|json|txt|ico|css|js)$',
  '/wp-admin',
  '/wp-json',
  '/feed',
  '\\?',
  '#',
];

async function fromSitemap(base: string, seen = new Set<string>()): Promise<string[]> {
  if (seen.has(base)) return [];
  seen.add(base);

  const res = await fetch(base, { redirect: 'follow' }).catch(() => null);
  if (!res || !res.ok) return [];

  const xml = await res.text();

  // A sitemap index points at more sitemaps — recurse into them.
  if (/<sitemapindex/i.test(xml)) {
    const children = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    const nested = await Promise.all(children.slice(0, 10).map((c) => fromSitemap(c, seen)));
    return nested.flat();
  }

  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
}

async function fromHomepage(base: string): Promise<string[]> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    return await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));
  } catch {
    return [];
  } finally {
    await browser.close();
  }
}

async function discover(site: SiteConfig): Promise<void> {
  const base = resolveBaseURL(site);
  const cfg = site.discover ?? {};
  const max = cfg.maxPages ?? 25;

  let urls: string[] = [];
  let source = '';

  if (cfg.fromSitemap !== false) {
    urls = await fromSitemap(`${base}/sitemap.xml`);
    if (urls.length) source = 'sitemap.xml';
  }

  if (!urls.length && cfg.crawlHomepage !== false) {
    urls = await fromHomepage(base);
    if (urls.length) source = 'homepage crawl';
  }

  if (!urls.length) {
    console.error(
      `  ✗ ${site.name}: found nothing at ${base}/sitemap.xml and no links on the homepage.\n` +
        `    Add an explicit \`pages\` array to sites/${site.name}.site.ts.`,
    );
    return;
  }

  const origin = new URL(base).origin;
  const include = (cfg.include ?? []).map((r) => new RegExp(r, 'i'));
  const exclude = [...DEFAULT_EXCLUDE, ...(cfg.exclude ?? [])].map((r) => new RegExp(r, 'i'));

  // The homepage itself is always a real, reachable page — seed it
  // unconditionally so a single-page site (or one whose only links are
  // external) still ends up with something to test, instead of silently
  // writing an empty page list.
  const paths = new Set<string>(['/']);
  for (const raw of urls) {
    let u: URL;
    try {
      u = new URL(raw, base);
    } catch {
      continue;
    }
    if (u.origin !== origin) continue;

    const p = normalise(u.pathname);
    if (exclude.some((re) => re.test(p))) continue;
    if (include.length && !include.some((re) => re.test(p))) continue;
    paths.add(p);
  }

  const sorted = [...paths].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
  const capped = sorted.slice(0, max);

  const pages: PageSpec[] = capped.map((p) => ({ path: p }));
  writeDiscovered(site.name, pages);

  const note = sorted.length > max ? ` (capped from ${sorted.length} — raise discover.maxPages)` : '';
  console.log(`  ✓ ${site.name}: ${capped.length} pages via ${source}${note}`);
}

(async () => {
  console.log(`Discovering pages for: ${sites.map((s) => s.name).join(', ')}\n`);
  for (const site of sites) {
    await discover(site);
  }
  console.log('\nWrote .discovered/. Run `npm test` next.');
})();
