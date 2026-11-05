#!/usr/bin/env node
// Vera demo workflows: the source of truth for the n8n workflows.
//
//   node n8n/vera-demo.mjs check     run every workflow locally on its sample and assert the results
//   node n8n/vera-demo.mjs build     write n8n/dist/<id>.json (what gets imported into n8n)
//   node n8n/vera-demo.mjs samples   rebuild n8n/freeissue-sample.json from n8n/free-issue/*.csv
//   node n8n/vera-demo.mjs deploy    build, copy to the VPS, import, publish, restart n8n
//   node n8n/vera-demo.mjs smoke     POST each sample to the live webhooks and compare with the local run
//
// deploy reads (nothing secret is stored in this repo):
//   VERA_SSH            ssh target, e.g. deploy@203.0.113.10 (key auth via your ssh-agent / ~/.ssh/config)
//   VERA_N8N_CONTAINER  docker container name (default: n8n)
//   VERA_SUDO           set to 1 if docker needs sudo on the VPS
// smoke reads:
//   VERA_N8N_URL        e.g. https://n8n.example.com (webhooks live under /webhook/)

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { flow as leak } from './flows/leak.mjs'
import { flow as desk } from './flows/desk.mjs'
import { flow as free } from './flows/free-issue.mjs'
import { expectations } from './expected.mjs'
import { buildFreeIssueSample } from './free-issue-csv.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const flows = [leak, desk, free]

// ---------- workflow JSON ----------

// Stable UUIDs so re-imports update the same nodes and the webhook URL never changes.
function uuid(seed) {
  const h = crypto.createHash('sha1').update(seed).digest('hex')
  return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16), '8' + h.slice(17, 20), h.slice(20, 32)].join('-')
}

// The exact text that goes into a Code node. The step function is pasted in whole and
// called on the single incoming item; its return value becomes the single outgoing item.
export function nodeCode(fn) {
  return [
    `// ${fn.name}: generated from n8n/flows/*.mjs. Edit there, not here.`,
    'const input = $input.first().json;',
    '',
    fn.toString(),
    '',
    `return [{ json: ${fn.name}(input) }];`,
  ].join('\n')
}

export function buildWorkflow(f) {
  const x0 = 0
  const dx = 240
  const webhook = {
    id: uuid(f.id + ':webhook'),
    name: 'Webhook',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [x0, 300],
    webhookId: uuid(f.id + ':webhookId'),
    parameters: { httpMethod: 'POST', path: f.path, responseMode: 'responseNode', options: { allowedOrigins: '*' } },
  }
  const code = f.steps.map((s, i) => ({
    id: uuid(f.id + ':' + s.name),
    name: s.name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x0 + dx * (i + 1), 300],
    parameters: { mode: 'runOnceForAllItems', jsCode: nodeCode(s.fn) },
  }))
  const respond = {
    id: uuid(f.id + ':respond'),
    name: 'Respond',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.1,
    position: [x0 + dx * (f.steps.length + 1), 300],
    parameters: { respondWith: 'firstIncomingItem', options: {} },
  }
  const sticky = {
    id: uuid(f.id + ':note'),
    name: 'About this workflow',
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [x0, -60],
    parameters: { content: f.note, width: Math.max(560, dx * (f.steps.length + 2)), height: 300, color: 4 },
  }
  const chain = [webhook, ...code, respond]
  const connections = {}
  for (let i = 0; i < chain.length - 1; i++) {
    connections[chain[i].name] = { main: [[{ node: chain[i + 1].name, type: 'main', index: 0 }]] }
  }
  return {
    id: f.id,
    name: f.name,
    nodes: [sticky, ...chain],
    connections,
    settings: { executionOrder: 'v1' },
    pinData: {},
    active: false,
    tags: [],
  }
}

// ---------- local run ----------

// Runs the generated node code (not the original functions) so `check` tests what n8n runs.
export function runLocal(f, body) {
  let item = { headers: {}, params: {}, query: {}, body: JSON.parse(JSON.stringify(body)) }
  const trace = []
  for (const s of f.steps) {
    const run = new Function('$input', nodeCode(s.fn))
    const out = run({ first: () => ({ json: item }), all: () => [{ json: item }] })
    item = JSON.parse(JSON.stringify(out[0].json)) // n8n passes plain JSON between nodes
    trace.push(s.name)
  }
  return item
}

const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(here, p), 'utf8'))

