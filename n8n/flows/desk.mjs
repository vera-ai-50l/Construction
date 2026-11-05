// Workflow 02: Site Record Desk.
//
// Reads one day of WhatsApp messages from all sites (voice-note transcripts in Hindi,
// Marathi or Hinglish, texts, photos, challan photos) and turns them into the daily
// record, money at risk, an 8 AM brief and a Tally CSV.
// Reading is keyword/alias matching: a message that matches nothing is "noted", never guessed.
// Each step function is pasted into its own n8n Code node, so it must be self-contained.

export const flow = {
  id: 'veraDemoSiteDsk1',
  name: 'Vera demo 02: Site Record Desk',
  path: 'vera/site-desk',
  sample: 'desk-sample.json',
  note: [
    "## Vera demo 02: Site Record Desk",
    "POST one day of site WhatsApp messages.",
    '',
    '1. **Site master**: sites, contractors, aliases, rates, open RA bills.',
    '2. **Read messages**: labour, progress, material, stock, hindrances. Unclear messages are only "noted".',
    '3. **Daily site reports**: one record per site.',
    '4. **Money at risk**: idle labour, client delays, unpaid RA bills, no-PO deliveries, short stock, silent sites.',
    '5. **8 AM brief + Tally**: WhatsApp text and a Tally import CSV.',
    '',
    'Plain JavaScript, no AI.',
  ].join('\n'),
  steps: [
    { name: 'Site master', fn: siteMaster },
    { name: 'Read messages', fn: readMessages },
    { name: 'Daily site reports', fn: dailyReports },
    { name: 'Money at risk', fn: moneyAtRisk },
    { name: '8 AM brief + Tally', fn: briefAndTally },
  ],
}

