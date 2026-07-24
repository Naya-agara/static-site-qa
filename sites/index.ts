import type { SiteConfig, Tier } from './types';

// ---- Register sites here (one line each) ------------------------------------
import qz from './qz.site';

const all: SiteConfig[] = [
  qz,
];
// -----------------------------------------------------------------------------

const names = all.map((s) => s.name);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length) {
  throw new Error(`Duplicate site name(s) in sites/index.ts: ${dupes.join(', ')}`);
}

/**
 * Sites under test, filtered by the SITE env var.
 *   SITE=qz   -> just qz
 *   (unset)   -> everything
 */
export const sites: SiteConfig[] = (() => {
  const filter = process.env.SITE?.trim();
  if (!filter) return all;

  const wanted = filter.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = wanted.filter((w) => !names.includes(w));
  if (unknown.length) {
    throw new Error(
      `Unknown site(s) in SITE=${filter}: ${unknown.join(', ')}. Known sites: ${names.join(', ')}`,
    );
  }
  return all.filter((s) => wanted.includes(s.name));
})();

/** True if a site opted out of a test tier. */
export function skips(site: SiteConfig, tier: Tier): boolean {
  return site.skip?.includes(tier) ?? false;
}

export * from './types';
