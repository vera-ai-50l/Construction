#!/usr/bin/env node
// The daily Kyre run, done by a scheduled Claude cloud session (deploy/DAILY-SESSION.md).
// Each stage is a command so the session can do the parts only Claude can do in between
// (looking at screenshots and writing the emails) and move files to and from the Send Desk.
//
//   node src/daily.mjs restore  --from <dir>        desk ledger -> out/state (memory)
//   node src/daily.mjs sync     [--from <dir>]      who is already in SalesHandy -> memory + desk
//   node src/daily.mjs collect  [--date D]          run the lead presets, pick today's leads
//   node src/daily.mjs teardown [--date D]          screenshots + measured findings + briefs
//        (Claude reads out/daily/D/briefs.md and writes out/daily/D/emails/<domain>.json)
//   node src/daily.mjs finalize [--date D] [--notify]   emails -> desk documents + Telegram
//   node src/daily.mjs push     --from <dir> [--date D] [--live] [--notify]
//        approved desk rows -> SalesHandy (push.mjs checks) -> "pushed" documents
//
// Nothing is sent to anyone by this file: SalesHandy sends, and only what the founder
// approved on the desk and push.mjs let through.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runPipeline } from './pipeline.mjs';
import { isRoleMailbox } from './enrich/site.mjs';
import { toCsvRows } from './teardown/csv.mjs';
import { push, saleshandyLog } from './push.mjs';
import { notify } from './notify.mjs';
import { DESK_URL, queueDoc, queueId, loginId, writeDocs, readDocs, restoreState, stateDocs } from './desk.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(root, 'out', 'state');
const NO_COLD_EMAIL = /\.(de|at)$/i;
const FREE_MAIL = /gmail|outlook|hotmail|yahoo|icloud|proton/;

export const LISTS = {
  type_a: ['A', 'AI-built apps'],
  type_b: ['B', 'SaaS: funding news + job boards'],
  type_b_jobs: ['B', 'SaaS hiring a designer'],
  type_c: ['C', 'Shopify stores'],
  type_c_jobs: ['C', 'Shopify stores hiring a designer'],
};

const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback);
const dayDir = (date) => path.join(root, 'out', 'daily', date);
const istDate = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const prettyDay = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Pick today's leads from the scored lists. Pure.
 * Named, verifiable people only; never DE/AT; never anyone (or any company) already pushed;
 * one person per company. Products behind a login go to the founder's sign-up list.
 */
export function selectLeads(scored, pushedLog, cfg) {
  const emails = new Set(pushedLog.map((p) => p.email));
  const domains = new Set(pushedLog.map((p) => p.domain));
  const seen = new Set();
  const pool = [];
  for (const [preset, rows] of Object.entries(scored)) {
    for (const r of rows) {
      const email = String(r.email || '').toLowerCase().trim();
      const mailDomain = email.split('@')[1] || '';
      const site = String(r.domain || '').toLowerCase();
      if (!email.includes('@') || !r.first_name) continue;
      if (isRoleMailbox(email)) continue;
      if (!/^(ok|catch_all)$/.test(r.email_verification || '')) continue;
      if (NO_COLD_EMAIL.test(mailDomain) || NO_COLD_EMAIL.test(site)) continue;
      if (emails.has(email) || (!FREE_MAIL.test(mailDomain) && domains.has(mailDomain)) || domains.has(site)) continue;
      if (seen.has(site)) continue;
      seen.add(site);
      pool.push({ ...r, preset, email });
    }
  }
  pool.sort((x, y) => (x.email_verification === 'ok' ? 0 : 1) - (y.email_verification === 'ok' ? 0 : 1) || Number(y.fit_score || 0) - Number(x.fit_score || 0));
  const needsLogin = (r) => r.login_required === 'yes';
  return {
    teardown: pool.filter((r) => !needsLogin(r)).slice(0, cfg.maxTeardowns ?? 45),
    logins: pool.filter(needsLogin).slice(0, cfg.maxLogins ?? 15),
  };
}

