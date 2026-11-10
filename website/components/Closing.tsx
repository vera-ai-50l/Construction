"use client";

import { motion } from "motion/react";
import { Logo } from "./Nav";
import { LinkedinLogo } from "@phosphor-icons/react";
import { CONTACT, Eyebrow, PillButton, Reveal, Words, whatsappHref } from "./ui";

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
            text="Catch wastage | *from day one.*"
            className="mt-8 text-[clamp(2.75rem,7vw,7rem)] font-medium leading-[0.92] tracking-[-0.055em]"
          />
          <Reveal delay={0.3}>
            <p className="mx-auto mt-8 max-w-[50ch] text-bone/60 md:text-lg">
              Vera is AI software set up around your sites. Send what you already keep, as WhatsApp texts, voice notes,
              photos of registers, Excel or Google Sheets, or PDFs, and it starts flagging wastage from the first day.
            </p>
          </Reveal>
          <Reveal delay={0.45} className="mt-10 flex flex-wrap justify-center gap-3">
            <PillButton href="#book">Book a free leak check</PillButton>
            {whatsappHref() && (
              <PillButton href={whatsappHref()} variant="ghost">
                WhatsApp us
              </PillButton>
            )}
          </Reveal>
          <Reveal delay={0.6}>
            <ul className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[11px] uppercase tracking-[0.2em] text-bone/45">
              {["No new app", "Texts, photos, sheets, PDFs", "Works with Tally", "Wastage flagged from day one"].map((t) => (
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
              <Logo className="h-8 text-bone" />
              <p className="mt-4 max-w-[34ch] text-2xl leading-snug text-bone/70">
                The true record of every site.
              </p>
            </div>
            <nav className="grid grid-cols-2 gap-2 text-sm text-bone/55 md:col-span-4">
              {[
                ["The leak", "#leak"],
                ["Desks", "#desks"],
                ["How we work", "#process"],
                ["Team", "#team"],
                ["Book a check", "#book"],
              ].map(([l, h]) => (
                <a key={h} href={h} className="w-fit transition-colors duration-500 ease-vera hover:text-bone">
                  {l}
                </a>
              ))}
              {CONTACT.linkedin && (
                <a
                  href={CONTACT.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-1.5 transition-colors duration-500 ease-vera hover:text-bone"
                >
                  <LinkedinLogo size={15} weight="fill" /> LinkedIn
                </a>
              )}
            </nav>
            <div className="text-[11px] uppercase leading-loose tracking-[0.2em] text-bone/40 md:col-span-3 md:text-right">
              <p>Made in India</p>
              <p>For India’s builders</p>
            </div>
          </div>

          <div className="mt-14 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-6 text-[10px] uppercase tracking-[0.2em] text-bone/35">
            <span>© 2026 Vera AI</span>
            <span>Vera is Latin for “true”</span>
          </div>
        </div>
      </footer>
    </>
  );
}
