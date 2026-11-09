"use client";

import { motion } from "motion/react";
import { Logo } from "./Nav";
import { CONTACT, Clock, EASE, Eyebrow, PillButton, Reveal, Words } from "./ui";

export default function Closing() {
  return (
    <>
      <section id="book" className="relative -mt-10 overflow-hidden rounded-t-[2.5rem] bg-ink px-4 py-32 md:px-10 md:py-48">
        <div className="pointer-events-none absolute inset-0 blueprint [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,91,31,0.2),transparent_60%)]"
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 8, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
        />
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center text-center">
          <Eyebrow>Start here</Eyebrow>
          <Words
            text="Find the leak | in *four weeks.*"
            className="mt-8 text-[clamp(3.2rem,10vw,10rem)] font-medium leading-[0.88] tracking-[-0.06em]"
          />
          <Reveal delay={0.3}>
            <p className="mx-auto mt-8 max-w-[50ch] text-bone/60 md:text-lg">
              Start with one site, free. Send us the registers — Excel or photos — and get a rupee figure on the table
              within a week. If it’s small, you’ve lost nothing.
            </p>
          </Reveal>
          <Reveal delay={0.45} className="mt-10 flex flex-wrap justify-center gap-3">
            <PillButton href={CONTACT.whatsapp}>Book on WhatsApp</PillButton>
            <PillButton href={CONTACT.email} variant="ghost">
              Write to us
            </PillButton>
          </Reveal>
          <Reveal delay={0.6}>
            <ul className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.2em] text-bone/45">
              {["No new app", "Hindi + regional voice notes", "Works with Tally", "Live in 2–3 weeks"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="size-1 rotate-45 bg-hivis" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <footer className="relative overflow-hidden bg-ink px-4 pb-6 pt-16 md:px-10">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-10 border-t border-white/10 pt-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <div className="flex items-center gap-2.5">
                <Logo />
                <span className="text-lg font-semibold tracking-[-0.03em]">Vera AI</span>
              </div>
              <p className="mt-4 max-w-[34ch] font-serif text-2xl italic leading-snug text-bone/70">
                The true record of every site.
              </p>
            </div>
            <nav className="grid grid-cols-2 gap-2 text-sm text-bone/55 md:col-span-4">
              {[
                ["The leak", "#leak"],
                ["Desks", "#desks"],
                ["How we work", "#process"],
                ["Savings", "#savings"],
                ["Pricing", "#pricing"],
                ["Book a check", "#book"],
              ].map(([l, h]) => (
                <a key={h} href={h} className="w-fit transition-colors duration-500 ease-vera hover:text-bone">
                  {l}
                </a>
              ))}
            </nav>
            <div className="font-mono text-[11px] uppercase leading-loose tracking-[0.2em] text-bone/40 md:col-span-3 md:text-right">
              <p>Made in India</p>
              <p>For India’s builders</p>
              <p className="text-bone/70">
                <Clock withSeconds={false} />
              </p>
            </div>
          </div>

          <div aria-hidden className="mt-16 flex select-none justify-between overflow-hidden leading-[0.78]">
            {"VERA".split("").map((ch, i) => (
              <motion.span
                key={i}
                initial={{ y: "100%" }}
                whileInView={{ y: "0%" }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 1.2, ease: EASE }}
                className={`text-[29vw] font-semibold ${i === 3 ? "text-hivis" : "text-bone"}`}
              >
                {ch}
              </motion.span>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/35">
            <span>© 2026 Vera AI</span>
            <span>Vera — Latin for “true”</span>
          </div>
        </div>
      </footer>
    </>
  );
}
