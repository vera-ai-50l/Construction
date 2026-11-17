#!/usr/bin/env node
// One sheet of every lead whose product sits behind a login, across the lists: who to
// sign up for, how (self-serve, work email, Google), what to look at once inside, and
// the command that saves the session so the dashboard teardown can run.
// Only leads with a named, usable email; sales-gated / waitlist products are listed
// separately (no way in without talking to them).
//   node src/login-sheet.mjs --out out/login-queue
import path from 'node:path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import ExcelJS from 'exceljs';
import { isRoleMailbox } from './enrich/site.mjs';
import { brandName } from './brand.mjs';
import { tooBig } from './size.mjs';
import { emailConfidence } from './confidence.mjs';
import { toCsvRows } from './teardown/csv.mjs';

const { values: args } = parseArgs({ options: { out: { type: 'string', default: 'out/login-queue' } } });
const OUT = path.resolve('out');
const read = (f) => (existsSync(path.join(OUT, f)) ? JSON.parse(readFileSync(path.join(OUT, f), 'utf8')) : null);
const usable = (c) => c?.email && !isRoleMailbox(c.email) && ['ok', 'catch_all'].includes(c.verification);
const CHECK_B = 'Main dashboard, the busiest table or chart, filters and empty states, onboarding steps, settings.';

const rows = [];
const seen = new Set();
const add = (r) => {
  if (seen.has(r.domain)) return;
  seen.add(r.domain);
  rows.push(r);
};

// Type A: the batch of 40 (teardowns already written from public pages).
const ta = read('batch-40/teardowns.json') || [];
const al = new Map((read('batch-40/leads.json') || []).map((l) => [l.domain, l]));
for (const t of ta.filter((x) => x.send_row.needs_manual_login === 'yes')) {
  const l = al.get(t.domain);
  if (!l || !usable(l.contact)) continue;
  add({
    list: 'A: AI-built apps (batch of 40)', domain: t.domain, company: brandName(l), website: l.site?.fetched_url || l.website,
    way_in: t.login_row.work_email_required === 'yes' ? 'work email only' : 'free sign-up', sign_up_url: t.login_row.login_url || t.login_row.app_url,
    sign_in_options: t.login_row.sign_in_options || '', what_to_check: t.login_row.what_to_check,
    contact: `${l.contact.first_name || ''} ${l.contact.last_name || ''}`.trim(), email: l.contact.email, verification: l.contact.verification,
    email_confidence: emailConfidence(l).score, fit_score: l.score?.total ?? '', teardown_now: 'written from public pages: update after login',
    save_session: t.login_row.save_session_command,
  });
}

// Type B lists: login check results.
const B_LISTS = [
  ['B: non-YC SaaS (funding news + job boards)', 'type-b2-50'],
  ['B: hiring a designer (job posts)', 'jobs-test-b'],
  ['B: YC (older list)', 'type-b-50'],
];
const gated = [];
for (const [label, dir] of B_LISTS) {
  const delivered = new Set((read(`${dir}/leads-scored.json`) || []).map((r) => r.domain));
  for (const l of read(`${dir}/leads.json`) || []) {
    if (!delivered.has(l.domain) || !usable(l.contact) || tooBig(l)) continue;
    const pa = l.product_access;
    if (!pa || pa.login_required !== 'yes') continue;
    const base = {
      list: label, domain: l.domain, company: brandName(l), website: l.site?.fetched_url || l.website,
      contact: `${l.contact.first_name || ''} ${l.contact.last_name || ''}`.trim(), email: l.contact.email, verification: l.contact.verification,
      email_confidence: emailConfidence(l).score, fit_score: l.score?.total ?? '',
    };
    if (/self-serve/.test(pa.mode)) {
      add({
        ...base, way_in: pa.mode === 'self-serve-work-email' ? 'work email only' : 'free sign-up', sign_up_url: pa.url,
        sign_in_options: (pa.detail.match(/sign in with ([\w/]+)/) || [, ''])[1], what_to_check: CHECK_B,
        teardown_now: 'none yet (no teardown run for Type B)', save_session: `npm run login -- ${pa.url} ${l.domain}`,
      });
    } else if (!seen.has(l.domain)) {
      seen.add(l.domain);
      gated.push({ ...base, way_in: pa.mode === 'waitlist' ? 'waitlist' : 'sales-gated (book a demo)', sign_up_url: pa.url || '', note: pa.detail });
    }
  }
}

