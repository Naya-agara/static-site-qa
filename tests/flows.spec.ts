import { test, expect } from '@playwright/test';
import { sites, skips } from '../sites';
import { urlFor } from '../sites/types';
import { pagesFor } from '../lib/pages';

/**
 * Checklist tier: interactive flows.
 *
 * The other tiers check structure on a static DOM. This one drives the
 * widgets a visitor actually touches — disclosure menus, carousels, forms —
 * using ARIA semantics rather than framework-specific selectors, so it
 * works whether a site is Webflow, hand-rolled, or something else.
 *
 * Every test feature-detects its target and skips (not fails) when a page
 * doesn't have that widget. None of these submit a real form — that would
 * hit third-party endpoints (spam filters, CRMs, real inboxes) from CI.
 */

const ACTIVE_SLIDE =
  '.swiper-slide-active, .splide__slide--active, [role="group"][aria-current="true"], [role="group"][aria-hidden="false"]';

for (const site of sites) {
  if (skips(site, 'flows')) continue;

  test.describe(`[${site.name}] flows`, () => {
    const pages = pagesFor(site);

    test('disclosure menus open on click and close on outside click', async ({ page }) => {
      await page.goto(urlFor(site, pages[0]), { waitUntil: 'domcontentloaded' });

      const toggles = page.locator('[aria-haspopup][aria-expanded="false"]');
      const count = await toggles.count();
      test.skip(count === 0, 'no disclosure menus (aria-haspopup) on this page');

      const problems: string[] = [];
      let tested = 0;

      for (let i = 0; i < count && tested < 6; i++) {
        const toggle = toggles.nth(i);
        if (!(await toggle.isVisible())) continue;
        tested++;

        const name = ((await toggle.textContent()) ?? `menu #${i}`).trim();
        const controlsId = await toggle.getAttribute('aria-controls');

        await toggle.click();
        try {
          await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 });
          if (controlsId) {
            const panel = page.locator(`[id="${controlsId}"]`);
            await expect(panel, `"${name}" reports open but its panel isn't visible`).toBeVisible({ timeout: 2_000 });
          }
        } catch {
          problems.push(`"${name}" did not stay open after being clicked (a hover handler may be fighting the click toggle)`);
          continue;
        }

        // Click somewhere neutral to close it.
        await page.locator('body').click({ position: { x: 5, y: 5 } });
        try {
          await expect(toggle).toHaveAttribute('aria-expanded', 'false', { timeout: 5_000 });
        } catch {
          problems.push(`"${name}" stayed open after clicking outside it`);
        }
      }

      expect(tested, 'no visible disclosure menus were found to test').toBeGreaterThan(0);
      expect(problems, 'disclosure menu problems').toEqual([]);
    });

    test('carousel next/previous controls change the active slide', async ({ page }) => {
      await page.goto(urlFor(site, pages[0]), { waitUntil: 'domcontentloaded' });

      const next = page.getByRole('button', { name: /next slide/i }).first();
      const prev = page.getByRole('button', { name: /previous slide/i }).first();
      test.skip(
        (await next.count()) === 0 || (await prev.count()) === 0,
        'no next/previous slide controls on this page',
      );

      const activeSlide = () => page.locator(ACTIVE_SLIDE).first();
      test.skip((await activeSlide().count()) === 0, 'could not identify which slide is active');

      const before = await activeSlide().evaluate((el) => el.outerHTML);

      await next.click();
      await expect(async () => {
        const after = await activeSlide().evaluate((el) => el.outerHTML);
        expect(after, 'clicking "Next slide" did not change the active slide').not.toBe(before);
      }).toPass({ timeout: 5_000 });

      const afterNext = await activeSlide().evaluate((el) => el.outerHTML);

      await prev.click();
      await expect(async () => {
        const after = await activeSlide().evaluate((el) => el.outerHTML);
        expect(after, 'clicking "Previous slide" did not change the active slide').not.toBe(afterNext);
      }).toPass({ timeout: 5_000 });
    });

    for (const page_ of pages) {
      const label = page_.name ?? page_.path;

      test(`${label} forms enforce native field validation`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const formCount = await page.locator('form').count();
        test.skip(formCount === 0, 'no forms on this page');

        const problems: string[] = await page.evaluate(() => {
          const out: string[] = [];
          const forms = Array.from(document.querySelectorAll('form'));

          forms.forEach((f, i) => {
            const required = f.querySelectorAll('[required]');
            if (required.length && f.checkValidity()) {
              out.push(`form #${i} reports valid even though ${required.length} required field(s) are empty`);
            }

            for (const email of Array.from(f.querySelectorAll('input[type=email]')) as HTMLInputElement[]) {
              const original = email.value;
              email.value = 'not-an-email';
              if (email.checkValidity()) {
                out.push(`form #${i} field "${email.name || email.id}" accepts "not-an-email" as a valid email`);
              }
              email.value = original;
            }
          });

          return out;
        });

        expect(problems, 'form validation problems').toEqual([]);
      });

      test(`${label} form submit controls are keyboard operable`, async ({ page }) => {
        await page.goto(urlFor(site, page_), { waitUntil: 'domcontentloaded' });

        const formCount = await page.locator('form').count();
        test.skip(formCount === 0, 'no forms on this page');

        const problems: string[] = await page.evaluate(() => {
          const out: string[] = [];
          const forms = Array.from(document.querySelectorAll('form'));

          forms.forEach((f, i) => {
            const candidates = Array.from(
              f.querySelectorAll('button, input[type=submit], input[type=button], [role="button"]'),
            );
            const operable = candidates.some((el) => {
              const tag = el.tagName.toLowerCase();
              if (tag === 'button') return true;
              if (tag === 'input' && ['submit', 'button'].includes((el as HTMLInputElement).type)) return true;
              const tabindex = el.getAttribute('tabindex');
              return el.getAttribute('role') === 'button' && tabindex !== null && Number(tabindex) >= 0;
            });
            if (!operable) {
              out.push(
                `form #${i} has no keyboard-operable submit control ` +
                  `(needs a <button>, input[type=submit], or role="button" with a tabindex)`,
              );
            }
          });

          return out;
        });

        expect(problems, 'form submit-control accessibility problems').toEqual([]);
      });
    }
  });
}