function check() {
  let failed = 0
  const exists = (p) => fs.existsSync(path.join(here, p))
  // If the CSV registers are present, the JSON sample must be exactly what they describe.
  if (exists('free-issue/contract_terms.json') && exists(free.sample)) {
    const rebuilt = buildFreeIssueSample(path.join(here, 'free-issue'))
    if (JSON.stringify(rebuilt) !== JSON.stringify(readJSON(free.sample))) {
      console.log('✗ freeissue-sample.json is out of date with free-issue/*.csv: run `node n8n/vera-demo.mjs samples`')
      failed++
    } else console.log('✓ freeissue-sample.json matches free-issue/*.csv')
  }

  for (const f of flows) {
    JSON.parse(JSON.stringify(buildWorkflow(f))) // every workflow must build and serialise
    if (!exists(f.sample)) {
      console.log(`– ${f.id}  skipped: n8n/${f.sample} not added yet`)
      continue
    }
    const out = runLocal(f, readJSON(f.sample))
    const tests = expectations[f.id](out)
    for (const [label, ok, got] of tests) {
      if (!ok) failed++
      console.log(`${ok ? '✓' : '✗'} ${f.id}  ${label}${ok ? '' : `  (got ${JSON.stringify(got)})`}`)
    }
  }
  if (failed) {
    console.log(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll checks passed')
}

function build() {
  const dir = path.join(here, 'dist')
  fs.mkdirSync(dir, { recursive: true })
  for (const f of flows) {
    const file = path.join(dir, f.id + '.json')
    fs.writeFileSync(file, JSON.stringify(buildWorkflow(f), null, 2))
    console.log('wrote', path.relative(process.cwd(), file))
  }
  return dir
}

function samples() {
  const out = buildFreeIssueSample(path.join(here, 'free-issue'))
  fs.writeFileSync(path.join(here, free.sample), JSON.stringify(out, null, 2) + '\n')
  console.log('wrote n8n/' + free.sample)
}

function deploy() {
  const target = process.env.VERA_SSH
  if (!target) {
    console.error('Set VERA_SSH=user@host first (see the top of this file).')
    process.exit(1)
  }
  const container = process.env.VERA_N8N_CONTAINER || 'n8n'
  const docker = process.env.VERA_SUDO === '1' ? 'sudo docker' : 'docker'
  const dir = build()
  const sh = (cmd) => {
    console.log('$', cmd)
    execFileSync('ssh', [target, cmd], { stdio: 'inherit' })
  }
  sh('mkdir -p /tmp/vera-deploy')
  execFileSync('scp', [...flows.map((f) => path.join(dir, f.id + '.json')), `${target}:/tmp/vera-deploy/`], { stdio: 'inherit' })
  for (const f of flows) {
    sh(`${docker} cp /tmp/vera-deploy/${f.id}.json ${container}:/tmp/${f.id}.json`)
    sh(`${docker} exec ${container} n8n import:workflow --input=/tmp/${f.id}.json`)
    sh(`${docker} exec ${container} n8n publish:workflow --id=${f.id}`)
  }
  // Webhooks only register when n8n starts.
  sh(`${docker} restart ${container}`)
  console.log('\nDeployed. Wait ~20 s for n8n to start, then run: node n8n/vera-demo.mjs smoke')
}

async function smoke() {
  const base = (process.env.VERA_N8N_URL || '').replace(/\/$/, '')
  if (!base) {
    console.error('Set VERA_N8N_URL=https://your-n8n-host first.')
    process.exit(1)
  }
  let failed = 0
  for (const f of flows) {
    const url = `${base}/webhook/${f.path}`
    const pre = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    })
    const cors = pre.headers.get('access-control-allow-origin')
    const body = readJSON(f.sample)
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' }, body: JSON.stringify(body) })
    const live = res.ok ? await res.json() : null
    const same = live && JSON.stringify(live) === JSON.stringify(runLocal(f, body))
    const ok = (pre.status === 204 || pre.status === 200) && cors && same
    if (!ok) failed++
    console.log(`${ok ? '✓' : '✗'} ${f.path}  OPTIONS ${pre.status} allow-origin=${cors}  POST ${res.status}  ${same ? 'matches local run' : 'DIFFERS from local run'}`)
  }
  process.exit(failed ? 1 : 0)
}

const cmd = process.argv[2]
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  if (cmd === 'check') check()
  else if (cmd === 'build') build()
  else if (cmd === 'samples') samples()
  else if (cmd === 'deploy') deploy()
  else if (cmd === 'smoke') await smoke()
  else {
    console.log('usage: node n8n/vera-demo.mjs check | build | samples | deploy | smoke')
    process.exit(cmd ? 1 : 0)
  }
}

export { flows }