// Easiest first: free sign-up, verified email, best fit.
const rank = (r) => (r.way_in === 'free sign-up' ? 0 : 1) * 10 + (r.verification === 'ok' ? 0 : 1);
rows.sort((a, b) => rank(a) - rank(b) || (b.fit_score || 0) - (a.fit_score || 0));
rows.forEach((r, i) => (r.n = i + 1));

const COLS = [
  ['n', 4], ['done', 8], ['list', 26], ['company', 20], ['website', 28], ['way_in', 14], ['sign_up_url', 34], ['sign_in_options', 14],
  ['what_to_check', 40], ['contact', 18], ['email', 30], ['verification', 11], ['email_confidence', 10], ['fit_score', 8],
  ['teardown_now', 30], ['save_session', 56],
];
const GCOLS = [['list', 26], ['company', 20], ['website', 28], ['way_in', 20], ['sign_up_url', 34], ['contact', 18], ['email', 30], ['verification', 11], ['fit_score', 8], ['note', 50]];
const wb = new ExcelJS.Workbook();
const sheet = (name, cols, list) => {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, xSplit: 4 }] });
  ws.columns = cols.map(([key, width]) => ({ header: key.replace(/_/g, ' '), key, width }));
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  for (const r of list) {
    const row = ws.addRow(r);
    row.alignment = { wrapText: true, vertical: 'top' };
    const way = row.getCell('way_in');
    way.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: /free/.test(r.way_in) ? 'FFC6EFCE' : /work email/.test(r.way_in) ? 'FFFFEB9C' : 'FFFFC7CE' } };
    if (r.verification) row.getCell('verification').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.verification === 'ok' ? 'FFC6EFCE' : 'FFFFEB9C' } };
    if (r.website) row.getCell('website').value = { text: r.website, hyperlink: r.website };
    if (r.sign_up_url) row.getCell('sign_up_url').value = { text: r.sign_up_url, hyperlink: r.sign_up_url };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
};
sheet('Log in and save session', COLS, rows);
sheet('Sales-gated (no way in)', GCOLS, gated);
const how = wb.addWorksheet('How to do it');
how.columns = [{ header: 'Steps', key: 'a', width: 120 }];
for (const line of [
  '1. Work top to bottom: green = free sign-up, amber = needs a work email (use the Kyre address), red = sales-gated (other tab, skip).',
  '2. On your computer, in lead-scraper: run the "save session" command. A browser opens on the sign-up page; sign up or log in, open the main dashboard, then press Enter in the terminal. The session is saved in auth/ (stays private, never committed).',
  '3. Put "yes" in the done column and send the sheet back (or tell me the domains).',
  '4. I then run the dashboard teardown for those domains (npm run teardown -- --only <domains> --reuse), look at the screenshots, update the findings, subject and email body, and give you the SalesHandy rows.',
  'Use a separate, real Kyre work account. Do not enter payment details. Do not use anyone else\'s login. If a site asks for a phone or card, skip it and mark it in done.',
]) how.addRow({ a: line }).alignment = { wrapText: true };
mkdirSync(args.out, { recursive: true });
const xlsx = path.join(args.out, 'login-queue.xlsx');
await wb.xlsx.writeFile(xlsx);
writeFileSync(path.join(args.out, 'login-queue.csv'), toCsvRows(COLS.map(([k]) => k), rows.map((r) => COLS.map(([k]) => r[k] ?? ''))));
const by = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
console.log(`wrote ${xlsx}: ${rows.length} to log in (${JSON.stringify(by('way_in'))}; by list ${JSON.stringify(by('list'))}), ${gated.length} sales-gated`);
