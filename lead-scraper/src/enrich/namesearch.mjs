// Founder names for companies whose own pages name nobody: one Google search per
// company, through Apify's Google Search scraper (about $0.0045 per query page).
// Only Google's result titles are read ("Jane Doe - Founder - Acme | LinkedIn");
// LinkedIn itself is never visited.
import { runActor } from '../apify.mjs';
import { cacheGet, cachePut } from '../http.mjs';
import { count } from '../ledger.mjs';

const BUILDER_NAME = /^(lovable|gpt engineer|bolt|base44|replit|v0|vite|react app|create next app)$/i;
const DECIDER = /\b(founder|co-?founder|ceo|chief executive|owner|managing director|director|president|cto)\b/i;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The company's name as it presents itself (not the builder's default). */
export function companyName(lead) {
  const candidates = [lead.site?.meta_author, lead.trustmrr?.name, lead.name, (lead.mail_domain || lead.domain || '').split('.')[0]];
  for (const c of candidates) {
    const n = String(c || '').replace(/[®™©]/g, '').replace(/\s+(LLC|Ltd|Inc|GmbH|SAS|Pty)\.?$/i, '').trim();
    if (n && n.length >= 3 && !BUILDER_NAME.test(n)) return n;
  }
  return '';
}

/** Parse one LinkedIn result: a named decision-maker at this company, or null. */
export function personFromResult(r, company) {
  if (!/linkedin\.com\/in\//i.test(r.url || '')) return null;
  const title = String(r.title || '');
  const text = `${title} ${r.description || ''}`;
  const c = norm(company);
  if (!c || !norm(text).includes(c.slice(0, Math.max(5, Math.min(c.length, 10))))) return null;
  if (!DECIDER.test(text)) return null;
  const name = title.split(/\s+[-–—|]\s+/)[0].replace(/,.*$/, '').trim();
  if (!/^[A-ZÀ-Ý][\p{L}'’.-]+(\s+[A-ZÀ-Ý][\p{L}'’.-]+){1,2}$/u.test(name)) return null;
  const role = (title.split(/\s+[-–—|]\s+/)[1] || (text.match(DECIDER) || [''])[0]).trim();
  return { name, title: role.slice(0, 60), linkedin: r.url.split('?')[0] };
}

/**
 * For each lead with no known person: search Google once and keep the first LinkedIn
 * result that names a founder/CEO/owner of this company. Sets lead.search_people.
 */
export async function searchFounderNames(leads, { log } = {}) {
  const todo = leads.map((l) => ({ lead: l, company: companyName(l) })).filter((t) => t.company);
  if (!todo.length) return;
  const queryFor = (t) => `site:linkedin.com/in "${t.company}" (founder OR co-founder OR CEO OR owner)`;
  const input = { queries: todo.map(queryFor).join('\n'), maxPagesPerQuery: 1, resultsPerPage: 10, countryCode: 'us', mobileResults: false };
  const key = 'namesearch:' + JSON.stringify(input);
  let pages = await cacheGet(key);
  if (!pages) {
    pages = await runActor('apify/google-search-scraper', input, { log });
    await cachePut(key, pages);
  }
  const byQuery = new Map(pages.map((p) => [p.searchQuery?.term, p]));
  for (const t of todo) {
    count('namesearch_queries');
    const page = byQuery.get(queryFor(t));
    const hit = (page?.organicResults || []).map((r) => personFromResult(r, t.company)).find(Boolean);
    t.lead.search_people = hit ? [hit] : [];
    if (hit) count('namesearch_found');
  }
}
