"use client";

import {
  ArrowDown,
  ArrowUUpLeft,
  CaretLeft,
  CaretRight,
  Check,
  DotsSixVertical,
  LockSimple,
  Plus,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { AnimatePresence, LayoutGroup, animate, motion, useInView, useScroll, useSpring } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  TEAM,
  addDays,
  bankedIn,
  doneBy,
  lakh,
  openIn,
  parseINR,
  seed,
  summary,
  today,
  uid,
  type CampStatus,
  type Checkpoint,
  type Deal,
  type Doc,
  type HQData,
  type Hedge,
  type Phase,
  type Todo,
} from "./hqData";
import { Bezel, Clock, EASE, Eyebrow, Reveal, Words, formatINR } from "./ui";

const HQScene = dynamic(() => import("./HQScene"), { ssr: false });

type Sync = "loading" | "locked" | "saved" | "saving" | "offline" | "conflict";
type Update = (fn: (d: HQData) => void) => void;
type Summary = ReturnType<typeof summary>;

const pad = (n: number) => String(n).padStart(2, "0");
const pct = (f: number) => `${(f * 100).toFixed(f < 0.1 ? 1 : 0)}%`;
const fmtDay = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", o);
const readKey = () => {
  try {
    return localStorage.getItem("hq-key") ?? "";
  } catch {
    return "";
  }
};

/** Load, autosave and poll the shared doc. Each save carries the rev it started from; a stale one gets the teammate's version back. */
function useHQ() {
  const [data, setData] = useState<HQData | null>(null);
  const [sync, setSync] = useState<Sync>("loading");
  const rev = useRef(0);
  const edits = useRef(0); // local edits made
  const saved = useRef(0); // local edits the server has
  const chain = useRef(Promise.resolve());

  const pull = useCallback(async (first = false) => {
    try {
      const r = await fetch("/api/hq", { headers: { "x-hq-key": readKey() }, cache: "no-store" });
      if (r.status === 401) return setSync("locked");
      if (!r.ok) throw new Error(String(r.status));
      const doc: Doc = await r.json();
      if (edits.current !== saved.current) return; // our pending edit saves first
      if (first || doc.rev !== rev.current) {
        rev.current = doc.rev;
        setData(doc.data);
      }
      setSync("saved");
    } catch {
      if (!first) return;
      let backup: HQData | null = null;
      try {
        backup = JSON.parse(localStorage.getItem("hq-backup") ?? "null");
      } catch {}
      setData(backup ?? seed());
      setSync("offline");
    }
  }, []);

  const update: Update = useCallback((fn) => {
    edits.current++;
    setData((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      fn(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!data || edits.current === saved.current) return;
    try {
      localStorage.setItem("hq-backup", JSON.stringify(data));
    } catch {}
    setSync("saving");
    const mine = edits.current;
    const id = setTimeout(() => {
      chain.current = chain.current.then(async () => {
        try {
          const r = await fetch("/api/hq", {
            method: "PUT",
            headers: { "content-type": "application/json", "x-hq-key": readKey() },
            body: JSON.stringify({ rev: rev.current, data }),
          });
          if (r.status === 401) return setSync("locked");
          if (r.status === 409) {
            // ponytail: whole-doc saves, so the edit that lost the race is dropped. Per-record writes if two people clash often.
            const doc: Doc = await r.json();
            rev.current = doc.rev;
            saved.current = edits.current;
            setData(doc.data);
            return setSync("conflict");
          }
          if (!r.ok) throw new Error(String(r.status));
          rev.current = (await r.json()).rev;
          saved.current = Math.max(saved.current, mine);
          if (saved.current === edits.current) setSync("saved");
        } catch {
          setSync("offline"); // stays in hq-backup; the next edit retries
        }
      });
    }, 600);
    return () => clearTimeout(id);
  }, [data]);

  useEffect(() => {
    pull(true);
    const id = setInterval(() => document.visibilityState === "visible" && pull(), 15_000);
    const focus = () => pull();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", focus);
    };
  }, [pull]);

  useEffect(() => {
    if (sync !== "conflict") return;
    const id = setTimeout(() => setSync("saved"), 4000);
    return () => clearTimeout(id);
  }, [sync]);

  const unlock = (key: string) => {
    try {
      localStorage.setItem("hq-key", key);
    } catch {}
    setSync("loading");
    pull(true);
  };

  return { data, sync, update, unlock };
}

export default function HQ() {
  const { data, sync, update, unlock } = useHQ();
  if (sync === "locked") return <Gate onKey={unlock} />;
  if (!data) return <Boot />;
  const s = summary(data);
  return (
    <>
      <Backdrop />
      <Nav sync={sync} />
      <main className="relative">
        <Hero data={data} s={s} />
        <Camps data={data} s={s} update={update} />
        <Hedges data={data} update={update} />
        <Daily data={data} update={update} />
      </main>
      <footer className="relative px-4 pb-10 md:px-10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/35">
          <span>{TEAM.join(" · ")}</span>
          <Clock withSeconds={false} />
        </div>
      </footer>
    </>
  );
}

/* ───────────────────────────── shell ───────────────────────────── */

function Boot() {
  return (
    <main className="grid min-h-[100dvh] place-items-center">
      <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-bone/50">
        <span className="size-1.5 animate-pulse rounded-full bg-hivis" />
        Opening HQ
      </p>
    </main>
  );
}

function Gate({ onKey }: { onKey: (k: string) => void }) {
  const [key, setKey] = useState("");
  const [wrong] = useState(() => readKey() !== "");
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1, ease: EASE }}
        className="w-full max-w-sm"
      >
        <Bezel inner="p-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onKey(key);
            }}
          >
            <Eyebrow>Team only</Eyebrow>
            <h1 className="mt-6 text-3xl font-medium tracking-[-0.04em]">
              Enter the <span className="font-serif font-normal italic">HQ key.</span>
            </h1>
            {wrong && <p className="mt-3 text-sm text-hivis">That key didn&apos;t match. Try again.</p>}
            <div className="mt-8 flex items-center gap-2 rounded-full bg-white/[0.05] py-1 pl-4 pr-1 ring-1 ring-white/10 focus-within:ring-hivis/50">
              <LockSimple size={16} weight="light" className="text-bone/40" />
              <input
                type="password"
                autoFocus
                aria-label="HQ key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-hivis px-4 py-2 text-sm font-medium text-coal transition-transform duration-300 ease-vera active:scale-95"
              >
                Unlock
              </button>
            </div>
          </form>
        </Bezel>
      </motion.div>
    </main>
  );
}

