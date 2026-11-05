// Workflow 03: Free-Issue Material Reconciliation (developer <-> contractor).
//
// The developer issues cement and steel free to a contractor. For each contractor,
// material and RA period this works out what was consumed, what the certified work
// needed, what the contract allows, and what to recover in the next RA bill.
// Request and response shapes: n8n/FREE-ISSUE.md.
//
// Units inside the workflow: cement in whole bags, steel in whole kg, money in whole paise.
// Output converts back to MT and rupees. Nothing is rounded except where noted
// (fractions of a bag or kg of excess are given to the contractor).
// Each step function is pasted into its own n8n Code node, so it must be self-contained.

export const flow = {
  id: 'veraDemoFreeIss1',
  name: 'Vera demo 03: Free-Issue Material Reconciliation',
  path: 'vera/free-issue',
  sample: 'freeissue-sample.json',
  note: [
    '## Vera demo 03: Free-issue reconciliation (developer ↔ contractor)',
    'POST contract terms + issue register, returns, yard stock, measurement book, BOQ norms, BBS and RA bills.',
    '',
    '1. **Read contract & registers**: validate, load wastage limits, recovery multiplier, issue rates.',
    '2. **Issued vs returned vs in stock**: consumed = opening + issued − returned − closing, per RA period.',
    '3. **Work done → theoretical need**: MB × norms; steel from BBS where given. Allowed = need × (1 + wastage).',
    '4. **Steel scrap check**: scrap that should have come back vs scrap weighed in.',
    '5. **Recovery**: excess × issue rate × multiplier, minus what earlier RA bills already deducted.',
    '6. **Confidence labels**: rule-based High / Medium / Check.',
    '7. **Recovery pack**: per-contractor summary, draft debit note (text + CSV), contractor comparison.',
    '',
    'Plain JavaScript, no AI. Money in whole paise until display.',
  ].join('\n'),
  steps: [
    { name: 'Read contract & registers', fn: readContract },
    { name: 'Issued vs returned vs in stock', fn: stockFlow },
    { name: 'Work done → theoretical need', fn: theoreticalNeed },
    { name: 'Steel scrap check', fn: scrapCheck },
    { name: 'Recovery calculation', fn: recovery },
    { name: 'Confidence labels', fn: confidence },
    { name: 'Recovery pack', fn: recoveryPack },
  ],
}

