"use client";

import {
  ArrowDown,
  CheckCircle,
  Files,
  Microphone,
  Receipt,
  Scan,
  SunHorizon,
  TrendUp,
  WarningDiamond,
} from "@phosphor-icons/react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { SCREENS, STEPS, labels, stage, stepAt } from "./siteWalk";
import { Clock, EASE, INTRO, PillButton, Words, formatINR, useTheme } from "./ui";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

const FOUND = [
  ["Cement OPC 53", "Site 03", 62.4],
  ["Fe500 TMT steel", "Site 01", 48.1],
  ["RMC over-issue", "Site 02", 33.9],
  ["Shuttering ply", "Site 04", 21.7],
  ["Surplus stock to move", "All sites", 17.9],
] as const;
const FOUND_TOTAL = 1.84e7;

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

/**
 * The hero, then a pinned site walk: scrolling brings the building to centre stage and
 * the camera visits six spots on site, one per thing Vera does.
 */
export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref);
  const theme = useTheme();
  const { scrollYProgress: progress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const scan = useMotionValue(0);
  const ctrl = useRef<AnimationPlaybackControls | null>(null);
  const [state, setState] = useState<"idle" | "scanning" | "done">("idle");
  const found = useTransform(scan, (v) => formatINR(v * FOUND_TOTAL));

  // Hero copy leaves over the first half of the intro screen; the walk UI arrives as it ends.
  const heroO = useTransform(progress, [0, 0.07], [1, 0]);
  const heroY = useTransform(progress, [0, 0.07], [0, -48]);
  const heroPE = useTransform(progress, (p) => (p > 0.03 ? "none" : "auto"));
  const vignetteO = useTransform(progress, [0, 0.12], [1, 0]);

  const start = () => {
    if (state === "done") {
      setState("idle");
      ctrl.current = animate(scan, 0, { duration: 0.9, ease: EASE });
      return;
    }
    setState("scanning");
    ctrl.current?.stop();
    ctrl.current = animate(scan, 1, {
      duration: 2.4 * (1 - scan.get()),
      ease: [0.45, 0, 0.55, 1],
      onComplete: () => setState("done"),
    });
  };
  const stop = () => {
    if (scan.get() >= 1 || state !== "scanning") return;
    setState("idle");
    ctrl.current?.stop();
    ctrl.current = animate(scan, 0, { duration: 0.7, ease: EASE });
  };

  return (
    <section ref={ref} id="top" className="relative bg-ink" style={{ height: `${(SCREENS + 1) * 100}vh` }}>
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        <div className="absolute inset-0">
          <HeroScene scan={scan} progress={progress} active={inView} theme={theme} />
        </div>
        <motion.div style={{ opacity: vignetteO }} className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_42%,transparent_25%,var(--ink)_88%)]" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink via-ink/75 to-transparent md:h-1/2" />
        </motion.div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_45%,color-mix(in_oklab,var(--ink)_70%,transparent)_100%)]" />
        <motion.div
          style={{ opacity: scan }}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_66%_50%,rgba(255,91,31,0.22),transparent_55%)]"
        />

        <Labels />

        <motion.div style={{ opacity: heroO, y: heroY, pointerEvents: heroPE }} className="absolute inset-0">
          <div className="relative mx-auto flex h-full max-w-[1440px] flex-col justify-end px-4 pb-8 pt-32 md:px-10 md:pb-20">
            <div className="grid items-end gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: INTRO, duration: 1, ease: EASE }}
                  className="mb-7 hidden items-center gap-2.5 rounded-full bg-white/[0.05] sm:inline-flex py-1 pl-1 pr-3 ring-1 ring-white/10"
                >
                  <span className="rounded-full bg-hivis px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-coal">
                    New
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-bone/70">
                    AI infrastructure <span className="hidden sm:inline">for Indian construction</span>
                  </span>
                </motion.div>

                <Words
                  as="h1"
                  immediate
                  delay={INTRO - 0.1}
                  text="Every rupee on site, | *accounted for.*"
                  className="text-[clamp(2.6rem,4.6vw,5.25rem)] font-medium leading-[0.95] tracking-[-0.05em]"
                />

                <motion.p
                  initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: INTRO + 0.6, duration: 1.1, ease: EASE }}
                  className="mt-5 max-w-[40ch] text-[15px] leading-relaxed text-bone/60 sm:mt-6 sm:text-base"
                >
                  Supervisors send WhatsApp voice notes. Vera turns them into the site record, and finds the material
                  walking off.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: INTRO + 0.8, duration: 1, ease: EASE }}
                  className="mt-8 flex flex-wrap items-center gap-3"
                >
                  <PillButton href="#book">Get a free leak check</PillButton>
                  <PillButton href="#process" variant="ghost" className="max-sm:hidden">
                    See how it works
                  </PillButton>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: INTRO + 1, duration: 1, ease: EASE }}
                className="relative flex flex-col items-start gap-3 lg:col-span-6 lg:items-end"
              >
                <AnimatePresence>
                  {state === "done" && (
                    <motion.div
                      initial={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                      transition={{ duration: 0.8, ease: EASE }}
                      className="w-full max-w-[360px] rounded-[1.5rem] bg-white/[0.04] p-1 ring-1 ring-hivis/30 lg:w-[360px]"
                    >
                      <div className="rounded-[calc(1.5rem-0.25rem)] bg-ink-2/95 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
                          <span>Scan complete</span>
                          <span>4 sites · 3 months</span>
                        </div>
                        <ul className="mt-4 space-y-2.5 text-[13px]">
                          {FOUND.map(([item, site, lakh], i) => (
                            <motion.li
                              key={item}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 + i * 0.07, duration: 0.6, ease: EASE }}
                              className="flex items-baseline justify-between gap-4 border-b border-white/[0.06] pb-2.5"
                            >
                              <span className="text-bone/80">
                                {item} <span className="text-bone/35">· {site}</span>
                              </span>
                              <span className="font-mono tabular-nums">₹{lakh} L</span>
                            </motion.li>
                          ))}
                        </ul>
                        <p className="mt-3 text-[11px] leading-relaxed text-bone/40">
                          Illustrative scan. Your free leak check gives your real number in a week.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  data-cursor="Hold"
                  aria-label={state === "done" ? "Reset the site scan" : "Hold to scan the site for leaks"}
                  onPointerDown={start}
                  onPointerUp={stop}
                  onPointerLeave={stop}
                  onPointerCancel={stop}
                  onContextMenu={(e) => e.preventDefault()}
                  onKeyDown={(e) => {
                    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                      e.preventDefault();
                      start();
                    }
                  }}
                  onKeyUp={(e) => (e.key === " " || e.key === "Enter") && stop()}
                  className="group flex touch-none select-none items-center gap-4 rounded-full bg-ink/70 py-1.5 pl-1.5 pr-6 ring-1 ring-white/10 transition-transform duration-500 ease-vera active:scale-[0.98]"
                >
                  <span className="relative size-14 shrink-0">
                    <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
                      <circle cx="28" cy="28" r="26" fill="none" className="stroke-bone/15" strokeWidth="1.5" />
                      <motion.circle
                        cx="28"
                        cy="28"
                        r="26"
                        fill="none"
                        stroke="#FF5B1F"
                        strokeWidth="2"
                        strokeLinecap="round"
                        style={{ pathLength: scan }}
                      />
                    </svg>
                    <span className="absolute inset-[7px] flex items-center justify-center rounded-full bg-white/[0.06] transition-transform duration-500 ease-vera group-hover:scale-105">
                      <Scan size={20} weight="light" className={state === "scanning" ? "text-hivis" : ""} />
                    </span>
                    {state === "idle" && (
                      <span className="absolute inset-0 animate-ping rounded-full ring-1 ring-hivis/40 [animation-duration:2.4s]" />
                    )}
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-medium">
                      {state === "done" ? "Leaks found · tap to reset" : state === "scanning" ? "Scanning floors…" : "Hold to scan the site"}
                    </span>
                    <span className="block font-mono text-[11px] text-bone/50">
                      <motion.span className="text-hivis">{found}</motion.span> leaking / quarter
                    </span>
                  </span>
                </button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: INTRO + 1.2, duration: 1.2 }}
              className="mt-8 flex flex-wrap items-center justify-between md:mt-10 gap-x-8 gap-y-2 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/40 md:text-[11px]"
            >
              <span className="hidden md:inline">For contractors doing ₹50–500 Cr a year</span>
              <span className="flex items-center gap-2 text-bone/60">
                <ArrowDown size={12} weight="light" className="animate-bounce [animation-duration:2s]" /> Scroll the site
              </span>
              <span className="text-bone/60">
                Pune · <Clock />
              </span>
            </motion.div>
          </div>
        </motion.div>

        <Walk progress={progress} />
      </div>
    </section>
  );
}

