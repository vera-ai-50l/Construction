'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../ui/icons'
import type { RunRow } from '@/content/runs'

// One "Run the flow" demo per desk. step is -1 before a run, 0..n-1 while running,
// and n once every step has run.
type Phase = 'idle' | 'running' | 'done'
type Ctx = { phase: Phase; step: number; n: number; run: () => void }

const RunCtx = createContext<Ctx | null>(null)
export const useRun = () => useContext(RunCtx)

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

export function RunProvider({ n, children }: { n: number; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [step, setStep] = useState(-1)
  const [ms, setMs] = useState(1500)

  useEffect(() => {
    setMs(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 1500)
  }, [])

  useEffect(() => {
    if (phase !== 'running') return
    const t = setTimeout(() => {
      if (step < n - 1) setStep(step + 1)
      else {
        setStep(n)
        setPhase('done')
      }
    }, step < 0 ? 250 : ms)
    return () => clearTimeout(t)
  }, [phase, step, n, ms])

  const run = useCallback(() => {
    setStep(-1)
    setPhase('running')
  }, [])

  return <RunCtx.Provider value={{ phase, step, n, run }}>{children}</RunCtx.Provider>
}

// Pill button with the icon in its own island. While running, the pill fills like a progress bar.
export function RunButton({ compact = false }: { compact?: boolean }) {
  const r = useRun()
  if (!r) return null
  const { phase, step, n, run } = r
  const progress = phase === 'done' ? 1 : phase === 'running' ? Math.max(step + 1, 0) / n : 0
  const label = phase === 'running' ? `Running · step ${Math.min(Math.max(step + 1, 1), n)} of ${n}` : phase === 'done' ? 'Run again' : 'Run the flow'
  return (
    <button
      type="button"
      onClick={run}
      disabled={phase === 'running'}
      aria-live="polite"
      className={`group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-ink py-2 pl-6 pr-2 text-sm font-medium text-paper transition-transform duration-500 ${EASE} active:scale-[0.98] disabled:cursor-default ${compact ? 'pl-5 text-[13px]' : ''}`}
    >
      {phase === 'idle' && <span className="absolute inset-0 rounded-full bg-rust/40 [animation:pulse-ring_2.2s_cubic-bezier(0.16,1,0.3,1)_infinite]" />}
      <span className={`absolute inset-0 origin-left bg-rust transition-transform duration-[1400ms] ${EASE}`} style={{ transform: `scaleX(${progress})` }} />
      <span className="relative tabular-nums">{label}</span>
      <span className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-transform duration-500 ${EASE} group-hover:translate-x-0.5 group-hover:scale-105`}>
        <Icon name={phase === 'done' ? 'ArrowCounterClockwise' : 'Play'} size={14} weight={phase === 'running' ? 'fill' : 'light'} />
      </span>
    </button>
  )
}

// Before → after board. Each row is caught by one flow step and flips to its fix when that step runs.
export function BeforeAfter({ rows, steps }: { rows: RunRow[]; steps: { title: string }[] }) {
  const r = useRun()
  if (!r) return null
  const { phase, step } = r
  const fixed = (row: RunRow) => phase !== 'idle' && step >= row.step
  const working = (row: RunRow) => phase === 'running' && step === row.step
  const count = rows.filter(fixed).length

  return (
    <div className="mt-12 border-t border-ink/[0.07] pt-10">
      <div className="mb-6 hidden grid-cols-[1fr_3rem_1fr] items-end gap-4 md:grid">
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">
          Before · <span className="text-rust">{rows.length - count} open</span> in your registers today
        </p>
        <span />
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">
          After · <span className="num text-sage">{count}</span> of {rows.length} fixed by Vera
        </p>
      </div>
      <p className="mb-5 text-[11px] uppercase tracking-[0.2em] text-ink-3 md:hidden">
        Before → after · <span className="num text-sage">{count}</span> of {rows.length} fixed
      </p>

      <ol className="space-y-3">
        {rows.map((row, i) => {
          const done = fixed(row)
          const busy = working(row)
          const delay = `${450 + (i % 3) * 140}ms`
          return (
            <li key={row.before} className="grid gap-2 md:grid-cols-[1fr_3rem_1fr] md:items-stretch md:gap-4">
              {/* Before */}
              <div
                className={`relative rounded-2xl px-5 py-4 ring-1 transition-all duration-700 ${EASE} ${
                  done ? 'bg-paper-2/40 opacity-55 ring-ink/[0.05]' : busy ? 'bg-rust/[0.06] ring-rust/40' : 'bg-paper-2/70 ring-ink/[0.06]'
                }`}
                style={{ transitionDelay: done ? delay : '0ms' }}
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink-3">{row.source}</p>
                <p className="mt-1 text-[14px] text-ink">{row.before}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rust">
                  <Icon name="Warning" size={13} />
                  <span className="relative">
                    {row.issue}
                    <span
                      className={`absolute left-0 top-1/2 h-px w-full origin-left bg-rust/70 transition-transform duration-700 ${EASE}`}
                      style={{ transform: `scaleX(${done ? 1 : 0})`, transitionDelay: done ? delay : '0ms' }}
                    />
                  </span>
                </p>
              </div>

              {/* Connector */}
              <div className="hidden items-center justify-center md:flex">
                <span
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full ring-1 transition-all duration-700 ${EASE} ${
                    done ? 'bg-sage text-paper ring-sage' : busy ? 'bg-rust text-paper ring-rust' : 'bg-card text-ink-3 ring-ink/10'
                  }`}
                  style={{ transitionDelay: done ? delay : '0ms' }}
                >
                  {busy && !done && <span className="absolute inset-0 rounded-full bg-rust/30 [animation:pulse-ring_1.4s_cubic-bezier(0.16,1,0.3,1)_infinite]" />}
                  <Icon name={done ? 'Check' : 'ArrowRight'} size={15} />
                </span>
              </div>

              {/* After */}
              <div className="relative min-h-[5.25rem] overflow-hidden rounded-2xl">
                <div
                  className={`absolute inset-0 flex items-center rounded-2xl border border-dashed px-5 text-xs text-ink-3 transition-opacity duration-500 ${EASE} ${done ? 'opacity-0' : 'opacity-100'} ${
                    busy ? 'border-rust/40' : 'border-ink/15'
                  }`}
                >
                  {busy ? `Working · ${steps[row.step]?.title}` : `Caught at step ${String(row.step + 1).padStart(2, '0')} · ${steps[row.step]?.title}`}
                </div>
                <div
                  className={`relative h-full rounded-2xl bg-sage-2/70 px-5 py-4 ring-1 ring-sage/25 transition-all duration-700 ${EASE} ${
                    done ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'
                  }`}
                  style={{ transitionDelay: done ? delay : '0ms' }}
                  aria-hidden={!done}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-sage">Step {String(row.step + 1).padStart(2, '0')} · {steps[row.step]?.title}</p>
                  <p className="mt-1 flex items-start gap-2 text-[14px] text-ink">
                    <Icon name="CheckCircle" size={16} className="mt-0.5 shrink-0 text-sage" />
                    <span>{row.after}</span>
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// The desk's output: dimmed until a run finishes, then it settles into place.
export function RunReveal({ children }: { children: ReactNode }) {
  const r = useRun()
  if (!r) return <>{children}</>
  const { phase, run } = r
  const done = phase === 'done'
  return (
    <div className="relative">
      <div className={`transition-all duration-[1100ms] ${EASE} ${done ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.98] opacity-40'}`}>{children}</div>
      <div className={`absolute inset-0 flex items-start justify-center pt-24 transition-opacity duration-700 ${EASE} ${done ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <div className="rounded-[1.75rem] bg-ink/[0.04] p-1.5 ring-1 ring-ink/[0.06]">
          <div className="flex flex-col items-center gap-4 rounded-[calc(1.75rem-0.375rem)] bg-card px-7 py-6 text-center shadow-[0_30px_60px_-30px_rgba(60,40,20,0.35)]">
            <p className="max-w-[16rem] text-sm text-ink-2">
              {phase === 'running' ? 'Vera is building this from the registers…' : 'This is what comes out. Run the flow to build it.'}
            </p>
            {phase === 'idle' ? (
              <button
                type="button"
                onClick={run}
                className={`group inline-flex items-center gap-3 rounded-full bg-ink py-1.5 pl-5 pr-1.5 text-[13px] font-medium text-paper transition-transform duration-500 ${EASE} active:scale-[0.98]`}
              >
                Run the flow
                <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition-transform duration-500 ${EASE} group-hover:translate-x-0.5`}>
                  <Icon name="Play" size={12} />
                </span>
              </button>
            ) : (
              <span className="flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-rust [animation:dot_1.2s_cubic-bezier(0.32,0.72,0,1)_infinite]" style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
