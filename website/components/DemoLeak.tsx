"use client";

import sample from "@/n8n/leak-sample.json";
import { useState, type ReactNode } from "react";
import { Arrive, ErrorNote, Pipeline, RunButton, useFlow } from "./DemoKit";
import { Bezel, Eyebrow, Reveal, Words, formatINR } from "./ui";

type Row = { kind: string; material: string; supplier: string; ref: string; date?: string; qty: number; amount: number; note?: string };
type Leak = {
  site: string;
  period: { label: string };
  total: number;
  recoverable: number;
  stoppable: number;
  bought: number;
  pct: number;
  annualised: number;
  supplier: { kind: string; label: string; count: number; amount: number; suppliers: string[]; rows: Row[] }[];
  overuse: { material: string; wing: string; supervisor: string; boq: number; allowed: number; used: number; excess: number; amount: number }[];
  supervisors: { supervisor: string; wing: string; amount: number; materials: string[] }[];
  extraStock: { material: string; name: string; unit: string; qty: number; value: number }[];
  shortStock: { material: string; name: string; unit: string; qty: number; book: number }[];
  gaps: Row[];
  fee: { fixed: number; low: number; high: number };
};

const NODES = ["Read registers", "PO → challan → gate", "Issue → BOQ", "1-page summary"];
const MAT: Record<string, string> = { cement: "Cement", steel: "Steel", rmc: "RMC", aac: "AAC blocks" };
const UNIT: Record<string, string> = { cement: "bags", steel: "MT", rmc: "cum", aac: "nos" };
const REGISTERS = [
  { key: "pos", label: "Purchase orders", hint: "from the purchase team", cols: ["po", "date", "supplier", "material", "qty", "rate"] },
  { key: "challans", label: "Delivery challans", hint: "with gate / weighbridge qty", cols: ["challan", "date", "supplier", "po", "material", "qty", "received", "rate"] },
  { key: "issues", label: "Stores issue book", hint: "photos of the paper register", cols: ["slip", "date", "material", "qty", "activity", "wing", "supervisor"] },
  { key: "boq", label: "BOQ work done", hint: "from the measurement book", cols: ["item", "wing", "unit", "done", "next8w"] },
] as const;

// Bags and blocks are counted, so no decimals; MT and cum keep one.
const qty = (n: number, m: string) =>
  `${n.toLocaleString("en-IN", { maximumFractionDigits: m === "cement" || m === "aac" ? 0 : 1 })} ${UNIT[m] ?? ""}`;