// ─── The walk ────────────────────────────────────────────────────────────────

function Walk({ progress }: { progress: MotionValue<number> }) {
  const [step, setStep] = useState(-1);
  useMotionValueEvent(progress, "change", (p) => setStep(stepAt(p)));
  const o = useTransform(progress, [0.1, 0.15], [0, 1]);
  const y = useTransform(progress, [0.1, 0.15], [24, 0]);
  const pe = useTransform(progress, (p) => (p > 0.1 ? "auto" : "none"));
  const k = Math.max(step, 0);
  const s = STEPS[k];

  return (
    <motion.div style={{ opacity: o, pointerEvents: pe }} className="absolute inset-0">
      <motion.div
        style={{ y }}
        className="absolute inset-x-3 bottom-3 rounded-[1.75rem] bg-white/[0.04] p-1.5 ring-1 ring-white/10 md:inset-x-auto md:bottom-10 md:left-10 md:w-[430px]"
      >
        <div className="rounded-[calc(1.75rem-0.375rem)] bg-ink-2/[0.94] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] md:p-7">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-bone/45">
            <span className="flex items-center gap-2">
              <span className="text-hivis">{String(k + 1).padStart(2, "0")}</span>
              <span>/ {String(STEPS.length).padStart(2, "0")}</span>
            </span>
            <a
              href="#leak"
              className="flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 ring-1 ring-white/10 transition-colors duration-500 ease-vera hover:text-bone"
            >
              Skip the walk <ArrowDown size={11} weight="light" />
            </a>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={k}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: EASE }}
              className="mt-4 min-h-[9.5rem] md:mt-5 md:min-h-[11rem]"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-hivis">{s.tag}</p>
              <h2 className="mt-2 text-[1.6rem] font-medium leading-[1.02] tracking-[-0.035em] md:text-[2.1rem]">{s.title}</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-bone/60 md:text-sm">{s.body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-4 flex gap-1.5">
            {STEPS.map((_, j) => (
              <Seg key={j} k={j} progress={progress} />
            ))}
          </div>
        </div>
      </motion.div>

      <ol className="absolute right-10 top-1/2 hidden -translate-y-1/2 space-y-3.5 xl:block">
        {STEPS.map((x, j) => (
          <li
            key={x.tag}
            className={`flex items-center justify-end gap-3 text-right text-[11px] uppercase tracking-[0.18em] transition-colors duration-700 ease-vera ${
              j === k ? "text-bone" : "text-bone/30"
            }`}
          >
            {x.tag}
            <span className="font-mono text-[10px]">{String(j + 1).padStart(2, "0")}</span>
            <span
              className={`h-px origin-right bg-hivis transition-transform duration-700 ease-vera ${j === k ? "w-6 scale-x-100" : "w-6 scale-x-0"}`}
            />
          </li>
        ))}
      </ol>
    </motion.div>
  );
}

