#!/usr/bin/env node
// One colour-coded workbook for a sending batch: every lead with its contact, how the
// address was found and verified, confidence scores for the email and the teardown,
// and the teardown email. Group 1 = verified "ok" (send first), group 2 = catch-all.
//   node src/batch-sheet.mjs out/batch-40
import path from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { toCsvRows } from './teardown/csv.mjs';

const dir = path.resolve(process.argv[2] || 'out/batch-40');
const leads = JSON.parse(readFileSync(path.join(dir, 'leads.json'), 'utf8'));
const teardowns = new Map(JSON.parse(readFileSync(path.join(dir, 'teardowns.json'), 'utf8')).map((t) => [t.domain, t]));
const summary = existsSync(path.join(dir, 'summary.json')) ? JSON.parse(readFileSync(path.join(dir, 'summary.json'), 'utf8')) : null;

const HOW = (src = '') =>
  /google \(LinkedIn/.test(src) ? 'Name from Google (LinkedIn result title), email = pattern guess'
  : /trustmrr/.test(src) ? 'Name from TrustMRR founder listing, email = pattern guess'
  : /hn profile/.test(src) ? 'Published by the maker on their Hacker News profile'
  : /^pattern/.test(src) ? 'Name from the company website, email = pattern guess'
  : /company site/.test(src) ? 'Published on the company website'
  : src;
const SOURCE = { trustmrr: 'TrustMRR (verified revenue)', commoncrawl: 'Common Crawl (Lovable-hosted app)', showhn: 'Hacker News Show HN', 'google-footprint': 'Google (builder footprint)' };

/**
 * Email confidence, 0-100: will this reach the right person?
 * Verification sets the base; where the address and the name came from adjusts it.
 */
export function emailConfidence(lead) {
  const c = lead.contact;
  let s = c.verification === 'ok' ? 85 : c.verification === 'catch_all' ? 55 : 20;
  const src = c.email_source || '';
  const why = [c.verification === 'ok' ? 'server confirmed the mailbox' : 'catch-all server: cannot be confirmed'];
  if (/hn profile|^company site/.test(src)) (s += 10), why.push('address published by them');
  else if (/trustmrr/.test(src)) (s += 5), why.push('name from their own TrustMRR listing');
  else if (/google \(LinkedIn/.test(src)) (s -= 10), why.push('name found by search: check LinkedIn');
  const emailDomain = c.email.split('@')[1];
  const companyDomain = lead.mail_domain || lead.domain;
  if (!/gmail|outlook|yahoo|icloud|proton/.test(emailDomain) && emailDomain !== companyDomain && !companyDomain.endsWith(emailDomain)) (s -= 15), why.push('address is on another domain');
  return { score: Math.max(10, Math.min(98, s)), why: why.join('; ') };
}

/** Teardown confidence, 0-100: how specific and well-founded is the email's content? */
export function teardownConfidence(t) {
  if (!t) return { score: 0, why: 'no teardown' };
  const used = t.email?.findings_used?.length || 0;
  const reviewed = ['file', 'ai'].includes(t.send_row.review) || t.findings.some((f) => f.metric === 'reviewed');
  const screens = Object.keys(t.shots || {}).length;
  let s = 35 + used * 12 + (reviewed ? 15 : 0) + (screens >= 3 ? 5 : 0);
  const why = [`${used} finding${used === 1 ? '' : 's'} in the email`, reviewed ? 'screens looked at by a person' : 'measured checks only', `${screens} screenshots`];
  return { score: Math.min(95, s), why: why.join('; ') };
}

const band = (s) => (s >= 80 ? 'High' : s >= 55 ? 'Medium' : 'Low');
const rows = leads.map((l, i) => {
  const t = teardowns.get(l.domain);
  const s = t?.send_row || {};
  const c = l.contact;
  const ec = emailConfidence(l);
  const tc = teardownConfidence(t);
  const greetingFix = (body) => (body || '').replace(/^Hi [^,\n]+ team,/, c.first_name ? `Hi ${c.first_name},` : 'Hi there,');
  return {
    n: i + 1,
    send_group: c.verification === 'ok' ? '1 - verified' : '2 - catch-all',
    overall: Math.round(0.6 * ec.score + 0.4 * tc.score),
    company: l.name,
    website: l.site?.fetched_url || l.website,
    lead_source: SOURCE[l.sources[0]] || l.sources[0],
    vibe_verdict: l.vibe?.verdict || '',
    fit_score: l.score?.total ?? '',
    revenue_30d: l.trustmrr?.revenue_30d_usd ? `$${l.trustmrr.revenue_30d_usd}` : '',
    first_name: c.first_name || '',
    last_name: c.last_name || '',
    title: c.title || '',
    email: c.email,
    email_verification: c.verification,
    email_confidence: ec.score,
    email_confidence_band: band(ec.score),
    email_confidence_why: ec.why,
    how_found: HOW(c.email_source),
    check_linkedin: c.linkedin || l.search_people?.[0]?.linkedin || '',
    teardown_confidence: tc.score,
    teardown_confidence_band: band(tc.score),
    teardown_confidence_why: tc.why,
    subject: s.subject || '',
    subject_alt: s.subject_alt || '',
    email_body: greetingFix(s.email_body),
    followup_body: greetingFix(s.followup_body),
    finding_1: s.finding_1 || '',
    finding_2: s.finding_2 || '',
    finding_3: s.finding_3 || '',
    screenshots: s.screenshots || '',
  };
});
rows.sort((a, b) => a.send_group.localeCompare(b.send_group) || b.overall - a.overall);
rows.forEach((r, i) => (r.n = i + 1));

// Colours: green = high, amber = medium, red = low; group 1 green tint, group 2 amber tint.
const FILL = { High: 'FFC6EFCE', Medium: 'FFFFEB9C', Low: 'FFFFC7CE' };
const FONT = { High: 'FF006100', Medium: 'FF9C5700', Low: 'FF9C0006' };
const GROUP = { '1': 'FFE2F0D9', '2': 'FFFFF2CC' };
const scoreBand = (v) => band(Number(v));

const COLS = [
  ['n', 4], ['send_group', 13], ['overall', 8], ['company', 22], ['website', 28], ['lead_source', 20], ['vibe_verdict', 14], ['fit_score', 8], ['revenue_30d', 10],
  ['first_name', 12], ['last_name', 14], ['title', 18], ['email', 30], ['email_verification', 12],
  ['email_confidence', 10], ['email_confidence_band', 10], ['email_confidence_why', 40], ['how_found', 34], ['check_linkedin', 28],
  ['teardown_confidence', 10], ['teardown_confidence_band', 10], ['teardown_confidence_why', 34],
  ['subject', 34], ['subject_alt', 30], ['email_body', 90], ['followup_body', 60], ['finding_1', 50], ['finding_2', 50], ['finding_3', 50], ['screenshots', 40],
];
const wb = new ExcelJS.Workbook();
const header = (ws) => {
  const r = ws.getRow(1);
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  r.alignment = { vertical: 'middle', wrapText: true };
  r.height = 32;
};
const add = (name, list) => {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, xSplit: 4 }] });
  ws.columns = COLS.map(([key, width]) => ({ header: key.replace(/_/g, ' '), key, width }));
  header(ws);
  for (const r of list) {
    const row = ws.addRow(r);
    row.alignment = { wrapText: true, vertical: 'top' };
    row.getCell('send_group').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP[r.send_group[0]] } };
    for (const k of ['overall', 'email_confidence', 'email_confidence_band', 'teardown_confidence', 'teardown_confidence_band']) {
      const b = k.endsWith('band') ? r[k] : scoreBand(r[k]);
      const cell = row.getCell(k);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[b] } };
      cell.font = { bold: true, color: { argb: FONT[b] } };
      cell.alignment = { horizontal: 'center', vertical: 'top' };
    }
    const v = row.getCell('vibe_verdict');
    if (/vibe/.test(r.vibe_verdict)) v.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    if (r.check_linkedin) row.getCell('check_linkedin').value = { text: r.check_linkedin, hyperlink: r.check_linkedin };
    row.getCell('website').value = { text: r.website, hyperlink: r.website };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } };
  return ws;
};

