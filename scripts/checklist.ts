/**
 * Generates the human half of the checklist.
 *
 *   SITE=acme npx tsx scripts/checklist.ts
 *
 * The automated tiers cover roughly half of the PopularPower checklist. This
 * emits the rest — the items that need a person's judgement — as a per-site
 * markdown checklist, with the design links and page list already filled in.
 *
 * The point: the reviewer stops re-checking what the robot already checked,
 * and spends their attention on what only a human can answer.
 */
import fs from 'fs';
import path from 'path';
import { sites } from '../sites';
import { resolveBaseURL, type SiteConfig } from '../sites/types';
import { readDiscovered } from '../lib/pages';

type Section = { title: string; items: string[] };

const MANUAL: Section[] = [
  {
    title: 'Content — judgement',
    items: [
      'Spelling and grammar read correctly (automation only catches placeholder text, not real typos)',
      'All facts, figures, and dates are correct and current',
      'References and citations are properly attributed',
      'Contact details are **accurate** — call the number, send the email (automation only checks they exist)',
      'Legal pages (privacy, terms) are **current** — check the last-reviewed date with Legal',
      'CTA button text makes sense in the context of the surrounding content',
      'Headings and subheadings are appropriate, not just structurally valid',
    ],
  },
  {
    title: 'Layout — judgement',
    items: [
      'Pages match the Figma design (desktop) — compare side by side',
      'Text and images are aligned as designed; spacing matches the design system',
      'Content follows a logical visual hierarchy',
      'Pop-ups, modals, and overlays appear correctly and can be dismissed',
      'The 404 page is genuinely helpful — it points people somewhere useful',
    ],
  },
  {
    title: 'Links and CTAs — judgement',
    items: [
      'CTA text is compelling and action-oriented',
      'CTAs are clearly visible and stand out from surrounding content',
      'CTAs are strategically placed for visibility',
      'CTA design is consistent across the site (colour, size, shape)',
      'Visited links change colour (browsers restrict :visited styling — verify by eye)',
      'Hover and active states give clear visual feedback',
    ],
  },
  {
    title: 'Images and Media — judgement and legal',
    items: [
      '**All images and media have usage rights and permissions** — no automation can verify this',
      '**Credit is given where required and licences are adhered to**',
      'Alt text accurately describes the image *content and context* (automation only catches junk alt)',
      'Captions are correctly formatted and positioned',
      'Interactive media (slideshows, galleries) behaves correctly',
      'Media does not disrupt the flow of content',
    ],
  },
  {
    title: 'Performance and Compatibility — judgement',
    items: [
      'Animations and effects are appropriate and in line with the design',
      'Forms submit correctly **and the data actually arrives** — check the inbox/CRM/database',
      'Layout and design verified in Brave (Chromium-based; the automated Chromium run is a close proxy, not identical)',
    ],
  },
  {
    title: 'Mobile — judgement',
    items: [
      'Pages match the mobile Figma design',
      'Tested on at least one real phone and one real tablet (emulation is not the same thing)',
      'Touch gestures (swipe, tap, pinch) work as expected',
      'Navigation menu and dropdowns are usable on a real device',
      'Site loads acceptably on a real mobile network, not just throttled wifi',
      'Sticky headers/footers behave correctly while scrolling',
    ],
  },
];

const AUTOMATED_SUMMARY = `
| Checklist section | Automated by | Run with |
|---|---|---|
| Content (placeholders, headings, footer, contact, duplicates, legal links) | \`content.spec.ts\` | \`npm run test:content\` |
| Layout (keyboard nav, layout shift) | \`layout.spec.ts\` | \`npm run test:layout\` |
| Layout (visual drift vs baseline) | \`visual.spec.ts\` | \`npm run test:visual\` |
| Links and CTAs (broken, generic text, external safety, duplicates, distinction) | \`links.spec.ts\`, \`smoke.spec.ts\` | \`npm run test:links\` |
| Images and Media (resolution, weight, alt, video controls) | \`media.spec.ts\` | \`npm run test:media\` |
| Performance (Core Web Vitals, cross-browser) | Lighthouse CI, Playwright projects | \`npm run lh\` |
| Mobile (overflow, tap targets, font size, viewport, orientation) | \`responsive.spec.ts\` | \`npm run test:responsive\` |
| Accessibility (WCAG A/AA) | \`a11y.spec.ts\` | \`npm run test:a11y\` |
`.trim();

function render(site: SiteConfig): string {
  const base = resolveBaseURL(site);
  const pages = readDiscovered(site.name);
  const pageList = (site.pages ?? []).map((p) => p.path);
  const all = [...new Set([...pageList, ...pages.map((p) => p.path)])].sort();

  const d = site.design ?? {};
  const designRows = [
    d.figmaDesktop ? `- Figma (desktop): ${d.figmaDesktop}` : '- Figma (desktop): _not configured_',
    d.figmaMobile ? `- Figma (mobile): ${d.figmaMobile}` : '- Figma (mobile): _not configured_',
    d.uiDev ? `- UI Dev link: ${d.uiDev}` : `- UI Dev link: ${base}`,
  ].join('\n');

  const sections = MANUAL.map(
    (s) => `### ${s.title}\n\n${s.items.map((i) => `- [ ] ${i}`).join('\n')}`,
  ).join('\n\n');

  const manualCount = MANUAL.reduce((n, s) => n + s.items.length, 0);

  return `# Manual QA checklist — ${site.name}

**Site:** ${base}
**Generated:** ${new Date().toISOString().slice(0, 10)}
**Reviewer:** _________________  **Date:** _________________

${designRows}

---

## Before you start

Run the automated suite first. Don't hand-check anything below until it's green:

\`\`\`bash
SITE=${site.name} npm run discover
SITE=${site.name} npm test
\`\`\`

${AUTOMATED_SUMMARY}

**${manualCount} items below need a human.** They're the ones no tool can answer.

---

## Pages in scope (${all.length})

${all.length ? all.map((p) => `- \`${p}\``).join('\n') : '_Run `npm run discover` to populate._'}

---

## Manual checks

${sections}

---

## Sign-off

- [ ] All automated tiers green (attach the Playwright report)
- [ ] All manual items above checked or explicitly waived
- [ ] Defects raised in Zoho with Jam recordings attached

**Waivers / notes:**

| Item | Why waived | Approved by |
|---|---|---|
|  |  |  |
`;
}

const OUT = path.join(__dirname, '..', 'checklists');
fs.mkdirSync(OUT, { recursive: true });

for (const site of sites) {
  const file = path.join(OUT, `${site.name}-manual.md`);
  fs.writeFileSync(file, render(site));
  console.log(`  ✓ ${path.relative(process.cwd(), file)}`);
}
