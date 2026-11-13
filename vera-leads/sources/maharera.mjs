// MahaRERA public project search -> three Vera signals:
//   maharera_new        a project registered recently: set up site reporting from day one
//   maharera_extension  completion date extended (an Extension Certificate on the card): the project is late
//   maharera_deadline   completion due within 6 months (the search's completion-date filter): pressure on progress and cost
//
// The parser does not depend on MahaRERA's exact class names. It finds every registration number
// (P51800012345), works out which repeating HTML block holds one project each, and reads fields
// by their labels ("District", "Last Modified", "Extension Certificate"...). If MahaRERA redesigns
// the page, run `node vera-leads.mjs maharera --pages 1 --debug` and check data/debug/.
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.mjs'
import { DATA, addSignal, upsertAccount } from '../lib/store.mjs'
import { daysBetween, htmlToText, log, parseDate, politeFetch, sleep, today } from '../lib/util.mjs'

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
        registered: parseDate(g('registered')), modified: parseDate(g('modified')), status: g('status'), url,
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
  // The last card runs to the end of the page; cut it to the size of the others so footer text can't leak in.
  if (blocks && blocks.length > 1) {
    const max = Math.max(...blocks.slice(0, -1).map(b => b.length))
    blocks[blocks.length - 1] = blocks[blocks.length - 1].slice(0, Math.round(max * 1.2))
  }
  if (blocks) {
    const last = blocks[blocks.length - 1], end = last.search(/Pages?\s*\d+\s*of\s*\d|<footer\b/i)
    if (end > 0) blocks[blocks.length - 1] = last.slice(0, end)
  }
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
    // Live cards: the place (taluka) is the unlabelled line under the promoter; "Extension Certificate" is a link or "N/A".
    const pi = lines.indexOf(promoter)
    const place = pi >= 0 && lines[pi + 1] && !ANY_LABEL.test(lines[pi + 1]) && !/find route|^state$/i.test(lines[pi + 1]) ? lines[pi + 1] : ''
    const extIdx = lines.findIndex(l => /^extension certificate$/i.test(l))
    const extCert = /DocProjectExtCert/i.test(block) || (extIdx >= 0 && lines[extIdx + 1] && !/^n\/?a$/i.test(lines[extIdx + 1]) && /certificate|view/i.test(lines[extIdx + 1]))
    return {
      regNo: r.no,
      project: project.replace(/\s*\(?P[A-Z]?\d{10,14}\)?\s*/, '').trim(),
      promoter,
      district: field(lines, LABELS.district),
      taluka: field(lines, LABELS.taluka) || place,
      division: field(lines, LABELS.division),
      pincode: (field(lines, LABELS.pincode).match(/\d{6}/) || [''])[0],
      location: field(lines, LABELS.location),
      completion: parseDate(field(lines, LABELS.completion)),
      revised: parseDate(field(lines, LABELS.revised)),
      registered: parseDate(field(lines, LABELS.registered)),
      modified: parseDate(field(lines, LABELS.modified)),
      status: field(lines, LABELS.status),
      extCert: !!extCert,
      url,
    }
  })
}

