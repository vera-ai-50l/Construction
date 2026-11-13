// Offline tests: every parser and the full pipeline on sample data. `node test/run.mjs`
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vera-leads-'))
process.env.VERA_DATA = path.join(tmp, 'data')
process.env.VERA_OUT = path.join(tmp, 'out')
process.env.VERA_QUIET = '1'

const FX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const NOW = '2026-11-13'
const { parseSearchPage, ingestProjects, regionOf, pageInfo, run: runMaharera } = await import('../sources/maharera.mjs')
const live = await import('./fixtures/maharera-live.mjs')
const { config } = await import('../config.mjs')
const { ingestJobs, normaliseJob } = await import('../sources/hiring.mjs')
const { importContacts, emailsOnPage, isBuyer } = await import('../lib/enrich.mjs')
const { buildExport, writeExport } = await import('../lib/export.mjs')
const { scoreAll } = await import('../lib/score.mjs')
const { mergeFields, roleShort } = await import('../lib/copy.mjs')
const { openStore, saveStore, addSuppression } = await import('../lib/store.mjs')
const { companyKey, prettyCompany, parseDate, parseCSV, toCSV } = await import('../lib/util.mjs')

let n = 0, failed = 0
const t = (name, fn) => { n++; try { fn(); console.log('ok  ', name) } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message) } }
const ta = async (name, fn) => { n++; try { await fn(); console.log('ok  ', name) } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message) } }

t('company keys merge legal-suffix variants', () => {
  assert.equal(companyKey('SHREE SAI DEVELOPERS AND BUILDERS PRIVATE LIMITED'), companyKey('Shree Sai Developers and Builders Pvt Ltd'))
  assert.equal(companyKey('M/s. Raj Constructions'), companyKey('Raj Constructions Pvt. Ltd.'))
  assert.equal(prettyCompany('PATIL INFRA PROJECTS LLP'), 'Patil Infra Projects')
})

t('dates in the shapes job boards and MahaRERA use', () => {
  const now = new Date(NOW)
  assert.equal(parseDate('31-12-2030'), '2030-12-31')
  assert.equal(parseDate('31/03/2029'), '2029-03-31')
  assert.equal(parseDate('5 Nov 2026'), '2026-11-05')
  assert.equal(parseDate('3 days ago', now), '2026-11-10')
  assert.equal(parseDate('30+ days ago', now), '2026-10-14')
})

t('CSV round trip with commas and quotes', () => {
  const rows = [{ a: 'x, y', b: 'say "hi"' }]
  assert.deepEqual(parseCSV(toCSV(rows)), rows)
})

t('MahaRERA card layout: one project per card, fields by label', () => {
  const p = parseSearchPage(fs.readFileSync(path.join(FX, 'maharera-page.html'), 'utf8'))
  assert.equal(p.length, 6)
  const sai = p.find(x => x.regNo === 'P51700049811')
  assert.equal(sai.project, 'SAI SHRADDHA HEIGHTS')
  assert.equal(sai.promoter, 'SHREE SAI DEVELOPERS AND BUILDERS PRIVATE LIMITED')
  assert.equal(sai.district, 'Thane')
  assert.equal(sai.registered, '2026-10-14')
  assert.equal(sai.completion, '2030-12-31')
  assert.equal(sai.url, 'https://maharera.maharashtra.gov.in/view-project-details?project_id=88120')
  const green = p.find(x => x.regNo === 'P52100031207')
  assert.equal(green.completion, '2026-06-30')
  assert.equal(green.revised, '2027-03-31')
})

t('MahaRERA table layout', () => {
  const p = parseSearchPage(fs.readFileSync(path.join(FX, 'maharera-table.html'), 'utf8'))
  assert.equal(p.length, 2)
  assert.equal(p[0].promoter, 'OM SAI ENTERPRISES')
  assert.equal(p[0].project, 'Om Sai Park')
  assert.equal(p[0].revised, '2027-06-30')
  assert.equal(p[1].revised, '')
  assert.equal(p[1].taluka, 'Haveli')
})

t('regions: MMR and Pune recognised, Nagpur not', () => {
  assert.equal(regionOf('Mumbai Suburban'), 'mmr')
  assert.equal(regionOf('Haveli', 'Pune'), 'pune')
  assert.equal(regionOf('Nagpur'), '')
})

const db = openStore()

