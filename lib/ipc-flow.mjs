// Vera health 01: IPC Compliance Kit, one month, one infection-control adviser's care homes.
//
// One source of truth for two runtimes:
//   - n8n: n8n/flows/ipc.mjs turns each step into a Code node (n8n/vera-demo.mjs build).
//   - the /ipc page: runs the same functions in the browser when the visitor presses "Run the flow".
// Each step function must be self-contained (no references outside its own body), because its
// source text is pasted into an n8n Code node as-is. No AI here: every score, rule and pound is code.

export const flow = {
  id: 'veraHealthIpcKit1',
  name: 'Vera health 01: IPC Compliance Kit',
  path: 'vera/ipc-kit',
  sample: '../lib/ipc-sample.json',
  note: [
    '## Vera health 01: IPC Compliance Kit',
    "POST one month of returns from an adviser's care homes: audits, symptom log, training register.",
    '',
    '1. **Collect returns**: clean the input, list missing audits.',
    '2. **Score & action plan**: % per audit, RAG (95 / 76), one action per failed item.',
    '3. **Outbreak watch**: 2+ D&V cases at one home within 48 h → suspected outbreak + draft call note.',
    '4. **Training check**: annual IPC training, new starters without induction.',
    '5. **Evidence pack**: per home, mapped to the Code of Practice criteria; adviser summary.',
    '6. **Hours & £**: time saved against the paper process.',
    '',
    'Plain JavaScript, no AI. Resident data is room numbers only.',
  ].join('\n'),
  steps: [
    { name: 'Collect returns', fn: collectReturns },
    { name: 'Score & action plan', fn: scoreAudits },
    { name: 'Outbreak watch', fn: outbreakWatch },
    { name: 'Training check', fn: trainingCheck },
    { name: 'Evidence pack', fn: evidencePack },
    { name: 'Hours & £', fn: hoursAndPounds },
  ],
}

export function collectReturns(input) {
  const b = input.body || input
  const text = (v) => String(v == null ? '' : v).trim()
  const num = (v) => (v === '' || v == null ? NaN : Number(v))
  // The four monthly audits in the common care-home IPC toolkit.
  const auditTypes = {
    hand: { name: 'Hand hygiene', owner: 'Home manager', unit: 'moments observed' },
    mattress: { name: 'Mattresses & covers', owner: 'Nurse in charge', unit: 'mattresses' },
    commode: { name: 'Commodes', owner: 'Housekeeping lead', unit: 'commodes' },
    environment: { name: 'Care environment', owner: 'Housekeeping lead', unit: 'checklist lines' },
  }
  const homes = (Array.isArray(b.homes) ? b.homes : [])
    .map((h) => ({ id: text(h.id), name: text(h.name), type: text(h.type) || 'residential', beds: num(h.beds), manager: text(h.manager) }))
    .filter((h) => h.id && h.name && Number.isFinite(h.beds) && h.beds > 0)
  const known = new Set(homes.map((h) => h.id))
  const rejected = []
  const audits = []
  for (const a of Array.isArray(b.audits) ? b.audits : []) {
    const type = text(a.type).toLowerCase()
    const checked = num(a.checked)
    if (!known.has(text(a.home)) || !auditTypes[type] || !Number.isFinite(checked) || checked <= 0) {
      rejected.push({ home: text(a.home), type, why: !known.has(text(a.home)) ? 'unknown home' : !auditTypes[type] ? 'unknown audit' : 'no count' })
      continue
    }
    audits.push({
      home: text(a.home), type, date: text(a.date), by: text(a.by), checked,
      fails: (Array.isArray(a.fails) ? a.fails : []).map((f) => ({ item: text(f.item), where: text(f.where) })).filter((f) => f.item),
    })
  }
  const missing = []
  for (const h of homes) for (const t of Object.keys(auditTypes)) if (!audits.some((a) => a.home === h.id && a.type === t)) missing.push({ home: h.id, type: t })
  const symptoms = (Array.isArray(b.symptoms) ? b.symptoms : [])
    .map((s) => ({ home: text(s.home), who: text(s.who) === 'staff' ? 'staff' : 'resident', where: text(s.where), symptom: text(s.symptom).toUpperCase(), onset: text(s.onset) }))
    .filter((s) => known.has(s.home) && s.onset && !Number.isNaN(Date.parse(s.onset)))
  const training = (Array.isArray(b.training) ? b.training : [])
    .map((t) => ({ home: text(t.home), staff: text(t.staff), role: text(t.role), started: text(t.started), ipc: text(t.ipc) }))
    .filter((t) => known.has(t.home) && t.staff)
  return {
    month: text(b.month), asOf: text(b.asOf), adviser: text(b.adviser), auditTypes, homes, audits, missing, rejected, symptoms, training,
    stats: { homes: homes.length, beds: homes.reduce((s, h) => s + h.beds, 0), returns: audits.length, expected: homes.length * Object.keys(auditTypes).length, lines: audits.reduce((s, a) => s + a.checked, 0) },
  }
}

