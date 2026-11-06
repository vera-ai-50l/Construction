#!/usr/bin/env node
// Desk 05 One-day Mobilisation: build and check the n8n workflows.
//
//   node n8n/mobilise/build.mjs check      unit tests on logic.mjs + guardrail checks on every workflow
//                                          + runs the generated Code-node source (what n8n runs) on samples
//   node n8n/mobilise/build.mjs build      write n8n/mobilise/dist/<id>.json (import into n8n) and board.json
//   node n8n/mobilise/build.mjs validate <path-to-n8n-mcp>   also validate each workflow with n8n-mcp
//
// Import order on the server: 09 Send, 00 Errors, then the rest (Execute Workflow nodes refer to ids).

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { workflows, IDS } from './workflows.mjs'
import { lines as TEMPLATE, areas as AREAS, TEMPLATE_VERSION } from './checklist.mjs'
import { runTests } from './test.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const TYPES = {
  webhook: ['n8n-nodes-base.webhook', 2.1],
  respond: ['n8n-nodes-base.respondToWebhook', 1.1],
  code: ['n8n-nodes-base.code', 2],
  if: ['n8n-nodes-base.if', 2.2],
  switch: ['n8n-nodes-base.switch', 3.2],
  pg: ['n8n-nodes-base.postgres', 2.6],
  http: ['n8n-nodes-base.httpRequest', 4.2],
  exec: ['n8n-nodes-base.executeWorkflow', 1.2],
  sub: ['n8n-nodes-base.executeWorkflowTrigger', 1.1],
  cron: ['n8n-nodes-base.scheduleTrigger', 1.2],
  s3: ['n8n-nodes-base.awsS3', 2],
  errorTrigger: ['n8n-nodes-base.errorTrigger', 1],
  wait: ['n8n-nodes-base.wait', 1.1],
  noop: ['n8n-nodes-base.noOp', 1],
  stop: ['n8n-nodes-base.stopAndError', 1],
  loop: ['n8n-nodes-base.splitInBatches', 3],
  form: ['n8n-nodes-base.formTrigger', 2.2],
  email: ['n8n-nodes-base.emailSend', 2.1],
  merge: ['n8n-nodes-base.merge', 3],
}
const TRIGGERS = new Set(['webhook', 'sub', 'cron', 'errorTrigger', 'form'])

const uuid = (seed) => {
  const h = crypto.createHash('sha1').update(seed).digest('hex')
  return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16), '8' + h.slice(17, 20), h.slice(20, 32)].join('-')
}

// ---------------------------------------------------------------- Code node source

export function codeFor(node) {
  if (node.src) return node.src
  const fnSrc = node.fn.toString()
  const label = node.fn.name ? 'logic.mjs ' + node.fn.name : 'workflows.mjs'
  const call = node.assign ? `{ ...input, ${node.assign}: __fn(input) }` : '__fn(input)'
  const media = node.media
    ? `if (item.binary && item.binary.data && !(input.message && input.message.type === 'audio')) {
  const buf = await this.helpers.getBinaryDataBuffer(${node.mode === 'all' ? 'i' : '$itemIndex'}, 'data');
  input.__media = { b64: buf.toString('base64'), mime: String(item.binary.data.mimeType || '').split(';')[0] };
}\n`
    : ''
  if (node.mode === 'all') {
    return [
      `// ${node.name}: generated from n8n/mobilise/${label}. Edit there, then rebuild.`,
      `const __fn = ${fnSrc};`,
      'const out = [];',
      'const all = $input.all();',
      'for (let i = 0; i < all.length; i++) {',
      '  const item = all[i];',
      '  let input = { ...item.json };',
      node.pre ? '  ' + node.pre : '',
      media,
      `  for (const j of [].concat(${call})) out.push({ json: j });`,
      '}',
      'return out;',
    ].filter((x) => x !== '').join('\n')
  }
  return [
    `// ${node.name}: generated from n8n/mobilise/${label}. Edit there, then rebuild.`,
    `const __fn = ${fnSrc};`,
    'const item = $input.item;',
    'let input = { ...item.json };',
    node.pre || '',
    media,
    `const out = ${call};`,
    'return item.binary ? { json: out, binary: item.binary } : { json: out };',
  ].filter((x) => x !== '').join('\n')
}

// ---------------------------------------------------------------- workflow JSON

function outIndex(node, kind) {
  if (kind === 'main' || kind === 'true' || kind === 'in2') return 0
  if (kind === 'false') return 1
  if (kind === 'done') return 0
  if (kind === 'loop') return 1
  if (kind === 'error') return 1
  const i = (node.outputs || []).indexOf(kind)
  if (i < 0) throw new Error(`${node.name}: no output called "${kind}"`)
  return i
}

