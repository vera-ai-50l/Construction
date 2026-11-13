#!/usr/bin/env node
// The n8n workflow that runs vera-leads every Monday and fills the weekly Google Sheet.
//
//   node n8n/weekly-sheet.mjs build     write n8n/dist/vera-leads-weekly.json (importable in n8n)
//   node n8n/weekly-sheet.mjs deploy    copy vera-leads to the VPS, install it, create the SSH credential
//                                       n8n uses to reach the VPS, and import the workflow (inactive)
//
// The workflow (n8n runs in Docker and has no browser, so it runs vera-leads on the VPS itself over SSH):
//   Monday 07:00 IST -> start `weekly` in the background -> wait 75 min -> `sheet` (JSON)
//   -> not finished: wait 20 min and ask again (3 hours at most, then the execution fails)
//   -> finished: new tab "<date>" with the Lead Finder to-do list, rows appended to "Ready to email"
//      and "Summary"
//
// deploy reads (nothing secret is stored in this repo):
//   VERA_SSH            ssh target for the VPS, e.g. deploy@203.0.113.10 (key auth via your ssh-agent / ~/.ssh/config)
//   VERA_DIR            where vera-leads lives on the VPS (default /opt/vera/Construction/vera-leads)
//   VERA_SHEET_URL      the Google Sheet's URL (can also be pasted into the workflow's Settings node later)
//   VERA_N8N_CONTAINER  docker container name (default n8n)
//   VERA_SUDO           1 if docker needs sudo on the VPS
// Flags: --env copies vera-leads/.env to the VPS if it has none there; --data copies data/ if the VPS has none.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
export const WORKFLOW_ID = 'veraLeadsWeekly1'
export const CREDENTIAL_ID = 'veraLeadsVpsSsh1'
export const CREDENTIAL_NAME = 'VPS for vera-leads (SSH)'
export const MAX_CHECKS = 9 // 75 min, then 9 more checks 20 min apart: about 4 hours in all

function uuid(seed) {
  const h = crypto.createHash('sha1').update('vera-leads:' + seed).digest('hex')
  return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16), '8' + h.slice(17, 20), h.slice(20, 32)].join('-')
}

// ---------- the code inside the Code nodes (also run by the tests) ----------

// Parse: the `sheet` command's stdout -> one item. Not finished yet -> { done: false }, and after
// MAX_CHECKS tries the execution fails so the n8n error list shows it.
export function parseSheet(stdout, runIndex, maxChecks) {
  let d
  try { d = JSON.parse(String(stdout).trim().split('\n').pop()) } catch (e) { throw new Error('vera-leads `sheet` did not print JSON: ' + String(stdout).slice(0, 300)) }
  if (!d.done && runIndex >= maxChecks) throw new Error(`The weekly run has not finished after ${maxChecks} checks. See data/weekly-${d.date}.log on the VPS.`)
  return d
}
function rowsOf(d, key) { return (d[key] || []).map(r => ({ json: r })) } // a declaration, so toString() keeps its name

const code = {
  settings: sheetUrl => `// Edit these two values if they change.
return [{ json: {
  dir: ${JSON.stringify(process.env.VERA_DIR || '/opt/vera/Construction/vera-leads')},
  sheetUrl: ${JSON.stringify(sheetUrl || 'PASTE_THE_GOOGLE_SHEET_URL_HERE')},
} }];`,
  parse: `// Generated from vera-leads/n8n/weekly-sheet.mjs. Edit there, not here.
${parseSheet.toString()}
return [{ json: parseSheet($input.first().json.stdout, $runIndex, ${MAX_CHECKS}) }];`,
  research: `${rowsOf.toString()}\nreturn rowsOf($('Parse').first().json, 'research');`,
  ready: `${rowsOf.toString()}\nreturn rowsOf($('Parse').first().json, 'ready');`,
  summary: `return [{ json: $('Parse').first().json.summary }];`,
}

// ---------- workflow JSON ----------