export function scoreAudits(input) {
  const d = input
  // Common care-home IPC audit scoring: 95%+ compliant, 76–94% partial, 75% or less minimal.
  const rag = (pct) => (pct >= 95 ? 'green' : pct >= 76 ? 'amber' : 'red')
  const dueDays = { red: 7, amber: 14, green: 28 }
  const addDays = (iso, n) => {
    const t = new Date(iso + 'T12:00:00Z')
    t.setUTCDate(t.getUTCDate() + n)
    return t.toISOString().slice(0, 10)
  }
  const scores = d.audits.map((a) => {
    const pct = Math.round(((a.checked - a.fails.length) / a.checked) * 1000) / 10
    return { home: a.home, type: a.type, checked: a.checked, failed: a.fails.length, pct, rag: rag(pct) }
  })
  const actions = []
  for (const a of d.audits) {
    const s = scores.find((x) => x.home === a.home && x.type === a.type)
    for (const f of a.fails) {
      actions.push({ home: a.home, type: a.type, item: f.item, where: f.where, owner: d.auditTypes[a.type].owner, rag: s.rag, due: addDays(d.asOf, dueDays[s.rag]) })
    }
  }
  for (const m of d.missing) {
    actions.push({ home: m.home, type: m.type, item: d.auditTypes[m.type].name + ' audit not returned', where: '', owner: 'Home manager', rag: 'red', due: addDays(d.asOf, 3) })
  }
  const order = { red: 0, amber: 1, green: 2 }
  actions.sort((x, y) => order[x.rag] - order[y.rag] || x.home.localeCompare(y.home))
  const byHome = d.homes.map((h) => {
    const mine = scores.filter((s) => s.home === h.id)
    const checked = mine.reduce((s, x) => s + x.checked, 0)
    const failed = mine.reduce((s, x) => s + x.failed, 0)
    const pct = checked ? Math.round(((checked - failed) / checked) * 1000) / 10 : 0
    const gaps = d.missing.filter((m) => m.home === h.id).length
    const worst = mine.some((s) => s.rag === 'red') || gaps ? 'red' : mine.some((s) => s.rag === 'amber') ? 'amber' : 'green'
    return { home: h.id, pct, rag: worst, missing: gaps }
  })
  return { ...d, scores, actions, byHome }
}