// "Showing Final 50013 Result" and "Pages 1 of 5002" on the live page.
export function pageInfo(html) {
  const t = htmlToText(html).replace(/\s+/g, ' ')
  const num = re => { const m = t.match(re); return m ? +m[1].replace(/,/g, '') : null }
  return { total: num(/Showing\s+(?:Final\s+)?([\d,]+)\s+Results?/i), pages: num(/Pages?\s+\d+\s+of\s+([\d,]+)/i) }
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
    const base = { source: 'maharera', url: p.url || cfg.searchUrl, location: [p.taluka, p.district].filter(Boolean).join(', '), project: p.project, regNo: p.regNo }

    // New: a registration date in the last 60 days, or (the live list has no dates) a project on the newest pages
    // that wasn't there last week. On the very first run, "Last Modified" within 60 days stands in for the date.
    const regAge = daysBetween(p.registered, now)
    const unseen = !db._knownRegs?.has(p.regNo)
    const tailNew = p.tail && !p.registered && (firstRun ? daysBetween(p.modified, now) <= 60 : unseen)
    if (regAge <= 60 || tailNew || (!p.registered && !p.tail && !p.dueBy && !firstRun && unseen)) {
      if (addSignal(db, a, { ...base, type: 'maharera_new', key: p.regNo, date: p.registered || (firstRun ? p.modified : now) || now, title: `New MahaRERA project: ${p.project || p.regNo}`, detail: `Registered ${p.registered || 'recently'} (${p.regNo})` })) c.new++
    }
    // Extended: a revised completion date, or an Extension Certificate on the card. Dated by "Last Modified",
    // so an extension from years ago scores close to nothing.
    if ((p.revised && p.revised !== p.completion) || p.extCert) {
      if (addSignal(db, a, { ...base, type: 'maharera_extension', key: p.regNo + ':' + (p.revised || 'ext'), date: p.modified || now, title: `Completion extended: ${p.project || p.regNo}`, detail: p.revised ? `Completion moved ${p.completion || '?'} to ${p.revised}` : `Extension certificate on MahaRERA${p.modified ? ', last modified ' + p.modified : ''}`, completion: p.revised || '' })) c.extension++
    }
    // Due soon: a known completion date, or found by the search's completion-date filter (due by the window's end).
    const due = p.revised || p.completion
    const left = due ? -daysBetween(due, now) : Infinity
    if (due && left <= cfg.deadlineWindowDays && !/complet/i.test(p.status)) {
      if (addSignal(db, a, { ...base, type: 'maharera_deadline', key: p.regNo + ':' + due.slice(0, 7), date: now, title: `${left < 0 ? 'Past' : 'Near'} completion date: ${p.project || p.regNo}`, detail: left < 0 ? `Completion date ${due} has passed` : `Completion due ${due}, ${left} days away`, completion: due })) c.deadline++
    } else if (!due && p.dueBy) {
      if (addSignal(db, a, { ...base, type: 'maharera_deadline', key: p.regNo + ':due', date: now, title: `Near completion date: ${p.project || p.regNo}`, detail: `Completion due by ${p.dueBy} (MahaRERA completion-date search)`, completion: p.dueBy })) c.deadline++
    }
  }
  return c
}

// ---------- fetching ----------
export function searchUrl({ district = 0, page = 1, from = '', to = '' } = {}) {
  // Same parameters, in the same order, as the address that worked on the live site.
  const q = new URLSearchParams({
    project_name: '', project_location: '', project_completion_date: '', project_state: '27', project_district: String(district),
    carpetAreas: '', completionDate_from: from, completionDate_to: to, page: String(page),
  })
  return `${config.maharera.searchUrl}?${q}`
}
export const fmtDate = (iso, f) => { const [y, m, d] = iso.split('-'); return f.replace('YYYY', y).replace('MM', m).replace('DD', d) }
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10)

const hasPlaywright = () => import('playwright').then(() => true, () => false)
let chrome = null, lastHit = 0
async function getPage(url, { browser }) {
  const wait = config.maharera.gapMs - (Date.now() - lastHit)
  if (wait > 0) await sleep(wait)
  lastHit = Date.now()
  if (!browser) {
    const res = await politeFetch(url, { gapMs: 0 })
    if (!res.ok) throw new Error(`MahaRERA returned HTTP ${res.status}`)
    return res.text()
  }
  const { chromium } = await import('playwright')
  chrome ||= await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
  const pg = await chrome.newPage()
  try {
    await pg.goto(url, { waitUntil: 'networkidle', timeout: 90000 })
    // Give the results a moment to appear if the page is slow.
    await pg.waitForFunction(() => /Showing|No record|Pages\s*\d/i.test(document.body?.innerText || ''), null, { timeout: 20000 }).catch(() => {})
    return await pg.content()
  } finally { await pg.close() }
}