t('MahaRERA signals: new, extension, deadline', () => {
  const p = parseSearchPage(fs.readFileSync(path.join(FX, 'maharera-page.html'), 'utf8'))
  const c = ingestProjects(db, p, { firstRun: true, now: NOW })
  // new: Sai (Oct 14), Macrotech (Oct 20), Nagpur (Nov 1), Green III (Sep 21) = 4
  assert.equal(c.new, 4)
  assert.equal(c.extension, 1) // Green Acres II
  // deadline within 180 days: Green II (revised Mar 2027) and Raj Residency (Feb 2027)
  assert.equal(c.deadline, 2)
  const again = ingestProjects(db, p, { firstRun: false, now: NOW })
  assert.equal(again.new + again.extension + again.deadline, 0, 're-running must not duplicate signals')
  assert.deepEqual(db.accounts[companyKey('Patil Infra Projects LLP')].projects.sort(), ['P52100031207', 'P52100031999'])
})

t('hiring: keeps site roles at construction firms, drops recruiters, IT, old posts, office roles', () => {
  const items = JSON.parse(fs.readFileSync(path.join(FX, 'naukri.json'), 'utf8'))
  const c = ingestJobs(db, items, { now: NOW })
  assert.equal(c.dropped.staffing, 1)
  assert.equal(c.dropped.notConstruction, 1)
  assert.equal(c.dropped.old, 1)
  assert.equal(c.dropped.role, 1) // accountant
  assert.equal(db.accounts[companyKey('Raj Constructions')].openRoles, 3)
  assert.equal(normaliseJob(items[1], new Date(NOW)).posted, '2026-11-10')
})

t('contacts import matches firms by name and domain', () => {
  const c = importContacts(db, path.join(FX, 'leadfinder.csv'))
  assert.equal(c.added, 6)
  const raj = db.accounts[companyKey('Raj Constructions')]
  assert.equal(raj.domain, 'rajconstructions.in')
  assert.equal(db.contacts['sunil@patilinfra.com'].account, companyKey('Patil Infra Projects LLP'))
  assert.equal(db.contacts['info@shreesaidevelopers.com'].account, companyKey('SHREE SAI DEVELOPERS AND BUILDERS PRIVATE LIMITED'))
})

t('buyer titles', () => {
  assert.ok(isBuyer('Managing Director'))
  assert.ok(isBuyer('Founder & CEO'))
  assert.ok(!isBuyer('HR Executive'))
  assert.ok(!isBuyer('Admin Manager'))
})

t('website emails: only the firm\'s own domain', () => {
  const html = '<a href="mailto:info@rajconstructions.in">x</a> sales@rajconstructions.in logo@2x.png someone@gmail.com'
  assert.deepEqual(emailsOnPage(html, 'rajconstructions.in').sort(), ['info@rajconstructions.in', 'sales@rajconstructions.in'])
})

t('scoring: Lodha/Macrotech blocked, in-region repeat builder on top', () => {
  const r = scoreAll(db, NOW)
  assert.equal(r.find(a => a.key === companyKey('Macrotech Developers Limited')).blocked, 'relationship')
  assert.equal(r.find(a => a.key === companyKey('Godrej Properties')).blocked, 'too_large')
  const top = r.filter(a => !a.blocked)[0]
  assert.ok([companyKey('Patil Infra Projects LLP'), companyKey('Raj Constructions')].includes(top.key), 'top was ' + top.key)
  const nagpur = r.find(a => a.key === companyKey('Vidarbha Homes Pvt Ltd'))
  assert.ok(nagpur.score < top.score)
})

t('first lines name the firm\'s own event, no em dashes', () => {
  const r = scoreAll(db, NOW)
  for (const a of r.filter(x => x.top)) {
    const f = mergeFields(a, a.top)
    assert.ok(f.signalLine.length > 20, a.key)
    assert.ok(!/—/.test(f.signalLine + f.angle))
  }
  const green = r.find(a => a.key === companyKey('Patil Infra Projects LLP'))
  assert.match(mergeFields(green, green.top).signalLine, /Green Acres Phase Ii?/i)
  assert.equal(roleShort('Site Engineer - Civil (3-6 yrs)'), 'site engineer')
})

