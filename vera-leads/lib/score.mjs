// Score each account from its signals. Fresh, strong signals in MMR or Pune rise to the top.
import { config } from '../config.mjs'
import { companyKey, daysBetween, today } from './util.mjs'

export function blockedReason(account) {
  const k = ' ' + companyKey(account.name).replace(/-/g, ' ') + ' '
  const has = w => k.includes(' ' + w + ' ') || k.includes(' ' + w + 's ') // whole words only
  if (config.doNotContact.relationship.some(has)) return 'relationship'
  if (config.doNotContact.tooLarge.some(has)) return 'too_large'
  return ''
}

export function scoreAccount(account, signals, { now = today() } = {}) {
  const { weights, bonus, halfLifeDays } = config.score
  let s = 0
  const types = new Set()
  for (const g of signals) {
    const w = weights[g.type] ?? weights.manual
    const age = Math.max(0, daysBetween(g.date || g.seenAt, now))
    s += w * Math.pow(0.5, age / halfLifeDays)
    types.add(g.type.startsWith('maharera') ? 'maharera' : g.type)
  }
  // Many job posts from one firm should not outweigh everything else: cap hiring at 2 signals' worth.
  const hiring = signals.filter(g => g.type === 'hiring')
  if (hiring.length > 2) {
    const per = hiring.map(g => weights.hiring * Math.pow(0.5, Math.max(0, daysBetween(g.date, now)) / halfLifeDays)).sort((a, b) => b - a)
    s -= per.slice(2).reduce((a, b) => a + b, 0)
  }
  if (account.region) s += bonus.inRegion
  if ((account.projects || []).length >= 2) s += bonus.multiProject
  if ((account.openRoles || 0) >= 3) s += bonus.bulkHiring
  if (types.has('maharera') && types.has('hiring')) s += bonus.bothSignals
  if (account._verified) s += bonus.verifiedContact
  return Math.round(s)
}

// The single signal the first email should open on: the strongest, freshest one.
export function topSignal(signals, now = today()) {
  const { weights, halfLifeDays } = config.score
  return [...signals].sort((a, b) =>
    (weights[b.type] ?? 0) * Math.pow(0.5, Math.max(0, daysBetween(b.date, now)) / halfLifeDays) -
    (weights[a.type] ?? 0) * Math.pow(0.5, Math.max(0, daysBetween(a.date, now)) / halfLifeDays))[0]
}

export function scoreAll(db, now = today()) {
  const byAcc = new Map()
  for (const s of db.signals) (byAcc.get(s.account) || byAcc.set(s.account, []).get(s.account)).push(s)
  const verified = new Set(Object.values(db.contacts).filter(c => c.account && config.outreach.acceptResults.includes(c.verify?.result)).map(c => c.account))
  const rows = []
  for (const a of Object.values(db.accounts)) {
    const sigs = byAcc.get(a.key) || []
    a._verified = verified.has(a.key)
    a.blocked = blockedReason(a)
    a.score = a.blocked || !sigs.length ? 0 : scoreAccount(a, sigs, { now })
    a.top = sigs.length ? topSignal(sigs, now) : null
    a.signalCount = sigs.length
    rows.push(a)
  }
  return rows.sort((x, y) => y.score - x.score)
}
