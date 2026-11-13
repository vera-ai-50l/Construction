// Small helpers shared by every source: names, dates, CSV, HTTP.
import { createHash } from 'node:crypto'

export const today = () => new Date().toISOString().slice(0, 10)
export const hash = (...parts) => createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12)
export const sleep = ms => new Promise(r => setTimeout(r, ms))

// Company names arrive as "M/s. Shree Sai Developers Pvt. Ltd." or "SHREE SAI DEVELOPERS PRIVATE LIMITED".
// The key drops legal suffixes and punctuation so both land on the same account.
const SUFFIX = /\b(m\/s\.?|messrs|pvt|private|ltd|limited|llp|l\.l\.p|inc|co|company|corp|corporation|the|and|&)\b\.?/g
export function companyKey(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/m\/s\.?/g, ' ')
    .replace(/[.,()'"`’]/g, ' ')
    .replace(SUFFIX, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
}

// "SHREE SAI DEVELOPERS PRIVATE LIMITED" -> "Shree Sai Developers". For greetings and merge fields.
export function prettyCompany(name = '') {
  const s = String(name).replace(/\s+/g, ' ').trim()
  const cut = s.replace(/^m\/s\.?\s*/i, '').replace(/\s*\b(pvt\.?|private)\s*(ltd\.?|limited)\.?$/i, '').replace(/\s*\b(ltd\.?|limited|llp)\.?$/i, '').trim()
  if (cut !== cut.toUpperCase()) return cut
  const keep = new Set(['LLP', 'RMC', 'MEP', 'EPC', 'II', 'III', 'JV'])
  const small = new Set(['and', 'of', 'the'])
  return cut.split(' ').map((w, i) => (keep.has(w) ? w : i && small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase())).join(' ')
}

export function domainOf(url = '') {
  const s = String(url).trim()
  if (!s) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch { return '' }
}

// Many date shapes appear in Indian government pages and job boards. Returns YYYY-MM-DD or ''.
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }
export function parseDate(v, now = new Date()) {
  if (!v) return ''
  if (v instanceof Date) return isNaN(v) ? '' : v.toISOString().slice(0, 10)
  if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000).toISOString().slice(0, 10)
  const s = String(v).trim().toLowerCase()
  let m
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if ((m = s.match(/^(\d{1,2})[\s-]+([a-z]{3,4})[a-z]*[\s,-]+(\d{4})/)) && MON[m[2]]) return `${m[3]}-${String(MON[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if ((m = s.match(/^([a-z]{3,4})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/)) && MON[m[1]]) return `${m[3]}-${String(MON[m[1]]).padStart(2, '0')}-${m[2].padStart(2, '0')}`
  // Relative: "3 days ago", "Just now", "Today", "30+ days ago", "2 weeks ago"
  const d = new Date(now)
  if (/just now|today|few hours|hours? ago|minutes? ago/.test(s)) return d.toISOString().slice(0, 10)
  if (/yesterday/.test(s)) { d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }
  if ((m = s.match(/(\d+)\+?\s*(day|week|month)s?\s*ago/))) {
    const n = +m[1] * (m[2] === 'day' ? 1 : m[2] === 'week' ? 7 : 30)
    d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
  }
  return ''
}

export function daysBetween(a, b = today()) {
  if (!a) return Infinity
  return Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
}

// ---------- CSV ----------
export function toCSV(rows, cols) {
  cols = cols || [...new Set(rows.flatMap(r => Object.keys(r)))]
  const cell = v => {
    const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v)
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n') + '\n'
}

export function parseCSV(text) {
  const rows = []
  let row = [], cur = '', q = false
  text = String(text).replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some(x => x !== '')) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some(x => x !== '')) rows.push(row)
  const head = (rows.shift() || []).map(h => h.trim())
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

// Pick the first non-empty value among several possible column names, case and spacing ignored.
export function pick(obj, ...names) {
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
  const map = new Map(Object.keys(obj || {}).map(k => [norm(k), k]))
  for (const n of names) {
    const k = map.get(norm(n))
    if (k != null && obj[k] != null && String(obj[k]).trim() !== '') return obj[k]
  }
  return ''
}

// ---------- HTTP ----------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
let lastHit = 0
// Polite fetch: one request at a time, a pause between requests, retries with backoff.
export async function politeFetch(url, { gapMs = 2500, tries = 3, headers = {}, ...opts } = {}) {
  for (let t = 1; ; t++) {
    const wait = lastHit + gapMs - Date.now()
    if (wait > 0) await sleep(wait)
    lastHit = Date.now()
    try {
      const res = await fetch(url, { ...opts, headers: { 'user-agent': UA, 'accept-language': 'en-IN,en;q=0.9', ...headers }, signal: AbortSignal.timeout(45000) })
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (e) {
      if (t >= tries) throw new Error(`${url}: ${e.message}`)
      await sleep(2000 * t * t)
    }
  }
}

export function htmlToText(html = '') {
  return String(html)
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|td|th|span|label|a|section|article|dd|dt)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
}

export function log(...a) { if (!process.env.VERA_QUIET) console.error(...a) }