t('export: only verified decision-makers, suppression and 90-day rule respected', () => {
  db.contacts['rakesh@rajconstructions.in'].verify = { result: 'ok', at: NOW }
  db.contacts['priya@rajconstructions.in'].verify = { result: 'ok', at: NOW }
  db.contacts['sunil@patilinfra.com'].verify = { result: 'catch_all', at: NOW }
  db.contacts['anand@mehtabuildcon.in'].verify = { result: 'ok', at: NOW }
  db.contacts['dev@macrotech.example'].verify = { result: 'ok', at: NOW }
  addSuppression(db, ['@mehtabuildcon.in'])
  const out = buildExport(db, { now: NOW })
  const emails = out.saleshandy.map(r => r.Email)
  assert.deepEqual(emails, ['rakesh@rajconstructions.in'], 'got ' + emails.join(','))
  assert.equal(out.catchAll[0].Email, 'sunil@patilinfra.com')
  assert.ok(out.needs.some(r => r.Company === 'Shree Sai Developers and Builders'), 'unverified firm should be in needs-contacts')
  assert.ok(!out.accounts.some(a => /macrotech/i.test(a.Company)))
  const files = writeExport(db, out, { now: NOW })
  saveStore(db)
  const sh = parseCSV(fs.readFileSync(files.saleshandy, 'utf8'))
  assert.equal(sh[0]['First Name'], 'Rakesh')
  assert.match(sh[0]['Signal Line'], /^Saw|is due/)
  const next = buildExport(openStore(), { now: '2026-11-20' })
  assert.equal(next.saleshandy.length, 0, 'same firm must not be exported again within 90 days')
})

t('Lead Finder lists: exported without a signal, after signal firms, same exclusions', () => {
  const db2 = openStore()
  const c = importContacts(db2, path.join(FX, 'leadfinder-list.csv'), { list: true })
  assert.equal(c.listFirms, 4)
  for (const e of ['kiran@desaibuildtech.in', 'neha@kulkarniconstructions.com', 'ajay@godrejproperties.example']) db2.contacts[e].verify = { result: 'ok', at: NOW }
  const out = buildExport(db2, { now: NOW })
  const emails = out.list.map(r => r.Email).sort()
  assert.deepEqual(emails, ['kiran@desaibuildtech.in', 'neha@kulkarniconstructions.com'], 'got ' + emails.join(','))
  const desai = out.list.find(r => r.Email.startsWith('kiran'))
  assert.equal(desai['Signal Line'], 'Came across Desai Buildtech while looking at construction firms in Thane.')
  assert.equal(db2.accounts[companyKey('Desai Buildtech Pvt Ltd')].region, 'mmr')
  assert.ok(!out.list.some(r => /patil/i.test(r.Email)), 'a firm with a real signal stays in the signal lane')
  assert.ok(!out.needs.some(r => /Kulkarni|Desai/.test(r.Company)), 'list firms do not crowd needs-contacts')
  assert.equal(buildExport(db2, { now: NOW, limit: 1 }).list.length, 1, 'lists only fill what is left of the cap')
  const files = writeExport(db2, out, { now: NOW })
  assert.equal(parseCSV(fs.readFileSync(files.list, 'utf8')).length, 2)
  assert.equal(buildExport(db2, { now: '2026-11-20' }).list.length, 0, '90-day rule applies to lists too')
})

t('MahaRERA live layout: place, last modified, extension certificate, totals', () => {
  const html = live.page([
    { reg: 'P51700099901', project: 'SKYLINE NEST', promoter: 'ORBIT HOMES LLP', place: 'Kalyan', district: 'Thane', modified: '2026-10-20', id: 901 },
    { reg: 'P51800099902', project: 'HARBOUR VIEW', promoter: 'KEYSTONE REALTORS', place: 'Kurla', district: 'Mumbai Suburban', modified: '2026-08-02', ext: true, id: 902 },
    { reg: 'P52300099903', project: 'GREEN NOOK', promoter: 'SAHYADRI DEVELOPERS ASHTI', place: 'Ashti', district: 'Beed', modified: '2019-01-01', id: 903 },
  ], { total: 50013, pages: 5002 })
  assert.deepEqual(pageInfo(html), { total: 50013, pages: 5002 })
  const p = parseSearchPage(html)
  assert.equal(p.length, 3)
  assert.deepEqual(p.map(x => [x.project, x.promoter, x.taluka, x.district, x.modified, x.extCert]), [
    ['SKYLINE NEST', 'ORBIT HOMES LLP', 'Kalyan', 'Thane', '2026-10-20', false],
    ['HARBOUR VIEW', 'KEYSTONE REALTORS', 'Kurla', 'Mumbai Suburban', '2026-08-02', true],
    ['GREEN NOOK', 'SAHYADRI DEVELOPERS ASHTI', 'Ashti', 'Beed', '2019-01-01', false], // footer text must not leak in
  ])
  assert.equal(p[0].url, 'https://maharerait.maharashtra.gov.in/public/project/view/901')
})

