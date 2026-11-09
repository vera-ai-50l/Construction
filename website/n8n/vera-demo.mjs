// Vera demo workflows for the n8n on the GCP VM.
//   node n8n/vera-demo.mjs check    runs every Code node locally against the sample data
//   node n8n/vera-demo.mjs deploy   imports both workflows over IAP SSH, publishes them, restarts n8n
// Each Code node below is a plain function; its body is what n8n runs.
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* ───────────────────────── 01 · Material Leak Check ───────────────────────── */

function readRegisters() {
  const b = $input.first().json.body ?? {};
  // Allowed wastage over the BOQ quantity (CPWD-style). RMC goes truck → pour, so it has no stores issue slips.
  const norms = {
    cement: { name: "OPC 53 cement", unit: "bags", waste: 0.02 },
    steel: { name: "Fe500D steel", unit: "MT", waste: 0.03 },
    rmc: { name: "RMC M25", unit: "cum", waste: 0.015, direct: true },
    aac: { name: "AAC blocks", unit: "nos", waste: 0.03 },
  };
  const missing = ["pos", "challans", "issues", "boq"].filter((k) => !Array.isArray(b[k]) || !b[k].length);
  if (missing.length) throw new Error("Missing registers: " + missing.join(", "));
  const clean = (rows, keys) =>
    rows.slice(0, 5000).map((r) => {
      const o = { ...r };
      for (const k of keys) o[k] = Number.isFinite(+r[k]) ? +r[k] : 0;
      return o;
    });
  const pos = clean(b.pos, ["qty", "rate"]);
  const challans = clean(b.challans, ["qty", "received", "rate"]).filter((c) => norms[c.material]);
  const issues = clean(b.issues, ["qty"]).filter((r) => norms[r.material]);
  const boq = clean(b.boq, ["done", "next8w"]);
  return [
    {
      json: {
        site: String(b.site ?? "Site"),
        period: b.period ?? {},
        norms,
        pos,
        challans,
        issues,
        boq,
        counts: { pos: pos.length, challans: challans.length, issues: issues.length, boq: boq.length },
      },
    },
  ];
}

function matchChallans() {
  const d = $input.first().json;
  const po = Object.fromEntries(d.pos.map((p) => [p.po, p]));
  const add = (o, k, v) => (o[k] = (o[k] ?? 0) + v);
  const seen = new Set();
  const findings = []; // money already lost to a supplier
  const gaps = []; // needs a decision, not counted as a leak
  const received = {};
  const bought = {};
  const byWing = {};
  const poGot = {};
  for (const c of d.challans) {
    if (seen.has(c.supplier + "|" + c.challan)) {
      findings.push({ kind: "duplicate", material: c.material, supplier: c.supplier, ref: c.challan, date: c.date, qty: c.qty, amount: c.qty * c.rate, note: "already billed once" });
      continue;
    }
    seen.add(c.supplier + "|" + c.challan);
    add(received, c.material, c.received);
    add(bought, c.material, c.qty * c.rate);
    if (c.wing) add(byWing, c.material + "|" + c.wing, c.received);
    const p = po[c.po];
    if (!p) gaps.push({ kind: "no_po", material: c.material, supplier: c.supplier, ref: c.challan, date: c.date, qty: c.received, amount: c.received * c.rate });
    else {
      add(poGot, c.po, c.received);
      if (c.rate > p.rate)
        findings.push({ kind: "rate", material: c.material, supplier: c.supplier, ref: c.challan, date: c.date, qty: c.qty, amount: (c.rate - p.rate) * c.qty, note: `₹${c.rate} billed vs ₹${p.rate} on ${p.po}` });
    }
    const short = c.qty - c.received;
    // ponytail: flat 0.5% tolerance for every material; make it per-material if a client's weighbridge is noisier.
    if (short > c.qty * 0.005)
      findings.push({ kind: "short", material: c.material, supplier: c.supplier, ref: c.challan, date: c.date, qty: Math.round(short * 100) / 100, amount: short * c.rate, note: `challan ${c.qty}, received ${c.received}` });
  }
  for (const [no, got] of Object.entries(poGot))
    if (got > po[no].qty) gaps.push({ kind: "po_over", material: po[no].material, supplier: po[no].supplier, ref: no, qty: got - po[no].qty, amount: (got - po[no].qty) * po[no].rate });
  return [{ json: { ...d, received, bought, byWing, findings, gaps } }];
}

