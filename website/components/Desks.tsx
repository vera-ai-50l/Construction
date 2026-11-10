"use client";

import { Check, FilePdf, Microphone, Play } from "@phosphor-icons/react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";
import { EASE, Eyebrow, Reveal, Words, useMedia } from "./ui";

type Desk = {
  name: string;
  tag: string;
  body: string;
  facts: string[];
  note?: string;
  Visual: () => ReactNode;
};

const DESKS: Desk[] = [
  {
    name: "Material Leak Check",
    tag: "Free · Week 1",
    body: "The last three months, matched line by line: purchase orders, delivery challans, material issued and material used per the BOQ. Then we balance stock across your sites and check wastage supervisor by supervisor.",
    facts: [
      "A one-page summary of money leaking",
      "Inventory balancing across sites: move surplus to sites that are short",
      "Wastage check within each site, supervisor by supervisor",
    ],
    Visual: LeakSummary,
  },
  {
    name: "One-Day Mobilisation",
    tag: "New sites · Day 1",
    body: "Once you are on Vera, every new site goes live the day it opens. Supervisors join one WhatsApp number, the BOQ and opening stock are loaded, and the first daily record goes out that evening.",
    facts: [
      "Supervisors on WhatsApp by mid-morning, no app to install",
      "BOQ, rates and opening stock loaded the same day",
      "First daily record and 8 AM summary from day two",
    ],
    Visual: MobilisationDay,
  },
  {
    name: "Site Record Desk",
    tag: "Core · Monthly",
    body: "Supervisors send voice notes in Hindi or their own language, photos and challans to one WhatsApp number. No new app. Vera writes the record.",
    facts: [
      "Daily progress vs plan, labour by contractor, materials in, hindrance register",
      "8 AM one-page summary across every site",
      "Weekly claim-ready PDF and a monthly Tally or ERP import file",
    ],
    Visual: RecordDesk,
  },
  {
    name: "Bill-to-Cash Desk",
    tag: "Add-on · Month 2–3",
    body: "Builds every running bill pack from the record: measurements, photos, test certificates and your client's own checklist. Then follows up until you are paid.",
    facts: ["No bill goes out with missing papers", "Objections, ageing and retention tracked", "Automatic follow-ups"],
    note: "It cannot speed up a government treasury. It fixes your own delays and missing papers.",
    Visual: BillDesk,
  },
];

