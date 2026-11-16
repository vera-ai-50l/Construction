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
import { buildFingerprints, vibeVerdict } from './enrich/vibe.mjs';
import { findContacts } from './enrich/contacts.mjs';
import { getText } from './http.mjs';
import { funnelReport } from './funnel.mjs';
import { writeFile } from 'node:fs/promises';

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
    'find-contacts': { type: 'boolean', default: false },
    'max-contacts': { type: 'string', default: '100' },
    finder: { type: 'string', default: 'auto' },
    verifier: { type: 'string', default: 'bounceverify' },
    'max-candidates': { type: 'string', default: '3' },
    'name-search': { type: 'boolean', default: false },
    'min-revenue': { type: 'string', default: '500' },
    serp: { type: 'boolean', default: false },
    sources: { type: 'string', default: 'trustmrr' },
    'keep-polished': { type: 'boolean', default: false },
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
  --skip-jobs            do not query job boards
  --min-revenue <usd>    vibe profile: minimum TrustMRR revenue in the last 30 days (default 500)
  --sources <list>       vibe profile sources: trustmrr, google, commoncrawl, showhn (default trustmrr)
  --serp                 same as adding google to --sources (Apify, needs APIFY_TOKEN)
  --keep-polished        keep leads whose site looks professionally designed (dropped by default for vibe)
  --find-contacts        find a named decision-maker with a verified email (needs APIFY_TOKEN)
  --finder <name>        who finds people: auto (default: none for the vibe profile, whose apps
                         are not in finder databases; pipelinelabs otherwise), pipelinelabs
                         ($0.001/lead), microworlds, code_crafter (needs full Apify access), none
  --verifier <name>      who verifies: bounceverify (Apify, ~$0.0009/email, default) or
                         mv (MillionVerifier; needs MILLIONVERIFIER_API_KEY, set MV_PRICE_USD)
  --max-candidates <n>   email guesses checked per lead, in rounds (default 3)
  --name-search          leads with a mail domain but no name: one Google search each for a
                         founder's LinkedIn result title (Apify, ~$0.0045 per company)
  --max-contacts <n>     at most this many leads go through contact finding (default 100)
A funnel report (funnel.md / funnel.json) with counts and costs is written every run.`);
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
    const rows = await PROFILES[name].discover({ limit, offset, minRevenue: Number(args['min-revenue']), serp: args.serp, sources: args.sources, log });
    log(`${name}: ${rows.length} discovered`);
    // type_a pages through its source itself; the others are sliced here.
    const page = name === 'type_a' || name === 'vibe' ? rows : rows.slice(offset);
    candidates.push(...(name === 'vibe' ? page : page.slice(0, limit)).map((r) => ({ ...r, profile: name })));
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
    for (const k of ['yc', 'github', 'trustmrr', 'hn', 'cc']) if (c[k] && !prev[k]) prev[k] = c[k];
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
  // Vibe-coded or professionally designed? Fingerprints always; design patterns in a browser.
  if (lead.site.reachable) {
    const home = await getText(homepage(lead.website));
    const fp = await buildFingerprints(lead.site.fetched_url || site, home.text || '');
    const slop = args['no-browser'] ? null : await (await browserApi()).slopScan(lead.site.fetched_url || site);
    lead.vibe = { ...vibeVerdict(fp, slop, lead), fingerprints: fp };
  }
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

// 3b. For the vibe profile, professionally designed products are not our buyers.
let kept = leads;
// Sources without verified revenue must at least look like a paid product.
const UNPROVEN = new Set(['google-footprint', 'commoncrawl', 'showhn']);
const looksPaid = (l) => !UNPROVEN.has(l.sources[0]) || l.site?.paid_signal || l.cc?.pricing_path;
for (const l of leads) l.paid_product = !!(l.site?.reachable && looksPaid(l));
kept = kept.filter((l) => l.profile !== 'vibe' || l.paid_product);
if (!args['keep-polished']) {
  const before = kept.length;
  kept = kept.filter((l) => !(l.profile === 'vibe' && l.vibe?.verdict === 'polished'));
  if (kept.length < before) log(`dropped ${before - kept.length} polished sites (use --keep-polished to keep them)`);
}

// 3c. Named, verified decision-makers (batched to keep paid calls down).
let queue = [];
if (args.finder === 'auto') args.finder = wanted.length === 1 && wanted[0] === 'vibe' ? 'none' : 'pipelinelabs';
if (args['find-contacts']) {
  queue = kept
    .filter((l) => l.site?.reachable && l.vibe?.verdict !== 'polished')
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, Number(args['max-contacts']));
  await findContacts(queue, {
    finder: args.finder,
    verifier: args.verifier,
    maxCandidates: Number(args['max-candidates']),
    nameSearch: args['name-search'],
    log,
  });
  for (const lead of queue) lead.score = score(lead);
  log(`verified contacts: ${queue.filter((l) => l.contact).length}/${queue.length}`);
}

// 4. Write
const files = await writeOutputs(kept, outDir);
const byPriority = kept.reduce((m, l) => ((m[l.score.priority] = (m[l.score.priority] || 0) + 1), m), {});
log(`wrote ${files.csv}`);
log(`priority counts: ${JSON.stringify(byPriority)}`);

// 5. Funnel: how many survived each step, with which tool, at what cost.
const funnel = funnelReport({ candidates, leads, kept, queue, args });
await writeFile(path.join(outDir, 'funnel.md'), funnel.markdown);
await writeFile(path.join(outDir, 'funnel.json'), JSON.stringify(funnel.data, null, 2));
console.error('\n' + funnel.markdown);