function siteMaster(input) {
  const b = input.body || input
  const master = {
    dayRate: 750, // ₹ per worker per 8-hour day
    sites: [
      {
        id: 'kharadi', short: 'Kharadi', name: 'Kharadi Heights', place: 'Kharadi, Pune', supervisor: 'Sunil Jadhav', plannedLabour: 55,
        contractors: [
          { id: 'ramesh', name: 'Ramesh (masons)', aliases: ['ramesh', 'रमेश'] },
          { id: 'sai', name: 'Sai (steel)', aliases: ['sai', 'साई'] },
        ],
        activities: [
          { id: 'shutter', label: 'Slab L3 shuttering', aliases: ['shuttering', 'शटरिंग', 'centering'] },
          { id: 'binding', label: 'Slab L3 steel binding', aliases: ['binding', 'bandhai', 'बंधाई', 'बांधणी'] },
          { id: 'pour', label: 'Slab L3 pour', aliases: ['casting', 'dhalai', 'ढलाई'] },
        ],
      },
      {
        id: 'hinjewadi', short: 'Hinjewadi', name: 'Hinjewadi Logistics Shed', place: 'Hinjewadi Phase 2, Pune', supervisor: 'Vikas More', plannedLabour: 16,
        contractors: [{ id: 'patil', name: 'Patil (PEB erection)', aliases: ['patil', 'पाटील', 'पाटिल'] }],
        activities: [{ id: 'frames', label: 'PEB main frames', unit: 'frames', aliases: ['frame', 'फ्रेम', 'rafter'] }],
      },
      {
        id: 'nashik', short: 'Nashik', name: 'Nashik Warehouse', place: 'Ambad MIDC, Nashik', supervisor: 'Rahul Deshmukh', plannedLabour: 30,
        contractors: [{ id: 'ganesh', name: 'Ganesh (flooring)', aliases: ['ganesh', 'गणेश'] }],
        activities: [{ id: 'pcc', label: 'PCC flooring', unit: 'sqft', aliases: ['pcc', 'flooring', 'फ्लोरिंग', 'tremix'] }],
      },
      {
        id: 'baner', short: 'Baner', name: 'Baner Office Fit-out', place: 'Baner, Pune', supervisor: 'Kiran Pawar', plannedLabour: 20,
        contractors: [{ id: 'nikhil', name: 'Nikhil (interiors)', aliases: ['nikhil', 'निखिल'] }],
        activities: [{ id: 'gypsum', label: 'Gypsum ceiling', aliases: ['gypsum', 'ceiling'] }],
      },
    ],
    materials: [
      { id: 'cement', name: 'Cement', unit: 'bags', rate: 380, aliases: ['cement', 'सीमेंट', 'सिमेंट', 'opc'], units: ['bags', 'bag', 'bori', 'गोणी', 'पोती'] },
      { id: 'steel', name: 'TMT steel', unit: 'MT', rate: 62000, aliases: ['tmt', 'sariya', 'सरिया', 'स्टील'], units: ['mt', 'ton', 'tonne', 'टन'] },
      { id: 'sand', name: 'Crush sand', unit: 'brass', rate: 7800, aliases: ['sand', 'reti', 'रेती', 'रेत'], units: ['brass', 'ब्रास'] },
      { id: 'aggregate', name: '20 mm aggregate', unit: 'brass', rate: 4200, aliases: ['aggregate', 'khadi', 'खडी', 'gitti'], units: [] },
    ],
    causes: [
      { id: 'crane', label: 'Crane breakdown', party: 'own', aliases: ['crane', 'क्रेन'] },
      { id: 'power', label: 'Power cut', party: 'own', aliases: ['power cut', 'light nahi', 'बिजली', 'लाईट'] },
      { id: 'rain', label: 'Rain', party: 'weather', aliases: ['rain', 'baarish', 'बारिश', 'paus', 'पाऊस'] },
      { id: 'drawing', label: 'Client drawing / decision pending', party: 'client', aliases: ['drawing', 'ड्रॉइंग', 'नकाशा'] },
    ],
    // Challan number prefix -> supplier
    suppliers: [
      { prefix: 'DCA', name: 'Deccan Cement Agencies' },
      { prefix: 'SST', name: 'Shubham Steel Traders' },
      { prefix: 'SSS', name: 'Shree Samarth Sand Supply' },
    ],
    // Open POs per site: a delivery is "no PO" if its supplier has no open PO for that material there.
    pos: [
      { site: 'kharadi', po: 'PO/KH/118', supplier: 'Deccan Cement Agencies', material: 'cement' },
      { site: 'kharadi', po: 'PO/KH/121', supplier: 'Shubham Steel Traders', material: 'steel' },
      { site: 'hinjewadi', po: 'PO/HJ/044', supplier: 'Deccan Cement Agencies', material: 'cement' },
    ],
    raBills: [
      { site: 'kharadi', ra: 'RA-07', client: 'Sunrise Developers', amount: 4405000, status: 'unpaid', since: '2026-09-25' },
      { site: 'hinjewadi', ra: 'RA-04', client: 'Velocity Logistics Parks', amount: 1860000, status: 'returned', reason: 'joint measurement sheet not signed' },
    ],
    openItems: [{ site: 'kharadi', text: 'Lift-well shuttering check by structural consultant', since: '2026-11-02' }],
  }
  const messages = (Array.isArray(b.messages) ? b.messages : []).map((m) => ({
    id: String(m.id), site: String(m.site || '').toLowerCase(), time: String(m.time || ''),
    kind: String(m.kind || 'text'), text: String(m.text || ''), en: m.en ? String(m.en) : '', dur: m.dur || '',
  }))
  return { date: String(b.date || ''), messages, master }
}

