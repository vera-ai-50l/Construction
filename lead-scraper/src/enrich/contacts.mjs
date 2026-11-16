// Find a named decision-maker and a verified email for a batch of leads, cheaply.
//
// 1. People: one finder run for all domains (see providers.mjs), plus names we already
//    have (TrustMRR founders, people named on the company's own pages, a personal
//    mailbox published on the site).
// 2. Candidates per lead, best first: the finder's own email, then first@, first.last@,
//    firstlast@, flast@ for the best-ranked person. At most --max-candidates per lead.
// 3. Verification in rounds: round 1 checks every lead's first candidate in one batch,
//    round 2 only the leads still unresolved, and so on. A lead stops at its first "ok".
//    A "catch_all" stops it too (that server accepts any address, so more checks would
//    only spend credits): the best candidate is kept and flagged.
// Shared inboxes (hello@, info@, support@...) are never candidates.
import { isRoleMailbox } from './site.mjs';
import { isSharedHost } from '../domain.mjs';
import { findPeople, VERIFIERS } from '../providers.mjs';
import { count } from '../ledger.mjs';

const ascii = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const TITLE_RANK = (t = '') => (/ceo|chief executive|founder|owner/i.test(t) ? 0 : /cpo|product|design/i.test(t) ? 1 : /cto|coo|chief/i.test(t) ? 2 : 3);

/** Common startup patterns for a person at a domain, most likely first. */
export function emailPatterns(firstName, lastName, domain) {
  const f = ascii(firstName);
  const l = ascii(lastName);
  if (!f) return [];
  const out = [`${f}@${domain}`];
  if (l) out.push(`${f}.${l}@${domain}`, `${f}${l}@${domain}`, `${f[0]}${l}@${domain}`, `${f[0]}.${l}@${domain}`);
  return [...new Set(out)];
}

/** Everyone we know at a lead, best decision-maker first. */
export function knownPeople(lead, finderPeople = []) {
  const people = [
    ...finderPeople,
    ...(lead.trustmrr?.founders || [])
      .filter((f) => /^[A-Z][\p{L}'’-]+(\s+[\p{L}'’-]+)+$/u.test(f.name || ''))
      .map((f) => ({ first_name: f.name.split(/\s+/)[0], last_name: f.name.split(/\s+/).slice(1).join(' '), title: 'Founder', email: '', source: 'trustmrr' })),
    ...(lead.site?.people || []).map((p) => ({ first_name: p.name.split(/\s+/)[0], last_name: p.name.split(/\s+/).slice(1).join(' '), title: p.title, email: '', source: 'company site' })),
  ];
  // A personal mailbox the company published, matched to a known person when possible.
  for (const e of lead.site?.emails || []) {
    if (isRoleMailbox(e.email)) continue;
    const local = e.email.split('@')[0];
    const who = people.find((p) => ascii(p.first_name) && local.startsWith(ascii(p.first_name)));
    people.unshift({ ...(who || { first_name: /^[a-z]{3,12}$/.test(local) ? local[0].toUpperCase() + local.slice(1) : '', last_name: '', title: '' }), email: e.email, source: 'company site' });
  }
  return people.filter((p) => p.first_name).sort((a, b) => TITLE_RANK(a.title) - TITLE_RANK(b.title));
}

/** Ordered email candidates for a lead: {email, person, origin}. */
export function candidatesFor(lead, people, max = 3) {
  const out = [];
  const add = (email, person, origin) => {
    if (email && !isRoleMailbox(email) && !out.some((c) => c.email === email)) out.push({ email, person, origin });
  };
  for (const p of people) if (p.email) add(p.email, p, p.source);
  // No company mailboxes exist on a shared app host (x.lovable.app), so no patterns there.
  if (!isSharedHost(lead.domain) && people[0]) {
    for (const e of emailPatterns(people[0].first_name, people[0].last_name, lead.domain)) add(e, people[0], `pattern (${people[0].source} name)`);
  }
  return out.slice(0, max);
}

/**
 * Contacts for many leads.
 * @param leads  leads to process (each gets .contact and .contact_trail)
 * @param opts   { finder: 'pipelinelabs'|'microworlds'|'code_crafter'|'none', verifier: 'bounceverify'|'mv', perDomain, maxCandidates, log }
 */
export async function findContacts(leads, { finder = 'pipelinelabs', verifier = 'bounceverify', perDomain = 3, maxCandidates = 3, log = () => {} } = {}) {
  // 1. People
  let found = new Map();
  if (finder !== 'none') {
    const domains = leads.map((l) => l.domain).filter((d) => !isSharedHost(d));
    try {
      found = await findPeople(finder, domains, { perDomain, log });
    } catch (e) {
      log(`finder ${finder} failed: ${e.message.slice(0, 160)}`);
    }
  }
  const state = leads.map((lead) => {
    const fromFinder = found.get(lead.domain) || [];
    const people = knownPeople(lead, fromFinder);
    lead.contact_people = people.length;
    lead.finder_people = fromFinder.length;
    if (fromFinder.length) count('leads_with_finder_people');
    if (people.length) count('leads_with_named_person');
    const cands = candidatesFor(lead, people, maxCandidates);
    if (cands.length) count('leads_with_email_candidate');
    lead.contact = null;
    lead.contact_trail = [];
    return { lead, cands, next: 0, done: !cands.length };
  });

  // 2. Verification rounds
  const v = VERIFIERS[verifier];
  if (!v) throw new Error(`Unknown verifier "${verifier}" (use ${Object.keys(VERIFIERS).join(', ')})`);
  for (let round = 0; round < maxCandidates; round++) {
    const batch = state.filter((s) => !s.done && s.next < s.cands.length);
    if (!batch.length) break;
    const emails = [...new Set(batch.map((s) => s.cands[s.next].email))];
    let results;
    try {
      results = await v.verify(emails, { log });
    } catch (e) {
      log(`verifier ${verifier} failed: ${e.message.slice(0, 160)}`);
      break;
    }
    count('emails_verified', emails.length);
    for (const s of batch) {
      const c = s.cands[s.next++];
      const r = results.get(c.email) || 'error';
      s.lead.contact_trail.push(`${c.email}:${r}`);
      if (r === 'ok' || r === 'catch_all') {
        s.lead.contact = { ...c.person, email: c.email, verification: r, email_source: c.origin };
        s.done = true;
        count(r === 'ok' ? 'contacts_verified_ok' : 'contacts_catch_all');
      } else if (s.next >= s.cands.length) s.done = true;
    }
  }
  return leads;
}
