#!/usr/bin/env node
// Tiny HTTP API around the pipeline, for n8n (or anything else) to start runs and
// collect the scored leads. No dependencies. One run at a time; others queue.
//
//   POST /runs                 {"preset":"type_a","limit":60}  -> {"id":"...","status":"queued"}
//   GET  /runs/:id             status, timings, funnel (markdown) and lead counts
//   GET  /runs/:id/leads.json  scored rows (what goes into the Google Sheet)
//   GET  /runs/:id/leads.csv | leads.xlsx | funnel.md | log
//   GET  /health
//
// Env: PORT (8787), LEADS_API_TOKEN (if set, every request needs "Authorization: Bearer <token>"),
// plus the pipeline's own keys (APIFY_TOKEN, MILLIONVERIFIER_API_KEY, MV_PRICE_USD).
import http from 'node:http';
import path from 'node:path';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runPipeline, PRESETS } from './pipeline.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = path.join(root, 'out', 'runs');
mkdirSync(RUNS, { recursive: true });
const TOKEN = process.env.LEADS_API_TOKEN || '';

const runs = new Map(); // id -> record (also saved as <dir>/status.json)
const queue = [];
let busy = false;

const save = (r) => writeFileSync(path.join(r.dir, 'status.json'), JSON.stringify(r, null, 2));
// Runs from before a restart: finished ones stay readable, unfinished ones are marked.
for (const d of readdirSync(RUNS)) {
  const f = path.join(RUNS, d, 'status.json');
  if (!existsSync(f)) continue;
  const r = JSON.parse(readFileSync(f, 'utf8'));
  if (r.status === 'running' || r.status === 'queued') r.status = 'failed', r.error = 'server restarted during the run';
  runs.set(r.id, r);
}

async function next() {
  if (busy || !queue.length) return;
  busy = true;
  const r = queue.shift();
  r.status = 'running';
  r.started_at = new Date().toISOString();
  save(r);
  const logFile = path.join(r.dir, 'run.log');
  const chunks = [];
  try {
    await runPipeline({ preset: r.preset, limit: r.limit, offset: r.offset, outDir: r.dir, log: (m) => chunks.push(m) && writeFileSync(logFile, chunks.join('')) });
    const rows = JSON.parse(readFileSync(path.join(r.dir, 'leads-scored.json'), 'utf8'));
    r.status = 'done';
    r.leads = rows.length;
    r.with_named_email = rows.filter((x) => x.email).length;
    const f = path.join(r.dir, 'funnel.json');
    if (existsSync(f)) r.cost_usd = JSON.parse(readFileSync(f, 'utf8')).ledger.total_usd;
  } catch (e) {
    r.status = 'failed';
    r.error = String(e.message).slice(0, 300);
  }
  r.finished_at = new Date().toISOString();
  save(r);
  busy = false;
  next();
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type });
  res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
};
const FILES = { 'leads.json': ['leads-scored.json', 'application/json'], 'leads.csv': ['leads-scored.csv', 'text/csv'], 'leads.xlsx': ['leads-scored.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], 'funnel.md': ['funnel.md', 'text/markdown'], log: ['run.log', 'text/plain'] };

const server = http.createServer(async (req, res) => {
  try {
    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' });
    const url = new URL(req.url, 'http://x');
    const parts = url.pathname.split('/').filter(Boolean);
    if (req.method === 'GET' && parts[0] === 'health') return send(res, 200, { ok: true, busy, queued: queue.length, presets: Object.keys(PRESETS) });
    if (req.method === 'POST' && parts[0] === 'runs' && parts.length === 1) {
      let body = '';
      for await (const c of req) body += c;
      const b = body ? JSON.parse(body) : {};
      if (!PRESETS[b.preset || 'type_a']) return send(res, 400, { error: `unknown preset; use ${Object.keys(PRESETS).join(', ')}` });
      const id = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${b.preset || 'type_a'}-${randomUUID().slice(0, 6)}`;
      const r = { id, preset: b.preset || 'type_a', limit: b.limit ? Number(b.limit) : undefined, offset: b.offset != null ? Number(b.offset) : undefined, status: 'queued', queued_at: new Date().toISOString(), dir: path.join(RUNS, id) };
      mkdirSync(r.dir, { recursive: true });
      runs.set(id, r);
      queue.push(r);
      save(r);
      next();
      return send(res, 202, { id, status: r.status });
    }
    if (req.method === 'GET' && parts[0] === 'runs' && parts[1]) {
      const r = runs.get(parts[1]);
      if (!r) return send(res, 404, { error: 'no such run' });
      if (parts.length === 2) {
        const fm = path.join(r.dir, 'funnel.md');
        return send(res, 200, { ...r, dir: undefined, funnel: existsSync(fm) ? readFileSync(fm, 'utf8') : null });
      }
      const [file, type] = FILES[parts[2]] || [];
      const f = file && path.join(r.dir, file);
      if (!f || !existsSync(f)) return send(res, 404, { error: 'not ready' });
      return send(res, 200, readFileSync(f), type);
    }
    if (req.method === 'GET' && parts[0] === 'runs') return send(res, 200, [...runs.values()].map((r) => ({ ...r, dir: undefined })).reverse());
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e.message).slice(0, 200) });
  }
});
const port = Number(process.env.PORT || 8787);
server.listen(port, () => console.log(`leads API on :${port}${TOKEN ? ' (token required)' : ''}`));
