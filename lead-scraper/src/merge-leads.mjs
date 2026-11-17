#!/usr/bin/env node
// Merge runs into one sending batch: only leads with a named person's address that
// verified "ok" or sits on a catch-all server, one per company, verified first.
//   node src/merge-leads.mjs --out out/batch-40 --max 40 out/run-a out/run-b ...
import path from 'node:path';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { isRoleMailbox } from './enrich/site.mjs';
import { brandName } from './brand.mjs';

const { values: args, positionals: dirs } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' }, max: { type: 'string', default: '40' }, 'include-catch-all': { type: 'boolean', default: true }, exclude: { type: 'string', default: '' } },
});
// No cold email to German/Austrian companies (UWG §7 / TKG): reach them on LinkedIn.
const NO_COLD_EMAIL = /\.(de|at)$/;
// Domains a person checked and rejected (wrong person matched, persona mailbox...).
const EXCLUDE = new Set(args.exclude.split(',').map((x) => x.trim()).filter(Boolean));
const seen = new Map();
for (const d of dirs) {
  const f = path.join(d, 'leads.json');
  if (!existsSync(f)) continue;
  for (const l of JSON.parse(readFileSync(f, 'utf8'))) {
    const c = l.contact;
    if (!c?.email || isRoleMailbox(c.email)) continue;
    if (!(c.verification === 'ok' || (args['include-catch-all'] && c.verification === 'catch_all'))) continue;
    if (NO_COLD_EMAIL.test(l.mail_domain || l.domain) || EXCLUDE.has(l.domain)) continue;
    // A shared company mailbox on a free provider (acme@yahoo.com) is not a person.
    if (/@(gmail|yahoo|hotmail|outlook|icloud|proton)/.test(c.email) && !/hn profile/.test(c.email_source || '')) continue;
    // "alistairclark@" read as one word: split a known first name off when possible.
    if (c.first_name && /^[A-Z][a-z]{7,}$/.test(c.first_name) && !c.last_name) {
      const m = c.first_name.match(/^(Alistair|Wesley|Andrew|Michael|Daniel|David|Thomas|Robert|Richard|Matthew|Christopher|Jonathan|Nicholas|Benjamin|Samuel|Patrick|Stephen|Charles|Jessica|Jennifer|Stephanie|Elizabeth|Victoria|Caroline|Natalie|Charlotte)([a-z]+)$/i);
      if (m) l.contact = { ...c, first_name: m[1], last_name: m[2][0].toUpperCase() + m[2].slice(1) };
    }
    // A handle used as a first name ("wesley-Alan"): keep the first word, capitalised.
    if (l.contact.first_name && /^[a-z]|[-_]/.test(l.contact.first_name)) {
      const w = l.contact.first_name.split(/[-_\s]/)[0];
      l.contact = { ...l.contact, first_name: w[0].toUpperCase() + w.slice(1).toLowerCase() };
    }
    if (!seen.has(l.domain)) seen.set(l.domain, { ...l, contact: l.contact, batch_from: path.basename(d) });
  }
}
const rank = (l) => (l.contact.verification === 'ok' ? 0 : 2) + (/vibe/.test(l.vibe?.verdict || '') ? 0 : 1);
// Sheet and email names: what the company calls itself (src/brand.mjs).
for (const l of seen.values()) l.name = brandName(l);
// A first name that is really a handle ("Vdanielbit") gets no name in the greeting.
for (const l of seen.values()) if (/@gmail\.com$/.test(l.contact.email) && !l.contact.last_name && /bit|\d/.test(l.contact.first_name)) l.contact = { ...l.contact, first_name: '' };
const picked = [...seen.values()].sort((a, b) => rank(a) - rank(b)).slice(0, Number(args.max));
mkdirSync(args.out, { recursive: true });
writeFileSync(path.join(args.out, 'leads.json'), JSON.stringify(picked, null, 2));
console.log(`${seen.size} usable named contacts; wrote ${picked.length} (${picked.filter((l) => l.contact.verification === 'ok').length} ok, ${picked.filter((l) => l.contact.verification === 'catch_all').length} catch-all)`);
