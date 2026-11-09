"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Eyebrow, Words } from "./ui";

const STEPS = [
  {
    when: "Week 1",
    code: "W1",
    title: "Free leak check",
    body: "Send POs, challans, the stock register and BOQ for one site — Excel, or just photos of the paper registers.",
    out: "A rupee figure on the table within a week.",
  },
  {
    when: "Weeks 2–3",
    code: "W3",
    title: "Setup, on one site",
    body: "We map your formats, onboard supervisors to one WhatsApp number and test everything on a single site first.",
    out: "No new app. No training days.",
  },
  {
    when: "Month 1",
    code: "M1",
    title: "Site Record Desk live",
    body: "Daily record, 8 AM owner summary, weekly claim-ready PDF and a monthly import file for Tally or your ERP.",
    out: "Target: 90%+ supervisors reporting every day.",
  },
  {
    when: "Month 2–3",
    code: "M2",
    title: "Bill-to-Cash",
    body: "Running bills built straight from the record, then tracked and chased until the money lands.",
    out: "Fewer days from work done to bill submitted.",
  },
  {
    when: "Month 3+",
    code: "M3",
    title: "Project Control",
    body: "A senior PM from a large EPC firm reviews plan vs actual, cost to finish and cash — with you, every week.",
    out: "A 13-week cash forecast you can take to the bank.",
  },
  {
    when: "Whenever",
    code: "∞",
    title: "Claim File",
    body: "When a dispute starts, the evidence already exists. We assemble it for your lawyer.",
    out: "Your record becomes your case.",
  },
];

export default function Process() {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setDist(Math.max(0, el.scrollWidth - window.innerWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, (v) => -v * dist);

  return (
    <section
      ref={ref}
      id="process"
      className="relative -mt-10 rounded-t-[2.5rem] bg-ink"
      style={{ height: `calc(100dvh + ${dist}px)` }}
    >
      <div className="sticky top-0 flex h-[100dvh] flex-col justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 blueprint [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <motion.div ref={track} style={{ x }} className="relative flex w-max items-stretch gap-5 px-4 md:px-10">
          <div className="flex w-[85vw] flex-col justify-center pr-6 md:w-[40vw] md:pr-16">
            <Eyebrow>04 — How we work</Eyebrow>
            <Words
              text="Free first. *No new app.* | Live in three weeks."
              className="mt-6 text-[clamp(2.4rem,5vw,5.2rem)] font-medium leading-[0.95] tracking-[-0.05em]"
            />
            <p className="mt-6 max-w-[40ch] text-bone/55 md:text-lg">
              We never put five products in front of you at once. One leak check, one rupee figure — then each desk
              earns the next.
            </p>
            <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-bone/35">Scroll →</p>
          </div>

          {STEPS.map((s, i) => (
            <article key={s.title} className="w-[80vw] shrink-0 sm:w-[60vw] md:w-[30vw] md:min-w-[360px]">
              <div className="h-full rounded-[2rem] bg-white/[0.035] p-1.5 ring-1 ring-white/10">
                <div className="flex h-full min-h-[440px] flex-col justify-between rounded-[calc(2rem-0.375rem)] bg-ink-2 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] md:min-h-[500px] md:p-9">
                  <div className="flex items-start justify-between">
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-bone/70 ring-1 ring-white/10">
                      {s.when}
                    </span>
                    <span className="font-mono text-xs text-bone/30">0{i + 1}</span>
                  </div>
                  <p
                    className={`font-serif text-[clamp(5rem,9vw,8.5rem)] italic leading-none tracking-[-0.04em] ${i === 0 ? "text-hivis" : "text-transparent [-webkit-text-stroke:1px_color-mix(in_oklab,var(--bone)_35%,transparent)]"}`}
                  >
                    {s.code}
                  </p>
                  <div>
                    <h3 className="text-[1.75rem] font-medium leading-tight tracking-[-0.035em]">{s.title}</h3>
                    <p className="mt-3 leading-relaxed text-bone/55">{s.body}</p>
                    <p className="mt-6 border-t border-white/[0.08] pt-4 text-sm text-bone/85">
                      <span className="text-hivis">→ </span>
                      {s.out}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
          <div className="w-[10vw] shrink-0" />
        </motion.div>

        <div className="relative mx-4 mt-10 md:mx-10">
          <div className="h-px bg-white/10" />
          <motion.div style={{ scaleX: scrollYProgress }} className="absolute inset-x-0 top-0 h-px origin-left bg-hivis" />
          <div className="mt-4 hidden justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-bone/35 md:flex">
            {STEPS.map((s) => (
              <span key={s.when}>{s.when}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