function matchBoq() {
  const d = $input.first().json;
  const add = (o, k, v) => (o[k] = (o[k] ?? 0) + v);
  const rate = {};
  for (const p of d.pos) rate[p.material] ??= p.rate;
  const need = {};
  const next = {};
  const used = {};
  const sup = {};
  for (const r of d.boq)
    for (const [m, k] of Object.entries(r.norms ?? {})) {
      add(need, m + "|" + r.wing, r.done * k);
      add(next, m, r.next8w * k);
    }
  for (const s of d.issues) {
    add(used, s.material + "|" + s.wing, s.qty);
    sup[s.wing] ??= s.supervisor;
  }
  // What arrived for a direct material is what went into the pour.
  for (const [k, q] of Object.entries(d.byWing)) if (d.norms[k.split("|")[0]]?.direct) used[k] = q;

  const overuse = Object.entries(need).map(([k, q]) => {
    const [m, wing] = k.split("|");
    const allowed = q * (1 + d.norms[m].waste);
    const excess = Math.max(0, (used[k] ?? 0) - allowed);
    return { material: m, wing, supervisor: sup[wing] ?? "Wing " + wing, boq: q, allowed, used: used[k] ?? 0, excess, amount: excess * (rate[m] ?? 0) };
  });
  const stock = Object.entries(d.norms)
    .filter(([, n]) => !n.direct)
    .map(([m, n]) => {
      const issued = Object.entries(used).filter(([k]) => k.startsWith(m + "|")).reduce((a, [, q]) => a + q, 0);
      const book = (d.received[m] ?? 0) - issued;
      const required = (next[m] ?? 0) * (1 + n.waste);
      return { material: m, received: d.received[m] ?? 0, issued, book, required, surplus: book - required, value: (book - required) * (rate[m] ?? 0) };
    });
  return [{ json: { ...d, rate, overuse, stock } }];
}