function readMessages(d) {
  const M = d.master
  const devanagari = '०१२३४५६७८९'
  const norm = (s) =>
    s.toLowerCase()
      .replace(/[०-९]/g, (c) => String(devanagari.indexOf(c)))
      .replace(/(\d),(\d)/g, '$1$2')
  const has = (text, aliases) => aliases.some((a) => text.includes(a))
  const firstMatch = (text, list) => list.find((x) => has(text, x.aliases))
  const LABOUR = '(?:log|लोग|labour|लेबर|mazdoor|मजदूर|kamgar|कामगार|jan|जण|people|fitter|फिटर|mistri|मिस्त्री|helper)'
  const IDLE = ['khali', 'खाली', 'baithe', 'बैठे', 'बसून', 'basun', 'idle']
  const STOCK = ['bacha', 'बचा', 'shillak', 'शिल्लक', 'left', 'stock']
  const NEED = ['chahiye', 'चाहिए', 'pahije', 'पाहिजे', 'lagega', 'need']
  const RECEIVED = ['aaya', 'आया', 'aala', 'आला', 'received', 'delivered', 'pohoch']
  const START = ['start', 'chalu', 'चालू', 'shuru', 'शुरू', 'सुरू']
  const PAYMENT = ['payment', 'पेमेंट', 'ra-', 'ra bill', 'hafta', 'हफ्ता']
  const allUnits = M.materials.flatMap((m) => m.units)

  const facts = {}
  const tags = {}
  for (const m of d.messages) {
    const site = M.sites.find((s) => s.id === m.site)
    const t = norm(m.text)
    const f = { labour: [], progress: [], received: [], stock: [], hindrances: [], payment: false }
    if (site && t.trim()) {
      const clauses = t.split(/\n|[;!?।]|(?<!\d)\.|\.(?!\d)|,\s|\s(?:aur|और|ani|आणि|and)\s/).map((c) => c.trim()).filter(Boolean)
      for (const c of clauses) {
        // Labour: "<contractor> ... 34 log". Idle counts are read with hindrances, not as attendance.
        const lab = c.match(new RegExp('(\\d+)\\s*' + LABOUR))
        const who = site.contractors.find((k) => has(c, k.aliases))
        if (lab && who && !has(c, IDLE)) f.labour.push({ contractor: who.id, name: who.name, count: Number(lab[1]) })
        // Material: a number followed by a unit, with a material word (or a unit only one material uses).
        const unitRe = new RegExp('(\\d+(?:\\.\\d+)?)\\s*(' + allUnits.join('|') + ')(?![a-z])')
        const q = c.match(unitRe)
        if (q) {
          const mat = M.materials.find((x) => has(c, x.aliases)) || M.materials.find((x) => x.units.includes(q[2]))
          if (mat) {
            const row = { material: mat.id, name: mat.name, qty: Number(q[1]), unit: mat.unit }
            if (has(c, NEED)) f.stock.push({ ...row, qty: null, need: row.qty })
            else if (has(c, STOCK)) f.stock.push(row)
            else if (m.kind === 'challan' || has(c, RECEIVED)) f.received.push(row)
          }
        }
      }
      // Stock and need for the same material in one message become one line.
      const stock = {}
      for (const s of f.stock) {
        stock[s.material] = stock[s.material] || { material: s.material, name: s.name, unit: s.unit, qty: null, need: null }
        if (s.qty != null) stock[s.material].qty = s.qty
        if (s.need != null) stock[s.material].need = s.need
      }
      f.stock = Object.values(stock)

      // Challan: supplier from the challan-number prefix, then check for an open PO.
      if (m.kind === 'challan') {
        for (const s of M.suppliers) {
          const ch = t.match(new RegExp('\\b' + s.prefix.toLowerCase() + '\\s*[/-]\\s*(\\d+)'))
          if (!ch) continue
          for (const r of f.received) {
            r.challan = s.prefix + '/' + ch[1]
            r.supplier = s.name
            const po = M.pos.find((p) => p.site === site.id && p.supplier === s.name && p.material === r.material)
            r.po = po ? po.po : ''
          }
        }
      }

      // Progress: an activity word plus a %, an "18/24" count, or a "started" word.
      const act = firstMatch(t, site.activities)
      if (act) {
        const pct = t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|टक्के)/)
        const frac = t.match(/(\d+)\s*\/\s*(\d+)/)
        const today = act.unit ? t.match(new RegExp('(\\d+)\\s*(?:' + act.aliases.join('|') + '|' + act.unit + ')')) : null
        const p = { activity: act.id, label: act.label, pct: null, today: null, status: '' }
        if (pct) p.pct = Number(pct[1])
        else if (frac && Number(frac[2]) > 0) p.pct = Math.round((Number(frac[1]) / Number(frac[2])) * 100)
        if (today) p.today = Number(today[1]) + ' ' + act.unit
        if (p.pct == null && has(t, START)) p.status = 'started'
        if (p.pct != null || p.status) f.progress.push(p)
      }

      // Hindrance: a cause word; hours and idle people anywhere in the same message.
      const cause = firstMatch(t, M.causes)
      if (cause) {
        const hrs = t.match(/(\d+(?:\.\d+)?)\s*(?:ghante|ghanta|घंटे|घंटा|tas|तास|hours|hrs|hr)/)
        const idle = clauses.filter((c) => has(c, IDLE)).map((c) => c.match(new RegExp('(\\d+)\\s*' + LABOUR))).find(Boolean)
        f.hindrances.push({
          cause: cause.id, label: cause.label, party: cause.party, claimable: cause.party === 'client',
          hours: hrs ? Number(hrs[1]) : null, idle: idle ? Number(idle[1]) : null, photo: m.kind === 'photo',
        })
      }
      f.payment = has(t, PAYMENT)
    }

    const tg = []
    for (const l of f.labour) tg.push('Labour: ' + l.name.split(' ')[0] + ' ' + l.count)
    for (const p of f.progress) tg.push('Progress: ' + p.label + (p.pct != null ? ' ' + p.pct + '%' : ' ' + p.status))
    for (const r of f.received) tg.push('Received: ' + r.name + ' ' + r.qty + ' ' + r.unit + (r.challan ? ' (' + r.challan + ')' : ''))
    for (const s of f.stock) tg.push('Stock: ' + s.name + (s.qty != null ? ' ' + s.qty + ' ' + s.unit + ' left' : '') + (s.need != null ? ', ' + s.need + ' needed' : ''))
    for (const h of f.hindrances) tg.push((h.photo ? 'Photo: ' : 'Hindrance: ') + h.label + (h.hours ? ' ' + h.hours + ' h' : '') + (h.idle ? ', ' + h.idle + ' idle' : ''))
    if (f.payment) tg.push('RA bill / payment')
    if (!tg.length) tg.push(m.kind === 'photo' ? 'Noted: photo saved, no caption' : 'Noted: not clear, kept for the supervisor')
    tags[m.id] = tg
    f.understood = !tg[0].startsWith('Noted')
    facts[m.id] = f
  }
  return { ...d, facts, tags }
}