function readContract(input) {
  const b = input.body || input
  const text = (v) => String(v == null ? '' : v).trim()
  const num = (v) => (v === '' || v == null ? NaN : Number(String(v).replace(/[,₹\s]/g, '')))
  const yes = (v) => v === true || /^(y|yes|true|1)$/i.test(text(v))
  const list = (v) => (Array.isArray(v) ? v : [])
  const checks = [] // { level: 'check' | 'info', contractor, ref, message }
  const MATERIALS = {
    cement: { name: 'Cement', unit: 'bags', base: 'bags', perUnit: 1 },
    steel: { name: 'TMT steel', unit: 'MT', base: 'kg', perUnit: 1000 },
  }
  // Quantities in base units: whole bags, whole kg.
  const toBase = (m, q) => Math.round(q * MATERIALS[m].perUnit)

  const periods = list(b.periods).map((p) => ({ ra: text(p.ra).toUpperCase(), from: text(p.from), to: text(p.to), label: text(p.label) || text(p.ra) }))
  periods.sort((a, c) => a.from.localeCompare(c.from))
  const periodOf = (date) => {
    const p = periods.find((x) => date >= x.from && date <= x.to)
    return p ? p.ra : ''
  }

  const contractors = list(b.contractors).map((c) => {
    const id = text(c.id)
    const free = list(c.free_issue).map((m) => text(m).toLowerCase()).filter((m) => MATERIALS[m])
    const wastage = {}
    const rates = {}
    for (const m of free) {
      wastage[m] = num((c.wastage_pct || {})[m])
      rates[m] = num((c.issue_rates || {})[m])
      if (!Number.isFinite(wastage[m])) checks.push({ level: 'check', contractor: id, ref: 'contract', message: 'No allowed wastage % for ' + m + ' in contract terms' })
      if (!Number.isFinite(rates[m])) checks.push({ level: 'check', contractor: id, ref: 'contract', message: 'No issue rate for ' + m + ' in contract terms' })
    }
    const mult = num(c.recovery_multiplier)
    return {
      id, name: text(c.name) || id, package: text(c.package), tower: text(c.tower), workOrder: text(c.work_order),
      free, wastage, rates,
      multiplier: Number.isFinite(mult) ? mult : 1,
      scrapRate: num(c.scrap_recovery_rate),
    }
  })
  const known = (id) => contractors.some((c) => c.id === id)

  const issues = []
  for (const r of list(b.issues)) {
    const c = contractors.find((x) => x.id === text(r.contractor))
    const m = text(r.material).toLowerCase()
    const q = num(r.qty)
    const ra = periodOf(text(r.date))
    if (!c || !c.free.includes(m) || !Number.isFinite(q) || !ra) {
      checks.push({ level: 'check', contractor: text(r.contractor), ref: text(r.slip),
        message: 'Issue slip left out: ' + (!c ? 'unknown contractor' : !c.free.includes(m) ? m + ' is not free-issue for this contractor' : !Number.isFinite(q) ? 'no quantity' : 'date outside the RA periods') })
      continue
    }
    const rate = num(r.issue_rate)
    if (Number.isFinite(rate) && Number.isFinite(c.rates[m]) && rate !== c.rates[m]) {
      checks.push({ level: 'info', contractor: c.id, ref: text(r.slip), message: 'Slip rate ₹' + rate + ' differs from contract issue rate ₹' + c.rates[m] + ' (contract rate used)' })
    }
    issues.push({
      slip: text(r.slip), date: text(r.date), ra, contractor: c.id, tower: text(r.tower), floor: text(r.floor).toUpperCase(),
      material: m, qty: toBase(m, q), acknowledged: yes(r.acknowledged), acknowledgedBy: text(r.acknowledged_by),
    })
  }

  const returns = []
  for (const r of list(b.returns)) {
    const m = text(r.material).toLowerCase()
    const q = num(r.qty)
    const ra = periodOf(text(r.date))
    const type = /scrap/i.test(text(r.type)) ? 'scrap' : 'return'
    if (!known(text(r.contractor)) || !MATERIALS[m] || !Number.isFinite(q) || !ra) {
      checks.push({ level: 'check', contractor: text(r.contractor), ref: text(r.ref), message: 'Return left out: missing contractor, material, quantity or date' })
      continue
    }
    returns.push({ ref: text(r.ref), date: text(r.date), ra, contractor: text(r.contractor), material: m, type, qty: toBase(m, q), weighbridge: text(r.weighbridge_ref) })
  }

  const stock = []
  for (const r of list(b.closing_stock)) {
    const m = text(r.material).toLowerCase()
    const q = num(r.qty)
    if (!known(text(r.contractor)) || !MATERIALS[m]) continue
    if (!Number.isFinite(q)) continue // a blank count is the same as a missing count
    stock.push({ ra: text(r.ra).toUpperCase(), contractor: text(r.contractor), material: m, qty: toBase(m, q), countedOn: text(r.counted_on) })
  }

  const boq = list(b.boq).map((r) => ({
    contractor: text(r.contractor), code: text(r.boq_code).toUpperCase(), item: text(r.item), unit: text(r.unit),
    boqQty: num(r.boq_qty), cement: num(r.cement_bags_per_unit) || 0, steel: num(r.steel_mt_per_unit) || 0, bbsRef: text(r.bbs_ref),
  }))
  const measurements = list(b.measurements).map((r) => ({
    ra: text(r.ra).toUpperCase(), mb: text(r.mb_ref), contractor: text(r.contractor), code: text(r.boq_code).toUpperCase(),
    item: text(r.item), floor: text(r.floor).toUpperCase(), unit: text(r.unit), qty: num(r.qty),
  }))
  const bbs = list(b.bbs).map((r) => ({
    contractor: text(r.contractor), tower: text(r.tower), floor: text(r.floor).toUpperCase(), ref: text(r.bbs_ref), kg: Math.round(num(r.steel_mt) * 1000),
  })).filter((r) => Number.isFinite(r.kg))
  const raBills = list(b.ra_bills).map((r) => ({
    ra: text(r.ra).toUpperCase(), contractor: text(r.contractor), gross: num(r.gross),
    recoveredPaise: Math.round((num(r.material_recovery) || 0) * 100),
    material: text(r.recovery_material).toLowerCase(), forRa: text(r.recovery_for_ra).toUpperCase(), net: num(r.net),
  }))
  const lastRa = periods.length ? periods[periods.length - 1].ra : ''
  const nextRa = (() => {
    const m = lastRa.match(/^(.*?)(\d+)$/)
    return m ? m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0') : ''
  })()
  return {
    project: { name: text((b.project || {}).name), location: text((b.project || {}).location), developer: text((b.project || {}).developer), sample: !!(b.project || {}).sample || !!b.sample },
    materials: MATERIALS, periods, deductIn: text(b.deduct_in).toUpperCase() || nextRa,
    contractors, issues, returns, stock, boq, measurements, bbs, raBills, checks,
  }
}

