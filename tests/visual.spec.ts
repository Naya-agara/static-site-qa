import { test, expect } from '@playwright/test';
import { sites, skips } from '../sites';
import { urlFor, slug } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * Visual regression. Runs per viewport project (desktop / tablet / mobile).
 *
 * First run creates baselines and PASSES — review the PNGs before committing.
 * Update after an intentional change:  npm run test:visual:update
 */
for (const site of sites) {
  if (skips(site, 'visual')) continue;

  test.describe(`[${site.name}] visual`, () => {
    const pages = pagesFor(site);

    for (const page_ of pages) {
      if (page_.noVisual) continue;
      const label = page_.name ?? page_.path;

      test(`${label}`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'load' });

        if (page_.readySelector) {
          await expect(page.locator(page_.readySelector)).toBeVisible();
        }

        // Web fonts settle before we shoot, or every run diffs.
        await page.evaluate(() => document.fonts.ready);

        // Trigger lazy-loaded images by scrolling the full page, then return to top.
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let y = 0;
            const step = () => {
              window.scrollTo(0, y);
              y += window.innerHeight;
              if (y < document.body.scrollHeight) requestAnimationFrame(step);
              else {
                window.scrollTo(0, 0);
                resolve();
              }
            };
            step();
          });
        });
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot(`${site.name}/${slug(page_.path)}.png`, {
          fullPage: true,
          animations: site.visual?.disableAnimations === false ? 'allow' : 'disabled',
          caret: 'hide',
          mask: (site.visual?.mask ?? []).map((sel) => page.locator(sel)),
          maxDiffPixelRatio: site.visual?.maxDiffPixelRatio ?? 0.01,
        });
      });
    }
  });
}
