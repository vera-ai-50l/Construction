"use client";

import { ArrowLeft, ArrowUpRight, CalendarBlank, EnvelopeSimple, VideoCamera, WhatsappLogo, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CONTACT, EASE, emailHref, lockScroll, whatsappHref } from "./ui";

/** Any link to "#book" on any page opens this dialog instead of jumping to the section. */
export const openBooking = () => window.dispatchEvent(new Event("vera:book"));

export default function Booking() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"choose" | "calendar">("choose");
  const panel = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = () => {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setView("choose");
      setOpen(true);
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href="#book"]');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      show();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("vera:book", show);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("vera:book", show);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("button, a")?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      lockScroll(false);
      lastFocus.current?.focus?.();
    };
  }, [open]);

  const wa = whatsappHref();
  const mail = emailHref();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="booking"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-3 backdrop-blur-md sm:items-center sm:p-6"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          data-lenis-prevent
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: EASE }}
            className={`relative w-full overflow-hidden rounded-[2rem] bg-[#121110] text-[#f4f1ec] shadow-2xl ring-1 ring-white/10 ${
              view === "calendar" ? "max-w-4xl" : "max-w-xl"
            }`}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5 md:px-8">
              <div className="flex items-center gap-3">
                {view === "calendar" && (
                  <button
                    type="button"
                    onClick={() => setView("choose")}
                    aria-label="Back to booking options"
                    className="flex size-9 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <ArrowLeft size={16} weight="light" />
                  </button>
                )}
                <div>
                  <h2 id="booking-title" className="text-xl font-medium tracking-[-0.03em]">
                    {view === "calendar" ? "Pick a time for a Google Meet" : "Book your free leak check"}
                  </h2>
                  <p className="mt-0.5 text-sm text-white/50">
                    {view === "calendar" ? "30 minutes with the founders." : "A 30-minute call to see if the check fits your sites."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/10"
              >
                <X size={16} weight="light" />
              </button>
            </div>

            {view === "calendar" && CONTACT.calendar ? (
              <div className="bg-white">
                <iframe
                  src={`${CONTACT.calendar}${CONTACT.calendar.includes("?") ? "&" : "?"}gv=true`}
                  title="Book a Google Meet with Vera AI"
                  className="h-[min(640px,70vh)] w-full border-0"
                />
              </div>
            ) : (
              <div className="space-y-3 p-6 md:p-8">
                {/* Options without a link set in CONTACT are left out. */}
                {CONTACT.calendar && (
                  <Option
                    icon={<VideoCamera size={20} weight="light" />}
                    title="Schedule a Google Meet"
                    note="Choose a time that suits you. The invite comes with a Meet link."
                    primary
                    onClick={() => setView("calendar")}
                  />
                )}
                {wa && (
                  <Option
                    icon={<WhatsappLogo size={20} weight="light" />}
                    title="Message us on WhatsApp"
                    note="Opens WhatsApp with the message written. Just press send."
                    href={wa}
                    primary={!CONTACT.calendar}
                  />
                )}
                {mail && (
                  <Option
                    icon={<EnvelopeSimple size={20} weight="light" />}
                    title="Write to us"
                    note={CONTACT.email}
                    href={mail}
                  />
                )}
                <p className="flex items-center gap-2 pt-2 text-xs text-white/40">
                  <CalendarBlank size={14} weight="light" /> We reply within one working day.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Option({
  icon,
  title,
  note,
  href,
  onClick,
  primary,
}: {
  icon: ReactNode;
  title: string;
  note: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const ready = !!(href || onClick);
  const cls = `group flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-1 transition-colors duration-300 ${
    primary ? "bg-[#ff5b1f] text-[#0a0a09] ring-[#ff5b1f]" : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]"
  } ${ready ? "" : "pointer-events-none opacity-45"}`;
  const body = (
    <>
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-full ${primary ? "bg-black/10" : "bg-white/[0.06]"}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className={`block truncate text-sm ${primary ? "text-black/65" : "text-white/50"}`}>
          {ready ? note : "Coming soon"}
        </span>
      </span>
      <ArrowUpRight size={16} weight="light" className="shrink-0 transition-transform duration-300 group-hover:rotate-45" />
    </>
  );
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
      </a>
    );
  return (
    <button type="button" onClick={onClick} disabled={!ready} className={cls}>
      {body}
    </button>
  );
}
