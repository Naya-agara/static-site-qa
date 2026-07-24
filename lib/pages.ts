import fs from 'fs';
import path from 'path';
import type { PageSpec, SiteConfig } from '../sites/types';

const CACHE_DIR = path.join(__dirname, '..', '.discovered');

export function discoveredPath(siteName: string): string {
  return path.join(CACHE_DIR, `${siteName}.json`);
}

export function readDiscovered(siteName: string): PageSpec[] {
  try {
    return JSON.parse(fs.readFileSync(discoveredPath(siteName), 'utf8')) as PageSpec[];
  } catch {
    return [];
  }
}

export function writeDiscovered(siteName: string, pages: PageSpec[]): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(discoveredPath(siteName), JSON.stringify(pages, null, 2) + '\n');
}

/**
 * The page list for a site: explicit config merged over discovered pages.
 *
 * Explicit entries win, so you can list `/` with a title/h1 assertion and still
 * let the crawler find the other 40 pages.
 */
export function pagesFor(site: SiteConfig): PageSpec[] {
  const explicit = site.pages ?? [];
  const discovered = readDiscovered(site.name);

  const byPath = new Map<string, PageSpec>();
  for (const p of discovered) byPath.set(normalise(p.path), p);
  for (const p of explicit) byPath.set(normalise(p.path), { ...byPath.get(normalise(p.path)), ...p });

  const pages = [...byPath.values()];

  if (pages.length === 0) {
    throw new Error(
      `No pages for site "${site.name}". Either add a \`pages\` array to sites/${site.name}.site.ts, ` +
        `or run: SITE=${site.name} npm run discover`,
    );
  }

  // Homepage first, then alphabetical — keeps reports readable.
  return pages.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)));
}

function normalise(p: string): string {
  if (!p.startsWith('/')) p = '/' + p;
  return p.length > 1 ? p.replace(/\/$/, '') : '/';
}

export { normalise };
