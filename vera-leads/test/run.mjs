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
const { parseSearchPage, ingestProjects, regionOf } = await import('../sources/maharera.mjs')
const { ingestJobs, normaliseJob } = await import('../sources/hiring.mjs')
const { importContacts, emailsOnPage, isBuyer } = await import('../lib/enrich.mjs')
const { buildExport, writeExport } = await import('../lib/export.mjs')
const { scoreAll } = await import('../lib/score.mjs')
const { mergeFields, roleShort } = await import('../lib/copy.mjs')
const { openStore, saveStore, addSuppression } = await import('../lib/store.mjs')
const { companyKey, prettyCompany, parseDate, parseCSV, toCSV } = await import('../lib/util.mjs')

let n = 0, failed = 0
const t = (name, fn) => { n++; try { fn(); console.log('ok  ', name) } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message) } }

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

console.log(`\n${n - failed}/${n} passed`)
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
