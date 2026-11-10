"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { preload } from "react-dom";
import { lockScroll } from "./ui";

/*
 * Opening: "Vera AI", highlighted, holds still in the middle of the screen while newspaper clippings
 * cut behind it, then the paper lifts off the site. Drawn in the page (no video), so it fills any
 * screen and carries no watermark.
 *
 * Smoothness: every clipping is laid out once, up front, and the cuts only flip visibility. The cut
 * shown is picked from the clock on each animation frame, so a slow moment skips a cut instead of
 * freezing on one. Nothing moves between cuts, so the edge blur is only redrawn when the page changes.
 */

export const CUTS = 25;
export const CUT_MS = 48; // three frames on a 60 Hz screen
const HOLD_MS = 120;
const ZOOM_S = 0.55; // the dive into the highlight that ends the intro
/** Seconds from the start of the cuts until the paper lifts. */
export const INTRO_LIFT = (CUTS * CUT_MS + HOLD_MS) / 1000;

const MARK = "Vera AI";

// The line the highlight sits in, per cut: [before, after, headline?]. Short, so the line fits one column.
const ANCHORS: [string, string, boolean?][] = [
  ["firms now using", "save"],
  ["Why Builders Adopt", "", true],
  ["supervisors use", "daily"],
  ["records kept by", "hold"],
  ["Investors Now Eye", "", true],
  ["an audit by", "found it"],
  ["the owners say", "works"],
  ["Inside the", "Rollout", true],
  ["the pilot of", "ran well"],
  ["a new report on", "said"],
  ["mid-size firms pick", ""],
  ["Pune Builder Backs", "", true],
  ["site engineers like", ""],
  ["the board reviewed", ""],
  ["officials cited", "logs"],
  ["Lenders Now Want", "", true],
  ["a supervisor said", ""],
  ["in Indore,", "found more"],
  ["The Steady Rise of", "", true],
  ["four sites on", "grew"],
  ["site teams now trust", ""],
  ["More Contractors Try", "", true],
  ["the data from", "showed"],
  ["the bill from", "cleared"],
  ["Why Builders Choose", "", true],
  ["project managers cite", ""],
  ["checks by", "cut waste"],
  ["A Steel Audit by", "", true],
  ["soon after", "went live"],
  ["Every Site Now on", "", true],
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
type Cut = { anchor: (typeof ANCHORS)[number]; above: Block[]; below: Block[]; cols: { k: number; off: number; blocks: Block[] }[] };

function makeCut(n: number): Cut {
  const r = rng(n * 7919 + 13);
  let hi = Math.floor(r() * HEADLINES.length);
  const head = () => HEADLINES[hi++ % HEADLINES.length]; // walk the list so a column never repeats a headline
  const col = () => {
    const blocks: Block[] = [];
    for (let j = 0; j < 3; j++) {
      if (r() < 0.45) blocks.push({ h: head() });
      blocks.push({ p: prose(r, 2 + Math.floor(r() * 3)) });
    }
    return blocks;
  };
  return {
    anchor: ANCHORS[n % ANCHORS.length],
    above: r() < 0.35 ? [{ p: prose(r, 2) }, { h: head() }] : [{ p: prose(r, 4) }],
    below: [{ p: prose(r, 3) }, { h: head() }, { p: prose(r, 4) }],
    cols: [-2, -1, 1, 2].map((k) => ({ k, off: 3 + Math.floor(r() * 14), blocks: col() })),
  };
}

const CUTS_DATA = Array.from({ length: CUTS }, (_, n) => makeCut(n));

// Crumpled paper: one small image, flipped and shifted on each cut so every clipping looks like a new page.
const PAPER = "/hero/paper.webp";
const paperAt = (n: number) =>
  `translate(${(n % 4) - 1.5}%, ${((n * 3) % 5) - 2}%) scale(${n % 2 ? -1.08 : 1.08}, ${n % 3 ? 1.08 : -1.08}) rotate(${((n % 3) - 1) * 0.6}deg)`;

const AY = "42vh"; // where the highlight sits, from the top
const MARK_LH = "calc(var(--lh) * 1.45)"; // the highlight line is taller: the mark is set larger

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

const column = (k: number): CSSProperties => ({
  left: `calc(50% - var(--cw) / 2 + ${k} * (var(--cw) + var(--g)))`,
  width: "var(--cw)",
});

function Clipping({ cut, hidden, setRef }: { cut: Cut; hidden: boolean; setRef: (el: HTMLDivElement | null) => void }) {
  const [before, after, headline] = cut.anchor;
  return (
    <div ref={setRef} className="absolute inset-0 text-[#1d1a16]" style={{ visibility: hidden ? "hidden" : "visible" }}>
      {cut.cols.map((c) => (
        <div key={c.k} className="absolute" style={{ ...column(c.k), top: `calc(${AY} - ${c.off} * var(--lh))` }}>
          <Blocks blocks={c.blocks} />
        </div>
      ))}
      {/* Centre column: text above ends on the highlight line, text below starts after it. */}
      <div className="absolute flex flex-col justify-end overflow-hidden" style={{ ...column(0), bottom: `calc(100% - ${AY})`, top: 0 }}>
        <Blocks blocks={cut.above} />
      </div>
      <div
        className={`absolute flex items-center gap-x-[0.3em] overflow-hidden whitespace-nowrap ${headline ? "font-bold" : ""}`}
        style={{ ...column(0), top: AY, height: MARK_LH }}
      >
        {before.split(" ").map((w, i) => (
          <span key={`b${i}`}>{w}</span>
        ))}
        <span
          data-mark
          className="shrink-0 rounded-[3px] bg-[#ffd84a] px-[0.16em] text-[1.42em] font-bold leading-[1.15] text-[#111] shadow-[0_0_0_1px_rgba(255,216,74,0.6)]"
        >
          {MARK}
        </span>
        {after
          .split(" ")
          .filter(Boolean)
          .map((w, i) => (
            <span key={`a${i}`}>{w}</span>
          ))}
      </div>
      <div className="absolute" style={{ ...column(0), top: `calc(${AY} + ${MARK_LH})` }}>
        <Blocks blocks={cut.below} />
      </div>
    </div>
  );
}

export default function Preloader() {
  // The server draws the first cut; once hydrated, the browser adds the rest.
  const all = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [done, setDone] = useState(false);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const paperEl = useRef<HTMLDivElement>(null);
  const blurEl = useRef<HTMLDivElement>(null);
  preload(PAPER, { as: "image", fetchPriority: "high" });

  useEffect(() => lockScroll(true), []);

  // Once every cut is laid out: put each cut's highlight dead centre, then run the cuts off the clock.
  useLayoutEffect(() => {
    if (!all) return;
    layers.current.forEach((el) => {
      const mark = el?.querySelector<HTMLElement>("[data-mark]");
      if (!el || !mark) return;
      el.style.transform = "";
      const r = mark.getBoundingClientRect();
      el.style.transform = `translateX(${innerWidth / 2 - (r.left + r.width / 2)}px)`;
    });

    // The intro plays for everyone, including systems set to reduce motion (Windows turns animation
    // effects off on many laptops): it is the opening of the site, it is short, and any click skips it.
    let raf = 0;
    let shown = 0;
    const show = (n: number) => {
      if (n === shown) return;
      const prev = layers.current[shown];
      const next = layers.current[n];
      if (prev) prev.style.visibility = "hidden";
      if (next) next.style.visibility = "visible";
      if (paperEl.current) paperEl.current.style.transform = paperAt(n);
      shown = n;
    };
    // One clipping per step, never skipped: every page is on screen for at least one painted frame,
    // so the cut is always visible. A slow device just runs a little longer (capped).
    let last = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = last = now;
      if (shown < CUTS - 1) {
        if (now - last >= CUT_MS) {
          show(shown + 1);
          last = now;
        }
      } else if (now - last >= CUT_MS + HOLD_MS) {
        if (blurEl.current) blurEl.current.style.display = "none";
        setDone(true);
        return;
      }
      if (now - start > 6000) {
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    // Start the clock only once the first page has actually been painted.
    raf = requestAnimationFrame(() => (raf = requestAnimationFrame(tick)));

    // Any click or key skips straight to the site.
    const skip = () => setDone(true);
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [all]);

  useEffect(() => {
    if (done) lockScroll(false);
  }, [done]);

  return (
    // The intro is the opening of the site, so it always animates, whatever the system motion setting.
    <MotionConfig reducedMotion="never">
      <AnimatePresence>
        {!done && (
          <motion.div
            key="intro"
            aria-label="Vera AI"
            role="img"
            // Ends by diving into the highlight: the page scales up around "Vera AI" and fades onto the site.
            exit={{ scale: 26, opacity: [1, 1, 0] }}
            transition={{ duration: ZOOM_S, ease: [0.6, 0, 0.9, 0.4], opacity: { duration: ZOOM_S, times: [0, 0.55, 1] } }}
            className="fixed inset-0 z-[100] select-none overflow-hidden bg-[#ece6d9] [--cw:17em] [--g:1.6em] [--lh:calc(1em*1.5)]"
            style={{
              fontFamily: 'Georgia, "Times New Roman", Times, serif',
              fontSize: "clamp(18px, 1.75vw, 32px)",
              lineHeight: 1.5,
              transformOrigin: `50% calc(${AY} + 1.0875em)`,
            }}
          >
            <div className="absolute inset-0">
              <div
                ref={paperEl}
                aria-hidden
                className="absolute -inset-[6%]"
                style={{ backgroundImage: `url(${PAPER})`, backgroundSize: "cover", transform: paperAt(0) }}
              />
              {(all ? CUTS_DATA : CUTS_DATA.slice(0, 1)).map((cut, n) => (
                <Clipping key={n} cut={cut} hidden={n !== 0} setRef={(el) => void (layers.current[n] = el)} />
              ))}
            </div>
            {/* Sharp around the highlight, soft towards the edges, like a close-up shot of a page. */}
            <div
              aria-hidden
              ref={blurEl}
              className="absolute inset-0 [backdrop-filter:blur(2.2px)] [-webkit-backdrop-filter:blur(2.2px)]"
              style={{
                maskImage: `radial-gradient(ellipse 32vw 17vh at 50% ${AY}, transparent 35%, black 100%)`,
                WebkitMaskImage: `radial-gradient(ellipse 32vw 17vh at 50% ${AY}, transparent 35%, black 100%)`,
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
    </MotionConfig>
  );
}