export function buildWorkflow(w) {
  const nodes = w.nodes.map((nd) => {
    const [type, typeVersion] = TYPES[nd.kind]
    const o = {
      id: uuid(w.id + ':' + nd.name),
      name: nd.name,
      type,
      typeVersion,
      position: nd.pos.map(Math.round),
      parameters: nd.kind === 'code'
        ? { mode: nd.mode === 'all' ? 'runOnceForAllItems' : 'runOnceForEachItem', jsCode: codeFor(nd) }
        : nd.params,
      notes: nd.does + (nd.guard.length ? '\nGuardrails: ' + nd.guard.join(', ') : ''),
      notesInFlow: false,
    }
    if (nd.kind === 'webhook') o.webhookId = uuid(w.id + ':hook:' + nd.name)
    if (nd.kind === 'form') o.webhookId = uuid(w.id + ':form:' + nd.name)
    if (nd.kind === 'exec') {
      const target = workflows.find((x) => x.id === nd.params.workflowId.value)
      o.parameters = { ...nd.params, workflowId: { ...nd.params.workflowId, cachedResultName: target ? target.name : '', cachedResultUrl: '/workflow/' + nd.params.workflowId.value } }
    }
    if (nd.creds) o.credentials = nd.creds
    if (nd.retry) Object.assign(o, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 })
    if (nd.onError) o.onError = 'continueErrorOutput'
    if (nd.alwaysOutput) o.alwaysOutputData = true
    return o
  })
  const byName = Object.fromEntries(w.nodes.map((x) => [x.name, x]))
  const connections = {}
  for (const e of w.edges) {
    const src = byName[e.from]
    if (!src) throw new Error(`${w.name}: edge from unknown node "${e.from}"`)
    if (!byName[e.to]) throw new Error(`${w.name}: edge to unknown node "${e.to}"`)
    const idx = outIndex(src, e.kind)
    const c = (connections[e.from] = connections[e.from] || { main: [] })
    while (c.main.length <= idx) c.main.push([])
    c.main[idx].push({ node: e.to, type: 'main', index: e.kind === 'in2' ? 1 : 0 })
  }
  const sticky = {
    id: uuid(w.id + ':sticky'),
    name: 'About this workflow',
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [-40, -620],
    parameters: {
      content: `## ${w.name}\n${w.purpose}\n\nGenerated from \`n8n/mobilise/workflows.mjs\`. Edit there and rebuild; edits made here are overwritten on the next import.\nEach node's note says what it does and which guardrails it carries.`,
      width: 720, height: 220, color: 4,
    },
  }
  return {
    id: w.id,
    name: w.name,
    nodes: [sticky, ...nodes],
    connections,
    settings: {
      executionOrder: 'v1',
      timezone: 'Asia/Kolkata',
      saveDataErrorExecution: 'all',
      saveManualExecutions: true,
      callerPolicy: 'workflowsFromSameOwner',
      ...(w.id === IDS.errors ? {} : { errorWorkflow: IDS.errors }),
    },
    pinData: {},
    active: false,
    tags: [],
  }
}

// ---------------------------------------------------------------- guardrail checks (structure)

