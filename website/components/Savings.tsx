"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import { Bezel, Eyebrow, PillButton, Reveal, Words, formatINR } from "./ui";

const STOP_SHARE = 1 / 3; // conservative: Vera stops a third of the leak

function Money({ value, className }: { value: number; className?: string }) {
  const mv = useSpring(value, { stiffness: 80, damping: 20 });
  useEffect(() => mv.set(value), [mv, value]);
  const text = useTransform(mv, formatINR);
  return <motion.span className={`tabular-nums ${className ?? ""}`}>{text}</motion.span>;
}

function Bar({ share, className }: { share: number; className: string }) {
  const s = useSpring(share, { stiffness: 90, damping: 20 });
  useEffect(() => s.set(share), [s, share]);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div style={{ scaleX: s }} className={`h-full origin-left rounded-full ${className}`} />
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block" data-cursor="Drag">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-ink/60">{label}</span>
        <span className="font-mono text-xl tabular-nums tracking-[-0.02em]">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format(value)}
        className="vera-range mt-3 w-full"
        style={{ "--fill": `${fill}%` } as CSSProperties}
      />
      <span className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-ink/35">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </span>
    </label>
  );
}

export default function Savings() {
  const [crore, setCrore] = useState(120);
  const [rate, setRate] = useState(3);
  const [sites, setSites] = useState(5);

  const leak = crore * 1e7 * (rate / 100);
  const stopped = leak * STOP_SHARE;
  const perSite = stopped / sites;
  const perDay = stopped / 365;

  return (
    <section id="savings" className="relative -mt-10 rounded-t-[2.5rem] bg-concrete px-4 py-28 text-ink md:px-10 md:py-40">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <Eyebrow tone="light">05 — Savings</Eyebrow>
            <Words
              text="Slide to see what's *leaking* | from your sites."
              className="mt-6 text-[clamp(2.5rem,6vw,6rem)] font-medium leading-[0.95] tracking-[-0.05em]"
            />
          </div>
          <Reveal className="md:col-span-4" delay={0.2}>
            <p className="max-w-[40ch] text-ink/55 md:text-lg">
              Three numbers you already know. We’ll do the maths in lakh and crore — then the free leak check replaces
              our estimate with your real figure.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-5 md:mt-24 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <Bezel tone="light" inner="flex h-full flex-col gap-10 p-6 md:p-10">
              <Slider
                label="Work you execute a year"
                value={crore}
                min={50}
                max={500}
                step={10}
                onChange={setCrore}
                format={(v) => `₹${v} Cr`}
              />
              <Slider
                label="Material waste today"
                value={rate}
                min={2}
                max={5}
                step={0.5}
                onChange={setRate}
                format={(v) => `${v}%`}
              />
              <Slider
                label="Active sites"
                value={sites}
                min={1}
                max={20}
                step={1}
                onChange={setSites}
                format={(v) => `${v} site${v > 1 ? "s" : ""}`}
              />
              <p className="mt-auto border-t border-ink/10 pt-6 text-[12px] leading-relaxed text-ink/45">
                Estimate. Assumes Vera stops one-third of the leak. Pricing is quoted per firm, after the free leak
                check.
              </p>
            </Bezel>
          </Reveal>

          <Reveal className="lg:col-span-7" delay={0.1}>
            <div className="h-full rounded-[2rem] bg-ink/[0.04] p-1.5 ring-1 ring-ink/[0.07]">
              <div className="relative flex h-full flex-col gap-10 overflow-hidden rounded-[calc(2rem-0.375rem)] bg-ink p-6 text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:p-10">
                <div className="pointer-events-none absolute -bottom-40 -right-20 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(255,91,31,0.18),transparent_65%)]" />
                <div className="relative">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/45">
                    You could keep, every year
                  </span>
                  <p className="mt-3 text-[clamp(3.4rem,8vw,7.5rem)] font-medium leading-[0.9] tracking-[-0.06em]">
                    <Money value={stopped} />
                  </p>
                </div>

                <div className="relative space-y-6">
                  {[
                    { k: "Leaking today", v: leak, share: 1, cls: "bg-bone/30" },
                    { k: "Vera stops (one-third)", v: stopped, share: STOP_SHARE, cls: "bg-hivis" },
                  ].map((r) => (
                    <div key={r.k}>
                      <div className="mb-2 flex items-baseline justify-between text-sm">
                        <span className="text-bone/60">{r.k}</span>
                        <Money value={r.v} className="font-mono" />
                      </div>
                      <Bar share={r.share} className={r.cls} />
                    </div>
                  ))}
                </div>

                <div className="relative mt-auto grid grid-cols-2 gap-4 border-t border-white/10 pt-6 md:grid-cols-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/40">Per site, a year</p>
                    <p className="mt-1 text-4xl font-medium tracking-[-0.04em]">
                      <Money value={perSite} />
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/40">Every day</p>
                    <p className="mt-1 text-4xl font-medium tracking-[-0.04em]">
                      <Money value={perDay} />
                    </p>
                  </div>
                  <div className="col-span-2 flex items-end md:col-span-1 md:justify-end">
                    <PillButton href="#book">Get my real number</PillButton>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
