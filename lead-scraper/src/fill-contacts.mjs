#!/usr/bin/env node
// Second pass on leads that ended a run without a named contact: read the company
// site behind builder-hosted apps, search for the founder's name, guess, verify.
//   node src/fill-contacts.mjs --out out/gap-fill out/run-a out/run-b
import path from 'node:path';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { findContacts, mailDomain } from './enrich/contacts.mjs';
import { isRoleMailbox } from './enrich/site.mjs';
import { snapshot } from './ledger.mjs';

const { values: args, positionals: dirs } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    'vibe-only': { type: 'boolean', default: true },
    all: { type: 'boolean', default: false },
    only: { type: 'string', default: '' },
    verifier: { type: 'string', default: 'bounceverify' },
    'max-candidates': { type: 'string', default: '2' },
    'in-place': { type: 'boolean', default: false },
    finder: { type: 'string', default: 'none' },
  },
});
const log = (...m) => console.error(`[${new Date().toISOString().slice(11, 19)}]`, ...m);
const byDomain = new Map();
for (const d of dirs) {
  const f = path.join(d, 'leads.json');
  if (!existsSync(f)) continue;
  for (const l of JSON.parse(readFileSync(f, 'utf8'))) {
    const hasPerson = l.contact?.email && !isRoleMailbox(l.contact.email) && ['ok', 'catch_all'].includes(l.contact.verification);
    const only = args.only ? args.only.split(',').map((x) => x.trim()) : null;
    if (only ? !only.includes(l.domain) : hasPerson || !l.site?.reachable) continue;
    if (args['vibe-only'] && !args.all && !/vibe/.test(l.vibe?.verdict || '')) continue;
    // Names found by an earlier search are looked up again with today's rules.
    if (!byDomain.has(l.domain)) byDomain.set(l.domain, { ...l, search_people: undefined, filled_from: l.filled_from || path.basename(d) });
  }
}
const gap = [...byDomain.values()];
log(`${gap.length} vibe-coded leads without a named contact`);
await findContacts(gap, { finder: args.finder, verifier: args.verifier, maxCandidates: Number(args['max-candidates']), nameSearch: true, log });

const stat = (f) => gap.filter(f).length;
const rows = [
  ['Vibe-coded, no named contact', gap.length],
  ['Company mail domain known', stat((l) => mailDomain(l))],
  ['Company site read (builder-hosted apps)', stat((l) => l.company_site?.reachable)],
  ['Named via Google (LinkedIn titles)', stat((l) => l.search_people?.length)],
  ['Named person known (any source)', stat((l) => l.contact_people > 0)],
  ['Email candidate checked', stat((l) => (l.contact_trail || []).length)],
  ['Verified ok', stat((l) => l.contact?.verification === 'ok' && !isRoleMailbox(l.contact.email))],
  ['Catch-all', stat((l) => l.contact?.verification === 'catch_all' && !isRoleMailbox(l.contact.email))],
];
const led = snapshot();
const md = [
  '| Step | Leads |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${v} |`), '',
  '| Paid tool | Units | Cost |', '| --- | --- | --- |',
  ...Object.entries(led.costs).map(([t, c]) => `| ${t} | ${c.units} | $${c.usd.toFixed(4)} |`),
  `| **Total** | | **$${led.total_usd.toFixed(4)}** |`,
].join('\n');
mkdirSync(args.out, { recursive: true });
writeFileSync(path.join(args.out, 'leads.json'), JSON.stringify(gap, null, 2));
writeFileSync(path.join(args.out, 'funnel.md'), md);
// --in-place: put the new contacts back into the source run (one folder).
if (args['in-place'] && dirs.length === 1) {
  const f = path.join(dirs[0], 'leads.json');
  const byD = new Map(gap.map((l) => [l.domain, l]));
  const merged = JSON.parse(readFileSync(f, 'utf8')).map((l) => byD.get(l.domain) || l);
  writeFileSync(f, JSON.stringify(merged, null, 2));
  log(`updated ${f}`);
}
console.error('\n' + md);
