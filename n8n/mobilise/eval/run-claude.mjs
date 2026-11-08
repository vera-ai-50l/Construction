#!/usr/bin/env node
// Desk 05: the live Claude test. Run it on your own computer with your API key:
//
//   ANTHROPIC_API_KEY=sk-ant-... npm run eval:claude
//   npm run eval:claude -- --dry-run          (no API calls: checks this script with the answer key)
//   npm run eval:claude -- --only car-ok      (one case)
//
// It sends exactly what the n8n workflows send (same URL, headers, model, answer schema; the
// request bodies come from the same logic.mjs functions), on the sample papers and voice notes
// in this folder, and scores what comes back:
//
//   1. Which line?      Paper or voice note with no line code: does Claude pick the right line
//                       from the open lines, and does the confidence gate file it or ask?
//   2. Reading a paper  Are the fields copied correctly (names, dates, amounts, workers)?
//   3. Paper checks     With what Claude read, do the checks reach the right verdict
//                       (accepted / sent back for the right reason)?
//   4. Report wording   Does the NOC observations answer pass the wording check?
//
// The requests are sent with plain fetch, not the SDK, on purpose: the thing under test is the
// exact HTTP request the n8n HTTP Request nodes make.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as L from '../logic.mjs'
import { linesFor, params as PARAMS } from '../checklist.mjs'
import { CLAUDE, CLAUDE_HEADERS } from '../workflows.mjs'
import { CASES, PHOTO_CASES, VOICE, SITE } from './papers.mjs'
import { sampleVisit, SAMPLE_NARRATIVE } from '../sample-report.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : ''
const KEY = process.env.ANTHROPIC_API_KEY || ''
if (!DRY && !KEY) {
  console.log('Set ANTHROPIC_API_KEY first, e.g.\n  ANTHROPIC_API_KEY=sk-ant-... npm run eval:claude\nor check the script without calls:\n  npm run eval:claude -- --dry-run')
  process.exit(2)
}

const LINES = linesFor({ concrete: 'plant', lifting: true, creche: false, excavation: true }).map((l) => ({ ...l, status: 'open' }))
const lineOf = (code) => LINES.find((l) => l.code === code)
const usage = { input: 0, output: 0, calls: 0 }

// ---------------------------------------------------------------- calling Claude
async function claude(request, oracle) {
  if (DRY) return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(oracle()) }] }
  for (let attempt = 1; ; attempt++) {
    // n8n's node: retry 3 times, 5 s apart, on failures
    const r = await fetch(CLAUDE, { method: 'POST', headers: { ...CLAUDE_HEADERS, 'x-api-key': KEY }, body: JSON.stringify(request) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }))
    if (r.ok) {
      const j = await r.json()
      usage.calls++
      usage.input += (j.usage && j.usage.input_tokens) || 0
      usage.output += (j.usage && j.usage.output_tokens) || 0
      return j
    }
    const body = await r.text()
    if (attempt >= 3 || ![0, 429, 500, 502, 503, 529].includes(r.status)) throw new Error('HTTP ' + r.status + ': ' + body.slice(0, 400))
    await new Promise((res) => setTimeout(res, 5000 * attempt))
  }
}

