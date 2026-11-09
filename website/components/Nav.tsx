"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { EASE, INTRO, PillButton, ThemeToggle } from "./ui";

const LINKS = [
  ["The leak", "#leak"],
  ["Desks", "#desks"],
  ["How we work", "#process"],
  ["Savings", "#savings"],
  ["Pricing", "#pricing"],
  ["Team", "#team"],
] as const;

export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <rect width="28" height="28" rx="8.5" fill="#FF5B1F" />
      <path d="M7.5 8.5 14 20l6.5-11.5" fill="none" stroke="#0A0A09" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.6 8.5h6.8" stroke="#0A0A09" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [entered, setEntered] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(!open && v > prev && v > 480);
  });

  return (
    <>
      <motion.header
        initial={{ y: -110, opacity: 0 }}
        animate={{ y: hidden ? -110 : 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: entered ? 0 : INTRO - 0.2 }}
        onAnimationComplete={() => setEntered(true)}
        className="fixed inset-x-0 top-3 z-40 flex justify-center px-3 md:top-5"
      >
        <nav className="flex w-full max-w-[940px] items-center justify-between gap-4 rounded-full bg-ink/65 py-1.5 pl-4 pr-1.5 shadow-[0_20px_50px_-20px_rgba(20,14,8,0.45)] ring-1 ring-white/10 backdrop-blur-2xl">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Vera AI home">
            <Logo />
            <span className="text-[15px] font-semibold tracking-[-0.03em]">Vera</span>
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-bone/45">
              AI
            </span>
          </a>

          <ul className="hidden items-center md:flex">
            {LINKS.map(([label, href]) => (
              <li key={href}>
                <a
                  href={href}
                  className="rounded-full px-3.5 py-2 text-[13px] text-bone/60 transition-colors duration-500 ease-vera hover:bg-white/[0.06] hover:text-bone"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href="#book"
              className="hidden rounded-full bg-bone px-4 py-2.5 text-[13px] font-medium text-ink transition-transform duration-500 ease-vera hover:scale-[1.03] active:scale-[0.98] md:inline-flex"
            >
              Free leak check
            </a>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="relative flex size-10 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10 md:hidden"
            >
              <span
                className={`absolute h-px w-4 bg-bone transition-transform duration-500 ease-vera ${open ? "rotate-45" : "-translate-y-[3px]"}`}
              />
              <span
                className={`absolute h-px w-4 bg-bone transition-transform duration-500 ease-vera ${open ? "-rotate-45" : "translate-y-[3px]"}`}
              />
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { delay: 0.25, duration: 0.4 } }}
            transition={{ duration: 0.5, ease: EASE }}
            className="fixed inset-0 z-30 flex flex-col justify-end gap-10 bg-ink/85 px-6 pb-12 pt-28 backdrop-blur-3xl md:hidden"
          >
            <ul>
              {LINKS.map(([label, href], i) => (
                <li key={href} className="overflow-hidden border-b border-white/[0.08]">
                  <motion.a
                    href={href}
                    onClick={() => setOpen(false)}
                    initial={{ y: "110%" }}
                    animate={{ y: "0%" }}
                    exit={{ y: "110%" }}
                    transition={{ delay: 0.08 + i * 0.06, duration: 0.8, ease: EASE }}
                    className="flex items-baseline justify-between py-3 text-[2.6rem] font-medium leading-tight tracking-[-0.045em]"
                  >
                    {label}
                    <span className="font-mono text-xs text-bone/35">0{i + 1}</span>
                  </motion.a>
                </li>
              ))}
            </ul>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.45, duration: 0.8, ease: EASE }}
              onClick={() => setOpen(false)}
            >
              <PillButton href="#book">Book the free leak check</PillButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
