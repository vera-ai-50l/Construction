// Desk 05: the content of the "one day" demo page (/mobilise), made by the same code the
// workflows run: area prompts, paper checks on the sample papers, the burst reply, the 7 PM
// gap list, the confirm buttons, the NOC sign-off, the reminder and the closure. Nothing in
// the chats is typed by hand except what the contractor and engineer send.
// build.mjs writes it to content/day-demo.json.

import * as L from './logic.mjs'
import { linesFor, areas as AREAS, params as PARAMS } from './checklist.mjs'
import { TEXTS } from './messages.mjs'
import { CASES, SITE } from './eval/papers.mjs'
import { sampleVisit } from './sample-report.mjs'

const T = (lang, k, v) => String((TEXTS[lang] || TEXTS.en)[k] || TEXTS.en[k]).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? String(v[n]) : ''))
const vera = (text, extra = {}) => ({ from: 'vera', text, ...extra })
const them = (text, extra = {}) => ({ from: 'them', text, ...extra })

function forLanguage(lang) {
  const site = { concrete: 'plant', lifting: true, creche: false, excavation: true }
  const lines = linesFor(site).map((l) => ({ ...l, status: 'open' }))
  const byCode = Object.fromEntries(lines.map((l) => [l.code, l]))
  const tx = { texts: TEXTS, lang }

  // T-5: the area lists (held behind "Show me" on first contact)
  const checklist = lines.map((l) => ({ ...l, doc_type: l.docType || null }))
  const prompts = L.buildAreaPrompts({ ...tx, checklist, checklist_areas: AREAS, mobilisation_id: 1, contractor_contact_id: 1, project: SITE.project })
  const pap = prompts.find((p) => p.area === 'PAP').request
  const lc = prompts.find((p) => p.area === 'LC').request
  const showMe = { en: 'Show me', hi: 'दिखाओ', mr: 'दाखवा' }[lang]
  const held = { en: 'Vera has {{1}} for you. Tap the button below to see it.', hi: 'Vera के पास आपके लिए {{1}} है। देखने के लिए नीचे का बटन दबाएँ।', mr: 'Vera कडे तुमच्यासाठी {{1}} आहे. पाहण्यासाठी खालचे बटण दाबा.' }[lang].replace('{{1}}', pap.summary)

  // T-3: papers and photos arrive; the paper checks run on what was read
  const paper = (id) => {
    const c = CASES.find((x) => x.id === id)
    const r = L.checkPaper({ line: byCode[c.line], fields: { doc_type: c.docType, readable: true, contains_unmasked_id: false, ...c.fields }, mob: SITE, params: PARAMS }).paper
    return { line: c.line, kind: r.status, reason: r.checks.filter((x) => x.result !== 'pass').map((x) => x.note).join('; ') }
  }
  const carLow = paper('car-low-sum')
  const licence = paper('labour-licence-ok')
  const reply1 = L.composeReply({ ...tx, fragments: [
    { kind: licence.kind, line: licence.line }, { kind: carLow.kind, line: carLow.line, reason: carLow.reason },
    { kind: 'filed', line: 'LC-03', photo: true }, { kind: 'filed', line: 'LC-05', photo: true },
  ], open_count: 18 }).reply
  const confirm = L.buildConfirm({ ...tx, options: ['SY-01', 'SY-02'], lines, evidence_id: 41 }).request.body.interactive
  const reply2 = L.composeReply({ ...tx, fragments: [{ kind: 'filed', line: 'SY-01', photo: true }], open_count: 18 }).reply

  // T-1: the 7 PM gap list
  const status = { 'PAP-02': 'accepted', 'PAP-03': 'accepted', 'PAP-05': 'accepted', 'PAP-06': 'accepted', 'PAP-07': 'accepted', 'PAP-09': 'accepted', 'PAP-10': 'accepted', 'PAP-11': 'accepted', 'PAP-12': 'accepted', 'PAP-13': 'accepted', 'PAP-15': 'accepted', 'PAP-16': 'accepted', 'DR-03': 'accepted', 'DR-04': 'accepted', 'DR-07': 'accepted', 'DR-08': 'accepted', 'BP-10': 'accepted', 'SF-14': 'accepted', 'PAP-04': 'rejected', 'PAP-14': 'review', 'LC-03': 'filed', 'LC-05': 'filed', 'SY-01': 'filed' }
  const gl = L.gapList({ ...tx, mob: SITE, lines: lines.map((l) => ({ ...l, status: status[l.code] || 'open', reason: l.code === 'PAP-04' ? carLow.reason : null })), now: Date.parse('2026-11-17T19:00:00+05:30'), last_inbound_ms: Date.parse('2026-11-17T12:00:00+05:30') }).gap

  // After: reminder, closure
  const rem = L.reminderPlan({ ...tx, item: { id: 7, line: 'SF-08', severity: 'critical', text: byCode['SF-08'].text, finding: 'Earthing pit test report not available', due_on: '2026-11-18' }, today: '2026-11-19', project: SITE.project })
  const closed = L.composeReply({ ...tx, fragments: [{ kind: 'closed', line: 'SF-08' }], open_count: null }).reply

  const contractor = (title) => ({ who: 'Contractor · Shree Ganesh Constructions', sub: title })
  return {
    t5: { ...contractor('first message'), msgs: [
      vera(held, { buttons: [showMe], template: true }),
      them(showMe, { tap: true }),
      vera(pap.body.text.body),
      vera(lc.body.text.body),
      vera('+ ' + (prompts.length - 2) + ' more areas', { note: true }),
    ] },
    t3: { ...contractor('papers and photos'), msgs: [
      them('', { file: 'Labour licence.pdf', replyTo: '*' + T(lang, 'area_PAP') + ' (PAP)*', caption: '2' }),
      them('', { file: 'CAR policy schedule.pdf', caption: 'PAP 4' }),
      them('', { photo: 'Toilet block', replyTo: '*' + T(lang, 'area_LC') + ' (LC)*', caption: '3' }),
      them('', { voice: '0:12', transcript: 'एल.सी. पाँच, पीने के पानी का नल धोने की जगह के पास है।' }),
      vera(reply1, { after: '90 s of quiet' }),
      them('', { photo: 'Cement shed' }),
      vera(confirm.body.text, { buttons: confirm.action.buttons.map((b) => b.reply.title) }),
      them(confirm.action.buttons[0].reply.title, { tap: true }),
      vera(reply2, { after: '90 s' }),
    ] },
    t1: { ...contractor('7 PM'), msgs: [vera(gl.text)], engineer: gl.engineer_line },
    after: { ...contractor('next morning'), msgs: [
      vera(rem.request.body.text.body),
      them('', { photo: 'Earthing pit test report', replyTo: rem.request.body.text.body.split('\n')[0] }),
      vera(closed, { after: 'engineer taps Accept' }),
    ] },
  }
}