export function outbreakWatch(input) {
  const d = input
  // Suspected D&V outbreak: two or more residents or staff at one home with diarrhoea and/or
  // vomiting within 48 hours. The home calls its UKHSA health protection team.
  const WINDOW_H = 48
  const gi = d.symptoms.filter((s) => s.symptom === 'D' || s.symptom === 'V' || s.symptom === 'D&V')
  const outbreaks = []
  for (const h of d.homes) {
    const cases = gi.filter((s) => s.home === h.id).sort((a, b) => Date.parse(a.onset) - Date.parse(b.onset))
    let best = []
    for (let i = 0; i < cases.length; i++) {
      const start = Date.parse(cases[i].onset)
      const run = cases.filter((c) => Date.parse(c.onset) >= start && Date.parse(c.onset) - start <= WINDOW_H * 3600e3)
      if (run.length > best.length) best = run
    }
    if (best.length >= 2) {
      const first = best[0]
      const last = best[best.length - 1]
      const spanH = Math.round((Date.parse(last.onset) - Date.parse(first.onset)) / 3600e3)
      const flaggedAt = best[1].onset
      const residents = best.filter((c) => c.who === 'resident').length
      const staff = best.length - residents
      const whereList = best.map((c) => (c.who === 'staff' ? 'staff (' + c.where + ')' : c.where)).join(', ')
      outbreaks.push({
        home: h.id,
        name: h.name,
        cases: best.length,
        residents,
        staff,
        firstOnset: first.onset,
        flaggedAt,
        spanH,
        where: whereList,
        steps: [
          'Call the UKHSA health protection team today and give the case list',
          'Close to admissions and transfers until the team declares the outbreak over',
          'Isolate affected residents in their rooms; one carer team per affected area',
          'Exclude ill staff until 48 h after their last symptom',
          'Enhanced cleaning of touch points with a chlorine-based product, twice a day',
        ],
        note:
          h.name + ': ' + best.length + ' people with diarrhoea and/or vomiting in ' + spanH + ' h (' + residents + ' resident' + (residents === 1 ? '' : 's') + ', ' + staff + ' staff). ' +
          'Rooms: ' + whereList + '. First onset ' + first.onset.replace('T', ' ') + '. Asking for HPT advice on stool samples and closure.',
      })
    }
  }
  const singles = d.homes
    .map((h) => ({ home: h.id, cases: gi.filter((s) => s.home === h.id).length }))
    .filter((x) => x.cases > 0 && !outbreaks.some((o) => o.home === x.home))
  return { ...d, outbreaks, watch: singles }
}

export function trainingCheck(input) {
  const d = input
  // IPC training is refreshed every year; new starters complete it within 14 days of starting.
  const asOf = Date.parse(d.asOf + 'T23:59:59Z')
  const DAY = 86400e3
  const people = d.training.map((t) => {
    const done = t.ipc ? Date.parse(t.ipc + 'T12:00:00Z') : NaN
    const started = t.started ? Date.parse(t.started + 'T12:00:00Z') : NaN
    let status = 'valid'
    let due = ''
    if (!Number.isFinite(done)) {
      const deadline = started + 14 * DAY
      status = Number.isFinite(started) && deadline >= asOf ? 'induction due' : 'never trained'
      due = Number.isFinite(started) ? new Date(deadline).toISOString().slice(0, 10) : ''
    } else {
      const expiry = done + 365 * DAY
      due = new Date(expiry).toISOString().slice(0, 10)
      if (expiry < asOf) status = 'expired'
      else if (expiry - asOf <= 30 * DAY) status = 'due in 30 days'
    }
    return { ...t, status, due }
  })
  const byHome = d.homes.map((h) => {
    const mine = people.filter((p) => p.home === h.id)
    const valid = mine.filter((p) => p.status === 'valid' || p.status === 'due in 30 days' || p.status === 'induction due').length
    return {
      home: h.id,
      staff: mine.length,
      pct: mine.length ? Math.round((valid / mine.length) * 1000) / 10 : 0,
      expired: mine.filter((p) => p.status === 'expired').length,
      never: mine.filter((p) => p.status === 'never trained').length,
      dueSoon: mine.filter((p) => p.status === 'due in 30 days' || p.status === 'induction due').length,
    }
  })
  const chase = people.filter((p) => p.status !== 'valid').sort((a, b) => a.due.localeCompare(b.due))
  return { ...d, trainingByHome: byHome, chase }
}

