#!/usr/bin/env node
// Push approved emails into SalesHandy, safely. Input: a queue (JSON array or our
// SalesHandy CSV: Email, First Name, Last Name, Company, Website, subject, subject_alt,
// email_body, followup_1, followup_2, send_group, email_verification, email_confidence,
// lead_finding_from [, list]).
//
// Every row passes these checks before it can go:
//   - named person only (shared inboxes like info@ / support@ are refused)
//   - no cold email to German or Austrian domains (LinkedIn only)
//   - never twice: out/state/pushed.json remembers every address and company domain pushed
//   - today's cap (config/saleshandy.json dailyCap) and a separate catch-all cap
//   - the right sequence step: by list (A / B / C) and send group (verified / catch-all)
// Dry run unless --live. Writes out/pushes/<date>.json with what was (or would be) pushed.
//
//   node src/push.mjs --queue out/send-2026-11-19/saleshandy-ready.csv            (dry run)
//   node src/push.mjs --queue ... --live
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './sources/seed.mjs';
import { isRoleMailbox } from './enrich/site.mjs';
import { importProspects, sequences, allProspects } from './saleshandy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(root, 'config', 'saleshandy.json');
const PUSHED = path.join(root, 'out', 'state', 'pushed.json');
const NO_COLD_EMAIL = /\.(de|at)$/i;

export function loadConfig() {
  if (!existsSync(CONFIG)) throw new Error(`${path.relative(root, CONFIG)} missing: copy config/saleshandy.example.json and fill in the step IDs`);
  return JSON.parse(readFileSync(CONFIG, 'utf8'));
}

/** Rows from a CSV or JSON queue, keys normalised to snake_case. */
export function readQueue(file) {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = file.endsWith('.json') ? JSON.parse(text) : parseCsv(text);
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, '_'), v])));
}

const listOf = (r) => {
  const l = String(r.list || r.kyre_list || '').toUpperCase();
  return l.startsWith('C') || /shopify/i.test(r.list || '') ? 'C' : l.startsWith('B') ? 'B' : 'A';
};
const groupOf = (r) => (/^1|verified|^ok$/i.test(r.send_group || r.email_verification || '') ? 'verified' : 'catch_all');
const domainOf = (r) => String(r.email || '').split('@')[1]?.toLowerCase() || '';

/** Split "Hi Ana,\n\nPara 1\n\nPara 2..." into the greeting and its paragraphs. */
export function splitEmail(text) {
  const parts = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const greeting = /^(hi|hello|hey|dear)\b.{0,40},?$/i.test(parts[0] || '') ? parts.shift() : '';
  return { greeting, paras: parts };
}
const firstAndRest = (paras) => [paras[0] || '', paras.slice(1).join('\n\n')];

/**
 * SalesHandy prospect in the fields the Kyre sequences already use:
 * {{Greeting}} {{Body 1}} {{Body 2}} {{Body 3}}, follow-ups {{Follow Up 1A}} {{Follow Up 1B}}
 * and {{Follow Up 2A}} {{Follow Up 2B}}, subjects {{Subject}} / {{Subject Alt}} (A/B variants).
 */
export function toProspect(r) {
  const main = splitEmail(r.email_body);
  const f1 = splitEmail(r.followup_1);
  const f2 = splitEmail(r.followup_2);
  const greeting = main.greeting || f1.greeting || (r.first_name ? `Hi ${r.first_name},` : 'Hi,');
  const [f1a, f1b] = firstAndRest(f1.paras);
  const [f2a, f2b] = firstAndRest(f2.paras);
  return {
    'First Name': r.first_name || '', 'Last Name': r.last_name || '', Email: r.email, Company: r.company || '', Website: r.website || '',
    Subject: r.subject || '', 'Subject Alt': r.subject_alt || r.subject || '', Greeting: greeting,
    'Body 1': main.paras[0] || '', 'Body 2': main.paras[1] || '', 'Body 3': main.paras.slice(2).join('\n\n'),
    'Follow Up 1A': f1a, 'Follow Up 1B': f1b, 'Follow Up 2A': f2a, 'Follow Up 2B': f2b,
    'Send Group': r.send_group || '', 'Email Verification': r.email_verification || '', 'Email Confidence': r.email_confidence || '',
    'Lead Source': `Kyre ${listOf(r)} · ${r.lead_finding_from || 'public site'}`,
  };
}