function stockFlow(d) {
  // One "span" per contractor x material. Normally a span is one RA period; if the yard
  // count at the end of a period is missing, that period is joined to the next one.
  const spans = []
  for (const c of d.contractors) {
    for (const m of c.free) {
      const count = (ra) => d.stock.find((s) => s.contractor === c.id && s.material === m && s.ra === ra)
      let opening = 0
      let openingRa = ''
      let cur = null
      d.periods.forEach((p, i) => {
        if (!cur) cur = { contractor: c.id, material: m, ras: [], opening, openingRa, issued: 0, returned: 0, scrapReturned: 0, slips: [], unsigned: [], returnRefs: [], merged: false }
        cur.ras.push(p.ra)
        for (const s of d.issues.filter((x) => x.contractor === c.id && x.material === m && x.ra === p.ra)) {
          cur.issued += s.qty
          cur.slips.push(s.slip)
          if (!s.acknowledged) cur.unsigned.push(s.slip)
        }
        for (const r of d.returns.filter((x) => x.contractor === c.id && x.material === m && x.ra === p.ra)) {
          if (r.type === 'scrap') cur.scrapReturned += r.qty
          else cur.returned += r.qty
          cur.returnRefs.push(r.ref)
        }
        const cl = count(p.ra)
        const last = i === d.periods.length - 1
        if (cl) {
          cur.closing = cl.qty
          cur.countedOn = cl.countedOn
          cur.consumed = cur.opening + cur.issued - cur.returned - cl.qty
          spans.push(cur)
          opening = cl.qty
          openingRa = p.ra
          cur = null
        } else if (last) {
          cur.closing = null // no count for the latest period: consumption cannot be worked out yet
          cur.consumed = null
          spans.push(cur)
          cur = null
        } else {
          cur.merged = true
        }
      })
    }
  }
  for (const s of spans) s.span = s.ras.length > 1 ? s.ras[0] + ' to ' + s.ras[s.ras.length - 1] : s.ras[0]
  return { ...d, spans }
}

