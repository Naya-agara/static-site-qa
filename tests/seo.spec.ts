import { test, expect } from '@playwright/test';
import { sites, skips } from '../sites';
import { urlFor, resolveBaseURL } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * SEO / metadata hygiene. This is where static sites actually rot —
 * a missing canonical or a stray noindex ships silently and nobody notices
 * for a quarter.
 */
for (const site of sites) {
  if (skips(site, 'seo')) continue;

  test.describe(`[${site.name}] seo`, () => {
    const pages = pagesFor(site);

    for (const page_ of pages) {
      const label = page_.name ?? page_.path;

      test(`${label} metadata`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        // Meta description present and a sane length
        const desc = await page.locator('meta[name="description"]').getAttribute('content');
        expect(desc, 'missing meta description').toBeTruthy();
        expect(desc!.length, 'meta description length').toBeGreaterThan(50);
        expect(desc!.length, 'meta description length').toBeLessThan(200);

        // No accidental noindex on a public page
        const robots = await page.locator('meta[name="robots"]').getAttribute('content');
        expect(robots ?? '', 'page is marked noindex').not.toContain('noindex');

        // Language declared
        await expect(page.locator('html'), 'missing lang attribute').toHaveAttribute('lang', /.+/);

        if (site.seo?.requireCanonical !== false) {
          const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
          expect(canonical, 'missing canonical link').toBeTruthy();
        }

        if (site.seo?.requireOpenGraph !== false) {
          for (const prop of ['og:title', 'og:description', 'og:image']) {
            const content = await page.locator(`meta[property="${prop}"]`).getAttribute('content');
            expect(content, `missing ${prop}`).toBeTruthy();
          }
        }
      });
    }

    if (site.seo?.requireRobotsAndSitemap !== false) {
      test('robots.txt and sitemap.xml exist', async ({ request }) => {
        const base = resolveBaseURL(site);

        const robots = await request.get(`${base}/robots.txt`, { failOnStatusCode: false });
        expect(robots.status(), 'robots.txt').toBe(200);

        const sitemap = await request.get(`${base}/sitemap.xml`, { failOnStatusCode: false });
        expect(sitemap.status(), 'sitemap.xml').toBe(200);
        expect(await sitemap.text(), 'sitemap.xml is not valid XML').toContain('<urlset');
      });

      test('robots.txt does not block the whole site', async ({ request }) => {
        const body = await (await request.get(`${resolveBaseURL(site)}/robots.txt`)).text();
        const blocksEverything = /^\s*Disallow:\s*\/\s*$/m.test(body);
        expect(blocksEverything, 'robots.txt has "Disallow: /" — site is hidden from search').toBe(false);
      });
    }
  });
}