export function evidencePack(input) {
  const d = input
  // The ten criteria of the Health and Social Care Act 2008 Code of Practice on infection
  // prevention and control, and which of this month's records evidence each one.
  const criteria = [
    [1, 'Systems to manage and monitor IPC', ['audits', 'actions']],
    [2, 'Clean, suitable environment', ['environment', 'mattress', 'commode']],
    [3, 'Antimicrobial stewardship', []],
    [4, 'Information for residents and visitors', []],
    [5, 'Early identification of infection', ['symptoms']],
    [6, 'Staff know their IPC responsibilities', ['training', 'hand']],
    [7, 'Isolation facilities', ['outbreak']],
    [8, 'Access to laboratory support', []],
    [9, 'Policies followed', ['hand', 'actions']],
    [10, 'Occupational health for staff', ['exclusion']],
  ]
  const typeNames = { hand: 'Hand hygiene', mattress: 'Mattresses & covers', commode: 'Commodes', environment: 'Care environment' }
  const packs = d.homes.map((h) => {
    const has = (k) => {
      if (k in typeNames) return d.audits.some((a) => a.home === h.id && a.type === k)
      if (k === 'audits') return d.audits.some((a) => a.home === h.id)
      if (k === 'actions') return true
      if (k === 'symptoms') return true
      if (k === 'training') return d.training.some((t) => t.home === h.id)
      if (k === 'outbreak' || k === 'exclusion') return true
      return false
    }
    const rows = criteria.map(([n, title, needs]) => {
      const covered = needs.length > 0 && needs.every(has)
      const partly = !covered && needs.some(has)
      return { n, title, status: needs.length === 0 ? 'adviser' : covered ? 'covered' : partly ? 'partly' : 'gap', records: needs.filter(has) }
    })
    const audit = d.byHome.find((x) => x.home === h.id)
    const train = d.trainingByHome.find((x) => x.home === h.id)
    const ob = d.outbreaks.find((o) => o.home === h.id)
    const open = d.actions.filter((a) => a.home === h.id)
    return {
      home: h.id,
      name: h.name,
      rows,
      covered: rows.filter((r) => r.status === 'covered').length,
      files: [
        d.month + ' audit scores (' + (4 - audit.missing) + ' of 4 returned)',
        'Action plan · ' + open.length + ' open',
        'Training matrix · ' + train.pct + '% in date',
        ob ? 'Outbreak log · ' + ob.cases + ' cases, HPT call note' : 'Symptom log · no outbreak',
      ],
    }
  })
  const reds = d.byHome.filter((x) => x.rag === 'red').length
  const summary = [
    d.stats.returns + ' of ' + d.stats.expected + ' audits returned across ' + d.stats.homes + ' homes (' + d.stats.beds + ' beds).',
    d.actions.length + ' actions raised, ' + d.actions.filter((a) => a.rag === 'red').length + ' red · ' + reds + ' home' + (reds === 1 ? '' : 's') + ' need' + (reds === 1 ? 's' : '') + ' a call this week.',
    d.outbreaks.length ? d.outbreaks.map((o) => 'Suspected D&V outbreak at ' + o.name + ': ' + o.cases + ' cases in ' + o.spanH + ' h.').join(' ') : 'No suspected outbreaks.',
    d.chase.length + ' staff to chase for IPC training.',
  ]
  return { ...d, packs, summary }
}

