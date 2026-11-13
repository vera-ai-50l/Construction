#!/usr/bin/env node
// Vera lead finder: construction contractors and developers in MMR and Pune, found by public signals.
// Run `node vera-leads.mjs help` for commands. See README.md for the weekly routine.
import './lib/env.mjs' // first, so .env is loaded before config.mjs reads it
import { config } from './config.mjs'
import { buildExport, writeExport } from './lib/export.mjs'
import { enrichWebsites, importContacts, verifyContacts } from './lib/enrich.mjs'
import { scoreAll } from './lib/score.mjs'
import { addSuppression, openStore, saveStore } from './lib/store.mjs'
import { daysBetween, parseCSV, pick, prettyCompany } from './lib/util.mjs'
import * as hiring from './sources/hiring.mjs'
import * as maharera from './sources/maharera.mjs'
import fs from 'node:fs'

const HELP = `
Vera lead finder (construction, MMR and Pune)

  node vera-leads.mjs maharera [--pages N] [--file page.html ...] [--debug]
      Read MahaRERA for Thane, Mumbai, Raigad, Palghar and Pune: the newest pages (new projects), the
      completion-date search (due in 6 months) and extension certificates. Uses Playwright when installed.
      --pages caps pages per district for a quick check. --file parses pages you saved yourself.

  node vera-leads.mjs hiring [--board naukri|linkedin] [--file items.json ...]
      Job posts for site, planning, billing, QS and stores roles via Apify (APIFY_TOKEN),
      or a dataset you exported from the Apify console.

  node vera-leads.mjs contacts <file.csv> [--list]
      Import people from Saleshandy Lead Finder, Apollo or a LinkedIn sheet. Matched to firms by domain or name.
      --list: a list you built yourself. Its firms are exported even without a signal (saleshandy-list.csv).

  node vera-leads.mjs enrich [--limit 50]
      Read public emails and phone numbers from the websites of the top firms.

  node vera-leads.mjs verify [--limit 500]
      Check emails with MillionVerifier (MILLIONVERIFIER_KEY). Nothing is exported unverified.

  node vera-leads.mjs top [--n 25]
      Show the highest-scoring firms and why.

  node vera-leads.mjs export [--dry-run] [--min 30] [--limit 150]
      Write this week's files to out/<date>/ and log who was exported so nobody is emailed twice in 90 days.
      --limit is the total of new people for the week: signal firms first, list firms fill the rest.

  node vera-leads.mjs suppress <email | @domain | file.csv>
      Add opt-outs and bounces to the do-not-contact list. Share this file with the Kyre side too.

  node vera-leads.mjs weekly
      maharera + hiring + enrich + verify + export, in that order. Steps without a key are skipped.

  node vera-leads.mjs status
      Counts: firms, signals by type, contacts, verified, exported.
`

const FLAGS = new Set(['list', 'browser', 'debug', 'dry-run', 'all'])

function args(argv) {
  const o = { _: [], file: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) { o._.push(a); continue }
    const k = a.slice(2), v = argv[i + 1]
    if (k === 'file') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) o.file.push(argv[++i]); continue }
    if (FLAGS.has(k) || v == null || v.startsWith('--')) o[k] = true
    else { o[k] = isNaN(+v) ? v : +v; i++ }
  }
  return o
}

const fmt = o => Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')

