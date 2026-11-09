"use client";

import { Check } from "@phosphor-icons/react";
import type { PointerEvent } from "react";
import { Eyebrow, PillButton, Reveal, Words } from "./ui";

// No price list on the page: every firm gets its own quote after the free leak check.
const SHAPES = [
  ["Your sites", "How many sites are live, and how many you want on the record."],
  ["Your desks", "Start with the Site Record Desk and add bills, project control or claims only when you need them."],
  ["Your data", "Excel, Tally, an ERP or paper registers. We fit your formats, not the other way round."],
] as const;

const STEPS = [
  ["01", "Free leak check", "One site, the last three months. You get a rupee figure in a week."],
  ["02", "We scope it with you", "One call to agree which sites and which desks are worth it."],
  ["03", "One fixed quote", "A single monthly figure in writing, before you commit to anything."],
] as const;

const spotlight = (e: PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
};

export default function Pricing() {
  return (
    <section id="pricing" className="relative -mt-10 rounded-t-[2.5rem] bg-ink px-4 py-28 md:px-10 md:py-40">
      <div className="mx-auto max-w-[1440px]">
        <div className="text-center">
          <Eyebrow>06 — Pricing</Eyebrow>
          <Words
            text="Start free. *Priced* | for your sites."
            className="mx-auto mt-6 max-w-[16ch] text-[clamp(2.5rem,6vw,6rem)] font-medium leading-[0.95] tracking-[-0.05em]"
          />
          <Reveal delay={0.2}>
            <p className="mx-auto mt-6 max-w-[48ch] text-bone/55 md:text-lg">
              No plans to squeeze into. Every contractor runs different sites, so every quote is built for one firm —
              after we’ve seen the numbers together.
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-16 md:mt-24">
          <div className="rounded-[2rem] bg-hivis/10 p-1.5 ring-1 ring-hivis/30">
            <div className="flex flex-col gap-6 rounded-[calc(2rem-0.375rem)] bg-ink-2 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] md:flex-row md:items-center md:justify-between md:p-8">
              <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:gap-6">
                <span className="text-3xl font-medium tracking-[-0.04em]">
                  Material Leak Check <span className="font-serif font-normal italic text-hivis">free</span>
                </span>
                <span className="text-bone/55">
                  One site · last 3 months · cement, steel + 2 items you pick · your rupee figure in a week
                </span>
              </div>
              <PillButton href="#book" className="shrink-0 self-start md:self-auto">
                Claim it
              </PillButton>
            </div>
          </div>
        </Reveal>

        <div className="mt-5 grid gap-5 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <article
              onPointerMove={spotlight}
              className="group h-full rounded-[2rem] bg-bone/10 p-1.5 ring-1 ring-bone/25 transition-transform duration-700 ease-vera hover:-translate-y-1.5"
            >
              <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(2rem-0.375rem)] bg-bone p-7 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] md:p-10">
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: "radial-gradient(420px circle at var(--x, 50%) var(--y, 0%), rgba(255,91,31,0.14), transparent 60%)" }}
                />
                <div className="relative flex items-center justify-between gap-4">
                  <h3 className="text-2xl font-medium tracking-[-0.035em]">Custom pricing</h3>
                  <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-bone">
                    Quoted per firm
                  </span>
                </div>
                <p className="relative mt-8 text-[clamp(2.6rem,4.5vw,4rem)] font-medium leading-[0.95] tracking-[-0.05em]">
                  Pay for what your sites <span className="font-serif font-normal italic text-hivis">actually</span> use.
                </p>

                <ul className="relative mt-10 grid gap-6 border-t border-ink/10 pt-8 md:grid-cols-3">
                  {SHAPES.map(([k, v]) => (
                    <li key={k}>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Check size={16} weight="light" className="shrink-0 text-hivis" />
                        {k}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-ink/60">{v}</p>
                    </li>
                  ))}
                </ul>

                <div className="relative mt-auto pt-10">
                  <PillButton href="#book" variant="dark">
                    Get a custom quote
                  </PillButton>
                </div>
              </div>
            </article>
          </Reveal>

          <Reveal className="lg:col-span-5" delay={0.1}>
            <div className="h-full rounded-[2rem] bg-white/[0.035] p-1.5 ring-1 ring-white/10">
              <ol className="flex h-full flex-col rounded-[calc(2rem-0.375rem)] bg-ink-2 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] md:p-10">
                <h3 className="text-2xl font-medium tracking-[-0.035em]">How you get a quote</h3>
                {STEPS.map(([n, k, v]) => (
                  <li key={n} className="mt-8 flex gap-5 border-t border-white/[0.08] pt-6 first-of-type:mt-10">
                    <span className="font-mono text-xs text-hivis">{n}</span>
                    <div>
                      <p className="font-medium tracking-[-0.02em]">{k}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-bone/55">{v}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