// Weekly read of MahaRERA for MMR and Pune:
//   1. the newest pages of each district (new registrations; results are listed oldest first)
//   2. the completion-date search, today to today + dueWindowDays (projects due soon)
// Extension certificates are picked up from every card read in either step.
export async function run(db, { pages, browser, files = [], debug = false, now = today() } = {}) {
  const cfg = config.maharera
  db._knownRegs = new Set(Object.values(db.accounts).flatMap(a => a.projects || []))
  const firstRun = db._knownRegs.size === 0
  if (files.length) {
    const all = files.flatMap(fp => parseSearchPage(fs.readFileSync(fp, 'utf8')))
    return ingestProjects(db, all, { firstRun, now })
  }
  if (browser == null) browser = await hasPlaywright()
  const all = []
  let n = 0
  const read = async url => {
    n++
    let html = await getPage(url, { browser })
    let got = parseSearchPage(html)
    if (!got.length && pageInfo(html).total == null) { // nothing and no result count: retry once, slowly
      await sleep(10000)
      html = await getPage(url, { browser })
      got = parseSearchPage(html)
    }
    if (!got.length && !browser && pageInfo(html).total == null && await hasPlaywright()) {
      log('No results from a plain request; switching to the browser (Playwright).')
      browser = true
      html = await getPage(url, { browser })
      got = parseSearchPage(html)
    }
    if (debug || n === 1) {
      fs.mkdirSync(path.join(DATA, 'debug'), { recursive: true })
      fs.writeFileSync(path.join(DATA, 'debug', `maharera-page${n}.html`), html)
    }
    return { got, info: pageInfo(html) }
  }

  try {
    const state = await read(searchUrl())
    if (!state.got.length) {
      const fs2 = path.join(DATA, 'debug', 'maharera-page1.html')
      const said = htmlToText(fs.readFileSync(fs2, 'utf8')).replace(/\s+/g, ' ').slice(0, 300)
      log(`Address: ${searchUrl()}\nThe page said: ${said || '(empty page)'}`)
      log(browser ? 'No projects on the MahaRERA search page. Send data/debug/maharera-page1.html to whoever maintains this.'
        : 'No projects found. Install the browser: npm i playwright && npx playwright install chromium')
      return { projects: 0, new: 0, extension: 0, deadline: 0, pagesRead: n }
    }
    const newPages = pages ?? cfg.newPages, duePages = pages ?? cfg.duePages
    const names = new Set(Object.values(cfg.districts).map(d => d.toLowerCase()))
    let scopes = Object.entries(cfg.districts)
    // If the site ignores the district filter, read statewide and keep MMR/Pune cards ourselves.
    const firstD = await read(searchUrl({ district: scopes[0][0] }))
    if (state.info.total && firstD.info.total === state.info.total) {
      log('MahaRERA ignored the district filter; reading statewide and keeping MMR and Pune.')
      scopes = [[0, 'Maharashtra']]
    }
    const keep = (code, list) => (code ? list : list.filter(x => names.has(String(x.district).toLowerCase())))

    // 1. Newest pages.
    for (const [code, name] of scopes) {
      const first = code === scopes[0][0] && code ? firstD : code ? await read(searchUrl({ district: code })) : state
      const last = first.info.pages || 1
      const span = code ? newPages : newPages * Object.keys(cfg.districts).length
      let readCount = 0
      for (let p = last; p >= Math.max(1, last - span + 1); p--) {
        const r = p === 1 ? first : await read(searchUrl({ district: code, page: p }))
        readCount++
        const got = keep(code, r.got)
        got.forEach(x => { x.tail = true })
        all.push(...got)
        if (!firstRun && !r.got.some(x => !db._knownRegs.has(x.regNo))) break // reached last week's projects
      }
      log(`${name}: ${first.info.total ?? '?'} projects listed; read the newest ${readCount} page(s)`)
    }

    // 2. Due soon, via the completion-date filter. Find the date format the site accepts.
    const from = now, to = addDays(now, cfg.dueWindowDays)
    let format = null
    for (const [code, name] of scopes) {
      const total = code === scopes[0][0] && code ? firstD.info.total : null
      let first = null
      for (const f of format ? [format] : cfg.dueDateFormats) {
        const r = await read(searchUrl({ district: code, from: fmtDate(from, f), to: fmtDate(to, f) }))
        const narrowed = r.info.total != null && (total == null || r.info.total < total) && r.info.total < (state.info.total || Infinity)
        if (narrowed && (format || r.info.total > 0)) { format = f; first = r; break }
      }
      if (!format) { log('The completion-date filter did not narrow the results in any date format; skipping projects due soon.'); break }
      if (!first) continue
      const last = Math.min(first.info.pages || 1, duePages)
      for (let p = 1; p <= last; p++) {
        const r = p === 1 ? first : await read(searchUrl({ district: code, page: p, from: fmtDate(from, format), to: fmtDate(to, format) }))
        const got = keep(code, r.got)
        got.forEach(x => { x.dueBy = to })
        all.push(...got)
      }
      log(`${name}: ${first.info.total} projects due by ${to}; read ${last} page(s)`)
    }
  } finally {
    if (chrome) { await chrome.close(); chrome = null }
  }
  const counts = ingestProjects(db, all, { firstRun, now })
  if (firstRun) log('First MahaRERA run: projects are stored as a baseline. From next week, anything new on the newest pages counts as new.')
  return { ...counts, pagesRead: n }
}
