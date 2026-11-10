"use client";

import { Eyebrow, Reveal, Words } from "./ui";

const STEPS = [
  {
    when: "Day 1",
    title: "Free leak check",
    body: "Send what you have for one site: POs, challans, the stock register and the BOQ, as texts, photos, Excel or Google Sheets.",
    out: "Wastage flagged from the first day.",
  },
  {
    when: "Week 1",
    title: "Built around your sites",
    body: "We shape Vera to your formats, put supervisors on one WhatsApp number and test everything on a single site first.",
    out: "No new app. No training days.",
  },
  {
    when: "Month 1",
    title: "Site Record Desk live",
    body: "Daily record, an 8 AM owner summary, a weekly claim-ready PDF and a monthly file for Tally or your ERP.",
    out: "Target: 90% of supervisors reporting daily.",
  },
  {
    when: "Month 2 onwards",
    title: "Add what pays",
    body: "Bill-to-Cash, project control or a claim file, each built on the record you already have.",
    out: "One desk at a time.",
  },
];

export default function Process() {
  return (
    <section id="process" className="relative -mt-10 rounded-t-[2.5rem] bg-ink px-4 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Eyebrow>How we work</Eyebrow>
            <Words
              text="Free first. No new app. | *Live from day one.*"
              className="mt-6 text-[clamp(2.25rem,4.5vw,4.5rem)] font-medium leading-[0.98] tracking-[-0.045em]"
            />
          </div>
          <Reveal className="md:col-span-5" delay={0.15}>
            <p className="max-w-[42ch] text-bone/55 md:text-lg">
              We never put every product in front of you at once. One leak check and one rupee figure, then each desk
              earns the next.
            </p>
          </Reveal>
        </div>

        <ol className="mt-14 grid gap-4 sm:grid-cols-2 md:mt-20 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <li className="h-full rounded-[2rem] bg-white/[0.035] p-1.5 ring-1 ring-white/10">
                <div className="flex h-full flex-col rounded-[calc(2rem-0.375rem)] bg-ink-2 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] md:p-7">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-bone/70 ring-1 ring-white/10">
                      {s.when}
                    </span>
                    <span className={`text-sm font-medium tabular-nums ${i === 0 ? "text-hivis" : "text-bone/30"}`}>
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-10 text-2xl font-medium leading-tight tracking-[-0.03em]">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-bone/55">{s.body}</p>
                  <div className="mt-auto pt-6">
                    <p className="border-t border-white/[0.08] pt-4 text-sm text-bone/85">{s.out}</p>
                  </div>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