/** Blueprint grid plus a slow hi-vis glow that trails the cursor. Fixed, never on a scrolling layer. */
function Backdrop() {
  const x = useSpring(-1000, { stiffness: 45, damping: 20 });
  const y = useSpring(-1000, { stiffness: 45, damping: 20 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="blueprint absolute inset-0 [mask-image:radial-gradient(80%_60%_at_50%_40%,#000,transparent)]" />
      <motion.div
        style={{ x, y }}
        className="absolute -left-[400px] -top-[400px] size-[800px] rounded-full bg-[radial-gradient(circle,rgba(255,91,31,0.08),transparent_62%)]"
      />
    </div>
  );
}

const LINKS = [
  ["Summit", "#top"],
  ["Camps", "#camps"],
  ["Hedges", "#hedges"],
  ["Daily", "#daily"],
] as const;

const SYNC: Record<Sync, [string, string]> = {
  loading: ["Loading", "bg-bone/40"],
  locked: ["Locked", "bg-bone/40"],
  saved: ["Synced", "bg-emerald-400"],
  saving: ["Saving", "animate-pulse bg-hivis"],
  offline: ["Offline · kept on this device", "bg-amber-300"],
  conflict: ["Teammate saved first · reloaded", "bg-sky-300"],
};

function Nav({ sync }: { sync: Sync }) {
  const [label, dot] = SYNC[sync];
  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1, delay: 0.3, ease: EASE }}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-5"
    >
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full bg-ink/55 py-1.5 pl-5 pr-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/10 backdrop-blur-xl">
        <a href="#top" className="mr-2 text-[13px] font-semibold tracking-[0.3em]">
          HQ
        </a>
        {LINKS.map(([l, h]) => (
          <a
            key={h}
            href={h}
            className="hidden rounded-full px-3 py-1.5 text-[13px] text-bone/55 transition-colors duration-300 ease-vera hover:bg-white/[0.06] hover:text-bone sm:block"
          >
            {l}
          </a>
        ))}
        <span
          aria-live="polite"
          className="ml-1 flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone/60"
        >
          <span className={`size-1.5 rounded-full ${dot}`} />
          {label}
        </span>
      </nav>
    </motion.header>
  );
}

/* ───────────────────────────── primitives ───────────────────────────── */

const FIELD =
  "min-w-0 rounded-lg bg-transparent outline-none transition-[background-color,box-shadow] duration-300 ease-vera placeholder:text-bone/25 hover:bg-white/[0.04] focus:bg-white/[0.06] focus:shadow-[0_0_0_1px_rgba(255,91,31,0.45)]";

type FieldProps = { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; label?: string };

/** Looks like copy, edits in place. Every edit autosaves for the team. */
function Text({ value, onChange, className = "", placeholder, label }: FieldProps) {
  return (
    <input
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={`-mx-1.5 w-[calc(100%+0.75rem)] px-1.5 ${FIELD} ${className}`}
    />
  );
}

function Area({ value, onChange, className = "", placeholder, label }: FieldProps) {
  return (
    <textarea
      rows={1}
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`-mx-1.5 block w-[calc(100%+0.75rem)] resize-none px-1.5 [field-sizing:content] ${FIELD} ${className}`}
    />
  );
}

/** Shows ₹1.8 L; on focus takes "2.5L", "80k", "1.2cr" or plain rupees. */
function Money({ value, onChange, className = "", label }: { value: number; onChange: (n: number) => void; className?: string; label?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      title="Type 2.5L, 80k, 1.2cr or plain rupees"
      inputMode="decimal"
      value={draft ?? formatINR(value).replace(".0 ", " ")}
      onFocus={(e) => {
        setDraft(String(value));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = parseINR(draft ?? "");
        if (!Number.isNaN(n)) onChange(n);
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={`-mx-1.5 max-w-full px-1.5 tabular-nums [field-sizing:content] ${FIELD} ${className}`}
    />
  );
}

function DateIn({ value, onChange, className = "", label }: FieldProps) {
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className={`px-1 tabular-nums [color-scheme:dark] ${FIELD} ${className}`}
    />
  );
}

function Who({ value, onChange, label = "Owner" }: FieldProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-bone/70 outline-none ring-1 ring-white/10 transition-colors duration-300 ease-vera hover:bg-white/10 focus-visible:ring-hivis/60"
    >
      {TEAM.map((p) => (
        <option key={p} value={p} className="bg-ink-2">
          {p}
        </option>
      ))}
    </select>
  );
}

