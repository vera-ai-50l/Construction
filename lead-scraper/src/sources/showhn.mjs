// Source: Hacker News "Show HN" posts about apps built with AI builders, through the
// free, public Algolia HN Search API. The poster is usually the maker; their public HN
// profile sometimes gives an email or a site.
import { getJson } from '../http.mjs';
import { count } from '../ledger.mjs';
import { isCompanySite } from '../domain.mjs';

export const DEFAULT_HN_QUERIES = ['lovable', 'bolt.new', 'base44', 'vibe coded', 'vibe coding', 'replit agent', 'built with cursor', 'built with claude code', 'v0'];

// Posts about building tools for builders (not products with customers of their own).
const TOOL_POST = /\b(open[- ]source|self[- ]hosted|alternative to (lovable|bolt|cursor|v0|replit)|for (vibe )?coders|cli|sdk|framework|library|mcp server|vs code|extension)\b/i;

/** @param opts { queries, sinceDays, perQuery } */
export async function showHnApps({ queries = DEFAULT_HN_QUERIES, sinceDays = 540, perQuery = 100 } = {}) {
  const since = Math.floor(Date.now() / 1000) - sinceDays * 86400;
  const seen = new Map();
  for (const q of queries) {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=show_hn&hitsPerPage=${perQuery}&numericFilters=created_at_i>${since}`;
    const data = await getJson(url);
    for (const h of data?.hits || []) {
      count('showhn_posts');
      if (!h.url || !isCompanySite(h.url) || TOOL_POST.test(h.title || '')) continue;
      let host;
      try {
        host = new URL(h.url).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }
      if (seen.has(host)) continue;
      seen.set(host, {
        name: (h.title || host).replace(/^Show HN:\s*/i, '').split(/[–—:-]/)[0].trim().slice(0, 60),
        website: h.url,
        source: 'showhn',
        hn: { author: h.author, points: h.points, comments: h.num_comments, post: `https://news.ycombinator.com/item?id=${h.objectID}`, title: h.title, query: q },
      });
    }
  }
  const rows = [...seen.values()];
  count('showhn_kept', rows.length);
  // The maker's public profile: an email or a name they chose to publish.
  for (const r of rows) {
    const u = await getJson(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(r.hn.author)}.json`);
    const about = String(u?.about || '').replace(/<[^>]+>/g, ' ').replace(/&#x2F;/g, '/').replace(/&#x40;|\s\[?at\]?\s/gi, '@').replace(/&quot;/g, '"');
    r.hn.about = about.slice(0, 300);
    r.hn.emails = [...new Set((about.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map((e) => e.toLowerCase()))];
  }
  return rows;
}
