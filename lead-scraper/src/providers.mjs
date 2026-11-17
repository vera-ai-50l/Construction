// Interchangeable tools for the two paid steps, cheapest first:
//   finders   find decision-makers (name, title, email) at a list of company domains
//   verifiers check whether an address will receive mail
// Each finder/verifier normalises its tool's output, so runs can compare them.
import { runActor } from './apify.mjs';
import { getJson } from './http.mjs';
import { addCost } from './ledger.mjs';

const DECISION_TITLES = ['founder', 'co-founder', 'cofounder', 'ceo', 'owner', 'chief executive officer', 'cto', 'coo', 'head of product', 'head of design', 'cpo'];

// Find a value in an item whatever the tool calls it ("firstName", "first_name", ...).
const pick = (o, ...names) => {
  for (const n of names) {
    const v = n.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
    if (v != null && v !== '') return v;
  }
  return '';
};
const domainOf = (v) => String(v || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');

function normalisePerson(it, finder) {
  let first = pick(it, 'first_name', 'firstName', 'person.first_name');
  let last = pick(it, 'last_name', 'lastName', 'person.last_name');
  const full = pick(it, 'full_name', 'fullName', 'name', 'person.name');
  if (!first && full) {
    const parts = String(full).trim().split(/\s+/);
    first = parts[0];
    last = parts.slice(1).join(' ');
  }
  return {
    first_name: String(first || ''),
    last_name: String(last || ''),
    title: String(pick(it, 'job_title', 'title', 'jobTitle', 'headline', 'person.title')),
    email: String(pick(it, 'email', 'work_email', 'workEmail', 'business_email', 'person.email')).toLowerCase(),
    email_status: String(pick(it, 'email_status', 'emailStatus')),
    linkedin: String(pick(it, 'linkedin', 'linkedin_url', 'linkedinUrl', 'person.linkedin_url')),
    domain: domainOf(pick(it, 'company_domain', 'companyDomain', 'organization.primary_domain', 'company_website', 'companyWebsite', 'organization_website', 'company.website', 'website')),
    source: `finder:${finder}`,
  };
}

export const FINDERS = {
  // $0.001 per lead returned, limited account access.
  pipelinelabs: {
    actor: 'pipelinelabs/lead-scraper-apollo-zoominfo-lusha-ppe',
    input: (domains, perDomain) => ({
      companyDomainIncludes: domains,
      companyDomainMatchMode: 'strict',
      personTitleIncludes: DECISION_TITLES,
      includeTitleVariants: true,
      seniorityIncludes: ['c_suite', 'owner'],
      roleMatchMode: 'any',
      personLocationCountryIncludes: [], // the default is US-only
      hasEmail: true,
      totalResults: domains.length * perDomain,
    }),
  },
  // $0.003 per lead on the free plan ($0.0017 on paid), limited access.
  microworlds: {
    actor: 'microworlds/leads-finder',
    input: (domains, perDomain) => ({
      company_domains: domains,
      contact_job_titles: DECISION_TITLES,
      email_status: ['verified'],
      max_result: domains.length * perDomain,
    }),
  },
  // $0.002 per lead + $0.02 per run; needs FULL account access approved in Apify.
  code_crafter: {
    actor: 'code_crafter/leads-finder',
    input: (domains, perDomain) => ({ company_domain: domains, seniority_level: ['founder', 'owner', 'c_suite'], fetch_count: domains.length * perDomain }),
  },
};

/** Decision-makers per domain from one finder run. */
export async function findPeople(finderName, domains, { perDomain = 3, log } = {}) {
  const f = FINDERS[finderName];
  if (!f) throw new Error(`Unknown finder "${finderName}" (use ${Object.keys(FINDERS).join(', ')})`);
  const byDomain = new Map();
  if (!domains.length) return byDomain;
  const wanted = new Set(domains);
  const items = await runActor(f.actor, f.input(domains, perDomain), { log });
  for (const it of items) {
    const p = normalisePerson(it, finderName);
    // Keep only people at the domains we asked about (some tools pad with lookalikes).
    const d = [...wanted].find((w) => p.domain === w || p.domain.endsWith('.' + w) || (p.email && p.email.endsWith('@' + w)));
    if (!d || !p.first_name) continue;
    // Placeholder records some databases carry ("Test Lassiter" at "chefside test").
    if (/^(test|demo|sample|john doe|jane doe)$/i.test(p.first_name) || /\btest\b/i.test(String(pick(it, 'companyName', 'company_name', 'organization.name')))) continue;
    const list = byDomain.get(d) || [];
    if (!list.some((x) => x.email && x.email === p.email)) list.push(p);
    byDomain.set(d, list);
  }
  return byDomain;
}

// Verification results are normalised to: ok | catch_all | invalid | unknown | error.
const norm = (v) => {
  const s = String(v || '').toLowerCase();
  if (/catch.?all|accept.?all/.test(s)) return 'catch_all';
  if (/^(ok|valid|deliverable|safe)$|^valid/.test(s)) return 'ok';
  if (/invalid|undeliverable|bounce|disposable|syntax|not.?exist/.test(s)) return 'invalid';
  if (/unknown|risky|unverifiable/.test(s)) return 'unknown';
  return s ? 'unknown' : 'error';
};

export const VERIFIERS = {
  // Apify actor, $0.00089 per email on the free plan; runs in batches.
  bounceverify: {
    async verify(emails, { log } = {}) {
      const items = await runActor('bounceverify/bounceverify-email-verifier', { emails, concurrency: 10, skipInvalidSyntax: true }, { log });
      const out = new Map();
      for (const it of items) {
        const email = String(pick(it, 'email', 'address')).toLowerCase();
        if (!email) continue;
        const catchAll = pick(it, 'catch_all', 'catchAll', 'is_catch_all', 'isCatchAll');
        const verdict = catchAll === true || catchAll === 'true' ? 'catch_all' : norm(pick(it, 'result', 'status', 'verdict', 'state', 'quality'));
        out.set(email, verdict);
      }
      return out;
    },
  },
  // MillionVerifier REST API; needs MILLIONVERIFIER_API_KEY (sent as a URL parameter).
  // Cost per check depends on your credit pack: set MV_PRICE_USD to track it.
  mv: {
    async verify(emails) {
      const key = process.env.MILLIONVERIFIER_API_KEY;
      if (!key) throw new Error('MILLIONVERIFIER_API_KEY not set');
      const out = new Map();
      for (const email of emails) {
        const r = await getJson(`https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&timeout=20`);
        out.set(email, norm(r?.result));
        // Price per check depends on the credit pack you bought; set MV_PRICE_USD.
        addCost('millionverifier', { units: 1, usd: Number(process.env.MV_PRICE_USD || 0), unit: 'email' });
      }
      return out;
    },
  },
};
