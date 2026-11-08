// A realistic sample visit, run through the same code WF-06 runs (coverage, score, wording
// check, report page), then printed to docs/desk-05/sample-noc-report.pdf.
//   node n8n/mobilise/sample-report.mjs      (PDF needs Playwright's Chromium; HTML is always written)
// The engineer's remarks are real Sarvam transcripts (fixtures/sarvam). The observations are
// written in the answer format WF-06 asks Claude for and go through the same check.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import * as L from './logic.mjs'
import { linesFor, params as PARAMS } from './checklist.mjs'
const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'sarvam', f + '.json'), 'utf8'))

// The scored sample visit (before the wording step): also used by eval/run-claude.mjs.
export function sampleVisit() {
  const mob = { project: 'Sample Tower B, Thane', contractor_name: 'Shree Ganesh Constructions Pvt. Ltd.', template_version: 'mob-v1', site_address: 'Plot 12, Majiwada, Thane West' }
  const visit_date = '2026-11-18'
  const state = { // what the papers check and the engineer's walk ended with
    'PAP-14': ['review', null, 'Worker list received; ID masking being checked'],
    'PAP-16': ['open', null, null],
    'LC-03': ['not_ok', 2, null], 'LC-05': ['not_ok', 1, 'Drinking water point next to the washing area; to be moved'],
    'SY-01': ['not_ok', 2, null], 'SY-02': ['not_ok', 1, 'FIFO marking missing on cement stacks'],
    'SF-08': ['not_ok', 2, null], 'BP-06': ['not_ok', 2, null],
    'SF-05': ['na', 0, 'Edge protection arrives with slab work; not needed at mobilisation'],
  }
  const remarksFrom = { 'LC-03': 'hi-lc03', 'SY-01': 'mr-sy01', 'SF-08': 'hinglish-sf08', 'BP-06': 'en-bp06' }
  const lines = linesFor({ concrete: 'plant', lifting: true, creche: false, excavation: true }).map((l) => {
    const [status, photos, remark] = state[l.code] || [l.when === 'paper' ? 'accepted' : 'ok', l.when === 'paper' ? 0 : 1, null]
    return { code: l.code, area: l.area, text: l.text, severity: l.severity, when: l.when, status, photos, remark: remarksFrom[l.code] ? fx(remarksFrom[l.code]).transcript : remark, reason: null }
  })
  const remarks = Object.entries(remarksFrom).map(([line, f]) => ({ line, text: fx(f).transcript, lang: fx(f).language_code }))

  // areas drawn for the site and a walk trail through them (10:05 to 12:40)
  const box = (lat, lng, d = 0.0004) => [[lat, lng], [lat, lng + d], [lat - d, lng + d], [lat - d, lng]]
  const zones = [
    { area: 'DR', name: 'Site office', circle: { lat: 19.2125, lng: 72.9690, radius_m: 20 } },
    { area: 'LC', name: 'Labour camp', polygon: box(19.2100, 72.9700, 0.0008) },
    { area: 'SY', name: 'Stores yard', circle: { lat: 19.2120, lng: 72.9720, radius_m: 35 } },
    { area: 'BP', name: 'Batching plant and lab', polygon: box(19.2135, 72.9712) },
    { area: 'FW', name: 'Formwork yard', circle: { lat: 19.2112, lng: 72.9735, radius_m: 30 } },
    { area: 'SF', name: 'Gate and site', circle: { lat: 19.2128, lng: 72.9728, radius_m: 60 } },
  ]
  const route = [['DR', 19.2125, 72.9690, '10:05'], ['DR', 19.2125, 72.9691, '10:20'], ['LC', 19.2096, 72.9704, '10:30'], ['LC', 19.2097, 72.9706, '10:58'], ['LC', 19.2095, 72.9703, '11:12'],
    ['SY', 19.2120, 72.9720, '11:20'], ['SY', 19.2121, 72.9721, '11:41'], ['BP', 19.2133, 72.9714, '11:50'], ['BP', 19.2132, 72.9715, '12:12'],
    ['FW', 19.2112, 72.9735, '12:18'], ['SF', 19.2128, 72.9728, '12:26'], ['SF', 19.2129, 72.9730, '12:40']]
  const trail = route.map(([, lat, lng, t]) => ({ lat, lng, accuracy: 9, ts: visit_date + 'T' + t + ':00+05:30' }))
  const captures = route.filter((_, i) => i % 2).map(([, lat, lng, t]) => ({ gps: { lat, lng, accuracy: 7, ts: visit_date + 'T' + t + ':00+05:30' } }))
  const spots = [{ area: 'BP', ts: visit_date + 'T11:52:00+05:30', gps: null }]
  let x = L.walkCoverage({ mob, visit_date, lines, remarks, trail, captures, zones, spots, walk_areas: ['DR', 'LC', 'SY', 'BP', 'FW', 'SF'], params: PARAMS.geofence })
  x = L.scoreVisit(x)
  return x
}

