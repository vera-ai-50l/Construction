"use client";

import { Check } from "@phosphor-icons/react";
import type { PointerEvent } from "react";
import { Eyebrow, PillButton, Reveal, Words } from "./ui";

const PLANS = [
  {
    name: "Starter",
    pitch: "Find the leak, then keep the record.",
    setup: "₹1.25 L",
    monthly: "₹50k",
    includes: [
      "Material Leak Audit, all sites",
      "Site Record Desk, up to 3 sites",
      "8 AM owner summary on WhatsApp",
      "Weekly claim-ready PDF",
      "Monthly Tally / ERP import file",
    ],
  },
  {
    name: "Growth",
    pitch: "Turn the record into cash.",
    setup: "₹2 L",
    monthly: "₹90k",
    featured: true,
    includes: [
      "Everything in Starter",
      "Bill-to-Cash Desk",
      "Running bill packs built automatically",
      "Objections, ageing and retention tracked",
      "Automatic payment follow-ups",
    ],
  },
  {
    name: "Command",
    pitch: "A senior PM on your side.",
    setup: "₹2 L",
    monthly: "₹2–2.4 L",
    includes: [
      "Everything in Growth",
      "Project Control, up to 5 sites",
      "13-week cash forecast and risk list",
      "Plan vs actual and cost to finish",
      "Weekly 1-hour call with an ex-EPC senior PM",
    ],
  },
];

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
            text="Start free. *Scale* | when the record pays."
            className="mx-auto mt-6 max-w-[16ch] text-[clamp(2.5rem,6vw,6rem)] font-medium leading-[0.95] tracking-[-0.05em]"
          />
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

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.1} className={p.featured ? "lg:-translate-y-4" : ""}>
              <article
                onPointerMove={spotlight}
                className={`group h-full rounded-[2rem] p-1.5 ring-1 transition-transform duration-700 ease-vera hover:-translate-y-1.5 ${
                  p.featured ? "bg-bone/10 ring-bone/25" : "bg-white/[0.035] ring-white/10"
                }`}
              >
                <div
                  className={`relative flex h-full flex-col overflow-hidden rounded-[calc(2rem-0.375rem)] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] md:p-9 ${
                    p.featured ? "bg-bone text-ink" : "bg-ink-2"
                  }`}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(420px circle at var(--x, 50%) var(--y, 0%), ${
                        p.featured ? "rgba(255,91,31,0.14)" : "rgba(255,91,31,0.12)"
                      }, transparent 60%)`,
                    }}
                  />
                  <div className="relative flex items-center justify-between">
                    <h3 className="text-2xl font-medium tracking-[-0.035em]">{p.name}</h3>
                    {p.featured && (
                      <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-bone">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className={`relative mt-2 ${p.featured ? "text-ink/60" : "text-bone/55"}`}>{p.pitch}</p>

                  <div className="relative mt-10">
                    <p className="text-[clamp(2.8rem,4.5vw,4rem)] font-medium leading-none tracking-[-0.05em]">
                      {p.monthly}
                      <span className={`ml-2 text-base font-normal tracking-normal ${p.featured ? "text-ink/50" : "text-bone/45"}`}>
                        / month
                      </span>
                    </p>
                    <p className={`mt-2 font-mono text-[12px] ${p.featured ? "text-ink/55" : "text-bone/45"}`}>
                      + {p.setup} one-time setup
                    </p>
                  </div>

                  <ul className={`relative mt-10 space-y-3 border-t pt-6 ${p.featured ? "border-ink/10" : "border-white/[0.08]"}`}>
                    {p.includes.map((f) => (
                      <li key={f} className="flex gap-3 text-sm">
                        <Check size={16} weight="light" className="mt-0.5 shrink-0 text-hivis" />
                        <span className={p.featured ? "text-ink/80" : "text-bone/75"}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="relative mt-auto pt-10">
                    <PillButton href="#book" variant={p.featured ? "dark" : "ghost"}>
                      Start with {p.name}
                    </PillButton>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10">
          <p className="text-center font-mono text-[12px] text-bone/40">
            Extra site ₹12k / month · Claim File Builder ₹3–10 L per claim · Paid audit ₹1.5–3 L fixed, or ₹50k + 15–20%
            of money recovered
          </p>
        </Reveal>
      </div>
    </section>
  );
}