function theoreticalNeed(d) {
  const checks = d.checks.slice()
  // Running total per contractor + BOQ code, to catch certification beyond the BOQ quantity.
  const cum = {}
  const mbRows = [] // measurement rows with their need per material
  const bbsUsed = {} // contractor|floor -> true once that floor's BBS weight has been counted
  for (const p of d.periods) {
    for (const r of d.measurements.filter((x) => x.ra === p.ra)) {
      const item = d.boq.find((x) => x.contractor === r.contractor && x.code === r.code)
      const row = { ...r, cementNeed: 0, steelNeed: 0, steelBasis: '', bbsRef: '', beyondBoq: false, unknown: false }
      if (!item || !Number.isFinite(r.qty)) {
        row.unknown = true
        checks.push({ level: 'check', contractor: r.contractor, ref: r.mb, message: 'Measurement ' + r.code + ' not in the BOQ (or no quantity): left out of the need' })
        mbRows.push(row)
        continue
      }
      const key = r.contractor + '|' + r.code
      cum[key] = (cum[key] || 0) + r.qty
      if (Number.isFinite(item.boqQty) && cum[key] > item.boqQty + 1e-9) {
        row.beyondBoq = true
        checks.push({ level: 'check', contractor: r.contractor, ref: r.mb,
          message: r.code + ' certified to date ' + Math.round(cum[key] * 100) / 100 + ' ' + item.unit + ' is beyond the BOQ quantity ' + item.boqQty + ': confirm the variation before using it' })
      }
      row.cementNeed = r.qty * item.cement
      if (item.steel || item.bbsRef) {
        const bbs = item.bbsRef ? d.bbs.find((x) => x.contractor === r.contractor && x.floor === r.floor) : null
        const fk = r.contractor + '|' + r.floor
        if (bbs && !bbsUsed[fk]) {
          bbsUsed[fk] = true
          row.steelNeed = bbs.kg
          row.steelBasis = 'BBS'
          row.bbsRef = bbs.ref
        } else if (bbs) {
          row.steelBasis = 'BBS' // floor's BBS weight already counted with an earlier entry
          row.bbsRef = bbs.ref
        } else if (item.steel) {
          row.steelNeed = r.qty * item.steel * 1000
          row.steelBasis = 'norm'
        }
      }
      mbRows.push(row)
    }
  }
  for (const s of d.spans) {
    const c = d.contractors.find((x) => x.id === s.contractor)
    const rows = mbRows.filter((r) => r.contractor === s.contractor && s.ras.includes(r.ra))
    const need = s.material === 'cement' ? 'cementNeed' : 'steelNeed'
    const relevant = rows.filter((r) => r[need] > 0 || (s.material === 'steel' && r.steelBasis) || r.unknown)
    s.theoretical = rows.reduce((a, r) => a + r[need], 0)
    s.wastagePct = c.wastage[s.material]
    s.allowed = (s.theoretical * (100 + s.wastagePct)) / 100
    s.mbRefs = [...new Set(relevant.map((r) => r.mb))]
    s.bbsRefs = [...new Set(relevant.filter((r) => r.bbsRef).map((r) => r.bbsRef))]
    s.basis = s.material !== 'steel' ? 'norm' : relevant.some((r) => r.steelBasis === 'norm') ? (relevant.some((r) => r.steelBasis === 'BBS') ? 'BBS + norm' : 'norm') : 'BBS'
    s.normFloors = s.material === 'steel' ? [...new Set(relevant.filter((r) => r.steelBasis === 'norm').map((r) => r.floor))] : []
    s.beyondBoq = relevant.filter((r) => r.beyondBoq).map((r) => r.mb + ' (' + r.code + ')')
    s.unknownMb = relevant.filter((r) => r.unknown).map((r) => r.mb)
    // Nothing issued, held, counted or needed: no line for this material.
    s.empty = !s.issued && !s.opening && !s.returned && !s.scrapReturned && !s.theoretical && s.closing == null
  }
  return { ...d, mbRows, checks }
}

function scrapCheck(d) {
  // Steel only. Wastage within the allowance should come back as weighed scrap.
  // Steel used beyond the allowance is recovered as excess in the next step, so the scrap
  // check only covers the band between theoretical and allowed: nothing is counted twice.
  const checks = d.checks.slice()
  for (const s of d.spans) {
    if (s.material !== 'steel' || s.consumed == null) continue
    const c = d.contractors.find((x) => x.id === s.contractor)
    const expectedTotal = Math.max(0, s.consumed - s.theoretical) // all cutting loss, kg
    const expectedBand = Math.max(0, Math.min(s.consumed, s.allowed) - s.theoretical)
    s.scrapExpected = expectedTotal
    s.scrapExpectedInAllowance = expectedBand
    s.scrapMissing = Math.max(0, Math.floor(expectedBand - s.scrapReturned + 1e-9))
    if (s.scrapReturned > expectedTotal + 1e-9) {
      checks.push({ level: 'check', contractor: s.contractor, ref: s.span,
        message: 'More scrap returned (' + s.scrapReturned / 1000 + ' MT) than the cutting loss (' + Math.round(expectedTotal) / 1000 + ' MT): check BBS weights and the yard count' })
    }
    if (!Number.isFinite(c.scrapRate) && s.scrapMissing > 0) {
      checks.push({ level: 'check', contractor: s.contractor, ref: 'contract', message: 'No scrap recovery rate in contract terms: missing scrap not valued' })
    }
  }
  return { ...d, checks }
}

