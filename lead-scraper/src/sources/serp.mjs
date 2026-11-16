// Source: Google results for vibe-coding footprints, through Apify's official Google
// Search scraper. Finds apps that kept a builder badge or host and mention pricing.
import { count } from '../ledger.mjs';
import { runActor } from '../apify.mjs';
import { cacheGet, cachePut } from '../http.mjs';
import { registrableDomain } from '../domain.mjs';

// Apps still on a builder's host, with signs of a paid, signed-in product. Queries
// about a builder's badge mostly return articles about the builder, so they are not used.
export const DEFAULT_FOOTPRINTS = [
  'site:lovable.app "sign in" "pricing"',
  'site:lovable.app "free trial" "per month"',
  'site:base44.app "sign in" "pricing"',
  'site:bolt.host "sign in" "pricing"',
  'site:replit.app "sign in" "pricing"',
];

// Builder hosts are allowed here (they are the point), unlike other sources.
const BUILDER_HOST = /(^|\.)(lovable\.app|base44\.app|bolt\.host|replit\.app)$/;

export async function serpFootprints({ queries = DEFAULT_FOOTPRINTS, pagesPerQuery = 2, log } = {}) {
  const input = { queries: queries.join('\n'), maxPagesPerQuery: pagesPerQuery, countryCode: 'us', mobileResults: false };
  const cacheKey = 'serp:' + JSON.stringify(input);
  let items = await cacheGet(cacheKey);
  if (items) log?.('google footprints: cached results reused (no charge)');
  else {
    items = await runActor('apify/google-search-scraper', input, { log });
    await cachePut(cacheKey, items);
  }
  const seen = new Map();
  for (const page of items) {
    for (const r of page.organicResults || []) {
      count('serp_results');
      let host;
      try {
        host = new URL(r.url).hostname.toLowerCase();
      } catch {
        continue;
      }
      // Only apps on a builder's own host: other results are articles about the builders.
      const builderHosted = BUILDER_HOST.test(host);
      if (!builderHosted) continue;
      // Content pages ("... pricing guide 2026") are not products.
      if (/\b(guide|cost of|costs|how much|vs\.?|comparison|calculator|blog)\b/i.test(r.title || '')) continue;
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
  count('serp_kept', seen.size);
  return [...seen.values()];
}
