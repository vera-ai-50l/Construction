// Fast checks on the demo's logic (no network, no API key): `npm run check`.
import { search, MIN_SCORE } from '../lib/rag'
import { sampleWeek, summarize, morningMessage, TODAY, toCsv, parseCsv } from '../lib/staffing'

let failed = 0
const t = (label: string, ok: boolean, got?: unknown) => {
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `  (got ${JSON.stringify(got)})`}`)
}

// Retrieval: the right section ranks in the top two, and off-topic questions fall below the bar.
const expect: [string, string][] = [
  ['How many earned leaves do I get in a year?', 'leave-1'],
  ['What are the night shift timings and allowance?', 'shifts-5'],
  ['How do I swap a shift with a colleague?', 'shifts-3'],
  ['I got a needle-stick injury, what should I do?', 'safety-1'],
  ['When is salary credited?', 'pay-1'],
  ['How long is maternity leave?', 'leave-7'],
  ['how many PL can i carry forward', 'leave-5'],
  ['lost my ID card', 'conduct-2'],
  ['what is the dress code for doctors', 'conduct-1'],
]
for (const [q, id] of expect) {
  const h = search(q, 2)
  t(`"${q}" finds ${id}`, h.some((x) => x.id === id) && h[0].score >= MIN_SCORE, h.map((x) => [x.id, x.score]))
}
for (const q of ['what is the canteen menu today', 'Is there parking for two-wheelers?', 'who is the CEO', 'wifi password']) {
  const top = search(q, 1)[0]?.score ?? 0
  t(`"${q}" goes to HR`, top < MIN_SCORE, top)
}

// Staffing: today's morning matches the proposal's example message.
const e = sampleWeek()
const msg = morningMessage(summarize(e, TODAY, 'Morning'), TODAY, 'Morning')
t('ICU 9 of 10, needs 1 nurse', msg.includes('ICU: 9 of 10 planned present. 1 on leave.') && msg.includes('Below minimum of 10. Needs 1 nurse.'), msg)
t('Emergency waiting on 1 mark', msg.includes('Emergency: 5 of 6 planned present. 1 not yet marked.'), msg)
t('Ward 3 OK', msg.includes('Ward 3: 6 of 6 planned present. OK.'), msg)
const seen = new Set<string>()
t('no staff ID twice in one shift', e.every((x) => { const k = x.date + x.shift + x.staffId; const dup = seen.has(k); seen.add(k); return !dup }))
t('CSV export and import round-trip', parseCsv(toCsv(e)).entries.length === e.length)

if (failed) {
  console.log(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nAll checks passed')
