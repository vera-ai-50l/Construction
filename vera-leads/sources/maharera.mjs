// MahaRERA public project search -> three Vera signals:
//   maharera_new        a project registered recently: set up site reporting from day one
//   maharera_extension  completion date extended: the project is late by definition
//   maharera_deadline   completion date within 6 months or already past: pressure on progress and cost
//
// The parser does not depend on MahaRERA's exact class names. It finds every registration number
// (P51800012345), works out which repeating HTML block holds one project each, and reads fields
// by their labels ("Promoter", "District", "Proposed Date of Completion"...). If MahaRERA redesigns
// the page, run `node vera-leads.mjs maharera --pages 1 --debug` and check data/debug/.
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.mjs'
import { DATA, addSignal, upsertAccount } from '../lib/store.mjs'
import { daysBetween, htmlToText, log, parseDate, politeFetch, today } from '../lib/util.mjs'

const LABELS = {
  project: /^(project\s*name|name of (the )?project)\b/i,
  promoter: /^(promoter(\s*name)?|name of (the )?promoter|developer)\b/i,
  district: /^district\b/i,
  taluka: /^taluka\b/i,
  division: /^division\b/i,
  pincode: /^pin\s*code\b|^pincode\b/i,
  location: /^(project\s*)?location\b|^address\b/i,
  completion: /^(original\s*)?(proposed\s*)?(date\s*of\s*)?completion(\s*date)?\b|^proposed date of completion/i,
  revised: /^(revised|extended)\s*(proposed\s*)?(date\s*of\s*)?completion|^extension\s*(date|upto|up to)/i,
  registered: /^(registration\s*date|date\s*of\s*registration|registered\s*on|approved\s*on|certificate\s*date)\b/i,
  modified: /^last\s*modified\b/i,
  status: /^(project\s*)?status\b/i,
}
const ANY_LABEL = new RegExp(Object.values(LABELS).map(r => r.source).join('|'), 'i')

function field(lines, re) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!re.test(l)) continue
    const after = l.includes(':') ? l.slice(l.indexOf(':') + 1).trim() : l.replace(re, '').replace(/^[\s:–-]+/, '').trim()
    if (after) return after
    const next = lines[i + 1]
    if (next && !ANY_LABEL.test(next)) return next.replace(/^[:\s]+/, '').trim()
  }
  return ''
}

// Pick the class attribute that opens exactly one block per project, as far out as possible.
function cardBlocks(html, regs) {
  const marks = []
  const re = /<(div|article|li|tr|section)\b[^>]*class\s*=\s*["']([^"']+)["'][^>]*>/gi
  let m
  while ((m = re.exec(html))) marks.push({ pos: m.index, cls: m[2].trim() })
  const byCls = new Map()
  for (const mk of marks) (byCls.get(mk.cls) || byCls.set(mk.cls, []).get(mk.cls)).push(mk.pos)
  let best = null
  for (const [cls, pos] of byCls) {
    if (pos.length !== regs.length) continue
    let ok = true, slack = 0
    for (let i = 0; i < regs.length && ok; i++) {
      const lo = i ? regs[i - 1].pos : -1
      ok = pos[i] > lo && pos[i] < regs[i].pos
      slack += regs[i].pos - pos[i]
    }
    if (ok && (!best || slack > best.slack)) best = { cls, pos, slack }
  }
  if (!best) return null
  return best.pos.map((p, i) => html.slice(p, best.pos[i + 1] ?? html.length))
}

// Table layout: one <tr> per project, column names in the header row.
const cellText = s => htmlToText(s).replace(/\n/g, ' ').trim()
function parseTables(html, baseUrl) {
  const out = []
  for (const t of html.match(/<table\b[\s\S]*?<\/table>/gi) || []) {
    const rows = t.match(/<tr\b[\s\S]*?<\/tr>/gi) || []
    if (rows.length < 2) continue
    const cells = r => (r.match(/<t[hd]\b[\s\S]*?<\/t[hd]>/gi) || [])
    const head = cells(rows[0]).map(cellText)
    if (!head.some(h => /promoter/i.test(h)) || !head.some(h => /project|certificate|registration/i.test(h))) continue
    const col = re => head.findIndex(h => re.test(h))
    const ix = {
      project: col(/project\s*name|name of (the )?project/i), promoter: col(/promoter/i), district: col(/district/i), taluka: col(/taluka/i),
      division: col(/division/i), pincode: col(/pin/i), completion: col(/^(?!.*revis)(?!.*extend).*completion/i), revised: col(/revis|extend/i),
      registered: col(/registration date|date of registration|registered on/i), modified: col(/modified/i), status: col(/status/i),
    }
    const regRe = new RegExp(config.maharera.regNo.source)
    for (const r of rows.slice(1)) {
      const cs = cells(r), txt = cs.map(cellText)
      const reg = (txt.join(' ').match(regRe) || [])[1]
      if (!reg) continue
      const g = k => (ix[k] >= 0 ? txt[ix[k]] || '' : '')
      const href = (r.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1]
      let url = ''
      try { url = href ? new URL(href.replace(/&amp;/g, '&'), baseUrl).href : '' } catch {}
      out.push({
        regNo: reg, project: g('project'), promoter: g('promoter'), district: g('district'), taluka: g('taluka'), division: g('division'),
        pincode: (g('pincode').match(/\d{6}/) || [''])[0], location: '', completion: parseDate(g('completion')), revised: parseDate(g('revised')),
        registered: parseDate(g('registered')), modified: parseDate(g('modified')), status: g('status'), extensionMentioned: !!g('revised'), url,
      })
    }
  }
  return out
}