function recovery(d) {
  // Lines: one "excess" line per span, plus one "scrap" line per steel span.
  // Money in whole paise. Each line is rounded once, to the paisa; totals are exact sums.
  const lines = []
  for (const s of d.spans.filter((x) => !x.empty)) {
    const c = d.contractors.find((x) => x.id === s.contractor)
    const rate = c.rates[s.material]
    const perBase = s.material === 'steel' ? 1000 : 1 // rate is per MT for steel, per bag for cement
    const excess = s.consumed == null ? 0 : Math.max(0, Math.floor(s.consumed - s.allowed + 1e-9))
    const gross = Number.isFinite(rate) ? Math.round((excess * rate * 100 * c.multiplier) / perBase) : 0
    lines.push({ kind: 'excess', contractor: s.contractor, material: s.material, span: s.span, ras: s.ras, qty: excess, rate, multiplier: c.multiplier, grossPaise: gross, alreadyPaise: 0, alreadyRefs: [] })
    if (s.material === 'steel') {
      const miss = s.scrapMissing || 0
      const g = Number.isFinite(c.scrapRate) ? Math.round((miss * c.scrapRate * 100) / 1000) : 0
      lines.push({ kind: 'scrap', contractor: s.contractor, material: 'steel', span: s.span, ras: s.ras, qty: miss, rate: c.scrapRate, multiplier: 1, grossPaise: g, alreadyPaise: 0, alreadyRefs: [] })
    }
  }
  // Recoveries already deducted in earlier RA bills. Linked to a material and period when the
  // bill says so; otherwise held at contractor level so it is still never counted twice.
  const unallocated = {}
  const checks = d.checks.slice()
  for (const b of d.raBills) {
    if (!b.recoveredPaise) continue
    const scrap = /scrap/.test(b.material)
    const mat = scrap ? 'steel' : b.material
    const line = b.forRa && mat
      ? lines.find((l) => l.contractor === b.contractor && l.material === mat && l.kind === (scrap ? 'scrap' : 'excess') && l.ras.includes(b.forRa))
      : null
    if (line) {
      line.alreadyPaise += b.recoveredPaise
      line.alreadyRefs.push(b.ra)
    } else {
      unallocated[b.contractor] = (unallocated[b.contractor] || 0) + b.recoveredPaise
      checks.push({ level: 'check', contractor: b.contractor, ref: b.ra, message: 'Material recovery in ' + b.ra + ' is not linked to a material and RA period: subtracted from the contractor total' })
    }
  }
  for (const l of lines) l.netPaise = l.grossPaise - l.alreadyPaise
  return { ...d, lines, unallocated, checks }
}

function confidence(d) {
  // Rule-based labels, worst rule wins:
  //   Check  : unsigned issue slip, measurement beyond BOQ, data gap, no yard count for the
  //            latest period, more recovered than found, more scrap than the cutting loss
  //   Medium : yard count missing for a month (periods joined), or steel need from norms not BBS
  //   High   : slips acknowledged by the contractor and measured quantities certified
  for (const l of d.lines) {
    const s = d.spans.find((x) => x.contractor === l.contractor && x.material === l.material && x.span === l.span)
    const check = []
    const medium = []
    if (s.unsigned.length) check.push('Unsigned issue slip' + (s.unsigned.length > 1 ? 's ' : ' ') + s.unsigned.join(', '))
    if (s.beyondBoq.length) check.push('Certified beyond BOQ: ' + s.beyondBoq.join(', '))
    if (s.unknownMb.length) check.push('Measurement not in BOQ: ' + s.unknownMb.join(', '))
    if (s.consumed == null) check.push('No yard count for ' + s.ras[s.ras.length - 1] + ': count before recovering')
    else if (s.consumed < s.theoretical) check.push('Consumed is less than the work needs: check the yard count and measurements')
    if (l.netPaise < 0) check.push('Earlier bills recovered more than found: possible refund')
    if (l.kind === 'scrap' && s.scrapReturned > s.scrapExpected + 1e-9) check.push('More scrap returned than the cutting loss')
    if (s.merged) medium.push('No yard count at the end of ' + s.ras.slice(0, -1).join(', ') + ': ' + s.span + ' worked out together')
    if (l.material === 'steel' && s.basis !== 'BBS') medium.push('Steel need from norms (no BBS) for floor' + (s.normFloors.length > 1 ? 's ' : ' ') + s.normFloors.join(', '))
    l.confidence = check.length ? 'Check' : medium.length ? 'Medium' : 'High'
    l.reasons = check.length ? check.concat(medium) : medium.length ? medium : ['Slips acknowledged, quantities certified']
  }
  return d
}

