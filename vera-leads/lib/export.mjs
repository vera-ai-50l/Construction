// Weekly export: the files the team actually works from.
//   saleshandy.csv      verified decision-makers at high-scoring firms, with the signal first line. Upload to Saleshandy.
//   saleshandy-list.csv verified people from Lead Finder lists (contacts --list) with no signal. Fills what is left of the weekly cap.
//   catch-all.csv       addresses the verifier could not confirm. Low volume from main inboxes only, or skip.
//   linkedin.csv        people to connect with on day 1 (and firms where LinkedIn is the only route).
//   needs-contacts.csv  high-scoring firms with no usable email yet: find the MD in Lead Finder or on LinkedIn.
//   accounts.csv        every scored firm, for review.
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.mjs'
import { mergeFields } from './copy.mjs'
import { isBuyer, isGeneric } from './enrich.mjs'
import { scoreAll } from './score.mjs'
import { OUT, isSuppressed, lastSentAt, markSent } from './store.mjs'
import { daysBetween, prettyCompany, toCSV, today } from './util.mjs'

const SH_COLS = ['Email', 'First Name', 'Last Name', 'Company', 'Job Title', 'Phone', 'LinkedIn', 'City', 'Signal Line', 'Angle', 'Project', 'Signal Type', 'Score', 'Source URL', 'Contact Source']

function contactRank(c) {
  return (isBuyer(c.title) ? 0 : c.title ? 2 : 1) + (isGeneric(c.email) ? 3 : 0)
}

const searchLinks = a => {
  const q = encodeURIComponent(`${prettyCompany(a.name)} ${a.city || a.district || ''}`.trim())
  return {
    google: `https://www.google.com/search?q=${q}`,
    linkedinPeople: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(prettyCompany(a.name) + ' director')}`,
  }
}

export function buildExport(db, { now = today(), min = config.score.minToExport, limit = config.outreach.perExport } = {}) {
  const ranked = scoreAll(db, now)
  const sent = lastSentAt(db)
  const contactsBy = new Map()
  for (const c of Object.values(db.contacts)) if (c.account) (contactsBy.get(c.account) || contactsBy.set(c.account, []).get(c.account)).push(c)

  const out = { saleshandy: [], list: [], catchAll: [], linkedin: [], needs: [], accounts: [] }
  const listRows = []
  const blocked = { relationship: 0, too_large: 0 }
  for (const a of ranked) {
    if (a.blocked) { blocked[a.blocked]++; continue }
    if (!a.top) continue
    const mf = mergeFields(a, a.top)
    out.accounts.push({ Company: mf.company, Score: a.score, Region: a.region || '', City: a.city || a.district || '', Signals: a.signalCount, 'Top Signal': a.top.title, Detail: a.top.detail, Projects: (a.projects || []).length, 'Open Roles': a.openRoles || 0, Domain: a.domain || '', 'Source URL': a.top.url || '' })
    if (a.score < min) continue

    const people = (contactsBy.get(a.key) || []).filter(c => !isSuppressed(db, c.email, a.domain)).sort((x, y) => contactRank(x) - contactRank(y))
    const fresh = c => !c.email || !sent.has(c.email) || daysBetween(sent.get(c.email), now) >= config.outreach.recontactAfterDays
    const recent = people.some(c => c.email && sent.has(c.email) && daysBetween(sent.get(c.email), now) < config.outreach.recontactAfterDays)
    if (recent) continue // this firm is already in a sequence
    const ok = people.find(c => c.email && fresh(c) && config.outreach.acceptResults.includes(c.verify?.result))
    const ca = !ok && people.find(c => c.email && fresh(c) && c.verify?.result === 'catch_all')
    const row = c => ({
      Email: c.email, 'First Name': c.first || '', 'Last Name': c.last || '', Company: mf.company, 'Job Title': c.title || '', Phone: c.phone || a.phone || '',
      LinkedIn: c.linkedin || '', City: a.city || a.district || '', 'Signal Line': mf.signalLine, Angle: mf.angle, Project: mf.project,
      'Signal Type': mf.signalType, Score: a.score, 'Source URL': mf.sourceUrl, 'Contact Source': c.source || '', account: a.key, email: c.email,
    })
    if (a.top.type === 'list') { if (ok) listRows.push(row(ok)); continue } // list firms: verified email or nothing
    if (ok && out.saleshandy.length < limit) out.saleshandy.push(row(ok))
    else if (ca) out.catchAll.push(row(ca))
    else if (!ok) out.needs.push({ Company: mf.company, Score: a.score, City: a.city || a.district || '', 'Signal Line': mf.signalLine, Project: mf.project, Domain: a.domain || '', Phone: a.phone || '', 'Have Emails': people.filter(c => c.email).length, ...Object.fromEntries(Object.entries(searchLinks(a)).map(([k, v]) => [k === 'google' ? 'Google' : 'LinkedIn People', v])) })

    const li = people.find(c => c.linkedin && isBuyer(c.title)) || people.find(c => c.linkedin)
    if (li) out.linkedin.push({ Name: [li.first, li.last].filter(Boolean).join(' '), 'Job Title': li.title || '', Company: mf.company, LinkedIn: li.linkedin, 'Signal Line': mf.signalLine, 'In Email Batch': ok ? 'yes' : 'no' })
  }
  // Signal firms take the weekly cap first; list firms fill what is left.
  out.list = listRows.slice(0, Math.max(0, limit - out.saleshandy.length))
  out.blocked = blocked
  return out
}

export function writeExport(db, out, { dryRun = false, now = today() } = {}) {
  const dir = path.join(OUT, now)
  fs.mkdirSync(dir, { recursive: true })
  const w = (name, rows, cols) => { fs.writeFileSync(path.join(dir, name), toCSV(rows, cols)); return path.join(dir, name) }
  const files = {
    saleshandy: w('saleshandy.csv', out.saleshandy, SH_COLS),
    list: w('saleshandy-list.csv', out.list, SH_COLS),
    catchAll: w('catch-all.csv', out.catchAll, SH_COLS),
    linkedin: w('linkedin.csv', out.linkedin),
    needs: w('needs-contacts.csv', out.needs),
    accounts: w('accounts.csv', out.accounts),
  }
  if (!dryRun) {
    markSent(db, out.saleshandy.map(r => ({ ...r, segment: 'construction' })), path.relative(OUT, files.saleshandy))
    markSent(db, out.list.map(r => ({ ...r, segment: 'construction' })), path.relative(OUT, files.list))
  }
  return files
}
