import { test, expect } from '@playwright/test';
import { sites, skips } from '../sites';
import { urlFor, resolveBaseURL } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * Smoke: does the page exist, render, and link to the right places?
 * Assert on structure and behaviour — never on marketing copy.
 */
for (const site of sites) {
  if (skips(site, 'smoke')) continue;

  test.describe(`[${site.name}] smoke`, () => {
    const pages = pagesFor(site);

    for (const page_ of pages) {
      const label = page_.name ?? page_.path;

      test(`${label} renders`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const failedRequests: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('requestfailed', (req) => {
          // Ignore aborted requests — usually navigation cancelling in-flight fetches.
          const reason = req.failure()?.errorText ?? '';
          if (reason.includes('ERR_ABORTED')) return;
          failedRequests.push(`${req.url()} (${reason})`);
        });

        const response = await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        // 1. Server said OK
        expect(response, 'no response received').toBeTruthy();
        expect(response!.status(), `unexpected status for ${page_.path}`).toBeLessThan(400);

        // 2. Page is actually ready
        if (page_.readySelector) {
          await expect(page.locator(page_.readySelector)).toBeVisible();
        }

        // 3. Title
        if (page_.title) {
          await expect(page).toHaveTitle(
            typeof page_.title === 'string' ? new RegExp(escapeRe(page_.title)) : page_.title,
          );
        } else {
          await expect(page).not.toHaveTitle('');
        }

        // 4. Exactly one h1, matching if specified
        const h1 = page.locator('h1');
        await expect(h1, 'page should have exactly one <h1>').toHaveCount(1);
        if (page_.h1) {
          await expect(h1).toHaveText(
            typeof page_.h1 === 'string' ? new RegExp(escapeRe(page_.h1)) : page_.h1,
          );
        }

        // 5. No broken images (naturalWidth 0 = failed to load)
        const brokenImages = await page.evaluate(() =>
          Array.from(document.images)
            .filter((img) => img.complete && img.naturalWidth === 0)
            .map((img) => img.currentSrc || img.src),
        );
        expect(brokenImages, 'broken images found').toEqual([]);

        // 6. Clean console and network
        expect(failedRequests, 'failed network requests').toEqual([]);
        expect(consoleErrors, 'console errors').toEqual([]);
      });
    }

    if (site.globalNav) {
      test('global nav is present and complete', async ({ page }) => {
        await page.goto(urlFor(site, pages[0]));
        const nav = page.locator(site.globalNav!.selector);
        await expect(nav).toBeVisible();
        for (const item of site.globalNav!.expected) {
          await expect(
            nav.getByRole('link', { name: item, exact: false }),
            `nav link "${item}" missing`,
          ).toHaveCount(1);
        }
      });
    }

    test('internal links all resolve', async ({ page, request }) => {
      await page.goto(urlFor(site, pages[0]));

      const origin = new URL(urlFor(site, pages[0])).origin;
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));

      const internal = [...new Set(hrefs)].filter(
        (h) => h.startsWith(origin) && !h.includes('#') && !h.startsWith('mailto:'),
      );

      const broken: string[] = [];
      for (const href of internal) {
        const res = await request.head(href, { failOnStatusCode: false });
        // Some static hosts don't implement HEAD — retry with GET before failing.
        const status =
          res.status() === 405 ? (await request.get(href, { failOnStatusCode: false })).status() : res.status();
        if (status >= 400) broken.push(`${href} -> ${status}`);
      }
      expect(broken, 'broken internal links').toEqual([]);
    });

    test('404 page returns a real 404', async ({ page }) => {
      const res = await page.goto(`${resolveBaseURL(site)}/this-page-should-not-exist-qa`, {
        waitUntil: 'domcontentloaded',
      });
      expect(res?.status(), 'missing pages must return 404, not 200').toBe(404);
    });
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