async function main() {
  const [cmd = 'help', ...rest] = process.argv.slice(2)
  const o = args(rest)
  if (cmd === 'help' || cmd === '--help') return console.log(HELP)
  const db = openStore()
  try {
    switch (cmd) {
      case 'maharera':
        console.log('MahaRERA:', fmt(await maharera.run(db, { pages: o.pages, browser: o.browser ? true : undefined, files: o.file, debug: !!o.debug })))
        break
      case 'hiring':
        console.log('Hiring:', fmt(await hiring.run(db, { board: o.board || 'naukri', files: o.file })))
        break
      case 'contacts': {
        const f = o._[0] || o.file[0]
        if (!f) throw new Error('Give a CSV file: node vera-leads.mjs contacts leads.csv')
        console.log('Contacts:', fmt(importContacts(db, f, { list: !!o.list })))
        break
      }
      case 'enrich': {
        const top = new Set(scoreAll(db).filter(a => a.score >= config.score.minToExport && a.top?.type !== 'list').map(a => a.key))
        console.log('Websites:', fmt(await enrichWebsites(db, { limit: o.limit || 50, keys: top })))
        break
      }
      case 'verify': {
        const top = new Set(scoreAll(db).filter(a => a.score >= config.score.minToExport).map(a => a.key))
        console.log('Verify:', fmt(await verifyContacts(db, { limit: o.limit || 500, keys: o.all ? undefined : top })))
        break
      }
      case 'top': {
        const rows = scoreAll(db).filter(a => !a.blocked && a.score > 0).slice(0, o.n || 25)
        for (const a of rows) console.log(`${String(a.score).padStart(4)}  ${prettyCompany(a.name)}${a.region ? ' [' + a.region + ']' : ''}\n      ${a.top?.title || ''}${a.top?.detail ? ' · ' + a.top.detail : ''}`)
        break
      }
      case 'export': {
        const out = buildExport(db, { min: o.min, limit: o.limit })
        const files = writeExport(db, out, { dryRun: !!o['dry-run'] })
        console.log(`Saleshandy: ${out.saleshandy.length} with a signal, ${out.list.length} from lists · catch-all: ${out.catchAll.length} · LinkedIn: ${out.linkedin.length} · need contacts: ${out.needs.length} · firms scored: ${out.accounts.length}`)
        console.log(`Left out on purpose: ${out.blocked.relationship} existing relationships, ${out.blocked.too_large} too large`)
        console.log('Files:\n  ' + Object.values(files).join('\n  '))
        if (o['dry-run']) console.log('Dry run: nobody marked as exported.')
        break
      }
      case 'suppress': {
        const x = o._[0]
        if (!x) throw new Error('Give an email, @domain or CSV file')
        const list = fs.existsSync(x) ? parseCSV(fs.readFileSync(x, 'utf8')).map(r => pick(r, 'Email', 'email', 'Email Address')).filter(Boolean) : o._
        console.log(`Added ${addSuppression(db, list)} to the do-not-contact list.`)
        break
      }
      case 'weekly': {
        const step = async (name, fn) => { try { console.log(name + ':', fmt(await fn())) } catch (e) { console.log(`${name}: skipped (${e.message})`) } }
        await step('MahaRERA', () => maharera.run(db, { browser: o.browser ? true : undefined }))
        saveStore(db)
        if (process.env.APIFY_TOKEN) await step('Hiring', () => hiring.run(db, {}))
        else console.log('Hiring: skipped (APIFY_TOKEN not set)')
        saveStore(db)
        const top = () => new Set(scoreAll(db).filter(a => a.score >= config.score.minToExport).map(a => a.key))
        await step('Websites', () => enrichWebsites(db, { keys: new Set([...top()].filter(k => db.accounts[k].top?.type !== 'list')) }))
        if (process.env.MILLIONVERIFIER_KEY) await step('Verify', () => verifyContacts(db, { keys: top() }))
        else console.log('Verify: skipped (MILLIONVERIFIER_KEY not set); nothing new can be exported until emails are verified')
        const out = buildExport(db)
        const files = writeExport(db, out, { dryRun: !!o['dry-run'] })
        console.log(`Export: ${out.saleshandy.length} with a signal and ${out.list.length} from lists to Saleshandy, ${out.needs.length} firms need a contact. Files in ${files.saleshandy.replace(/saleshandy\.csv$/, '')}`)
        break
      }
      case 'status': {
        const by = {}
        for (const s of db.signals) { const k = s.type; by[k] = by[k] || { total: 0, last30: 0 }; by[k].total++; if (daysBetween(s.seenAt) <= 30) by[k].last30++ }
        const cs = Object.values(db.contacts)
        const ranked = scoreAll(db)
        console.log(`Firms: ${Object.keys(db.accounts).length} (${ranked.filter(a => a.score >= config.score.minToExport).length} above the export score, ${ranked.filter(a => a.blocked).length} blocked)`)
        for (const [k, v] of Object.entries(by)) console.log(`  ${k.padEnd(20)} ${v.total} total, ${v.last30} in the last 30 days`)
        console.log(`Contacts: ${cs.length}, verified ok: ${cs.filter(c => c.verify?.result === 'ok').length}, catch-all: ${cs.filter(c => c.verify?.result === 'catch_all').length}`)
        console.log(`Exported to Saleshandy so far: ${db.sent.length}. Do-not-contact entries: ${db.suppression.size}`)
        break
      }
      default:
        console.log(`Unknown command "${cmd}".\n${HELP}`)
    }
  } finally {
    saveStore(db)
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
