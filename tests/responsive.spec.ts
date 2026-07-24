import { test, expect } from '@playwright/test';
import { sites, skips } from '../sites';
import { urlFor } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * Checklist tier: Mobile.
 *
 * Runs on the `responsive` project (iPhone 13 viewport). Horizontal overflow
 * is the single most common static-site mobile defect and the cheapest to catch,
 * so it runs first.
 */
for (const site of sites) {
  if (skips(site, 'responsive')) continue;

  test.describe(`[${site.name}] responsive`, () => {
    const pages = pagesFor(site);

    test('viewport meta allows zooming', async ({ page }) => {
      await page.goto(urlFor(site, pages[0]), { waitUntil: 'domcontentloaded' });

      const content = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(content, 'no viewport meta tag — the site will render at desktop width on phones').toBeTruthy();
      expect(content!, 'viewport must set width=device-width').toMatch(/width\s*=\s*device-width/i);

      // Blocking zoom fails WCAG 1.4.4 and hurts anyone with low vision.
      expect(content!, 'viewport disables zooming (user-scalable=no)').not.toMatch(/user-scalable\s*=\s*no/i);
      expect(content!, 'viewport caps zoom (maximum-scale under 2)').not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
    });

    for (const page_ of pages) {
      const label = page_.name ?? page_.path;

      test(`${label} does not scroll sideways`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);

        const overflow = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          if (scrollW <= vw + 1) return null;

          // Name the actual culprits, not just "the page is too wide".
          const culprits: string[] = [];
          for (const el of Array.from(document.body.querySelectorAll('*')).slice(0, 3000)) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.right > vw + 1) {
              const id = el.id ? `#${el.id}` : '';
              const cls = typeof el.className === 'string' && el.className
                ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
                : '';
              culprits.push(`<${el.tagName.toLowerCase()}${id}${cls}> extends ${Math.round(r.right - vw)}px past the edge`);
            }
          }
          return { vw, scrollW, culprits: [...new Set(culprits)].slice(0, 8) };
        });

        expect(
          overflow,
          overflow
            ? `page is ${overflow.scrollW}px wide in a ${overflow.vw}px viewport:\n  ${overflow.culprits.join('\n  ')}`
            : '',
        ).toBeNull();
      });

      test(`${label} text is readable without zooming`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'load' });
        const min = site.mobile?.minFontSize ?? 12;

        const tiny = await page.evaluate((minPx: number) => {
          const out = new Map<string, number>();
          for (const el of Array.from(document.querySelectorAll('p, li, span, td, div, a, label'))) {
            const e = el as HTMLElement;
            if (!e.offsetParent) continue;
            const text = Array.from(e.childNodes)
              .filter((n) => n.nodeType === Node.TEXT_NODE)
              .map((n) => n.textContent?.trim())
              .join('');
            if (!text || text.length < 10) continue;

            const size = parseFloat(getComputedStyle(e).fontSize);
            if (size < minPx) {
              const key = `${e.tagName.toLowerCase()} @ ${size}px: "${text.slice(0, 40)}"`;
              out.set(key, size);
            }
          }
          return [...out.keys()].slice(0, 10);
        }, min);

        expect(tiny, `text smaller than ${min}px`).toEqual([]);
      });

      test(`${label} tap targets are big enough`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'load' });
        const min = site.mobile?.minTapTarget ?? 44;

        const small = await page.evaluate((minPx: number) => {
          const out: string[] = [];
          const targets = document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]');

          for (const el of Array.from(targets)) {
            const e = el as HTMLElement;
            if (!e.offsetParent) continue;
            const r = e.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;

            // Inline links inside a paragraph are exempt — WCAG 2.5.5 carves them out.
            const inParagraph = e.closest('p, li') && e.tagName === 'A';
            if (inParagraph) continue;

            if (r.width < minPx || r.height < minPx) {
              const name = (e.textContent ?? '').trim().slice(0, 30) || e.getAttribute('aria-label') || e.tagName;
              out.push(`"${name}" is ${Math.round(r.width)}x${Math.round(r.height)}px`);
            }
          }
          return [...new Set(out)].slice(0, 10);
        }, min);

        expect(small, `tap targets smaller than ${min}x${min}px`).toEqual([]);
      });
    }

    test('landscape orientation does not break the layout', async ({ page }) => {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.goto(urlFor(site, pages[0]), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflows, 'page scrolls sideways in landscape').toBe(false);
    });

    test('sticky elements do not swallow the screen', async ({ page }) => {
      await page.goto(urlFor(site, pages[0]), { waitUntil: 'load' });

      const coverage = await page.evaluate(() => {
        const vh = window.innerHeight;
        let stickyPx = 0;
        for (const el of Array.from(document.body.querySelectorAll('*')).slice(0, 2000)) {
          const s = getComputedStyle(el);
          if (s.position !== 'fixed' && s.position !== 'sticky') continue;
          const r = el.getBoundingClientRect();
          if (r.height === 0 || r.width < window.innerWidth * 0.5) continue;
          stickyPx += r.height;
        }
        return stickyPx / vh;
      });

      // Fixed headers + cookie bars + chat widgets stacking up is a real pattern.
      expect(
        coverage,
        `fixed/sticky elements cover ${Math.round(coverage * 100)}% of the mobile viewport`,
      ).toBeLessThan(0.4);
    });
  });
}