export function structureChecks() {
  const problems = []
  for (const w of workflows) {
    const names = new Set()
    for (const nd of w.nodes) {
      if (names.has(nd.name)) problems.push(`${w.name}: duplicate node name "${nd.name}"`)
      names.add(nd.name)
    }
    const json = buildWorkflow(w)
    const out = (name) => (json.connections[name] ? json.connections[name].main : [])
    const incoming = new Set(w.edges.map((e) => e.to))
    for (const nd of w.nodes) {
      const o = out(nd.name)
      // The two-step trap: onError set but error output not wired, or wired without onError.
      if (nd.onError && !(o[1] && o[1].length)) problems.push(`${w.name}: "${nd.name}" has onError but its error output goes nowhere`)
      if (!nd.onError && ['http', 'pg', 's3', 'exec', 'code', 'email', 'respond', 'wait', 'noop', 'stop', 'merge'].includes(nd.kind) && o[1] && o[1].length) problems.push(`${w.name}: "${nd.name}" has an error edge but no onError`)
      if (nd.kind === 'switch' && !(nd.params.options && nd.params.options.fallbackOutput === 'extra')) problems.push(`${w.name}: switch "${nd.name}" has no fallback output`)
      if (nd.kind === 'http' && !nd.retry && !nd.onError) problems.push(`${w.name}: "${nd.name}" calls the network with no retry and no error path`)
      if (nd.kind === 'pg' && /\{\{/.test(nd.params.query)) problems.push(`${w.name}: "${nd.name}" puts an expression inside SQL text (injection risk)`)
      if (nd.kind === 'pg' && /\$\d/.test(nd.params.query) && !(nd.params.options && nd.params.options.queryReplacement)) problems.push(`${w.name}: "${nd.name}" has $n placeholders but no parameters`)
      if (nd.kind === 'pg') {
        const used = Math.max(0, ...[...nd.params.query.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])))
        const given = nd.params.options && nd.params.options.queryReplacement ? (nd.params.options.queryReplacement.match(/\?\? null/g) || []).length : 0
        if (used !== given) problems.push(`${w.name}: "${nd.name}" uses $1..$${used} but passes ${given} parameters`)
      }
      if (nd.kind === 'respond' && !(nd.params.options && typeof nd.params.options.responseCode === 'number')) problems.push(`${w.name}: respond "${nd.name}" has no explicit status code`)
      if (!TRIGGERS.has(nd.kind) && !incoming.has(nd.name)) problems.push(`${w.name}: "${nd.name}" is not connected to anything`)
      if (nd.kind === 'switch') for (const k of nd.outputs) if (!w.edges.some((e) => e.from === nd.name && e.kind === k)) problems.push(`${w.name}: switch "${nd.name}" output "${k}" goes nowhere`)
      if (nd.kind === 'if' && !w.edges.some((e) => e.from === nd.name && e.kind === 'true')) problems.push(`${w.name}: IF "${nd.name}" true branch goes nowhere`)
      if (nd.kind === 'exec' && !Object.values(IDS).includes(nd.params.workflowId.value)) problems.push(`${w.name}: "${nd.name}" calls an unknown workflow`)
      if (nd.kind === 'code') {
        const src = codeFor(nd)
        try { new (Object.getPrototypeOf(async function () {}).constructor)('$input', '$', '$env', '$itemIndex', 'require', src) } catch (err) { problems.push(`${w.name}: code "${nd.name}" does not parse: ${err.message}`) }
        if (/\$\('([^']+)'\)/.test(src)) for (const m of src.matchAll(/\$\('([^']+)'\)/g)) if (!names.has(m[1]) && !w.nodes.some((x) => x.name === m[1])) problems.push(`${w.name}: code "${nd.name}" refers to missing node "${m[1]}"`)
      }
    }
    // Every expression that names a node must name a node in this workflow.
    const text = JSON.stringify(w.nodes.map((x) => x.params))
    for (const m of text.matchAll(/\$\(\\?'([^'\\]+)\\?'\)/g)) if (!w.nodes.some((x) => x.name === m[1])) problems.push(`${w.name}: expression refers to missing node "${m[1]}"`)
    // Webhook workflows: every path from a webhook must reach a Respond node.
    for (const hook of w.nodes.filter((x) => x.kind === 'webhook')) {
      const seen = new Set()
      const dead = []
      const walk = (name, respondedAlready) => {
        const key = name + respondedAlready
        if (seen.has(key)) return
        seen.add(key)
        const nd = w.nodes.find((x) => x.name === name)
        const responded = respondedAlready || nd.kind === 'respond'
        const outs = w.edges.filter((e) => e.from === name)
        if (!outs.length && !responded) dead.push(name)
        for (const e of outs) walk(e.to, responded)
      }
      walk(hook.name, false)
      for (const d of dead) problems.push(`${w.name}: path from "${hook.name}" ends at "${d}" without answering the caller`)
    }
  }
  return problems
}

// ---------------------------------------------------------------- run generated code locally

export async function runCode(node, items, ctx = {}) {
  const src = codeFor(node)
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const fn = new AsyncFunction('$input', '$', '$env', '$itemIndex', 'require', src)
  const helpers = { getBinaryDataBuffer: async (i, key) => Buffer.from(items[i].binary[key].data, 'base64') }
  const $ = (name) => {
    const n = (ctx.nodes || {})[name]
    if (!n) throw new Error('no node ' + name)
    return { item: n, first: () => n, all: () => [n], isExecuted: true }
  }
  if (node.mode === 'all' || /\$input\.first\(\)|\$input\.all\(\)/.test(src)) {
    const out = await fn.call({ helpers }, { all: () => items, first: () => items[0], item: items[0] }, $, ctx.env || {}, 0, require)
    return out.map((o) => JSON.parse(JSON.stringify(o)))
  }
  const res = []
  for (let i = 0; i < items.length; i++) {
    const out = await fn.call({ helpers }, { item: items[i], all: () => items, first: () => items[0] }, $, ctx.env || {}, i, require)
    res.push(JSON.parse(JSON.stringify(out)))
  }
  return res
}

export const nodeNamed = (wfId, name) => workflows.find((w) => w.id === wfId).nodes.find((x) => x.name === name)

// ---------------------------------------------------------------- board data

