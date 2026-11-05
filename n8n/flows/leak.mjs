// Workflow 01: Material Leak Check (one site, one period).
//
// PO -> delivery challan -> gate/weighbridge receipt -> stores issue -> BOQ work done.
// Every step below becomes one n8n Code node. Each function must be self-contained
// (no references to anything outside its own body) because its source text is
// copied into the node as-is.

export const flow = {
  id: 'veraDemoLeakChk1',
  name: 'Vera demo 01: Material Leak Check',
  path: 'vera/leak-check',
  sample: 'leak-sample.json',
  note: [
    '## Vera demo 01: Material Leak Check',
    'POST the site registers (POs, challans, stores issues, BOQ work done).',
    '',
    '1. **Read registers**: clean the input, load wastage limits.',
    '2. **PO → challan → gate**: duplicate challans, short supply, rate above PO, deliveries with no PO, PO quantity exceeded.',
    '3. **Issue → BOQ**: material needed for the work done, + allowed wastage, vs what was used. Book stock vs the next 8 weeks.',
    '4. **1-page summary**: totals the page shows.',
    '',
    'Plain JavaScript, no AI. Money maths stays in code.',
  ].join('\n'),
  steps: [
    { name: 'Read registers', fn: readRegisters },
    { name: 'PO → challan → gate', fn: matchChallans },
    { name: 'Issue → BOQ', fn: issueVsBoq },
    { name: '1-page summary', fn: summary },
  ],
}

function readRegisters(input) {
  const b = input.body || input
  // Allowed wastage per material. RMC is "direct": what arrived at a wing counts as used.
  const materials = {
    cement: { name: 'Cement (OPC 53)', unit: 'bags', wastage: 0.02, counted: true },
    steel: { name: 'TMT steel', unit: 'MT', wastage: 0.03 },
    rmc: { name: 'Ready-mix concrete', unit: 'cum', wastage: 0.015, direct: true },
    aac: { name: 'AAC blocks', unit: 'nos', wastage: 0.03, counted: true },
  }
  const text = (v) => String(v == null ? '' : v).trim()
  const num = (v) => (v === '' || v == null ? NaN : Number(v))
  const mat = (v) => text(v).toLowerCase()
  const gaps = []
  const keep = (rows, register, fields) =>
    (Array.isArray(rows) ? rows : []).filter((r) => {
      const bad = fields.filter((f) => (f.n ? !Number.isFinite(num(r[f.k])) : !text(r[f.k])))
      const unknown = r.material !== undefined && !materials[mat(r.material)]
      if (bad.length || unknown) {
        gaps.push({
          kind: 'data', material: mat(r.material), supplier: text(r.supplier),
          ref: text(r.po || r.challan || r.slip || r.item), qty: 0, amount: 0,
          note: register + ': ' + (unknown ? 'unknown material' : 'missing ' + bad.map((f) => f.k).join(', ')),
        })
        return false
      }
      return true
    })

  const pos = keep(b.pos, 'PO', [{ k: 'po' }, { k: 'supplier' }, { k: 'qty', n: 1 }, { k: 'rate', n: 1 }]).map((p) => ({
    po: text(p.po).toUpperCase(), date: text(p.date), supplier: text(p.supplier),
    material: mat(p.material), qty: num(p.qty), unit: text(p.unit), rate: num(p.rate),
  }))
  const challans = keep(b.challans, 'Challan', [{ k: 'challan' }, { k: 'supplier' }, { k: 'qty', n: 1 }, { k: 'rate', n: 1 }]).map((c) => ({
    challan: text(c.challan).toUpperCase(), date: text(c.date), supplier: text(c.supplier),
    po: text(c.po).toUpperCase(), material: mat(c.material), qty: num(c.qty),
    received: Number.isFinite(num(c.received)) ? num(c.received) : num(c.qty),
    unit: text(c.unit), rate: num(c.rate), wing: text(c.wing),
  }))
  const issues = keep(b.issues, 'Stores issue', [{ k: 'slip' }, { k: 'qty', n: 1 }, { k: 'wing' }]).map((i) => ({
    slip: text(i.slip), date: text(i.date), material: mat(i.material), qty: num(i.qty),
    unit: text(i.unit), activity: text(i.activity), wing: text(i.wing), supervisor: text(i.supervisor),
  }))
  const boq = keep(b.boq, 'BOQ', [{ k: 'item' }, { k: 'wing' }, { k: 'done', n: 1 }]).map((r) => ({
    item: text(r.item), wing: text(r.wing), unit: text(r.unit), done: num(r.done),
    next8w: Number.isFinite(num(r.next8w)) ? num(r.next8w) : 0, norms: r.norms || {},
  }))
  const period = b.period || {}
  return { site: text(b.site), period, materials, pos, challans, issues, boq, gaps }
}

