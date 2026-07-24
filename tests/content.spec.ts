import { test, expect } from '@playwright/test';
import { sites, skips } from '../sites';
import { urlFor, resolveBaseURL } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * Checklist tier: Content.
 *
 * Covers the mechanical half of the Content section. The judgement half
 * (are the facts right? is the CTA copy compelling?) is in the generated
 * manual checklist — see `npm run checklist`.
 */

// Things that should never survive to production.
const PLACEHOLDER_PATTERNS = [
  'lorem ipsum',
  'dolor sit amet',
  'consectetur adipiscing',
  'placeholder',
  'insert text here',
  'your text here',
  'your company name',
  'add content here',
  'coming soon\\.\\.\\.',
  'to be confirmed',
  'tbc',
  'todo',
  'fixme',
  'xxx+',
  'test test',
  'asdf',
  'dummy text',
  'sample text',
];

for (const site of sites) {
  if (skips(site, 'content')) continue;

  test.describe(`[${site.name}] content`, () => {
    const pages = pagesFor(site);

    for (const page_ of pages) {
      const label = page_.name ?? page_.path;

      test(`${label} has no placeholder content`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const patterns = [...PLACEHOLDER_PATTERNS, ...(site.content?.placeholderPatterns ?? [])];
        const text = await page.locator('body').innerText();

        const found = patterns
          .filter((p) => new RegExp(`\\b${p}\\b`, 'i').test(text))
          .map((p) => `"${p}"`);

        expect(found, `placeholder content still on the page`).toEqual([]);
      });

      test(`${label} heading structure is sane`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const problems = await page.evaluate(() => {
          const out: string[] = [];
          const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));

          const h1s = hs.filter((h) => h.tagName === 'H1');
          if (h1s.length === 0) out.push('no <h1> on the page');
          if (h1s.length > 1) out.push(`${h1s.length} <h1> elements (should be 1)`);

          // A skipped level (h2 -> h4) breaks screen-reader navigation.
          let prev = 0;
          for (const h of hs) {
            const level = Number(h.tagName[1]);
            if (prev && level > prev + 1) {
              out.push(`heading jumps h${prev} -> h${level}: "${h.textContent?.trim().slice(0, 40)}"`);
            }
            prev = level;
          }

          const empty = hs.filter((h) => !h.textContent?.trim()).length;
          if (empty) out.push(`${empty} empty heading(s)`);

          return out;
        });

        expect(problems, 'heading hierarchy problems').toEqual([]);
      });
    }

    test('legal and required links exist', async ({ page }) => {
      await page.goto(urlFor(site, pages[0]), { waitUntil: 'domcontentloaded' });

      const required = site.content?.requiredLinks ?? ['privacy', 'terms'];
      const linkText = await page.$$eval('a', (as) =>
        as.map((a) => `${a.textContent ?? ''} ${(a as HTMLAnchorElement).getAttribute('href') ?? ''}`),
      );

      const missing = required.filter((r) => !linkText.some((t) => new RegExp(r, 'i').test(t)));
      expect(missing, 'required links not found anywhere on the homepage').toEqual([]);
    });

    test('footer has copyright and links', async ({ page }) => {
      await page.goto(urlFor(site, pages[0]), { waitUntil: 'domcontentloaded' });

      const footer = page.locator('footer, [role="contentinfo"]').first();
      await expect(footer, 'no <footer> or role="contentinfo" found').toBeVisible();

      const footerText = await footer.innerText();
      expect(footerText, 'no copyright notice in the footer').toMatch(/©|\(c\)|copyright/i);

      // A stale copyright year is the classic "nobody maintains this site" tell.
      const years = [...footerText.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
      if (years.length) {
        const thisYear = new Date().getFullYear();
        expect(
          Math.max(...years),
          `footer copyright year is stale (found ${Math.max(...years)}, expected ${thisYear})`,
        ).toBeGreaterThanOrEqual(thisYear);
      }

      const footerLinks = await footer.locator('a').count();
      expect(footerLinks, 'footer has no links').toBeGreaterThan(0);
    });

    if (!site.content?.skipContactCheck) {
      test('contact details are present and machine-readable', async ({ page }) => {
        await page.goto(urlFor(site, pages[0]), { waitUntil: 'domcontentloaded' });

        const body = await page.locator('body').innerText();
        const hasMailto = (await page.locator('a[href^="mailto:"]').count()) > 0;
        const hasTel = (await page.locator('a[href^="tel:"]').count()) > 0;
        const hasEmailText = /[\w.+-]+@[\w-]+\.[\w.]+/.test(body);

        expect(
          hasMailto || hasEmailText,
          'no email address found on the homepage',
        ).toBeTruthy();

        // Phone numbers as plain text don't tap-to-call on mobile.
        expect(hasTel, 'no tel: link — phone numbers should be tappable on mobile').toBeTruthy();
      });
    }

    test('no duplicate titles or meta descriptions across pages', async ({ page }) => {
      const titles = new Map<string, string[]>();
      const descs = new Map<string, string[]>();

      for (const p of pages) {
        await page.goto(urlFor(site, p), { waitUntil: 'domcontentloaded' });
        const title = await page.title();
        const desc = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';

        if (title) titles.set(title, [...(titles.get(title) ?? []), p.path]);
        if (desc) descs.set(desc, [...(descs.get(desc) ?? []), p.path]);
      }

      const dupTitles = [...titles.entries()]
        .filter(([, paths]) => paths.length > 1)
        .map(([t, paths]) => `title "${t.slice(0, 50)}" on: ${paths.join(', ')}`);

      const dupDescs = [...descs.entries()]
        .filter(([, paths]) => paths.length > 1)
        .map(([d, paths]) => `description "${d.slice(0, 50)}..." on: ${paths.join(', ')}`);

      expect([...dupTitles, ...dupDescs], 'duplicate page metadata').toEqual([]);
    });

    test('no duplicate body content across pages', async ({ page }) => {
      const seen = new Map<string, string[]>();

      for (const p of pages) {
        await page.goto(urlFor(site, p), { waitUntil: 'domcontentloaded' });
        // Hash the main content, not the shared header/footer chrome.
        const body = await page.evaluate(() => {
          const main = document.querySelector('main, [role="main"], article') ?? document.body;
          return (main as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
        });
        if (body.length < 200) continue; // too thin to judge
        const key = body.slice(0, 500);
        seen.set(key, [...(seen.get(key) ?? []), p.path]);
      }

      const dupes = [...seen.entries()]
        .filter(([, paths]) => paths.length > 1)
        .map(([, paths]) => `identical content on: ${paths.join(', ')}`);

      expect(dupes, 'duplicate content between pages').toEqual([]);
    });
  });
}