const media = (file) => {
  const buf = fs.readFileSync(path.join(here, 'papers', file))
  return { b64: buf.toString('base64'), mime: file.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' }
}
const parseFields = (res) => {
  // same as the "Parse the fields" node
  const tb = (res.content || []).find((b) => b.type === 'text')
  try { return res.stop_reason === 'end_turn' ? JSON.parse(tb.text) : null } catch { return null }
}

// ---------------------------------------------------------------- the answer key, for --dry-run
const classifyOracle = (line) => () => ({ line_code: line, confidence: 0.95, alternatives: [], evidence_kind: 'pdf', doc_type: (lineOf(line) || {}).docType || 'not_a_paper', readable: true, suspicious: false, reason: 'answer key' })
const extractOracle = (c) => () => ({
  doc_type: c.docType, holder_name: null, site_address: null, document_number: null, issuer: null, issue_date: null, valid_from: null, valid_to: null, next_due_date: null,
  workers_covered: null, sum_insured_inr: null, principal_named: null, officers_count: null, serial_number: null, contains_unmasked_id: false, readable: true, ...c.fields,
})

// ---------------------------------------------------------------- scoring helpers
const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
function fieldMatches(key, want, got) {
  if (typeof want === 'number') return Number(got) === want
  if (typeof want === 'boolean') return got === want
  if (/date|valid_/.test(key)) return String(got) === want
  if (key === 'site_address') return norm(got).includes(norm(want).split(' ').filter((w) => /majiwada|wagle/.test(w))[0] || norm(want))
  return norm(got).includes(norm(want).replace(/ pvt ltd$/, '')) || norm(want).includes(norm(got))
}

// ---------------------------------------------------------------- the cases
const rows = []
const push = (o) => { rows.push(o); console.log((o.ok ? 'PASS ' : 'FAIL ') + o.id.padEnd(30) + o.what.padEnd(14) + o.detail) }

async function whichLine(id, message, mediaFile, want, prompts = []) {
  const binding = L.bindLine({ message, lines: LINES, prompts })
  if (binding.line) return push({ id, what: 'which line', ok: binding.line === want, detail: 'bound without AI: ' + binding.line + ' (' + binding.method + ')' })
  const input = { message, lines: LINES, binding, __media: mediaFile ? media(mediaFile) : undefined }
  const req = L.buildClassifyRequest(input).request
  const res = await claude(req, classifyOracle(want))
  const g = L.gateMatch({ ai: res, binding })
  const top = g.decision === 'auto' ? g.line : (g.options || [])[0] || ''
  const conf = g.confidence != null ? g.confidence : g.ai_answer ? g.ai_answer.confidence : null
  push({
    id, what: 'which line', ok: top === want,
    detail: 'want ' + want + ', got ' + (top || 'nothing') + ' · ' + g.decision + (conf != null ? ' at ' + conf : '') + ' · ' + binding.candidates.length + ' choices' + (g.reason ? ' · ' + String(g.reason).slice(0, 80) : ''),
    decision: g.decision, confidence: conf, answer: g.ai_answer || null,
  })
}

async function readPaper(c, file) {
  const id = c.id + (file.endsWith('.jpg') ? ' (photo)' : '')
  const line = lineOf(c.line)
  const req = L.buildExtractRequest({ line, __media: media(file) }).request
  const res = await claude(req, extractOracle(c))
  const fields = parseFields(res)
  if (!fields) return push({ id, what: 'read paper', ok: false, detail: 'no clean answer (stop_reason ' + res.stop_reason + ')' })
  const wrong = Object.entries(c.fields).filter(([k, v]) => !fieldMatches(k, v, fields[k])).map(([k, v]) => k + ': want ' + JSON.stringify(v) + ', got ' + JSON.stringify(fields[k]))
  push({ id, what: 'read paper', ok: !wrong.length, detail: wrong.length ? wrong.join('; ') : Object.keys(c.fields).length + ' fields right', fields })
  const paper = L.checkPaper({ line, fields, mob: SITE, params: PARAMS }).paper
  const failing = paper.checks.filter((x) => x.result === 'fail').map((x) => x.rule)
  const ok = paper.status === c.expect && (c.failing || []).every((f) => failing.includes(f))
  push({ id, what: 'paper checks', ok, detail: 'want ' + c.expect + (c.failing ? ' (' + c.failing.join(', ') + ')' : '') + ', got ' + paper.status + (failing.length ? ' (' + failing.join(', ') + ')' : '') + (ok ? '' : ' · ' + paper.checks.filter((x) => x.result !== 'pass').map((x) => x.note).join('; ').slice(0, 160)) })
}

async function wording() {
  const visit = sampleVisit()
  const req = L.buildNarrativeRequest(visit).request
  const res = await claude(req, () => SAMPLE_NARRATIVE)
  const n = L.checkNarrative({ ...visit, ai: res })
  const remarked = new Set(((n.narrative && n.narrative.remarks_en) || []).map((r) => r.line))
  const missing = (visit.remarks || []).map((r) => r.line).filter((l) => !remarked.has(l))
  push({ id: 'noc-wording', what: 'report words', ok: n.narrative_ok && !missing.length, detail: n.narrative_ok ? (missing.length ? 'remarks not translated: ' + missing.join(', ') : (n.narrative.areas || []).length + ' area observations, ' + remarked.size + ' remarks in English') : 'failed the check: ' + n.narrative_problems.join('; '), narrative: n.narrative })
}

const jobs = []
for (const c of CASES) {
  if (only && !c.id.startsWith(only)) continue
  jobs.push(() => whichLine(c.id, { type: 'document', filename: 'scan_0001.pdf', caption: '' }, c.id + '.pdf', c.line))
  jobs.push(() => readPaper(c, c.id + '.pdf'))
  if (PHOTO_CASES.includes(c.id)) {
    jobs.push(() => whichLine(c.id + ' (photo)', { type: 'image', caption: '' }, c.id + '-photo.jpg', c.line))
    jobs.push(() => readPaper(c, c.id + '-photo.jpg'))
  }
}
for (const v of VOICE) {
  if (only && !v.id.startsWith(only)) continue
  // a voice note sent as a reply to that area's message, with no line number in it
  jobs.push(() => whichLine(v.id, { type: 'audio', text: v.text, transcript_lang: v.lang, context_wamid: 'wamid.AREA_' + v.area }, '', v.line, [{ wamid: 'wamid.AREA_' + v.area, kind: 'area', area: v.area }]))
}
if (!only || 'noc-wording'.startsWith(only)) jobs.push(wording)

console.log((DRY ? 'Dry run (answer key, no API calls)' : 'Live run against ' + CLAUDE) + ' · ' + jobs.length + ' steps\n')
const queue = jobs.slice()
await Promise.all([1, 2, 3].map(async () => {
  while (queue.length) {
    const job = queue.shift()
    try { await job() } catch (e) { push({ id: 'error', what: 'call', ok: false, detail: e.message }) }
  }
}))

const by = (w) => rows.filter((r) => r.what === w)
const line = (w, label) => { const r = by(w); if (r.length) console.log(label.padEnd(26) + r.filter((x) => x.ok).length + ' / ' + r.length) }
console.log('\nSummary')
line('which line', 'Right line chosen')
line('read paper', 'Paper read correctly')
line('paper checks', 'Right verdict on paper')
line('report words', 'Report wording passed')
const auto = by('which line').filter((r) => r.decision === 'auto')
if (auto.length) console.log('Filed without asking'.padEnd(26) + auto.length + ' (' + auto.filter((r) => r.ok).length + ' of them right)')
if (!DRY) console.log('Claude calls'.padEnd(26) + usage.calls + ' · ' + usage.input + ' input + ' + usage.output + ' output tokens')
const failed = rows.filter((r) => !r.ok).length
fs.mkdirSync(path.join(here, 'results'), { recursive: true })
const file = path.join(here, 'results', (DRY ? 'dry-' : 'live-') + new Date().toISOString().replace(/[:.]/g, '-') + '.json')
fs.writeFileSync(file, JSON.stringify({ dry: DRY, model: 'from logic.mjs', usage, rows }, null, 1))
console.log('\nDetails: ' + path.relative(process.cwd(), file))
console.log(failed ? '\n' + failed + ' step(s) failed. A wrong line or verdict here is what shadow mode and the review queue catch; send me the details file.' : '\nAll steps passed.')
process.exit(failed ? 1 : 0)
