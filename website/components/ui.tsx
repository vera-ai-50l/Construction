"use client";

import Lenis from "lenis";
import { ArrowUpRight, Moon, Sun } from "@phosphor-icons/react";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useInView,
  useSpring,
} from "motion/react";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;
export const INTRO = 2.1; // seconds the preloader holds the stage

// Swap these for the real booking links.
export const CONTACT = {
  whatsapp: "https://wa.me/910000000000",
  email: "mailto:hello@example.com",
};

export function formatINR(n: number) {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(1)} L`;
  return `${sign}₹${Math.round(a).toLocaleString("en-IN")}`;
}

/** "Every *rupee answer.*" → words, with *…* spans flagged for the serif italic. "|" is a line break. */
export function parse(text: string) {
  let em = false;
  return text.split(" ").map((raw) => {
    if (raw === "|") return null;
    let w = raw;
    if (w.startsWith("*")) {
      em = true;
      w = w.slice(1);
    }
    const end = w.endsWith("*");
    if (end) w = w.slice(0, -1);
    const item = { w, em };
    if (end) em = false;
    return item;
  });
}

export function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = matchMedia(query);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return match;
}

export type Theme = "dark" | "light";

function watchTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    watchTheme,
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    () => "dark",
  );
}

/** Sun/moon switch. The new palette wipes in as a circle from the button (View Transitions where supported). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const flip = (e: MouseEvent<HTMLButtonElement>) => {
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("vera-theme", next);
      } catch {}
    };
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document
      .startViewTransition(apply)
      .ready.then(() =>
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
          { duration: 950, easing: "cubic-bezier(0.32, 0.72, 0, 1)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {}); // skipped (e.g. tab hidden): the theme still applied, just without the wipe
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${next} mode`}
      className={`relative flex size-9 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-bone/80 ring-1 ring-white/10 transition-colors duration-500 ease-vera hover:bg-white/10 hover:text-bone ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 16, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -16, rotate: 90, opacity: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="flex"
        >
          {theme === "dark" ? <Sun size={16} weight="light" /> : <Moon size={16} weight="light" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.09 });
    return () => lenis.destroy();
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Cursor />
    </MotionConfig>
  );
}

function Cursor() {
  const on = useMedia("(pointer: fine)");
  const [hover, setHover] = useState(false);
  const [label, setLabel] = useState("");
  const x = useSpring(-100, { stiffness: 600, damping: 45, mass: 0.3 });
  const y = useSpring(-100, { stiffness: 600, damping: 45, mass: 0.3 });

  useEffect(() => {
    if (!on) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = (e.target as Element | null)?.closest?.("a,button,input,[data-cursor]");
      setHover(!!t);
      setLabel(t?.getAttribute("data-cursor") ?? "");
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [on, x, y]);

  if (!on) return null;
  return (
    <motion.div
      aria-hidden
      style={{ x, y }}
      className="pointer-events-none fixed left-0 top-0 z-[90] mix-blend-difference"
    >
      <motion.div
        animate={{ scale: label ? 1 : hover ? 0.5 : 0.14 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="-ml-10 -mt-10 flex size-20 items-center justify-center rounded-full bg-[#fff] text-[10px] font-medium uppercase tracking-[0.2em] text-[#000]"
      >
        {label}
      </motion.div>
    </motion.div>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 48,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 1.1, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const wordVariants = {
  hidden: { y: "105%", opacity: 0, filter: "blur(8px)" },
  show: { y: "0%", opacity: 1, filter: "blur(0px)", transition: { duration: 1.1, ease: EASE } },
};

/** Masked, blurred word-by-word headline reveal. */
export function Words({
  text,
  className,
  delay = 0,
  as = "h2",
  immediate = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p";
  immediate?: boolean;
}) {
  const Tag = motion[as];
  const trigger = immediate
    ? { animate: "show" }
    : { whileInView: "show", viewport: { once: true, margin: "-8% 0px" } };
  return (
    <Tag
      className={className}
      initial="hidden"
      {...trigger}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: delay } } }}
    >
      {parse(text).map((it, i) =>
        it === null ? (
          <br key={i} />
        ) : (
          <Fragment key={i}>
            <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
              <motion.span
                variants={wordVariants}
                className={`inline-block ${it.em ? "font-serif font-normal italic tracking-[-0.02em]" : ""}`}
              >
                {it.w}
              </motion.span>
            </span>{" "}
          </Fragment>
        ),
      )}
    </Tag>
  );
}

export function Eyebrow({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ${
        tone === "dark" ? "bg-white/5 text-bone/70 ring-1 ring-white/10" : "bg-ink/5 text-ink/60 ring-1 ring-ink/10"
      }`}
    >
      <span className="size-1.5 rounded-full bg-hivis" />
      {children}
    </span>
  );
}

