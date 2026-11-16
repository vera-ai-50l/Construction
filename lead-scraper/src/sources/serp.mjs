// Source: Google results for vibe-coding footprints, through Apify's official Google
// Search scraper. Finds apps that kept a builder badge or host and mention pricing.
import { runActor } from '../apify.mjs';
import { isCompanySite, registrableDomain } from '../domain.mjs';

export const DEFAULT_FOOTPRINTS = [
  '"Edit with Lovable" pricing',
  '"Edit with Lovable" "sign up"',
  'site:lovable.app pricing "per month"',
  'site:base44.app pricing',
  'site:bolt.host pricing',
  'site:replit.app pricing "per month"',
  '"Made with Bolt" pricing',
];

// Builder hosts are allowed here (they are the point), unlike other sources.
const BUILDER_HOST = /(^|\.)(lovable\.app|base44\.app|bolt\.host|replit\.app)$/;

export async function serpFootprints({ queries = DEFAULT_FOOTPRINTS, pagesPerQuery = 2, log } = {}) {
  const items = await runActor(
    'apify/google-search-scraper',
    { queries: queries.join('\n'), maxPagesPerQuery: pagesPerQuery, countryCode: 'us', mobileResults: false },
    { log },
  );
  const seen = new Map();
  for (const page of items) {
    for (const r of page.organicResults || []) {
      let host;
      try {
        host = new URL(r.url).hostname.toLowerCase();
      } catch {
        continue;
      }
      const builderHosted = BUILDER_HOST.test(host);
      if (!builderHosted && !isCompanySite(r.url)) continue;
      // A builder-hosted app is its own site; anything else is keyed by company domain.
      const key = builderHosted ? host : registrableDomain(r.url);
      if (seen.has(key)) continue;
      seen.set(key, {
        name: (r.title || key).split(/[|\-–—]/)[0].trim().slice(0, 60),
        website: `https://${builderHosted ? host : host.replace(/^www\./, 'www.')}/`,
        source: 'google-footprint',
        source_url: r.url,
        description: (r.description || '').slice(0, 240),
        footprint_query: page.searchQuery?.term || '',
      });
    }
  }
  return [...seen.values()];
}
