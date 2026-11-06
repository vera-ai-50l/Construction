// Tests for Desk 05. Run with: node n8n/mobilise/build.mjs check
// Plain asserts on the decision functions, plus runs of the generated Code-node source
// (the exact text n8n will run) for the nodes that use crypto, binary data or $env.

import crypto from 'node:crypto'
import * as L from './logic.mjs'
import { lines as TEMPLATE, areas as AREAS, params as PARAMS } from './checklist.mjs'
import { IDS } from './workflows.mjs'
import { runCode, nodeNamed } from './build.mjs'

const t = (label, ok, got) => [label, !!ok, got]

// A sample site: Thane, 450 workers at peak, on-site batching plant, tower crane.
export const MOB = {
  project: 'Sample Tower B, Thane', contractor_name: 'Shree Ganesh Constructions Pvt. Ltd.', contractor_aliases: ['SGC', 'Shree Ganesh Construction'],
  site_address: 'Plot 12, Majiwada, Thane West', site_keywords: ['majiwada', 'plot 12'],
  start_date: '2026-11-20', visit_date: '2026-11-18', contract_end: '2028-05-31', contract_value_inr: 1_250_000_000, peak_workers: 450, template_version: 'mob-v1',
}

function site(flags = { concrete: 'plant', lifting: true, creche: false, excavation: true }) {
  const s = L.validateSetup({ ...MOB, ...flagsToForm(flags), contract_value_inr: String(MOB.contract_value_inr), peak_workers: String(MOB.peak_workers), contractor_aliases: MOB.contractor_aliases.join(', '), site_keywords: MOB.site_keywords.join(', '), contractor_phone: '+91 98200 00001', engineer_phone: '91 98200 00002' })
  return L.instantiateChecklist({ ...s, template: TEMPLATE, areas: AREAS })
}
const flagsToForm = (f) => ({ concrete: f.concrete, lifting: f.lifting ? 'yes' : 'no', creche: f.creche ? 'yes' : 'no', excavation: f.excavation ? 'yes' : 'no' })
const asLines = (rows) => rows.map((r) => ({ ...r, docType: r.doc_type }))

const claude = (obj, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] })