export function parseSearchPage(html, baseUrl = 'https://maharera.maharashtra.gov.in/') {
  const fromTables = parseTables(html, baseUrl)
  if (fromTables.length) return fromTables
  const regRe = new RegExp(config.maharera.regNo.source, 'g')
  const seen = new Set(), regs = []
  let m
  while ((m = regRe.exec(html))) if (!seen.has(m[1])) { seen.add(m[1]); regs.push({ no: m[1], pos: m.index }) }
  if (!regs.length) return []

  let blocks = cardBlocks(html, regs)
  if (!blocks) {
    // Fallback: cut the page between registration numbers, keeping a little text before each.
    blocks = regs.map((r, i) => html.slice(Math.max(i ? regs[i - 1].pos + 20 : 0, r.pos - 1500), regs[i + 1]?.pos ?? html.length))
  }

  return regs.map((r, i) => {
    const block = blocks[i]
    const lines = htmlToText(block).split('\n')
    const regLine = lines.findIndex(l => l.includes(r.no))
    let project = field(lines, LABELS.project)
    if (!project) {
      // Usually the project name is the heading just above (or on) the registration number line.
      const cands = [lines[regLine - 1], lines[0], lines[regLine + 1]].filter(Boolean)
      project = (cands.find(l => !ANY_LABEL.test(l) && !/^#?\s*P[A-Z]?\d{8}/.test(l) && !/view details|certificate/i.test(l) && l.length > 2) || '').replace(/^[#\s]+/, '')
    }
    // Cards often show the promoter unlabelled, on the line under the project name.
    let promoter = field(lines, LABELS.promoter)
    if (!promoter) {
      const pi = lines.findIndex(l => l.replace(/^[#\s]+/, '') === project)
      const usable = l => l && !ANY_LABEL.test(l) && !/^#?\s*P[A-Z]?\d{8}/.test(l) && !/view details|certificate|maharashtra/i.test(l) && l !== project
      const legal = /\b(ltd|limited|llp|developers?|builders?|constructions?|realty|infra|enterprises|associates|group|homes|estates?|properties|housing|buildcon|corporation|co-?op|society)\b/i
      const near = lines.slice(Math.max(0, pi + 1), pi + 4).filter(usable)
      promoter = near.find(l => legal.test(l)) || near[0] || ''
    }
    const href = (block.match(/href\s*=\s*["']([^"']*(?:view|detail|project)[^"']*)["']/i) || [])[1]
    let url = ''
    try { url = href ? new URL(href.replace(/&amp;/g, '&'), baseUrl).href : '' } catch {}
    const text = lines.join(' ')
    return {
      regNo: r.no,
      project: project.replace(/\s*\(?P[A-Z]?\d{10,14}\)?\s*/, '').trim(),
      promoter,
      district: field(lines, LABELS.district),
      taluka: field(lines, LABELS.taluka),
      division: field(lines, LABELS.division),
      pincode: (field(lines, LABELS.pincode).match(/\d{6}/) || [''])[0],
      location: field(lines, LABELS.location),
      completion: parseDate(field(lines, LABELS.completion)),
      revised: parseDate(field(lines, LABELS.revised)),
      registered: parseDate(field(lines, LABELS.registered)),
      modified: parseDate(field(lines, LABELS.modified)),
      status: field(lines, LABELS.status),
      extensionMentioned: /\bextension\b|\bextended\b/i.test(text),
      url,
    }
  })
}

export function regionOf(...places) {
  const s = places.filter(Boolean).join(' ').toLowerCase()
  for (const [region, names] of Object.entries(config.regions)) if (names.some(n => s.includes(n))) return region
  return ''
}

// Turn parsed projects into accounts and signals. Returns counts.
export function ingestProjects(db, projects, { firstRun = false, now = today() } = {}) {
  const c = { projects: 0, new: 0, extension: 0, deadline: 0 }
  const cfg = config.maharera
  for (const p of projects) {
    if (!p.promoter) continue
    c.projects++
    const region = regionOf(p.district, p.taluka, p.location, p.division)
    const a = upsertAccount(db, {
      name: p.promoter, segment: 'construction', region, district: p.district,
      city: p.taluka || p.district, projects: [p.regNo], kind: 'developer',
    })
    if (!a) continue
    const base = { source: 'maharera', url: p.url || cfg.searchUrl.replace('{page}', '1'), location: [p.taluka, p.district].filter(Boolean).join(', '), project: p.project, regNo: p.regNo }

    const regAge = daysBetween(p.registered, now)
    if (regAge <= 60 || (!p.registered && !firstRun && !db._knownRegs?.has(p.regNo))) {
      if (addSignal(db, a, { ...base, type: 'maharera_new', key: p.regNo, date: p.registered || now, title: `New MahaRERA project: ${p.project || p.regNo}`, detail: `Registered ${p.registered || 'recently'} (${p.regNo})` })) c.new++
    }
    if ((p.revised && p.revised !== p.completion) || p.extensionMentioned) {
      const d = p.revised || p.modified || now
      if (addSignal(db, a, { ...base, type: 'maharera_extension', key: p.regNo + ':' + (p.revised || 'ext'), date: p.modified || now, title: `Completion extended: ${p.project || p.regNo}`, detail: `Completion moved ${p.completion || '?'} to ${p.revised || '?'}`, completion: d })) c.extension++
    }
    const due = p.revised || p.completion
    const left = due ? -daysBetween(due, now) : Infinity
    if (due && left <= cfg.deadlineWindowDays && !/complet/i.test(p.status)) {
      if (addSignal(db, a, { ...base, type: 'maharera_deadline', key: p.regNo + ':' + due.slice(0, 7), date: now, title: `${left < 0 ? 'Past' : 'Near'} completion date: ${p.project || p.regNo}`, detail: left < 0 ? `Completion date ${due} has passed` : `Completion due ${due}, ${left} days away`, completion: due })) c.deadline++
    }
  }
  return c
}

async function getPage(url, { browser }) {
  if (!browser) {
    const res = await politeFetch(url, { gapMs: config.maharera.gapMs })
    if (!res.ok) throw new Error(`MahaRERA returned HTTP ${res.status}`)
    return res.text()
  }
  const { chromium } = await import('playwright')
  const b = getPage.b || (getPage.b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}))
  const pg = await b.newPage()
  try {
    await pg.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    return await pg.content()
  } finally { await pg.close() }
}

export async function run(db, { pages = config.maharera.maxPages, browser = false, files = [], debug = false } = {}) {
  const firstRun = !db.signals.some(s => s.source === 'maharera')
  db._knownRegs = new Set(Object.values(db.accounts).flatMap(a => a.projects || []))
  const all = []
  if (files.length) {
    for (const fp of files) all.push(...parseSearchPage(fs.readFileSync(fp, 'utf8')))
  } else {
    let empty = 0
    for (let p = 1; p <= pages; p++) {
      const url = config.maharera.searchUrl.replace('{page}', p)
      const html = await getPage(url, { browser })
      if (debug || p === 1) {
        fs.mkdirSync(path.join(DATA, 'debug'), { recursive: true })
        fs.writeFileSync(path.join(DATA, 'debug', `maharera-page${p}.html`), html)
      }
      const got = parseSearchPage(html)
      log(`MahaRERA page ${p}: ${got.length} projects`)
      if (!got.length) { if (p === 1) log('No registration numbers found on page 1. Open data/debug/maharera-page1.html: the site may need --browser, or the URL in config.mjs has changed.'); break }
      const fresh = got.filter(g => !db._knownRegs.has(g.regNo)).length
      all.push(...got)
      empty = fresh ? 0 : empty + 1
      if (!firstRun && empty >= 3) { log('Three pages with nothing new; stopping.'); break }
    }
    if (getPage.b) { await getPage.b.close(); getPage.b = null }
  }
  const counts = ingestProjects(db, all, { firstRun })
  if (firstRun && !files.length) log('First MahaRERA run: projects without a registration date are stored as a baseline, not flagged as new.')
  return counts
}