function run(args, log = (m) => process.stderr.write(m)) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['--no-warnings', ...args], { cwd: root, env: { ...process.env, NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY ?? '1' } });
    p.stdout.on('data', (d) => log(String(d)));
    p.stderr.on('data', (d) => log(String(d)));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${args[0]} exited with ${code}`))));
  });
}

export async function collect({ date, presets, maxTeardowns, log = console.error }) {
  const cfg = readJson(path.join(root, 'config', 'daily.json'), {});
  if (maxTeardowns != null) cfg.maxTeardowns = maxTeardowns;
  const dir = dayDir(date);
  mkdirSync(dir, { recursive: true });
  const todo = presets || Object.keys(cfg.presets || {});
  let spent = 0;
  const runs = [];
  for (const preset of todo) {
    if (spent >= (cfg.dailyBudgetUsd ?? 3)) {
      runs.push({ preset, skipped: `daily budget $${cfg.dailyBudgetUsd} reached` });
      continue;
    }
    const outDir = path.join(dir, 'runs', preset);
    try {
      if (!existsSync(path.join(outDir, 'leads-scored.json'))) await runPipeline({ preset, limit: cfg.presets?.[preset]?.limit, outDir, log: (m) => process.stderr.write(m) });
      const cost = readJson(path.join(outDir, 'funnel.json'), {}).ledger?.total_usd || 0;
      spent += cost;
      runs.push({ preset, scored: readJson(path.join(outDir, 'leads-scored.json'), []).length, cost });
    } catch (e) {
      log(`${preset} failed: ${e.message}`);
      runs.push({ preset, error: e.message.slice(0, 300) });
    }
  }
  const scored = Object.fromEntries(todo.map((p) => [p, readJson(path.join(dir, 'runs', p, 'leads-scored.json'), [])]));
  const picked = selectLeads(scored, readJson(path.join(STATE, 'pushed.json'), { log: [] }).log, cfg);
  // Contacts file per preset for the teardown step (people beat scraped inboxes).
  for (const preset of todo) {
    const rows = picked.teardown.filter((r) => r.preset === preset);
    if (rows.length) writeFileSync(path.join(dir, `contacts-${preset}.csv`), toCsvRows(['domain', 'email', 'first_name', 'last_name', 'title'], rows.map((r) => [r.domain, r.email, r.first_name, r.last_name, r.title])));
  }
  const plan = { date, runs, spent_usd: Math.round(spent * 100) / 100, teardown: picked.teardown, logins: picked.logins };
  writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
  return { runs, spent_usd: plan.spent_usd, teardown: picked.teardown.length, logins: picked.logins.length };
}

export async function teardown({ date, log = console.error }) {
  const dir = dayDir(date);
  const plan = readJson(path.join(dir, 'plan.json'), null);
  if (!plan) throw new Error(`no plan for ${date}: run collect first`);
  const briefs = [];
  for (const preset of [...new Set(plan.teardown.map((r) => r.preset))]) {
    const rows = plan.teardown.filter((r) => r.preset === preset);
    const out = path.join(dir, 'teardowns', preset);
    try {
      await run(['src/teardown-cli.mjs', '--leads', path.join(dir, 'runs', preset, 'leads.json'), '--only', rows.map((r) => r.domain).join(','), '--contacts', path.join(dir, `contacts-${preset}.csv`), '--out', out, '--auth-dir', path.join(root, 'auth')]);
    } catch (e) {
      log(`teardown ${preset} failed: ${e.message}`);
      continue;
    }
    for (const t of readJson(path.join(out, 'teardowns.json'), [])) {
      const lead = rows.find((r) => r.domain === t.domain);
      if (!lead) continue;
      briefs.push({
        domain: t.domain,
        preset,
        list: LISTS[preset][0],
        company: lead.company || t.company,
        website: lead.website,
        person: `${lead.first_name} ${lead.last_name || ''}`.trim(),
        title: lead.title || '',
        email: lead.email,
        email_verification: lead.email_verification,
        one_liner: lead.one_liner || '',
        remarks: lead.remarks || '',
        screens_seen: [...new Set(t.screens.filter((s) => s.shot && !s.error && !s.blocked).map((s) => `${s.kind}${s.device === 'mobile' ? ' (phone)' : ''}`))],
        screenshots: Object.entries(t.shots || {}).map(([k, f]) => ({ screen: k, file: path.resolve(out, f) })),
        measured: (t.findings || []).map((f) => ({ screen: f.screen, issue: f.issue, impact: f.impact, fix: f.fix })),
        strengths: t.strengths || [],
        draft_subject: t.email?.subject || '',
        write_to: path.join(dir, 'emails', `${t.domain}.json`),
      });
    }
  }
  mkdirSync(path.join(dir, 'emails'), { recursive: true });
  writeFileSync(path.join(dir, 'briefs.json'), JSON.stringify(briefs, null, 2));
  const md = [`# Briefs for ${date}: ${briefs.length} emails to write`, '', 'For each lead: open every screenshot, then write the email JSON to the "write to" path. Rules: deploy/DAILY-SESSION.md.', ''];
  for (const b of briefs) {
    md.push(`## ${b.company} (${b.domain}) · Type ${b.list}`, `To: ${b.person}${b.title ? `, ${b.title}` : ''} <${b.email}> (${b.email_verification === 'ok' ? 'verified' : 'catch-all'})`, b.one_liner && `What it is: ${b.one_liner}`, b.remarks && `Signals from scoring: ${b.remarks.replace(/\n/g, ' · ')}`, `Screens captured: ${b.screens_seen.join(', ') || 'none'}`, '', 'Screenshots:');
    for (const s of b.screenshots) md.push(`- ${s.screen}: ${s.file}`);
    md.push('', 'Measured (only use what you can also see, or what was measured):');
    for (const f of b.measured.slice(0, 6)) md.push(`- [${f.screen}] ${f.issue}`);
    if (b.strengths.length) md.push('', `Strengths: ${b.strengths.slice(0, 3).join(' · ')}`);
    md.push('', `Write to: ${b.write_to}`, '');
  }
  writeFileSync(path.join(dir, 'briefs.md'), md.filter((l) => typeof l === 'string').join('\n'));
  return { briefs: briefs.length, file: path.join(dir, 'briefs.md') };
}