function dailyReports(d) {
  const sites = d.master.sites.map((s) => {
    const msgs = d.messages.filter((m) => m.site === s.id).sort((a, b) => a.time.localeCompare(b.time))
    const fs = msgs.map((m) => ({ id: m.id, ...d.facts[m.id] }))
    // Latest count per contractor wins (a later message corrects an earlier one).
    const lab = {}
    for (const f of fs) for (const l of f.labour) lab[l.contractor] = l
    const labour = s.contractors.filter((k) => lab[k.id]).map((k) => lab[k.id])
    const prog = {}
    for (const f of fs) for (const p of f.progress) prog[p.activity] = { ...(prog[p.activity] || {}), ...Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== '')) }
    const stock = {}
    for (const f of fs) for (const x of f.stock) stock[x.material] = { ...(stock[x.material] || {}), ...Object.fromEntries(Object.entries(x).filter(([, v]) => v != null)) }
    const hind = {}
    for (const f of fs) {
      for (const h of f.hindrances) {
        const k = h.cause
        const cur = hind[k] || { cause: h.cause, label: h.label, party: h.party, claimable: h.claimable, hours: null, idle: null, messages: [], photos: [] }
        if (h.hours != null) cur.hours = Math.max(cur.hours || 0, h.hours)
        if (h.idle != null) cur.idle = Math.max(cur.idle || 0, h.idle)
        cur.messages.push(f.id)
        if (h.photo) cur.photos.push(f.id)
        hind[k] = cur
      }
    }
    return {
      id: s.id, name: s.name, place: s.place, supervisor: s.supervisor,
      reported: msgs.length > 0, messages: msgs.length,
      first: msgs.length ? msgs[0].time : '', last: msgs.length ? msgs[msgs.length - 1].time : '',
      labour, labourTotal: labour.reduce((a, l) => a + l.count, 0),
      progress: Object.values(prog), received: fs.flatMap((f) => f.received.map((r) => ({ ...r, message: f.id }))),
      stock: Object.values(stock), hindrances: Object.values(hind),
    }
  })
  return { ...d, sites }
}

