"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowCounterClockwise,
  CheckCircle,
  Files,
  Microphone,
  Pause,
  Play,
  Receipt,
  SunHorizon,
  TrendUp,
  WarningDiamond,
  X,
} from "@phosphor-icons/react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SCREENS, STEPS, labels, stage, stepAt } from "./siteWalk";
import { EASE, PillButton, lockScroll, useTheme } from "./ui";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });
/** Warm the 3D chunk before the click (on hover or focus of the demo button). */
export const preloadDemo = () => void import("./HeroScene");

const N = STEPS.length;
const HOLD = 6.5; // seconds the demo dwells on each step
const toP = (c: number) => (c + 1) / SCREENS;
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

/**
 * Full-screen demo: the camera walks the site one step at a time while the building goes up,
 * from an empty plot to a finished, lit tower. Plays on its own; prev / next / pause to drive it.
 */
export default function Demo({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const progress = useMotionValue(0);
  const ctrl = useRef<AnimationPlaybackControls | null>(null);
  const playing = useRef(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [step, setStep] = useState(-1);
  const [done, setDone] = useState(false);
  useMotionValueEvent(progress, "change", (p) => setStep(stepAt(p)));
  // Auto-advance goes through a ref so `run` can schedule the next step without calling itself.
  const advance = useRef<(k: number) => void>(() => {});

  const run = useCallback(
    (k: number, quick: boolean) => {
      ctrl.current?.stop();
      setDone(false);
      const enter = toP(k + 0.12);
      const hold = toP(k + 0.92);
      const dwell = () => {
        if (!playing.current) return;
        const left = clamp01((hold - progress.get()) / (hold - enter));
        ctrl.current = animate(progress, hold, {
          duration: Math.max(HOLD * left, 0.3),
          ease: "linear",
          onComplete: () => (k < N - 1 ? advance.current(k + 1) : setDone(true)),
        });
      };
      const now = progress.get();
      if (quick || now < enter - 1e-4 || now > hold + 1e-4) {
        ctrl.current = animate(progress, enter, {
          duration: quick ? 1.4 : k === 0 ? 3.2 : 1.8,
          ease: EASE,
          onComplete: dwell,
        });
      } else dwell();
    },
    [progress],
  );
  useEffect(() => {
    advance.current = (k) => run(k, false);
  }, [run]);

  const go = (k: number) => run(Math.min(Math.max(k, 0), N - 1), true);
  const toggle = () => {
    if (done) {
      progress.set(0);
      playing.current = true;
      setIsPlaying(true);
      run(0, false);
      return;
    }
    playing.current = !playing.current;
    setIsPlaying(playing.current);
    if (playing.current) run(Math.max(step, 0), false);
    else ctrl.current?.stop();
  };

  useEffect(() => {
    lockScroll(true);
    const t = setTimeout(() => run(0, false), 400);
    return () => {
      clearTimeout(t);
      ctrl.current?.stop();
      lockScroll(false);
    };
  }, [run]);

  const k = Math.max(step, 0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(k + 1);
      if (e.key === "ArrowLeft") go(k - 1);
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const s = STEPS[k];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      role="dialog"
      aria-modal="true"
      aria-label="Vera AI demo"
      data-lenis-prevent
      className="fixed inset-0 z-[80] bg-ink"
    >
      <div className="absolute inset-0">
        <HeroScene progress={progress} active theme={theme} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_50%,color-mix(in_oklab,var(--ink)_65%,transparent)_100%)]" />
      <Labels />

      <div data-demo-ui className="absolute inset-x-0 top-0 flex items-center justify-between gap-4 p-4 md:p-8">
        <BuildMeter progress={progress} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the demo"
          className="flex size-11 items-center justify-center rounded-full bg-ink-2/80 text-bone ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-ink-2"
        >
          <X size={18} weight="light" />
        </button>
      </div>

      <div
        data-demo-ui
        className="absolute inset-x-3 bottom-3 rounded-[1.75rem] bg-white/[0.04] p-1.5 ring-1 ring-white/10 md:inset-x-auto md:bottom-8 md:left-8 md:w-[440px]"
      >
        <div className="rounded-[calc(1.75rem-0.375rem)] bg-ink-2/[0.95] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-md md:p-7">
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="min-h-[10.5rem]"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-hivis">Building complete</p>
                <h2 className="mt-2 text-[1.6rem] font-medium leading-[1.05] tracking-[-0.035em] md:text-[2rem]">
                  Every rupee on this site, accounted for.
                </h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  <PillButton href="#book">Book a free leak check</PillButton>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={k}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="min-h-[10.5rem] md:min-h-[11.5rem]"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-hivis">
                  {String(k + 1).padStart(2, "0")} / {String(N).padStart(2, "0")} · {s.tag}
                </p>
                <h2 className="mt-2 text-[1.6rem] font-medium leading-[1.05] tracking-[-0.035em] md:text-[2rem]">{s.title}</h2>
                <p className="mt-3 text-[13px] leading-relaxed text-bone/60 md:text-sm">{s.body}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-5 flex gap-1.5">
            {STEPS.map((x, j) => (
              <button
                key={x.tag}
                type="button"
                onClick={() => go(j)}
                aria-label={`Go to step ${j + 1}: ${x.tag}`}
                className="group relative h-6 flex-1"
              >
                <Seg k={j} progress={progress} />
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ctrl label="Previous step" onClick={() => go(k - 1)} disabled={k === 0 && !done}>
                <ArrowLeft size={16} weight="light" />
              </Ctrl>
              <Ctrl label={done ? "Replay" : isPlaying ? "Pause" : "Play"} onClick={toggle} primary>
                {done ? (
                  <ArrowCounterClockwise size={16} weight="bold" />
                ) : isPlaying ? (
                  <Pause size={16} weight="fill" />
                ) : (
                  <Play size={16} weight="fill" />
                )}
              </Ctrl>
              <Ctrl label="Next step" onClick={() => go(k + 1)} disabled={k === N - 1}>
                <ArrowRight size={16} weight="light" />
              </Ctrl>
            </div>
            <span className="text-xs text-bone/40">Space to pause · arrows to step</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Ctrl({
  children,
  label,
  onClick,
  disabled,
  primary,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-10 items-center justify-center rounded-full ring-1 transition-colors duration-300 disabled:opacity-30 ${
        primary ? "bg-hivis text-coal ring-hivis" : "bg-white/[0.05] text-bone ring-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Seg({ k, progress }: { k: number; progress: MotionValue<number> }) {
  const scaleX = useTransform(progress, (p) => clamp01((stage(p).c - k) / 0.92));
  return (
    <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-bone/10 transition-colors group-hover:bg-bone/20">
      <motion.span style={{ scaleX }} className="absolute inset-0 origin-left rounded-full bg-hivis" />
    </span>
  );
}

/** Construction progress: phase name and a percentage that follows the building. */
function BuildMeter({ progress }: { progress: MotionValue<number> }) {
  const [phase, setPhase] = useState("Empty plot");
  const pct = useTransform(progress, (p) => {
    const { c } = stage(p);
    if (c < 0) return 0;
    const i = Math.min(Math.floor(c), N - 1);
    const b0 = i === 0 ? 0 : STEPS[i - 1].build;
    const b = b0 + (STEPS[i].build - b0) * clamp01((c - i) / 0.85);
    return Math.round(b * 100);
  });
  const width = useTransform(pct, (v) => `${v}%`);
  const label = useTransform(pct, (v) => `${v}%`);
  useMotionValueEvent(progress, "change", (p) => {
    const i = stepAt(p);
    setPhase(i < 0 ? "Empty plot" : STEPS[i].phase);
  });
  return (
    <div className="w-[230px] rounded-2xl bg-ink-2/80 p-3.5 ring-1 ring-white/10 backdrop-blur-md md:w-[280px]">
      <div className="flex items-baseline justify-between text-[11px] font-medium uppercase tracking-[0.18em]">
        <span className="text-bone/50">On site</span>
        <motion.span className="tabular-nums text-bone">{label}</motion.span>
      </div>
      <p className="mt-1 text-sm font-medium text-bone">{phase}</p>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-bone/10">
        <motion.div style={{ width }} className="h-full rounded-full bg-hivis" />
      </div>
    </div>
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
                  <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-bone/45">
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
      <span className="ml-2 text-[10px] text-bone/40">0:42</span>
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
    <p className="mt-2 text-lg tabular-nums text-hivis">₹23,010</p>
  </div>,
  <div key="summary">
    <p className="text-[11px] text-bone/50">08:00 · Daily summary · 4 sites</p>
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
    <span className="mt-2.5 inline-block -rotate-2 rounded-md px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-hivis ring-1 ring-hivis/60">
      Ready to submit
    </span>
  </div>,
  <div key="cash">
    <div className="flex h-12 items-end gap-[3px]">
      {WEEKS.map((h, i) => (
        <span key={i} className={`flex-1 rounded-[2px] ${i === 7 ? "bg-hivis" : "bg-bone/25"}`} style={{ height: `${h}%` }} />
      ))}
    </div>
    <div className="mt-1.5 flex justify-between text-[9.5px] text-bone/40">
      <span>Wk 1</span>
      <span>Wk 13</span>
    </div>
    <p className="mt-2 text-[12px] text-bone/70">
      Cash dip in week 8 · <span className="text-hivis">₹38.6 L</span> flagged now
    </p>
  </div>,
];
