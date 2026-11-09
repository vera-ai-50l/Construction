"use client";

import { Plus } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useState } from "react";
import { EASE, Eyebrow, Reveal, Words } from "./ui";

const NOT = [
  "A new app for your supervisors",
  "A replacement for your ERP or Tally",
  "Tender bidding software",
  "Labour payroll compliance",
  "Cameras watching your site",
];

const FAQ = [
  [
    "What do you need from us for the free check?",
    "Purchase orders, delivery challans, the stock register and the BOQ for one site, last three months. Excel is great. Photos of the paper registers work too.",
  ],
  [
    "Do supervisors need to install anything?",
    "No. They send voice notes, photos and challans to one WhatsApp number, in Hindi or their own language. That's the whole change.",
  ],
  [
    "Will the record stand up with a client, bank or arbitrator?",
    "Every entry keeps its original photo or voice note and its time stamp, and the weekly PDF is laid out as a day-by-day record you can put straight into a claim.",
  ],
  ["Does it work with Tally?", "Yes. Every month you get a matching import file for Tally or your ERP."],
  [
    "How long until we're live?",
    "Two to three weeks. We map your formats, onboard your supervisors and test on one site before rolling out.",
  ],
  [
    "How is Vera priced?",
    "Every firm gets its own quote, based on how many sites you run and which desks you need. The leak check on one site is always free, and you have the quote in writing before you commit to anything.",
  ],
];

export default function Answers() {
  const [open, setOpen] = useState(0);
  return (
    <section className="relative -mt-10 rounded-t-[2.5rem] bg-bone px-4 py-28 text-ink md:px-10 md:py-40">
      <div className="mx-auto grid max-w-[1440px] gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Eyebrow tone="light">07 — Straight answers</Eyebrow>
          <Words
            text="What Vera *is not.*"
            className="mt-6 text-[clamp(2.5rem,5vw,5rem)] font-medium leading-[0.95] tracking-[-0.05em]"
          />
          <ul className="mt-10 space-y-1">
            {NOT.map((n, i) => (
              <li key={n} className="relative w-fit py-1.5 text-xl tracking-[-0.02em] text-ink/55 md:text-2xl">
                {n}
                <motion.span
                  className="absolute inset-x-0 top-1/2 h-[2px] origin-left bg-hivis"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: "-15% 0px" }}
                  transition={{ delay: 0.3 + i * 0.15, duration: 0.7, ease: EASE }}
                />
              </li>
            ))}
          </ul>
          <Reveal delay={0.3}>
            <p className="mt-10 max-w-[42ch] border-l-2 border-hivis pl-5 leading-relaxed text-ink/70">
              And we can’t speed up a government treasury. We fix your delays and your missing papers — not theirs.
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <div className="border-t border-ink/10">
            {FAQ.map(([q, a], i) => {
              const isOpen = open === i;
              return (
                <Reveal key={q} delay={i * 0.05} y={24}>
                  <div className="border-b border-ink/10">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? -1 : i)}
                      className="flex w-full items-center justify-between gap-6 py-6 text-left md:py-7"
                    >
                      <span className="text-lg font-medium tracking-[-0.02em] md:text-xl">{q}</span>
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full ring-1 transition-all duration-500 ease-vera ${
                          isOpen ? "rotate-45 bg-ink text-bone ring-ink" : "ring-ink/15"
                        }`}
                      >
                        <Plus size={16} weight="light" />
                      </span>
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows] duration-700 ease-vera ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-[60ch] pb-7 leading-relaxed text-ink/60">{a}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
