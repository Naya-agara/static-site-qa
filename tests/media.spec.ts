import { test, expect } from '@playwright/test';
import { sites, skips } from '../sites';
import { urlFor } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * Checklist tier: Images and Media.
 *
 * Note: "usage rights and permissions" and "credit given where necessary"
 * are NOT here and cannot be. They're legal review — manual checklist only.
 */

// Junk alt text that passes a "has alt" check but helps nobody.
const JUNK_ALT = /^(image|img|photo|picture|icon|graphic|logo|banner|untitled|\d+|img[_-]?\d+|dsc[_-]?\d+)$/i;

for (const site of sites) {
  if (skips(site, 'media')) continue;

  test.describe(`[${site.name}] media`, () => {
    const pages = pagesFor(site);

    for (const page_ of pages) {
      const label = page_.name ?? page_.path;

      test(`${label} images are the right resolution`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);

        const problems = await page.evaluate(() => {
          const out: string[] = [];
          const dpr = window.devicePixelRatio || 1;

          for (const img of Array.from(document.images)) {
            if (!img.complete || img.naturalWidth === 0) continue;
            // SVGs are vector — naturalWidth says nothing about how they render.
            if (/\.svg(\?|$)/i.test(img.currentSrc || img.src)) continue;
            const rect = img.getBoundingClientRect();
            if (rect.width < 20 || rect.height < 20) continue; // icons/spacers

            const needed = rect.width * dpr;

            // Source narrower than its display box = visible pixelation.
            if (img.naturalWidth < needed * 0.8) {
              out.push(
                `pixelated: ${img.currentSrc.split('/').pop()} is ${img.naturalWidth}px wide, ` +
                  `displayed at ${Math.round(needed)}px`,
              );
            }
            // Source hugely larger than needed = wasted bandwidth.
            if (img.naturalWidth > needed * 3) {
              out.push(
                `oversized: ${img.currentSrc.split('/').pop()} is ${img.naturalWidth}px wide, ` +
                  `only needs ${Math.round(needed)}px`,
              );
            }
          }
          return out;
        });

        expect(problems, 'image resolution problems').toEqual([]);
      });

      test(`${label} alt text is meaningful`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'load' });

        const problems = await page.evaluate((junkSource: string) => {
          const junk = new RegExp(junkSource, 'i');
          const out: string[] = [];

          for (const img of Array.from(document.images)) {
            const file = (img.currentSrc || img.src).split('/').pop() ?? '';
            const alt = img.getAttribute('alt');

            // alt="" is correct for decorative images — don't flag it.
            if (alt === null) {
              out.push(`missing alt attribute: ${file}`);
              continue;
            }
            if (alt === '') continue;

            const trimmed = alt.trim();
            if (junk.test(trimmed)) out.push(`junk alt text "${trimmed}": ${file}`);
            if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(trimmed)) {
              out.push(`alt text is a filename "${trimmed}": ${file}`);
            }
            if (trimmed.length > 150) {
              out.push(`alt text is ${trimmed.length} chars (keep under ~150): ${file}`);
            }
          }
          return out;
        }, JUNK_ALT.source);

        expect(problems, 'alt text problems').toEqual([]);
      });

      test(`${label} images are not too heavy`, async ({ page }) => {
        const maxKB = site.media?.maxImageKB ?? 300;
        const heavy: string[] = [];

        page.on('response', async (res) => {
          if (!res.request().resourceType().match(/image/)) return;
          const len = Number(res.headers()['content-length'] ?? 0);
          if (len > maxKB * 1024) {
            heavy.push(`${Math.round(len / 1024)}KB: ${res.url().split('/').pop()}`);
          }
        });

        await page.goto(urlFor(site, page_), { waitUntil: 'load' });
        // networkidle never fires on sites with polling analytics — try, then move on.
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

        expect(heavy, `images over ${maxKB}KB`).toEqual([]);
      });

      test(`${label} video and audio behave`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const problems = await page.evaluate(() => {
          const out: string[] = [];
          for (const m of Array.from(document.querySelectorAll('video, audio'))) {
            const el = m as HTMLMediaElement;
            const src = el.currentSrc || el.getAttribute('src') || '(inline source)';

            // Autoplay with sound is blocked by browsers and hated by users.
            if (el.autoplay && !el.muted) out.push(`autoplays with sound: ${src}`);

            // Anything not decorative needs controls.
            if (!el.controls && !el.autoplay) out.push(`no player controls: ${src}`);

            if (el.tagName === 'VIDEO') {
              const hasCaptions = el.querySelector('track[kind="captions"], track[kind="subtitles"]');
              if (!hasCaptions) out.push(`video has no captions track: ${src}`);
            }
          }
          return out;
        });

        expect(problems, 'media problems').toEqual([]);
      });
    }
  });
}