await ta('MahaRERA weekly run: newest pages, due-soon search, extensions, baseline then new', async () => {
  const { openStore: open } = await import('../lib/store.mjs')
  const db = open()
  for (const k of Object.keys(db.accounts)) delete db.accounts[k]
  db.signals.length = 0
  const old = { ...config.maharera }
  config.maharera.gapMs = 0
  config.maharera.districts = { 517: 'Thane', 521: 'Pune' }
  const P = (reg, project, promoter, modified, extra = {}) => ({ reg, project, promoter, place: 'Thane', district: 'Thane', modified, id: +reg.slice(-4), ...extra })
  const thane = { // page 3 is the newest
    1: [P('P51700000101', 'OLD COURT', 'VINTAGE BUILDERS', '2018-01-01')],
    2: [P('P51700000201', 'MID TOWERS', 'MIDWAY INFRA', '2026-03-01', { ext: true })],
    3: [P('P51700000301', 'FRESH HEIGHTS', 'NEWLEAF DEVELOPERS', '2026-10-25'), P('P51700000302', 'QUIET PARK', 'STILL WATERS REALTY', '2025-02-01')],
  }
  const due = [P('P51700000401', 'FINAL STRETCH', 'DEADLINE CONSTRUCTIONS', '2026-06-01')]
  const urls = []
  let dueWorks = true
  const realFetch = globalThis.fetch
  globalThis.fetch = async u => {
    const q = new URL(u).searchParams, d = q.get('project_district'), pg = +q.get('page') || 1, from = q.get('completionDate_from')
    urls.push(String(u))
    let html
    if (d === '0') html = live.page([P('P50500000001', 'FAR AWAY', 'NAGPUR HOMES', '2017-01-01', { district: 'Nagpur' })], { total: 50013, pages: 5002 })
    else if (d === '517' && dueWorks && from && /^\d{4}-\d{2}-\d{2}$/.test(from)) html = live.page(due, { total: 1, pages: 1 })
    else if (d === '517') html = live.page(thane[pg] || [], { total: 4, pages: 3, current: pg })
    else html = live.page([], { total: 0, pages: 1 })
    return new Response(html, { status: 200 })
  }
  try {
    const c1 = await runMaharera(db, { browser: false, now: NOW })
    assert.equal(c1.new, 1, 'first run: only the newest-page project modified in the last 60 days')
    assert.equal(c1.extension, 1)
    assert.equal(c1.deadline, 1)
    assert.ok(urls.some(u => /completionDate_from=2026-11-13&completionDate_to=2027-05-12/.test(u)), 'tried the date formats until one narrowed the results')
    const dl = db.signals.find(s => s.type === 'maharera_deadline')
    assert.equal(dl.completion, '2027-05-12')
    const top = scoreAll(db, NOW).find(a => a.key === companyKey('DEADLINE CONSTRUCTIONS'))
    assert.match(mergeFields(top, top.top).signalLine, /Final Stretch is due for completion on MahaRERA by May 2027/)
    assert.ok(!db.accounts[companyKey('NAGPUR HOMES')], 'statewide page is only a check, not a source')

    thane[3].push(P('P51700000303', 'BRAND NEW', 'FIRSTBRICK BUILDERS', '2026-11-12'))
    const c2 = await runMaharera(db, { browser: false, now: '2026-11-20' })
    assert.equal(c2.new, 1, 'second run: only the project that was not there last week')
    assert.ok(db.signals.some(s => s.type === 'maharera_new' && s.project === 'BRAND NEW'))

    // If the site ignores the date filter (returns the whole district), nothing is flagged as due.
    dueWorks = false
    const before = db.signals.filter(s => s.type === 'maharera_deadline').length
    const c3 = await runMaharera(db, { browser: false, now: '2026-11-27' })
    assert.equal(c3.deadline, 0)
    assert.equal(db.signals.filter(s => s.type === 'maharera_deadline').length, before)
  } finally {
    globalThis.fetch = realFetch
    Object.assign(config.maharera, old)
  }
})

console.log(`\n${n - failed}/${n} passed`)
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
