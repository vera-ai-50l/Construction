// Find a named decision-maker and a verified email for each lead.
//
// Order of attempts (stops at the first verified address):
//   1. Apify "Leads Finder" (code_crafter/leads-finder): founders / owners / C-level
//      at the company's domain, with name, title, LinkedIn and email.
//   2. Names we already have (TrustMRR founders, people on the company's own pages):
//      try first@, first.last@, firstlast@, flast@ at the domain.
// Every address is checked with MillionVerifier (MILLIONVERIFIER_API_KEY) before it is
// accepted. "ok" is accepted; "catch_all" is kept but flagged (the server accepts any
// address, so it cannot be confirmed); everything else is dropped. Shared inboxes
// (hello@, info@, support@...) are never returned as a contact.
import { runActor } from '../apify.mjs';
import { getJson } from '../http.mjs';
import { isRoleMailbox } from './site.mjs';
import { isSharedHost } from '../domain.mjs';

const LEADS_FINDER = 'code_crafter/leads-finder';
const ascii = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const RANK = { founder: 0, owner: 1, c_suite: 2 };
const TITLE_RANK = (t = '') => (/ceo|chief executive|founder/i.test(t) ? 0 : /cpo|product|design/i.test(t) ? 1 : /cto|coo|chief/i.test(t) ? 2 : 3);

/** MillionVerifier single check. Returns 'ok' | 'catch_all' | 'unknown' | 'invalid' | 'disposable' | 'error' | 'no_key'. */
export async function verifyEmail(email) {
  const key = process.env.MILLIONVERIFIER_API_KEY;
  if (!key) return 'no_key';
  const r = await getJson(`https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&timeout=20`);
  return r?.result || 'error';
}

/** Common startup patterns for a person at a domain, most likely first. */
export function emailPatterns(firstName, lastName, domain) {
  const f = ascii(firstName);
  const l = ascii(lastName);
  if (!f) return [];
  const out = [`${f}@${domain}`];
  if (l) out.push(`${f}.${l}@${domain}`, `${f}${l}@${domain}`, `${f[0]}${l}@${domain}`, `${f[0]}.${l}@${domain}`);
  return [...new Set(out)];
}

/** Batch: ask Apify's Leads Finder for decision-makers at many domains at once. */
export async function apifyDecisionMakers(domains, { perDomain = 3, log } = {}) {
  if (!domains.length) return new Map();
  const items = await runActor(
    LEADS_FINDER,
    {
      company_domain: domains,
      seniority_level: ['founder', 'owner', 'c_suite'],
      fetch_count: Math.min(5000, domains.length * perDomain),
    },
    { log },
  );
  const byDomain = new Map();
  for (const it of items) {
    const d = String(it.company_domain || it.company_website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (!d) continue;
    const list = byDomain.get(d) || [];
    list.push({
      first_name: it.first_name || '',
      last_name: it.last_name || '',
      title: it.job_title || it.headline || '',
      email: (it.email || '').toLowerCase(),
      linkedin: it.linkedin || it.linkedin_url || '',
      seniority: it.seniority_level || '',
      source: 'apify-leads-finder',
    });
    byDomain.set(d, list);
  }
  for (const list of byDomain.values()) list.sort((a, b) => (RANK[a.seniority] ?? 9) - (RANK[b.seniority] ?? 9) || TITLE_RANK(a.title) - TITLE_RANK(b.title));
  return byDomain;
}

/**
 * Pick and verify one contact for a lead.
 * @param lead       scrape lead (site.people, trustmrr.founders, domain)
 * @param apifyList  people Apify returned for this domain (may be empty)
 * @returns contact or null, plus a trail of what was tried
 */
export async function findContact(lead, apifyList = []) {
  const domain = lead.domain;
  const tried = [];
  const people = [
    ...apifyList,
    ...(lead.trustmrr?.founders || [])
      .filter((f) => /^[A-Z][\p{L}'’-]+(\s+[\p{L}'’-]+)+$/u.test(f.name || ''))
      .map((f) => ({ first_name: f.name.split(/\s+/)[0], last_name: f.name.split(/\s+/).slice(1).join(' '), title: 'Founder', email: '', source: 'trustmrr' })),
    ...(lead.site?.people || []).map((p) => ({ first_name: p.name.split(/\s+/)[0], last_name: p.name.split(/\s+/).slice(1).join(' '), title: p.title, email: '', source: 'company site' })),
  ];
  // A personal mailbox published on the site, matched to a person when possible.
  for (const e of lead.site?.emails || []) {
    if (isRoleMailbox(e.email)) continue;
    const local = e.email.split('@')[0];
    const who = people.find((p) => ascii(p.first_name) && local.startsWith(ascii(p.first_name)));
    people.unshift({ ...(who || { first_name: /^[a-z]{3,12}$/.test(local) ? local[0].toUpperCase() + local.slice(1) : '', last_name: '', title: '' }), email: e.email, source: 'company site' });
  }

  let catchAll = null;
  for (const p of people) {
    if (!p.first_name) continue;
    // No company mailboxes exist on a shared app host (x.lovable.app), so no patterns there.
    const patterns = isSharedHost(domain) ? [] : emailPatterns(p.first_name, p.last_name, domain);
    const candidates = p.email && !isRoleMailbox(p.email) ? [p.email, ...patterns] : patterns;
    for (const email of [...new Set(candidates)].slice(0, 5)) {
      const result = await verifyEmail(email);
      tried.push(`${email}:${result}`);
      if (result === 'no_key') return { contact: null, tried, error: 'MILLIONVERIFIER_API_KEY not set' };
      const contact = { ...p, email, verification: result, email_source: email === p.email ? p.source : `pattern (${p.source} name)` };
      if (result === 'ok') return { contact, tried };
      // On a catch-all domain every pattern "passes"; keep the first, from the best source.
      if (result === 'catch_all') {
        catchAll ||= contact;
        break;
      }
    }
  }
  return { contact: catchAll, tried };
}
