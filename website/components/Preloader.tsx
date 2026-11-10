"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { lockScroll } from "./ui";

/*
 * Opening: "Vera AI", highlighted, holds still in the middle of the screen while newspaper clippings
 * flash behind it, eight a second, then the paper lifts off the site. Everything is drawn in the
 * page (no video), so it fills any screen and carries no watermark.
 */

export const CUTS = 20;
export const CUT_MS = 125;
const HOLD_MS = 250;
/** Seconds until the paper starts to lift; the hero times its entrance from here. */
export const INTRO_LIFT = (CUTS * CUT_MS + HOLD_MS) / 1000;

const MARK = "Vera AI";

// The line the highlight sits in, per cut: [words before, words after, headline?]
const ANCHORS: [string, string, boolean?][] = [
  ["contractors using", "found the cement"],
  ["Builders Adopt", "on Sites", true],
  ["supervisors report to", "by voice"],
  ["records kept by", "held up in court"],
  ["Investors Eye", "as Waste Falls", true],
  ["the audit by", "traced 59 bags"],
  ["promoters say", "caught the gap"],
  ["Leaders Discuss", "and Site Data", true],
  ["the pilot with", "ran on four sites"],
  ["a report on", "found 2 to 5%"],
  ["mid-size firms pick", "for the record"],
  ["Pune Firm Credits", "for Savings", true],
  ["engineers praised", "at 8 AM daily"],
  ["the board reviewed", "on steel issues"],
  ["officials cited the", "record in court"],
  ["Builders Back", "on Bills", true],
  ["a supervisor said", "logged the slab"],
  ["in Indore the", "check found steel"],
  ["Lenders Ask for", "Site Records", true],
  ["by the quarter end", "was on every site"],
];

const HEADLINES = [
  "Cement Prices Climb Again as Monsoon Delays Supply",
  "City Approves New Metro Corridor Plan",
  "Steel Mills Report Record Quarter",
  "Contractors Count the Cost of Unmatched Challans",
  "RERA Tightens Rules on Project Delays",
  "Housing Starts Rise in Tier 2 Cities",
  "Builders Push for Faster Bill Payments",
  "Infra Spending Set to Double by 2030",
  "Labour Shortage Hits Site Schedules",
  "Ready-Mix Plants Expand Near Highways",
  "Arbitration Cases Over Delays Pile Up",
  "Site Safety Audits Find Gaps",
];

const SENTENCES = [
  "Contractors across the state reported a sharp rise in the price of cement this quarter.",
  "The delivery challans for the third tower were matched against the purchase orders on Monday.",
  "Officials said the new metro corridor would be completed in two phases.",
  "Site engineers flagged a shortfall of steel on the fourth floor slab.",
  "The firm said its running bills were now paid eleven days faster than last year.",
  "Supervisors on the project send daily progress updates over WhatsApp.",
  "A senior project manager reviewed the plan against actual progress for every site.",
  "The developer expects to hand over the first two towers before the monsoon.",
  "Labour availability remained tight across Pune and Nashik through October.",
  "Auditors traced the missing bags from the store register to the measured work.",
  "Ready-mix suppliers raised rates for the second time this year.",
  "The client approved the revised drawings after a week of review.",
  "Retention money held on completed work has become a concern for small firms.",
  "Lenders are asking builders for site records before releasing the next tranche.",
  "The hindrance register showed nine days lost to late approvals.",
  "Arbitration over the delay is expected to take more than a year.",
  "Industry groups called for faster payments on public projects.",
  "The company plans to open three new sites in Indore and Nagpur.",
  "Every bag of cement issued from the store is now logged against the BOQ.",
  "Officials will inspect the site again before the slab is cast.",
  "The board approved the budget for the next phase of the housing project.",
  "Residents welcomed the decision to widen the road near the site.",
  "Steel deliveries arrived on time for the first time since June.",
  "The contractor has submitted the seventh running bill for measurement.",
];