export function boardData() {
  return {
    version: TEMPLATE_VERSION,
    areas: AREAS,
    lineCount: TEMPLATE.length,
    byArea: AREAS.map((a) => ({ code: a.code, name: a.name, lines: TEMPLATE.filter((l) => l.area === a.code).length, critical: TEMPLATE.filter((l) => l.area === a.code && l.severity === 'critical').length })),
    workflows: workflows.map((w) => ({
      id: w.id, name: w.name, purpose: w.purpose,
      nodes: w.nodes.map((nd) => ({ name: nd.name, kind: nd.kind, type: TYPES[nd.kind][0].replace('n8n-nodes-base.', ''), x: nd.pos[0], y: nd.pos[1], does: nd.does, guard: nd.guard, onError: !!nd.onError, retry: !!nd.retry })),
      edges: w.edges.map((e) => ({ from: e.from, to: e.to, kind: e.kind })),
    })),
  }
}

// ---------------------------------------------------------------- commands

function build() {
  const dir = path.join(here, 'dist')
  fs.mkdirSync(dir, { recursive: true })
  for (const w of workflows) {
    const file = path.join(dir, w.id + '.json')
    fs.writeFileSync(file, JSON.stringify(buildWorkflow(w), null, 2))
    console.log('wrote', path.relative(process.cwd(), file))
  }
  fs.writeFileSync(path.join(dir, 'board.json'), JSON.stringify(boardData()))
  console.log('wrote', path.relative(process.cwd(), path.join(dir, 'board.json')))
  // The board page: same data, so the node map on the board is the workflow that runs.
  const page = fs.readFileSync(path.join(here, 'board.template.html'), 'utf8').replace('/*BOARD_DATA*/null', JSON.stringify(boardData()).replace(/</g, '\\u003c'))
  const out = path.join(here, '..', '..', 'docs', 'desk-05', 'board.html')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, page)
  console.log('wrote', path.relative(process.cwd(), out))
  return dir
}

async function check() {
  let failed = 0
  const problems = structureChecks()
  for (const p of problems) console.log('✗ guardrail  ' + p)
  if (!problems.length) console.log(`✓ guardrails  ${workflows.length} workflows, ${workflows.reduce((a, w) => a + w.nodes.length, 0)} nodes: error outputs wired, switches have fallbacks, SQL parameterised, every webhook path answers`)
  failed += problems.length
  const results = await runTests()
  for (const [label, ok, got] of results) {
    if (!ok) failed++
    console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `  (got ${JSON.stringify(got)})`}`)
  }
  if (failed) {
    console.log(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll checks passed')
}

async function validate(mcpBin) {
  const dir = build()
  const { spawn } = await import('node:child_process')
  const p = spawn(mcpBin, [], { env: { ...process.env, MCP_MODE: 'stdio', LOG_LEVEL: 'error', DISABLE_CONSOLE_OUTPUT: 'true' } })
  let buf = ''
  let id = 0
  const waiting = {}
  p.stdout.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i)
      buf = buf.slice(i + 1)
      try { const m = JSON.parse(line); if (m.id && waiting[m.id]) { waiting[m.id](m); delete waiting[m.id] } } catch {}
    }
  })
  const call = (method, params) => new Promise((r) => { const i = ++id; waiting[i] = r; p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n') })
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'vera', version: '1' } })
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  let errors = 0
  for (const w of workflows) {
    const json = JSON.parse(fs.readFileSync(path.join(dir, w.id + '.json'), 'utf8'))
    const r = await call('tools/call', { name: 'validate_workflow', arguments: { workflow: json, options: { profile: 'runtime' } } })
    const text = r.result && r.result.content && r.result.content[0] ? r.result.content[0].text : JSON.stringify(r)
    let res
    try { res = JSON.parse(text) } catch { res = { raw: text } }
    const errs = res.errors || []
    errors += errs.length
    console.log(`${errs.length ? '✗' : '✓'} n8n-mcp ${w.name}: ${errs.length} errors, ${(res.warnings || []).length} warnings`)
    for (const e of errs) console.log('    error  ' + (e.node || e.nodeName || '') + ': ' + (e.message || JSON.stringify(e)))
    if (process.env.VERBOSE) for (const e of res.warnings || []) console.log('    warn   ' + (e.node || e.nodeName || '') + ': ' + (e.message || JSON.stringify(e)))
  }
  p.kill()
  process.exit(errors ? 1 : 0)
}

const cmd = process.argv[2]
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  if (cmd === 'check') await check()
  else if (cmd === 'build') build()
  else if (cmd === 'validate') await validate(process.argv[3] || 'n8n-mcp')
  else {
    console.log('usage: node n8n/mobilise/build.mjs check | build | validate <n8n-mcp binary>')
    process.exit(cmd ? 1 : 0)
  }
}
