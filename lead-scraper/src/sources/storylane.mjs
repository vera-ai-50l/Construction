// Source: Storylane's public customer showcase. Every company listed there has
// published an interactive demo of its real product (accessibility Level B).
import * as cheerio from 'cheerio';
import { getText, pool } from '../http.mjs';
import { isCompanySite } from '../domain.mjs';

const SHOWCASE = 'https://www.storylane.io/customer-showcase';

export async function storylaneShowcase({ limit = Infinity } = {}) {
  const page = await getText(SHOWCASE);
  if (!page.ok) throw new Error(`Storylane showcase unavailable (${page.status || page.error})`);
  const $ = cheerio.load(page.text);

  // Each card links either to a /customer-showcase/<slug> page or straight to a demo.
  const cards = new Map();
  $('a[href]').each((_, a) => {
    const href = new URL($(a).attr('href'), SHOWCASE).href;
    const m = href.match(/storylane\.io\/customer-showcase\/([^/?#]+)/);
    if (m && !cards.has(m[1])) cards.set(m[1], href);
  });

  const slugs = [...cards.entries()].slice(0, limit);
  const rows = await pool(slugs, 3, async ([slug, url]) => {
    const detail = await getText(url);
    if (!detail.ok) return null;
    const d = cheerio.load(detail.text);
    const name = d('h1').first().text().trim() || slug;
    // "View live preview" points at the company's own site or demo page.
    let website = null;
    d('a[href]').each((_, a) => {
      const t = d(a).text().trim().toLowerCase();
      const href = d(a).attr('href') || '';
      if (!website && t.includes('live preview') && isCompanySite(href)) website = href;
    });
    const demo = [];
    d('iframe[src], a[href]').each((_, el) => {
      const v = d(el).attr('src') || d(el).attr('href') || '';
      if (/storylane\.io\/(share|demo)\//.test(v) || /\.storylane\.io\/share\//.test(v)) demo.push(v);
    });
    if (!website) return null;
    return {
      name,
      website,
      source: 'storylane-showcase',
      source_url: url,
      description: '',
      known_demo_urls: [...new Set(demo)],
    };
  });
  return rows.filter(Boolean);
}