function Btn({ label, onClick, children, disabled, className = "" }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-bone/45 transition-[color,background-color,transform,opacity] duration-300 ease-vera hover:bg-white/[0.08] hover:text-bone active:scale-90 disabled:pointer-events-none disabled:opacity-20 ${className}`}
    >
      {children}
    </button>
  );
}

/** Pill with its icon nested in its own circle. */
function Action({ onClick, children, icon = <Plus size={14} weight="light" /> }: { onClick: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="group inline-flex items-center gap-2.5 rounded-full bg-white/[0.06] py-1 pl-4 pr-1 text-[13px] text-bone ring-1 ring-white/12 transition-colors duration-500 ease-vera hover:bg-white/10"
    >
      <span>{children}</span>
      <span className="flex size-7 items-center justify-center rounded-full bg-white/10 transition-transform duration-500 ease-vera group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
        {icon}
      </span>
    </motion.button>
  );
}

function Meta({ k, children, className = "" }: { k: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-bone/35">{k}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Meter({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-1 overflow-hidden rounded-full bg-white/[0.07] ${className}`}
    >
      <motion.div
        className="h-full origin-left rounded-full bg-hivis"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: value }}
        transition={{ duration: 1.4, ease: EASE }}
      />
    </div>
  );
}

/** Tweens to each new value, so a deal moving to Won visibly ticks the number up. */
function Num({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  useEffect(() => {
    const c = animate(from.current, value, {
      duration: 1.8,
      delay: from.current ? 0 : 0.6,
      ease: EASE,
      onUpdate: (v) => {
        from.current = v;
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => c.stop();
  }, [value, format]);
  return (
    <span ref={ref} className="tabular-nums">
      {format(0)}
    </span>
  );
}

const H2 = "mt-6 text-[clamp(2.6rem,6vw,5.5rem)] font-medium leading-[0.95] tracking-[-0.05em]";
const MONO = "font-mono text-[10px] uppercase tracking-[0.18em] text-bone/40";
const SCROLL = "[scrollbar-color:rgba(244,241,236,0.14)_transparent] [scrollbar-width:thin]";

/* ───────────────────────────── hero ───────────────────────────── */

function Hero({ data, s }: { data: HQData; s: Summary }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const labels = useRef<(HTMLElement | null)[]>([]);
  const camps = s.camps.map((c) => ({
    frac: Math.min(1, c.target / Math.max(1, data.goal.target)),
    cleared: c.status === "cleared",
    active: c.status === "now",
  }));
  const tags = [
    // A camp that sits on the summit shares its tag with the summit.
    ...s.camps.map((c, i) => (c.target >= data.goal.target ? "" : `Camp ${pad(i + 1)} · ${lakh(c.target)}`)),
    `Summit · ${fmtDay(data.goal.deadline, { month: "short", year: "numeric" })}`,
    `You · ${lakh(s.got)}`,
  ];
  const cur = s.current;
  const deals = data.hedges.reduce((n, h) => n + h.deals.filter((d) => d.stage < h.stages.length - 1).length, 0);
  const kpis: [string, string, string][] = [
    ["On plan today", lakh(s.plan), "where the camp line says we'd be"],
    [s.gap >= 0 ? "Ahead of plan" : "Behind plan", lakh(Math.abs(s.gap)), s.gap >= 0 ? "keep the lead" : "to catch up"],
    ["Needed / month", lakh(s.perMonth), `${s.daysLeft} days left`],
    ["Open pipeline", lakh(s.open), `${deals} deals in play`],
  ];

  return (
    <section ref={ref} id="top" className="relative isolate min-h-[100dvh] overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <HQScene level={s.level} camps={camps} scroll={scrollYProgress} active={inView} labels={labels} />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_100%,var(--color-ink)_22%,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {tags.map((t, i) => (
          <div
            key={i}
            ref={(el) => {
              labels.current[i] = el;
            }}
            className="absolute left-0 top-0 opacity-0 will-change-transform"
          >
            <span
              hidden={!t}
              className={`block -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ring-1 ${
                i === tags.length - 1 ? "bg-hivis text-coal ring-hivis" : "bg-ink/75 text-bone/80 ring-white/10"
              }`}
            >
              {t}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-auto flex min-h-[100dvh] max-w-[1400px] flex-col justify-end px-4 pb-12 pt-[50svh] md:px-10 md:pb-16 md:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 40, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.3, delay: 0.5, ease: EASE }}
        >
          <Eyebrow>
            {data.goal.title} · {s.daysLeft} days to summit
          </Eyebrow>
          <h1 className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span className="text-[clamp(4.5rem,15vw,13rem)] font-medium leading-[0.82] tracking-[-0.065em]">
              <Num value={s.got} format={lakh} />
            </span>
            <span className="font-serif text-[clamp(1.8rem,4.6vw,4.2rem)] italic leading-none tracking-[-0.02em] text-bone/45">
              of {lakh(data.goal.target)} by {fmtDay(data.goal.deadline, { month: "long", year: "numeric" })}
            </span>
          </h1>
          <p className="mt-7 max-w-[56ch] text-base leading-relaxed text-bone/60 md:text-lg">
            <span className="text-bone">{pct(s.level)} of the climb.</span>{" "}
            {cur && cur.status !== "cleared"
              ? `Camp ${pad(s.camps.indexOf(cur) + 1)}, ${cur.name}, closes ${fmtDay(cur.end)} and is ${lakh(cur.target - s.got)} away.`
              : "Every camp cleared."}
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-2 gap-2 md:max-w-[940px] md:grid-cols-4">
          {kpis.map(([k, v, note], i) => (
            <motion.div
              key={k}
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, delay: 0.9 + i * 0.08, ease: EASE }}
              className="rounded-[1.4rem] bg-white/[0.035] p-1 ring-1 ring-white/10"
            >
              <div className="h-full rounded-[calc(1.4rem-0.25rem)] bg-ink/80 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className={MONO}>{k}</p>
                <p className="mt-2 text-xl font-medium tracking-[-0.03em] tabular-nums md:text-2xl">{v}</p>
                <p className="mt-1 text-[11px] text-bone/40">{note}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <p className="mt-8 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-bone/35 md:block">
          Move the cursor to light the map · scroll to climb
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────────── camps ───────────────────────────── */

const STATUS: Record<CampStatus, [string, string]> = {
  cleared: ["Cleared", "text-hivis"],
  now: ["You are here", "text-bone"],
  missed: ["Missed", "text-bone/70"],
  ahead: ["Up ahead", "text-bone/40"],
};

function Camps({ data, s, update }: { data: HQData; s: Summary; update: Update }) {
  const phase = (id: string, fn: (p: Phase) => void) =>
    update((d) => {
      const p = d.phases.find((x) => x.id === id);
      if (p) fn(p);
    });
  const add = () =>
    update((d) => {
      const last = s.camps.at(-1);
      d.phases.push({ id: uid(), name: "New camp", end: last ? addDays(last.end, 30) : d.goal.deadline, target: last?.target ?? d.goal.target, focus: "" });
    });

  return (
    <section id="camps" className="px-4 py-24 md:px-10 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Eyebrow>The climb</Eyebrow>
            <Words text="Camps on the way to *the summit.*" className={H2} />
            <p className="mt-6 max-w-[48ch] text-bone/55">
              Each camp is a revenue mark with a date. Click anything to edit; it saves for the whole team.
            </p>
          </div>
          <Reveal className="md:col-span-5">
            <Bezel inner="p-6 md:p-7">
              <div className="flex items-center justify-between">
                <span className={MONO}>The summit</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-hivis">{pct(s.level)} banked</span>
              </div>
              <Text
                label="Goal"
                value={data.goal.title}
                onChange={(v) => update((d) => void (d.goal.title = v))}
                className="mt-3 text-2xl font-medium tracking-[-0.03em]"
              />
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <Meta k="Target">
                  <Money value={data.goal.target} onChange={(n) => update((d) => void (d.goal.target = n))} className="text-base" />
                </Meta>
                <Meta k="Start">
                  <DateIn value={data.goal.start} onChange={(v) => update((d) => void (d.goal.start = v))} className="w-full" />
                </Meta>
                <Meta k="Summit by">
                  <DateIn value={data.goal.deadline} onChange={(v) => update((d) => void (d.goal.deadline = v))} className="w-full" />
                </Meta>
              </div>
            </Bezel>
          </Reveal>
        </div>

        <div className="mt-16 flex justify-end">
          <Action onClick={add}>Add camp</Action>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {s.camps.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.08} className="h-full">
              <Bezel
                className="h-full"
                inner={`flex h-full flex-col p-6 ${c.status === "now" ? "bg-[radial-gradient(120%_80%_at_100%_0%,rgba(255,91,31,0.14),transparent_60%)]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className={MONO}>Camp {pad(i + 1)}</span>
                  <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${STATUS[c.status][1]}`}>
                    {c.status === "cleared" && <Check size={12} weight="light" />}
                    {c.status === "missed" && <Warning size={12} weight="light" />}
                    {c.status === "now" && <span className="size-1.5 animate-pulse rounded-full bg-hivis" />}
                    {STATUS[c.status][0]}
                  </span>
                </div>
                <Text
                  label="Camp name"
                  value={c.name}
                  onChange={(v) => phase(c.id, (p) => (p.name = v))}
                  className="mt-6 text-[2rem] font-medium leading-tight tracking-[-0.045em]"
                />
                <Area
                  label="Focus"
                  value={c.focus}
                  placeholder="What has to be true at this camp?"
                  onChange={(v) => phase(c.id, (p) => (p.focus = v))}
                  className="mt-2 text-sm leading-relaxed text-bone/55"
                />
                <div className="mt-auto pt-8">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Meta k="Closes">
                      <DateIn value={c.end} onChange={(v) => phase(c.id, (p) => (p.end = v))} className="w-full" />
                    </Meta>
                    <Meta k="Revenue mark">
                      <Money value={c.target} onChange={(n) => phase(c.id, (p) => (p.target = n))} />
                    </Meta>
                  </div>
                  <Meter value={c.progress} className="mt-5" />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-bone/45 tabular-nums">
                    <span>
                      {lakh(Math.max(0, Math.min(s.got, c.target) - c.from))} of {lakh(Math.max(0, c.target - c.from))} this stretch
                    </span>
                    <Btn
                      label="Delete camp"
                      onClick={() => confirm(`Delete camp "${c.name}"?`) && update((d) => void (d.phases = d.phases.filter((p) => p.id !== c.id)))}
                    >
                      <Trash size={14} weight="light" />
                    </Btn>
                  </div>
                </div>
              </Bezel>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── hedges ───────────────────────────── */

type HedgeEdit = (id: string, fn: (h: Hedge) => void) => void;

function Hedges({ data, update }: { data: HQData; update: Update }) {
  const [sel, setSel] = useState(data.hedges[0]?.id);
  const h = data.hedges.find((x) => x.id === sel) ?? data.hedges[0];
  const hedge: HedgeEdit = (id, fn) =>
    update((d) => {
      const x = d.hedges.find((y) => y.id === id);
      if (x) fn(x);
    });
  if (!h) return null;

  return (
    <section id="hedges" className="px-4 py-24 md:px-10 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <Eyebrow>Two hedges</Eyebrow>
        <Words text="Two bets. *One summit.*" className={H2} />
        <div className="mt-16 grid gap-3 md:grid-cols-2">
          {data.hedges.map((x, i) => {
            const done = x.checkpoints.filter((c) => c.done).length;
            const on = x.id === h.id;
            return (
              <Reveal key={x.id} delay={i * 0.1} className="h-full">
                <Bezel
                  className="h-full"
                  inner={`flex h-full flex-col p-7 md:p-9 ${on ? "bg-[radial-gradient(110%_90%_at_100%_0%,rgba(255,91,31,0.13),transparent_60%)]" : ""}`}
                >
                  <div className="flex h-7 items-center justify-between">
                    <span className={MONO}>Hedge {pad(i + 1)}</span>
                    {on && (
                      <motion.span
                        layoutId="hedge-on"
                        className="inline-flex items-center gap-1.5 rounded-full bg-hivis/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-hivis"
                      >
                        <span className="size-1.5 rounded-full bg-hivis" />
                        Open below
                      </motion.span>
                    )}
                  </div>
                  <Text
                    label="Hedge name"
                    value={x.name}
                    onChange={(v) => hedge(x.id, (y) => (y.name = v))}
                    className="mt-8 text-[clamp(2.6rem,5vw,4.2rem)] font-medium leading-tight tracking-[-0.055em]"
                  />
                  <Area
                    label="Tagline"
                    value={x.tagline}
                    placeholder="One line on the bet"
                    onChange={(v) => hedge(x.id, (y) => (y.tagline = v))}
                    className="mt-2 max-w-[44ch] text-bone/55"
                  />
                  <dl className="mt-10 grid grid-cols-3 gap-4">
                    {(
                      [
                        ["Won", lakh(bankedIn(x))],
                        ["Open pipeline", lakh(openIn(x))],
                        ["Checkpoints", `${done}/${x.checkpoints.length}`],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className={MONO}>{k}</dt>
                        <dd className="mt-1.5 text-2xl font-medium tracking-[-0.03em] tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-6 flex gap-[3px]" aria-hidden>
                    {x.checkpoints.map((c, k) => (
                      <span key={c.id} className={`h-1.5 flex-1 rounded-full ${k < done ? "bg-hivis" : "bg-white/[0.08]"}`} />
                    ))}
                  </div>
                  <div className="mt-auto pt-8">
                    <Action onClick={() => setSel(x.id)} icon={<ArrowDown size={14} weight="light" />}>
                      {on ? "Checkpoints & pipeline below" : `Open ${x.name || "this hedge"}`}
                    </Action>
                  </div>
                </Bezel>
              </Reveal>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <Checkpoints h={h} hedge={hedge} />
            <Board h={h} hedge={hedge} />
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function Checkpoints({ h, hedge }: { h: Hedge; hedge: HedgeEdit }) {
  const now = today();
  const cp = (id: string, fn: (c: Checkpoint) => void) =>
    hedge(h.id, (x) => {
      const c = x.checkpoints.find((y) => y.id === id);
      if (c) fn(c);
    });
  const sorted = [...h.checkpoints].sort((a, b) => a.due.localeCompare(b.due));

  return (
    <div className="mt-20 md:mt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h3 className="text-[clamp(1.8rem,3vw,2.6rem)] font-medium tracking-[-0.04em]">
          Checkpoints <span className="font-serif font-normal italic text-bone/45">for {h.name}</span>
        </h3>
        <Action onClick={() => hedge(h.id, (x) => void x.checkpoints.push({ id: uid(), title: "", due: addDays(now, 14), done: false, owner: TEAM[0] }))}>
          Add checkpoint
        </Action>
      </div>
      <div className={`-mx-4 mt-8 overflow-x-auto px-4 pb-4 md:-mx-10 md:px-10 ${SCROLL}`}>
        <div className="relative flex w-max gap-3">
          <div aria-hidden className="absolute inset-x-0 top-[13px] h-px bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
          {sorted.map((c) => {
            const late = !c.done && c.due < now;
            return (
              <motion.div layout key={c.id} transition={{ type: "spring", stiffness: 300, damping: 32 }} className="relative w-[272px] shrink-0">
                <button
                  type="button"
                  aria-pressed={c.done}
                  aria-label={c.done ? "Mark not done" : "Mark done"}
                  onClick={() => cp(c.id, (x) => (x.done = !x.done))}
                  className={`flex size-[27px] items-center justify-center rounded-full ring-1 transition-colors duration-500 ease-vera ${
                    c.done ? "bg-hivis text-coal ring-hivis" : "bg-ink-2 text-transparent ring-white/20 hover:text-hivis/70 hover:ring-hivis/60"
                  }`}
                >
                  <Check size={14} />
                </button>
                <Bezel className="mt-4" inner="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <DateIn label="Due" value={c.due} onChange={(v) => cp(c.id, (x) => (x.due = v))} className="text-[12px] text-bone/60" />
                    {late && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-hivis">
                        <Warning size={12} weight="light" />
                        Overdue
                      </span>
                    )}
                    {c.done && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-hivis">Done</span>}
                  </div>
                  <Area
                    label="Checkpoint"
                    value={c.title}
                    placeholder="What does done look like?"
                    onChange={(v) => cp(c.id, (x) => (x.title = v))}
                    className={`mt-3 text-[15px] leading-snug ${c.done ? "text-bone/50" : ""}`}
                  />
                  <div className="mt-5 flex items-center justify-between">
                    <Who value={c.owner} onChange={(v) => cp(c.id, (x) => (x.owner = v))} />
                    <Btn
                      label="Delete checkpoint"
                      onClick={() => confirm("Delete this checkpoint?") && hedge(h.id, (x) => void (x.checkpoints = x.checkpoints.filter((y) => y.id !== c.id)))}
                    >
                      <Trash size={14} weight="light" />
                    </Btn>
                  </div>
                </Bezel>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Board({ h, hedge }: { h: Hedge; hedge: HedgeEdit }) {
  const [over, setOver] = useState<number | null>(null);
  const last = h.stages.length - 1;
  const deal = (id: string, fn: (d: Deal, x: Hedge) => void) =>
    hedge(h.id, (x) => {
      const d = x.deals.find((y) => y.id === id);
      if (d) fn(d, x);
    });
  const move = (id: string, stage: number) =>
    deal(id, (d, x) => {
      d.stage = Math.min(Math.max(stage, 0), x.stages.length - 1);
      d.won = d.stage === x.stages.length - 1 ? (d.won ?? today()) : undefined;
    });

  return (
    <div className="mt-20 md:mt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h3 className="text-[clamp(1.8rem,3vw,2.6rem)] font-medium tracking-[-0.04em]">
          Pipeline{" "}
          <span className="font-serif font-normal italic text-bone/45">
            {lakh(openIn(h))} open, {lakh(bankedIn(h))} won
          </span>
        </h3>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-bone/35 md:block">Drag by the grip, or use the arrows</p>
      </div>
      <LayoutGroup id={`board-${h.id}`}>
        <div className={`-mx-4 mt-8 overflow-x-auto px-4 pb-4 md:-mx-10 md:px-10 ${SCROLL}`}>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${h.stages.length}, minmax(240px, 1fr))` }}>
            {h.stages.map((st, i) => {
              const deals = h.deals.filter((d) => d.stage === i);
              const won = i === last;
              return (
                <div
                  key={i}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(i);
                  }}
                  onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    move(e.dataTransfer.getData("text/plain"), i);
                  }}
                  className={`flex flex-col rounded-[1.75rem] p-1.5 ring-1 transition-[background-color,box-shadow] duration-500 ease-vera ${
                    over === i ? "bg-hivis/[0.08] ring-hivis/50" : won ? "bg-hivis/[0.035] ring-hivis/20" : "bg-white/[0.025] ring-white/[0.08]"
                  }`}
                >
                  <div className="px-3 pb-3 pt-2.5">
                    <div className="flex items-center gap-2">
                      {won && <span className="size-1.5 shrink-0 rounded-full bg-hivis" />}
                      <Text label="Stage name" value={st} onChange={(v) => hedge(h.id, (x) => (x.stages[i] = v))} className="text-sm font-medium" />
                      <Btn
                        label={`Add deal to ${st}`}
                        onClick={() => hedge(h.id, (x) => void x.deals.push({ id: uid(), name: "", value: 0, stage: i, owner: TEAM[0], note: "", won: won ? today() : undefined }))}
                      >
                        <Plus size={14} weight="light" />
                      </Btn>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone/35 tabular-nums">
                      {deals.length} · {lakh(deals.reduce((n, d) => n + d.value, 0))}
                    </p>
                  </div>
                  <div className="flex min-h-28 flex-1 flex-col gap-1.5">
                    {deals.map((d) => (
                      <DealCard
                        key={d.id}
                        d={d}
                        won={won}
                        deal={deal}
                        move={move}
                        remove={() => confirm(`Delete "${d.name || "this deal"}"?`) && hedge(h.id, (x) => void (x.deals = x.deals.filter((y) => y.id !== d.id)))}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}

function DealCard({
  d,
  won,
  deal,
  move,
  remove,
}: {
  d: Deal;
  won: boolean;
  deal: (id: string, fn: (d: Deal) => void) => void;
  move: (id: string, stage: number) => void;
  remove: () => void;
}) {
  return (
    <motion.div
      layoutId={d.id}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      data-card
      className="group rounded-[1.25rem] bg-ink-2 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/[0.06]"
    >
      <div className="flex items-start gap-1">
        <span
          draggable
          aria-hidden
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", d.id);
            e.dataTransfer.effectAllowed = "move";
            const card = e.currentTarget.closest("[data-card]");
            if (card) e.dataTransfer.setDragImage(card, 24, 24);
          }}
          className="-ml-1 mt-0.5 cursor-grab text-bone/25 transition-colors duration-300 hover:text-bone/70 active:cursor-grabbing"
        >
          <DotsSixVertical size={18} weight="light" />
        </span>
        <Area
          label="Deal"
          value={d.name}
          placeholder="Who's the client?"
          onChange={(v) => deal(d.id, (x) => (x.name = v))}
          className="text-[14px] font-medium leading-snug"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Money
          label="Deal value"
          value={d.value}
          onChange={(n) => deal(d.id, (x) => (x.value = n))}
          className={`text-lg font-medium tracking-[-0.02em] ${won ? "text-hivis" : ""}`}
        />
        <Who value={d.owner} onChange={(v) => deal(d.id, (x) => (x.owner = v))} />
      </div>
      <Area
        label="Note"
        value={d.note}
        placeholder="Add a note"
        onChange={(v) => deal(d.id, (x) => (x.note = v))}
        className="mt-2 text-[12px] leading-relaxed text-bone/50"
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex">
          <Btn label="Move back a stage" disabled={d.stage === 0} onClick={() => move(d.id, d.stage - 1)}>
            <CaretLeft size={14} weight="light" />
          </Btn>
          <Btn label="Move forward a stage" disabled={won} onClick={() => move(d.id, d.stage + 1)}>
            <CaretRight size={14} weight="light" />
          </Btn>
        </div>
        {d.won && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-hivis/80">Won {fmtDay(d.won)}</span>}
        <Btn label="Delete deal" onClick={remove}>
          <Trash size={14} weight="light" />
        </Btn>
      </div>
    </motion.div>
  );
}

/* ───────────────────────────── daily log ───────────────────────────── */

function Daily({ data, update }: { data: HQData; update: Update }) {
  const now = today();
  const [day, setDay] = useState(now);
  const counts = new Map<string, number>();
  for (const t of data.todos) if (t.done) counts.set(t.date, (counts.get(t.date) ?? 0) + 1);
  const days = Array.from({ length: 42 }, (_, i) => addDays(now, i - 41));
  const max = Math.max(1, ...days.map((d) => counts.get(d) ?? 0));
  const week = doneBy(data.todos, addDays(day, -6), day);
  const weekMax = Math.max(1, ...Object.values(week));
  const rel =
    day === now ? "Today" : day === addDays(now, -1) ? "Yesterday" : day === addDays(now, 1) ? "Tomorrow" : fmtDay(day, { weekday: "long" });

  return (
    <section id="daily" className="px-4 py-24 md:px-10 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Eyebrow>The daily log</Eyebrow>
            <Words text="Who moved *what, and when.*" className={H2} />
            <p className="mt-6 max-w-[48ch] text-bone/55">
              Plan the day per person, tick it off, and it lands under Achieved. Any past day is one click back.
            </p>
          </div>
          <Reveal className="md:col-span-5">
            <Bezel inner="p-6 md:p-7">
              <p className={MONO}>Done in the 7 days to {fmtDay(day)}</p>
              <div className="mt-5 space-y-4">
                {TEAM.map((p) => (
                  <div key={p}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{p}</span>
                      <span className="tabular-nums text-bone/60">{week[p]}</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full origin-left rounded-full bg-bone/80"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: week[p] / weekMax }}
                        transition={{ duration: 1.2, ease: EASE }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Bezel>
          </Reveal>
        </div>

        <Reveal className="mt-16">
          <Bezel inner="p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1">
                <Btn label="Previous day" onClick={() => setDay(addDays(day, -1))} className="size-9">
                  <CaretLeft size={16} weight="light" />
                </Btn>
                <div className="min-w-[15ch] overflow-hidden px-2">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.p
                      key={day}
                      initial={{ y: 18, opacity: 0, filter: "blur(6px)" }}
                      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                      exit={{ y: -18, opacity: 0, filter: "blur(6px)" }}
                      transition={{ duration: 0.5, ease: EASE }}
                      className="flex items-baseline gap-3 whitespace-nowrap"
                    >
                      <span className="font-serif text-3xl italic tracking-[-0.02em] md:text-4xl">{rel}</span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone/45">
                        {fmtDay(day, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </motion.p>
                  </AnimatePresence>
                </div>
                <Btn label="Next day" onClick={() => setDay(addDays(day, 1))} className="size-9">
                  <CaretRight size={16} weight="light" />
                </Btn>
              </div>
              <div className="flex items-center gap-2">
                {day !== now && (
                  <Action onClick={() => setDay(now)} icon={<ArrowUUpLeft size={14} weight="light" />}>
                    Today
                  </Action>
                )}
                <DateIn label="Jump to a date" value={day} onChange={setDay} className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] ring-1 ring-white/10" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-[repeat(21,minmax(0,1fr))] gap-[3px] md:grid-cols-[repeat(42,minmax(0,1fr))]">
              {days.map((d, i) => {
                const n = counts.get(d) ?? 0;
                const label = `${fmtDay(d, { weekday: "short", day: "numeric", month: "short" })} · ${n} done`;
                return (
                  <button
                    key={d}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-current={d === day ? "date" : undefined}
                    onClick={() => setDay(d)}
                    style={{ backgroundColor: n ? `rgba(255,91,31,${0.2 + 0.8 * (n / max)})` : "rgba(244,241,236,0.05)" }}
                    className={`h-9 rounded-[5px] transition-transform duration-300 ease-vera hover:-translate-y-0.5 md:h-11 ${
                      d === day ? "ring-1 ring-bone ring-offset-2 ring-offset-ink-2" : ""
                    } ${i < 21 ? "max-md:hidden" : ""}`}
                  />
                );
              })}
            </div>
            <div className="mt-2.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-bone/35">
              <span className="max-md:hidden">{fmtDay(days[0])}</span>
              <span className="md:hidden">{fmtDay(days[21])}</span>
              <span>Tasks done per day</span>
              <span>Today</span>
            </div>
          </Bezel>
        </Reveal>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {TEAM.map((p, i) => (
            <Person key={p} who={p} day={day} now={now} todos={data.todos} update={update} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Person({ who, day, now, todos, update, i }: { who: string; day: string; now: string; todos: Todo[]; update: Update; i: number }) {
  const [draft, setDraft] = useState("");
  const mine = todos.filter((t) => t.date === day && t.who === who);
  const open = mine.filter((t) => !t.done);
  const done = mine.filter((t) => t.done);
  const todo = (id: string, fn: (t: Todo) => void) =>
    update((d) => {
      const t = d.todos.find((x) => x.id === id);
      if (t) fn(t);
    });
  const remove = (id: string) => update((d) => void (d.todos = d.todos.filter((x) => x.id !== id)));
  const row = (t: Todo) => <TodoRow key={t.id} t={t} todo={todo} remove={() => remove(t.id)} />;

  return (
    <Reveal delay={i * 0.08} className="h-full">
      <Bezel className="h-full" inner="flex h-full flex-col p-6 md:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-sm font-medium ring-1 ring-white/10">
            {who
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium tracking-[-0.02em]">{who}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone/40 tabular-nums">
              {done.length}/{mine.length} done
            </p>
          </div>
        </div>
        <LayoutGroup id={`todos-${who}`}>
          <ul className="mt-6 space-y-0.5">{open.map(row)}</ul>
          {!mine.length && (
            <p className="mt-6 text-sm text-bone/35">
              {day < now ? "Nothing logged this day." : day > now ? "Nothing planned yet." : "Nothing yet. Add the first task."}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const text = draft.trim();
              if (!text) return;
              update((d) => void d.todos.push({ id: uid(), date: day, who, text, done: false }));
              setDraft("");
            }}
            className="mt-4 flex items-center gap-2 rounded-full bg-white/[0.04] py-1 pl-4 pr-1 ring-1 ring-white/[0.08] transition-shadow duration-300 focus-within:ring-hivis/40"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Add for ${who.split(" ")[0]}…`}
              aria-label={`Add a task for ${who}`}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-bone/30"
            />
            <button
              type="submit"
              aria-label="Add task"
              className="flex size-7 items-center justify-center rounded-full bg-white/10 transition-transform duration-300 ease-vera hover:scale-105 active:scale-95"
            >
              <Plus size={14} weight="light" />
            </button>
          </form>
          {done.length > 0 && (
            <>
              <p className="mt-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-hivis">
                <span className="size-1.5 rounded-full bg-hivis" />
                Achieved · {done.length}
              </p>
              <ul className="mt-3 space-y-0.5">{done.map(row)}</ul>
            </>
          )}
        </LayoutGroup>
      </Bezel>
    </Reveal>
  );
}

function TodoRow({ t, todo, remove }: { t: Todo; todo: (id: string, fn: (t: Todo) => void) => void; remove: () => void }) {
  return (
    <motion.li layoutId={t.id} transition={{ type: "spring", stiffness: 420, damping: 36 }} className="group flex items-start gap-2.5 py-1">
      <button
        type="button"
        aria-pressed={t.done}
        aria-label={t.done ? "Mark not done" : "Mark done"}
        onClick={() => todo(t.id, (x) => (x.done = !x.done))}
        className={`mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-300 ease-vera ${
          t.done ? "bg-hivis text-coal ring-hivis" : "text-transparent ring-white/25 hover:text-bone/40 hover:ring-bone/50"
        }`}
      >
        <Check size={11} />
      </button>
      <Area label="Task" value={t.text} onChange={(v) => todo(t.id, (x) => (x.text = v))} className={`text-sm leading-relaxed ${t.done ? "text-bone/60" : ""}`} />
      <Btn label="Delete task" onClick={remove} className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-60">
        <X size={13} weight="light" />
      </Btn>
    </motion.li>
  );
}