const PILL = {
  hivis: ["bg-hivis text-coal", "bg-coal/10"],
  light: ["bg-bone text-ink", "bg-ink/10"],
  dark: ["bg-ink text-bone", "bg-white/10"],
  ghost: ["bg-white/[0.06] text-bone ring-1 ring-white/15 hover:bg-white/10", "bg-white/10"],
} as const;

/** Magnetic pill with the arrow nested in its own circle. */
export function PillButton({
  href,
  children,
  variant = "hivis",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof PILL;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 16, mass: 0.5 });
  const y = useSpring(0, { stiffness: 220, damping: 16, mass: 0.5 });
  const [shell, icon] = PILL[variant];
  const external = href.startsWith("http") || href.startsWith("mailto");
  return (
    <motion.a
      ref={ref}
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.22);
        y.set((e.clientY - r.top - r.height / 2) * 0.35);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileTap={{ scale: 0.97 }}
      className={`group inline-flex items-center gap-3 rounded-full py-1.5 pl-6 pr-1.5 text-sm font-medium tracking-[-0.01em] transition-colors duration-500 ease-vera ${shell} ${className}`}
    >
      <span>{children}</span>
      <span
        className={`flex size-9 items-center justify-center rounded-full transition-transform duration-500 ease-vera group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105 ${icon}`}
      >
        <ArrowUpRight size={16} weight="light" className="transition-transform duration-500 ease-vera group-hover:rotate-45" />
      </span>
    </motion.a>
  );
}

/** Counts up once when scrolled into view. */
export function Counter({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, {
      duration: 1.8,
      ease: EASE,
      onUpdate: (v) => ref.current && (ref.current.textContent = v.toFixed(decimals)),
    });
    return () => c.stop();
  }, [inView, to, decimals]);
  return (
    <span ref={ref} className="tabular-nums">
      {(0).toFixed(decimals)}
    </span>
  );
}

const GLYPHS = "▚▞▖▘▝▗#%&*+=<>/0123456789";

/** Text that decodes from noise when it enters the viewport. */
export function Scramble({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now() + delay * 1000;
    const tick = (now: number) => {
      const n = Math.floor(Math.max(0, (now - start) / 650) * text.length);
      if (ref.current)
        ref.current.textContent = [...text]
          .map((ch, i) => (i < n || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join("");
      if (n < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, text, delay]);
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}

/** Live India Standard Time. Renders nothing on the server to avoid a hydration mismatch. */
export function Clock({ withSeconds = true }: { withSeconds?: boolean }) {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds ? "2-digit" : undefined,
      hour12: false,
    });
    const tick = () => setNow(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [withSeconds]);
  return <span className="tabular-nums">{now || "--:--"} IST</span>;
}

/** Double-bezel shell: a machined tray holding an inner plate. */
export function Bezel({
  children,
  className = "",
  inner = "",
  tone = "dark",
}: {
  children: ReactNode;
  className?: string;
  inner?: string;
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={`rounded-[2rem] p-1.5 ${
        tone === "dark" ? "bg-white/[0.035] ring-1 ring-white/10" : "bg-ink/[0.04] ring-1 ring-ink/[0.07]"
      } ${className}`}
    >
      <div
        className={`h-full rounded-[calc(2rem-0.375rem)] ${
          tone === "dark"
            ? "bg-ink-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
            : "bg-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_30px_60px_-30px_rgba(40,30,20,0.18)]"
        } ${inner}`}
      >
        {children}
      </div>
    </div>
  );
}
