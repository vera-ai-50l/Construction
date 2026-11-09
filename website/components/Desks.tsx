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
  price: string;
  note?: string;
  Visual: () => ReactNode;
};

const DESKS: Desk[] = [
  {
    name: "Material Leak Check",
    tag: "Free · Week 1",
    body: "One site, the last three months. We match purchase orders → delivery challans → material issued → material actually used per the BOQ, for cement, steel and two items you choose.",
    facts: ["A 1-page “money leaking” summary", "Surplus stock you can move or sell", "Gaps by site and by supervisor"],
    price: "Free for one site · all-site audit ₹1.5–3 L, or ₹50k + 15–20% of what's recovered",
    Visual: LeakSummary,
  },
  {
    name: "Site Record Desk",
    tag: "Core · Monthly",
    body: "Supervisors send voice notes in Hindi or their own language, photos and challans to one WhatsApp number. No new app. Vera writes the record.",
    facts: [
      "Daily progress vs plan, labour by contractor, materials in, hindrance register",
      "8 AM one-page summary across every site",
      "Weekly claim-ready PDF · monthly Tally / ERP import file",
    ],
    price: "₹75k setup · ₹40–60k a month for 3 sites · ₹12k per extra site",
    Visual: RecordDesk,
  },
  {
    name: "Bill-to-Cash Desk",
    tag: "Add-on · Month 2–3",
    body: "Builds every running bill pack from the record — measurements, photos, test certificates and your client's own checklist. Then chases every rupee.",
    facts: ["No bill goes out with missing papers", "Objections, ageing and retention tracked", "Automatic follow-ups"],
    price: "₹1 L setup · ₹50k a month",
    note: "Honest limit: it can't speed up a government treasury. It fixes your delays and missing papers.",
    Visual: BillDesk,
  },
  {
    name: "Project Control",
    tag: "Add-on · Month 3+",
    body: "The experienced PM mid-size firms can't hire. Plan vs actual, cost to finish, a 13-week cash forecast and a risk list — reviewed every week by a senior PM from a large EPC firm.",
    facts: ["Weekly 1-hour call with the owner", "Built from Site Record Desk data", "A senior PM costs ₹25–40 L a year. This is about ₹15 L."],
    price: "₹1–1.5 L a month · up to 5 sites",
    Visual: CashForecast,
  },
  {
    name: "Claim File Builder",
    tag: "One-off · When a dispute starts",
    body: "We rebuild the timeline of a delay from WhatsApp chats, emails and drawings — delay register, change-order register and the money calculations, ready for your lawyer.",
    facts: ["Every entry traced to its source", "Delay and change-order registers", "Quantum worked out, not guessed"],
    price: "₹3–10 L per claim, or a fee plus a share of the award",
    Visual: ClaimTimeline,
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
            <Eyebrow>02 — The desks</Eyebrow>
            <Words
              text="One WhatsApp number. | Five desks that *run on it.*"
              className="mt-6 text-[clamp(2.5rem,6vw,6rem)] font-medium leading-[0.95] tracking-[-0.05em]"
            />
          </div>
          <Reveal className="md:col-span-4" delay={0.2}>
            <p className="max-w-[40ch] text-bone/55 md:text-lg">
              Every product sits on the same daily record — so each one gets sharper the longer your sites use it.
              Start free. Add a desk when the last one has paid for itself.
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
              <span className="font-mono text-xs text-bone/35">0{i + 1}</span>
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
          <div className="border-t border-white/[0.08] pt-5">
            <p className="font-mono text-[12px] leading-relaxed text-bone/55">{d.price}</p>
            {d.note && <p className="mt-2 text-[12px] italic text-bone/40">{d.note}</p>}
          </div>
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
  return <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone/40">{children}</span>;
}

function LeakSummary() {
  const sites = [
    ["Site 01 · Nagpur", 41.2],
    ["Site 03 · Indore", 38.9],
    ["Site 04 · Surat", 19.3],
    ["Site 02 · Wakad", 18.6],
  ] as const;
  return (
    <motion.div {...view} variants={stagger(0.1)} className="flex h-full flex-col justify-between gap-8 p-6 md:p-8">
      <motion.div variants={rise} className="flex items-center justify-between">
        <Label>Money leaking · 1-page summary</Label>
        <Label>Jul–Sep 2026</Label>
      </motion.div>
      <motion.div variants={rise}>
        <p className="text-[clamp(3rem,6vw,5rem)] font-medium leading-none tracking-[-0.055em] text-hivis">₹1.18 Cr</p>
        <p className="mt-2 text-sm text-bone/50">across 4 sites, cement + steel + RMC + shuttering</p>
      </motion.div>
      <div className="space-y-4">
        {sites.map(([s, v], i) => (
          <motion.div key={s} variants={rise}>
            <div className="flex justify-between text-[13px]">
              <span className="text-bone/70">{s}</span>
              <span className="font-mono tabular-nums">₹{v} L</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full origin-left rounded-full bg-hivis"
                style={{ width: `${(v / 41.2) * 100}%` }}
                variants={grow(0.3 + i * 0.12)}
              />
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div variants={rise} className="flex flex-wrap gap-2">
        {["Surplus: 1,240 bags · 18 MT Fe500", "7 supervisors flagged", "Ready in 7 days"].map((c) => (
          <span key={c} className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[11px] text-bone/65 ring-1 ring-white/[0.08]">
            {c}
          </span>
        ))}
      </motion.div>
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
            <span className="font-mono text-[10px] text-bone/45">0:42</span>
          </div>
          <p className="mt-2 font-deva text-[12px] leading-snug text-bone/60">चौथी मंज़िल का स्लैब आज पूरा हुआ…</p>
        </motion.div>
        <motion.div variants={rise} className="max-w-[220px] overflow-hidden rounded-2xl rounded-tl-md bg-white/[0.06]">
          <div className="relative h-24 bg-[linear-gradient(135deg,#2a2620,#14120f)]">
            <div className="absolute inset-0 blueprint opacity-70" />
            <div className="absolute bottom-3 left-3 h-10 w-24 border border-bone/30" />
            <div className="absolute bottom-3 left-14 h-16 w-px bg-hivis/70" />
          </div>
          <p className="px-3 py-2 font-mono text-[10px] text-bone/50">IMG_2041 · slab, C-block</p>
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
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">Daily record · 28 Oct</span>
          <span className="flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] text-bone">
            <Microphone size={10} weight="light" /> auto
          </span>
        </motion.div>
        <div className="mt-4 flex-1 divide-y divide-ink/10">
          {rows.map(([k, v]) => (
            <motion.div key={k} variants={rise} className="py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">{k}</p>
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
          className="mt-8 self-start rounded-lg border-2 border-hivis px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-hivis"
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
            <p className="mt-2 font-mono text-[11px] text-bone/45">₹{lakh} L · follow-up sent 09:00</p>
          </motion.div>
        ))}
        <motion.p variants={rise} className="mt-auto text-[12px] text-bone/45">
          Retention held back: <span className="font-mono text-bone/80">₹46.0 L</span>
        </motion.p>
      </motion.div>
    </div>
  );
}

function CashForecast() {
  const cash = [18, 22, 19, 25, 21, 14, 6, -4, 3, 12, 20, 27, 31];
  const Wd = 520;
  const Hd = 230;
  const x = (i: number) => 20 + (i * (Wd - 40)) / (cash.length - 1);
  const y = (v: number) => Hd - 30 - ((v + 10) / 45) * (Hd - 60);
  const d = cash.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <motion.div {...view} variants={stagger(0.12)} className="flex h-full flex-col gap-6 p-6 md:p-8">
      <motion.div variants={rise} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Label>13-week cash forecast · ₹ L</Label>
          <p className="mt-2 text-2xl font-medium tracking-[-0.03em]">Dip in week 8 — chase RA-04 now.</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <Label>Plan vs actual</Label>
            <p className="mt-1 font-mono text-lg">92%</p>
          </div>
          <div>
            <Label>Cost to finish</Label>
            <p className="mt-1 font-mono text-lg">₹31.4 Cr</p>
          </div>
        </div>
      </motion.div>
      <motion.svg variants={rise} viewBox={`0 0 ${Wd} ${Hd}`} className="w-full flex-1 text-bone" aria-label="Cash forecast chart dipping below zero in week 8">
        <line x1="20" x2={Wd - 20} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity="0.18" strokeDasharray="3 5" />
        <text x={Wd - 20} y={y(0) - 6} textAnchor="end" className="fill-bone/35 font-mono text-[10px]">
          ₹0
        </text>
        {cash.map((v, i) => (
          <motion.rect
            key={i}
            x={x(i) - 7}
            width="14"
            rx="3"
            y={Math.min(y(v), y(0))}
            height={Math.abs(y(v) - y(0))}
            fill={v < 0 ? "#ff5b1f" : "currentColor"}
            fillOpacity={v < 0 ? 1 : 0.08}
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.3 + i * 0.05, duration: 0.6 } } }}
          />
        ))}
        <motion.path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { delay: 0.4, duration: 2, ease: EASE } } }}
        />
        {cash.map((v, i) => (
          <motion.circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={v < 0 ? 4.5 : 2.5}
            fill={v < 0 ? "#ff5b1f" : "currentColor"}
            variants={{
              hidden: { scale: 0 },
              show: { scale: 1, transition: { delay: 0.5 + i * 0.13, type: "spring", stiffness: 300, damping: 15 } },
            }}
          />
        ))}
      </motion.svg>
      <motion.div variants={rise} className="flex flex-wrap gap-2">
        {["W8 cash −₹4 L · chase RA-04", "Steel +6% · lock the PO", "Formwork crew short · Surat"].map((c, i) => (
          <span
            key={c}
            className={`rounded-full px-3 py-1.5 text-[11px] ring-1 ${i === 0 ? "bg-hivis/10 text-hivis ring-hivis/30" : "bg-white/[0.05] text-bone/65 ring-white/[0.08]"}`}
          >
            {c}
          </span>
        ))}
      </motion.div>
    </motion.div>
  );
}

