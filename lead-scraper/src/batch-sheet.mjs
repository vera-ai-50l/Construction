#!/usr/bin/env node
// One sheet for a sending batch: every lead with its contact, how the address was
// found and verified, and the teardown email. Group 1 = verified "ok" (send first),
// group 2 = catch-all (send separately, small, watch bounces).
//   node src/batch-sheet.mjs out/batch-40
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { toCsvRows } from './teardown/csv.mjs';

const dir = path.resolve(process.argv[2] || 'out/batch-40');
const leads = JSON.parse(readFileSync(path.join(dir, 'leads.json'), 'utf8'));
const teardowns = new Map(JSON.parse(readFileSync(path.join(dir, 'teardowns.json'), 'utf8')).map((t) => [t.domain, t]));

const HOW = (src = '') =>
  /google \(LinkedIn/.test(src) ? 'Name from Google (LinkedIn result title), email = pattern guess'
  : /trustmrr/.test(src) ? 'Name from TrustMRR founder listing, email = pattern guess'
  : /hn profile/.test(src) ? 'Published by the maker on their Hacker News profile'
  : /^pattern/.test(src) ? 'Name from the company website, email = pattern guess'
  : /company site/.test(src) ? 'Published on the company website'
  : src;
const SOURCE = { trustmrr: 'TrustMRR (verified revenue)', commoncrawl: 'Common Crawl (Lovable-hosted app)', showhn: 'Hacker News Show HN', 'google-footprint': 'Google (builder footprint)' };

const rows = leads.map((l, i) => {
  const t = teardowns.get(l.domain);
  const s = t?.send_row || {};
  const c = l.contact;
  const greetingFix = (body) => (body || '').replace(/^Hi [^,\n]+ team,/, c.first_name ? `Hi ${c.first_name},` : 'Hi there,');
  return {
    n: i + 1,
    send_group: c.verification === 'ok' ? '1 - verified' : '2 - catch-all',
    company: l.name,
    website: l.site?.fetched_url || l.website,
    lead_source: SOURCE[l.sources[0]] || l.sources[0],
    vibe_verdict: l.vibe?.verdict || '',
    revenue_30d: l.trustmrr?.revenue_30d_usd ? `$${l.trustmrr.revenue_30d_usd}` : '',
    first_name: c.first_name || '',
    last_name: c.last_name || '',
    title: c.title || '',
    email: c.email,
    email_verification: c.verification,
    how_found: HOW(c.email_source),
    check_linkedin: c.linkedin || l.search_people?.[0]?.linkedin || '',
    subject: s.subject || '',
    subject_alt: s.subject_alt || '',
    email_body: greetingFix(s.email_body),
    followup_body: greetingFix(s.followup_body),
    finding_1: s.finding_1 || '',
    finding_2: s.finding_2 || '',
    finding_3: s.finding_3 || '',
    teardown_status: s.status || 'no teardown',
    screenshots: s.screenshots || '',
  };
});

const COLS = [
  ['n', 4], ['send_group', 13], ['company', 22], ['website', 30], ['lead_source', 22], ['vibe_verdict', 14], ['revenue_30d', 10],
  ['first_name', 12], ['last_name', 14], ['title', 18], ['email', 30], ['email_verification', 12], ['how_found', 36], ['check_linkedin', 30],
  ['subject', 34], ['subject_alt', 30], ['email_body', 80], ['followup_body', 60], ['finding_1', 50], ['finding_2', 50], ['finding_3', 50],
  ['teardown_status', 12], ['screenshots', 40],
];
const wb = new ExcelJS.Workbook();
const add = (name, list) => {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }] });
  ws.columns = COLS.map(([key, width]) => ({ header: key, key, width }));
  ws.getRow(1).font = { bold: true };
  for (const r of list) ws.addRow(r);
  ws.eachRow((row, i) => i > 1 && (row.alignment = { wrapText: true, vertical: 'top' }));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } };
};
add('All 40', rows);
add('Group 1 - verified', rows.filter((r) => r.send_group.startsWith('1')));
add('Group 2 - catch-all', rows.filter((r) => r.send_group.startsWith('2')));
const notes = wb.addWorksheet('Read me');
notes.columns = [{ header: 'How to use this sheet', key: 'a', width: 120 }];
for (const line of [
  'Group 1 (verified): the mail server confirmed the address exists. Expected bounce rate under 2%.',
  'Group 2 (catch-all): the server accepts any address, so it cannot be confirmed in advance. Most are solo founders forwarding all mail to themselves. Send as a separate small batch and stop if bounces pass 3%.',
  'how_found: every address is either published by the company/maker, or a first-name guess on the company domain built from a real name, then verified.',
  'check_linkedin: names found through Google search. Open the profile and confirm the person runs this company before sending (one wrong match was already removed).',
  'Not included on purpose: shared inboxes (info@, support@...), German/Austrian companies (no cold email under UWG), and matches a person rejected.',
  'Every email needs your sender details and an opt-out line in SalesHandy (CAN-SPAM, GDPR B2B).',
]) notes.addRow({ a: line });
const xlsx = path.join(dir, 'batch-40.xlsx');
await wb.xlsx.writeFile(xlsx);

const csvCols = ['Email', 'First Name', 'Last Name', 'Company', 'Website', 'subject', 'subject_alt', 'email_body', 'followup_body', 'email_verification', 'send_group'];
const toRow = (r) => [r.email, r.first_name, r.last_name, r.company, r.website, r.subject, r.subject_alt, r.email_body, r.followup_body, r.email_verification, r.send_group];
writeFileSync(path.join(dir, 'saleshandy-group1-verified.csv'), toCsvRows(csvCols, rows.filter((r) => r.send_group.startsWith('1')).map(toRow)));
writeFileSync(path.join(dir, 'saleshandy-group2-catchall.csv'), toCsvRows(csvCols, rows.filter((r) => r.send_group.startsWith('2')).map(toRow)));
console.log(`wrote ${xlsx} (${rows.length} rows; ${rows.filter((r) => r.teardown_status === 'no teardown').length} without a teardown)`);
