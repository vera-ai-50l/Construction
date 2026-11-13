// Retrieval for the employee assistant: BM25 over the approved policy sections.
// Lexical search is enough for a few dozen short sections and keeps every match explainable;
// a pilot with hundreds of pages would add an embedding index alongside it.

import { chunks, type Chunk } from '@/content/policies'

const STOP = new Set(
  'a an and are as at be by can do does for from get got have how i if in is it its me my of on or our should so that the their them then there these this to was we what when where which who why will with you your am did has had into not no yes than also any each per only two one'.split(' '),
)

// Staff shorthand → the words the policies use. Applied to queries only.
const SYNONYMS: Record<string, string[]> = {
  pl: ['earned', 'privilege'],
  el: ['earned'],
  cl: ['casual'],
  sl: ['sick'],
  leaves: ['leave'],
  holidays: ['holiday'],
  comp: ['compensatory'],
  compoff: ['compensatory'],
  ot: ['overtime'],
  salary: ['salary', 'pay'],
  pay: ['salary'],
  paid: ['salary'],
  payslip: ['payslip'],
  pf: ['provident'],
  uan: ['provident'],
  needle: ['needle', 'sharps'],
  needlestick: ['needle', 'sharps'],
  prick: ['needle', 'sharps'],
  pregnant: ['maternity'],
  pregnancy: ['maternity'],
  delivery: ['maternity'],
  baby: ['maternity', 'paternity'],
  father: ['paternity'],
  late: ['late', 'grace'],
  punch: ['attendance', 'biometric'],
  swap: ['swap'],
  exchange: ['swap'],
  quit: ['resignation'],
  resign: ['resignation'],
  notice: ['notice', 'resignation'],
  harassment: ['harassment', 'posh'],
  complaint: ['grievance', 'complaint'],
  id: ['id', 'card'],
  badge: ['id', 'card'],
  conference: ['conference', 'cme'],
  workshop: ['cme', 'workshop'],
  vaccine: ['vaccination'],
  bls: ['bls', 'training'],
  acls: ['acls', 'training'],
  night: ['night'],
  timing: ['timings'],
  timings: ['timings'],
  dress: ['uniform'],
  clothes: ['uniform'],
  scrubs: ['uniform'],
}

// Light stemming so "swapping"/"swaps" meet "swap". Deterministic and fast.
function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

export function tokenize(text: string, expand = false): string[] {
  const words = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9₹\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.has(w))
  const out: string[] = []
  for (const w of words) {
    out.push(stem(w))
    if (expand && SYNONYMS[w]) for (const s of SYNONYMS[w]) out.push(stem(s))
  }
  return out
}

// ---- BM25 index, built once per server instance ----
const K1 = 1.4
const B = 0.75
// The heading is repeated so a match on it counts for more than a match in the body.
const docs = chunks.map((c) => tokenize(`${c.heading} ${c.heading} ${c.policy} ${c.text}`))
const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length
const df = new Map<string, number>()
for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)
const idf = (t: string) => {
  const n = df.get(t) ?? 0
  return Math.log(1 + (docs.length - n + 0.5) / (n + 0.5))
}
const tf = docs.map((d) => {
  const m = new Map<string, number>()
  for (const t of d) m.set(t, (m.get(t) ?? 0) + 1)
  return m
})

export type Hit = Chunk & { score: number; matched: string[] }

export function search(query: string, k = 4): Hit[] {
  const q = [...new Set(tokenize(query, true))]
  const scored = chunks.map((c, i) => {
    let s = 0
    const matched: string[] = []
    for (const t of q) {
      const f = tf[i].get(t)
      if (!f) continue
      matched.push(t)
      s += idf(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * docs[i].length) / avgLen)))
    }
    return { ...c, score: Math.round(s * 100) / 100, matched }
  })
  return scored
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}

// Below this top score, the question is not covered by an approved document: hand over to HR
// without calling the model at all. Tuned on the sample questions in scripts/check.mjs.
export const MIN_SCORE = 4