/** Small deterministic RNG so the server and the browser draw the same clippings. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prose(r: () => number, n: number) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(SENTENCES[Math.floor(r() * SENTENCES.length)]);
  return out.join(" ");
}

type Block = { h?: string; p?: string };
type Cut = { anchor: (typeof ANCHORS)[number]; above: Block[]; below: Block[]; cols: { off: number; blocks: Block[] }[]; paper: number };

function makeCut(k: number): Cut {
  const r = rng(k * 7919 + 13);
  const col = () => {
    const blocks: Block[] = [];
    for (let j = 0; j < 4; j++) {
      if (r() < 0.45) blocks.push({ h: HEADLINES[Math.floor(r() * HEADLINES.length)] });
      blocks.push({ p: prose(r, 3 + Math.floor(r() * 4)) });
    }
    return blocks;
  };
  return {
    anchor: ANCHORS[k % ANCHORS.length],
    above: r() < 0.35 ? [{ p: prose(r, 2) }, { h: HEADLINES[Math.floor(r() * HEADLINES.length)] }] : [{ p: prose(r, 5) }],
    below: [{ p: prose(r, 4) }, { h: HEADLINES[Math.floor(r() * HEADLINES.length)] }, { p: prose(r, 6) }],
    cols: [-3, -2, -1, 1, 2, 3].map(() => ({ off: 4 + Math.floor(r() * 18), blocks: col() })),
    paper: k % 3,
  };
}

const CUTS_DATA = Array.from({ length: CUTS }, (_, k) => makeCut(k));

// Crumpled paper: turbulence lit from the top left, three crumples to cut between.
const paper = (seed: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='900'><filter id='p' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='0.0035 0.006' numOctaves='5' seed='${seed}'/><feDiffuseLighting lighting-color='#efe9dc' surfaceScale='2.4' diffuseConstant='1.05'><feDistantLight azimuth='225' elevation='52'/></feDiffuseLighting></filter><rect width='100%' height='100%' fill='#ece6d9'/><rect width='100%' height='100%' filter='url(#p)' opacity='0.9'/></svg>`,
  )}")`;
const PAPERS = [paper(3), paper(11), paper(29)];

const AY = "42vh"; // where the highlight sits, from the top

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.h ? (
          <p key={i} className="my-[0.35em] text-[1.45em] font-bold leading-[1.12] tracking-[-0.01em]">
            {b.h}
          </p>
        ) : (
          <p key={i} className="indent-[1.2em] [hyphens:auto] [text-align:justify]">
            {b.p}
          </p>
        ),
      )}
    </>
  );
}

function Clipping({ cut }: { cut: Cut }) {
  const [before, after, headline] = cut.anchor;
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = layer.current;
    const mark = el?.querySelector<HTMLElement>("[data-mark]");
    if (!el || !mark) return;
    el.style.transform = "";
    const r = mark.getBoundingClientRect();
    el.style.transform = `translateX(${innerWidth / 2 - (r.left + r.width / 2)}px)`;
  }, [cut]);
  const column = (k: number): CSSProperties => ({
    left: `calc(50% - var(--cw) / 2 + ${k} * (var(--cw) + var(--g)))`,
    width: "var(--cw)",
  });
  return (
    <div ref={layer} className="absolute inset-0 text-[#1d1a16]">
      {cut.cols.map((c, i) => {
        const k = [-3, -2, -1, 1, 2, 3][i];
        return (
          <div key={i} className="absolute" style={{ ...column(k), top: `calc(${AY} - ${c.off} * var(--lh))` }}>
            <Blocks blocks={c.blocks} />
          </div>
        );
      })}
      {/* Centre column: text above ends on the highlight line, text below starts after it. */}
      <div className="absolute flex flex-col justify-end overflow-hidden" style={{ ...column(0), bottom: `calc(100% - ${AY})`, top: 0 }}>
        <Blocks blocks={cut.above} />
      </div>
      <div
        className={`absolute flex items-center justify-between gap-x-[0.3em] whitespace-nowrap ${headline ? "font-bold" : ""}`}
        style={{ ...column(0), top: AY, height: "var(--lh)" }}
      >
        {before.split(" ").map((w, i) => (
          <span key={`b${i}`}>{w}</span>
        ))}
        <span
          data-mark
          className="relative rounded-[2px] bg-[#ffd84a] px-[0.14em] font-bold text-[#111] shadow-[0_0_0_1px_rgba(255,216,74,0.6)]"
        >
          {MARK}
        </span>
        {after.split(" ").map((w, i) => (
          <span key={`a${i}`}>{w}</span>
        ))}
      </div>
      <div className="absolute" style={{ ...column(0), top: `calc(${AY} + var(--lh))` }}>
        <Blocks blocks={cut.below} />
      </div>
    </div>
  );
}

export default function Preloader() {
  const [cut, setCut] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    lockScroll(true);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!still) for (let k = 1; k < CUTS; k++) timers.push(setTimeout(() => setCut(k), k * CUT_MS));
    const finish = () => setDone(true);
    timers.push(setTimeout(finish, INTRO_LIFT * 1000));
    // Any click or key skips straight to the site.
    window.addEventListener("pointerdown", finish, { once: true });
    window.addEventListener("keydown", finish, { once: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("keydown", finish);
    };
  }, []);

  useEffect(() => {
    if (done) lockScroll(false);
  }, [done]);

  const c = CUTS_DATA[cut];

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="intro"
          aria-label="Vera AI"
          role="img"
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[100] select-none overflow-hidden bg-[#ece6d9] [--cw:17em] [--g:1.6em] [--lh:calc(1em*1.5)]"
          style={{
            fontFamily: 'Georgia, "Times New Roman", Times, serif',
            fontSize: "clamp(19px, 1.85vw, 34px)",
            lineHeight: 1.5,
          }}
        >
          {/* Paper: a different crumple, nudged, on every cut. */}
          <div
            aria-hidden
            className="absolute -inset-[4%]"
            style={{
              backgroundImage: PAPERS[c.paper],
              backgroundSize: "cover",
              transform: `translate(${(cut % 4) - 1.5}%, ${((cut * 3) % 5) - 2}%) rotate(${((cut % 3) - 1) * 0.6}deg)`,
            }}
          />
          <Clipping cut={c} />
          {/* Sharp around the highlight, soft towards the edges, like a close-up shot of a page. */}
          <div
            aria-hidden
            className="absolute inset-0 [backdrop-filter:blur(2.2px)] [-webkit-backdrop-filter:blur(2.2px)]"
            style={{
              maskImage: `radial-gradient(ellipse 30vw 16vh at 50% ${AY}, transparent 35%, black 100%)`,
              WebkitMaskImage: `radial-gradient(ellipse 30vw 16vh at 50% ${AY}, transparent 35%, black 100%)`,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse 75% 70% at 50% ${AY}, transparent 55%, rgba(60,45,25,0.22) 100%)` }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
