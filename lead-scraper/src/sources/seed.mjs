// Source: a hand-made CSV (name,website,icp,notes). Use it for companies found in
// funding news, the research report, Product Hunt, referrals, etc.
import { readFile } from 'node:fs/promises';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || '').trim()])));
}

export async function seedCsv(file) {
  const rows = parseCsv(await readFile(file, 'utf8'));
  return rows
    .filter((r) => r.website)
    .map((r) => ({
      name: r.name || r.website,
      website: r.website,
      source: 'seed',
      source_url: file,
      description: r.notes || '',
      seed_icp: r.icp || '',
    }));
}