function matchChallans(d) {
  const tolerance = 0.005 // weighbridge / count tolerance before short supply is flagged
  const money = (x) => Math.round(x * 100) / 100
  const poByNo = {}
  for (const p of d.pos) poByNo[p.po] = p
  const rows = { duplicate: [], short: [], rate: [], nopo: [], overpo: [] }
  const seen = {}
  const poReceived = {}
  const received = {} // material -> qty received (genuine challans only)
  const receivedAtWing = {} // material|wing -> qty, for direct materials
  let bought = 0

  for (const c of d.challans) {
    const billed = c.qty * c.rate
    bought += billed
    const key = c.supplier.toLowerCase() + '|' + c.challan
    if (seen[key]) {
      rows.duplicate.push({
        kind: 'duplicate', material: c.material, supplier: c.supplier, ref: c.challan, date: c.date,
        qty: c.qty, amount: money(billed), note: 'Same challan already billed on ' + seen[key].date,
      })
      continue
    }
    seen[key] = c
    received[c.material] = (received[c.material] || 0) + c.received
    if (c.wing) {
      const wk = c.material + '|' + c.wing
      receivedAtWing[wk] = (receivedAtWing[wk] || 0) + c.received
    }

    const po = poByNo[c.po]
    if (!po || po.material !== c.material || po.supplier.toLowerCase() !== c.supplier.toLowerCase()) {
      rows.nopo.push({
        kind: 'nopo', material: c.material, supplier: c.supplier, ref: c.challan, date: c.date,
        qty: c.received, amount: money(c.received * c.rate),
        note: c.po ? 'PO ' + c.po + ' does not match this supplier/material' : 'No PO quoted',
      })
    } else {
      poReceived[po.po] = (poReceived[po.po] || 0) + c.received
      if (c.rate > po.rate) {
        rows.rate.push({
          kind: 'rate', material: c.material, supplier: c.supplier, ref: c.challan, date: c.date,
          qty: c.qty, amount: money((c.rate - po.rate) * c.qty),
          note: 'Billed ₹' + c.rate + ' vs PO ' + po.po + ' ₹' + po.rate,
        })
      }
    }
    const shortQty = c.qty - c.received
    if (shortQty > c.qty * tolerance) {
      rows.short.push({
        kind: 'short', material: c.material, supplier: c.supplier, ref: c.challan, date: c.date,
        qty: Math.round(shortQty * 1000) / 1000, amount: money(shortQty * c.rate),
        note: 'Billed ' + c.qty + ', gate received ' + c.received,
      })
    }
  }
  for (const p of d.pos) {
    const got = poReceived[p.po] || 0
    if (got > p.qty) {
      rows.overpo.push({
        kind: 'overpo', material: p.material, supplier: p.supplier, ref: p.po, date: p.date,
        qty: Math.round((got - p.qty) * 1000) / 1000, amount: money((got - p.qty) * p.rate),
        note: 'Received ' + got + ' against PO quantity ' + p.qty,
      })
    }
  }
  return { ...d, bought: money(bought), rows, received, receivedAtWing }
}