/** Problems with a written email, or [] if it can go to the desk. */
export function checkEmail(e) {
  const p = [];
  for (const k of ['subject', 'subject_alt', 'email_body', 'followup_1', 'followup_2']) if (!String(e?.[k] || '').trim()) p.push(`${k} missing`);
  const all = ['subject', 'subject_alt', 'email_body', 'followup_1', 'followup_2'].map((k) => e?.[k] || '').join('\n');
  if (/\[[A-Z_ ]+\]|\{\{|TODO|lorem/i.test(all)) p.push('placeholder left in');
  if (/—/.test(all)) p.push('em dash (write plain sentences)');
  if (String(e?.subject || '').split(/\s+/).length > 9) p.push('subject over 9 words');
  if (String(e?.email_body || '').length > 1100) p.push('body over 1100 characters');
  if (/!/.test(e?.subject || '')) p.push('exclamation mark in subject');
  return p;
}

export async function finalize({ date, notifyToo = false, log = console.error }) {
  const dir = dayDir(date);
  const plan = readJson(path.join(dir, 'plan.json'), { teardown: [], logins: [], runs: [], spent_usd: 0 });
  const briefs = readJson(path.join(dir, 'briefs.json'), []);
  const docs = [];
  const missing = [];
  const rejected = [];
  for (const b of briefs) {
    const f = path.join(dir, 'emails', `${b.domain}.json`);
    if (!existsSync(f)) {
      missing.push(b.domain);
      continue;
    }
    const e = JSON.parse(readFileSync(f, 'utf8'));
    const problems = checkEmail(e);
    if (problems.length) {
      rejected.push(`${b.domain}: ${problems.join(', ')}`);
      continue;
    }
    const lead = plan.teardown.find((r) => r.domain === b.domain) || {};
    const verified = lead.email_verification === 'ok';
    docs.push({
      collection: 'queue',
      doc_id: queueId(date, b.email),
      data: queueDoc({
        ...lead,
        ...e,
        list: b.list,
        list_name: LISTS[b.preset][1],
        domain: b.domain,
        send_group: verified ? '1 - verified' : '2 - catch-all',
        email_verification: lead.email_verification,
        lead_finding_from: e.lead_finding_from || 'public site (no login)',
        findings: e.findings || '',
      }, date),
    });
  }
  for (const r of plan.logins) {
    docs.push({
      collection: 'logins',
      doc_id: loginId(date, r.domain),
      data: { date, company: r.company, domain: r.domain, website: r.website, list: `${LISTS[r.preset][0]}: ${LISTS[r.preset][1]}`, email: r.email, verification: r.email_verification, way_in: r.product_access || 'sign-up', sign_up_url: r.website, save_session: `npm run login -- ${r.website} ${r.domain}`, done: false },
    });
  }
  const queued = docs.filter((d) => d.collection === 'queue');
  const verified = queued.filter((d) => d.data.send_group.startsWith('1')).length;
  const cfg = readJson(path.join(root, 'config', 'daily.json'), {});
  const failed = plan.runs.filter((r) => r.error).map((r) => r.preset);
  const summary = [
    `${queued.length} emails ready for review (${verified} verified, ${queued.length - verified} catch-all). ${plan.logins.length} products to sign up to. Spent $${plan.spent_usd} on lead finding.`,
    failed.length ? `Lists that failed today: ${failed.join(', ')}.` : '',
    missing.length ? `${missing.length} teardowns not written: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}.` : '',
    rejected.length ? `${rejected.length} emails held back by checks.` : '',
    `Approve by ${cfg.approveBy || 'the push run'}; approved emails go to SalesHandy at ${cfg.pushAt || 'the push run'}.`,
  ].filter(Boolean).join(' ');
  docs.push({ collection: 'runs', doc_id: `${date}-collect`, data: { date, stage: 'collect', summary, queued: queued.length, verified, logins: plan.logins.length, spent_usd: plan.spent_usd, runs: plan.runs, at: new Date().toISOString() } });
  docs.push(...stateDocs(STATE, date, Object.keys(LISTS)));
  const res = writeDocs(path.join(dir, 'desk'), docs);
  const text = [`☀️ <b>Kyre daily run · ${prettyDay(date)}</b>`, esc(summary), '', `Open the Send Desk: ${DESK_URL}`].join('\n');
  writeFileSync(path.join(dir, 'notify-collect.txt'), text);
  if (notifyToo) await notify(text, { log });
  return { queued: queued.length, verified, logins: plan.logins.length, missing, rejected, manifests: res.manifests, documents: res.count };
}

export async function pushApproved({ date, from, live = false, notifyToo = false, log = console.error }) {
  const dir = dayDir(date);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(path.join(root, 'config', 'saleshandy.json'))) {
    const text = `⚙️ <b>Kyre push · ${prettyDay(date)}</b>\nSalesHandy is not connected yet (config/saleshandy.json with the sequence step IDs is missing), so nothing was pushed. Approved emails stay on the desk.`;
    if (notifyToo) await notify(text, { log });
    return { error: 'config/saleshandy.json missing', pushed: 0 };
  }
  const already = new Set(readDocs(from, 'pushed').map((d) => d._id));
  // Approved but not yet pushed, today or earlier (rows held back by a cap carry over).
  const approved = readDocs(from, 'queue')
    .filter((d) => d.date <= date && d.status === 'approved' && !already.has(d._id))
    .sort((x, y) => x.date.localeCompare(y.date) || String(x.send_group).localeCompare(String(y.send_group)));
  const pending = readDocs(from, 'queue').filter((d) => d.date === date && d.status === 'pending').length;
  const queueFile = path.join(dir, 'approved.json');
  writeFileSync(queueFile, JSON.stringify(approved, null, 2));
  if (!approved.length) {
    const text = `📭 <b>Kyre push · ${prettyDay(date)}</b>\nNothing approved on the Send Desk, so nothing went to SalesHandy.${pending ? ` ${pending} emails are still waiting: ${DESK_URL}` : ''}`;
    if (notifyToo) await notify(text, { log });
    return { approved: 0, pushed: 0, pending, live };
  }
  const result = await push({ queue: queueFile, live, today: date, log });
  const decisions = readJson(path.join(root, 'out', 'pushes', `${date}${live ? '' : '-dry-run'}.json`), { decisions: [] }).decisions;
  const went = decisions.filter((d) => !d.skip);
  const docs = [];
  if (live) {
    const stamp = new Date().toISOString().slice(11, 16).replace(':', '');
    for (const d of went) docs.push({ collection: 'pushed', doc_id: approved.find((a) => a.email === d.email)?._id || queueId(date, d.email), data: { date, email: d.email, company: d.company, list: d.list, group: d.group, step: d.step, pushed_at: new Date().toISOString() } });
    const log_ = readJson(path.join(STATE, 'pushed.json'), { log: [] }).log.filter((p) => p.date === date && went.some((d) => d.email === p.email));
    docs.push({ collection: 'ledger', doc_id: `pushed-${date}-${stamp}`, data: { date, log: log_ } });
  }
  const reasons = Object.entries(result.reasons).map(([k, v]) => `${v} × ${k}`).join('; ');
  const summary = `${live ? '' : '[dry run] '}${went.length} of ${approved.length} approved emails ${live ? 'went' : 'would go'} to SalesHandy.${reasons ? ` Held back: ${reasons}.` : ''}${pending ? ` ${pending} still waiting on the desk.` : ''}`;
  docs.push({ collection: 'runs', doc_id: `${date}-push${live ? '' : '-dry-run'}`, data: { date, stage: 'push', live, summary, pushed: went.length, approved: approved.length, at: new Date().toISOString() } });
  const res = writeDocs(path.join(dir, `desk-push${live ? '' : '-dry-run'}`), docs);
  const text = [`📤 <b>Kyre push · ${prettyDay(date)}</b>`, esc(summary), went.length && live ? 'SalesHandy sends them in its sending window. Replies ping here.' : ''].filter(Boolean).join('\n');
  if (notifyToo) await notify(text, { log });
  return { approved: approved.length, pushed: went.length, live, reasons: result.reasons, manifests: res.manifests };
}

/**
 * Learn everyone already in SalesHandy (any sequence, also added by hand): merge into
 * out/state/pushed.json so collect never picks them, save them to the desk ledger, and mark
 * desk rows (from --from) that are already in SalesHandy as pushed.
 */
export async function sync({ date, from, log = console.error }) {
  const dir = dayDir(date);
  const pushedFile = path.join(STATE, 'pushed.json');
  const local = readJson(pushedFile, { log: [] });
  const known = new Set(local.log.map((p) => p.email));
  let sh;
  try {
    sh = await saleshandyLog();
  } catch (e) {
    log(`sync skipped: ${e.message.slice(0, 200)}`);
    return { skipped: 'SalesHandy not reachable (key missing?)' };
  }
  const fresh = sh.filter((p) => !known.has(p.email));
  mkdirSync(STATE, { recursive: true });
  writeFileSync(pushedFile, JSON.stringify({ log: [...local.log, ...fresh] }, null, 2));
  const docs = [];
  const stamp = new Date().toISOString().slice(11, 16).replace(':', '');
  if (fresh.length) docs.push({ collection: 'ledger', doc_id: `pushed-saleshandy-${date}-${stamp}`, data: { date, note: 'already in SalesHandy (synced)', log: fresh } });
  const inSh = new Set(sh.map((p) => p.email));
  const done = new Set(from ? readDocs(from, 'pushed').map((d) => d._id) : []);
  const rows = from ? readDocs(from, 'queue').filter((d) => inSh.has(String(d.email).toLowerCase()) && !done.has(d._id)) : [];
  for (const r of rows) docs.push({ collection: 'pushed', doc_id: r._id, data: { date, email: r.email, company: r.company, list: r.list, step: 'already in SalesHandy', pushed_at: new Date().toISOString() } });
  const res = docs.length ? writeDocs(path.join(dir, `desk-sync-${stamp}`), docs) : { manifests: [] };
  return { in_saleshandy: sh.length, new_to_memory: fresh.length, desk_rows_already_there: rows.length, manifests: res.manifests };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd] = process.argv.slice(2);
  const { values: a } = parseArgs({ args: process.argv.slice(3), options: { date: { type: 'string' }, from: { type: 'string' }, presets: { type: 'string' }, 'max-teardowns': { type: 'string' }, live: { type: 'boolean', default: false }, notify: { type: 'boolean', default: false } } });
  const date = a.date || istDate();
  let out;
  if (cmd === 'restore') {
    if (!a.from) throw new Error('--from <dir saved by ArtifactData list of "ledger"> is required');
    out = restoreState(readDocs(a.from, 'ledger'), STATE);
  } else if (cmd === 'collect') out = await collect({ date, presets: a.presets?.split(','), maxTeardowns: a['max-teardowns'] && Number(a['max-teardowns']) });
  else if (cmd === 'teardown') out = await teardown({ date });
  else if (cmd === 'sync') out = await sync({ date, from: a.from });
  else if (cmd === 'finalize') out = await finalize({ date, notifyToo: a.notify });
  else if (cmd === 'push') {
    if (!a.from) throw new Error('--from <dir saved by ArtifactData query of "queue" and list of "pushed"> is required');
    out = await pushApproved({ date, from: a.from, live: a.live, notifyToo: a.notify });
  } else {
    console.error('usage: node src/daily.mjs restore|collect|teardown|finalize|push [--date YYYY-MM-DD] (see the top of this file)');
    process.exit(1);
  }
  console.log(JSON.stringify(out, null, 2));
}
