// The Kyre Send Desk (a private claude.ai Artifact page with a small database) is where the
// day's emails wait for the founder's Approve / Skip, and where the scheduled cloud session
// keeps its memory (fresh cloud sessions start with an empty out/ folder).
//
// This module only converts between our files and desk documents. The scheduled session
// moves them with its ArtifactData tool:
//   write:  ArtifactData batch, entries {op:"set", collection, doc_id, file_path}
//           (from out/daily/<date>/desk/writes-N.json, at most 50 per batch)
//   read:   ArtifactData list/query with out_dir -> <out_dir>/<collection>/<doc_id>.json
//
// Collections (every write creates a new document, so no versions are ever needed):
//   queue/<date>_<email>     one email: lead, subject, body, follow-ups, status
//                            (the page sets status pending / approved / skipped)
//   pushed/<date>_<email>    written after it went to SalesHandy (the page shows "In SalesHandy")
//   logins/<date>_<domain>   a product to sign up to before its teardown can be written
//   runs/<date>-<stage>      one line per run, shown at the top of the page
//   ledger/pushed-<stamp>    who went to SalesHandy (rebuilds out/state/pushed.json)
//   ledger/state-<preset>-<date>  the pipeline's "already delivered" memory per list
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';

export const DESK_URL = 'https://claude.ai/artifact/WSfefMB9SqtLMbG9pyp5bi';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_.@+-]+/g, '-').slice(0, 150);
export const queueId = (date, email) => `${date}_${slug(email)}`;
export const loginId = (date, domain) => `${date}_${slug(domain)}`;

const QUEUE_FIELDS = ['date', 'list', 'list_name', 'company', 'website', 'domain', 'email', 'first_name', 'last_name', 'title', 'send_group', 'email_verification', 'email_confidence', 'lead_finding_from', 'subject', 'subject_alt', 'email_body', 'followup_1', 'followup_2', 'findings', 'source'];

/** A prepared email row -> queue document (status pending). */
export function queueDoc(r, date) {
  const d = { status: 'pending', created_at: new Date().toISOString() };
  for (const k of QUEUE_FIELDS) d[k] = r[k] ?? '';
  d.date = date;
  d.email = String(d.email).toLowerCase().trim();
  d.email_confidence = Number(d.email_confidence) || 0;
  return d;
}

/** Write documents as one JSON file each plus batch manifests of at most 50 writes. */
export function writeDocs(dir, docs) {
  rmSync(dir, { recursive: true, force: true });
  const writes = [];
  for (const { collection, doc_id, data } of docs) {
    const file = path.join(dir, collection, `${doc_id}.json`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2));
    writes.push({ op: 'set', collection, doc_id, file_path: file });
  }
  const manifests = [];
  for (let i = 0; i < writes.length; i += 50) {
    const f = path.join(dir, `writes-${manifests.length + 1}.json`);
    writeFileSync(f, JSON.stringify(writes.slice(i, i + 50), null, 2));
    manifests.push(f);
  }
  return { count: writes.length, manifests };
}

/** Documents saved by ArtifactData list/query with out_dir: [{_id, ...data}]. */
export function readDocs(outDir, collection) {
  const dir = path.join(outDir, collection);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ _id: f.slice(0, -5), ...JSON.parse(readFileSync(path.join(dir, f), 'utf8')) }));
}

/** Ledger documents -> out/state files (pushed.json and one file per preset). */
export function restoreState(ledgerDocs, stateDir) {
  mkdirSync(stateDir, { recursive: true });
  const pushed = { log: [] };
  const seen = new Set();
  for (const d of ledgerDocs.filter((x) => x._id.startsWith('pushed-')).sort((a, b) => a._id.localeCompare(b._id)))
    for (const p of d.log || []) if (!seen.has(p.email)) (seen.add(p.email), pushed.log.push(p));
  const presets = {};
  for (const d of ledgerDocs.filter((x) => x._id.startsWith('state-'))) {
    const cur = presets[d.preset];
    if (!cur || String(d.date) > String(cur.date)) presets[d.preset] = d;
  }
  // Never shrink what this machine already knows (a local file may be newer than the desk).
  const merge = (file, fresh) => {
    if (!existsSync(file)) return fresh;
    const old = JSON.parse(readFileSync(file, 'utf8'));
    if (fresh.log) return { log: [...old.log, ...fresh.log.filter((p) => !old.log.some((o) => o.email === p.email))] };
    return { ...fresh, next_offset: Math.max(old.next_offset || 0, fresh.next_offset || 0), delivered: [...new Set([...(old.delivered || []), ...(fresh.delivered || [])])] };
  };
  writeFileSync(path.join(stateDir, 'pushed.json'), JSON.stringify(merge(path.join(stateDir, 'pushed.json'), pushed), null, 2));
  for (const [preset, d] of Object.entries(presets)) {
    const f = path.join(stateDir, `${preset}.json`);
    writeFileSync(f, JSON.stringify(merge(f, { next_offset: d.next_offset || 0, delivered: d.delivered || [] }), null, 2));
  }
  return { pushed: pushed.log.length, presets: Object.keys(presets) };
}

/** out/state/<preset>.json -> ledger documents for today (one per preset). */
export function stateDocs(stateDir, date, presets) {
  return presets
    .map((preset) => {
      const f = path.join(stateDir, `${preset}.json`);
      if (!existsSync(f)) return null;
      const s = JSON.parse(readFileSync(f, 'utf8'));
      return { collection: 'ledger', doc_id: `state-${preset}-${date}`, data: { preset, date, next_offset: s.next_offset || 0, delivered: s.delivered || [] } };
    })
    .filter(Boolean);
}
