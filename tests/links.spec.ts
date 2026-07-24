import { test, expect } from '@playwright/test';
import { sites, skips } from '../sites';
import { urlFor } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * Checklist tier: Links and CTAs.
 *
 * "Is the CTA copy compelling?" and "is it strategically placed?" are not here —
 * no tool can answer those. They're in the manual checklist.
 */

const GENERIC_LINK_TEXT = [
  'click here',
  'here',
  'read more',
  'more',
  'learn more',
  'this link',
  'link',
  'go',
  'continue',
  'details',
  'this page',
  'download',
];

for (const site of sites) {
  if (skips(site, 'links')) continue;

  test.describe(`[${site.name}] links`, () => {
    const pages = pagesFor(site);

    for (const page_ of pages) {
      const label = page_.name ?? page_.path;

      test(`${label} link text is descriptive`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const denylist = [...GENERIC_LINK_TEXT, ...(site.links?.genericTextDenylist ?? [])];

        const bad = await page.evaluate((deny: string[]) => {
          const out: string[] = [];
          for (const a of Array.from(document.querySelectorAll('a[href]'))) {
            const el = a as HTMLAnchorElement;
            if (el.offsetParent === null) continue; // hidden

            const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            const aria = el.getAttribute('aria-label')?.trim();
            const imgAlt = el.querySelector('img')?.getAttribute('alt')?.trim();
            const accessibleName = aria || text || imgAlt || '';

            if (!accessibleName) {
              out.push(`empty link -> ${el.getAttribute('href')}`);
              continue;
            }
            // aria-label rescues generic visible text, so only flag when both are generic.
            const nameToJudge = (aria || text).toLowerCase().replace(/[^a-z ]/g, '').trim();
            if (deny.includes(nameToJudge)) {
              out.push(`generic link text "${accessibleName}" -> ${el.getAttribute('href')}`);
            }
          }
          return out;
        }, denylist);

        expect(bad, 'non-descriptive link text').toEqual([]);
      });

      test(`${label} external links are safe and open correctly`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const origin = new URL(urlFor(site, page_)).origin;
        const requireNewTab = site.links?.externalOpensNewTab !== false;

        const problems = await page.evaluate(
          ({ origin, requireNewTab }: { origin: string; requireNewTab: boolean }) => {
            const out: string[] = [];
            for (const a of Array.from(document.querySelectorAll('a[href]'))) {
              const el = a as HTMLAnchorElement;
              const href = el.href;
              if (!href.startsWith('http') || href.startsWith(origin)) continue;

              const target = el.getAttribute('target');
              const rel = el.getAttribute('rel') ?? '';

              if (requireNewTab && target !== '_blank') {
                out.push(`external link does not open in a new tab: ${href}`);
              }
              // target=_blank without noopener lets the opened page control window.opener.
              if (target === '_blank' && !/noopener|noreferrer/.test(rel)) {
                out.push(`target="_blank" without rel="noopener": ${href}`);
              }
            }
            return out;
          },
          { origin, requireNewTab },
        );

        expect(problems, 'external link problems').toEqual([]);
      });

      test(`${label} has no duplicate or conflicting links`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const conflicts = await page.evaluate(() => {
          const byText = new Map<string, Set<string>>();
          for (const a of Array.from(document.querySelectorAll('a[href]'))) {
            const el = a as HTMLAnchorElement;
            if (el.offsetParent === null) continue;
            const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (!text) continue;
            if (!byText.has(text)) byText.set(text, new Set());
            byText.get(text)!.add(el.href);
          }
          // Same words, different destinations — confusing for everyone, broken for screen readers.
          return [...byText.entries()]
            .filter(([, hrefs]) => hrefs.size > 1)
            .map(([text, hrefs]) => `"${text}" points to ${hrefs.size} different URLs: ${[...hrefs].join(' | ')}`);
        });

        expect(conflicts, 'same link text pointing to different destinations').toEqual([]);
      });

      test(`${label} links are visually distinguishable from text`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const undistinguished = await page.evaluate(() => {
          const out: string[] = [];
          const links = Array.from(document.querySelectorAll('p a[href], li a[href]')).slice(0, 30);

          for (const a of links) {
            const el = a as HTMLElement;
            if (el.offsetParent === null) continue;

            const parent = el.parentElement;
            if (!parent) continue;

            const ls = getComputedStyle(el);
            const ps = getComputedStyle(parent);

            const sameColour = ls.color === ps.color;
            const noUnderline = !ls.textDecorationLine.includes('underline');
            const sameWeight = ls.fontWeight === ps.fontWeight;

            // WCAG 1.4.1: colour alone isn't enough, but colour+weight+decoration all
            // matching the surrounding text means the link is simply invisible.
            if (sameColour && noUnderline && sameWeight) {
              out.push(`link "${(el.textContent ?? '').trim().slice(0, 30)}" looks identical to body text`);
            }
          }
          return out;
        });

        expect(undistinguished, 'inline links indistinguishable from surrounding text').toEqual([]);
      });
    }
  });
}
