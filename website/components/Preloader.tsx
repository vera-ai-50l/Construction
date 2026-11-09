"use client";

import { AnimatePresence, animate, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { INTRO, Scramble } from "./ui";

const STATUS = ["Reading challans", "Matching POs", "Transcribing voice notes", "Building the record"];

export default function Preloader() {
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState(0);
  const num = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.style.overflow = "hidden";
    const c = animate(0, 100, {
      duration: INTRO - 0.5,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (v) => {
        if (num.current) num.current.textContent = String(Math.round(v)).padStart(3, "0");
        setStatus(Math.min(STATUS.length - 1, Math.floor(v / 25)));
      },
      onComplete: () => {
        setDone(true);
        root.style.overflow = "";
      },
    });
    return () => {
      c.stop();
      root.style.overflow = "";
    };
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="preloader"
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[100] flex flex-col justify-between bg-ink p-5 text-bone md:p-10"
        >
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-bone/45 md:text-[11px]">
            <span>Vera AI</span>
            <span>Site record infrastructure · India</span>
          </div>

          <div className="flex flex-col items-center gap-6">
            <Scramble text="VERA" className="text-[28vw] font-medium leading-[0.8] tracking-[-0.07em] md:text-[20vw]" />
            <span className="font-serif text-xl italic text-bone/60 md:text-2xl">the true record of every site</span>
          </div>

          <div className="flex items-end justify-between gap-6">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone/45">{STATUS[status]}…</span>
              <div className="h-px w-40 overflow-hidden bg-white/10 md:w-64">
                <motion.div
                  className="h-px origin-left bg-hivis"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: INTRO - 0.5, ease: [0.65, 0, 0.35, 1] }}
                />
              </div>
            </div>
            <span ref={num} className="font-mono text-6xl tabular-nums tracking-[-0.04em] md:text-8xl">
              000
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
