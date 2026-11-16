#!/usr/bin/env node
// Step 2: teardowns. Reads leads.json from a scrape run, audits each lead's public
// screens (and its dashboard when you saved a login session), writes the teardown
// email, and exports teardowns.xlsx + saleshandy.csv.
//   npm run teardown -- --leads out/2026-11-16-ab/leads.json
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { auditScreen, closeBrowser, sessionFor } from './teardown/audit.mjs';
import { findings, strengths, SCREEN_NAME } from './teardown/findings.mjs';
import { chooseRecipient, writeEmail } from './teardown/email.mjs';
import { writeWorkbook } from './teardown/workbook.mjs';
import { loadReview, aiReview, reviewFindings } from './teardown/review.mjs';
import { pool } from './http.mjs';
import { parseCsv } from './sources/seed.mjs';

const { values: args } = parseArgs({
  options: {
    leads: { type: 'string' },
    out: { type: 'string' },
    'auth-dir': { type: 'string', default: 'auth' },
    only: { type: 'string' },
    'min-score': { type: 'string', default: '0' },
    concurrency: { type: 'string', default: '2' },
    'ai-review': { type: 'boolean', default: false },
    reuse: { type: 'boolean', default: false },
    contacts: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (args.help || !args.leads) {
  console.log(`Usage: npm run teardown -- --leads out/<run>/leads.json [options]
  --out <dir>         where to write (default: next to leads.json)
  --auth-dir <dir>    saved login sessions from "npm run login" (default auth/)
  --only <domains>    comma list of domains to (re)do
  --min-score <n>     skip leads below this scrape score
  --concurrency <n>   leads audited in parallel (default 2)
  --contacts <csv>    verified decision-maker emails (domain,email,first_name,last_name,title);
                      they replace the scraped inbox and the greeting
  --reuse             reuse screenshots and measurements from the last run (only re-write emails)
  --ai-review         have Claude review the screenshots (needs ANTHROPIC_API_KEY; ~$0.05 per lead)
                      A review file in <out>/reviews/<domain>.json is used instead when present.`);
  process.exit(args.help ? 0 : 1);
}

const log = (...m) => console.error(`[${new Date().toISOString().slice(11, 19)}]`, ...m);
const outDir = path.resolve(args.out || path.dirname(args.leads));
const only = args.only ? new Set(args.only.split(',').map((s) => s.trim())) : null;
const withHttps = (u) => (!u ? null : /^https?:\/\//.test(u) ? u : `https://${u}`);

const leads = JSON.parse(await readFile(args.leads, 'utf8'))
  .filter((l) => l.site?.reachable && !l.site.blocked)
  .filter((l) => !only || only.has(l.domain))
  .filter((l) => l.score.total >= Number(args['min-score']));
log(`${leads.length} leads to tear down`);

// --reuse: keep last run's screens so reviews can be added without re-auditing.
const previous = new Map();
if (args.reuse && existsSync(path.join(outDir, 'teardowns.json'))) {
  for (const t of JSON.parse(readFileSync(path.join(outDir, 'teardowns.json'), 'utf8'))) previous.set(t.domain, t.screens);
}

// --contacts: verified people beat scraped shared inboxes.
const contacts = new Map();
if (args.contacts) {
  for (const r of parseCsv(readFileSync(args.contacts, 'utf8'))) {
    if (r.domain && /@/.test(r.email || '')) contacts.set(r.domain.trim().toLowerCase(), r);
  }
  log(`${contacts.size} verified contacts loaded`);
}

const teardowns = [];
let done = 0;
await pool(leads, Number(args.concurrency), async (lead) => {
  const shotDir = path.join(outDir, 'teardowns', lead.domain);
  const demoUrl = withHttps(lead.render?.public_demo_open || lead.site.public_demo_urls[0] || lead.site.demo_embeds[0]?.split('|')[1]);
  const session = sessionFor(args['auth-dir'], lead.domain);
  const savedDash = session && existsSync(session.replace(/\.json$/, '.url')) ? readFileSync(session.replace(/\.json$/, '.url'), 'utf8').trim() : null;
  const appUrl = lead.site.app_urls[0] || lead.site.login_urls[0] || null;
  const plan = [
    { kind: 'home', url: lead.site.fetched_url, device: 'desktop', axe: true },
    { kind: 'home', url: lead.site.fetched_url, device: 'mobile' },
    { kind: 'pricing', url: lead.site.pricing_url, device: 'desktop' },
    { kind: 'signup', url: lead.site.signup_urls[0], device: 'desktop' },
    { kind: 'demo', url: demoUrl, device: 'desktop' },
    { kind: 'dashboard', url: savedDash || appUrl, device: 'desktop', axe: true, storageState: session },
  ].filter((p) => p.url && (p.kind !== 'dashboard' || session));

  let screens = previous.get(lead.domain);
  if (!screens) {
    screens = [];
    for (const p of plan) screens.push(await auditScreen({ ...p, shotDir }));
  }

  const demo = screens.find((s) => s.kind === 'demo' && !s.error && !s.blocked);
  const dash = screens.find((s) => s.kind === 'dashboard' && !s.error && !s.blocked);
  const demoOpen = demo && !demo.login_wall && demo.text_length > 500;
  const dashboardVisible = dash && !dash.login_wall ? 'yes (saved session)' : demoOpen ? 'yes (public demo)' : 'no';
  const loginUrl = lead.site.signup_urls[0] || appUrl || '';
  const needsLogin = dashboardVisible === 'no' && !!loginUrl;
  const sessionExpired = !!(dash && dash.login_wall);

  const measured = findings(screens, lead);
  const shotsByKey = Object.fromEntries(screens.filter((s) => s.shot).map((s) => [s.device === 'mobile' ? `${s.kind}-mobile` : s.kind, s.shot]));
  const review = (await loadReview(outDir, lead.domain)) || (args['ai-review'] ? await aiReview({ lead, shots: shotsByKey, measured, outDir, log }) : null);
  const visual = reviewFindings(review).sort((a, b) => b.severity - a.severity);
  // Lead with what a person noticed (up to two), then back it with measured numbers.
  const found = [...visual.slice(0, 2), ...measured, ...visual.slice(2)];
  const good = [...(review?.strength ? [review.strength.replace(/\.$/, '')] : []), ...strengths(screens, lead)];
  const c = contacts.get(lead.domain);
  const recipient = c
    ? { email: c.email.trim(), email_type: 'personal', first_name: c.first_name || '', last_name: c.last_name || '', title: c.title || '', greeting: c.first_name ? `Hi ${c.first_name}` : `Hi ${lead.name} team`, source: 'contacts' }
    : chooseRecipient(lead);
  const audited = [...new Set(screens.filter((s) => !s.error && !s.blocked && s.kind !== 'dashboard').map((s) => SCREEN_NAME[s.kind]))];
  const mail = writeEmail(lead, recipient, found, good, audited);
  const shots = shotsByKey;
  const signup = screens.find((s) => s.kind === 'signup' && !s.error);
  // Only a named person counts as ready: shared inboxes (hello@, info@) rarely reach the buyer.
  const status = !recipient
    ? 'needs_email'
    : mail.findings_used.length < 2
      ? 'thin'
      : recipient.email_type === 'personal' || recipient.source === 'contacts'
        ? 'ready'
        : 'shared_inbox';

  teardowns.push({
    company: lead.name,
    domain: lead.domain,
    profile: lead.profile,
    screens,
    findings: found,
    strengths: good,
    recipient,
    email: mail,
    shots,
    send_row: {
      status,
      priority: lead.score.priority,
      score: lead.score.total,
      company: lead.name,
      website: lead.site.fetched_url,
      email: recipient?.email || '',
      email_source: recipient?.source === 'contacts' ? 'verified contact' : recipient ? `scraped ${recipient.email_type} inbox` : '',
      first_name: recipient?.first_name || '',
      last_name: recipient?.last_name || '',
      subject: mail.subject,
      subject_alt: mail.subject_alt,
      email_body: mail.body,
      followup_body: mail.followup,
      finding_1: mail.findings_used[0] ? `${mail.findings_used[0].issue}` : '',
      finding_2: mail.findings_used[1] ? `${mail.findings_used[1].issue}` : '',
      finding_3: mail.findings_used[2] ? `${mail.findings_used[2].issue}` : '',
      strength: good[0] || '',
      review: review ? review.source : 'none',
      looks_ai_generated: review ? (review.looks_ai_generated ? `yes: ${review.ai_look_evidence}` : 'no') : '',
      dashboard_visible: dashboardVisible,
      needs_manual_login: needsLogin || sessionExpired ? 'yes' : 'no',
      login_url: loginUrl,
      profile: lead.profile,
      offer: lead.offer,
      screenshots: Object.values(shots).join(' '),
    },
    login_row: {
      company: lead.name,
      priority: lead.score.priority,
      score: lead.score.total,
      login_url: loginUrl,
      app_url: appUrl || '',
      work_email_required: signup ? (signup.work_email ? 'yes' : 'no') : 'unknown',
      sign_in_options: signup?.oauth?.join(', ') || '',
      what_to_check: sessionExpired
        ? 'Saved session expired: log in again.'
        : 'Onboarding steps, the main dashboard, the busiest table or chart, empty states.',
      save_session_command: `npm run login -- ${loginUrl} ${lead.domain}`,
    },
  });
  done++;
  log(`${done}/${leads.length} ${lead.domain}: ${visual.length} reviewed + ${measured.length} measured findings, dashboard ${dashboardVisible}, ${status}`);
});
await closeBrowser();

// --only redoes some leads: keep every other lead from the last run in the outputs.
const lastFile = path.join(outDir, 'teardowns.json');
if (only && existsSync(lastFile)) {
  for (const t of JSON.parse(readFileSync(lastFile, 'utf8'))) if (!only.has(t.domain)) teardowns.push(t);
}
teardowns.sort((a, b) => b.send_row.score - a.send_row.score);
await writeFile(path.join(outDir, 'teardowns.json'), JSON.stringify(teardowns, null, 2));
const res = await writeWorkbook(teardowns, outDir);
log(`wrote ${res.xlsx}`);
log(`wrote ${res.csv}`);
log(`counts: ${JSON.stringify(res.counts)}`);
