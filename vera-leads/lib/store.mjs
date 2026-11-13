// Plain files on disk, so anyone can open them: accounts, contacts, signals, what was exported, who opted out.
// Every signal keeps its source URL and the date we saw it. That is the "where did this contact come from"
// record the DPDP Rules will ask for from May 2027.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { companyKey, domainOf, hash, today } from './util.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const DATA = process.env.VERA_DATA || path.join(HERE, '..', 'data')
export const OUT = process.env.VERA_OUT || path.join(HERE, '..', 'out')

const f = name => path.join(DATA, name)
const readJSON = (name, d) => { try { return JSON.parse(fs.readFileSync(f(name), 'utf8')) } catch { return d } }
const readLines = name => { try { return fs.readFileSync(f(name), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) } catch { return [] } }

export function openStore() {
  fs.mkdirSync(DATA, { recursive: true })
  const db = {
    accounts: readJSON('accounts.json', {}),
    contacts: readJSON('contacts.json', {}),
    signals: readLines('signals.jsonl'),
    sent: readLines('sent.jsonl'),
    suppression: new Set(fs.existsSync(f('suppression.txt')) ? fs.readFileSync(f('suppression.txt'), 'utf8').split('\n').map(s => s.trim().toLowerCase()).filter(s => s && !s.startsWith('#')) : []),
  }
  db._sigIds = new Set(db.signals.map(s => s.id))
  db._newSignals = []
  db._newSent = []
  return db
}

export function saveStore(db) {
  fs.mkdirSync(DATA, { recursive: true })
  const write = (name, s) => { const tmp = f(name) + '.tmp'; fs.writeFileSync(tmp, s); fs.renameSync(tmp, f(name)) }
  write('accounts.json', JSON.stringify(db.accounts, null, 1))
  write('contacts.json', JSON.stringify(db.contacts, null, 1))
  if (db._newSignals.length) fs.appendFileSync(f('signals.jsonl'), db._newSignals.map(s => JSON.stringify(s)).join('\n') + '\n')
  if (db._newSent.length) fs.appendFileSync(f('sent.jsonl'), db._newSent.map(s => JSON.stringify(s)).join('\n') + '\n')
  db._newSignals = []; db._newSent = []
}

// Find or create the account for a company. Domain wins over name when both are known.
export function upsertAccount(db, { name, segment, domain, website, ...rest }) {
  const dom = domain || domainOf(website)
  let key = companyKey(name)
  if (!key && dom) key = dom
  if (!key) return null
  if (dom && !db.accounts[key]) {
    const byDom = Object.values(db.accounts).find(a => a.domain === dom)
    if (byDom) key = byDom.key
  }
  const a = db.accounts[key] || (db.accounts[key] = { key, name, segment, firstSeen: today(), tags: [] })
  a.lastSeen = today()
  if (name && (!a.name || a.name.length < name.length)) a.name = name
  if (!a.segment && segment) a.segment = segment
  if (dom && !a.domain) a.domain = dom
  if (website && !a.website) a.website = website
  for (const [k, v] of Object.entries(rest)) {
    if (v == null || v === '') continue
    if (Array.isArray(v)) a[k] = [...new Set([...(a[k] || []), ...v])]
    else if (!a[k]) a[k] = v
  }
  return a
}

// Signals are deduplicated by (type, natural key), so re-running a scrape never double counts.
export function addSignal(db, account, sig) {
  const id = hash(sig.type, sig.key || sig.url || sig.title, account.key)
  if (db._sigIds.has(id)) return false
  const s = { id, account: account.key, segment: account.segment, seenAt: today(), ...sig }
  delete s.key
  db._sigIds.add(id)
  db.signals.push(s)
  db._newSignals.push(s)
  return true
}

export function upsertContact(db, c) {
  const email = String(c.email || '').trim().toLowerCase()
  const id = email || (c.linkedin ? 'li:' + c.linkedin.replace(/\/+$/, '').toLowerCase() : '')
  if (!id) return null
  const cur = db.contacts[id] || (db.contacts[id] = { id, added: today() })
  for (const [k, v] of Object.entries({ ...c, email })) if (v != null && v !== '') cur[k] = v
  return cur
}

export function isSuppressed(db, email = '', domain = '') {
  const e = email.toLowerCase(), d = (domain || e.split('@')[1] || '').toLowerCase()
  return db.suppression.has(e) || (d && (db.suppression.has('@' + d) || db.suppression.has(d)))
}

export function addSuppression(db, entries) {
  const add = entries.map(s => s.trim().toLowerCase()).filter(s => s && !db.suppression.has(s))
  add.forEach(s => db.suppression.add(s))
  if (add.length) fs.appendFileSync(f('suppression.txt'), add.join('\n') + '\n')
  return add.length
}

export function markSent(db, rows, file) {
  for (const r of rows) db._newSent.push({ email: r.email, account: r.account, segment: r.segment, at: today(), file })
}

export function lastSentAt(db) {
  const m = new Map()
  for (const s of [...db.sent, ...db._newSent]) if (!m.has(s.email) || m.get(s.email) < s.at) m.set(s.email, s.at)
  return m
}