function moneyAtRisk(d) {
  const M = d.master
  const rate = M.dayRate
  const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
  const days = (from, to) => Math.round((new Date(to) - new Date(from)) / 86400000)
  const risks = []
  for (const s of d.sites) {
    const short = M.sites.find((x) => x.id === s.id).short
    if (!s.reported) {
      const planned = M.sites.find((x) => x.id === s.id).plannedLabour
      risks.push({ site: s.id, short, kind: 'silent', title: 'No report from ' + s.name, amount: planned * rate,
        action: 'Call ' + s.supervisor + ' before 9 AM. ' + planned + ' people planned: labour bill has no record.' })
    }
    for (const h of s.hindrances) {
      if (!h.idle || !h.hours) continue
      const amount = h.idle * (h.hours / 8) * rate
      if (h.claimable) {
        risks.push({ site: s.id, short, kind: 'claim', title: h.label + ': ' + h.idle + ' people idle ' + h.hours + ' h (claimable)', amount,
          action: 'Send the client a dated hindrance letter today with messages ' + h.messages.join(', ') + '.' })
      } else {
        risks.push({ site: s.id, short, kind: 'idle', title: h.label + ': ' + h.idle + ' people idle ' + h.hours + ' h', amount,
          action: 'Fix the cause today' + (h.photos.length ? ' (photo ' + h.photos.join(', ') + ')' : '') + '. Agree idle-time terms with the contractor.' })
      }
    }
    for (const r of s.received) {
      if (r.challan && !r.po) {
        const mat = M.materials.find((m) => m.id === r.material)
        risks.push({ site: s.id, short, kind: 'nopo', title: r.name + ' ' + r.qty + ' ' + r.unit + ' delivered with no PO (' + r.challan + ')', amount: r.qty * mat.rate,
          action: 'Hold the bill from ' + r.supplier + ' until a PO is raised and rates are agreed.' })
      }
    }
    for (const x of s.stock) {
      if (x.need != null && x.qty != null && x.need > x.qty) {
        risks.push({ site: s.id, short, kind: 'stock', title: x.name + ': ' + x.qty + ' ' + x.unit + ' left, ' + x.need + ' needed tomorrow', amount: s.labourTotal * rate,
          action: 'Order ' + (x.need - x.qty) + ' ' + x.unit + ' today or ' + s.labourTotal + ' people wait tomorrow.' })
      }
    }
  }
  for (const r of M.raBills) {
    const short = M.sites.find((x) => x.id === r.site).short
    if (r.status === 'unpaid') {
      risks.push({ site: r.site, short, kind: 'ra', title: r.ra + ' unpaid for ' + days(r.since, d.date) + ' days (' + r.client + ')', amount: r.amount,
        action: 'Call ' + r.client + ' accounts. ' + fmt(r.amount) + ' is due.' })
    } else if (r.status === 'returned') {
      risks.push({ site: r.site, short, kind: 'ra', title: r.ra + ' returned: ' + r.reason, amount: r.amount,
        action: 'Get the sheet signed and resubmit ' + r.ra + ' this week.' })
    }
  }
  risks.sort((a, b) => b.amount - a.amount)
  const riskTotal = Math.round(risks.reduce((a, r) => a + r.amount, 0) * 100) / 100
  return { ...d, risks, riskTotal }
}

