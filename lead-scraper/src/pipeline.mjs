#!/usr/bin/env node
// The lead pipeline as one command, up to scoring (no teardowns):
// discover -> enrich -> vibe / login checks -> named contacts -> verify -> score ->
// remarks -> leads-scored.xlsx/csv/json + funnel.md (counts and cost per step).
//
//   npm run pipeline -- --preset type_a            (weekly Type A run)
//   npm run pipeline -- --preset type_b --limit 90
//
// Used by the HTTP API (src/server.mjs, which n8n calls) and by cron. Settings that
// change between runs (limit, offset) are arguments; everything else is in PRESETS.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The setups that tested best for each ICP (see README "Funnel tests").
export const PRESETS = {
  // Type A: AI-built apps with paying users. Free sources + free names first; Google name
  // search only for anonymous apps; up to 5 email patterns; no paid finder (finder
  // databases did not know these apps).
  type_a: {
    args: ['--profile', 'vibe', '--sources', 'trustmrr,showhn,commoncrawl', '--skip-jobs', '--find-contacts', '--finder', 'none', '--name-search', '--max-candidates', '5', '--access-check'],
    env: { CC_HOSTS: 'lovable.app,base44.app' },
    limit: 60,
  },
  // Type B: seed / Series A B2B SaaS, non-YC: funding news + design roles on job boards
  // + HN Who is hiring. Login check; finder database, then name search.
  type_b: {
    args: ['--profile', 'type_b', '--sources', 'news,ats,hn', '--find-contacts', '--finder', 'pipelinelabs', '--name-search', '--max-candidates', '3', '--access-check'],
    limit: 60,
  },
  // Type C: US/EU Shopify brands from Common Crawl. Storefronts are public: no login check.
  type_c: {
    args: ['--profile', 'type_c', '--sources', 'shopify', '--skip-jobs', '--find-contacts', '--finder', 'pipelinelabs', '--name-search', '--max-candidates', '3'],
    limit: 110,
  },
  // Job-post signal (kept as its own list and sheet): companies hiring a designer right
  // now (Himalayas, Remotive, We Work Remotely, Dribbble, job boards, HN), sorted by
  // their own site into B (SaaS) or C (Shopify store). Not run for A: AI-built-app
  // founders do not post on job boards.
  type_b_jobs: {
    args: ['--profile', 'type_b', '--sources', 'jobs', '--find-contacts', '--finder', 'pipelinelabs', '--name-search', '--max-candidates', '3', '--access-check'],
    limit: 80,
  },
  type_c_jobs: {
    args: ['--profile', 'type_c', '--sources', 'jobs', '--skip-jobs', '--find-contacts', '--finder', 'pipelinelabs', '--name-search', '--max-candidates', '3'],
    limit: 80,
  },
};

// Lists of the same ICP never repeat a company: "type_b" and "type_b_jobs" share one
// do-not-deliver set (each still keeps its own state for where to read next).
const icpOf = (preset) => preset.replace(/_jobs$/, '');

function run(cmd, args, { env, log }) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: root, env: { ...process.env, NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY ?? '1', ...env } });
    p.stdout.on('data', (d) => log(String(d)));
    p.stderr.on('data', (d) => log(String(d)));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(args[1] || cmd)} exited with ${code}`))));
  });
}

/**
 * Run one preset into outDir. Returns { outDir, files }.
 * @param opts { preset, limit, offset, outDir, log }
 */
export async function runPipeline({ preset = 'type_a', limit, offset, outDir, log = (m) => process.stderr.write(m) } = {}) {
  const p = PRESETS[preset];
  if (!p) throw new Error(`Unknown preset "${preset}" (use ${Object.keys(PRESETS).join(', ')})`);
  // State between runs: where to start reading the sources next time, and which
  // companies were already delivered (never delivered twice).
  const stateFile = path.join(root, 'out', 'state', `${preset}.json`);
  mkdirSync(path.dirname(stateFile), { recursive: true });
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { next_offset: 0, delivered: [] };
  offset ??= state.next_offset;
  outDir ||= path.join(root, 'out', 'runs', `${new Date().toISOString().slice(0, 10)}-${preset}`);
  mkdirSync(outDir, { recursive: true });
  // MillionVerifier when its key is set (cheaper per check at volume), else bounceverify on Apify.
  const verifier = process.env.MILLIONVERIFIER_API_KEY ? 'mv' : 'bounceverify';
  const cliArgs = ['--no-warnings', 'src/cli.mjs', ...p.args, '--verifier', verifier, '--limit', String(limit || p.limit), '--offset', String(offset), '--out', outDir];
  writeFileSync(path.join(outDir, 'run.json'), JSON.stringify({ preset, limit: limit || p.limit, offset, verifier, started_at: new Date().toISOString(), args: cliArgs.slice(2) }, null, 2));
  await run(process.execPath, cliArgs, { env: p.env, log });
  const seenFile = path.join(outDir, 'already-delivered.json');
  const sameIcp = Object.keys(PRESETS).filter((k) => k !== preset && icpOf(k) === icpOf(preset));
  const others = sameIcp.flatMap((k) => {
    const f = path.join(root, 'out', 'state', `${k}.json`);
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).delivered || [] : [];
  });
  writeFileSync(seenFile, JSON.stringify([...new Set([...state.delivered, ...others])]));
  await run(process.execPath, ['--no-warnings', 'src/lead-sheet.mjs', outDir, '--title', `${preset} ${new Date().toISOString().slice(0, 10)}`, '--exclude', seenFile], { log });
  const delivered = JSON.parse(readFileSync(path.join(outDir, 'leads-scored.json'), 'utf8')).map((r) => r.domain);
  writeFileSync(stateFile, JSON.stringify({ next_offset: offset + (limit || p.limit), delivered: [...new Set([...state.delivered, ...delivered])], last_run: outDir }, null, 2));
  return { outDir, files: ['leads-scored.xlsx', 'leads-scored.csv', 'leads-scored.json', 'funnel.md', 'leads.json'].map((f) => path.join(outDir, f)) };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { values: a } = parseArgs({ options: { preset: { type: 'string', default: 'type_a' }, limit: { type: 'string' }, offset: { type: 'string', default: '0' }, out: { type: 'string' } } });
  const r = await runPipeline({ preset: a.preset, limit: a.limit && Number(a.limit), offset: Number(a.offset), outDir: a.out && path.resolve(a.out) });
  console.log(`done: ${r.outDir}`);
}