function Seg({ k, progress }: { k: number; progress: MotionValue<number> }) {
  const scaleX = useTransform(progress, (p) => clamp01(stage(p).c - k));
  return (
    <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-bone/10">
      <motion.span style={{ scaleX }} className="absolute inset-0 origin-left rounded-full bg-hivis" />
    </span>
  );
}

// ─── Labels pinned to the site (positioned every frame by the scene) ───────────

const LABEL_ICON = [Files, Microphone, WarningDiamond, SunHorizon, Receipt, TrendUp];

function Labels() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {STEPS.map((s, k) => {
        const Icon = LABEL_ICON[k];
        return (
          <div key={s.tag}>
            <div
              ref={(el) => void (labels[k].dot = el)}
              style={{ opacity: 0 }}
              className="absolute left-0 top-0 will-change-transform"
            >
              <span className="absolute bottom-0 left-0 h-10 w-px -translate-x-1/2 bg-gradient-to-t from-hivis to-transparent" />
              <span className="absolute left-0 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hivis shadow-[0_0_0_4px_rgba(255,91,31,0.2)]" />
              <span className="absolute left-0 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-hivis/60" />
            </div>
            <div
              ref={(el) => void (labels[k].card = el)}
              style={{ opacity: 0 }}
              className="absolute left-0 top-0 will-change-transform"
            >
              <div className="w-[236px] -translate-x-1/2 -translate-y-full rounded-[1.25rem] bg-white/[0.05] p-1 ring-1 ring-white/10 md:w-[276px]">
                <div className="rounded-[calc(1.25rem-0.25rem)] bg-ink-2/[0.96] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_48px_-24px_rgba(20,14,8,0.5)] md:p-4">
                  <div className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-bone/45">
                    <span className="flex size-6 items-center justify-center rounded-full bg-hivis/15 text-hivis">
                      <Icon size={13} weight="light" />
                    </span>
                    {s.tag}
                  </div>
                  <div className="mt-3">{LABEL_BODY[k]}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ k, v, hot }: { k: ReactNode; v: ReactNode; hot?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-1.5 text-[12px] last:border-0">
      <span className="text-bone/65">{k}</span>
      <span className={`font-mono tabular-nums ${hot ? "text-hivis" : "text-bone/90"}`}>{v}</span>
    </div>
  );
}

const Tick = () => <CheckCircle size={12} weight="light" className="mr-1.5 inline text-hivis" />;

const WEEKS = [62, 66, 64, 70, 72, 69, 74, 38, 58, 71, 76, 79, 83];

const LABEL_BODY: ReactNode[] = [
  <div key="read">
    <Row k={<><Tick />Purchase orders</>} v="312" />
    <Row k={<><Tick />Challans</>} v="1,284" />
    <Row k={<><Tick />Issue slips</>} v="2,046" />
    <Row k={<><Tick />BOQ lines</>} v="418" />
  </div>,
  <div key="voice">
    <div className="flex h-5 items-center gap-[3px]">
      {Array.from({ length: 30 }, (_, i) => (
        <span
          key={i}
          className="w-[2px] animate-pulse rounded-full bg-bone/50"
          style={{ height: `${28 + ((i * 37) % 72)}%`, animationDelay: `${(i % 7) * 0.12}s` }}
        />
      ))}
      <span className="ml-2 font-mono text-[10px] text-bone/40">0:42</span>
    </div>
    <p className="mt-2.5 font-deva text-[13px] leading-snug text-bone/85">चौथी मंज़िल का स्लैब आज पूरा हुआ</p>
    <p className="mt-1.5 text-[12px] text-bone/50">→ Slab · 4th floor · 100% · 42 labour</p>
  </div>,
  <div key="leak">
    <p className="text-[12px] font-medium text-bone/85">Cement OPC 53 · Site 03</p>
    <div className="mt-1.5">
      <Row k="Ordered" v="500 bags" />
      <Row k="Used per BOQ" v="441 bags" />
      <Row k="Unmatched" v="59 bags" hot />
    </div>
    <p className="mt-2 font-mono text-lg tabular-nums text-hivis">₹23,010</p>
  </div>,
  <div key="summary">
    <p className="font-mono text-[11px] text-bone/50">08:00 · Daily summary · 4 sites</p>
    <div className="mt-1.5">
      <Row k="Supervisors reported" v="31 / 32" />
      <Row k="RA-04 unpaid" v="₹38.6 L · 74d" hot />
      <Row k="Cement short" v="Indore" />
    </div>
  </div>,
  <div key="bill">
    <p className="text-[12px] font-medium text-bone/85">RA Bill 07 · Wakad</p>
    <div className="mt-1.5">
      <Row k={<><Tick />Measurements</>} v="38 items" />
      <Row k={<><Tick />Site photos</>} v="41" />
      <Row k={<><Tick />Cube test certs</>} v="6" />
    </div>
    <span className="mt-2.5 inline-block -rotate-2 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-hivis ring-1 ring-hivis/60">
      Ready to submit
    </span>
  </div>,
  <div key="cash">
    <div className="flex h-12 items-end gap-[3px]">
      {WEEKS.map((h, i) => (
        <span key={i} className={`flex-1 rounded-[2px] ${i === 7 ? "bg-hivis" : "bg-bone/25"}`} style={{ height: `${h}%` }} />
      ))}
    </div>
    <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-bone/40">
      <span>Wk 1</span>
      <span>Wk 13</span>
    </div>
    <p className="mt-2 text-[12px] text-bone/70">
      Cash dip in week 8 · <span className="font-mono text-hivis">₹38.6 L</span> flagged now
    </p>
  </div>,
];
