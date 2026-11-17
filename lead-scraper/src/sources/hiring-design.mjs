// Sources for Type B: software companies that are hiring a product designer (the report's
// strongest buying signal: they want design help and have not hired yet).
//  1. Public job boards (Ashby, Greenhouse, Lever) found with Google, via Apify.
//  2. Hacker News "Who is hiring?" threads (free Algolia API): posts that mention a
//     design role.
import { getJson, getText, cacheGet, cachePut } from '../http.mjs';
import { runActor } from '../apify.mjs';
import { registrableDomain, isCompanySite } from '../domain.mjs';
import { count } from '../ledger.mjs';
import { isSaas } from './saas.mjs';

const DESIGN_ROLE = /\b(product designer|ux designer|ui\/ux|ux\/ui|design engineer|ui designer|founding designer|head of design|design lead|interaction designer)\b/i;

export const ATS_QUERIES = [
  'site:jobs.ashbyhq.com "product designer" SaaS',
  'site:jobs.ashbyhq.com "product designer" "series a"',
  'site:jobs.ashbyhq.com "founding designer"',
  'site:job-boards.greenhouse.io "product designer" "series a"',
  'site:job-boards.greenhouse.io "product designer" platform startup',
  'site:jobs.lever.co "product designer" "series a"',
  'site:jobs.lever.co "product designer" SaaS startup',
];

/** Board slug -> { name, website } from the board's own public page or API. */
async function boardCompany(ats, slug) {
  if (ats === 'ashby') {
    const r = await getText(`https://jobs.ashbyhq.com/${slug}`);
    if (!r.ok) return null;
    const site = r.text.match(/"publicWebsite":"([^"]+)"/)?.[1];
    const name = r.text.match(/"organization":\{[^}]*?"name":"([^"]+)"/)?.[1] || r.text.match(/<title>([^<|]+)/)?.[1]?.replace(/jobs?/i, '').trim();
    return site ? { name, website: site } : null;
  }
  // Greenhouse and Lever: the company's own site is linked from the job descriptions.
  const json = ats === 'greenhouse' ? await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`) : await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json&limit=20`);
  const name = ats === 'greenhouse' ? (await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}`))?.name : slug;
  const text = JSON.stringify(json || '').replace(/\\u003c/g, '<').replace(/&lt;/g, '<').replace(/&quot;/g, '"');
  const key = String(name || slug).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  for (const m of text.matchAll(/https?:\/\/(?:www\.)?([a-z0-9-]+\.[a-z.]{2,10})/gi)) {
    const d = registrableDomain(m[0]);
    if (d && isCompanySite(m[0]) && !/(greenhouse|lever|ashby|linkedin|glassdoor|google|youtube|twitter|x\.com|facebook|instagram|github|medium|notion|eeoc|dol\.gov|e-verify|uscis)/.test(d) && d.replace(/[^a-z0-9]/g, '').startsWith(key)) {
      return { name, website: `https://${d}/` };
    }
  }
  return null;
}

/** Companies with an open design role on Ashby / Greenhouse / Lever (Google via Apify). */
export async function atsDesignRoles({ queries = ATS_QUERIES, pagesPerQuery = 2, log } = {}) {
  const input = { queries: queries.join('\n'), maxPagesPerQuery: pagesPerQuery, resultsPerPage: 10, countryCode: 'us', mobileResults: false };
  const key = 'ats-serp:' + JSON.stringify(input);
  let pages = await cacheGet(key);
  if (!pages) {
    pages = await runActor('apify/google-search-scraper', input, { log });
    await cachePut(key, pages);
  }
  const boards = new Map();
  for (const p of pages) for (const r of p.organicResults || []) {
    const m = r.url.match(/jobs\.ashbyhq\.com\/([^/?#]+)|job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)|boards\.greenhouse\.io\/([^/?#]+)|jobs\.lever\.co\/([^/?#]+)/i);
    if (!m) continue;
    const ats = m[1] ? 'ashby' : m[4] ? 'lever' : 'greenhouse';
    const slug = (m[1] || m[2] || m[3] || m[4]).toLowerCase();
    if (!DESIGN_ROLE.test(`${r.title} ${r.description || ''}`)) continue;
    count('ats_design_posts');
    if (!boards.has(slug)) boards.set(slug, { ats, slug, role: (r.title || '').split(/\s[-|@–]\s/)[0].slice(0, 60), text: `${r.title} ${r.description || ''}` });
  }
  log?.(`hiring: ${boards.size} companies with a design role on job boards`);
  const rows = [];
  for (const b of boards.values()) {
    const c = await boardCompany(b.ats, b.slug).catch(() => null);
    if (!c?.website) {
      count('ats_no_website');
      continue;
    }
    rows.push({ name: c.name || b.slug, website: c.website, source: 'ats-design-role', source_url: `${b.ats}:${b.slug}`, description: b.text.slice(0, 240), design_role: { title: b.role, board: b.ats } });
  }
  count('ats_kept', rows.length);
  return rows;
}

/** Hacker News "Who is hiring?" posts (last few months) that mention a design role. */
export async function hnDesignHiring({ months = 3 } = {}) {
  const threads = (await getJson('https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=20'))?.hits?.filter((h) => /who is hiring/i.test(h.title)).slice(0, months) || [];
  const rows = new Map();
  for (const t of threads) {
    for (let page = 0; page < 10; page++) {
      const r = await getJson(`https://hn.algolia.com/api/v1/search?tags=comment,story_${t.objectID}&hitsPerPage=200&page=${page}`);
      const hits = r?.hits || [];
      for (const h of hits) {
        if (h.parent_id !== Number(t.objectID)) continue; // top-level posts only
        const text = String(h.comment_text || '').replace(/<[^>]+>/g, ' ').replace(/&#x2F;/g, '/').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
        count('hn_hiring_posts');
        if (!DESIGN_ROLE.test(text) || !isSaas(text)) continue;
        if (/\((YC|Y Combinator) [WSFX]\d{2}\)|\bYC [WSFX]\d{2}\b/i.test(text)) continue; // non-YC on purpose
        const first = text.split(/\n|\s{2,}/)[0];
        let name = first.split('|')[0].replace(/\(.*?\)/g, '').trim().slice(0, 60);
        if (/^(role|backed by|hiring|we are|we're|remote|location)\b/i.test(name) || name.split(/\s+/).length > 5) name = '';
        const url = (text.match(/https?:\/\/[^\s)"<]+/g) || []).find((u) => isCompanySite(u) && !/(ycombinator|greenhouse|grnh\.se|lever|ashby|workable|linkedin|lnkd\.in|notion|docs\.google|forms|bit\.ly|calendly)/i.test(u));
        if (!url) continue;
        const d = registrableDomain(url);
        name ||= d.split('.')[0];
        if (!rows.has(d)) rows.set(d, { name, website: `https://${d}/`, source: 'hn-hiring', source_url: `https://news.ycombinator.com/item?id=${h.objectID}`, description: text.slice(0, 240), design_role: { title: text.match(DESIGN_ROLE)[0], board: 'HN Who is hiring' } });
      }
      if (hits.length < 200) break;
    }
  }
  count('hn_hiring_kept', rows.size);
  return [...rows.values()];
}