export default function Desks() {
  const ref = useRef<HTMLDivElement>(null);
  const desktop = useMedia("(min-width: 768px)");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <section id="desks" className="relative -mt-10 rounded-t-[2.5rem] bg-ink px-4 pb-24 pt-28 md:px-10 md:pb-32 md:pt-40">
      <div className="pointer-events-none absolute inset-0 rounded-t-[2.5rem] blueprint [mask-image:linear-gradient(to_bottom,black,transparent_40%)]" />
      <div className="relative mx-auto max-w-[1440px]">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <Eyebrow>What Vera does</Eyebrow>
            <Words
              text="One WhatsApp number. | Four desks that *run on it.*"
              className="mt-6 text-[clamp(2.5rem,6vw,6rem)] font-medium leading-[0.95] tracking-[-0.05em]"
            />
          </div>
          <Reveal className="md:col-span-4" delay={0.2}>
            <p className="max-w-[40ch] text-bone/55 md:text-lg">
              Every desk runs on the same daily record. Start with the free leak check and add a desk when the last
              one has paid for itself.
            </p>
          </Reveal>
        </div>

        <div ref={ref} className="relative mt-16 flex flex-col gap-6 md:mt-24 md:gap-0">
          {DESKS.map((d, i) => (
            <DeskCard key={d.name} d={d} i={i} n={DESKS.length} p={scrollYProgress} pinned={desktop} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DeskCard({ d, i, n, p, pinned }: { d: Desk; i: number; n: number; p: MotionValue<number>; pinned: boolean }) {
  const scale = useTransform(p, [i / n, 1], [1, 1 - (n - 1 - i) * 0.035]);
  const shade = useTransform(p, [i / n, (i + 1) / n], [0, i < n - 1 ? 0.55 : 0]);
  const { Visual } = d;

  const card = (
    <div className="relative rounded-[2.5rem] bg-white/[0.035] p-1.5 ring-1 ring-white/10">
      <div className="relative grid gap-8 overflow-hidden rounded-[calc(2.5rem-0.375rem)] bg-ink-2 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] md:grid-cols-12 md:gap-10 md:p-10">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[30rem] rounded-full bg-[radial-gradient(circle,rgba(255,91,31,0.10),transparent_65%)]" />
        <div className="relative flex flex-col justify-between gap-8 md:col-span-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-bone/35">0{i + 1}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] ${
                  i === 0 ? "bg-hivis text-coal" : "bg-white/[0.06] text-bone/70 ring-1 ring-white/10"
                }`}
              >
                {d.tag}
              </span>
            </div>
            <h3 className="mt-6 text-[clamp(2rem,3.6vw,3.25rem)] font-medium leading-[0.98] tracking-[-0.045em]">{d.name}</h3>
            <p className="mt-4 max-w-[46ch] leading-relaxed text-bone/60">{d.body}</p>
            <ul className="mt-6 space-y-2.5">
              {d.facts.map((f) => (
                <li key={f} className="flex gap-3 text-sm text-bone/75">
                  <Check size={16} weight="light" className="mt-0.5 shrink-0 text-hivis" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          {d.note && <p className="border-t border-white/[0.08] pt-5 text-[13px] leading-relaxed text-bone/45">{d.note}</p>}
        </div>
        <div className="relative min-h-[340px] overflow-hidden rounded-[1.6rem] bg-ink-3/80 ring-1 ring-white/[0.06] md:col-span-7 md:min-h-[460px]">
          <Visual />
        </div>
        {pinned && <motion.div style={{ opacity: shade }} className="pointer-events-none absolute inset-0 bg-ink" />}
      </div>
    </div>
  );

  if (!pinned) return <Reveal>{card}</Reveal>;
  return (
    <div className="sticky top-0 flex h-[100dvh] items-center">
      <motion.div style={{ scale, top: `calc(-4vh + ${i * 22}px)` }} className="relative w-full origin-top">
        {card}
      </motion.div>
    </div>
  );
}

/* ---------- Visuals ---------- */

const view = { initial: "hidden", whileInView: "show", viewport: { once: true, margin: "-20% 0px" } } as const;
const stagger = (s = 0.12, d = 0.2) => ({ hidden: {}, show: { transition: { staggerChildren: s, delayChildren: d } } });
const rise = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE } },
};

const grow = (delay: number) => ({
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { delay, duration: 1.2, ease: EASE } },
});

function Label({ children }: { children: ReactNode }) {
  return <span className="text-[10px] uppercase tracking-[0.18em] text-bone/40">{children}</span>;
}

function LeakSummary() {
  const sites = [
    ["Site 01 · Nagpur", 41.2],
    ["Site 03 · Indore", 38.9],
    ["Site 04 · Surat", 19.3],
    ["Site 02 · Wakad", 18.6],
  ] as const;
  // Across sites: surplus at one site sent to a site that would otherwise buy again.
  const moves = [
    ["Nagpur", "Indore", "420 bags cement"],
    ["Surat", "Wakad", "6 MT Fe500"],
  ] as const;
  // Within a site: wastage per supervisor against the BOQ allowance (2.5%).
  const supervisors = [
    ["R. Patil", 6.8],
    ["S. Khan", 4.1],
    ["A. Desai", 2.2],
  ] as const;
  return (
    <motion.div {...view} variants={stagger(0.08)} className="flex h-full flex-col justify-between gap-5 p-6 md:p-8">
      <motion.div variants={rise} className="flex items-center justify-between">
        <Label>Money leaking · 1-page summary</Label>
        <Label>Jul–Sep 2026</Label>
      </motion.div>
      <motion.div variants={rise}>
        <p className="text-[clamp(2.6rem,4.8vw,4.25rem)] font-medium leading-none tracking-[-0.055em] text-hivis">₹1.18 Cr</p>
        <p className="mt-2 text-sm text-bone/50">across 4 sites, cement + steel + RMC + shuttering</p>
      </motion.div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {sites.map(([site, v], i) => (
          <motion.div key={site} variants={rise}>
            <div className="flex justify-between text-[13px]">
              <span className="text-bone/70">{site}</span>
              <span className="tabular-nums">₹{v} L</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full origin-left rounded-full bg-hivis"
                style={{ width: `${(v / 41.2) * 100}%` }}
                variants={grow(0.3 + i * 0.12)}
              />
            </div>
          </motion.div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <motion.div variants={rise} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.07]">
          <Label>Inventory balancing · across sites</Label>
          <ul className="mt-3 space-y-2.5">
            {moves.map(([from, to, what]) => (
              <li key={from} className="text-[13px]">
                <span className="flex items-center gap-1.5 text-bone/85">
                  {from} <span className="text-hivis">→</span> {to}
                </span>
                <span className="text-[12px] text-bone/45">{what}, not bought again</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-white/[0.07] pt-2.5 text-[12px] text-bone/60">
            <span className="tabular-nums text-bone">₹14.6 L</span> saved on new orders
          </p>
        </motion.div>
        <motion.div variants={rise} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.07]">
          <Label>Wastage by supervisor · Site 03</Label>
          <ul className="mt-3 space-y-2.5">
            {supervisors.map(([name, pct], i) => (
              <li key={name} className="text-[13px]">
                <div className="flex justify-between">
                  <span className="text-bone/80">{name}</span>
                  <span className={`tabular-nums ${pct > 2.5 ? "text-hivis" : "text-bone/60"}`}>{pct}%</span>
                </div>
                <div className="relative mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className={`h-full origin-left rounded-full ${pct > 2.5 ? "bg-hivis" : "bg-bone/40"}`}
                    style={{ width: `${(pct / 7) * 100}%` }}
                    variants={grow(0.5 + i * 0.1)}
                  />
                  {/* BOQ wastage allowance */}
                  <span className="absolute inset-y-0 w-px bg-bone/60" style={{ left: `${(2.5 / 7) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-white/[0.07] pt-2.5 text-[12px] text-bone/60">
            Allowance 2.5% · <span className="text-bone">2 supervisors over</span>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

function MobilisationDay() {
  const day = [
    ["09:00", "Site 05 created", "Pune · residential, 2 towers"],
    ["10:30", "12 supervisors on WhatsApp", "Hindi and Marathi voice notes"],
    ["13:00", "BOQ and rates loaded", "418 lines from your Excel"],
    ["16:00", "Opening stock counted", "Cement, steel, RMC, shuttering"],
    ["18:30", "First daily record sent", "Progress, labour, materials"],
  ] as const;
  return (
    <motion.div {...view} variants={stagger(0.12)} className="flex h-full flex-col justify-between gap-6 p-6 md:p-8">
      <motion.div variants={rise} className="flex items-center justify-between">
        <Label>Site 05 · Pune · day 1</Label>
        <span className="rounded-full bg-hivis px-2.5 py-1 text-[11px] font-medium text-coal">Live in 1 day</span>
      </motion.div>
      <ol className="relative space-y-5 pl-7">
        <motion.span
          aria-hidden
          className="absolute bottom-2 left-[7px] top-2 w-px origin-top bg-gradient-to-b from-hivis to-hivis/20"
          variants={{ hidden: { scaleY: 0 }, show: { scaleY: 1, transition: { duration: 1.6, ease: EASE } } }}
        />
        {day.map(([time, what, detail], i) => (
          <motion.li key={time} variants={rise} className="relative">
            <span
              className={`absolute -left-7 top-0.5 flex size-[15px] items-center justify-center rounded-full ring-1 ${
                i === day.length - 1 ? "bg-hivis ring-hivis" : "bg-ink-2 ring-hivis/60"
              }`}
            >
              <Check size={9} weight="bold" className={i === day.length - 1 ? "text-coal" : "text-hivis"} />
            </span>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[14px] text-bone/90">{what}</span>
              <span className="text-[12px] tabular-nums text-bone/45">{time}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-bone/45">{detail}</p>
          </motion.li>
        ))}
      </ol>
      <motion.p variants={rise} className="border-t border-white/[0.08] pt-4 text-[13px] text-bone/60">
        Day 2, 08:00: the owner gets the first summary for Site 05 with the other sites.
      </motion.p>
    </motion.div>
  );
}

function RecordDesk() {
  const rows = [
    ["Progress", "C-block 4th-floor slab · 100%"],
    ["Labour", "42 · Sharma Infra 28, local 14"],
    ["Received", "12 MT Fe500 · matched PO-2291"],
    ["Hindrance", "Drawing C7 pending · day 3"],
  ];
  return (
    <div className="grid h-full gap-5 p-6 md:grid-cols-2 md:p-8">
      <motion.div {...view} variants={stagger(0.35)} className="flex flex-col gap-3">
        <Label>WhatsApp · Site 02</Label>
        <motion.div variants={rise} className="max-w-[260px] rounded-2xl rounded-tl-md bg-white/[0.06] p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-hivis text-coal">
              <Play size={12} weight="fill" />
            </span>
            <div className="flex h-5 flex-1 items-center gap-[2px]">
              {Array.from({ length: 22 }, (_, i) => (
                <span key={i} className="w-[2px] rounded-full bg-bone/50" style={{ height: `${25 + ((i * 41) % 75)}%` }} />
              ))}
            </div>
            <span className="text-[10px] text-bone/45">0:42</span>
          </div>
          <p className="mt-2 font-deva text-[12px] leading-snug text-bone/60">चौथी मंज़िल का स्लैब आज पूरा हुआ…</p>
        </motion.div>
        <motion.div variants={rise} className="max-w-[220px] overflow-hidden rounded-2xl rounded-tl-md bg-white/[0.06]">
          <div className="relative h-24 bg-[linear-gradient(135deg,#2a2620,#14120f)]">
            <div className="absolute inset-0 blueprint opacity-70" />
            <div className="absolute bottom-3 left-3 h-10 w-24 border border-bone/30" />
            <div className="absolute bottom-3 left-14 h-16 w-px bg-hivis/70" />
          </div>
          <p className="px-3 py-2 text-[10px] text-bone/50">IMG_2041 · slab, C-block</p>
        </motion.div>
        <motion.div variants={rise} className="flex max-w-[220px] items-center gap-2.5 rounded-2xl rounded-tl-md bg-white/[0.06] p-3">
          <FilePdf size={20} weight="light" className="text-bone/70" />
          <span className="text-[12px] text-bone/75">challan_4471.pdf</span>
        </motion.div>
      </motion.div>

      <motion.div
        {...view}
        variants={stagger(0.18, 1.3)}
        className="flex flex-col rounded-2xl bg-bone p-5 text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]"
      >
        <motion.div variants={rise} className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink/50">Daily record · 28 Oct</span>
          <span className="flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] text-bone">
            <Microphone size={10} weight="light" /> auto
          </span>
        </motion.div>
        <div className="mt-4 flex-1 divide-y divide-ink/10">
          {rows.map(([k, v]) => (
            <motion.div key={k} variants={rise} className="py-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40">{k}</p>
              <p className="mt-1 text-[13px] font-medium leading-snug">{v}</p>
            </motion.div>
          ))}
        </div>
        <motion.p variants={rise} className="mt-3 text-[11px] text-ink/50">
          Time-stamped · source photo + voice note attached
        </motion.p>
      </motion.div>
    </div>
  );
}

function BillDesk() {
  const checks = ["Measurement sheet", "Site photos · 41", "Cube test certificates · 6", "Client checklist · 18/18", "Joint measurement signed"];
  const ageing = [
    ["RA-04", 74, 38.6],
    ["RA-05", 41, 22.1],
    ["RA-06", 12, 27.4],
  ] as const;
  return (
    <div className="grid h-full gap-5 p-6 md:grid-cols-2 md:p-8">
      <motion.div {...view} variants={stagger(0.22, 0.3)} className="flex flex-col">
        <Label>RA Bill 07 · Wakad · pack</Label>
        <ul className="mt-5 space-y-3">
          {checks.map((c) => (
            <motion.li key={c} variants={rise} className="flex items-center gap-3 text-[13px] text-bone/80">
              <span className="flex size-5 items-center justify-center rounded-full bg-hivis text-coal">
                <Check size={11} weight="bold" />
              </span>
              {c}
            </motion.li>
          ))}
        </ul>
        <motion.div
          variants={{
            hidden: { opacity: 0, scale: 1.4, rotate: -14 },
            show: { opacity: 1, scale: 1, rotate: -6, transition: { type: "spring", stiffness: 260, damping: 16 } },
          }}
          className="mt-8 self-start rounded-lg border-2 border-hivis px-4 py-2 text-xs uppercase tracking-[0.2em] text-hivis"
        >
          Ready to submit
        </motion.div>
      </motion.div>

      <motion.div {...view} variants={stagger(0.15, 0.6)} className="flex flex-col gap-3">
        <Label>Unpaid · ageing</Label>
        {ageing.map(([id, days, lakh]) => (
          <motion.div key={id} variants={rise} className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/[0.06]">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{id}</span>
              <span className={`font-mono text-[12px] tabular-nums ${days > 60 ? "text-hivis" : "text-bone/55"}`}>{days} days</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className={`h-full origin-left rounded-full ${days > 60 ? "bg-hivis" : "bg-bone/50"}`}
                style={{ width: `${(days / 90) * 100}%` }}
                variants={grow(0.3)}
              />
            </div>
            <p className="mt-2 text-[11px] text-bone/45">₹{lakh} L · follow-up sent 09:00</p>
          </motion.div>
        ))}
        <motion.p variants={rise} className="mt-auto text-[12px] text-bone/45">
          Retention held back: <span className="text-bone/80">₹46.0 L</span>
        </motion.p>
      </motion.div>
    </div>
  );
}
