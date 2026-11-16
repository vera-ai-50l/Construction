// Source: TrustMRR, a public directory of startups with Stripe/Polar-verified revenue.
// Each startup page carries schema.org data: website, founder names, category,
// tech keywords, and the last-30-days revenue in its title. Best source for Type A
// ("AI-built apps with paying users"): revenue is verified, the stack often listed.
import * as cheerio from 'cheerio';
import { getText, pool } from '../http.mjs';

const SITEMAP = 'https://trustmrr.com/startup-sitemap.xml';

export function parseTrustmrrPage(html, pageUrl) {
  const $ = cheerio.load(html);
  const title = $('title').first().text();
  const rev = title.match(/revenue:\s*\$([\d,.]+)\s*([kKmM])?\s+in the last 30 days/i);
  let revenue30d = null;
  if (rev) {
    const mult = { k: 1e3, m: 1e6 }[(rev[2] || '').toLowerCase()] || 1;
    revenue30d = Math.round(parseFloat(rev[1].replace(/,/g, '')) * mult);
  }
  let org = null;
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const d = JSON.parse($(s).text());
      for (const g of d['@graph'] || [d]) if (g['@type'] === 'Organization' && g.url && !/trustmrr\.com/.test(g.url)) org = g;
    } catch {
      /* ignore malformed blocks */
    }
  });
  if (!org) return null;
  const founders = [].concat(org.founder || []).map((f) => ({ name: f.name, profile: f.url || null }));
  return {
    name: org.name,
    website: org.url,
    source: 'trustmrr',
    source_url: pageUrl,
    description: (org.description || '').slice(0, 300),
    trustmrr: {
      revenue_30d_usd: revenue30d,
      category: org.category || '',
      keywords: org.keywords || [],
      founded: org.foundingDate || null,
      country: org.foundingLocation?.identifier || null,
      founders,
    },
  };
}

/**
 * @param opts { limit, offset, minRevenue30d, b2bOnly }
 * `limit` pages are read, spread evenly across the sitemap; change `offset` for a new sample.
 */
export async function trustmrrStartups({ limit = 300, offset = 0, minRevenue30d = 1000, b2bOnly = true } = {}) {
  const sm = await getText(SITEMAP);
  if (!sm.ok) throw new Error(`TrustMRR sitemap unavailable (${sm.status || sm.error})`);
  // The sitemap is alphabetical, so spread the sample across all of it instead of
  // reading the first N names. `offset` shifts the sample to get a different set.
  const all = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const step = Math.max(1, Math.floor(all.length / limit));
  const urls = Array.from({ length: Math.min(limit, all.length) }, (_, i) => all[(i * step + offset) % all.length]);
  const rows = await pool(urls, 2, async (u) => {
    const r = await getText(u);
    return r.ok ? parseTrustmrrPage(r.text, u) : null;
  });
  return rows
    .filter(Boolean)
    .filter((r) => (r.trustmrr.revenue_30d_usd || 0) >= minRevenue30d)
    .filter((r) => !b2bOnly || !r.trustmrr.keywords.some((k) => /^B2C$/i.test(k)));
}