function ClaimTimeline() {
  const events = [
    ["12 Mar", "Revised drawing R3 issued 9 days late", "email"],
    ["19 Mar", "Hindrance logged with photo, C-block", "voice note"],
    ["02 Apr", "Extra waterproofing instructed · CO-14", "drawing"],
    ["28 Apr", "Slab cycle slips 11 days", "daily record"],
  ];
  return (
    <motion.div {...view} variants={stagger(0.25, 0.3)} className="flex h-full flex-col p-6 md:p-8">
      <Label>Claim file · Wakad Tower B</Label>
      <div className="relative mt-6 flex-1">
        <motion.span
          className="absolute bottom-2 left-[5px] top-2 w-px origin-top bg-gradient-to-b from-hivis to-white/10"
          variants={{ hidden: { scaleY: 0 }, show: { scaleY: 1, transition: { duration: 1.6, ease: EASE } } }}
        />
        <ul className="space-y-5">
          {events.map(([date, what, src]) => (
            <motion.li key={date} variants={rise} className="relative pl-8">
              <span className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-hivis bg-ink-3" />
              <p className="font-mono text-[11px] text-bone/45">{date}</p>
              <p className="mt-0.5 text-[14px] text-bone/85">{what}</p>
              <span className="mt-1.5 inline-block rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-bone/50">
                source · {src}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
      <motion.div variants={rise} className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/[0.08] pt-5">
        <div>
          <Label>Delay · quantum</Label>
          <p className="mt-1 text-3xl font-medium tracking-[-0.04em]">
            47 days · <span className="text-hivis">₹68.4 L</span>
          </p>
        </div>
        <span className="rounded-full bg-bone px-3 py-1.5 text-[11px] font-medium text-ink">Ready for your lawyer</span>
      </motion.div>
    </motion.div>
  );
}
