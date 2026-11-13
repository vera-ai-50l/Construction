// Contacts: import people found elsewhere (Saleshandy Lead Finder, Apollo, a LinkedIn sheet),
// read public emails off company websites, and verify every address before it is exported.
import dns from 'node:dns/promises'
import path from 'node:path'
import fs from 'node:fs'
import { config } from '../config.mjs'
import { upsertAccount, upsertContact } from './store.mjs'
import { companyKey, daysBetween, domainOf, htmlToText, log, parseCSV, pick, politeFetch, today } from './util.mjs'

const ROLE_LOCAL = /^(info|contact|enquir|inquir|sales|admin|office|hr|careers|jobs|support|hello|mail|accounts|marketing|projects|purchase|team)\b/i

// ---------- import a contacts CSV ----------
export function importContacts(db, file) {
  const rows = parseCSV(fs.readFileSync(file, 'utf8'))
  const src = path.basename(file)
  const c = { rows: rows.length, added: 0, matched: 0, newAccounts: 0, skipped: 0 }
  const byDomain = new Map(Object.values(db.accounts).filter(a => a.domain).map(a => [a.domain, a]))
  for (const r of rows) {
    const email = String(pick(r, 'Email', 'Email Address', 'Work Email', 'Business Email', 'email')).toLowerCase()
    const linkedin = pick(r, 'LinkedIn', 'LinkedIn URL', 'Person Linkedin Url', 'Linkedin Profile', 'Profile URL')
    if (!email && !linkedin) { c.skipped++; continue }
    const companyName = pick(r, 'Company', 'Company Name', 'Organization', 'Account Name')
    const domain = domainOf(pick(r, 'Website', 'Company Website', 'Domain', 'Company Domain')) || (email && !/gmail|yahoo|hotmail|outlook|rediff/.test(email) ? email.split('@')[1] : '')
    let a = (domain && byDomain.get(domain)) || db.accounts[companyKey(companyName)]
    if (a) c.matched++
    else if (companyName || domain) {
      a = upsertAccount(db, { name: companyName || domain, domain, kind: 'imported' }); c.newAccounts++
      if (domain) byDomain.set(domain, a)
    }
    if (a && domain && !a.domain) { a.domain = domain; byDomain.set(domain, a) }
    upsertContact(db, {
      email, linkedin,
      first: pick(r, 'First Name', 'FirstName', 'first_name', 'Given Name'),
      last: pick(r, 'Last Name', 'LastName', 'last_name', 'Surname'),
      title: pick(r, 'Title', 'Job Title', 'Designation', 'Position'),
      phone: pick(r, 'Phone', 'Mobile', 'Mobile Phone', 'Direct Phone', 'Phone Number'),
      account: a?.key, source: src, sourceDate: today(),
    })
    c.added++
  }
  return c
}

// ---------- public emails from the company website ----------
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
export function emailsOnPage(html, domain) {
  const found = new Set()
  for (const m of String(html).replace(/\[at\]|\(at\)/gi, '@').matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase().replace(/^mailto:/, '')
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/.test(e)) continue
    if (/example\.|sentry|wixpress|domain\.com|email\.com/.test(e)) continue
    if (domain && !e.endsWith('@' + domain) && !e.endsWith('.' + domain)) continue
    found.add(e)
  }
  return [...found]
}

export async function enrichWebsites(db, { limit = 50, keys } = {}) {
  const c = { tried: 0, emails: 0 }
  const todo = Object.values(db.accounts).filter(a => a.domain && !a.webChecked && (!keys || keys.has(a.key))).slice(0, limit)
  for (const a of todo) {
    c.tried++
    a.webChecked = today()
    for (const p of ['', '/contact', '/contact-us', '/about-us']) {
      try {
        const res = await politeFetch(`https://${a.domain}${p}`, { gapMs: 1200, tries: 1 })
        if (!res.ok) continue
        const html = await res.text()
        for (const email of emailsOnPage(html, a.domain)) {
          upsertContact(db, { email, account: a.key, role: ROLE_LOCAL.test(email) ? 'generic' : '', source: `website:${a.domain}${p}`, sourceDate: today() }); c.emails++
        }
        if (!a.phone) { const ph = htmlToText(html).match(/(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/); if (ph) a.phone = ph[0] }
      } catch { /* site down or blocked; move on */ }
    }
  }
  return c
}

// ---------- verification ----------
const mxCache = new Map()
export async function hasMX(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain)
  // Only a definite answer counts as "no mail server". A network failure must not mark good emails invalid.
  const ok = await dns.resolveMx(domain).then(r => r.length > 0).catch(e => {
    if (['ENOTFOUND', 'ENODATA', 'ENONAME'].includes(e.code)) return false
    throw new Error(`DNS lookup failed for ${domain} (${e.code}). Check the network and try again.`)
  })
  mxCache.set(domain, ok)
  return ok
}

// MillionVerifier single-check API. Results: ok, catch_all, unknown, invalid, disposable.
export async function verifyEmail(email) {
  const key = process.env.MILLIONVERIFIER_KEY
  if (!key) throw new Error('MILLIONVERIFIER_KEY is not set.')
  const res = await politeFetch(`https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&timeout=20`, { gapMs: 150, tries: 2 })
  const j = await res.json()
  if (j.error) throw new Error(j.error)
  return j.result || 'unknown'
}

export async function verifyContacts(db, { limit = 500, keys, maxAgeDays = 60 } = {}) {
  if (!process.env.MILLIONVERIFIER_KEY) throw new Error('MILLIONVERIFIER_KEY is not set.')
  // If DNS can't find gmail.com's mail servers, this machine's DNS is broken: stop rather than mark everyone invalid.
  const dnsOk = await dns.resolveMx('gmail.com').then(r => r.length > 0).catch(() => false)
  if (!dnsOk) throw new Error('DNS is not working on this machine (cannot resolve gmail.com). Nothing was marked.')
  const c = { checked: 0, ok: 0, catch_all: 0, bad: 0, noMX: 0 }
  const todo = Object.values(db.contacts).filter(x => x.email && (!keys || keys.has(x.account)) && (!x.verify || daysBetween(x.verify.at) > maxAgeDays)).slice(0, limit)
  for (const x of todo) {
    const domain = x.email.split('@')[1]
    let result
    if (!(await hasMX(domain))) { result = 'invalid'; c.noMX++ }
    else result = await verifyEmail(x.email)
    x.verify = { result, at: today() }
    c.checked++
    if (result === 'ok') c.ok++; else if (result === 'catch_all') c.catch_all++; else c.bad++
  }
  if (c.checked) log(`Verified ${c.checked}: ${c.ok} ok, ${c.catch_all} catch-all, ${c.bad} rejected`)
  return c
}

const BUYER_RE = new RegExp(`\\b(${config.buyerTitles.map(t => t.replace(/\s+/g, '\\s*')).join('|')})\\b`, 'i')
export const isBuyer = title => BUYER_RE.test(String(title || ''))
export const isGeneric = email => ROLE_LOCAL.test(String(email).split('@')[0])
