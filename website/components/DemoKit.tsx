"use client";

import { ArrowBendUpLeft, ArrowRight, ArrowSquareOut, Check, Code, Lightning } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { EASE } from "./ui";

export const N8N = "https://n8n.trykyre.com";
const STEP_MS = 520;

/** POSTs to an n8n webhook while stepping through its nodes (webhook + code nodes + respond), so the room sees the pipeline run. */
export function useFlow<T>(path: string, nodes: number) {
  const [step, setStep] = useState(-1);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");

  async function run(body: unknown) {
    setError("");
    setStep(0);
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, nodes - 1)), STEP_MS);
    try {
      const [res] = await Promise.all([
        fetch(`${N8N}/webhook/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        new Promise((r) => setTimeout(r, nodes * STEP_MS)),
      ]);
      if (!res.ok) throw new Error(`n8n answered ${res.status}`);
      setData((await res.json()) as T);
      setStep(nodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep(-1);
    } finally {
      clearInterval(tick);
    }
  }

  return { step, busy: step >= 0 && step < nodes, data, error, run };
}

/** The n8n canvas, one chip per node, lit as the run reaches it. */
export function Pipeline({ nodes, step, workflow }: { nodes: string[]; step: number; workflow: string }) {
  const all = ["Webhook", ...nodes, "Respond"];
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-bone/40">n8n workflow</p>
        <a
          href={`${N8N}/workflow/${workflow}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-bone/40 transition-colors hover:text-hivis"
        >
          Open canvas <ArrowSquareOut size={12} weight="light" />
        </a>
      </div>
      <ol className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {all.map((name, i) => {
          const state = step > i ? "done" : step === i ? "live" : "idle";
          const Icon = i === 0 ? Lightning : i === all.length - 1 ? ArrowBendUpLeft : Code;
          return (
            <li key={name} className="flex items-center gap-1.5">
              <span
                className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] ring-1 transition-colors duration-300 ${
                  state === "done"
                    ? "bg-white/[0.06] text-bone ring-white/15"
                    : state === "live"
                      ? "bg-hivis/15 text-bone ring-hivis/70"
                      : "bg-white/[0.02] text-bone/40 ring-white/[0.07]"
                }`}
              >
                {state === "live" && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-xl ring-2 ring-hivis/50"
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  />
                )}
                {state === "done" ? (
                  <Check size={13} weight="bold" className="text-hivis" />
                ) : (
                  <Icon size={13} weight="light" />
                )}
                {name}
              </span>
              {i < all.length - 1 && <ArrowRight size={11} weight="light" className="text-bone/25" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RunButton({ onClick, busy, children }: { onClick: () => void; busy: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={busy}
      whileTap={{ scale: 0.97 }}
      className="group inline-flex items-center gap-3 rounded-full bg-hivis py-1.5 pl-6 pr-1.5 text-sm font-medium tracking-[-0.01em] text-ink transition-opacity disabled:opacity-60"
    >
      <span>{busy ? "Running in n8n…" : children}</span>
      <span className="flex size-9 items-center justify-center rounded-full bg-ink/10 transition-transform duration-500 ease-vera group-hover:translate-x-0.5">
        {busy ? (
          <motion.span
            className="size-3.5 rounded-full border-2 border-ink/30 border-t-ink"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <ArrowRight size={16} weight="light" />
        )}
      </span>
    </motion.button>
  );
}

/** Fades a result block in once data arrives. */
export function Arrive({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl bg-hivis/10 px-4 py-3 text-sm text-hivis ring-1 ring-hivis/30">
      Couldn’t reach n8n ({error}). Check the connection and press run again.
    </p>
  );
}
