// Excel workbook for review plus a flat CSV for SalesHandy import.
import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toCsvRows } from './csv.mjs';

const SEND_COLS = [
  ['status', 14], ['priority', 8], ['score', 7], ['company', 22], ['website', 28], ['email', 30], ['first_name', 12], ['last_name', 14],
  ['subject', 34], ['subject_alt', 30], ['email_body', 80], ['followup_body', 60], ['finding_1', 50], ['finding_2', 50], ['finding_3', 50],
  ['strength', 40], ['review', 9], ['looks_ai_generated', 30], ['dashboard_visible', 18], ['needs_manual_login', 10], ['login_url', 34], ['profile', 10], ['offer', 16], ['screenshots', 50],
];

const LOGIN_COLS = [
  ['company', 22], ['priority', 8], ['score', 7], ['login_url', 40], ['app_url', 34], ['work_email_required', 12], ['sign_in_options', 18],
  ['what_to_check', 50], ['save_session_command', 70],
];

const FINDING_COLS = [['company', 22], ['screen', 12], ['severity', 9], ['key', 16], ['metric', 26], ['issue', 70], ['impact', 60], ['fix', 60], ['screenshot', 50]];

function sheet(wb, name, cols, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map(([key, width]) => ({ header: key, key, width }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  ws.eachRow((row, i) => {
    if (i > 1) row.alignment = { wrapText: true, vertical: 'top' };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

export async function writeWorkbook(teardowns, outDir) {
  const sendRows = teardowns.map((t) => t.send_row);
  const loginRows = teardowns.filter((t) => t.send_row.needs_manual_login === 'yes').map((t) => t.login_row);
  const findingRows = teardowns.flatMap((t) => t.findings.map((f) => ({ company: t.company, ...f, screenshot: t.shots[f.screen] || '' })));

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  sheet(wb, 'Ready to send', SEND_COLS, sendRows.filter((r) => r.status === 'ready'));
  sheet(wb, 'Needs manual login', LOGIN_COLS, loginRows);
  sheet(wb, 'Needs an email', SEND_COLS, sendRows.filter((r) => r.status === 'needs_email'));
  sheet(wb, 'Review (thin teardown)', SEND_COLS, sendRows.filter((r) => r.status === 'thin'));
  sheet(wb, 'All findings', FINDING_COLS, findingRows);
  const xlsx = path.join(outDir, 'teardowns.xlsx');
  await wb.xlsx.writeFile(xlsx);

  // SalesHandy: one row per prospect; extra columns import as custom fields you can
  // use as merge tags in the sequence (subject, email_body, followup_body).
  const ready = sendRows.filter((r) => r.status === 'ready');
  const csv = path.join(outDir, 'saleshandy.csv');
  await writeFile(
    csv,
    toCsvRows(
      ['Email', 'First Name', 'Last Name', 'Company', 'Website', 'subject', 'email_body', 'followup_body', 'finding_1', 'finding_2', 'finding_3'],
      ready.map((r) => [r.email, r.first_name, r.last_name, r.company, r.website, r.subject, r.email_body, r.followup_body, r.finding_1, r.finding_2, r.finding_3]),
    ),
  );
  return { xlsx, csv, counts: { ready: ready.length, needs_login: loginRows.length, needs_email: sendRows.filter((r) => r.status === 'needs_email').length, thin: sendRows.filter((r) => r.status === 'thin').length } };
}
