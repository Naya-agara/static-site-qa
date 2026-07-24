import { test, expect } from '@playwright/test';
import { sites, skips } from '../sites';
import { urlFor } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * Checklist tier: Layout (the automatable parts).
 *
 * Alignment, spacing, and "does it match Figma" are deliberately absent —
 * visual regression covers drift, and a human covers the Figma comparison.
 * What's here is behaviour a screenshot can't see.
 */
for (const site of sites) {
  if (skips(site, 'layout')) continue;

  test.describe(`[${site.name}] layout`, () => {
    const pages = pagesFor(site);

    for (const page_ of pages.slice(0, 5)) {
      const label = page_.name ?? page_.path;

      test(`${label} is keyboard navigable`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'load' });

        const problems: string[] = [];
        const visited: string[] = [];

        // Tab through the first 30 stops and make sure focus is real and visible.
        for (let i = 0; i < 30; i++) {
          await page.keyboard.press('Tab');

          const focused = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body) return null;

            const s = getComputedStyle(el);
            const hasOutline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
            const hasShadow = s.boxShadow !== 'none';
            const hasBorderChange = s.borderStyle !== 'none';

            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName.toLowerCase(),
              label: (el.textContent ?? '').trim().slice(0, 30) || el.getAttribute('aria-label') || '',
              visibleFocus: hasOutline || hasShadow || hasBorderChange,
              onScreen: r.width > 0 && r.height > 0,
            };
          });

          if (!focused) break;

          const id = `${focused.tag}:${focused.label}`;
          // Same element focused twice running = focus trap.
          if (visited.length && visited[visited.length - 1] === id && visited.length > 2) {
            problems.push(`focus appears trapped on <${focused.tag}> "${focused.label}"`);
            break;
          }
          visited.push(id);

          if (focused.onScreen && !focused.visibleFocus) {
            problems.push(`no visible focus indicator on <${focused.tag}> "${focused.label}"`);
          }
        }

        expect(visited.length, 'nothing is keyboard focusable on this page').toBeGreaterThan(0);
        expect([...new Set(problems)].slice(0, 8), 'keyboard navigation problems').toEqual([]);
      });

      test(`${label} does not jump around while loading`, async ({ page, browserName }) => {
        // The layout-shift PerformanceObserver entry is Chromium-only.
        test.skip(browserName !== 'chromium', 'layout-shift API is Chromium-only');

        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const cls = await page.evaluate(() => {
          return new Promise<number>((resolve) => {
            let total = 0;
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as unknown as Array<{
                value: number;
                hadRecentInput: boolean;
              }>) {
                if (!entry.hadRecentInput) total += entry.value;
              }
            });
            observer.observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => {
              observer.disconnect();
              resolve(total);
            }, 3000);
          });
        });

        // Google's "good" CLS threshold. Usually caused by images without
        // width/height, or web fonts swapping in.
        expect(cls, `cumulative layout shift is ${cls.toFixed(3)} (good is under 0.1)`).toBeLessThan(0.1);
      });
    }
  });
}
