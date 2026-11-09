'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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
export function RunButton({ compact = false, big = false, className = '' }: { compact?: boolean; big?: boolean; className?: string }) {
  const r = useRun()
  if (!r) return null
  const { phase, step, n, run } = r
  const progress = phase === 'done' ? 1 : phase === 'running' ? Math.max(step + 1, 0) / n : 0
  const label = phase === 'running' ? `Running · step ${Math.min(Math.max(step + 1, 1), n)} of ${n}` : phase === 'done' ? 'Run again' : 'Run the flow'
  const size = big ? 'justify-between py-2.5 pl-7 pr-2.5 text-base bg-rust shadow-[0_18px_40px_-16px_rgba(229,13,37,0.8)]' : compact ? 'py-2 pl-5 pr-2 text-[13px] bg-ink' : 'py-2 pl-6 pr-2 text-sm bg-ink'
  return (
    <button
      type="button"
      onClick={run}
      disabled={phase === 'running'}
      aria-live="polite"
      className={`group relative inline-flex cursor-pointer touch-manipulation items-center gap-3 overflow-hidden rounded-full font-medium text-paper transition-transform duration-500 ${EASE} active:scale-[0.97] disabled:cursor-default ${size} ${className}`}
    >
      {phase === 'idle' && <span className={`pointer-events-none absolute inset-0 rounded-full [animation:pulse-ring_2.2s_cubic-bezier(0.16,1,0.3,1)_infinite] ${big ? 'bg-white/25' : 'bg-rust/40'}`} />}
      <span className={`pointer-events-none absolute inset-0 origin-left transition-transform duration-[1400ms] ${EASE} ${big ? 'bg-ink' : 'bg-rust'}`} style={{ transform: `scaleX(${progress})` }} />
      <span className="pointer-events-none relative tabular-nums">{label}</span>
      <span className={`pointer-events-none relative flex items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ${EASE} group-hover:translate-x-0.5 group-hover:scale-105 ${big ? 'h-10 w-10' : 'h-8 w-8'}`}>
        <Icon name={phase === 'done' ? 'ArrowCounterClockwise' : 'Play'} size={big ? 16 : 14} weight="fill" />
      </span>
    </button>
  )
}

// Before → after board. Each row is caught by one flow step and flips to its fix when that step runs.
export function BeforeAfter({ rows, steps, where = 'in your registers today' }: { rows: RunRow[]; steps: { title: string }[]; where?: string }) {
  const r = useRun()
  if (!r) return null
  const { phase, step } = r
  const fixed = (row: RunRow) => phase !== 'idle' && step >= row.step
  const working = (row: RunRow) => phase === 'running' && step === row.step
  const count = rows.filter(fixed).length
  const idle = phase === 'idle'

  return (
    <div
      className={`mt-12 border-t border-ink/[0.07] pt-10 ${idle ? 'cursor-pointer' : ''}`}
      onClick={idle ? r.run : undefined}
      role={idle ? 'button' : undefined}
      tabIndex={idle ? 0 : undefined}
      aria-label={idle ? 'Run the flow' : undefined}
      onKeyDown={idle ? (e) => (e.key === 'Enter' || e.key === ' ') && r.run() : undefined}
    >
      <div className="mb-6 hidden grid-cols-[1fr_3rem_1fr] items-end gap-4 md:grid">
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">
          Before · <span className="text-rust">{rows.length - count} open</span> {where}
        </p>
        <span />
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">
          After · <span className="num text-sage">{count}</span> of {rows.length} fixed by Vera
        </p>
      </div>
      <p className="mb-5 text-[11px] uppercase tracking-[0.2em] text-ink-3 md:hidden">
        Before → after · <span className="num text-sage">{count}</span> of {rows.length} fixed{idle ? ' · tap to run' : ''}
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
              <div className={`relative overflow-hidden rounded-2xl md:block md:min-h-[5.25rem] ${done ? 'block' : 'hidden'}`}>
                <div
                  className={`absolute inset-0 flex items-center rounded-2xl border border-dashed px-5 text-xs text-ink-3 transition-opacity duration-500 ${EASE} ${done ? 'opacity-0' : 'opacity-100'} ${
                    busy ? 'border-rust/40' : 'border-ink/15'
                  }`}
                >
                  {busy ? `Working · ${steps[row.step]?.title}` : idle ? `Tap to run · caught at step ${String(row.step + 1).padStart(2, '0')}` : `Caught at step ${String(row.step + 1).padStart(2, '0')} · ${steps[row.step]?.title}`}
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
          <div className="flex flex-col items-center gap-4 rounded-[calc(1.75rem-0.375rem)] bg-card px-7 py-6 text-center shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]">
            <p className="max-w-[16rem] text-sm text-ink-2">
              {phase === 'running' ? 'Vera is building this from the registers…' : 'This is what comes out. Run the flow to build it.'}
            </p>
            {phase === 'idle' ? (
              <button
                type="button"
                onClick={run}
                className={`group inline-flex cursor-pointer touch-manipulation items-center gap-3 rounded-full bg-rust py-2 pl-6 pr-2 text-sm font-medium text-paper shadow-[0_18px_40px_-16px_rgba(229,13,37,0.8)] transition-transform duration-500 ${EASE} active:scale-[0.98]`}
              >
                Run the flow
                <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ${EASE} group-hover:translate-x-0.5`}>
                  <Icon name="Play" size={13} weight="fill" />
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

// Phones: while a desk's flow is on screen and has not finished, a Run bar stays pinned to the
// bottom of the screen so the button is never scrolled out of reach.
export function RunZone({ children, label }: { children: ReactNode; label: string }) {
  const r = useRun()
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: '-25% 0px -25% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const show = !!r && seen && r.phase !== 'done'
  return (
    <div ref={ref}>
      {children}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-all duration-500 ${EASE} md:hidden ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
        aria-hidden={!show}
      >
        <div className="w-full max-w-sm rounded-full bg-card/90 p-1.5 shadow-[0_20px_50px_-20px_rgba(40,25,10,0.55)] ring-1 ring-ink/10 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate pl-4 text-[12px] text-ink-2">{label}</span>
            <RunButton compact />
          </div>
        </div>
      </div>
    </div>
  )
}