// Summary first, so the workbook opens on it.
if (summary) {
  const ws = wb.addWorksheet('Summary');
  ws.columns = [{ width: 46 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 50 }];
  let r = 1;
  const title = (text) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = text;
    row.font = { bold: true, size: 13, color: { argb: 'FF1F3864' } };
    r++;
  };
  const table = (head, body, { highlightLast = false } = {}) => {
    const h = ws.getRow(r++);
    head.forEach((v, i) => (h.getCell(i + 1).value = v));
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.forEach((_, i) => (h.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }));
    body.forEach((vals, j) => {
      const row = ws.getRow(r++);
      vals.forEach((v, i) => (row.getCell(i + 1).value = v));
      row.alignment = { wrapText: true, vertical: 'top' };
      if (j % 2) vals.forEach((_, i) => (row.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }));
      if (highlightLast && j === body.length - 1) row.font = { bold: true };
    });
    r++;
  };
  title(summary.title);
  for (const t of summary.tables) {
    title(t.title);
    table(t.head, t.rows, { highlightLast: t.highlightLast });
  }
  title('Colour key');
  table(['Band', 'Score', 'Meaning'], [['High', '80-100', 'send with the batch'], ['Medium', '55-79', 'send, watch bounces and replies'], ['Low', 'under 55', 'check by hand before sending']]);
  const keyStart = r - 4;
  ['High', 'Medium', 'Low'].forEach((b, i) => {
    const cell = ws.getRow(keyStart + i).getCell(1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[b] } };
    cell.font = { bold: true, color: { argb: FONT[b] } };
  });
}
add('All 40', rows);
add('Group 1 - verified', rows.filter((r) => r.send_group.startsWith('1')));
add('Group 2 - catch-all', rows.filter((r) => r.send_group.startsWith('2')));
const notes = wb.addWorksheet('How scores work');
notes.columns = [{ header: 'How to read this workbook', key: 'a', width: 130 }];
header(notes);
for (const line of [
  'overall = 60% email confidence + 40% teardown confidence. Rows are sorted by send group, then overall.',
  'Email confidence: starts at 85 for a verified mailbox, 55 for a catch-all server; +10 if they published the address themselves, +5 if the name comes from their own TrustMRR listing, -10 if the name was found by Google search (open check_linkedin first), -15 if the address is on a different domain from the product.',
  'Teardown confidence: 35 + 12 per finding used in the email (max 3) + 15 if a person looked at the screenshots + 5 if 3 or more screens were captured.',
  'Group 1 (verified): the mail server confirmed the mailbox. Expected bounces under 2%.',
  'Group 2 (catch-all): the server accepts any address, so it cannot be confirmed in advance. Most are solo founders forwarding all mail to themselves. Send as a separate small batch and stop if bounces pass 3%.',
  'Not included on purpose: shared inboxes (info@, support@...), German/Austrian companies (no cold email under UWG), and matches a person rejected.',
  'Every email needs your sender details and an opt-out line in SalesHandy.',
]) notes.addRow({ a: line }).alignment = { wrapText: true };
// Workbook opens on the first sheet: put Summary first when present.
const xlsx = path.join(dir, 'batch-40.xlsx');
await wb.xlsx.writeFile(xlsx);

const csvCols = ['Email', 'First Name', 'Last Name', 'Company', 'Website', 'subject', 'subject_alt', 'email_body', 'followup_body', 'email_verification', 'email_confidence', 'teardown_confidence', 'send_group'];
const toRow = (r) => [r.email, r.first_name, r.last_name, r.company, r.website, r.subject, r.subject_alt, r.email_body, r.followup_body, r.email_verification, r.email_confidence, r.teardown_confidence, r.send_group];
writeFileSync(path.join(dir, 'saleshandy-group1-verified.csv'), toCsvRows(csvCols, rows.filter((r) => r.send_group.startsWith('1')).map(toRow)));
writeFileSync(path.join(dir, 'saleshandy-group2-catchall.csv'), toCsvRows(csvCols, rows.filter((r) => r.send_group.startsWith('2')).map(toRow)));
writeFileSync(path.join(dir, 'batch-40-rows.json'), JSON.stringify(rows, null, 2));
const by = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
console.log(`wrote ${xlsx}: ${rows.length} rows; email confidence ${JSON.stringify(by('email_confidence_band'))}; teardown confidence ${JSON.stringify(by('teardown_confidence_band'))}`);
