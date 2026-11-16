#!/usr/bin/env node
// Find and enrich redesign leads.
//   node src/cli.mjs --profile type_b --limit 40
//   node src/cli.mjs --profile type_a,type_b --limit 25 --screenshots
//   node src/cli.mjs --seed seeds/report-companies.csv --screenshots
import path from 'node:path';
import { parseArgs } from 'node:util';
import { PROFILES, PROFILE_NAMES } from './profiles.mjs';
import { seedCsv } from './sources/seed.mjs';
import { enrichSite } from './enrich/site.mjs';
import { hiringSignals } from './enrich/jobs.mjs';
import { verifyEmails } from './enrich/emails.mjs';
import { pool } from './http.mjs';
import { homepage, registrableDomain, isCompanySite } from './domain.mjs';
import { accessLevel, aiBuilt, score, flags } from './score.mjs';
import { writeOutputs } from './export.mjs';

const { values: args } = parseArgs({
  options: {
    profile: { type: 'string', default: 'type_a,type_b' },
    seed: { type: 'string' },
    'seed-profile': { type: 'string', default: 'type_b' },
    limit: { type: 'string', default: '30' },
    offset: { type: 'string', default: '0' },
    out: { type: 'string' },
    'no-browser': { type: 'boolean', default: false },
    screenshots: { type: 'boolean', default: false },
    'verify-emails': { type: 'boolean', default: false },
    'skip-jobs': { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
    help: { type: 'boolean', default: false },
  },
});

if (args.help) {
  console.log(`Profiles: ${PROFILE_NAMES.join(', ')} (comma-separated, or "all")
Options:
  --profile <names>      which ICP profiles to discover (default type_a,type_b; "none" = seed only)
  --seed <file.csv>      also enrich companies from a CSV (name,website,icp,notes)
  --seed-profile <name>  profile for seed rows without an icp column (default type_b)
  --limit <n>            max companies per profile after discovery (default 30)
  --offset <n>           skip the first n discovered (to page through big sources)
  --out <dir>            output folder (default out/<date>)
  --no-browser           never start the headless browser (client-rendered sites stay unread)
  --screenshots          screenshot home/pricing/signup/demo for teardowns (implies browser)
  --verify-emails        check published emails with MillionVerifier (needs MILLIONVERIFIER_API_KEY)
  --skip-jobs            do not query job boards`);
  process.exit(0);
}

const limit = Number(args.limit);
const offset = Number(args.offset);
const outDir = path.resolve(args.out || `out/${new Date().toISOString().slice(0, 10)}`);
const wanted = args.profile === 'all' ? PROFILE_NAMES : args.profile === 'none' ? [] : args.profile.split(',').map((s) => s.trim()).filter(Boolean);
for (const p of wanted) if (!PROFILES[p]) throw new Error(`Unknown profile "${p}". Use: ${PROFILE_NAMES.join(', ')}`);

const log = (...m) => console.error(`[${new Date().toISOString().slice(11, 19)}]`, ...m);

// 1. Discover
const candidates = [];
for (const name of wanted) {
  try {
    const rows = await PROFILES[name].discover({ limit, offset });
    log(`${name}: ${rows.length} discovered`);
    // type_a pages through its source itself; the others are sliced here.
    const page = name === 'type_a' ? rows : rows.slice(offset);
    candidates.push(...page.slice(0, limit).map((r) => ({ ...r, profile: name })));
  } catch (e) {
    log(`${name}: discovery failed: ${e.message}`);
  }
}
if (args.seed) {
  const rows = await seedCsv(args.seed);
  log(`seed: ${rows.length} rows`);
  candidates.push(...rows.map((r) => ({ ...r, profile: PROFILES[r.seed_icp] ? r.seed_icp : args['seed-profile'] })));
}

// 2. One lead per company domain (keep every source that found it)
const byDomain = new Map();
for (const c of candidates) {
  if (!isCompanySite(c.website)) continue;
  const domain = registrableDomain(c.website);
  if (!domain) continue;
  const prev = byDomain.get(domain);
  if (prev) {
    prev.sources = [...new Set([...prev.sources, c.source])];
    for (const k of ['yc', 'github', 'trustmrr']) if (c[k] && !prev[k]) prev[k] = c[k];
  } else byDomain.set(domain, { ...c, domain, sources: [c.source] });
}
const leads = [...byDomain.values()];
log(`${leads.length} unique companies to enrich`);

// 3. Enrich
// The browser is loaded lazily: only for client-rendered sites (common for
// Lovable/Bolt apps) and for --screenshots.
let browserMod = null;
const browserApi = async () => (browserMod ||= await import('./enrich/browser.mjs'));

let done = 0;
await pool(leads, Number(args.concurrency), async (lead) => {
  const site = homepage(lead.website);
  lead.site = await enrichSite(site, { company: lead.name });
  if (!args['no-browser'] && lead.site.reachable && lead.site.js_only) {
    lead.site = await enrichSite(site, { get: (await browserApi()).renderGet, company: lead.name });
    lead.rendered = true;
  }
  const stem = lead.domain.split('.')[0];
  const lower = String(lead.name || '').toLowerCase();
  const nameSlugs = [lower.replace(/[^a-z0-9]+/g, ''), lower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')];
  lead.hiring = args['skip-jobs']
    ? { open_jobs: null, design_roles: [], oldest_design_role_days: null }
    : await hiringSignals(lead.site.ats_boards, lead.site.ats_boards.length ? [] : [...new Set([stem, ...nameSlugs])]);
  lead.emails = args['verify-emails'] ? await verifyEmails(lead.site.emails) : lead.site.emails;
  if (args.screenshots && !args['no-browser'] && lead.site.reachable) lead.render = await (await browserApi()).captureLead(lead, outDir);
  lead.access = accessLevel(lead.site, lead.render);
  lead.ai_built = aiBuilt(lead.site, lead);
  lead.offer = PROFILES[lead.profile].offer;
  lead.score = score(lead);
  lead.flags = flags(lead);
  lead.checked_at = new Date().toISOString();
  done++;
  if (done % 5 === 0 || done === leads.length) log(`enriched ${done}/${leads.length}`);
});
if (browserMod) await browserMod.closeBrowser();

// 4. Write
const files = await writeOutputs(leads, outDir);
const byPriority = leads.reduce((m, l) => ((m[l.score.priority] = (m[l.score.priority] || 0) + 1), m), {});
log(`wrote ${files.csv}`);
log(`priority counts: ${JSON.stringify(byPriority)}`);
