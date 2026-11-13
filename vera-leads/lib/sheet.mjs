// What the weekly Google Sheet gets, as JSON for n8n (`node vera-leads.mjs sheet`).
//   research  this week's Lead Finder to-do list (needs-contacts.csv), best firm first: a new tab per week
//   ready     verified people exported this week (saleshandy.csv + saleshandy-list.csv): appended to "Ready to email"
//   summary   one row of counts: appended to "Summary"
// `done` is false until `weekly` has finished today, so n8n knows to wait and ask again.
import fs from 'node:fs'
import path from 'node:path'
import { DATA, OUT } from './store.mjs'
import { parseCSV, today } from './util.mjs'

export const LAST_WEEKLY = () => path.join(DATA, 'last-weekly.json')

export function recordWeekly(result, now = today()) {
  fs.mkdirSync(DATA, { recursive: true })
  fs.writeFileSync(LAST_WEEKLY(), JSON.stringify({ date: now, finishedAt: new Date().toISOString(), ...result }, null, 1))
}

const readCSV = file => (fs.existsSync(file) ? parseCSV(fs.readFileSync(file, 'utf8')) : [])

export function sheetData({ now = today(), credits = {} } = {}) {
  let last = null
  try { last = JSON.parse(fs.readFileSync(LAST_WEEKLY(), 'utf8')) } catch {}
  if (!last || last.date !== now) return { done: false, date: now, lastRun: last?.date || null }

  const dir = path.join(OUT, last.date)
  const research = readCSV(path.join(dir, 'needs-contacts.csv')).map((r, i) => ({
    Rank: i + 1,
    Status: '', // for you: found / not on Lead Finder / skip
    Company: r.Company,
    Score: r.Score,
    City: r.City,
    'Why now': r['Signal Line'],
    Project: r.Project,
    'Find the MD (LinkedIn)': r['LinkedIn People'],
    Google: r.Google,
    Website: r.Domain,
    Phone: r.Phone,
  }))
  const person = lane => r => ({
    Week: last.date, Lane: lane, Company: r.Company, 'First Name': r['First Name'], 'Last Name': r['Last Name'],
    'Job Title': r['Job Title'], Email: r.Email, 'Signal Line': r['Signal Line'], Project: r.Project, Score: r.Score,
  })
  const ready = [
    ...readCSV(path.join(dir, 'saleshandy.csv')).map(person('signal')),
    ...readCSV(path.join(dir, 'saleshandy-list.csv')).map(person('list')),
  ]
  const s = last.steps || {}
  const summary = {
    Week: last.date,
    'New MahaRERA projects': s.maharera?.new ?? '',
    'Hiring firms': s.hiring?.companies ?? '',
    'Emails verified': s.verify?.checked ?? '',
    'Ready to email': ready.length,
    'Need contacts': research.length,
    'Catch-all': last.export?.catchAll ?? '',
    'Steps skipped': Object.entries(s).filter(([, v]) => v?.skipped).map(([k, v]) => `${k}: ${v.skipped}`).join('; '),
    'MillionVerifier credits left': credits.millionVerifier ?? '',
    'Apify spent this month ($)': credits.apify ?? '',
    'Tab': last.date,
  }
  return { done: true, date: last.date, summary, research, ready }
}

// Balances for the summary row. Failures leave the cell empty; they never stop the sheet.
export async function creditBalances() {
  const out = {}
  try {
    if (process.env.MILLIONVERIFIER_KEY) {
      const r = await (await fetch(`https://api.millionverifier.com/api/v3/credits?api=${encodeURIComponent(process.env.MILLIONVERIFIER_KEY)}`)).json()
      if (r.credits != null) out.millionVerifier = r.credits
    }
  } catch {}
  try {
    if (process.env.APIFY_TOKEN) {
      const r = await (await fetch('https://api.apify.com/v2/users/me/usage/monthly', { headers: { authorization: `Bearer ${process.env.APIFY_TOKEN}` } })).json()
      const usd = r.data?.totalUsageCreditsUsdAfterVolumeDiscount
      if (usd != null) out.apify = Math.round(usd * 100) / 100
    }
  } catch {}
  return out
}