/** Decide, row by row, what may be pushed today and where. Pure: no network. */
export function plan(rows, cfg, pushed, today) {
  const todayCount = pushed.log.filter((p) => p.date === today).length;
  const todayCatchAll = pushed.log.filter((p) => p.date === today && p.group === 'catch_all').length;
  let left = (cfg.dailyCap ?? 40) - todayCount;
  let leftCatchAll = (cfg.catchAllDailyCap ?? cfg.dailyCap ?? 40) - todayCatchAll;
  const emails = new Set(pushed.log.map((p) => p.email));
  const domains = new Set(pushed.log.map((p) => p.domain));
  const out = [];
  for (const r of rows) {
    const email = String(r.email || '').toLowerCase().trim();
    const domain = domainOf(r);
    const list = listOf(r);
    const group = groupOf(r);
    const step = cfg.steps?.[list]?.[group];
    let skip = '';
    if (!email || !email.includes('@')) skip = 'no email';
    else if (isRoleMailbox(email)) skip = 'shared inbox, not a person';
    else if (NO_COLD_EMAIL.test(domain)) skip = 'German/Austrian domain: LinkedIn only';
    else if (emails.has(email)) skip = 'already pushed';
    else if (!/gmail|outlook|yahoo|icloud|proton/.test(domain) && domains.has(domain)) skip = 'someone at this company already pushed';
    else if (!step) skip = `no SalesHandy step set for list ${list} / ${group}`;
    else if (left <= 0) skip = 'daily cap reached';
    else if (group === 'catch_all' && leftCatchAll <= 0) skip = 'catch-all cap reached';
    if (!skip) {
      left--;
      if (group === 'catch_all') leftCatchAll--;
      emails.add(email);
      domains.add(domain);
    }
    out.push({ email, company: r.company, list, group, step: step || '', skip });
  }
  return out;
}

/** SalesHandy prospects as pushed-log entries (date = the day they were added, India time). */
export async function saleshandyLog() {
  const istDay = (iso) => (iso ? new Date(Date.parse(iso) + 5.5 * 3600e3).toISOString().slice(0, 10) : 'earlier');
  return (await allProspects()).map((p) => ({ date: istDay(p.created_at), email: p.email, domain: p.email.split('@')[1], company: '', list: '', group: '', step: 'saleshandy', source: 'saleshandy' }));
}

function loadPushed() {
  return existsSync(PUSHED) ? JSON.parse(readFileSync(PUSHED, 'utf8')) : { log: [] };
}

export async function push({ queue, live = false, today = new Date().toISOString().slice(0, 10), log = console.error } = {}) {
  const cfg = loadConfig();
  const rows = readQueue(queue);
  const pushed = loadPushed();
  // Live: SalesHandy itself is the truth. Anyone already in any sequence (also ones added by
  // hand) is never added again, and people added today count toward today's cap.
  const known = live ? await saleshandyLog() : [];
  const decisions = plan(rows, cfg, { log: [...pushed.log, ...known.filter((k) => !pushed.log.some((p) => p.email === k.email))] }, today);
  const go = decisions.filter((d) => !d.skip);
  // One import per step.
  const byStep = new Map();
  for (const d of go) byStep.set(d.step, [...(byStep.get(d.step) || []), rows.find((r) => String(r.email).toLowerCase().trim() === d.email)]);
  const results = [];
  // Hard rule: Kyre never pushes into a Vera sequence. Check every target step's sequence.
  if (live && byStep.size) {
    const seqs = await sequences();
    const all = Array.isArray(seqs) ? seqs : seqs?.sequences || seqs?.data || [];
    const owner = new Map();
    for (const s of all) for (const st of s.steps || s.sequenceSteps || []) owner.set(String(st.id || st.stepId), String(s.title || s.name || ''));
    const vera = new RegExp(cfg.veraSequenceNameMatch || 'vera', 'i');
    for (const step of byStep.keys()) {
      if (!owner.has(String(step))) throw new Error(`step ${step} not found in your SalesHandy sequences: check config/saleshandy.json`);
      if (vera.test(owner.get(String(step)))) throw new Error(`step ${step} belongs to "${owner.get(String(step))}": Kyre never sends through Vera`);
    }
  }
  for (const [step, list] of byStep) {
    if (live) {
      const r = await importProspects(step, list.map(toProspect), { log });
      results.push({ step, count: list.length, ...r });
    } else results.push({ step, count: list.length, dry_run: true });
    log(`${live ? 'pushed' : '[dry run] would push'} ${list.length} to step ${step}`);
  }
  if (live) {
    for (const d of go) pushed.log.push({ date: today, email: d.email, domain: d.email.split('@')[1], company: d.company, list: d.list, group: d.group, step: d.step });
    mkdirSync(path.dirname(PUSHED), { recursive: true });
    writeFileSync(PUSHED, JSON.stringify(pushed, null, 2));
  }
  mkdirSync(path.join(root, 'out', 'pushes'), { recursive: true });
  writeFileSync(path.join(root, 'out', 'pushes', `${today}${live ? '' : '-dry-run'}.json`), JSON.stringify({ live, decisions, results }, null, 2));
  const skipped = decisions.filter((d) => d.skip);
  return { pushed: go.length, skipped: skipped.length, reasons: skipped.reduce((m, d) => ((m[d.skip] = (m[d.skip] || 0) + 1), m), {}), live };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { values: a } = parseArgs({ options: { queue: { type: 'string' }, live: { type: 'boolean', default: false }, today: { type: 'string' } } });
  if (!a.queue) throw new Error('--queue <csv or json> is required');
  console.log(JSON.stringify(await push({ queue: a.queue, live: a.live, today: a.today || undefined }), null, 2));
}
