"use client";

import { Play } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { EASE, INTRO, PillButton, Words, useTheme } from "./ui";

const Demo = dynamic(() => import("./Demo"), { ssr: false });
const preload = () => void import("./Demo").then((m) => m.preloadDemo());

/**
 * The opening screen: a still of the finished site and one clear action. The 3D site walk only
 * loads when someone asks for it, so the page opens fast and the pointer stays smooth.
 */
export default function Hero() {
  const [demo, setDemo] = useState(false);
  const theme = useTheme();

  return (
    <section id="top" className="relative flex min-h-[640px] items-end overflow-hidden bg-ink [height:100svh]">
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: INTRO - 0.3, duration: 2.2, ease: EASE }}
        className="absolute inset-0 md:left-[28%]"
      >
        {/* A short silent loop of the finished site (lights going on and off, the crane idling), so the
            opening screen feels alive without loading the 3D scene. The still is its first frame. */}
        <video
          key={theme}
          aria-hidden
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={`/hero/site-${theme}.webp`}
          className="size-full object-cover object-[30%_55%]"
        >
          <source src={`/hero/site-${theme}.webm`} type="video/webm" />
          <source src={`/hero/site-${theme}.mp4`} type="video/mp4" />
        </video>
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent md:via-ink/40" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />

      <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-10 pt-32 md:px-10 md:pb-20">
        <div className="max-w-[640px]">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: INTRO, duration: 1, ease: EASE }}
            className="mb-6 inline-flex items-center gap-2.5 rounded-full bg-white/[0.05] py-1 pl-1 pr-3 ring-1 ring-white/10"
          >
            <span className="rounded-full bg-hivis px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-coal">
              New
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-bone/70">
              AI infrastructure for Indian construction
            </span>
          </motion.p>

          <Words
            as="h1"
            immediate
            delay={INTRO - 0.1}
            text="Every rupee on site, | *accounted for.*"
            className="text-[clamp(2.6rem,5vw,5rem)] font-medium leading-[0.97] tracking-[-0.05em]"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: INTRO + 0.5, duration: 1, ease: EASE }}
            className="mt-5 max-w-[42ch] text-base leading-relaxed text-bone/60 md:text-lg"
          >
            Supervisors send WhatsApp voice notes. Vera turns them into the site record and finds the material
            walking off.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: INTRO + 0.7, duration: 1, ease: EASE }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <button
              type="button"
              onClick={() => setDemo(true)}
              onPointerEnter={preload}
              onFocus={preload}
              data-cursor="Play"
              className="group inline-flex items-center gap-3 rounded-full bg-hivis py-1.5 pl-1.5 pr-6 text-sm font-medium text-coal transition-transform duration-500 ease-vera hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="relative flex size-9 items-center justify-center rounded-full bg-coal/10">
                <span className="absolute inset-0 animate-ping rounded-full bg-coal/10 [animation-duration:2.4s]" />
                <Play size={15} weight="fill" />
              </span>
              Watch the demo
            </button>
            <PillButton href="#book" variant="ghost">
              Get a free leak check
            </PillButton>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: INTRO + 1, duration: 1 }}
            className="mt-10 text-[11px] font-medium uppercase tracking-[0.18em] text-bone/40"
          >
            For contractors doing ₹50–500 Cr a year
          </motion.p>
        </div>
      </div>

      <AnimatePresence>{demo && <Demo onClose={() => setDemo(false)} />}</AnimatePresence>
    </section>
  );
}
