"use client";

import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";
import { Fragment, useRef } from "react";
import { Bezel, Counter, EASE, Eyebrow, PillButton, Reveal, parse } from "./ui";

const TICKER = [
  "Cement OPC 53",
  "Fe500 TMT",
  "RMC M25",
  "Delivery challans",
  "Stock register",
  "BOQ",
  "RA bills",
  "Hindrance register",
  "Tally",
  "Voice notes",
];

const CHAIN = [
  { label: "Purchase order", note: "PO-2291", bags: 500 },
  { label: "Delivery challan", note: "3 trucks", bags: 500 },
  { label: "Issued from store", note: "stock register", bags: 482, flag: "18 bags never reached the store" },
  { label: "Used per BOQ", note: "measured work", bags: 441, flag: "41 bags issued, not in the work" },
];

export default function Leak() {
  return (
    <section id="leak" className="relative -mt-10 overflow-hidden rounded-t-[2.5rem] bg-concrete text-ink">
      <Ticker />
      <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-20 md:px-10 md:pb-40 md:pt-28">
        <div className="flex items-center justify-between">
          <Eyebrow tone="light">01 — The leak</Eyebrow>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40 md:inline">
            Material · Money · Proof
          </span>
        </div>

        <ScrubText text="On ₹50 Cr of work, 2–5% walks off site as waste, theft and challans nobody matched. That's *₹1–2.5 Cr gone* — and today, nobody can prove where." />

        <div className="mt-20 grid gap-4 md:mt-28 md:grid-cols-12 md:gap-5">
          <Reveal className="md:col-span-7 md:row-span-2">
            <Bezel tone="light" inner="p-6 md:p-10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-2xl font-medium tracking-[-0.03em] md:text-3xl">How a leak hides</h3>
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
                  Cement · Site 03, Indore · September
                </span>
              </div>
              <ol className="mt-10 space-y-7">
                {CHAIN.map((c, i) => (
                  <li key={c.label}>
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="flex items-baseline gap-3">
                        <span className="font-mono text-[11px] text-ink/35">0{i + 1}</span>
                        <span className="font-medium">{c.label}</span>
                        <span className="hidden text-ink/40 sm:inline">{c.note}</span>
                      </span>
                      <span className="font-mono tabular-nums">{c.bags} bags</span>
                    </div>
                    <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-ink/[0.07]">
                      <motion.div
                        className="absolute inset-y-0 left-0 origin-left rounded-full bg-ink"
                        style={{ width: `${(c.bags / 500) * 100}%` }}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true, margin: "-15% 0px" }}
                        transition={{ delay: 0.2 + i * 0.25, duration: 1.2, ease: EASE }}
                      />
                      {c.flag && (
                        <motion.div
                          className="absolute inset-y-0 origin-left bg-[repeating-linear-gradient(135deg,#ff5b1f_0_4px,transparent_4px_8px)]"
                          style={{
                            left: `${(c.bags / 500) * 100}%`,
                            width: `${((CHAIN[i - 1].bags - c.bags) / 500) * 100}%`,
                          }}
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true, margin: "-15% 0px" }}
                          transition={{ delay: 1 + i * 0.25, duration: 0.6 }}
                        />
                      )}
                    </div>
                    {c.flag && (
                      <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 1.1 + i * 0.25, duration: 0.7, ease: EASE }}
                        className="mt-2 text-[13px] text-hivis"
                      >
                        ↳ {c.flag}
                      </motion.p>
                    )}
                  </li>
                ))}
              </ol>
              <div className="mt-10 flex flex-wrap items-end justify-between gap-4 border-t border-ink/10 pt-6">
                <p className="max-w-[34ch] text-sm leading-relaxed text-ink/55">
                  One item, one site, one month. Every register looks fine on its own — the leak only shows when you
                  match them.
                </p>
                <p className="text-right">
                  <span className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink/40">Unaccounted</span>
                  <span className="text-3xl font-medium tracking-[-0.04em]">59 bags · ₹23,010</span>
                </p>
              </div>
            </Bezel>
          </Reveal>

          <Reveal className="md:col-span-5" delay={0.1}>
            <Bezel tone="light" inner="flex h-full flex-col justify-between gap-10 p-6 md:p-10">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/40">Material waste</span>
              <div>
                <p className="text-[clamp(4rem,9vw,8rem)] font-medium leading-[0.85] tracking-[-0.06em]">
                  <Counter to={2} />–<Counter to={5} />
                  <span className="font-serif font-normal italic text-hivis">%</span>
                </p>
                <p className="mt-4 max-w-[30ch] text-ink/55">of project cost. That’s what material waste usually runs on an Indian site.</p>
              </div>
            </Bezel>
          </Reveal>

          <Reveal className="md:col-span-5" delay={0.2}>
            <div className="h-full rounded-[2rem] bg-ink/[0.04] p-1.5 ring-1 ring-ink/[0.07]">
              <div className="flex h-full flex-col justify-between gap-10 rounded-[calc(2rem-0.375rem)] bg-ink p-6 text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:p-10">
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bone/40">On ₹50 Cr of work</span>
                <div>
                  <p className="text-[clamp(3.2rem,6.5vw,6rem)] font-medium leading-[0.9] tracking-[-0.055em]">
                    ₹<Counter to={1} />–<Counter to={2.5} decimals={1} />
                    <span className="font-serif font-normal italic"> Cr</span>
                  </p>
                  <p className="mt-4 max-w-[30ch] text-bone/55">leaking. Vera finds it in four weeks, site by site.</p>
                </div>
                <PillButton href="#savings" variant="light" className="self-start">
                  Check your number
                </PillButton>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Ticker() {
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { stiffness: 120, damping: 30 });
  const skew = useTransform(velocity, [-2500, 2500], [8, -8], { clamp: true });
  const row = [...TICKER, ...TICKER];
  return (
    <div className="marquee-wrap overflow-hidden border-b border-ink/10 py-6 md:py-8">
      <motion.div style={{ skewX: skew }}>
        <div className="marquee flex w-max items-center">
        {row.map((t, i) => (
          <Fragment key={i}>
            <span
              className={`whitespace-nowrap px-6 text-[clamp(1.75rem,3.6vw,3.25rem)] tracking-[-0.04em] md:px-9 ${
                i % 2 ? "font-serif italic text-ink/45" : "font-medium text-ink/85"
              }`}
            >
              {t}
            </span>
            <span className="size-2 shrink-0 rotate-45 bg-hivis" />
          </Fragment>
        ))}
        </div>
      </motion.div>
    </div>
  );
}

function ScrubText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = parse(text).filter((w) => w !== null);
  return (
    <p
      ref={ref}
      className="mt-10 max-w-[22ch] text-[clamp(2.1rem,5vw,5.2rem)] font-medium leading-[1.02] tracking-[-0.045em]"
    >
      {words.map((w, i) => (
        <Word key={i} p={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} em={w.em}>
          {w.w}
        </Word>
      ))}
    </p>
  );
}

function Word({ p, range, em, children }: { p: MotionValue<number>; range: [number, number]; em: boolean; children: string }) {
  const opacity = useTransform(p, range, [0.12, 1]);
  return (
    <>
      <motion.span style={{ opacity }} className={em ? "font-serif font-normal italic tracking-[-0.02em] text-hivis" : ""}>
        {children}
      </motion.span>{" "}
    </>
  );
}