export function buildWorkflow({ sheetUrl = process.env.VERA_SHEET_URL, credential = { id: CREDENTIAL_ID, name: CREDENTIAL_NAME } } = {}) {
  const N = (name, type, typeVersion, x, y, parameters, extra = {}) => ({ id: uuid(name), name, type, typeVersion, position: [x, y], parameters, ...extra })
  const ssh = { sshPrivateKey: credential }
  const doc = { __rl: true, value: "={{ $('Settings').first().json.sheetUrl }}", mode: 'url' }
  const append = tab => ({
    operation: 'append', documentId: doc, sheetName: { __rl: true, value: tab, mode: 'name' },
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {},
  })
  const dir = "{{ $('Settings').first().json.dir }}"
  const nodes = [
    N('About this workflow', 'n8n-nodes-base.stickyNote', 1, -40, -260, {
      width: 1500, height: 220, color: 4,
      content: [
        '## vera-leads weekly → Google Sheet',
        'Every Monday 07:00 IST: runs `node vera-leads.mjs weekly` on the VPS (MahaRERA, Naukri, verify, export), then writes the results to the Google Sheet:',
        '- a **new tab named by date**: the Lead Finder to-do list, best firm first (fill in Status as you go)',
        '- **Ready to email**: verified people exported that week · **Summary**: one row of counts and credit balances',
        'Setup: paste the sheet URL in **Settings**, pick your Google credential in the three Google Sheets nodes, and create the tabs **Summary** and **Ready to email** in the sheet once. Generated from `vera-leads/n8n/weekly-sheet.mjs`.',
      ].join('\n'),
    }),
    N('Monday 07:00', 'n8n-nodes-base.scheduleTrigger', 1.2, 0, 0, { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 7, triggerAtMinute: 0 }] } }),
    N('Settings', 'n8n-nodes-base.code', 2, 220, 0, { jsCode: code.settings(sheetUrl) }),
    N('Start weekly run', 'n8n-nodes-base.ssh', 1, 440, 0, {
      authentication: 'privateKey',
      command: `=cd ${dir} && mkdir -p data && nohup node vera-leads.mjs weekly > data/weekly-$(date +%F).log 2>&1 < /dev/null & echo started`,
    }, { credentials: ssh }),
    N('Wait 75 min', 'n8n-nodes-base.wait', 1.1, 660, 0, { amount: 75, unit: 'minutes' }, { webhookId: uuid('wait75') }),
    N('Read results', 'n8n-nodes-base.ssh', 1, 880, 0, { authentication: 'privateKey', command: `=cd ${dir} && node vera-leads.mjs sheet` }, { credentials: ssh }),
    N('Parse', 'n8n-nodes-base.code', 2, 1100, 0, { jsCode: code.parse }),
    N('Finished?', 'n8n-nodes-base.if', 2, 1320, 0, {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ id: uuid('cond-done'), leftValue: '={{ $json.done }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    }),
    N('Wait 20 min', 'n8n-nodes-base.wait', 1.1, 1100, 220, { amount: 20, unit: 'minutes' }, { webhookId: uuid('wait20') }),
    N('New tab for the week', 'n8n-nodes-base.googleSheets', 4.5, 1560, -160, { operation: 'create', documentId: doc, title: "={{ $('Parse').first().json.date }}", options: {} }, { onError: 'continueRegularOutput' }),
    N('To-do rows', 'n8n-nodes-base.code', 2, 1780, -160, { jsCode: code.research }),
    N('Write to-do list', 'n8n-nodes-base.googleSheets', 4.5, 2000, -160, { ...append("={{ $('Parse').first().json.date }}") }),
    N('Ready rows', 'n8n-nodes-base.code', 2, 1560, 0, { jsCode: code.ready }),
    N('Append Ready to email', 'n8n-nodes-base.googleSheets', 4.5, 1780, 0, append('Ready to email')),
    N('Summary row', 'n8n-nodes-base.code', 2, 1560, 160, { jsCode: code.summary }),
    N('Append Summary', 'n8n-nodes-base.googleSheets', 4.5, 1780, 160, append('Summary')),
  ]
  const to = (...names) => ({ main: [names.map(node => ({ node, type: 'main', index: 0 }))] })
  const connections = {
    'Monday 07:00': to('Settings'),
    Settings: to('Start weekly run'),
    'Start weekly run': to('Wait 75 min'),
    'Wait 75 min': to('Read results'),
    'Read results': to('Parse'),
    Parse: to('Finished?'),
    'Finished?': { main: [
      [{ node: 'New tab for the week', type: 'main', index: 0 }, { node: 'Ready rows', type: 'main', index: 0 }, { node: 'Summary row', type: 'main', index: 0 }],
      [{ node: 'Wait 20 min', type: 'main', index: 0 }],
    ] },
    'Wait 20 min': to('Read results'),
    'New tab for the week': to('To-do rows'),
    'To-do rows': to('Write to-do list'),
    'Ready rows': to('Append Ready to email'),
    'Summary row': to('Append Summary'),
  }
  return {
    id: WORKFLOW_ID, name: 'vera-leads: weekly run → Google Sheet', nodes, connections,
    settings: { executionOrder: 'v1', timezone: 'Asia/Kolkata', saveManualExecutions: true },
    pinData: {}, active: false, tags: [],
  }
}

// ---------- build / deploy ----------

function build() {
  const dir = path.join(here, 'dist')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, WORKFLOW_ID + '.json')
  fs.writeFileSync(file, JSON.stringify(buildWorkflow(), null, 2))
  console.log('wrote', path.relative(process.cwd(), file))
  return file
}

