#!/usr/bin/env node
// Plan the next send: who was already sent (SalesHandy export), which prepared emails are
// still unsent (ready now), and which login-queue leads to sign up to so the day reaches
// its target. Writes a workbook plus a SalesHandy CSV of the ready rows.
//   node src/tomorrow-sheet.mjs --sent <saleshandy export.csv> --prepared <final.csv> --target 40 --out out/send-2026-11-19
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import ExcelJS from 'exceljs';
import { parseCsv } from './sources/seed.mjs';
import { toCsvRows } from './teardown/csv.mjs';

const { values: a } = parseArgs({ options: { sent: { type: 'string' }, prepared: { type: 'string' }, queue: { type: 'string', default: 'out/login-queue/login-queue.csv' }, target: { type: 'string', default: '40' }, reserve: { type: 'string', default: '12' }, out: { type: 'string' } } });
// Header names to snake_case ("First Name" -> first_name).
const read = (f) =>
  parseCsv(readFileSync(f, 'utf8').replace(/^﻿/, '')).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/\s+/g, '_'), v])));
const sent = read(a.sent).filter((r) => r.email);
const sentSet = new Set(sent.map((r) => r.email.toLowerCase()));
const preparedRaw = readFileSync(a.prepared, 'utf8').replace(/^﻿/, '');
const prepared = read(a.prepared);
const ready = prepared.filter((r) => !sentSet.has(String(r.email).toLowerCase()));
const preparedSet = new Set(prepared.map((r) => String(r.email).toLowerCase()));
const queue = read(a.queue).filter((r) => !sentSet.has(r.email.toLowerCase()) && !preparedSet.has(r.email.toLowerCase()));

// Who to log in to: verified first, free sign-up before work email, newer lists before the old YC list, then fit.
const LIST_RANK = { 'B: non-YC SaaS (funding news + job boards)': 0, 'B: hiring a designer (job posts)': 0, 'A: AI-built apps (batch of 40)': 1, 'B: YC (older list)': 2 };
queue.sort((x, y) => (x.verification === 'ok' ? 0 : 1) - (y.verification === 'ok' ? 0 : 1) || (x.way_in === 'free sign-up' ? 0 : 1) - (y.way_in === 'free sign-up' ? 0 : 1) || (LIST_RANK[x.list] ?? 3) - (LIST_RANK[y.list] ?? 3) || Number(y.fit_score || 0) - Number(x.fit_score || 0));
const need = Math.max(0, Number(a.target) - ready.length);
const login = queue.slice(0, need);
const reserve = queue.slice(need, need + Number(a.reserve));

const wb = new ExcelJS.Workbook();
const HEAD = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } } };
const sheet = (name, cols, rows, paint) => {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map(([key, width]) => ({ header: key.replace(/_/g, ' '), key, width }));
  Object.assign(ws.getRow(1), HEAD);
  for (const r of rows) {
    const row = ws.addRow(r);
    row.alignment = { wrapText: true, vertical: 'top' };
    paint?.(row, r);
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
};
const sum = wb.addWorksheet('Plan');
sum.columns = [{ width: 52 }, { width: 12 }, { width: 70 }];
const lines = [
  ['Sent so far (SalesHandy export)', sent.length, `${sent.filter((r) => /replied/i.test(r.status)).length} replied: ${sent.filter((r) => /replied/i.test(r.status)).map((r) => `${r.email} (${r.outcome || 'reply'})`).join(', ')}`],
  ['Prepared emails not sent yet: ready, no login needed', ready.length, 'Tab "1 Ready to send": same columns as your SalesHandy file'],
  [`Log in today to reach ${a.target}`, login.length, 'Tab "2 Log in today": sign up, save the session, then I write the teardown'],
  ['Reserve (if a sign-up fails or asks for a card)', reserve.length, 'Tab "3 Reserve"'],
  [`Tomorrow's total`, ready.length + login.length, `${ready.length} ready + ${login.length} after login`],
];
lines.forEach((l, i) => {
  const row = sum.getRow(i + 1);
  l.forEach((v, j) => (row.getCell(j + 1).value = v));
  row.alignment = { wrapText: true, vertical: 'top' };
  if (i === lines.length - 1) row.font = { bold: true };
});
sheet('1 Ready to send', [['email', 30], ['first_name', 12], ['company', 22], ['send_group', 13], ['email_confidence', 10], ['lead_finding_from', 18], ['subject', 40]], ready.map((r) => ({ ...r })));
const LOGIN_COLS = [['n', 4], ['done', 8], ['list', 26], ['company', 20], ['website', 28], ['way_in', 14], ['sign_up_url', 34], ['contact', 18], ['email', 30], ['verification', 11], ['fit_score', 8], ['what_to_check', 40], ['save_session', 56]];
const paint = (row, r) => {
  row.getCell('verification').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.verification === 'ok' ? 'FFC6EFCE' : 'FFFFEB9C' } };
  row.getCell('way_in').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: /free/.test(r.way_in) ? 'FFC6EFCE' : 'FFFFEB9C' } };
  if (r.sign_up_url) row.getCell('sign_up_url').value = { text: r.sign_up_url, hyperlink: r.sign_up_url };
};
sheet('2 Log in today', LOGIN_COLS, login.map((r, i) => ({ ...r, n: i + 1 })), paint);
sheet('3 Reserve', LOGIN_COLS, reserve.map((r, i) => ({ ...r, n: i + 1 })), paint);
sheet('Already sent', [['email', 30], ['first_name', 12], ['company', 22], ['status', 10], ['outcome', 12], ['last_activity_time', 22]], sent);

mkdirSync(a.out, { recursive: true });
await wb.xlsx.writeFile(path.join(a.out, 'send-plan.xlsx'));
// SalesHandy CSV of the ready rows, in the prepared file's own column order.
const header = preparedRaw.split(/\r?\n/)[0].split(',');
const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
writeFileSync(path.join(a.out, 'saleshandy-ready.csv'), toCsvRows(header, ready.map((r) => keys.map((k) => r[k] ?? ''))));
console.log(`sent ${sent.length}; ready ${ready.length}; log in ${login.length}; reserve ${reserve.length} -> ${a.out}`);