// The observations section: written in the answer format WF-06 asks Claude for, from the
// engineer's own remarks (translated faithfully, no verdicts), then put through the same check.
export const SAMPLE_NARRATIVE = {
  areas: [
    { area: 'LC', observation: 'The toilet block has six toilets and none set apart for women. The water tank was empty during the visit. The drinking water point sits next to the washing area and has to be moved.', lines: ['LC-03', 'LC-05'] },
    { area: 'SY', observation: 'The cement shed itself is in order, but bags are stacked against the wall and stacks are twelve bags high. First-in first-out marking is missing on the stacks.', lines: ['SY-01', 'SY-02'] },
    { area: 'BP', observation: 'The site lab has the compression testing machine; its calibration sticker is from March. Only twelve cube moulds are available.', lines: ['BP-06'] },
    { area: 'SF', observation: 'The main distribution board has an RCCB fitted. The earthing pit test report is not available; the contractor has agreed to send it by tomorrow.', lines: ['SF-08'] },
  ],
  remarks_en: [
    { line: 'LC-03', english: 'LC 3: only six toilets in the toilet block, none separate for women. The water tank is empty.' },
    { line: 'SY-01', english: 'SY 1: cement shed is fine, but bags are kept against the wall; stacks are twelve bags high.' },
    { line: 'SF-08', english: 'SF 8: main DB checked, RCCB fitted, but no test report for the earthing pit. Told to send it by tomorrow.' },
    { line: 'BP-06', english: 'BP 06: site lab has the compression testing machine, calibration sticker is from March, only twelve cube moulds.' },
  ],
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  let x = L.checkNarrative({ ...sampleVisit(), ai: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(SAMPLE_NARRATIVE) }] } })
  if (!x.narrative_ok) throw new Error('narrative check failed: ' + x.narrative_problems.join('; '))
  x = L.renderReport({ ...x, version: 1 })
  const out = path.join(here, '..', '..', 'docs', 'desk-05')
  fs.writeFileSync(path.join(out, 'sample-noc-report.html'), x.html)
  console.log('wrote docs/desk-05/sample-noc-report.html')
  try {
    const { chromium } = createRequire(import.meta.url)('playwright')
    const b = await chromium.launch()
    const p = await b.newPage()
    await p.setContent(x.html, { waitUntil: 'load' })
    await p.pdf({ path: path.join(out, 'sample-noc-report.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true })
    await b.close()
    console.log('wrote docs/desk-05/sample-noc-report.pdf')
    fs.mkdirSync(path.join(here, '..', '..', 'public', 'desk05'), { recursive: true })
    fs.copyFileSync(path.join(out, 'sample-noc-report.pdf'), path.join(here, '..', '..', 'public', 'desk05', 'sample-noc-report.pdf'))
  } catch (e) { console.log('PDF skipped (Playwright not available): ' + e.message.split('\n')[0]) }
  console.log(x.score.recommendation, x.score.done + '/' + x.score.total, 'crit', x.score.critical_open, 'major', x.score.major_open, 'minor', x.score.minor_open, 'missed', x.score.areas_missed, 'prewritten', x.score.prewritten_pct)
  console.log(x.coverage.areas.map((a) => a.area + ':' + a.visited + ':' + a.minutes + 'min:' + a.stickers).join(' '))
}
