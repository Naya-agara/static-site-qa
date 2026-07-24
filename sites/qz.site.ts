import type { SiteConfig } from './types';

const site: SiteConfig = {
  name: 'qz',
  baseURL: 'https://quantum-zenith-group-check.webflow.io',

  links: {
    // Group sub-brands live on sibling subdomains — same-tab is correct here.
    // The rel="noopener" check stays on.
    externalOpensNewTab: false,
  },

  media: {
    maxImageKB: 400,
  },

  visual: {
    // The announcement bar scrolls continuously and the news carousel
    // autoplays — both move between baseline capture and the next run,
    // so they'd fail visual diffs regardless of any real design change.
    mask: ['.quantum-zenith-design-system--c-announcement-container', '.partner-section'],
  },

  // Webflow staging domains are noindex by design (robots.txt = Disallow: /).
  // SEO assertions belong against the production domain.
  skip: ['seo'],
};

export default site;
