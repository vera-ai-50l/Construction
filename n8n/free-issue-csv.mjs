// Turns a folder of workflow-03 register files into the JSON body the webhook expects.
//
//   contract_terms.json      { project, periods, contractors, deduct_in? }
//   free_issue_register.csv  -> issues
//   material_returns.csv     -> returns
//   closing_stock.csv        -> closing_stock
//   measurement_book.csv     -> measurements
//   boq_and_norms.csv        -> boq
//   bbs_summary.csv          -> bbs
//   ra_bills.csv             -> ra_bills
//
// CSV headers become JSON keys unchanged (see n8n/FREE-ISSUE.md for the columns).
// Numbers stay as text here; the workflow's first node cleans and validates them.

import fs from 'node:fs'
import path from 'node:path'

export const FILES = {
  issues: 'free_issue_register.csv',
  returns: 'material_returns.csv',
  closing_stock: 'closing_stock.csv',
  measurements: 'measurement_book.csv',
  boq: 'boq_and_norms.csv',
  bbs: 'bbs_summary.csv',
  ra_bills: 'ra_bills.csv',
}

// Small RFC 4180 reader: quoted fields, "" escapes, commas and newlines inside quotes.
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  if (!rows.length) return []
  const head = rows[0].map((h) => h.trim().replace(/^﻿/, ''))
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

export function buildFreeIssueSample(dir) {
  const terms = JSON.parse(fs.readFileSync(path.join(dir, 'contract_terms.json'), 'utf8'))
  const body = { ...terms }
  for (const [key, file] of Object.entries(FILES)) {
    const p = path.join(dir, file)
    body[key] = fs.existsSync(p) ? parseCSV(fs.readFileSync(p, 'utf8')) : []
  }
  return body
}