export default function DemoLeak() {
  const flow = useFlow<Leak>("vera/leak-check", NODES.length + 2);
  const [open, setOpen] = useState<(typeof REGISTERS)[number]["key"] | null>(null);
  const reg = REGISTERS.find((r) => r.key === open);

  return (
    <section id="leak" className="px-4 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[1280px]">
        <Eyebrow>Material Leak Check: free, one site</Eyebrow>
        <Words
          text="Three months of one site’s paperwork. | *Every rupee that leaked.*"
          className="mt-6 max-w-[18ch] text-[clamp(2.4rem,5vw,4.6rem)] font-medium leading-[0.98] tracking-[-0.045em] md:max-w-none"
        />
        <Reveal delay={0.15}>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-bone/60">
            This is what a client hands over in week one: purchase orders, delivery challans, the stores issue book and the BOQ
            measurements, in Excel or as photos of the registers. n8n matches every line: PO → challan → what reached the gate →
            what was issued → what the work actually needed.
          </p>
        </Reveal>

        <Reveal delay={0.2} className="mt-12">
          <Bezel inner="p-5 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-bone/70">
                {sample.site} · <span className="text-bone/45">{sample.period.label}</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-bone/40">What the site gave us</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {REGISTERS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setOpen(open === r.key ? null : r.key)}
                  aria-expanded={open === r.key}
                  className={`rounded-2xl p-4 text-left ring-1 transition-colors duration-300 ${
                    open === r.key ? "bg-white/[0.07] ring-hivis/50" : "bg-white/[0.03] ring-white/[0.08] hover:bg-white/[0.05]"
                  }`}
                >
                  <p className="text-3xl font-medium tracking-[-0.04em] tabular-nums">{sample[r.key].length}</p>
                  <p className="mt-1 text-sm">{r.label}</p>
                  <p className="mt-0.5 text-[12px] text-bone/40">{r.hint}</p>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-bone/40">{open === r.key ? "Hide" : "View rows"}</p>
                </button>
              ))}
            </div>

            {reg && (
              <div data-lenis-prevent className="mt-4 max-h-72 overflow-auto rounded-2xl bg-ink ring-1 ring-white/[0.08]">
                <table className="w-full min-w-[640px] text-left text-[11px]">
                  <thead className="sticky top-0 bg-ink-3 text-bone/50">
                    <tr>
                      {reg.cols.map((c) => (
                        <th key={c} className="px-3 py-2 font-normal uppercase tracking-[0.12em]">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(sample[reg.key] as unknown as Record<string, unknown>[]).map((row, i) => (
                      <tr key={i} className="border-t border-white/[0.05] text-bone/75">
                        {reg.cols.map((c) => (
                          <td key={c} className="whitespace-nowrap px-3 py-1.5">
                            {row[c] === "" ? "–" : String(row[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-8 border-t border-white/[0.07] pt-6">
              <Pipeline nodes={NODES} step={flow.step} workflow="veraDemoLeakChk1" />
              <div className="mt-6">
                <RunButton busy={flow.busy} onClick={() => flow.run(sample)}>
                  {flow.data ? "Run it again" : "Run the leak check"}
                </RunButton>
              </div>
              <ErrorNote error={flow.error} />
            </div>
          </Bezel>
        </Reveal>

        {flow.data && !flow.busy && <Summary d={flow.data} />}
      </div>
    </section>
  );
}

function Summary({ d }: { d: Leak }) {
  const maxSup = Math.max(...d.supervisors.map((s) => s.amount), 1);
  return (
    <Arrive className="mt-10">
      <Bezel tone="light" inner="p-6 text-ink md:p-12">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 pb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50">Material Leak Check · 1-page summary</p>
            <p className="mt-1 text-sm text-ink/70">
              {d.site} · {d.period.label}
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Prepared by Vera</p>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-sm text-ink/60">Money leaking at this one site</p>
            <p className="mt-2 text-[clamp(3.4rem,8vw,6.5rem)] font-medium leading-[0.9] tracking-[-0.05em] text-hivis tabular-nums">
              {formatINR(d.total)}
            </p>
            <p className="mt-4 max-w-[40ch] text-[15px] leading-relaxed text-ink/65">
              {(d.pct * 100).toFixed(1)}% of the {formatINR(d.bought)} of material bought in three months. At this pace that is about{" "}
              <strong className="font-medium text-ink">{formatINR(d.annualised)} a year</strong>, from one site.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
            <Split
              title="Recoverable from suppliers"
              amount={d.recoverable}
              body="Short supply, duplicate bills and rates above the PO. Each one has a challan number, so it becomes a debit note."
              hot
            />
            <Split
              title="Stoppable from next month"
              amount={d.stoppable}
              body="Material issued beyond what the work needed, after the allowed wastage. It stops once supervisors know it is counted."
            />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <Block title="Paid for, never received">
            <ul className="divide-y divide-ink/10">
              {d.supplier.map((g) => (
                <li key={g.kind} className="py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-medium">{g.label}</p>
                    <p className="font-medium tabular-nums">{formatINR(g.amount)}</p>
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink/55">
                    {g.count} challan{g.count > 1 ? "s" : ""} · {g.suppliers.join(", ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.rows.slice(0, 8).map((r) => (
                      <span key={r.ref + r.kind} title={r.note} className="rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-[10px] text-ink/70">
                        {r.ref}
                      </span>
                    ))}
                    {g.rows.length > 8 && <span className="px-1 text-[10px] text-ink/45">+{g.rows.length - 8}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Used beyond what the work needed">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[13px]">
                <thead className="text-[11px] text-ink/45">
                  <tr>
                    <th className="pb-2 font-normal">Material · wing</th>
                    <th className="pb-2 text-right font-normal">BOQ needs</th>
                    <th className="pb-2 text-right font-normal">Used</th>
                    <th className="pb-2 text-right font-normal">Extra</th>
                    <th className="pb-2 text-right font-normal">₹</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {d.overuse.map((o) => (
                    <tr key={o.material + o.wing} className="border-t border-ink/10">
                      <td className="py-2">
                        {MAT[o.material]} · {o.wing}
                        <span className="block text-[11px] text-ink/45">{o.supervisor}</span>
                      </td>
                      <td className="py-2 text-right">{qty(o.boq, o.material)}</td>
                      <td className="py-2 text-right">{qty(o.used, o.material)}</td>
                      <td className="py-2 text-right text-hivis">+{qty(o.excess, o.material)}</td>
                      <td className="py-2 text-right font-medium">{formatINR(o.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink/45">Extra is counted only after allowed wastage: cement 2%, steel 3%, RMC 1.5%, blocks 3%.</p>
          </Block>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-3">
          <Block title="Gaps by supervisor">
            <ul className="space-y-4">
              {d.supervisors.map((s) => (
                <li key={s.supervisor}>
                  <div className="flex items-baseline justify-between text-[14px]">
                    <span>
                      {s.supervisor} <span className="text-ink/45">· Wing {s.wing}</span>
                    </span>
                    <span className="font-medium tabular-nums">{formatINR(s.amount)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
                    <div className="h-full rounded-full bg-hivis" style={{ width: `${(s.amount / maxSup) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-ink/45">{s.materials.map((m) => MAT[m]).join(", ")}</p>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Extra stock you can move">
            <ul className="space-y-3 text-[14px]">
              {d.extraStock.map((s) => (
                <li key={s.material} className="flex items-baseline justify-between gap-3">
                  <span>
                    {qty(s.qty, s.material)} {MAT[s.material].toLowerCase()}
                    <span className="block text-[11px] text-ink/45">beyond the next 8 weeks of work</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatINR(s.value)}</span>
                </li>
              ))}
              {d.shortStock.map((s) => (
                <li key={s.material} className="flex items-baseline justify-between gap-3 text-ink/70">
                  <span>
                    {MAT[s.material]} will run short
                    <span className="block text-[11px] text-ink/45">
                      {qty(s.book, s.material)} in stock, {qty(s.qty, s.material)} more needed
                    </span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.15em]">Reorder</span>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Needs your decision">
            <ul className="space-y-3 text-[14px]">
              {d.gaps.map((g) => (
                <li key={g.kind + g.ref} className="flex items-baseline justify-between gap-3">
                  <span>
                    {g.kind === "no_po" ? `${g.ref}: ${qty(g.qty, g.material)} with no PO` : `${g.ref} exceeded by ${qty(g.qty, g.material)}`}
                    <span className="block text-[11px] text-ink/45">{g.supplier}</span>
                  </span>
                  <span className="tabular-nums text-ink/70">{formatINR(g.amount)}</span>
                </li>
              ))}
            </ul>
          </Block>
        </div>

        <div className="mt-12 flex flex-wrap items-end justify-between gap-6 rounded-2xl bg-ink p-6 text-bone md:p-8">
          <div className="max-w-[56ch]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-bone/45">Next: the paid audit, all sites, 4 weeks</p>
            <p className="mt-3 text-xl leading-snug tracking-[-0.02em] md:text-2xl">
              ₹50,000 plus 15–20% of what we recover. On this site alone that is{" "}
              <span className="text-hivis">
                {formatINR(d.fee.fixed + d.fee.low)}–{formatINR(d.fee.fixed + d.fee.high)}
              </span>{" "}
              against {formatINR(d.recoverable)} back from suppliers.
            </p>
          </div>
          <p className="text-sm text-bone/50">This check: free.</p>
        </div>
      </Bezel>
    </Arrive>
  );
}

function Split({ title, amount, body, hot }: { title: string; amount: number; body: string; hot?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ring-1 ${hot ? "bg-hivis/[0.08] ring-hivis/25" : "bg-ink/[0.03] ring-ink/[0.07]"}`}>
      <p className="text-sm text-ink/60">{title}</p>
      <p className="mt-2 text-4xl font-medium tracking-[-0.04em] tabular-nums">{formatINR(amount)}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-ink/60">{body}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-ink/50">{title}</p>
      {children}
    </div>
  );
}
