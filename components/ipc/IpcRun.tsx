'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { runAll, type Out, type Sample } from '@/lib/ipc-flow.mjs'
import sample from '@/lib/ipc-sample.json'
import { useRun } from '../run/Run'
import { Icon } from '../ui/icons'
import { gbp } from '@/lib/format'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

// When the visitor presses Run, the real flow (lib/ipc-flow.mjs, the code n8n runs) executes on the
// sample month in the browser. The step-by-step animation then reveals what each step produced.
type Trace = { trace: Out[] | null; ms: number }
const TraceCtx = createContext<Trace>({ trace: null, ms: 0 })
export const useTrace = () => useContext(TraceCtx)

export function TraceProvider({ children }: { children: ReactNode }) {
  const r = useRun()
  const [state, setState] = useState<Trace>({ trace: null, ms: 0 })
  const phase = r?.phase
  const step = r?.step
  useEffect(() => {
    if (phase !== 'running' || step !== -1) return
    const t0 = performance.now()
    const trace = runAll(sample as Sample)
    setState({ trace, ms: performance.now() - t0 })
  }, [phase, step])
  return <TraceCtx.Provider value={state}>{children}</TraceCtx.Provider>
}

export const shortDate = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const clock = (iso: string) => iso.slice(11, 16)

// What each step produced, written from that step's own output.
function lineFor(i: number, o: Out): string[] {
  const homeName = (id: string) => o.homes.find((h) => h.id === id)?.name ?? id
  if (i === 0)
    return [
      `${o.stats.returns} of ${o.stats.expected} audits in from ${o.stats.homes} homes · ${o.stats.lines} checklist lines`,
      ...o.missing.map((m) => `missing: ${homeName(m.home)} · ${o.auditTypes[m.type].name.toLowerCase()} audit`),
    ]
  if (i === 1) {
    const red = o.actions.filter((a) => a.rag === 'red').length
    const amber = o.actions.filter((a) => a.rag === 'amber').length
    return [`${o.scores.length} audits scored · ${o.actions.length} actions with owners · ${red} red, ${amber} amber`]
  }
  if (i === 2)
    return [
      ...o.outbreaks.map((x) => `SUSPECTED OUTBREAK · ${x.name} · ${x.cases} cases in ${x.spanH} h · flagged ${clock(x.flaggedAt)} on ${shortDate(x.flaggedAt)}`),
      ...o.watch.map((w) => `watch: ${homeName(w.home)} · ${w.cases} cases, not linked within 48 h`),
    ]
  if (i === 3) {
    const exp = o.chase.filter((c) => c.status === 'expired').length
    const never = o.chase.filter((c) => c.status === 'never trained').length
    return [`${o.training.length} staff checked · ${o.chase.length} to chase · ${exp} expired, ${never} never trained`]
  }
  if (i === 4) {
    const cov = o.packs.map((p) => p.covered)
    return [`${o.packs.length} evidence packs filed · ${Math.min(...cov)}–${Math.max(...cov)} of 10 criteria evidenced from home records · adviser summary drafted`]
  }
  const v = o.value.month
  return [`${v.homeSaved} h back for the homes + ${v.adviserSaved} h for the adviser = ${gbp(v.pounds, 2)} this month`]
}

// A dark console that prints each step's real output as the run reaches it.
export function StepConsole({ steps }: { steps: { title: string }[] }) {
  const r = useRun()
  const { trace, ms } = useTrace()
  if (!r) return null
  const { phase, step } = r
  return (
    <div className="rounded-[2rem] bg-white/[0.04] p-1.5 ring-1 ring-white/10">
      <div className="rounded-[calc(2rem-0.375rem)] bg-espresso px-5 py-5 font-mono text-[12.5px] leading-relaxed text-paper/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] md:px-7 md:py-6">
        <div className="mb-4 flex items-center justify-between gap-3 text-[11px] text-paper/45">
          <span className="flex items-center gap-2">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            </span>
            POST /webhook/vera/ipc-kit
          </span>
          <span className="num">{trace ? `ran in ${ms < 1 ? '<1' : ms.toFixed(1)} ms` : 'idle'}</span>
        </div>
        {phase === 'idle' || !trace ? (
          <p className="text-paper/50">
            <span className="text-rust-2">$</span> waiting · press Run to send October's returns from 6 homes ({sample.training.length} staff, {sample.audits.length} audit forms, {sample.symptoms.length} symptom entries)
          </p>
        ) : (
          <ol className="space-y-2.5" aria-live="polite">
            {steps.map((s, i) => {
              const done = phase === 'done' || i < step
              const cur = phase === 'running' && i === step
              if (!done && !cur) return null
              return (
                <li key={s.title} className="[animation:type-in_500ms_cubic-bezier(0.16,1,0.3,1)]">
                  <p className="flex items-center gap-2 text-paper">
                    {done ? <Icon name="CheckCircle" size={14} className="text-[#7fd1a3]" /> : <span className="h-3.5 w-3.5 animate-spin rounded-full border border-paper/25 border-t-rust-2" />}
                    <span className="num text-paper/40">{String(i + 1).padStart(2, '0')}</span> {s.title}
                  </p>
                  {done && (
                    <ul className="mt-1 space-y-0.5 pl-[3.25rem]">
                      {lineFor(i, trace[i]).map((l) => (
                        <li key={l} className={l.startsWith('SUSPECTED') ? 'text-rust-2' : l.startsWith('missing') ? 'text-[#f2c879]' : 'text-paper/65'}>
                          → {l}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}

// Results stay dimmed behind a Run prompt until the flow has finished.
export function ResultsGate({ children }: { children: ReactNode }) {
  const r = useRun()
  if (!r) return <>{children}</>
  const { phase, run } = r
  const done = phase === 'done'
  return (
    <div className="relative">
      <div className={`transition-all duration-[1100ms] ${EASE} ${done ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-3 scale-[0.985] opacity-35 select-none'}`} aria-hidden={!done}>
        {children}
      </div>
      <div className={`absolute inset-0 flex items-start justify-center pt-28 transition-opacity duration-700 ${EASE} ${done ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <div className="sticky top-32 rounded-[1.75rem] bg-ink/[0.04] p-1.5 ring-1 ring-ink/[0.06]">
          <div className="flex flex-col items-center gap-4 rounded-[calc(1.75rem-0.375rem)] bg-card px-7 py-6 text-center shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]">
            <p className="max-w-[17rem] text-sm text-ink-2">{phase === 'running' ? 'Vera is working through October…' : 'This is what the adviser and each home receive. Run the flow to build it.'}</p>
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

// True once the run has finished: lets output cards play their own entry animation.
export function useDone() {
  const r = useRun()
  return r?.phase === 'done'
}
