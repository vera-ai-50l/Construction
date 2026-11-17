#!/usr/bin/env node
// Colour-coded workbook of scored leads (no teardowns): fit score, contact, email
// confidence and remarks for the next step. Works for any run folder (Type A, B or C).
//   node src/lead-sheet.mjs out/<run> [--title "Type B"] [--top 50]
import path from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import ExcelJS from 'exceljs';
import { toCsvRows } from './teardown/csv.mjs';
import { emailConfidence } from './confidence.mjs';
import { remarks } from './remarks.mjs';
import { isRoleMailbox } from './enrich/site.mjs';

const { values: args, positionals } = parseArgs({ allowPositionals: true, options: { title: { type: 'string' }, top: { type: 'string' }, exclude: { type: 'string' } } });
const dir = path.resolve(positionals[0] || 'out');
const all = JSON.parse(readFileSync(path.join(dir, 'leads.json'), 'utf8'));
const funnel = existsSync(path.join(dir, 'funnel.json')) ? JSON.parse(readFileSync(path.join(dir, 'funnel.json'), 'utf8')) : null;

const HOW = (src = '') =>
  /google \(LinkedIn/.test(src) ? 'Name from Google (LinkedIn title), email = pattern guess'
  : /^finder:/.test(src) ? `Contact database (${src.slice(7)})`
  : /trustmrr/.test(src) ? 'Name from TrustMRR, email = pattern guess'
  : /hn profile/.test(src) ? 'Published on the maker\'s HN profile'
  : /policy page/.test(src) ? 'Published on the store\'s policy or contact page'
  : /^pattern/.test(src) ? 'Name from the company website, email = pattern guess'
  : /company site/.test(src) ? 'Published on the company website'
  : src;
const band = (s) => (s >= 80 ? 'High' : s >= 55 ? 'Medium' : 'Low');
// Fit band is relative to this list (ICPs score on different scales): top quarter High,
// middle half Medium, bottom quarter Low.
let fitBand = (s) => (s >= 70 ? 'High' : s >= 55 ? 'Medium' : 'Low');

const personal = (l) => l.contact?.email && !isRoleMailbox(l.contact.email) && ['ok', 'catch_all'].includes(l.contact.verification);
// Companies delivered in earlier runs are left out (pipeline state).
const seen = new Set(args.exclude && existsSync(args.exclude) ? JSON.parse(readFileSync(args.exclude, 'utf8')) : []);
let leads = all.filter((l) => l.site?.reachable && !seen.has(l.domain));
leads.sort((a, b) => Number(!!personal(b)) - Number(!!personal(a)) || b.score.total - a.score.total);
// --top N: verified mailboxes first, then catch-alls, then leads without a named email
// (each by fit score); the sheet itself is sorted by fit score.
if (args.top) {
  // German/Austrian companies cannot get cold email: last.
  const tier = (l) => (/\.(de|at)$/.test(l.mail_domain || l.domain) ? 3 : personal(l) ? (l.contact.verification === 'ok' ? 0 : 1) : 2);
  leads = [...leads].sort((a, b) => tier(a) - tier(b) || b.score.total - a.score.total).slice(0, Number(args.top));
  leads.sort((a, b) => Number(!!personal(b)) - Number(!!personal(a)) || b.score.total - a.score.total);
}

{
  const sorted = leads.map((l) => l.score.total).sort((a, b) => b - a);
  const hi = sorted[Math.max(0, Math.ceil(sorted.length * 0.25) - 1)] ?? 0;
  const lo = sorted[Math.max(0, Math.ceil(sorted.length * 0.75) - 1)] ?? 0;
  fitBand = (s) => (s >= hi ? 'High' : s >= lo ? 'Medium' : 'Low');
}
const rows = leads.map((l, i) => {
  const c = personal(l) ? l.contact : null;
  const ec = c ? emailConfidence(l) : null;
  const shared = (l.emails || l.site.emails || []).find((e) => isRoleMailbox(e.email));
  return {
    n: i + 1,
    priority: l.score.priority,
    fit_score: l.score.total,
    fit_band: fitBand(l.score.total),
    company: l.name,
    domain: l.domain,
    website: l.site.fetched_url || l.website,
    type: { vibe: 'A', type_a: 'A', type_b: 'B', type_c: 'C' }[l.profile] || l.profile,
    source: l.sources.join(', '),
    login_required: l.product_access?.login_required || (l.store ? 'no' : ''),
    product_access: l.product_access?.detail || l.access?.evidence || '',
    first_name: c?.first_name || '',
    last_name: c?.last_name || '',
    title: c?.title || '',
    email: c?.email || '',
    email_verification: c?.verification || (shared ? 'shared inbox only' : 'none'),
    email_confidence: ec?.score ?? '',
    email_confidence_band: ec ? band(ec.score) : '',
    how_found: c ? HOW(c.email_source) : '',
    check_linkedin: c?.linkedin || l.search_people?.[0]?.linkedin || '',
    remarks: remarks(l).join('\n'),
    score_parts: Object.entries(l.score.parts).map(([k, v]) => `${k} ${v}`).join(', '),
    one_liner: (l.description || l.site.meta_description || '').slice(0, 200),
  };
});

const FILL = { High: 'FFC6EFCE', Medium: 'FFFFEB9C', Low: 'FFFFC7CE' };
const FONT = { High: 'FF006100', Medium: 'FF9C5700', Low: 'FF9C0006' };
const LOGIN = { no: 'FFC6EFCE', yes: 'FFFFEB9C', unknown: 'FFEDEDED' };
const COLS = [
  ['n', 4], ['priority', 8], ['fit_score', 8], ['fit_band', 8], ['company', 22], ['website', 28], ['type', 6], ['source', 14],
  ['login_required', 10], ['product_access', 34], ['first_name', 12], ['last_name', 14], ['title', 18], ['email', 30], ['email_verification', 14],
  ['email_confidence', 10], ['email_confidence_band', 10], ['how_found', 30], ['check_linkedin', 28], ['remarks', 70], ['score_parts', 34], ['one_liner', 50],
];
const wb = new ExcelJS.Workbook();
const header = (ws) => {
  const r = ws.getRow(1);
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  r.alignment = { vertical: 'middle', wrapText: true };
  r.height = 30;
};
const paint = (cell, b, fills = FILL) => {
  if (!b || !fills[b]) return;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fills[b] } };
  if (FONT[b]) cell.font = { bold: true, color: { argb: FONT[b] } };
  cell.alignment = { horizontal: 'center', vertical: 'top' };
};