export async function runTests() {
  const R = []
  const S = site()
  const lines = asLines(S.checklist)
  const rmcSite = site({ concrete: 'rmc', lifting: false, creche: true, excavation: false })

  // ---- setup
  R.push(t('setup: form validates and cleans phones', S.valid && S.clean.contractor_phone === '919820000001', S.errors))
  R.push(t('setup: bad form gives reasons', L.validateSetup({ project: '', visit_date: '2026-12-01', start_date: '2026-11-20' }).errors.length >= 5, null))
  R.push(t(`setup: plant site gets ${S.checklist.length} lines, RMC site ${rmcSite.checklist.length}`, S.checklist.length !== rmcSite.checklist.length && S.checklist.some((l) => l.code === 'PAP-06') && !rmcSite.checklist.some((l) => l.code === 'PAP-06') && rmcSite.checklist.some((l) => l.code === 'PAP-08'), [S.checklist.length, rmcSite.checklist.length]))
  R.push(t('setup: template has 77 lines in 7 areas, codes unique', TEMPLATE.length === 77 && AREAS.length === 7 && new Set(TEMPLATE.map((l) => l.code)).size === 77, TEMPLATE.length))
  const prompts = L.buildAreaPrompts({ ...S, mobilisation_id: 1, contractor_contact_id: 7 })
  R.push(t('setup: one area prompt per area, numbered lines', prompts.length === S.checklist_areas.length && prompts[0].request.body.text.body.includes('Reply to *this message*'), prompts.length))

  // ---- webhook explode
  const hook = { inbox_id: 9, body: { object: 'whatsapp_business_account', entry: [{ id: 'W', changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: '111' }, contacts: [{ wa_id: '919820000001', profile: { name: 'Site Engg' } }],
    messages: [
      { from: '919820000001', id: 'wamid.A', timestamp: '1763450000', type: 'image', image: { id: 'MEDIA1', mime_type: 'image/jpeg', sha256: 'x', caption: 'toilet block 3' }, context: { from: '91', id: 'wamid.PROMPT_LC' } },
      { from: '919820000001', id: 'wamid.B', timestamp: '1763450001', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'bind:55:LC-03', title: 'LC-03' } } },
    ],
    statuses: [{ id: 'wamid.OUT1', status: 'failed', recipient_id: '9198', timestamp: '1', errors: [{ code: 131047, title: 'Re-engagement message' }] }],
  } }] }] } }
  const ev = L.explodeEvents(hook)
  R.push(t('router: one item per message and status', ev.length === 3 && ev[0].caption === 'toilet block 3' && ev[0].context_wamid === 'wamid.PROMPT_LC' && ev[1].interactive.id === 'bind:55:LC-03' && ev[2].errors[0].code === 131047, ev.map((e) => e.kind)))
  R.push(t('router: empty body gives one "empty" item', L.explodeEvents({ body: {} })[0].kind === 'empty', null))

  // ---- binding
  const promptsSent = [
    { wamid: 'wamid.PROMPT_LC', kind: 'area', area: 'LC' },
    { wamid: 'wamid.LINE_PAP4', kind: 'line', line: 'PAP-04' },
    { wamid: 'wamid.ITEM_SF8', kind: 'open_item', line: 'SF-08' },
  ]
  const bind = (message, extra = {}) => L.bindLine({ message, lines, prompts: promptsSent, ...extra })
  R.push(t('bind: reply to area prompt + "3" → LC-03 (certain)', (() => { const b = bind({ type: 'image', caption: '3', context_wamid: 'wamid.PROMPT_LC' }); return b.line === 'LC-03' && b.method === 'area-reply-number' })(), bind({ type: 'image', caption: '3', context_wamid: 'wamid.PROMPT_LC' })))
  R.push(t('bind: code in caption, any spelling (lc 3, LC03, Lc-3)', ['lc 3', 'LC03', 'Lc-3 toilets', 'photo for LC_3'].every((c) => bind({ type: 'image', caption: c }).line === 'LC-03'), ['lc 3', 'LC03'].map((c) => bind({ type: 'image', caption: c }))))
  R.push(t('bind: code in PDF file name (CAR_PAP-04.pdf)', bind({ type: 'document', filename: 'CAR_PAP-04_policy.pdf' }).line === 'PAP-04', null))
  R.push(t('bind: reply to an open-item reminder → that item', bind({ type: 'image', context_wamid: 'wamid.ITEM_SF8' }).method === 'reply-to-open-item', null))
  R.push(t('bind: two codes in one caption → ask, never pick one', (() => { const b = bind({ type: 'image', caption: 'LC-03 and LC-05' }); return !b.line && b.ask && !b.needsAi })(), null))
  R.push(t('bind: picked from list 4 min ago → that line', bind({ type: 'image' }, { pendingPick: { line: 'SY-01', at: Date.now() - 4 * 60000 } }).line === 'SY-01', null))
  R.push(t('bind: picked 15 min ago → expired, goes to AI', bind({ type: 'image' }, { pendingPick: { line: 'SY-01', at: Date.now() - 15 * 60000 } }).needsAi, null))
  const aiArea = bind({ type: 'image', caption: 'yeh dekho', context_wamid: 'wamid.PROMPT_LC' })
  R.push(t('bind: reply to area prompt, no number → AI chooses only among that area', aiArea.needsAi && aiArea.candidates.length === 13 && aiArea.candidates.every((c) => c.startsWith('LC-')), aiArea.candidates.length))
  const aiDoc = bind({ type: 'document', filename: 'scan0001.pdf' })
  R.push(t('bind: unlabelled PDF → AI, photo-only lines excluded', aiDoc.needsAi && !aiDoc.candidates.includes('LC-03') && aiDoc.candidates.includes('PAP-04'), aiDoc.candidates.length))
  const closed = lines.map((l) => (l.area === 'LC' ? { ...l, status: 'ok' } : l))
  R.push(t('bind: lines already closed are not candidates', L.bindLine({ message: { type: 'image', context_wamid: 'wamid.PROMPT_LC' }, lines: closed, prompts: promptsSent }).candidates.every((c) => !c.startsWith('LC-')), null))
  R.push(t('bind: plain text is not evidence', bind({ type: 'text', text: 'kal aayenge' }).method === 'not-evidence', null))

  // ---- classify request: schema enum is the candidate list
  const cr = L.buildClassifyRequest({ message: { type: 'image', caption: 'yeh dekho' }, lines, binding: aiArea, __media: { b64: 'AAAA', mime: 'image/jpeg' } })
  const enumCodes = cr.request.output_config.format.schema.properties.line_code.enum
  R.push(t('AI request: answer limited to 13 open lines + NONE', enumCodes.length === 14 && enumCodes.includes('NONE') && !enumCodes.includes('PAP-04'), enumCodes.length))
  R.push(t('AI request: image sent as base64 block; media not carried forward', cr.request.messages[0].content[0].type === 'image' && cr.__media === undefined, null))
  R.push(t('AI request: model, effort and fallbacks set', cr.request.model === 'claude-opus-5-5' && cr.request.output_config.effort === 'low' && cr.request.fallbacks === 'default', null))
  const vr = L.buildClassifyRequest({ message: { type: 'audio', text: 'labour camp mein paani ka tank dekh lo', transcript_lang: 'hi-IN' }, lines, binding: aiArea })
  R.push(t('AI request: voice note sends the transcript, not audio', vr.request.messages[0].content[0].type === 'text' && vr.request.messages[0].content[0].text.includes('paani'), null))

  // ---- confidence gate
  const gate = (ai, extra = {}) => L.gateMatch({ ai, binding: aiArea, ...extra })
  const ans = (o) => ({ line_code: 'LC-03', confidence: 0.95, alternatives: [{ line_code: 'LC-04', confidence: 0.3 }], evidence_kind: 'site_photo', doc_type: 'not_a_paper', readable: true, suspicious: false, reason: 'toilet block', ...o })
  R.push(t('gate: 0.95 with clear lead → auto-file', gate(claude(ans())).decision === 'auto', gate(claude(ans()))))
  R.push(t('gate: 0.95 but runner-up 0.8 → ask sender (top 2 as buttons)', (() => { const g = gate(claude(ans({ alternatives: [{ line_code: 'LC-04', confidence: 0.8 }] }))); return g.decision === 'confirm' && g.options[0] === 'LC-03' && g.options[1] === 'LC-04' })(), null))
  R.push(t('gate: 0.6 → ask sender', gate(claude(ans({ confidence: 0.6, alternatives: [] }))).decision === 'confirm', null))
  R.push(t('gate: unreadable → person', gate(claude(ans({ readable: false }))).decision === 'human', null))
  R.push(t('gate: looks reused / other project → person', gate(claude(ans({ suspicious: true }))).decision === 'human', null))
  R.push(t('gate: code outside the candidate list → person', gate(claude(ans({ line_code: 'PAP-04' }))).decision === 'human', null))
  R.push(t('gate: not JSON → person', gate(claude('sure! it is LC-03')).decision === 'human', null))
  R.push(t('gate: refusal → person', gate(claude(ans(), 'refusal')).decision === 'human', null))
  R.push(t('gate: NONE → ask sender with list', gate(claude(ans({ line_code: 'NONE', confidence: 0.9, alternatives: [] }))).decision === 'confirm', null))

  // ---- confirm buttons
  const cb2 = L.buildConfirm({ options: ['LC-03', 'LC-04'], lines, evidence_id: 55 })
  const cb3 = L.buildConfirm({ options: ['LC-03', 'LC-04', 'LC-05'], lines, evidence_id: 55 })
  R.push(t('confirm: ≤2 options → 3 buttons (WhatsApp max), titles ≤ 20 chars', cb2.request.body.interactive.type === 'button' && cb2.request.body.interactive.action.buttons.length === 3 && cb2.request.body.interactive.action.buttons.every((b) => b.reply.title.length <= 20), null))
  R.push(t('confirm: 3 options → list (≤10 rows, titles ≤ 24)', cb3.request.body.interactive.type === 'list' && cb3.request.body.interactive.action.sections[0].rows.every((r) => r.title.length <= 24 && r.description.length <= 72), null))
  R.push(t('answer: contractor cannot sign the NOC', L.parseAnswer({ message: { interactive: { id: 'sign:3:approve' } }, contact_role: 'contractor' }).answer.ok === false, null))
  R.push(t('answer: engineer can sign', L.parseAnswer({ message: { interactive: { id: 'sign:3:approve' } }, contact_role: 'engineer', contact_id: 2 }).answer.ok === true, null))

  // ---- paper checks (deterministic)
  const car = lines.find((l) => l.code === 'PAP-04')
  const carFields = { doc_type: 'car_policy', holder_name: 'M/s Shree Ganesh Constructions Private Limited', site_address: 'Plot No. 12, Majiwada, Thane (W) 400601', valid_from: '2026-11-01', valid_to: '2028-08-31', workers_covered: null, sum_insured_inr: 1_300_000_000, principal_named: true, readable: true, contains_unmasked_id: false }
  const chk = (fields, line = car) => L.checkPaper({ line, fields, mob: MOB, params: PARAMS })
  R.push(t('paper: CAR policy with all facts right → accepted', chk(carFields).paper.status === 'accepted', chk(carFields).paper.checks))
  R.push(t('paper: sum insured below contract value → rejected, says why', (() => { const c = chk({ ...carFields, sum_insured_inr: 900_000_000 }).paper; return c.status === 'rejected' && c.checks.some((x) => x.rule === 'sumInsuredCoversContract' && x.note.includes('₹90,00,00,000')) })(), chk({ ...carFields, sum_insured_inr: 900_000_000 }).paper.checks))
  R.push(t('paper: developer not named as principal → rejected', chk({ ...carFields, principal_named: false }).paper.status === 'rejected', null))
  R.push(t('paper: validity date not read → review (no guess)', chk({ ...carFields, valid_to: null }).paper.status === 'review', null))
  R.push(t('paper: another site\'s address → rejected', chk({ ...carFields, site_address: 'Wagle Estate, Thane' }).paper.status === 'rejected', null))
  R.push(t('paper: different company name → rejected', chk({ ...carFields, holder_name: 'Om Sai Infra LLP' }).paper.status === 'rejected', null))
  const lic = lines.find((l) => l.code === 'PAP-02')
  R.push(t('paper: labour licence for 300 workers, peak 450 → rejected', chk({ doc_type: 'labour_licence', holder_name: 'SGC', site_address: 'Majiwada Thane', valid_to: '2027-12-31', workers_covered: 300 }, lic).paper.status === 'rejected', null))
  R.push(t('paper: licence expiring 30 days after start → rejected (needs 90)', chk({ doc_type: 'labour_licence', holder_name: 'SGC', site_address: 'Majiwada Thane', valid_to: '2026-12-20', workers_covered: 500 }, lic).paper.status === 'rejected', null))
  const worker = lines.find((l) => l.code === 'PAP-14')
  R.push(t('paper: worker list with full Aadhaar visible → rejected, ask for masked copy', chk({ doc_type: 'worker_list', contains_unmasked_id: true, readable: true }, worker).paper.status === 'rejected', null))
  const cal = lines.find((l) => l.code === 'PAP-06')
  R.push(t('paper: calibration 8 months old, no due date → rejected', chk({ doc_type: 'calibration_certificate', issue_date: '2026-03-01', next_due_date: null }, cal).paper.status === 'rejected', null))
  R.push(t('paper: calibration due after the visit → accepted', chk({ doc_type: 'calibration_certificate', issue_date: '2026-03-01', next_due_date: '2027-03-01' }, cal).paper.status === 'accepted', null))
  R.push(t('paper: wrong kind of paper for the line → review', chk({ ...carFields, doc_type: 'wc_policy' }).paper.status === 'review', null))

  // ---- text commands
  R.push(t('text: "baki kya hai" → gap list', L.readTextCommand({ message: { text: 'Sir baki kya hai' } }).command === 'gap_list', null))
  R.push(t('text: "LC-10 NA creche not needed" → N/A request for LC-10', (() => { const c = L.readTextCommand({ message: { text: 'LC-10 NA creche not needed, no women workers' } }); return c.command === 'request_na' && c.line === 'LC-10' })(), L.readTextCommand({ message: { text: 'LC-10 NA creche not needed' } })))

  // ---- geofence
  const camp = { area: 'LC', name: 'Labour camp', polygon: [[19.2100, 72.9700], [19.2100, 72.9710], [19.2092, 72.9710], [19.2092, 72.9700]] }
  const yard = { area: 'SY', name: 'Stores yard', circle: { lat: 19.2120, lng: 72.9720, radius_m: 30 } }
  const geo = (gps, line_area = 'LC') => L.geofence({ gps, zones: [camp, yard], line_area, params: PARAMS.geofence }).geo
  R.push(t('GPS: middle of camp, ±6 m → in', geo({ lat: 19.2096, lng: 72.9705, accuracy: 6 }).result === 'in', geo({ lat: 19.2096, lng: 72.9705, accuracy: 6 })))
  R.push(t('GPS: 20 m outside camp, ±25 m → edge (not "out")', geo({ lat: 19.20902, lng: 72.9705, accuracy: 25 }).result === 'edge', geo({ lat: 19.20902, lng: 72.9705, accuracy: 25 })))
  R.push(t('GPS: at the stores yard with a camp line → out, names nearest area', (() => { const g = geo({ lat: 19.2120, lng: 72.9720, accuracy: 8 }); return g.result === 'out' && g.nearest === 'SY' })(), geo({ lat: 19.2120, lng: 72.9720, accuracy: 8 })))
  R.push(t('GPS: ±90 m fix far away → unknown, never "out"', geo({ lat: 19.2140, lng: 72.9740, accuracy: 90 }).result === 'unknown', geo({ lat: 19.2140, lng: 72.9740, accuracy: 90 })))
  R.push(t('GPS: no fix → unknown, capture still saved', geo(null).result === 'unknown', null))
  R.push(t('GPS: circle zone (contractor pin) works', geo({ lat: 19.21205, lng: 72.97205, accuracy: 5 }, 'SY').result === 'in', null))

  const cov = L.walkCoverage({ zones: [camp, yard], walk_areas: ['LC', 'SY', 'BP'], params: PARAMS.geofence, trail: [
    { lat: 19.2096, lng: 72.9705, accuracy: 8, ts: '2026-11-18T10:00:00+05:30' }, { lat: 19.2097, lng: 72.9706, accuracy: 9, ts: '2026-11-18T10:24:00+05:30' },
    { lat: 19.2120, lng: 72.9720, accuracy: 60, ts: '2026-11-18T10:40:00+05:30' },
  ] }).coverage
  R.push(t('coverage: camp walked 24 min; yard only a ±60 m fix → not counted; plant area not drawn', cov.areas[0].visited && cov.areas[0].minutes === 24 && !cov.areas[1].visited && !cov.areas[2].drawn, cov.areas))

  // ---- capture validation
  const cap = { capture_id: crypto.randomUUID(), line: 'LC-03', status: 'not_ok', gps: { lat: 19.2, lng: 72.9, accuracy: 7 }, client_ts: new Date().toISOString() }
  R.push(t('capture: valid capture passes', L.validateCapture({ body: cap, visit_lines: ['LC-03'] }).valid, L.validateCapture({ body: cap, visit_lines: ['LC-03'] }).errors))
  R.push(t('capture: unknown line / bad id / bad status rejected', L.validateCapture({ body: { ...cap, capture_id: '12', status: 'great' }, visit_lines: ['LC-03'] }).errors.length === 2 && !L.validateCapture({ body: { ...cap, line: 'ZZ-01' }, visit_lines: ['LC-03'] }).valid, null))

  // ---- gap list and window
  const withStatus = lines.map((l) => (l.code === 'PAP-03' ? { ...l, status: 'accepted' } : l.code === 'PAP-04' ? { ...l, status: 'rejected', reason: 'Sum insured below contract value' } : l))
  const gl = L.gapList({ mob: MOB, lines: withStatus, now: Date.parse('2026-11-15T19:00:00+05:30'), last_inbound_ms: Date.parse('2026-11-15T11:00:00+05:30') })
  R.push(t('gap list: counts, sent-back reason, critical marked, inside window → free message', gl.gap.mode === 'session' && gl.gap.text.includes('PAP-04') && gl.gap.text.includes('Sum insured below') && gl.gap.text.includes('3 days') && !gl.gap.ready_to_travel, gl.gap.text.split('\n').slice(0, 4)))
  R.push(t('gap list: no message from them in 24 h → template', L.gapList({ mob: MOB, lines: withStatus, now: Date.parse('2026-11-15T19:00:00+05:30'), last_inbound_ms: Date.parse('2026-11-14T10:00:00+05:30') }).gap.mode === 'template', null))

  // ---- sending
  const now = Date.parse('2026-11-15T19:00:00Z')
  R.push(t('send: inside window → session message', L.chooseSendMode({ phone: '919820000001', last_inbound_at: '2026-11-15T10:00:00Z', now, request: { body: { type: 'text', text: { body: 'x' } } } }).mode === 'session', null))
  R.push(t('send: outside window with template → template', L.chooseSendMode({ phone: '919820000001', last_inbound_at: '2026-11-13T10:00:00Z', now, request: { body: {}, template: { name: 'vera_mob_gap_list', params: ['a'] } } }).mode === 'template', null))
  R.push(t('send: outside window, no template → not sent, logged', L.chooseSendMode({ phone: '919820000001', last_inbound_at: '2026-11-13T10:00:00Z', now, request: { body: {} } }).can_send === false, null))
  R.push(t('send: rate limit 131056 → retry, then a person after 3', L.classifySendError({ error: { message: '(#131056) pair rate limit', code: 131056 }, attempt: 0 }).send_error.action === 'retry' && L.classifySendError({ error: { code: 131056 }, attempt: 2 }).send_error.action === 'review', null))
  R.push(t('send: 131047 window closed → switch to template', (() => { const e = L.classifySendError({ error: { code: 131047 } }); return e.send_error.action === 'needs_template' && L.chooseSendMode({ ...e, phone: '919820000001', last_inbound_at: new Date().toISOString(), request: { body: { type: 'text' }, template: { name: 't' } } }).mode === 'template' })(), null))

  // ---- replies
  const rep = L.composeReply({ fragments: [{ kind: 'accepted', line: 'PAP-03' }, { kind: 'filed', line: 'LC-03', photo: true }, { kind: 'filed', line: 'LC-05', photo: true }, { kind: 'rejected', line: 'PAP-04', reason: 'Sum insured below contract value' }], open_count: 9 })
  R.push(t('reply: 4 items → 1 message', rep.reply.split('\n').length === 4 && rep.reply.includes('LC-03, LC-05'), rep.reply))

  // ---- scoring and the report
  const walked = lines.map((l) => ({ ...l, status: l.when === 'paper' ? 'accepted' : 'ok', photos: 1 }))
  const sc = (ls, c = [{ area: 'LC', visited: true }, { area: 'SY', visited: true }]) => L.scoreVisit({ lines: ls, coverage: { areas: c }, visit_date: MOB.visit_date }).score
  R.push(t('score: everything closed and walked → ready', sc(walked).recommendation === 'ready', sc(walked).recommendation))
  R.push(t('score: one major open → ready with conditions, due in 7 days', (() => { const s = sc(walked.map((l) => (l.code === 'SY-02' ? { ...l, status: 'not_ok', remark: 'FIFO board missing' } : l))); return s.recommendation === 'conditional' && s.open_items[0].due_on === '2026-11-25' })(), null))
  R.push(t('score: one critical open → not ready', sc(walked.map((l) => (l.code === 'LC-07' ? { ...l, status: 'not_ok' } : l))).recommendation === 'not_ready', null))
  R.push(t('score: an area with no GPS record → not ready', sc(walked, [{ area: 'LC', visited: true }, { area: 'SY', visited: false }]).recommendation === 'not_ready', null))
  R.push(t('score: share of lines with evidence (the "80% written")', sc(walked).prewritten_pct === 100, sc(walked).prewritten_pct))
  const score = sc(walked.map((l) => (l.code === 'SY-02' ? { ...l, status: 'not_ok', remark: 'FIFO board missing' } : l)))
  const good = { areas: [{ area: 'SY', observation: 'Cement shed is dry and raised. FIFO marking is missing on the stacks.', lines: ['SY-01', 'SY-02'] }], remarks_en: [{ line: 'SY-02', english: 'FIFO board not there.' }] }
  const okN = L.checkNarrative({ ai: claude(good), lines, remarks: [] })
  R.push(t('wording: clean AI wording is used', okN.narrative_ok && okN.narrative.areas.length === 1, okN.narrative_problems))
  const badN = L.checkNarrative({ ai: claude({ areas: [{ area: 'SY', observation: 'NOC granted. All good.', lines: ['SY-99'] }], remarks_en: [] }), lines, remarks: [{ line: 'SY-02', text: 'FIFO board nahi hai' }] })
  R.push(t('wording: invented line or a verdict → falls back to engineer\'s own words', !badN.narrative_ok && badN.narrative.remarks_en[0].english === 'FIFO board nahi hai' && badN.narrative_problems.length === 2, badN.narrative_problems))
  const html = L.renderReport({ mob: MOB, visit_date: MOB.visit_date, score, narrative: good, narrative_ok: true, coverage: { areas: [{ area: 'LC', visited: true, minutes: 24, photo_fixes: 14 }] } }).html
  R.push(t('report: has verdict from code, open items, AI disclosure, signature line', html.includes('Ready to start with conditions') && html.includes('SY-02') && html.includes('not by AI') && html.includes('Signed:'), null))
  R.push(t('report: escapes text from the site', L.renderReport({ mob: { ...MOB, project: '<script>' }, score, narrative: good, narrative_ok: true }).html.includes('&lt;script&gt;'), null))

  // ---- open items
  const rp = L.reminderPlan({ item: { id: 4, line: 'LC-07', severity: 'critical', text: 'RCCB', due_on: '2026-11-18' }, today: '2026-11-20', project: 'Tower B' })
  R.push(t('closure: critical item 2 days overdue → escalate to project head', rp.who === 'escalate' && rp.overdue_days === 2 && rp.escalation.includes('LC-07'), rp))

  // ---- generated Code-node source (what n8n runs)
  const secret = 'test-app-secret'
  const raw = Buffer.from(JSON.stringify(hook.body))
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const sigNode = nodeNamed(IDS.inbound, 'Check Meta signature')
  const okSig = await runCode(sigNode, [{ json: { headers: { 'x-hub-signature-256': sig } }, binary: { data: { data: raw.toString('base64'), mimeType: 'application/json' } } }], { env: { VERA_WA_APP_SECRET: secret } })
  const badSig = await runCode(sigNode, [{ json: { headers: { 'x-hub-signature-256': sig.replace(/.$/, '0') } }, binary: { data: { data: raw.toString('base64') } } }], { env: { VERA_WA_APP_SECRET: secret } })
  const noSecret = await runCode(sigNode, [{ json: { headers: { 'x-hub-signature-256': sig } }, binary: { data: { data: raw.toString('base64') } } }], { env: {} })
  R.push(t('n8n code: Meta signature accepted when right, refused when wrong or secret unset', okSig[0].json.ok && !badSig[0].json.ok && !noSecret[0].json.ok && okSig[0].json.body.entry.length === 1, [okSig[0].json.ok, badSig[0].json.ok, noSecret[0].json.ok]))

  const explodeNode = nodeNamed(IDS.inbound, 'Split into events')
  const exploded = await runCode(explodeNode, [{ json: hook }])
  R.push(t('n8n code: Split into events returns 3 items', exploded.length === 3, exploded.length))

  const photo = Buffer.from('fake-jpeg-bytes')
  const ctxItem = { json: { message: { type: 'image', mime: 'image/jpeg' }, mobilisation_id: 1, known_hashes: [] } }
  const hashNode = nodeNamed(IDS.process, 'Hash and size check')
  const hashed = await runCode(hashNode, [{ json: {}, binary: { data: { data: photo.toString('base64'), mimeType: 'image/jpeg' } } }], { nodes: { 'Load and lock message': ctxItem } })
  const sha = crypto.createHash('sha256').update(photo).digest('hex')
  R.push(t('n8n code: file hashed, S3 key from hash, binary kept', hashed[0].json.file.sha256 === sha && hashed[0].json.s3_key === `mob/1/${sha.slice(0, 2)}/${sha}.jpg` && hashed[0].binary.data && hashed[0].json.file_ok, hashed[0].json))
  const reusedRun = await runCode(hashNode, [{ json: {}, binary: { data: { data: photo.toString('base64'), mimeType: 'image/jpeg' } } }], { nodes: { 'Load and lock message': { json: { ...ctxItem.json, known_hashes: [{ sha256: sha, line_code: 'LC-02' }] } } } })
  R.push(t('n8n code: same file sent again for another line → stopped', !reusedRun[0].json.file_ok && reusedRun[0].json.file.reused_from === 'LC-02', reusedRun[0].json.file))

  const bindNode = nodeNamed(IDS.process, 'Bind to checklist line')
  const bound = await runCode(bindNode, [{ json: { message: { type: 'image', caption: '3', context_wamid: 'wamid.PROMPT_LC' }, lines, prompts: promptsSent }, binary: { data: { data: 'AA==' } } }])
  R.push(t('n8n code: Bind node adds binding and keeps the file', bound[0].json.binding.line === 'LC-03' && bound[0].binary.data, bound[0].json.binding))

  const classifyNode = nodeNamed(IDS.process, 'Build classify request')
  const creq = await runCode(classifyNode, [{ json: { message: { type: 'image', caption: '' }, lines, binding: aiArea }, binary: { data: { data: photo.toString('base64'), mimeType: 'image/jpeg' } } }])
  R.push(t('n8n code: classify request carries the photo as base64', creq[0].json.request.messages[0].content[0].source.data === photo.toString('base64'), null))

  // Walk link: sign in WF-08, verify in WF-03.
  const env = { VERA_WALK_SECRET: 'walk-secret', VERA_WALK_URL: 'https://vera.example/walk' }
  const signed = await runCode(nodeNamed(IDS.setup, 'Sign the walk link'), [{ json: { walk_id: 42, visit_date: '2099-01-01', project: 'Tower B' } }], { env })
  const url = signed[0].json.request.body.text.body.match(/#t=(\S+)/)[1]
  const check = (token, e = env) => runCode(nodeNamed(IDS.walk, 'Check walk link'), [{ json: { headers: { 'x-vera-walk': token } } }], { env: e })
  const good1 = await check(url)
  const forged = await check(url.replace(/^42/, '43'))
  const expiredTok = (await runCode(nodeNamed(IDS.setup, 'Sign the walk link'), [{ json: { walk_id: 42, visit_date: '2020-01-01', project: 'x' } }], { env }))[0].json.request.body.text.body.match(/#t=(\S+)/)[1]
  const expired = await check(expiredTok)
  R.push(t('n8n code: walk link verifies; changed walk id or expired link refused', good1[0].json.walk_ok && good1[0].json.walk_id === 42 && !forged[0].json.walk_ok && !expired[0].json.walk_ok, [good1[0].json.walk_ok, forged[0].json.walk_ok, expired[0].json.walk_ok]))

  const gateNode = nodeNamed(IDS.process, 'Confidence gate')
  const gated = await runCode(gateNode, [{ json: claude(ans()) }], { nodes: { 'Build classify request': { json: { ...creq[0].json } } } })
  R.push(t('n8n code: Confidence gate reads the Claude response node', gated[0].json.decision === 'auto' && gated[0].json.line === 'LC-03' && !gated[0].json.request, gated[0].json.decision))

  return R
}
