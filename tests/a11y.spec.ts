import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sites, skips } from '../sites';
import { urlFor } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * Accessibility. Fails on WCAG 2.0/2.1 A + AA violations by default.
 *
 * Turning a rule off is a decision, not a shrug — put the ticket number
 * next to it in the site config.
 */
for (const site of sites) {
  if (skips(site, 'a11y')) continue;

  test.describe(`[${site.name}] a11y`, () => {
    const pages = pagesFor(site);

    for (const page_ of pages) {
      const label = page_.name ?? page_.path;

      test(`${label} has no WCAG A/AA violations`, async ({ page }, testInfo) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'load' });
        if (page_.readySelector) {
          await expect(page.locator(page_.readySelector)).toBeVisible();
        }

        let builder = new AxeBuilder({ page }).withTags(site.a11y?.tags ?? ['wcag2a', 'wcag2aa', 'wcag21aa']);

        if (site.a11y?.disableRules?.length) {
          builder = builder.disableRules(site.a11y.disableRules);
        }

        const results = await builder.analyze();

        // Attach the full report so failures are debuggable from the HTML report.
        await testInfo.attach('axe-results.json', {
          body: JSON.stringify(results.violations, null, 2),
          contentType: 'application/json',
        });

        const summary = results.violations.map(
          (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`,
        );
        expect(summary, 'accessibility violations').toEqual([]);
      });
    }
  });
}
