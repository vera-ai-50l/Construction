#!/usr/bin/env node
// Merge runs into one sending batch: only leads with a named person's address that
// verified "ok" or sits on a catch-all server, one per company, verified first.
//   node src/merge-leads.mjs --out out/batch-40 --max 40 out/run-a out/run-b ...
import path from 'node:path';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { isRoleMailbox } from './enrich/site.mjs';

const { values: args, positionals: dirs } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' }, max: { type: 'string', default: '40' }, 'include-catch-all': { type: 'boolean', default: true } },
});
// No cold email to German/Austrian companies (UWG §7 / TKG): reach them on LinkedIn.
const NO_COLD_EMAIL = /\.(de|at)$/;
const seen = new Map();
for (const d of dirs) {
  const f = path.join(d, 'leads.json');
  if (!existsSync(f)) continue;
  for (const l of JSON.parse(readFileSync(f, 'utf8'))) {
    const c = l.contact;
    if (!c?.email || isRoleMailbox(c.email)) continue;
    if (!(c.verification === 'ok' || (args['include-catch-all'] && c.verification === 'catch_all'))) continue;
    if (NO_COLD_EMAIL.test(l.mail_domain || l.domain)) continue;
    if (!seen.has(l.domain)) seen.set(l.domain, { ...l, batch_from: path.basename(d) });
  }
}
const rank = (l) => (l.contact.verification === 'ok' ? 0 : 2) + (/vibe/.test(l.vibe?.verdict || '') ? 0 : 1);
const picked = [...seen.values()].sort((a, b) => rank(a) - rank(b)).slice(0, Number(args.max));
mkdirSync(args.out, { recursive: true });
writeFileSync(path.join(args.out, 'leads.json'), JSON.stringify(picked, null, 2));
console.log(`${seen.size} usable named contacts; wrote ${picked.length} (${picked.filter((l) => l.contact.verification === 'ok').length} ok, ${picked.filter((l) => l.contact.verification === 'catch_all').length} catch-all)`);