function recoveryPack(d) {
  const rupees = (p) => p / 100
  const inr = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const mt = (kg) => kg / 1000
  const out = (m, q) => (q == null ? null : m === 'steel' ? mt(q) : q) // base units -> display units
  const show = (m, q) => (m === 'steel' ? (q / 1000).toFixed(1) + ' MT' : Math.round(q).toLocaleString('en-IN') + ' bags')
  const pct1 = (x) => Math.round(x * 10) / 10
  const LEVELS = ['High', 'Medium', 'Check']
  const split = (ls, key) => Object.fromEntries(LEVELS.map((k) => [k, rupees(ls.filter((l) => l.confidence === k).reduce((a, l) => a + l[key], 0))]))
  const sum = (ls, key) => ls.reduce((a, l) => a + l[key], 0)
  const label = { cement: 'Cement', steel: 'Steel' }

  const lines = d.lines.map((l, i) => {
    const s = d.spans.find((x) => x.contractor === l.contractor && x.material === l.material && x.span === l.span)
    const c = d.contractors.find((x) => x.id === l.contractor)
    return {
      id: 'L' + String(i + 1).padStart(2, '0'),
      contractor: l.contractor, contractorName: c.name, material: l.material, kind: l.kind, span: l.span, ras: l.ras,
      unit: d.materials[l.material].unit,
      issued: out(l.material, s.issued), returned: out(l.material, s.returned), opening: out(l.material, s.opening),
      closing: out(l.material, s.closing), consumed: out(l.material, s.consumed),
      theoretical: out(l.material, s.theoretical), allowed: out(l.material, s.allowed), wastageAllowedPct: s.wastagePct,
      wastagePct: s.consumed == null || !s.theoretical ? null : pct1(((s.consumed - s.theoretical) / s.theoretical) * 100),
      basis: s.basis,
      scrapExpected: l.kind === 'scrap' ? mt(s.scrapExpectedInAllowance) : null,
      scrapReturned: l.material === 'steel' ? mt(s.scrapReturned) : null,
      qty: out(l.material, l.qty), rate: l.rate, multiplier: l.multiplier,
      gross: rupees(l.grossPaise), alreadyRecovered: rupees(l.alreadyPaise), alreadyIn: l.alreadyRefs, net: rupees(l.netPaise),
      confidence: l.confidence, reasons: l.reasons,
      evidence: { slips: s.slips, unsigned: s.unsigned, mb: s.mbRefs, bbs: s.bbsRefs, returns: s.returnRefs, count: s.countedOn ? s.span.split(' to ').pop() + ' yard count ' + s.countedOn : '' },
      _grossPaise: l.grossPaise, _alreadyPaise: l.alreadyPaise, _netPaise: l.netPaise,
    }
  })

  const contractors = d.contractors.map((c) => {
    const ls = lines.filter((l) => l.contractor === c.id)
    const unalloc = d.unallocated[c.id] || 0
    const materials = c.free.map((m) => {
      const ss = d.spans.filter((s) => s.contractor === c.id && s.material === m && s.consumed != null)
      const issued = ss.reduce((a, s) => a + s.issued, 0)
      const consumed = ss.reduce((a, s) => a + s.consumed, 0)
      const theo = ss.reduce((a, s) => a + s.theoretical, 0)
      return {
        material: m, unit: d.materials[m].unit, issued: out(m, issued), consumed: out(m, consumed), theoretical: out(m, theo),
        wastagePct: theo ? pct1(((consumed - theo) / theo) * 100) : null, allowedPct: c.wastage[m],
        excess: out(m, ls.filter((l) => l.material === m && l.kind === 'excess').reduce((a, l) => a + (m === 'steel' ? l.qty * 1000 : l.qty), 0)),
        scrapExpected: m === 'steel' ? mt(ss.reduce((a, s) => a + s.scrapExpectedInAllowance, 0)) : null,
        scrapReturned: m === 'steel' ? mt(ss.reduce((a, s) => a + s.scrapReturned, 0)) : null,
        amount: rupees(ls.filter((l) => l.material === m).reduce((a, l) => a + l._netPaise, 0)),
      }
    })
    return {
      id: c.id, name: c.name, package: c.package, tower: c.tower, workOrder: c.workOrder,
      terms: { wastagePct: c.wastage, multiplier: c.multiplier, issueRates: c.rates, scrapRate: c.scrapRate },
      gross: rupees(sum(ls, '_grossPaise')), alreadyRecovered: rupees(sum(ls, '_alreadyPaise') + unalloc), unallocatedRecovered: rupees(unalloc),
      net: rupees(sum(ls, '_netPaise') - unalloc), byConfidence: split(ls, '_netPaise'), materials,
    }
  })

  // Contractor comparison: wastage % by material.
  const mats = [...new Set(d.contractors.flatMap((c) => c.free))]
  const comparison = mats.map((m) => ({
    material: m, name: d.materials[m].name, unit: d.materials[m].unit,
    rows: contractors.filter((c) => c.materials.some((x) => x.material === m)).map((c) => {
      const x = c.materials.find((y) => y.material === m)
      return { contractor: c.id, name: c.name, wastagePct: x.wastagePct, allowedPct: x.allowedPct, over: x.wastagePct != null && x.wastagePct > x.allowedPct, amount: x.amount }
    }),
  }))

  // Floor view (indicative: returns and yard stock are not floor-wise).
  const floors = []
  for (const c of d.contractors) {
    for (const m of c.free) {
      const fl = [...new Set(d.issues.filter((i) => i.contractor === c.id && i.material === m).map((i) => i.floor).concat(d.mbRows.filter((r) => r.contractor === c.id).map((r) => r.floor)))].filter(Boolean)
      for (const f of fl) {
        const issued = d.issues.filter((i) => i.contractor === c.id && i.material === m && i.floor === f).reduce((a, i) => a + i.qty, 0)
        const need = d.mbRows.filter((r) => r.contractor === c.id && r.floor === f).reduce((a, r) => a + (m === 'cement' ? r.cementNeed : r.steelNeed), 0)
        if (!issued && !need) continue
        const overPct = need ? pct1(((issued - need) / need) * 100) : null
        floors.push({ contractor: c.id, material: m, floor: f, issued: out(m, issued), theoretical: out(m, need), overPct, flag: overPct == null ? issued > 0 : overPct > c.wastage[m] + 5 })
      }
    }
  }

  // Draft debit notes, one per contractor with something to recover.
  const debitNotes = []
  for (const c of contractors) {
    const ls = lines.filter((l) => l.contractor === c.id && l._netPaise !== 0)
    if (!ls.length) continue
    const k = d.contractors.find((x) => x.id === c.id)
    const ref = 'DN/' + (k.tower || c.id).replace(/[^A-Za-z0-9]/g, '').toUpperCase() + '/' + d.deductIn + '/01'
    const t = []
    t.push('DRAFT DEBIT NOTE: free-issue material recovery' + (d.project.sample ? ' (SAMPLE DATA)' : ''))
    t.push('Ref: ' + ref)
    t.push('To: ' + c.name + (c.package ? ', ' + c.package : '') + (c.workOrder ? ' (WO ' + c.workOrder + ')' : ''))
    t.push('Project: ' + d.project.name + (d.project.location ? ', ' + d.project.location : ''))
    t.push('To be deducted in: ' + d.deductIn)
    t.push('Basis: allowed wastage ' + k.free.map((m) => m + ' ' + k.wastage[m] + '%').join(', ') + '; excess recovered at ' + k.multiplier + ' × issue rate' + (Number.isFinite(k.scrapRate) ? '; missing scrap at ₹' + k.scrapRate.toLocaleString('en-IN') + '/MT' : '') + '.')
    t.push('')
    ls.forEach((l, i) => {
      const what = l.kind === 'scrap'
        ? 'Steel scrap not returned, ' + l.span + ': expected ' + l.scrapExpected.toFixed(3) + ' MT within allowance, returned ' + l.scrapReturned.toFixed(3) + ' MT, missing ' + l.qty.toFixed(3) + ' MT × ₹' + l.rate.toLocaleString('en-IN') + '/MT'
        : label[l.material] + ' excess, ' + l.span + ': consumed ' + show(l.material, l.material === 'steel' ? l.consumed * 1000 : l.consumed) + ' vs allowed ' + show(l.material, l.material === 'steel' ? l.allowed * 1000 : l.allowed) + ', excess ' + (l.material === 'steel' ? l.qty.toFixed(3) + ' MT' : l.qty + ' bags') + ' × ₹' + l.rate.toLocaleString('en-IN') + ' × ' + l.multiplier
      t.push(i + 1 + '. ' + what + ' = ' + inr(l._grossPaise) + (l._alreadyPaise ? ', less already recovered in ' + l.alreadyIn.join(', ') + ' ' + inr(l._alreadyPaise) + ' = ' + inr(l._netPaise) : '') + '  [' + l.confidence + ']')
      const ev = []
      if (l.evidence.slips.length) ev.push('slips ' + l.evidence.slips.join(', '))
      if (l.evidence.mb.length) ev.push('MB ' + l.evidence.mb.join(', '))
      if (l.evidence.bbs.length) ev.push('BBS ' + l.evidence.bbs.join(', '))
      if (l.evidence.returns.length) ev.push('returns ' + l.evidence.returns.join(', '))
      if (l.evidence.count) ev.push(l.evidence.count)
      t.push('   Evidence: ' + ev.join('; '))
      if (l.confidence !== 'High') t.push('   Note: ' + l.reasons.join('; '))
    })
    const unalloc = d.unallocated[c.id] || 0
    if (unalloc) t.push('Less: earlier recovery not linked to a line ' + inr(unalloc))
    const totalPaise = ls.reduce((a, l) => a + l._netPaise, 0) - unalloc
    t.push('')
    t.push('Total to deduct: ' + inr(totalPaise) + ' (' + LEVELS.map((k2) => k2 + ' ' + inr(ls.filter((l) => l.confidence === k2).reduce((a, l) => a + l._netPaise, 0))).join(' · ') + ')')
    t.push('Lines marked Check need the contractor\'s acknowledgement before deduction.')
    const q = (v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v))
    const csv = ['dn_ref,contractor,deduct_in,line,material,kind,period,qty,unit,rate,multiplier,gross,already_recovered,net,confidence,evidence']
    for (const l of ls) {
      csv.push([ref, c.name, d.deductIn, l.id, l.material, l.kind, l.span, l.qty, l.kind === 'scrap' ? 'MT' : l.unit, l.rate, l.multiplier,
        (l._grossPaise / 100).toFixed(2), (l._alreadyPaise / 100).toFixed(2), (l._netPaise / 100).toFixed(2), l.confidence,
        [].concat(l.evidence.slips, l.evidence.mb, l.evidence.bbs, l.evidence.returns).join(' ')].map(q).join(','))
    }
    debitNotes.push({ contractor: c.id, name: c.name, ref, deductIn: d.deductIn, total: rupees(totalPaise), text: t.join('\n'), csv: csv.join('\n') + '\n' })
  }

  const allUnalloc = Object.values(d.unallocated).reduce((a, x) => a + x, 0)
  const headline = {
    recoverable: rupees(sum(lines, '_grossPaise')),
    alreadyRecovered: rupees(sum(lines, '_alreadyPaise') + allUnalloc),
    net: rupees(sum(lines, '_netPaise') - allUnalloc),
    byConfidence: split(lines, '_netPaise'),
    recoverableByConfidence: split(lines, '_grossPaise'),
    deductIn: d.deductIn,
  }
  const clean = lines.map(({ _grossPaise, _alreadyPaise, _netPaise, ...l }) => l)
  return {
    project: d.project,
    periods: d.periods,
    asOf: d.periods.length ? d.periods[d.periods.length - 1].ra : '',
    headline,
    contractors,
    lines: clean,
    comparison,
    floors,
    debitNotes,
    checks: d.checks,
    counts: { issues: d.issues.length, returns: d.returns.length, stock: d.stock.length, measurements: d.measurements.length, boq: d.boq.length, bbs: d.bbs.length, raBills: d.raBills.length },
  }
}