function deploy(flags) {
  const target = process.env.VERA_SSH
  if (!target) { console.error('Set VERA_SSH=user@host first (see the top of this file).'); process.exit(1) }
  const dir = process.env.VERA_DIR || '/opt/vera/Construction/vera-leads'
  const container = process.env.VERA_N8N_CONTAINER || 'n8n'
  const docker = process.env.VERA_SUDO === '1' ? 'sudo docker' : 'docker'
  const ssh = (cmd, opts = {}) => { console.log('$', cmd.length > 160 ? cmd.slice(0, 160) + ' …' : cmd); return execFileSync('ssh', [target, cmd], { stdio: opts.capture ? ['pipe', 'pipe', 'inherit'] : 'inherit', input: opts.input }) }
  const out = cmd => ssh(cmd, { capture: true }).toString().trim()

  // 1. Code: exactly what is committed (so data/, out/ and .env never travel this way).
  if (execFileSync('git', ['status', '--porcelain', '--', '.'], { cwd: root }).toString().trim()) console.log('Note: uncommitted changes in vera-leads are not deployed; commit them first.')
  const tar = execFileSync('git', ['archive', '--format=tar', 'HEAD:vera-leads'], { cwd: root, maxBuffer: 64 << 20 })
  ssh(`mkdir -p ${dir} && tar -x -C ${dir}`, { input: tar })

  // 2. Node 20+ and Chromium for MahaRERA.
  const nodeV = out('node -v 2>/dev/null || echo none')
  if (!/^v(2\d|[3-9]\d)\./.test(nodeV)) {
    console.error(`\nNode 20+ is needed on the VPS (found: ${nodeV}). Install it once, then deploy again:\n  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`)
    process.exit(1)
  }
  ssh(`cd ${dir} && npm ci --omit=dev --no-audit --no-fund && (sudo -n true 2>/dev/null && sudo npx --yes playwright install-deps chromium || echo "skipping system deps (no passwordless sudo)") && npx playwright install chromium && node test/run.mjs`)

  // 3. Keys and data, only when asked and only if the VPS has none (never overwrite the server's copy).
  if (flags.has('--env')) {
    if (out(`test -f ${dir}/.env && echo yes || echo no`) === 'yes') console.log('.env already on the VPS; left as it is.')
    else { execFileSync('scp', [path.join(root, '.env'), `${target}:${dir}/.env`], { stdio: 'inherit' }); ssh(`chmod 600 ${dir}/.env`) }
  }
  if (flags.has('--data')) {
    if (out(`test -f ${dir}/data/accounts.json && echo yes || echo no`) === 'yes') console.log('data/ already on the VPS; left as it is.')
    else execFileSync('scp', ['-r', path.join(root, 'data'), `${target}:${dir}/`], { stdio: 'inherit' })
  }

  // 4. The SSH credential n8n uses to reach this VPS: a key made on the VPS for n8n only, imported straight
  //    into n8n. The private key never leaves the server.
  const user = out('whoami')
  const gateway = out(`${docker} inspect -f '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}' ${container}`).split(/\s+/)[0]
  ssh(`set -e; mkdir -p ~/.ssh && chmod 700 ~/.ssh
    [ -f ~/.ssh/n8n_vera_leads ] || ssh-keygen -q -t ed25519 -N '' -C n8n-vera-leads -f ~/.ssh/n8n_vera_leads
    grep -qF -f ~/.ssh/n8n_vera_leads.pub ~/.ssh/authorized_keys 2>/dev/null || cat ~/.ssh/n8n_vera_leads.pub >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    node -e 'const fs=require("fs");fs.writeFileSync("/tmp/vera-cred.json",JSON.stringify([{id:"${CREDENTIAL_ID}",name:"${CREDENTIAL_NAME}",type:"sshPrivateKey",data:{host:"${gateway}",port:22,username:"${user}",privateKey:fs.readFileSync(process.env.HOME+"/.ssh/n8n_vera_leads","utf8"),passphrase:""}}]))'
    ${docker} cp /tmp/vera-cred.json ${container}:/tmp/vera-cred.json && rm -f /tmp/vera-cred.json
    ${docker} exec ${container} n8n import:credentials --input=/tmp/vera-cred.json
    ${docker} exec ${container} rm -f /tmp/vera-cred.json`)

  // 5. The workflow, imported inactive: it needs your Google credential and the sheet URL before it is switched on.
  const file = build()
  execFileSync('scp', [file, `${target}:/tmp/${WORKFLOW_ID}.json`], { stdio: 'inherit' })
  ssh(`${docker} cp /tmp/${WORKFLOW_ID}.json ${container}:/tmp/${WORKFLOW_ID}.json && ${docker} exec ${container} n8n import:workflow --input=/tmp/${WORKFLOW_ID}.json && rm -f /tmp/${WORKFLOW_ID}.json`)
  console.log(`\nDeployed. In n8n, open "vera-leads: weekly run → Google Sheet":
  1. Settings node: check the sheet URL.
  2. The three Google Sheets nodes: pick your Google credential.
  3. In the sheet, create the tabs "Summary" and "Ready to email".
  4. Test: run "Read results" on its own (it should return done: true after a Monday run), then switch the workflow on.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'build') build()
  else if (cmd === 'deploy') deploy(new Set(rest))
  else console.log('Usage: node n8n/weekly-sheet.mjs build | deploy [--env] [--data]')
}