export function hoursAndPounds(input) {
  const d = input
  // Minutes per home per month, paper process against Vera. Physical checks stay; scoring,
  // typing up, chasing, reporting and evidence filing go. See /ipc for the source of each number.
  const A = Object.assign(
    { managerRate: 24.19, consultantRate: 115, pricePerHome: 150, outbreaksPerHomeYear: 0.371, closureDays: 6, earlyCloseRatio: 0.442 },
    d.assumptions || {},
  )
  const tasks = [
    { k: 'hand', t: 'Hand hygiene audit', who: 'home', before: 75, after: 45 },
    { k: 'mattress', t: 'Mattress audit', who: 'home', before: 4.4, after: 3.5, perBed: true },
    { k: 'commode', t: 'Commode audit', who: 'home', before: 50, after: 35 },
    { k: 'environment', t: 'Environment audit', who: 'home', before: 105, after: 75 },
    { k: 'actions', t: 'Action plan & chasing', who: 'home', before: 90, after: 20 },
    { k: 'training', t: 'Training matrix', who: 'home', before: 60, after: 10 },
    { k: 'report', t: 'Monthly IPC report', who: 'home', before: 90, after: 10 },
    { k: 'cqc', t: 'CQC evidence folder', who: 'home', before: 60, after: 10 },
    { k: 'outbreak', t: 'Outbreak paperwork', who: 'home', before: (420 * A.outbreaksPerHomeYear) / 12, after: (120 * A.outbreaksPerHomeYear) / 12 },
    { k: 'review', t: "Read each home's returns", who: 'adviser', before: 60, after: 10 },
    { k: 'letter', t: 'Write monthly advice', who: 'adviser', before: 60, after: 15 },
    { k: 'calls', t: 'Phone queries', who: 'adviser', before: 30, after: 20 },
  ]
  const homes = d.homes && d.homes.length ? d.homes : [{ id: 'one', beds: 50 }]
  const r2 = (n) => Math.round(n * 100) / 100
  const lines = tasks.map((t) => {
    const mult = (h) => (t.perBed ? h.beds : 1)
    const before = homes.reduce((s, h) => s + t.before * mult(h), 0)
    const after = homes.reduce((s, h) => s + t.after * mult(h), 0)
    return { k: t.k, t: t.t, who: t.who, before: r2(before / 60), after: r2(after / 60), saved: r2((before - after) / 60) }
  })
  const sum = (who, f) => r2(lines.filter((l) => who === 'all' || l.who === who).reduce((s, l) => s + l[f], 0))
  const homeSaved = sum('home', 'saved')
  const adviserSaved = sum('adviser', 'saved')
  const homePounds = Math.round(homeSaved * A.managerRate * 100) / 100
  const adviserPounds = Math.round(adviserSaved * A.consultantRate * 100) / 100
  const monthPounds = Math.round((homePounds + adviserPounds) * 100) / 100
  const price = A.pricePerHome * homes.length
  const outbreaksYear = A.outbreaksPerHomeYear * homes.length
  const closureDaysSaved = r2(outbreaksYear * A.closureDays * (1 - A.earlyCloseRatio))
  return {
    ...d,
    value: {
      assumptions: A,
      homes: homes.length,
      lines,
      month: {
        homeBefore: sum('home', 'before'), homeAfter: sum('home', 'after'), homeSaved,
        adviserBefore: sum('adviser', 'before'), adviserAfter: sum('adviser', 'after'), adviserSaved,
        homePounds, adviserPounds, pounds: monthPounds, price, net: Math.round((monthPounds - price) * 100) / 100,
      },
      year: {
        hours: r2((homeSaved + adviserSaved) * 12),
        pounds: Math.round(monthPounds * 12),
        homePounds: Math.round(homePounds * 12),
        adviserPounds: Math.round(adviserPounds * 12),
        price: price * 12,
        outbreaks: r2(outbreaksYear),
        closureDaysSaved,
      },
      perHome: { homeHours: r2(homeSaved / homes.length), adviserHours: r2(adviserSaved / homes.length), pounds: Math.round((monthPounds / homes.length) * 100) / 100 },
      roi: price ? Math.round((monthPounds / price) * 10) / 10 : 0,
    },
  }
}

// Runs every step in order, the same way n8n passes plain JSON between nodes.
export function runAll(body) {
  let item = { body: JSON.parse(JSON.stringify(body)) }
  const trace = []
  for (const s of flow.steps) {
    item = JSON.parse(JSON.stringify(s.fn(item)))
    trace.push(item)
  }
  return trace
}