// Summary sheet: the run's funnel and costs.
if (funnel) {
  const ws = wb.addWorksheet('Summary');
  ws.columns = [{ width: 44 }, { width: 46 }, ...funnel.rows.map(() => ({ width: 14 })), { width: 12 }];
  let r = 1;
  ws.getRow(r++).getCell(1).value = `${args.title || 'Leads'}: funnel and cost`;
  ws.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF1F3864' } };
  r++;
  const head = ['Step', 'Tool', ...funnel.rows.map((x) => x.source), 'All'];
  const h = ws.getRow(r++);
  head.forEach((v, i) => (h.getCell(i + 1).value = v));
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.forEach((_, i) => (h.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }));
  for (const st of funnel.steps || []) {
    const row = ws.getRow(r++);
    [st.label, st.tool, ...funnel.rows.map((x) => x[st.key] ?? ''), funnel.total[st.key] ?? ''].forEach((v, i) => (row.getCell(i + 1).value = v));
    row.alignment = { wrapText: true, vertical: 'top' };
  }
  r++;
  const ch = ws.getRow(r++);
  ['Paid tool', 'Units', 'Cost'].forEach((v, i) => (ch.getCell(i + 1).value = v));
  ch.font = { bold: true };
  for (const [tool, c] of Object.entries(funnel.ledger.costs)) {
    const row = ws.getRow(r++);
    [tool, `${c.units} ${c.unit}s`, `$${c.usd.toFixed(4)}`].forEach((v, i) => (row.getCell(i + 1).value = v));
  }
  const tot = ws.getRow(r++);
  ['Total', '', `$${funnel.ledger.total_usd.toFixed(4)}`].forEach((v, i) => (tot.getCell(i + 1).value = v));
  tot.font = { bold: true };
}

const add = (name, list) => {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, xSplit: 5 }] });
  ws.columns = COLS.map(([key, width]) => ({ header: key.replace(/_/g, ' '), key, width }));
  header(ws);
  for (const r of list) {
    const row = ws.addRow(r);
    row.alignment = { wrapText: true, vertical: 'top' };
    paint(row.getCell('fit_score'), fitBand(r.fit_score));
    paint(row.getCell('fit_band'), r.fit_band);
    paint(row.getCell('email_confidence'), r.email_confidence_band);
    paint(row.getCell('email_confidence_band'), r.email_confidence_band);
    if (r.login_required) paint(row.getCell('login_required'), r.login_required, LOGIN);
    row.getCell('website').value = { text: r.website, hyperlink: r.website };
    if (r.check_linkedin) row.getCell('check_linkedin').value = { text: r.check_linkedin, hyperlink: r.check_linkedin };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } };
};
add('All leads', rows);
add('Named email', rows.filter((r) => r.email));
add('Needs a contact', rows.filter((r) => !r.email));
const notes = wb.addWorksheet('How to read');
notes.columns = [{ header: 'How to read this workbook', key: 'a', width: 130 }];
header(notes);
for (const line of [
  'fit score (0-100): access to the product, room for redesign, ability to pay, reachability, timing and ICP fit. Colours rank leads within this list: green = top quarter, amber = middle half, red = bottom quarter. score parts shows where the points came from.',
  'login required: green = no (public demo or sandbox), amber = yes (self-serve sign-up, work email, waitlist or sales-gated: see product access), grey = could not tell.',
  'email confidence (0-100): 85 for a verified mailbox, 55 for a catch-all server; +10 if they published it, +5 if the name is from their own listing, -10 if the name came from Google search (check LinkedIn), -15 if the address is on another domain.',
  'remarks: what the next step needs to know (login wall, how to do the teardown, contact caveats, compliance, buying signals).',
  'Shared inboxes (info@, support@...) are never listed as the contact. German/Austrian companies: LinkedIn only.',
]) notes.addRow({ a: line }).alignment = { wrapText: true };

const xlsx = path.join(dir, 'leads-scored.xlsx');
await wb.xlsx.writeFile(xlsx);
writeFileSync(path.join(dir, 'leads-scored.csv'), toCsvRows(COLS.map(([k]) => k), rows.map((r) => COLS.map(([k]) => r[k]))));
writeFileSync(path.join(dir, 'leads-scored.json'), JSON.stringify(rows, null, 2));
const count = (k) => rows.reduce((m, r) => ((m[r[k] || '-'] = (m[r[k] || '-'] || 0) + 1), m), {});
console.log(`wrote ${xlsx}: ${rows.length} leads, ${rows.filter((r) => r.email).length} with a named email; fit ${JSON.stringify(count('fit_band'))}; login ${JSON.stringify(count('login_required'))}`);