function leakSummary() {
  const d = $input.first().json;
  const r = (x) => Math.round(x);
  const r1 = (x) => Math.round(x * 10) / 10;
  const sum = (a) => a.reduce((t, x) => t + x.amount, 0);
  const LABEL = { short: "Paid for more than arrived", duplicate: "Same challan billed twice", rate: "Billed above the PO rate" };
  const supplier = Object.keys(LABEL)
    .map((kind) => {
      const rows = d.findings.filter((f) => f.kind === kind);
      return { kind, label: LABEL[kind], count: rows.length, amount: r(sum(rows)), suppliers: [...new Set(rows.map((f) => f.supplier))], rows: rows.map((f) => ({ ...f, amount: r(f.amount) })) };
    })
    .filter((g) => g.count)
    .sort((a, b) => b.amount - a.amount);
  const over = d.overuse
    .filter((o) => o.excess > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((o) => ({ ...o, boq: r1(o.boq), allowed: r1(o.allowed), used: r1(o.used), excess: r1(o.excess), amount: r(o.amount) }));
  const recoverable = supplier.reduce((t, g) => t + g.amount, 0);
  const stoppable = over.reduce((t, o) => t + o.amount, 0);
  const total = recoverable + stoppable;
  const bought = Object.values(d.bought).reduce((a, b) => a + b, 0);
  const days = (Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5 || 90;

  const people = {};
  for (const o of over) {
    people[o.supervisor] ??= { supervisor: o.supervisor, wing: o.wing, amount: 0, materials: [] };
    people[o.supervisor].amount += o.amount;
    people[o.supervisor].materials.push(o.material);
  }
  const materials = Object.entries(d.norms).map(([m, n]) => {
    const rows = d.overuse.filter((o) => o.material === m);
    const lost = sum(d.findings.filter((f) => f.material === m)) + sum(rows);
    return {
      material: m,
      name: n.name,
      unit: n.unit,
      received: r1(d.received[m] ?? 0),
      boq: r1(rows.reduce((t, o) => t + o.boq, 0)),
      allowed: r1(rows.reduce((t, o) => t + o.allowed, 0)),
      used: r1(rows.reduce((t, o) => t + o.used, 0)),
      excess: r1(rows.reduce((t, o) => t + o.excess, 0)),
      bought: r(d.bought[m] ?? 0),
      lost: r(lost),
    };
  });
  const name = (m) => d.norms[m].name;
  return [
    {
      json: {
        site: d.site,
        period: d.period,
        counts: d.counts,
        total,
        recoverable,
        stoppable,
        bought: r(bought),
        pct: bought ? total / bought : 0,
        annualised: r((total * 365) / days),
        supplier,
        overuse: over,
        supervisors: Object.values(people).sort((a, b) => b.amount - a.amount),
        materials,
        extraStock: d.stock.filter((s) => s.surplus > 0).map((s) => ({ material: s.material, name: name(s.material), unit: d.norms[s.material].unit, qty: r1(s.surplus), book: r1(s.book), required: r1(s.required), value: r(s.value) })),
        shortStock: d.stock.filter((s) => s.surplus < 0).map((s) => ({ material: s.material, name: name(s.material), unit: d.norms[s.material].unit, qty: r1(-s.surplus), book: r1(s.book), required: r1(s.required) })),
        gaps: d.gaps.map((g) => ({ ...g, qty: r1(g.qty), amount: r(g.amount) })),
        fee: { fixed: 50000, low: r(recoverable * 0.15), high: r(recoverable * 0.2) },
      },
    },
  ];
}

/* ───────────────────────── 02 · Site Record Desk ───────────────────────── */

function siteMaster() {
  const b = $input.first().json.body ?? {};
  const KINDS = ["voice", "text", "photo", "challan"];
  const messages = (Array.isArray(b.messages) ? b.messages : [])
    .slice(0, 300)
    .filter((m) => m && typeof m.text === "string")
    .map((m) => ({ id: String(m.id ?? ""), site: String(m.site ?? ""), time: /^\d\d:\d\d$/.test(m.time) ? m.time : "12:00", kind: KINDS.includes(m.kind) ? m.kind : "text", text: m.text.slice(0, 600) }));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10);

  // Mapped once during onboarding: who works where, what they call things, today's plan, open issues and bills.
  const master = {
    dayRate: 750, // blended ₹ per worker per 8-hour day
    sites: [
      {
        id: "kharadi", name: "Riverview Tower B", place: "Kharadi, Pune", supervisor: "Vikas Patil", overhead: 45000,
        contractors: [{ name: "Ramesh Constructions", aliases: ["ramesh", "रमेश"] }, { name: "Sai Steel Works", aliases: ["sai", "साई"] }],
        activities: [{ name: "Slab L7 casting", unit: "cum", plan: 52, aliases: ["slab", "स्लैब", "casting", "ढलाई"] }],
        use: { cement: 140 }, lead: { cement: 2 },
        bills: [{ ref: "RA-07", amount: 3840000, status: "unpaid", days: 52, terms: 30 }],
      },
      {
        id: "hinjewadi", name: "Logistics Park Shed 2", place: "Hinjewadi Ph-2, Pune", supervisor: "Sandeep Yadav", overhead: 32000,
        contractors: [{ name: "Patil Labour Contractors", aliases: ["patil", "पाटील", "पाटिल"] }],
        activities: [{ name: "PEB frame erection", unit: "frames", plan: 8, aliases: ["peb", "erection", "frame"] }],
        open: [{ key: "drawing", ref: "Drawing R3 (grid 7–9)", since: 4 }],
        bills: [{ ref: "RA-03", amount: 2160000, status: "returned", days: 9, reason: "cube test certificates" }],
      },
      {
        id: "nashik", name: "Ambad MIDC Plant", place: "Nashik", supervisor: "Rafiq Shaikh", overhead: 28000,
        contractors: [{ name: "Ganesh Enterprises", aliases: ["ganesh", "गणेश"] }],
        activities: [{ name: "Flooring PCC", unit: "cum", plan: 40, aliases: ["pcc", "flooring", "फ्लोरिंग"] }],
      },
      {
        id: "baner", name: "Baner Row Villas", place: "Baner, Pune", supervisor: "Amit Kale", overhead: 18000,
        contractors: [{ name: "Shinde Builders", aliases: ["shinde", "शिंदे"] }],
        activities: [{ name: "Villa 6 blockwork", unit: "sqm", plan: 60, aliases: ["blockwork", "brickwork", "चिनाई"] }],
      },
    ],
    materials: {
      cement: { name: "cement", unit: "bags", rate: 380, aliases: ["cement", "सीमेंट", "सिमेंट"] },
      steel: { name: "steel", unit: "MT", rate: 58500, aliases: ["steel", "स्टील", "सरिया", "tmt", "fe500"] },
      aac: { name: "AAC blocks", unit: "nos", rate: 62, aliases: ["aac", "block", "ब्लॉक"] },
      rmc: { name: "RMC", unit: "cum", rate: 5400, aliases: ["rmc", "concrete", "कंक्रीट"] },
    },
    units: {
      bags: ["bag", "bags", "बैग", "बोरी", "गोणी", "katta", "कट्टा"],
      MT: ["mt", "ton", "tonne", "tons", "टन", "t"],
      cum: ["cum", "m3", "cu", "घन"],
      nos: ["nos", "pcs", "pieces", "नग"],
      frames: ["frame", "फ्रेम"],
      sqm: ["sqm", "m2", "sq", "वर्ग"],
    },
    trades: {
      Mistri: ["mistri", "mistry", "mason", "मिस्त्र", "कारीगर", "गवंडी"],
      Helper: ["helper", "हेल्पर", "मजदूर", "majdoor"],
      "Bar bender": ["bar bender", "barbender", "बार बेंडर", "fitter"],
      Carpenter: ["carpenter", "बढ़ई", "सुतार"],
      Workers: ["labour", "labor", "worker", "कामगार", "kamgar", "लेबर"],
    },
    words: {
      got: ["aaya", "aaye", "aayi", "aya", "aye", "aai", "आया", "आए", "आये", "आई", "आले", "आली", "received", "recd", "unload", "delivered", "arrived", "came"],
      stock: ["bacha", "bache", "bachi", "बचा", "बचे", "बची", "stock", "शिल्लक", "left", "balance"],
      no: ["nahi", "nahin", "nai", "नहीं", "नही", "नाही", "not", "without", "bina", "बिना", "aayega", "aayegi", "आएगा", "आयेगा"],
      pending: ["baaki", "baki", "बाकी", "remaining", "pending"],
      idle: ["khali", "खाली", "idle", "baithe", "बैठे", "बसून", "ruke", "रुके"],
      people: ["log", "लोग", "people", "workers", "worker", "labour", "लोक", "जण", "aadmi", "आदमी"],
      hours: ["ghante", "ghanta", "घंटे", "घंटा", "hour", "hrs", "hr", "h", "तास"],
    },
    causes: [
      { key: "pump", label: "Concrete pump late", party: "Supplier", words: ["pump", "पंप"] },
      { key: "rain", label: "Rain stopped work", party: "Weather", words: ["rain", "barish", "baarish", "बारिश", "पाऊस", "paus"] },
      { key: "drawing", label: "Drawing pending from client", party: "Client", words: ["drawing", "ड्रॉइंग", "ड्राइंग", "revision"] },
      { key: "power", label: "Power cut", party: "Utility", words: ["power", "बिजली", "light nahi", "लाइट"] },
      { key: "material", label: "Material ran out", party: "Own", words: ["khatam", "खत्म", "shortage"] },
    ],
    suppliers: { OT: "Om Traders (UltraTech)", SBS: "Shree Balaji Steels", DAD: "Deccan AAC Depot", PRM: "Pune Ready Mix" },
  };
  return [{ json: { date, messages, master } }];
}

function readMessages() {
  const { date, messages, master: M } = $input.first().json;
  const W = M.words;
  const DEV = "०१२३४५६७८९";
  const clauses = (t) =>
    t
      .replace(/[०-९]/g, (c) => DEV.indexOf(c))
      .toLowerCase()
      .replace(/(\d)([a-z\u0900-\u097f])/g, "$1 $2")
      .split(/[,;!?।|\n]|\.(?!\d)/)
      .map((c) => c.split(/[\s()"'“”:]+/).filter(Boolean))
      .filter((c) => c.length);
  // Short aliases must match a whole word; longer ones also match inflections ("मिस्त्र" → "मिस्त्री", "मिस्त्रियों").
  const hit = (tok, a) => (a.length > 3 ? tok.startsWith(a) : tok === a);
  const isAt = (toks, i, a) => a.split(" ").every((x, j) => toks[i + j] && hit(toks[i + j], x));
  const at = (toks, aliases) => {
    for (let i = 0; i < toks.length; i++) for (const a of aliases) if (isAt(toks, i, a)) return i;
    return -1;
  };
  const has = (toks, aliases) => at(toks, aliases) >= 0;
  const num = (t) => (t && /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null);
  // "<n> <unit>" nearest to position i, skipping amounts still to do ("14 cum baaki").
  const qty = (toks, i, units) => {
    let best = null;
    for (let j = 0; j < toks.length - 1; j++) {
      const n = num(toks[j]);
      if (n === null || !units.some((u) => hit(toks[j + 1], u)) || has(toks.slice(j + 2, j + 3), W.pending)) continue;
      if (!best || Math.abs(j - i) < best.d) best = { n, d: Math.abs(j - i) };
    }
    return best ? best.n : null;
  };
  const before = (toks, aliases) => {
    for (let j = 1; j < toks.length; j++) if (aliases.some((a) => hit(toks[j], a)) && num(toks[j - 1]) !== null) return num(toks[j - 1]);
    return null;
  };

  const sites = Object.fromEntries(M.sites.map((s) => [s.id, s]));
  const parsed = [];
  for (const m of messages) {
    const s = sites[m.site];
    if (!s) continue;
    const p = { id: m.id, site: m.site, time: m.time, kind: m.kind, text: m.text, labour: [], progress: [], received: [], stock: [], hindrances: [] };
    const cl = clauses(m.text);
    const all = cl.flat();
    const challan = m.text.match(/(?:challan|चालान|चलान)\s*(?:no\.?|number|नं\.?|#)?\s*:?\s*([a-z]{1,5}[\/-]?\d{2,6})/i)?.[1]?.toUpperCase() ?? null;
    const weighed = m.text.match(/(?:weighbridge|kaanta|kanta|काँटा|कांटा)\D{0,12}(\d+(?:\.\d+)?)/i)?.[1];
    const noPo = cl.some((c) => has(c, ["po"]) && has(c, W.no));
    const msgContractor = s.contractors.find((k) => has(all, k.aliases));

    for (const c of cl) {
      // Attendance: "<n> <trade>" or "<trade> <n>". A clause about idle people is a hindrance, not attendance.
      if (!has(c, W.idle)) {
        const k = s.contractors.find((k) => has(c, k.aliases)) ?? msgContractor ?? s.contractors[0];
        const taken = new Set();
        for (let i = 0; i < c.length; i++) {
          const trade = Object.keys(M.trades).find((t) => M.trades[t].some((a) => isAt(c, i, a)));
          if (!trade) continue;
          const j = [i - 1, i + 1, i - 2, i + 2].find((j) => num(c[j]) !== null && !taken.has(j));
          if (j === undefined) continue;
          taken.add(j);
          p.labour.push({ contractor: k.name, trade, count: num(c[j]) });
        }
      }
      for (const a of s.activities) {
        const i = at(c, a.aliases);
        if (i < 0) continue;
        let done = qty(c, i, M.units[a.unit]);
        const pct = c.map((t) => t.match(/^(\d+(?:\.\d+)?)%$/)?.[1]).find(Boolean);
        if (done === null && pct) done = Math.round((a.plan * +pct) / 100);
        if (done !== null) p.progress.push({ activity: a.name, done, unit: a.unit });
      }
      for (const [key, mat] of Object.entries(M.materials)) {
        const i = at(c, mat.aliases);
        if (i < 0) continue;
        const q = qty(c, i, M.units[mat.unit]);
        if (q === null) continue;
        if (has(c, W.stock)) p.stock.push({ material: key, qty: q });
        else if (!has(c, W.no) && (has(c, W.got) || challan || m.kind === "challan"))
          p.received.push({ material: key, qty: q, challan, weighed: weighed ? +weighed : null, noPo });
      }
    }
    const hours = cl.map((c) => before(c, W.hours)).find((x) => x !== null) ?? null;
    const idle = has(all, W.idle) ? (cl.map((c) => before(c, W.people)).find((x) => x !== null) ?? null) : null;
    for (const cause of M.causes) if (has(all, cause.words)) p.hindrances.push({ key: cause.key, cause: cause.label, party: cause.party, hours, idle });
    const mat = (k) => `${M.materials[k].unit} ${M.materials[k].name}`;
    p.tags = [
      ...p.labour.map((l) => `${l.count} ${l.trade.toLowerCase()} · ${l.contractor.split(" ")[0]}`),
      ...p.progress.map((x) => `${x.activity}: ${x.done} ${x.unit}`),
      ...p.received.map((x) => `+${x.qty} ${mat(x.material)}${x.challan ? " · " + x.challan : ""}${x.noPo ? " · no PO" : ""}`),
      ...p.stock.map((x) => `stock: ${x.qty} ${mat(x.material)}`),
      ...p.hindrances.map((h) => `hindrance: ${h.cause.toLowerCase()}${h.hours ? `, ${h.hours} h` : ""}${h.idle ? `, ${h.idle} idle` : ""}`),
    ];
    p.note = !p.tags.length;
    parsed.push(p);
  }
  return [{ json: { date, master: M, parsed, count: messages.length } }];
}

function dailyReports() {
  const { date, master: M, parsed, count } = $input.first().json;
  const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const sites = M.sites.map((s) => {
    const msgs = parsed.filter((p) => p.site === s.id).sort((a, b) => mins(a.time) - mins(b.time));
    // Supervisors often repeat the morning headcount later in the day: keep the highest, don't add them up.
    const crew = {};
    for (const l of msgs.flatMap((p) => p.labour)) crew[l.contractor + "|" + l.trade] = Math.max(crew[l.contractor + "|" + l.trade] ?? 0, l.count);
    const labour = Object.entries(crew).map(([k, count]) => ({ contractor: k.split("|")[0], trade: k.split("|")[1], count }));
    const contractors = [...new Set(labour.map((l) => l.contractor))].map((name) => ({ name, count: labour.filter((l) => l.contractor === name).reduce((a, l) => a + l.count, 0) }));
    const progress = s.activities.map((a) => {
      const done = msgs.flatMap((p) => p.progress).filter((x) => x.activity === a.name).map((x) => x.done);
      return { activity: a.name, unit: a.unit, plan: a.plan, done: done.length ? Math.max(...done) : null, pct: done.length ? Math.max(...done) / a.plan : null };
    });
    const received = msgs.flatMap((p) => p.received.map((x) => ({ ...x, time: p.time, source: p.id, supplier: M.suppliers[(x.challan ?? "").split(/[\/-]/)[0]] ?? null })));
    const last = {};
    for (const p of msgs) for (const x of p.stock) last[x.material] = x.qty;
    const stock = Object.entries(last).map(([m, qty]) => ({ material: m, qty, perDay: s.use?.[m] ?? null, days: s.use?.[m] ? qty / s.use[m] : null, lead: s.lead?.[m] ?? null }));
    const photos = msgs.filter((p) => p.kind === "photo").map((p) => ({ id: p.id, time: p.time, caption: p.text }));
    const merged = {};
    for (const p of msgs)
      for (const h of p.hindrances) {
        const o = (merged[h.key] ??= { ...h, time: p.time, sources: [] });
        o.hours = Math.max(o.hours ?? 0, h.hours ?? 0) || null;
        o.idle = Math.max(o.idle ?? 0, h.idle ?? 0) || null;
        o.sources.push(p.id);
      }
    const hindrances = Object.values(merged).map((h) => ({
      ...h,
      // A photo that names the problem, or one sent within 10 minutes of the report, is its evidence.
      photos: photos.filter((ph) => h.sources.includes(ph.id) || (mins(ph.time) - mins(h.time) >= 0 && mins(ph.time) - mins(h.time) <= 10)).map((ph) => ph.id),
      open: (s.open ?? []).find((o) => o.key === h.key) ?? null,
    }));
    return {
      id: s.id, name: s.name, place: s.place, supervisor: s.supervisor,
      reported: msgs.length > 0, messages: msgs.length, first: msgs[0]?.time ?? null, last: msgs.at(-1)?.time ?? null,
      labour, contractors, labourTotal: labour.reduce((a, l) => a + l.count, 0),
      progress, received, stock, hindrances, photos,
      notes: msgs.filter((p) => p.note && p.kind !== "photo").map((p) => ({ id: p.id, time: p.time, text: p.text })),
    };
  });
  const tags = Object.fromEntries(parsed.map((p) => [p.id, p.tags]));
  return [{ json: { date, master: M, sites, tags, count, parsedCount: parsed.filter((p) => !p.note).length } }];
}

function moneyAtRisk() {
  const { date, master: M, sites, tags, count, parsedCount } = $input.first().json;
  const ACTION = {
    Supplier: "Back-charge the supplier: time-stamped log and photo attached",
    Client: "Logged for an extension-of-time claim",
    Weather: "Excusable delay, logged for extension of time",
    Utility: "Logged against the utility",
    Own: "Fix in tomorrow's plan",
  };
  const risks = [];
  const add = (s, kind, title, amount, action) => risks.push({ site: s.name, short: s.place.split(",")[0], siteId: s.id, kind, title, amount: amount === null ? null : Math.round(amount), action });
  for (const s of sites) {
    const m = M.sites.find((x) => x.id === s.id);
    if (!s.reported) add(s, "silent", `No report from ${m.supervisor} yesterday`, null, `Call ${m.supervisor.split(" ")[0]} before 9 AM`);
    for (const h of s.hindrances) {
      if (h.idle && h.hours) add(s, "idle", `${h.cause}: ${h.idle} people idle for ${h.hours} h`, (h.idle * h.hours * M.dayRate) / 8, ACTION[h.party]);
      if (h.open) add(s, "claim", `${h.open.ref} still pending from client, day ${h.open.since + 1}`, (h.open.since + 1) * m.overhead, "Delay notice drafted for your sign-off, logged for EOT claim");
    }
    for (const r of s.received) {
      const mat = M.materials[r.material];
      if (r.weighed && r.weighed < r.qty) add(s, "short", `${mat.name} short at weighbridge: ${r.qty} ${mat.unit} on challan, ${r.weighed} weighed`, (r.qty - r.weighed) * mat.rate, `Debit note to ${r.supplier ?? "the supplier"} (${r.challan})`);
      if (r.noPo) add(s, "no_po", `${r.qty} ${mat.unit} ${mat.name} arrived with no PO (${r.challan ?? "no challan no."})`, r.qty * mat.rate, `Approve or send back the ${mat.name} before the bill arrives`);
    }
    for (const st of s.stock)
      if (st.days !== null && st.lead !== null && st.days < st.lead + 1) {
        const mat = M.materials[st.material];
        add(s, "stock", `${mat.name[0].toUpperCase() + mat.name.slice(1)} runs out in ${st.days.toFixed(1)} days, supplier needs ${st.lead}`, s.labourTotal * M.dayRate, `Order ${mat.name} today or ${s.labourTotal} people stand idle`);
      }
    for (const b of m.bills ?? []) {
      if (b.status === "unpaid" && b.days > b.terms) add(s, "bill", `${b.ref} unpaid for ${b.days} days (terms ${b.terms})`, b.amount, `Chase the client's PMC for ${b.ref}`);
      if (b.status === "returned") add(s, "bill", `${b.ref} sent back ${b.days} days ago: ${b.reason} missing`, b.amount, `Re-submit ${b.ref} with the ${b.reason}`);
    }
  }
  risks.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1));
  return [{ json: { date, master: M, sites, tags, risks, riskTotal: risks.reduce((t, r) => t + (r.amount ?? 0), 0), count, parsedCount } }];
}

function brief() {
  const { date, master: M, sites, tags, risks, riskTotal, count, parsedCount } = $input.first().json;
  const L = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${Math.round(n).toLocaleString("en-IN")}`);
  const day = new Date(Date.parse(date) + 864e5).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const unit = (m) => M.materials[m].unit;
  const reported = sites.filter((s) => s.reported).length;
  const labour = sites.reduce((a, s) => a + s.labourTotal, 0);
  const lines = ["*Vera · 8 AM site brief*", `${day} · ${reported}/${sites.length} sites reported · ${labour} people on site`, ""];
  sites.forEach((s, i) => {
    lines.push(`*${i + 1}. ${s.name}, ${s.place}*`);
    if (!s.reported) return lines.push(`⚪ No report from ${s.supervisor}`, "");
    for (const p of s.progress) if (p.done !== null) lines.push(`✅ ${p.activity}: ${p.done}/${p.plan} ${p.unit} (${Math.round(p.pct * 100)}%)`);
    if (s.labourTotal) lines.push(`👷 ${s.labourTotal} · ${s.contractors.map((c) => `${c.name.split(" ")[0]} ${c.count}`).join(" · ")}`);
    for (const r of s.received) lines.push(`📦 ${r.qty} ${unit(r.material)} ${M.materials[r.material].name}${r.challan ? ` (${r.challan})` : ""}`);
    for (const h of s.hindrances) lines.push(`⚠️ ${h.cause}${h.hours ? `, ${h.hours} h` : ""}${h.idle ? `, ${h.idle} idle` : ""} · ${h.party}${h.photos.length ? " · 📷" : ""}`);
    for (const st of s.stock) if (st.days !== null) lines.push(`🔻 ${st.qty} ${unit(st.material)} ${M.materials[st.material].name} left ≈ ${st.days.toFixed(1)} days`);
    lines.push("");
  });
  lines.push(`*💰 Money at risk: ${L(riskTotal)}*`);
  risks.filter((r) => r.amount).slice(0, 5).forEach((r, i) => lines.push(`${i + 1}. ${r.title} · ${L(r.amount)}`));
  lines.push("", "*Do today*");
  for (const r of risks.slice(0, 5)) lines.push(`• ${r.short}: ${r.action}`);

  // Tally receipt notes for yesterday's deliveries. The weighed quantity wins over the challan.
  const esc = (x) => (/[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x));
  const rows = sites.flatMap((s) =>
    s.received.map((r) => {
      const mat = M.materials[r.material];
      const q = r.weighed ?? r.qty;
      return [date, "Receipt Note", r.supplier ?? "Unknown supplier", mat.name, q, mat.unit, mat.rate, Math.round(q * mat.rate), r.challan ?? "", `${s.name}, ${s.place}`, r.noPo ? "No PO: hold for approval" : r.weighed ? `Challan ${r.qty}, weighed ${r.weighed}` : ""];
    }),
  );
  const tally = [["Date", "Voucher Type", "Party", "Stock Item", "Qty", "Unit", "Rate", "Amount", "Challan No", "Godown", "Narration"], ...rows].map((r) => r.map(esc).join(",")).join("\n");

  return [
    {
      json: {
        date,
        briefDate: day,
        stats: { messages: count, understood: parsedCount, sites: sites.length, reported, labour },
        sites,
        tags,
        risks,
        riskTotal,
        brief: lines.join("\n"),
        tally,
      },
    },
  ];
}

/* ───────────────────────── workflow builder ───────────────────────── */

const LEAK = {
  id: "veraDemoLeakChk1",
  name: "Vera Demo · 01 Material Leak Check",
  path: "vera/leak-check",
  note: "## Vera · Material Leak Check\nOne site, last 3 months. POST the registers (POs, delivery challans, stores issue slips, BOQ done) to the webhook.\n\n1. **Read registers**: validate, apply allowed wastage norms\n2. **PO → challan → gate**: short supply, duplicate challans, rate above PO, deliveries with no PO\n3. **Issue → BOQ**: material used vs what the work needed, by wing and supervisor; surplus stock\n4. **1-page summary**: ₹ leaking, recoverable from suppliers vs stoppable, fee",
  nodes: [
    ["Read registers", readRegisters],
    ["PO → challan → gate", matchChallans],
    ["Issue → BOQ", matchBoq],
    ["1-page summary", leakSummary],
  ],
};

const DESK = {
  id: "veraDemoSiteDsk1",
  name: "Vera Demo · 02 Site Record Desk",
  path: "vera/site-desk",
  note: "## Vera · Site Record Desk\nPOST a day of supervisor WhatsApp messages (voice-note transcripts, texts, photo captions, challans).\n\n1. **Site master**: contractors, aliases, plan, open issues, bills (set up at onboarding)\n2. **Read messages**: Hindi / Marathi / Hinglish → labour, progress, materials, stock, hindrances\n3. **Daily site reports**: per site, with photo evidence\n4. **Money at risk**: idle labour, claims, short supply, no-PO deliveries, stock-outs, late bills\n5. **8 AM brief + Tally**: owner's WhatsApp summary and the Tally import file",
  nodes: [
    ["Site master", siteMaster],
    ["Read messages", readMessages],
    ["Daily site reports", dailyReports],
    ["Money at risk", moneyAtRisk],
    ["8 AM brief + Tally", brief],
  ],
};

const body = (fn) => {
  const s = fn.toString();
  return s.slice(s.indexOf("{") + 1, s.lastIndexOf("}")).replace(/^\n/, "");
};

function build(wf) {
  const nodes = [
    { parameters: { content: wf.note, height: 300, width: 520 }, name: "About", type: "n8n-nodes-base.stickyNote", typeVersion: 1, position: [-40, -380], id: randomUUID() },
    {
      parameters: { httpMethod: "POST", path: wf.path, responseMode: "responseNode", options: { allowedOrigins: "*" } },
      name: "Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, 0], id: randomUUID(), webhookId: randomUUID(),
    },
    ...wf.nodes.map(([name, fn], i) => ({ parameters: { jsCode: body(fn) }, name, type: "n8n-nodes-base.code", typeVersion: 2, position: [240 * (i + 1), 0], id: randomUUID() })),
    { parameters: { respondWith: "firstIncomingItem", options: {} }, name: "Respond", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [240 * (wf.nodes.length + 1), 0], id: randomUUID() },
  ];
  const chain = nodes.slice(1).map((n) => n.name);
  const connections = Object.fromEntries(chain.slice(0, -1).map((n, i) => [n, { main: [[{ node: chain[i + 1], type: "main", index: 0 }]] }]));
  return { id: wf.id, name: wf.name, active: false, nodes, connections, settings: { executionOrder: "v1" }, pinData: {}, versionId: randomUUID() };
}

function run(wf, payload) {
  return wf.nodes.reduce((json, [, fn]) => {
    const $input = { first: () => ({ json }), all: () => [{ json }] };
    return new Function("$input", body(fn))($input)[0].json;
  }, { body: payload });
}

function check() {
  const read = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
  const leak = run(LEAK, read("./leak-sample.json"));
  const kinds = Object.fromEntries(leak.supplier.map((g) => [g.kind, g]));
  assert.equal(kinds.duplicate.count, 2);
  assert.ok(kinds.short.suppliers.includes("Shree Balaji Steels"));
  assert.ok(kinds.rate.amount > 0);
  assert.equal(leak.gaps.filter((g) => g.kind === "no_po").length, 2);
  assert.equal(leak.supervisors[0].supervisor, "Sandeep Yadav");
  assert.ok(leak.extraStock.find((s) => s.material === "steel").qty > 10);
  assert.ok(leak.shortStock.find((s) => s.material === "cement"));
  assert.equal(leak.total, leak.recoverable + leak.stoppable);

  const desk = run(DESK, { date: "2026-10-28", messages: read("./desk-sample.json") });
  const site = Object.fromEntries(desk.sites.map((s) => [s.id, s]));
  assert.equal(site.kharadi.labourTotal, 54);
  assert.equal(site.kharadi.progress[0].done, 38);
  const pump = site.kharadi.hindrances.find((h) => h.key === "pump");
  assert.deepEqual([pump.hours, pump.idle, pump.photos], [3, 15, ["m10"]]);
  assert.equal(site.kharadi.stock[0].qty, 210);
  assert.equal(site.kharadi.received[0].challan, "OT/1342");
  assert.equal(site.hinjewadi.labourTotal, 26);
  assert.equal(site.hinjewadi.progress[0].done, 6);
  assert.equal(site.hinjewadi.hindrances.find((h) => h.key === "rain").idle, 26);
  assert.ok(site.hinjewadi.hindrances.find((h) => h.key === "drawing").open);
  assert.equal(site.hinjewadi.received[0].weighed, 13.9);
  assert.equal(site.nashik.labourTotal, 22);
  assert.ok(site.nashik.received[0].noPo);
  assert.equal(site.baner.reported, false);
  assert.ok(desk.risks.some((r) => r.kind === "silent"));
  assert.ok(desk.brief.startsWith("*Vera · 8 AM site brief*"));
  assert.equal(desk.tally.split("\n").length, 4);
  assert.deepEqual(desk.tags.m1, ["18 mistri · Ramesh", "24 helper · Ramesh", "12 bar bender · Sai"]);
  const extra = run(DESK, { date: "2026-10-28", messages: [
    { id: "u1", site: "baner", time: "09:00", kind: "text", text: "Shinde ke 14 mistri aaye" },
    { id: "u2", site: "baner", time: "11:00", kind: "voice", text: "बिजली 2 घंटे नहीं थी, 10 लोग खाली" },
    { id: "u3", site: "baner", time: "18:00", kind: "text", text: "Villa 6 blockwork 45 sqm done" },
  ] });
  assert.deepEqual(Object.values(extra.tags).map((t) => t.length), [1, 1, 1]);
  console.log(`leak: ₹${leak.total} (recoverable ₹${leak.recoverable}, stoppable ₹${leak.stoppable}) · desk: ${desk.stats.understood}/${desk.stats.messages} understood, risk ₹${desk.riskTotal}`);
  console.log(desk.brief);
}

function deploy() {
  const VM = "kyre50l2";
  const flags = "--zone us-central1-f --tunnel-through-iap";
  const C = "n8n-n8n-1";
  const dir = mkdtempSync(join(tmpdir(), "vera-n8n-"));
  const files = [LEAK, DESK].map((wf) => {
    writeFileSync(join(dir, wf.id + ".json"), JSON.stringify(build(wf)));
    return wf.id;
  });
  // Relative names: gcloud scp would read "C:\..." as an instance called C.
  execSync(`gcloud compute scp ${files.map((f) => f + ".json").join(" ")} ${VM}:/tmp/ ${flags}`, { cwd: dir, stdio: "inherit" });
  const remote = [
    ...files.flatMap((f) => [
      `sudo docker cp /tmp/${f}.json ${C}:/tmp/${f}.json`,
      `sudo docker exec ${C} n8n import:workflow --input=/tmp/${f}.json`,
      `sudo docker exec ${C} n8n publish:workflow --id=${f}`,
    ]),
    // The running n8n only registers webhooks for published workflows at start-up.
    `sudo docker restart ${C}`,
  ].join(" && ");
  execSync(`gcloud compute ssh ${VM} ${flags} --command "${remote}"`, { stdio: "inherit" });
}

const cmd = { check, deploy }[process.argv[2]];
if (cmd) cmd();
else console.log("usage: node n8n/vera-demo.mjs check|deploy");