function issueVsBoq(d) {
  const money = (x) => Math.round(x * 100) / 100
  const qtyRound = (m, x) => (d.materials[m].counted ? Math.floor(x + 1e-9) : Math.round(x * 1000) / 1000)
  // Valuation rate = weighted average PO rate for the material.
  const rate = {}
  for (const m of Object.keys(d.materials)) {
    const ps = d.pos.filter((p) => p.material === m)
    const q = ps.reduce((s, p) => s + p.qty, 0)
    rate[m] = q ? ps.reduce((s, p) => s + p.qty * p.rate, 0) / q : 0
  }
  const wings = [...new Set(d.boq.map((r) => r.wing).concat(d.issues.map((i) => i.wing)))].sort()
  const supervisorOf = (wing) => {
    const count = {}
    for (const i of d.issues) if (i.wing === wing && i.supervisor) count[i.supervisor] = (count[i.supervisor] || 0) + 1
    return Object.keys(count).sort((a, b) => count[b] - count[a])[0] || ''
  }

  const overuse = []
  const usedBy = {} // material -> issued (for book stock)
  for (const m of Object.keys(d.materials)) {
    const spec = d.materials[m]
    usedBy[m] = d.issues.filter((i) => i.material === m).reduce((s, i) => s + i.qty, 0)
    for (const w of wings) {
      const items = d.boq.filter((r) => r.wing === w && r.norms[m])
      const needed = items.reduce((s, r) => s + r.done * r.norms[m], 0)
      const used = spec.direct
        ? d.receivedAtWing[m + '|' + w] || 0
        : d.issues.filter((i) => i.material === m && i.wing === w).reduce((s, i) => s + i.qty, 0)
      if (!needed && !used) continue
      const allowed = needed * (1 + spec.wastage)
      const excess = qtyRound(m, used - allowed)
      if (excess > 0) {
        overuse.push({
          material: m, wing: w, supervisor: supervisorOf(w),
          boq: Math.round(needed * 1000) / 1000, allowed: Math.round(allowed * 1000) / 1000,
          used: Math.round(used * 1000) / 1000, excess, amount: money(excess * rate[m]),
        })
      }
    }
  }

  // Book stock = received - issued, compared with what the next 8 weeks of BOQ work needs.
  const extraStock = []
  const shortStock = []
  for (const m of Object.keys(d.materials)) {
    const spec = d.materials[m]
    if (spec.direct) continue
    const book = (d.received[m] || 0) - usedBy[m]
    const need = d.boq.reduce((s, r) => s + r.next8w * (r.norms[m] || 0), 0) * (1 + spec.wastage)
    const diff = qtyRound(m, Math.abs(book - need))
    if (book > need && diff > 0) extraStock.push({ material: m, name: spec.name, unit: spec.unit, qty: diff, value: money(diff * rate[m]) })
    if (book < need && diff > 0) shortStock.push({ material: m, name: spec.name, unit: spec.unit, qty: diff, book: qtyRound(m, book) })
  }
  return { ...d, rate, overuse, extraStock, shortStock }
}

function summary(d) {
  const sum = (rows) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100
  const labels = { duplicate: 'Duplicate challans', short: 'Short supply at the gate', rate: 'Billed above PO rate' }
  const supplier = Object.keys(labels)
    .map((kind) => ({
      kind, label: labels[kind], count: d.rows[kind].length, amount: sum(d.rows[kind]),
      suppliers: [...new Set(d.rows[kind].map((r) => r.supplier))], rows: d.rows[kind],
    }))
    .filter((g) => g.count)
  const recoverable = sum(supplier)
  const stoppable = sum(d.overuse)
  const total = Math.round((recoverable + stoppable) * 100) / 100

  const bySup = {}
  for (const o of d.overuse) {
    const k = o.supervisor + '|' + o.wing
    if (!bySup[k]) bySup[k] = { supervisor: o.supervisor, wing: o.wing, amount: 0, materials: [] }
    bySup[k].amount = Math.round((bySup[k].amount + o.amount) * 100) / 100
    bySup[k].materials.push(o.material)
  }
  const months = Number(d.period.months) || 3
  const fixed = 50000
  return {
    site: d.site,
    period: { label: d.period.label || '' },
    total, recoverable, stoppable, bought: d.bought,
    pct: d.bought ? Math.round((total / d.bought) * 1000) / 10 : 0,
    annualised: Math.round((total * 12) / months),
    supplier,
    overuse: d.overuse.sort((a, b) => b.amount - a.amount),
    supervisors: Object.values(bySup).sort((a, b) => b.amount - a.amount),
    extraStock: d.extraStock,
    shortStock: d.shortStock,
    gaps: d.rows.nopo.concat(d.rows.overpo, d.gaps),
    // Success fee: 10% of client-confirmed recoverable findings. Low = half confirmed, high = all.
    fee: { fixed, low: Math.round(recoverable * 0.5 * 0.1), high: Math.round(recoverable * 0.1) },
  }
}
