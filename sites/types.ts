/**
 * Site definitions. Add one file per site in this folder.
 *
 * Design goal: a site with ONLY { name, baseURL } gets the full checklist
 * baseline automatically. Everything below is an override, not a requirement.
 */

export type PageSpec = {
  path: string;
  name?: string;
  title?: string | RegExp;
  h1?: string | RegExp;
  readySelector?: string;
  noVisual?: boolean;
};

export type DiscoverConfig = {
  /** Crawl /sitemap.xml for pages. Default true. */
  fromSitemap?: boolean;
  /** Fallback if no sitemap: crawl links from the homepage. Default true. */
  crawlHomepage?: boolean;
  /** Cap page count so a 2,000-URL sitemap doesn't melt CI. Default 25. */
  maxPages?: number;
  /** Only keep paths matching one of these (regex sources). */
  include?: string[];
  /** Drop paths matching any of these (regex sources). */
  exclude?: string[];
};

export type SiteConfig = {
  /** Short slug. Used in test names, snapshot paths, and the SITE env filter. */
  name: string;

  /** Base URL. Override per-run with BASE_URL_<NAME>. */
  baseURL: string;

  /**
   * Explicit pages. Optional — omit and the discovery step fills this in.
   * Listing a page here lets you assert title/h1. Merged with discovered pages.
   */
  pages?: PageSpec[];

  discover?: DiscoverConfig;

  /** Header/footer links that must exist on every page. */
  globalNav?: {
    /** Selector for the nav container. */
    selector: string;
    /** Link text expected inside it. */
    expected: string[];
  };

  content?: {
    /** Extra placeholder strings to fail on, beyond the built-in list. */
    placeholderPatterns?: string[];
    /** Link text (regex sources) that must exist site-wide, e.g. legal pages. */
    requiredLinks?: string[];
    /** Skip the contact-details check. */
    skipContactCheck?: boolean;
  };

  links?: {
    /** Require target="_blank" on external links. Default true. */
    externalOpensNewTab?: boolean;
    /** Extra generic link phrases to flag. */
    genericTextDenylist?: string[];
  };

  media?: {
    /** Fail images heavier than this. Default 300 (KB). */
    maxImageKB?: number;
  };

  mobile?: {
    /** Minimum tap target px. Default 44 (WCAG 2.5.5). */
    minTapTarget?: number;
    /** Minimum body font px. Default 12. */
    minFontSize?: number;
  };

  visual?: {
    mask?: string[];
    maxDiffPixelRatio?: number;
    disableAnimations?: boolean;
  };

  a11y?: {
    disableRules?: string[];
    tags?: string[];
  };

  seo?: {
    requireCanonical?: boolean;
    requireOpenGraph?: boolean;
    requireRobotsAndSitemap?: boolean;
  };

  /** Design refs. Not automated — printed into the manual checklist for the reviewer. */
  design?: {
    figmaDesktop?: string;
    figmaMobile?: string;
    uiDev?: string;
  };

  skip?: Tier[];
};

export type Tier =
  | 'smoke'
  | 'visual'
  | 'a11y'
  | 'seo'
  | 'content'
  | 'links'
  | 'media'
  | 'responsive'
  | 'layout'
  | 'flows';

/** Resolve baseURL with an env override, e.g. BASE_URL_ACME. */
export function resolveBaseURL(site: SiteConfig): string {
  return (process.env[`BASE_URL_${envSuffix(site.name)}`] || site.baseURL).replace(/\/$/, '');
}

export function envSuffix(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

export function urlFor(site: SiteConfig, page: PageSpec | { path: string }): string {
  return resolveBaseURL(site) + page.path;
}

export function slug(path: string): string {
  if (path === '/') return 'home';
  return path.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '-') || 'home';
}