export function dayDemo() {
  const visit = sampleVisit()
  const s = visit.score
  const label = { ready: 'Ready to start', conditional: 'Ready with conditions', not_ready: 'Not ready' }[s.recommendation]
  const closure = L.buildClosureAsk({ open_item_id: 7, line_code: 'SF-08', text: 'Site electrical: main DB with RCCB, earthing pits, licensed electrician on site', finding: 'Earthing pit test report not available', project: SITE.project }).msg
  return {
    project: SITE.project,
    languages: { en: forLanguage('en'), hi: forLanguage('hi'), mr: forLanguage('mr') },
    engineer: {
      walkLink: '*Site visit ' + SITE.visit_date + ': ' + SITE.project + '*\nOpen this on the day. Tap a line, take the photo, say your remark. GPS is recorded with each photo.\nhttps://vera…/walk#t=…',
      noc: { file: 'NOC-draft-' + SITE.project + '.pdf', text: SITE.project + ': ' + label + '. ' + s.done + '/' + s.total + ' lines closed; ' + s.critical_open + ' critical, ' + s.major_open + ' major open. Please read and sign.', buttons: ['Approve', 'With conditions', 'Hold'] },
      closure: { text: closure.text, buttons: closure.buttons.map((b) => b.title) },
    },
    visit: {
      areas: visit.coverage.areas.map((a) => ({ area: a.area, minutes: a.minutes, stickers: a.stickers })),
      recommendation: label, done: s.done, total: s.total, critical: s.critical_open, major: s.major_open, minor: s.minor_open, prewritten: s.prewritten_pct,
    },
  }
}
