"use client";

import { Buildings, CheckCircle, FilePdf, Package, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { EASE, Eyebrow, Reveal, Words } from "./ui";

const LINES = [
  { Icon: CheckCircle, text: "31 of 32 supervisors reported" },
  { Icon: Buildings, text: "Wakad: 4th-floor slab done · Nagpur raft 60%" },
  { Icon: UsersThree, text: "186 labour on site (−12 vs plan)" },
  { Icon: WarningCircle, text: "Money at risk: RA-04 unpaid 74 days · ₹38.6 L", hot: true },
  { Icon: Package, text: "Cement short at Indore by Thu · reorder sent" },
  { Icon: FilePdf, text: "Weekly claim PDF is ready" },
];

export default function EightAM() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [7, -5]);
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);

  return (
    <section ref={ref} className="relative -mt-10 overflow-hidden rounded-t-[2.5rem] bg-bone px-4 py-28 text-ink md:px-10 md:py-40">
      <div className="mx-auto grid max-w-[1440px] items-center gap-16 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Eyebrow tone="light">03 — 8:00 AM</Eyebrow>
          <Reveal>
            <p className="mt-8 font-serif text-[clamp(6rem,17vw,15rem)] leading-[0.8] tracking-[-0.04em]">
              08<span className="animate-pulse text-hivis">:</span>00
            </p>
          </Reveal>
          <Words
            text="One page. Every site. | *Before your first chai.*"
            className="mt-8 text-[clamp(2.2rem,4.6vw,4.4rem)] font-medium leading-[0.98] tracking-[-0.045em]"
          />
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-ink/60">
              While supervisors are still on their way to site, you already know what got done, who showed up, what
              ran short and which rupees are at risk. On WhatsApp, where you already are.
            </p>
          </Reveal>
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-4 border-t border-ink/10 pt-6">
            {[
              ["90%+", "supervisors reporting daily, the target we hold"],
              ["0", "new apps for anyone on site"],
              ["2–3 wks", "to go live, tested on one site first"],
            ].map(([k, v], i) => (
              <Reveal key={k} delay={0.1 * i}>
                <p className="text-3xl font-medium tracking-[-0.04em] md:text-4xl">{k}</p>
                <p className="mt-2 text-[13px] leading-snug text-ink/50">{v}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="flex justify-center lg:col-span-5">
          <motion.div style={{ rotate, y }} className="w-full max-w-[340px]">
            <div className="rounded-[3.2rem] bg-ink/[0.06] p-2 ring-1 ring-ink/10 shadow-[0_60px_100px_-40px_rgba(40,30,20,0.45)]">
              <div className="overflow-hidden rounded-[calc(3.2rem-0.5rem)] bg-ink p-2.5">
                <div className="overflow-hidden rounded-[2.4rem] bg-ink-2 text-bone">
                  <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 pb-4 pt-7">
                    <span className="flex size-9 items-center justify-center rounded-full bg-hivis font-semibold text-coal">V</span>
                    <div>
                      <p className="text-sm font-medium">Vera · Site Desk</p>
                      <p className="text-[11px] text-bone/45">online</p>
                    </div>
                  </div>

                  <motion.div
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-25% 0px" }}
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.28, delayChildren: 0.4 } } }}
                    className="flex min-h-[470px] flex-col gap-3 px-4 py-5"
                  >
                    <span className="self-center rounded-full bg-white/[0.06] px-3 py-1 text-[10px] text-bone/50">Today</span>
                    <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-white/[0.07] p-3.5">
                      <p className="text-[13px] font-semibold">Daily summary · Wed 28 Oct</p>
                      <ul className="mt-2.5 space-y-2">
                        {LINES.map(({ Icon, text, hot }) => (
                          <motion.li
                            key={text}
                            variants={{
                              hidden: { opacity: 0, x: -8, filter: "blur(4px)" },
                              show: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
                            }}
                            className={`flex gap-2 text-[12px] leading-snug ${hot ? "text-hivis" : "text-bone/80"}`}
                          >
                            <Icon size={14} weight="light" className="mt-px shrink-0" />
                            {text}
                          </motion.li>
                        ))}
                      </ul>
                      <p className="mt-2 text-right font-mono text-[9px] text-bone/35">08:00</p>
                    </div>
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 10, scale: 0.95 },
                        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } },
                      }}
                      className="max-w-[75%] self-end rounded-2xl rounded-tr-md bg-hivis/90 p-3 text-coal"
                    >
                      <p className="text-[12px] font-medium">Call the client’s PMC about RA-04.</p>
                      <p className="mt-1 text-right font-mono text-[9px] text-coal/60">08:03 ✓✓</p>
                    </motion.div>
                    <motion.div
                      variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                      className="flex w-14 items-center justify-center gap-1 rounded-2xl rounded-tl-md bg-white/[0.07] px-3 py-3"
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="size-1.5 rounded-full bg-bone/60"
                          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: [0.45, 0, 0.55, 1] }}
                        />
                      ))}
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
