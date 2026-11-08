// Tests for Desk 05. Run with: node n8n/mobilise/build.mjs check
// Plain asserts on the decision functions, plus runs of the generated Code-node source
// (the exact text n8n will run) for the nodes that use crypto, binary data or $env.

import crypto from 'node:crypto'
import fs from 'node:fs'
import * as L from './logic.mjs'
import { lines as TEMPLATE, areas as AREAS, params as PARAMS } from './checklist.mjs'
import { IDS } from './workflows.mjs'
import { TEXTS, TEMPLATES } from './messages.mjs'
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
  R.push(t('setup: shadow mode is on unless the form says no', S.clean.flags.shadow === true && L.validateSetup({ ...MOB, shadow: 'no' }).clean.flags.shadow === false, null))
  R.push(t('setup: bad form gives reasons', L.validateSetup({ project: '', visit_date: '2026-12-01', start_date: '2026-11-20' }).errors.length >= 5, null))
  R.push(t(`setup: plant site gets ${S.checklist.length} lines, RMC site ${rmcSite.checklist.length}`, S.checklist.length !== rmcSite.checklist.length && S.checklist.some((l) => l.code === 'PAP-06') && !rmcSite.checklist.some((l) => l.code === 'PAP-06') && rmcSite.checklist.some((l) => l.code === 'PAP-08'), [S.checklist.length, rmcSite.checklist.length]))
  R.push(t('setup: template has 77 lines in 7 areas, codes unique', TEMPLATE.length === 77 && AREAS.length === 7 && new Set(TEMPLATE.map((l) => l.code)).size === 77, TEMPLATE.length))
  const prompts = L.buildAreaPrompts({ ...S, mobilisation_id: 1, contractor_contact_id: 7, texts: TEXTS })
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
  // Real Sarvam saaras:v3 answers (fixtures/sarvam): spoken line codes come back in Devanagari.
  const stt = (f) => JSON.parse(fs.readFileSync(new URL('./fixtures/sarvam/' + f + '.json', import.meta.url)))
  const spoken = { 'hi-lc03': 'LC-03', 'mr-sy01': 'SY-01', 'hinglish-sf08': 'SF-08', 'en-bp06': 'BP-06' }
  const heard = Object.entries(spoken).map(([f, want]) => [f, bind({ type: 'audio', text: stt(f).transcript }), want])
  R.push(t('voice (real Sarvam transcripts): "एल.सी. तीन", "एस.वाय.एक.", "एसएफ आठ", "BP06" → LC-03, SY-01, SF-08, BP-06', heard.every(([, b, want]) => b.line === want && b.method === 'spoken-code'), heard.map(([f, b]) => [f, b.line, b.method])))
  R.push(t('voice: "LC teen", "BP zero six", "PAP chaar", "एल सी बारा" → LC-03, BP-06, PAP-04, LC-12', [['LC teen toilets', 'LC-03'], ['BP zero six lab', 'BP-06'], ['PAP chaar', 'PAP-04'], ['एल सी बारा', 'LC-12']].every(([x, want]) => bind({ type: 'audio', text: x }).line === want), null))
  R.push(t('voice: plain numbers are not line codes ("बारा पोती", "ek do teen") → AI', !bind({ type: 'audio', text: 'बारा पोती उंच थप्पी आहेत' }).line && !bind({ type: 'audio', text: 'ok sir ek do teen' }).line, null))
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
  const cb2 = L.buildConfirm({ options: ['LC-03', 'LC-04'], lines, evidence_id: 55, texts: TEXTS })
  const cb3 = L.buildConfirm({ options: ['LC-03', 'LC-04', 'LC-05'], lines, evidence_id: 55, texts: TEXTS })
  R.push(t('confirm: ≤2 options → 3 buttons (WhatsApp max), titles ≤ 20 chars', cb2.request.body.interactive.type === 'button' && cb2.request.body.interactive.action.buttons.length === 3 && cb2.request.body.interactive.action.buttons.every((b) => b.reply.title.length <= 20), null))
  R.push(t('confirm: 3 options → list (≤10 rows, titles ≤ 24)', cb3.request.body.interactive.type === 'list' && cb3.request.body.interactive.action.sections[0].rows.every((r) => r.title.length <= 24 && r.description.length <= 72), null))
  R.push(t('answer: contractor cannot sign the NOC', L.parseAnswer({ message: { interactive: { id: 'sign:3:approve' } }, contact_role: 'contractor' }).answer.ok === false, null))
  R.push(t('answer: engineer can sign', L.parseAnswer({ message: { interactive: { id: 'sign:3:approve' } }, contact_role: 'engineer', contact_id: 2 }).answer.ok === true, null))
  const pa = (id, role) => L.parseAnswer({ message: { interactive: { id } }, contact_role: role, contact_id: 2 }).answer.ok
  R.push(t('answer: "Show me" works for anyone; review only for reviewers; unknown choices refused', pa('show:latest', 'contractor') && pa('review:9:LC-03', 'reviewer') && !pa('review:9:LC-03', 'contractor') && !pa('close:4:maybe', 'engineer') && pa('close:4:reject', 'engineer') && pa('na:LC-10:reject', 'engineer') && !pa('bind::LC-03', 'contractor'), null))

  // ---- closure, reviewer and "show a file" messages
  R.push(t('bind: reply to an open-item reminder carries the item id', L.bindLine({ message: { type: 'image', context_wamid: 'wamid.ITEM' }, lines, prompts: [{ wamid: 'wamid.ITEM', kind: 'open_item', line: 'SF-08', ref: '12' }] }).open_item === '12', null))
  const ca = L.buildClosureAsk({ open_item_id: 12, line_code: 'SF-08', text: 'Edge protection', finding: 'Missing on slab edge', project: 'Tower B' }).msg
  R.push(t('closure: engineer gets "Accept, close it" / "Not fixed" for that item', ca.buttons[0].id === 'close:12:accept' && ca.buttons[1].id === 'close:12:reject' && ca.text.includes('Missing on slab edge'), ca))
  const open5 = ['LC-03', 'LC-04', 'LC-05', 'LC-06', 'LC-07', 'LC-08', 'LC-09', 'LC-10', 'LC-11'].map((code) => ({ code, text: 'line ' + code }))
  const rv1 = L.buildReviewMessage({ review_id: 9, reviewer_id: 5, evidence_id: 77, reason: 'Low confidence', options: ['LC-05', 'XX-01'], open_lines: open5, message: { caption: 'toilet' } })
  R.push(t('review: unfiled file → suggested line first, ≤ 10 rows, resend and handled', rv1.review_type === 'file' && rv1.msg.buttons[0].id === 'review:9:LC-05' && rv1.msg.buttons.length === 10 && rv1.msg.buttons.some((b) => b.id === 'review:9:resend') && rv1.contact_id === 5 && rv1.msg.text.includes('toilet'), rv1.msg.buttons.map((b) => b.id)))
  const rv2 = L.buildReviewMessage({ review_id: 3, evidence_id: 70, line_code: 'PAP-04', line_evidence: 'document', reason: 'Paper needs a person' })
  R.push(t('review: paper to check → Accept / Send back / Handled', rv2.review_type === 'paper' && rv2.msg.buttons.map((b) => b.id).join() === 'review:3:accept,review:3:reject,review:3:done', null))
  const rv3 = L.buildReviewMessage({ review_id: 4, evidence_id: 0, message_id: 8, reason: 'Download failed' })
  R.push(t('review: no file → ask to resend / handled', rv3.review_type === 'other' && rv3.msg.buttons.length === 2, null))
  const em2 = L.buildEvidenceMessage({ contact_id: 2, kind: 'close', ref: '12', msg: ca, media_id: 'MID', media_mime: 'image/jpeg' })
  R.push(t('show: ≤ 3 answers → one message, photo as header, titles ≤ 20', em2.length === 1 && em2[0].request.body.interactive.header.image.id === 'MID' && em2[0].request.body.interactive.action.buttons.every((b) => b.reply.title.length <= 20) && em2[0].request.summary === 'a fixed item to approve', em2))
  const em10 = L.buildEvidenceMessage({ contact_id: 5, kind: 'review', ref: '9', msg: rv1.msg, media_id: 'MID', media_mime: 'application/pdf' })
  R.push(t('show: 10 answers → the PDF, then a list (rows ≤ 24 / 72 chars)', em10.length === 2 && em10[0].request.body.type === 'document' && em10[1].request.body.interactive.type === 'list' && em10[1].request.body.interactive.action.sections[0].rows.every((r) => r.title.length <= 24 && r.description.length <= 72), em10.map((x) => x.request.body.type)))
  R.push(t('show: file could not be fetched → text and buttons still go', L.buildEvidenceMessage({ msg: rv2.msg, media_id: '' })[0].request.body.interactive.header === undefined, null))
  const rep2 = L.composeReply({ texts: TEXTS, fragments: [{ kind: 'closed', line: 'SF-08' }, { kind: 'reopened', line: 'LC-07' }, { kind: 'na', line: 'LC-10' }, { kind: 'resend', line: '', reason: 'photo unreadable' }] })
  R.push(t('reply: closure, N/A and resend lines read plainly', rep2.reply.includes('Closed by the engineer: SF-08') && rep2.reply.includes('LC-07 still open') && rep2.reply.includes('not applicable') && rep2.reply.includes('Please send again: photo unreadable'), rep2.reply))

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
  R.push(t('text: "SY-08 NA weighbridge not needed" → N/A request for SY-08', (() => { const c = L.readTextCommand({ message: { text: 'SY-08 NA weighbridge not needed, RMC only' }, lines }); return c.command === 'request_na' && c.line === 'SY-08' })(), null))
  R.push(t('text: N/A for a line not on this site (creche line, no creche) → help, engineer not asked', L.readTextCommand({ message: { text: 'LC-10 NA' }, lines }).help === 'unknown_line', null))
  R.push(t('text: a reviewer\'s typed message → reviewer help, never filed', L.readTextCommand({ message: { text: 'ok done' }, contact_role: 'reviewer', lines }).help === 'reviewer', null))

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
  const st = (gps, spot_area, line_area = 'LC') => L.geofence({ gps, zones: [camp, yard], line_area, spot_area, params: PARAMS.geofence }).geo
  R.push(t('sticker: indoors, no GPS, camp sticker scanned → in', st(null, 'LC').result === 'in', st(null, 'LC')))
  R.push(t('sticker: weak GPS but camp sticker → in, GPS result still reported', (() => { const g = st({ lat: 19.2140, lng: 72.9740, accuracy: 90 }, 'LC'); return g.result === 'in' && g.gps_result === 'unknown' && g.note.includes('Sticker') })(), null))
  R.push(t('sticker: yard sticker, camp line → GPS decides, note says which sticker', (() => { const g = st({ lat: 19.2120, lng: 72.9720, accuracy: 8 }, 'SY'); return g.result === 'out' && g.note.includes('last sticker scanned: SY') })(), null))
  const zone = (body) => L.validateZone({ body, areas: ['LC', 'SY'] })
  R.push(t('mark area: circle from a ±8 m fix → saved', zone({ area: 'LC', name: 'Labour camp', shape: { circle: { lat: 19.2096, lng: 72.9705, radius_m: 35, accuracy_m: 8 } } }).valid, null))
  R.push(t('mark area: ±45 m fix / unknown area / 5 m² outline → refused with reasons', !zone({ area: 'LC', shape: { circle: { lat: 19.2, lng: 72.9, radius_m: 35, accuracy_m: 45 } } }).valid && !zone({ area: 'BP', shape: { circle: { lat: 19.2, lng: 72.9, radius_m: 35, accuracy_m: 5 } } }).valid && zone({ area: 'LC', shape: { polygon: [[19.2, 72.9], [19.20001, 72.9], [19.20001, 72.90001]], accuracy_m: 5 } }).errors[0].includes('too small'), null))
  R.push(t('mark area: walked corners of the camp → saved', zone({ area: 'LC', shape: { polygon: camp.polygon, accuracy_m: 9 } }).valid, zone({ area: 'LC', shape: { polygon: camp.polygon, accuracy_m: 9 } }).errors))

  const cov = L.walkCoverage({ zones: [camp, yard], walk_areas: ['LC', 'SY', 'BP'], params: PARAMS.geofence, trail: [
    { lat: 19.2096, lng: 72.9705, accuracy: 8, ts: '2026-11-18T10:00:00+05:30' }, { lat: 19.2097, lng: 72.9706, accuracy: 9, ts: '2026-11-18T10:24:00+05:30' },
    { lat: 19.2120, lng: 72.9720, accuracy: 60, ts: '2026-11-18T10:40:00+05:30' },
  ] }).coverage
  R.push(t('coverage: camp walked 24 min; yard only a ±60 m fix → not counted; plant area not drawn', cov.areas[0].visited && cov.areas[0].minutes === 24 && !cov.areas[1].visited && !cov.areas[2].drawn, cov.areas))
  const cov2 = L.walkCoverage({ zones: [camp], walk_areas: ['LC', 'BP'], params: PARAMS.geofence, trail: [], spots: [{ area: 'BP', ts: '2026-11-18T11:00:00+05:30' }] }).coverage
  const cov3 = L.walkCoverage({ zones: [camp], walk_areas: ['LC'], params: PARAMS.geofence, trail: [], spots: [
    { area: 'LC', ts: '2026-11-18T11:00:00+05:30', gps: { lat: 19.2140, lng: 72.9740, accuracy: 10 } },
    { area: 'LC', ts: '2026-11-18T11:05:00+05:30', gps: { lat: 19.2140, lng: 72.9740, accuracy: 300 } },
  ] }).coverage
  R.push(t('coverage: camp sticker scanned with a good fix 500 m away → not counted, flagged; same with a ±300 m fix → counted', cov3.areas[0].sticker_mismatch === 1 && cov3.areas[0].stickers === 1 && cov3.areas[0].visited, cov3.areas))
  const cov4 = L.walkCoverage({ zones: [camp], walk_areas: ['LC'], params: PARAMS.geofence, trail: [], spots: [{ area: 'LC', ts: '2026-11-18T11:00:00+05:30', gps: { lat: 19.2140, lng: 72.9740, accuracy: 10 } }] }).coverage
  R.push(t('coverage: the only camp record is a far-away sticker scan → camp not walked', !cov4.areas[0].visited && cov4.areas[0].sticker_mismatch === 1, cov4.areas))
  R.push(t('coverage: a sticker scanned in the plant counts as walked, even with no area drawn', cov2.areas[1].visited && cov2.areas[1].stickers === 1 && !cov2.areas[0].visited, cov2.areas))

  // ---- capture validation
  const cap = { capture_id: crypto.randomUUID(), line: 'LC-03', status: 'not_ok', gps: { lat: 19.2, lng: 72.9, accuracy: 7 }, client_ts: new Date().toISOString() }
  R.push(t('capture: valid capture passes', L.validateCapture({ body: cap, visit_lines: ['LC-03'] }).valid, L.validateCapture({ body: cap, visit_lines: ['LC-03'] }).errors))
  R.push(t('capture: unknown line / bad id / bad status rejected', L.validateCapture({ body: { ...cap, capture_id: '12', status: 'great' }, visit_lines: ['LC-03'] }).errors.length === 2 && !L.validateCapture({ body: { ...cap, line: 'ZZ-01' }, visit_lines: ['LC-03'] }).valid, null))

  // ---- gap list and window
  const withStatus = lines.map((l) => (l.code === 'PAP-03' ? { ...l, status: 'accepted' } : l.code === 'PAP-04' ? { ...l, status: 'rejected', reason: 'Sum insured below contract value' } : l))
  const gl = L.gapList({ texts: TEXTS, mob: MOB, lines: withStatus, now: Date.parse('2026-11-15T19:00:00+05:30'), last_inbound_ms: Date.parse('2026-11-15T11:00:00+05:30') })
  R.push(t('gap list: counts, sent-back reason, critical marked, inside window → free message', gl.gap.mode === 'session' && gl.gap.text.includes('PAP-04') && gl.gap.text.includes('Sum insured below') && gl.gap.text.includes('3 days') && !gl.gap.ready_to_travel, gl.gap.text.split('\n').slice(0, 4)))
  R.push(t('gap list: no message from them in 24 h → template', L.gapList({ mob: MOB, lines: withStatus, now: Date.parse('2026-11-15T19:00:00+05:30'), last_inbound_ms: Date.parse('2026-11-14T10:00:00+05:30') }).gap.mode === 'template', null))

  // ---- sending
  const now = Date.parse('2026-11-15T19:00:00Z')
  R.push(t('send: inside window → session message', L.chooseSendMode({ phone: '919820000001', last_inbound_at: '2026-11-15T10:00:00Z', now, request: { body: { type: 'text', text: { body: 'x' } } } }).mode === 'session', null))
  R.push(t('send: outside window with template → template', L.chooseSendMode({ phone: '919820000001', last_inbound_at: '2026-11-13T10:00:00Z', now, request: { body: {}, template: { name: 'vera_mob_gap_list', params: ['a'] } } }).mode === 'template', null))
  const held = L.chooseSendMode({ phone: '919820000001', last_inbound_at: '2026-11-13T10:00:00Z', now, request: { summary: 'the NOC report to sign', body: { type: 'interactive' } } })
  R.push(t('send: outside window, buttons/photo with no template → "Show me" template, real message held', held.mode === 'hold' && held.payload.template.name === 'vera_mob_action_needed' && held.payload.template.components[0].parameters[0].text === 'the NOC report to sign' && held.payload.template.components[1].parameters[0].payload === 'show:latest' && held.held_body.body.type === 'interactive', held.payload))
  R.push(t('send: nothing to send → not sent, logged', L.chooseSendMode({ phone: '919820000001', last_inbound_at: '2026-11-13T10:00:00Z', now, request: {} }).can_send === false, null))
  const tpl = L.chooseSendMode({ phone: '919820000001', now, request: { template: { name: 't', params: ['a'], header: { type: 'document', document: { id: 'M1' } }, buttons: ['x:1:a', 'x:1:b'] } } }).payload.template.components
  R.push(t('send: template header + quick-reply payloads in the right order', tpl[0].type === 'header' && tpl[1].type === 'body' && tpl[3].index === '1' && tpl[3].parameters[0].payload === 'x:1:b', tpl))
  R.push(t('send: rate limit 131056 → retry, then a person after 3', L.classifySendError({ error: { message: '(#131056) pair rate limit', code: 131056 }, attempt: 0 }).send_error.action === 'retry' && L.classifySendError({ error: { code: 131056 }, attempt: 2 }).send_error.action === 'review', null))
  R.push(t('send: 131047 window closed → switch to template', (() => { const e = L.classifySendError({ error: { code: 131047 } }); return e.send_error.action === 'needs_template' && L.chooseSendMode({ ...e, phone: '919820000001', last_inbound_at: new Date().toISOString(), request: { body: { type: 'text' }, template: { name: 't' } } }).mode === 'template' })(), null))

  R.push(t('send: blocked 403 (proxy / bad token) → a person, not a retry loop', L.classifySendError({ error: { message: '403 - "request blocked: no rule allows host"', httpCode: '403', timestamp: 1762455123 }, attempt: 0 }).send_error.action === 'review', null))
  R.push(t('send: WhatsApp 503 → retry', L.classifySendError({ error: { message: '503 - Service Unavailable', httpCode: '503' }, attempt: 0 }).send_error.action === 'retry', null))
  const whyNode = nodeNamed(IDS.send, 'Why did it fail?')
  const rate = { error: { message: '(#131056) pair rate limit', code: 131056 } }
  const w1 = await runCode(whyNode, [{ json: rate }], { nodes: { 'Session or template?': { json: { attempt: 0 } }, 'Wait 30 s': { json: { attempt: 2 } } } })
  R.push(t('n8n code: retry counter survives the Wait loop (3rd failure → a person)', w1[0].json.attempt === 3 && w1[0].json.send_error.action === 'review', w1[0].json.send_error))
  // ---- replies
  const rep = L.composeReply({ texts: TEXTS, fragments: [{ kind: 'accepted', line: 'PAP-03' }, { kind: 'filed', line: 'LC-03', photo: true }, { kind: 'filed', line: 'LC-05', photo: true }, { kind: 'rejected', line: 'PAP-04', reason: 'Sum insured below contract value' }], open_count: 9 })
  R.push(t('reply: 4 items → 1 message', rep.reply.split('\n').length === 4 && rep.reply.includes('LC-03, LC-05'), rep.reply))

  // ---- languages (messages.mjs)
  const keys = Object.keys(TEXTS.en)
  const gaps = ['hi', 'mr'].map((l) => [l, keys.filter((k) => !TEXTS[l][k]), Object.keys(TEXTS[l]).filter((k) => !TEXTS.en[k])])
  R.push(t('languages: Hindi and Marathi have every message English has, and no stray ones', gaps.every(([, miss, extra]) => !miss.length && !extra.length), gaps))
  const holes = (txt) => (String(txt).match(/\{(\w+)\}/g) || []).sort().join()
  const mism = ['hi', 'mr'].flatMap((l) => keys.filter((k) => holes(TEXTS[l][k]) !== holes(TEXTS.en[k])).map((k) => l + ':' + k))
  R.push(t('languages: every translation fills the same {blanks} as the English', !mism.length, mism))
  const tooLong = ['en', 'hi', 'mr'].flatMap((l) => [['confirm_other', 20], ['confirm_button', 20], ['confirm_section', 24]].filter(([k, n]) => [...TEXTS[l][k]].length > n).map(([k]) => l + ':' + k))
  R.push(t('languages: button and list titles fit WhatsApp limits (20 / 24 characters) in all languages', !tooLong.length, tooLong))
  const glHi = L.gapList({ texts: TEXTS, lang: 'hi', mob: MOB, lines: withStatus, now: Date.parse('2026-11-15T19:00:00+05:30'), last_inbound_ms: 0 })
  R.push(t('languages: Hindi gap list, Hindi template, line codes and reasons kept', glHi.gap.text.includes('अभी बाकी कागज़ात') && glHi.gap.text.includes('3 दिन') && glHi.gap.text.includes('PAP-04') && glHi.gap.text.includes('Sum insured below') && glHi.gap.template.language === 'hi' && glHi.gap.mode === 'template', glHi.gap.text.split('\n').slice(0, 3)))
  const repMr = L.composeReply({ texts: TEXTS, lang: 'mr', fragments: [{ kind: 'accepted', line: 'PAP-03' }, { kind: 'filed', line: 'LC-03', photo: true }], open_count: 4 })
  R.push(t('languages: Marathi burst reply', repMr.reply.includes('मंजूर: PAP-03') && repMr.reply.includes('जमा: LC-03') && repMr.reply.includes('अजून बाकी: 4 लाइन'), repMr.reply))
  const apMr = L.buildAreaPrompts({ ...S, mobilisation_id: 1, contractor_contact_id: 7, texts: TEXTS, lang: 'mr', project: 'Tower B' })
  R.push(t('languages: Marathi area prompt names the area in Marathi; held summary in Marathi too', apMr.find((p) => p.area === 'LC').request.body.text.body.startsWith('*लेबर कॅम्प (LC)*') && apMr[0].request.summary.includes('Tower B'), apMr.find((p) => p.area === 'LC').request.body.text.body.slice(0, 80)))
  const cbHi = L.buildConfirm({ options: ['LC-03'], lines, evidence_id: 5, texts: TEXTS, lang: 'hi' })
  R.push(t('languages: Hindi confirm question and "Something else" button', cbHi.request.body.interactive.body.text === 'यह किस चेकलिस्ट लाइन के लिए है?' && cbHi.request.body.interactive.action.buttons[1].reply.title === 'कुछ और', cbHi.request.body.interactive))
  R.push(t('languages: reminder in Hindi uses the Hindi template', L.reminderPlan({ texts: TEXTS, lang: 'hi', item: { line: 'SF-08', severity: 'major', text: 'Main DB', due_on: '2026-11-20' }, today: '2026-11-21' }).request.template.language === 'hi', null))
  R.push(t('languages: "Show me" template goes in the contact\'s language', L.chooseSendMode({ phone: '919820000001', language: 'mr', now, request: { body: { type: 'text' }, summary: 'x' } }).payload.template.language.code === 'mr', null))
  R.push(t('languages: set-up form maps "मराठी (Marathi)" to mr, default English', L.validateSetup({ contractor_lang: 'मराठी (Marathi)' }).clean.contractor_lang === 'mr' && L.validateSetup({}).clean.contractor_lang === 'en', null))
  const tplBad = TEMPLATES.flatMap((tp) => ['en', 'hi', 'mr'].filter((l) => tp[l]).filter((l) => /^\s*\{\{|\}\}[\s.*]*$/.test(tp[l]) || (tp[l].match(/\{\{\d\}\}/g) || []).length !== tp.params.length).map((l) => tp.name + ':' + l))
  R.push(t('templates: no body starts or ends with a variable (Meta rejects those); variables match the parameters', !tplBad.length, tplBad))
  const helpNode = await runCode(nodeNamed(IDS.process, 'Build help text'), [{ json: { contact_lang: 'hi', help: 'unknown_line', line: 'LC-10' } }])
  R.push(t('n8n code: help node answers in Hindi and does not carry the text table forward', helpNode[0].json.request.body.text.body.startsWith('LC-10 इस साइट') && !helpNode[0].json.texts, helpNode[0].json.request.body.text.body))

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
  R.push(t('report: says which sticker scans were not counted', L.renderReport({ mob: MOB, score: sc(walked), narrative: { areas: [] }, narrative_ok: true, coverage: { areas: [{ area: 'LC', visited: false, stickers: 0, sticker_mismatch: 1 }] } }).html.includes('GPS far from this area'), null))
  R.push(t('report: escapes text from the site', L.renderReport({ mob: { ...MOB, project: '<script>' }, score, narrative: good, narrative_ok: true }).html.includes('&lt;script&gt;'), null))

  // ---- open items
  const rp = L.reminderPlan({ texts: TEXTS, item: { id: 4, line: 'LC-07', severity: 'critical', text: 'RCCB', due_on: '2026-11-18' }, today: '2026-11-20', project: 'Tower B' })
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
  const shadowGate = await runCode(gateNode, [{ json: claude(ans()) }], { nodes: { 'Build classify request': { json: { ...creq[0].json, mob: { flags: { shadow: true } } } } } })
  R.push(t('n8n code: shadow mode → even 0.95 goes to the sender as buttons', shadowGate[0].json.decision === 'confirm' && shadowGate[0].json.options[0] === 'LC-03', shadowGate[0].json.decision))

  // Stickers: signed in WF-03 "stickers", checked on scan and on every capture.
  const stickers = await runCode(nodeNamed(IDS.walk, 'Sign sticker codes'), [{ json: { mobilisation_id: 7, project: 'Tower B', areas: ['LC', 'SY'] } }], { env, nodes: { 'Check walk link ': { json: { body: { per_area: 2 } } } } })
  const codeLC = stickers[0].json.stickers[0].code
  const scan = (code) => runCode(nodeNamed(IDS.walk, 'Check sticker'), [{ json: { body: { code } } }], { env })
  const realScan = await scan(codeLC)
  const fakeScan = await scan(codeLC.replace('.LC.', '.SY.'))
  R.push(t('n8n code: 4 stickers signed; a real one verifies, an edited one is refused', stickers[0].json.stickers.length === 4 && realScan[0].json.spot_ok && realScan[0].json.spot.area === 'LC' && realScan[0].json.spot.mobilisation_id === 7 && !fakeScan[0].json.spot_ok, [realScan[0].json.spot, fakeScan[0].json.spot_ok]))
  const placeNode = nodeNamed(IDS.walk, 'Place on site map')
  const placed = await runCode(placeNode, [{ json: { mobilisation_id: 7, zones: [camp], body: { line: 'LC-03', gps: null, spot: codeLC } } }], { env })
  const otherSite = await runCode(placeNode, [{ json: { mobilisation_id: 8, zones: [camp], body: { line: 'LC-03', gps: null, spot: codeLC } } }], { env })
  R.push(t('n8n code: capture with this site\'s camp sticker → in; same sticker on another site → ignored', placed[0].json.geo.result === 'in' && otherSite[0].json.geo.result === 'unknown', [placed[0].json.geo, otherSite[0].json.geo]))
  const iphone = await runCode(nodeNamed(IDS.walk, 'Voice to file'), [{ json: {} }], { nodes: { 'Photo to file': { json: { body: { capture_id: 'c1', audio_b64: 'AAAA', audio_mime: 'audio/mp4;codecs=mp4a.40.2' } } } } })
  R.push(t('n8n code: an iPhone voice remark is stored as .m4a (audio/mp4), not mislabelled .webm', iphone[0].binary.data.fileName === 'c1.m4a' && iphone[0].binary.data.mimeType === 'audio/mp4', iphone[0].binary.data))
  const frag = await runCode(nodeNamed(IDS.readPaper, 'Make reply fragment'), [{ json: { binding: { line: 'PAP-04' }, line: { code: 'PAP-04' }, message: { type: 'document' }, paper: { status: 'rejected', checks: [{ result: 'fail', note: 'Sum insured low' }] } } }])
  R.push(t('n8n code: re-read paper gives the same reply line as WF-02', frag[0].json.fragment.kind === 'rejected' && frag[0].json.fragment.line === 'PAP-04' && frag[0].json.saved_line === 'PAP-04', frag[0].json.fragment))

  return R
}