function briefAndTally(d) {
  const M = d.master
  const lakh = (n) => '₹' + (n / 100000).toFixed(1) + ' L'
  const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
  const money = (n) => (n >= 100000 ? lakh(n) : inr(n))
  const next = new Date(d.date + 'T00:00:00Z')
  next.setUTCDate(next.getUTCDate() + 1)
  const briefDate = next.toISOString().slice(0, 10)
  const nice = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  const total = d.messages.length
  const understood = d.messages.filter((m) => d.facts[m.id].understood).length
  const reported = d.sites.filter((s) => s.reported).length
  const labour = d.sites.reduce((a, s) => a + s.labourTotal, 0)

  const lines = []
  lines.push('*Vera · 8 AM site brief*')
  lines.push(nice(briefDate) + ' (for ' + nice(d.date) + ')')
  lines.push('')
  lines.push('*' + reported + ' of ' + d.sites.length + ' sites reported* · ' + labour + ' people · ' + understood + '/' + total + ' messages read')
  for (const s of d.sites.filter((x) => !x.reported)) lines.push('⚠️ *' + s.name + ': no report*')
  lines.push('')
  lines.push('*Money at risk: ' + lakh(d.riskTotal) + '*')
  d.risks.forEach((r, i) => lines.push(i + 1 + '. ' + r.short + ': ' + r.title + ', ' + money(r.amount) + '. ' + r.action))
  lines.push('')
  lines.push('*Sites*')
  for (const s of d.sites.filter((x) => x.reported)) {
    const bits = []
    bits.push(s.labourTotal + ' people (' + s.labour.map((l) => l.name.split(' ')[0] + ' ' + l.count).join(', ') + ')')
    for (const p of s.progress) bits.push(p.label + (p.pct != null ? ' ' + p.pct + '%' : ' ' + p.status) + (p.today ? ', ' + p.today + ' today' : ''))
    for (const r of s.received) bits.push('Received ' + r.name.toLowerCase() + ' ' + r.qty + ' ' + r.unit)
    for (const h of s.hindrances) bits.push(h.label + (h.hours ? ' ' + h.hours + ' h' : ''))
    lines.push('• *' + s.name + '*: ' + bits.join('. ') + '.')
  }
  const open = M.openItems.filter((o) => o.since < d.date)
  if (open.length) {
    lines.push('')
    lines.push('*Still open*')
    for (const o of open) lines.push('• ' + M.sites.find((s) => s.id === o.site).short + ': ' + o.text + ' (since ' + nice(o.since) + ')')
  }

  // Tally: one Receipt Note line per delivery.
  const csv = ['Date,Voucher Type,Voucher No,Party,Godown,Stock Item,Qty,Unit,Rate,Amount,Narration']
  let n = 1
  const q = (v) => (/[",]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v))
  for (const s of d.sites) {
    for (const r of s.received) {
      const mat = M.materials.find((m) => m.id === r.material)
      csv.push([d.date, 'Receipt Note', 'VR/' + d.date.replace(/-/g, '') + '/' + n++, r.supplier || '', s.name, mat.name, r.qty, r.unit, mat.rate, r.qty * mat.rate,
        'Challan ' + (r.challan || '-') + (r.po ? ' against ' + r.po : ' NO PO') + ', WhatsApp msg ' + r.message].map(q).join(','))
    }
  }
  return {
    date: d.date, briefDate,
    stats: { messages: total, understood, sites: d.sites.length, reported, labour },
    sites: d.sites, tags: d.tags, risks: d.risks, riskTotal: d.riskTotal,
    brief: lines.join('\n'), tally: csv.join('\n') + '\n',
  }
}
