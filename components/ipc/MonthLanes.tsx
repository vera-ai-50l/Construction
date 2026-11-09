'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ValueLine } from '@/lib/ipc-flow.mjs'
import { useInView } from '../ui/Reveal'
import { Icon } from '../ui/icons'
import { Count } from './Count'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

// One home's October, played day by day: the paper month on the left, the Vera month on the right.
// Hours per task come from the flow's own time model (lib/ipc-flow.mjs → hoursAndPounds).
const EVENTS: { day: number; keys: string[]; icon: string; before: string; after: string }[] = [
  { day: 2, keys: ['hand'], icon: 'HandSoap', before: 'Hand hygiene audit on a paper form, scored by hand', after: 'Same observation on a phone checklist, scored on submit' },
  { day: 8, keys: ['mattress'], icon: 'Bed', before: 'Mattress audit, every bed ticked on paper, then typed up', after: 'One tap per mattress, a photo for any fault' },
  { day: 9, keys: ['commode'], icon: 'Toilet', before: 'Commode audit on paper', after: 'Commodes on the same checklist' },
  { day: 14, keys: ['environment'], icon: 'Broom', before: 'Environment walk-round on paper', after: 'Walk-round on the phone' },
  { day: 22, keys: ['actions'], icon: 'ListChecks', before: 'Type up four audits, build the action plan, chase owners', after: 'Each owner gets their actions the day the audit is in' },
  { day: 24, keys: ['training'], icon: 'Certificate', before: 'Update the training spreadsheet by hand', after: 'Chase list arrives, earliest date first' },
  { day: 27, keys: ['outbreak'], icon: 'Siren', before: 'D&V in two rooms, noticed at a later handover', after: 'Second case logged at 22:40: outbreak flag and HPT call note' },
  { day: 29, keys: ['report'], icon: 'FileText', before: 'Write the monthly IPC report', after: 'Report drafted; manager checks it' },
  { day: 30, keys: ['cqc'], icon: 'FolderOpen', before: 'File copies in the CQC evidence folder', after: 'Evidence pack filed against the 10 criteria' },
  { day: 31, keys: ['review', 'letter', 'calls'], icon: 'Stethoscope', before: 'Adviser reads this home’s forms, writes advice, takes calls', after: 'Adviser reviews one page, signs, takes fewer calls' },
]

export function MonthLanes({ lines, homes }: { lines: ValueLine[]; homes: number }) {
  const [ref, inView] = useInView<HTMLDivElement>('0px 0px -30% 0px', 0)
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [played, setPlayed] = useState(false)

  const hours = (keys: string[], f: 'before' | 'after') => lines.filter((l) => keys.includes(l.k)).reduce((s, l) => s + l[f], 0) / homes
  const rows = EVENTS.map((e) => ({ ...e, b: hours(e.keys, 'before'), a: hours(e.keys, 'after'), adviser: e.keys.includes('review') }))
  const max = Math.max(...rows.map((r) => r.b))

  const play = useCallback(() => {
    setDay(0)
    setPlaying(true)
    setPlayed(true)
  }, [])

  useEffect(() => {
    if (inView && !played) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setDay(31)
        setPlayed(true)
      } else play()
    }
  }, [inView, played, play])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      setDay((d) => {
        if (d >= 31) {
          setPlaying(false)
          return 31
        }
        return d + 1
      })
    }, 230)
    return () => clearInterval(t)
  }, [playing])

  const seen = rows.filter((r) => r.day <= day)
  const homeB = seen.filter((r) => !r.adviser).reduce((s, r) => s + r.b, 0)
  const homeA = seen.filter((r) => !r.adviser).reduce((s, r) => s + r.a, 0)
  const advB = seen.filter((r) => r.adviser).reduce((s, r) => s + r.b, 0)
  const advA = seen.filter((r) => r.adviser).reduce((s, r) => s + r.a, 0)
  const end = day >= 31

  return (
    <div ref={ref}>
      {/* Month scrubber */}
      <div className="sticky top-20 z-10 rounded-[2rem] bg-paper-2/80 p-1.5 ring-1 ring-ink/[0.06] backdrop-blur-xl md:top-24">
        <div className="rounded-[calc(2rem-0.375rem)] bg-card px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_30px_60px_-30px_rgba(0,0,0,0.18)] md:px-8 md:py-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <div className="flex items-baseline gap-3">
              <span className="text-[11px] uppercase tracking-[0.2em] text-ink-3">October</span>
              <span className="text-2xl font-medium tabular-nums tracking-tight text-ink md:text-4xl">Day {String(Math.max(day, 1)).padStart(2, '0')}</span>
            </div>
            <div className="grid grid-cols-2 gap-6 text-right md:gap-10">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Paper month · home</p>
                <p className="mt-0.5 text-xl font-medium tracking-tight text-rust md:text-3xl">
                  <Count value={homeB} decimals={1} suffix=" h" ms={500} mono={false} />
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">With Vera · home</p>
                <p className="mt-0.5 text-xl font-medium tracking-tight text-sage md:text-3xl">
                  <Count value={homeA} decimals={1} suffix=" h" ms={500} mono={false} />
                </p>
              </div>
            </div>
          </div>
          <div className="relative mt-3 h-1.5 overflow-hidden md:mt-5 rounded-full bg-ink/[0.06]">
            <div className={`h-full origin-left rounded-full bg-ink transition-transform duration-300 ${EASE}`} style={{ transform: `scaleX(${day / 31})` }} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-ink-3">
            <span>1 Oct</span>
            <button type="button" onClick={play} disabled={playing} className="flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-ink-2 transition-colors duration-500 hover:bg-ink/[0.05] disabled:cursor-default disabled:opacity-40">
              <Icon name="ArrowCounterClockwise" size={12} /> Replay the month
            </button>
            <span>31 Oct</span>
          </div>
        </div>
      </div>

      {/* Lanes */}
      <div className="mt-8 hidden grid-cols-[4.5rem_1fr_1fr] gap-5 px-2 text-[11px] uppercase tracking-[0.2em] text-ink-3 md:grid">
        <span>Day</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rust" /> Before: paper, Excel, email</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sage" /> After: Vera</span>
      </div>
      <ol className="mt-4 space-y-2.5">
        {rows.map((r) => {
          const on = day >= r.day
          return (
            <li
              key={r.day + r.keys[0]}
              className={`grid gap-2 rounded-2xl p-2 transition-all duration-700 md:grid-cols-[4.5rem_1fr_1fr] md:items-stretch md:gap-5 ${EASE} ${r.adviser ? 'bg-ink/[0.03] ring-1 ring-ink/[0.05]' : ''} ${on ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-[0.12]'}`}
            >
              <div className="flex items-center gap-3 px-2 md:flex-col md:items-start md:justify-center md:gap-1">
                <span className="num text-sm text-ink">{String(r.day).padStart(2, '0')}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
                  <Icon name={r.icon} size={14} /> {r.adviser ? 'Adviser' : 'Home'}
                </span>
              </div>
              <Lane tone="before" text={r.before} h={r.b} max={max} on={on} />
              <Lane tone="after" text={r.after} h={r.a} max={max} on={on} delay={260} />
            </li>
          )
        })}
      </ol>

      {/* Verdict */}
      <div className={`mt-8 grid gap-4 transition-all duration-1000 md:grid-cols-2 ${EASE} ${end ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
        <Verdict who="Each home, every month" before={homeB} after={homeA} />
        <Verdict who="The adviser, per home, every month" before={advB} after={advA} />
      </div>
      <p className="mt-5 max-w-3xl text-xs leading-relaxed text-ink-3">
        Average of the six sample homes (42 beds). The outbreak line is spread over the year: 0.371 D&V outbreaks per home a year, about 7 hours of paperwork each on paper. Time estimates are Vera’s and are listed task by task in the calculator below.
      </p>
    </div>
  )
}

function Lane({ tone, text, h, max, on, delay = 0 }: { tone: 'before' | 'after'; text: string; h: number; max: number; on: boolean; delay?: number }) {
  const before = tone === 'before'
  return (
    <div className={`rounded-xl px-4 py-3 ring-1 ${before ? 'bg-paper-2/70 ring-ink/[0.05]' : 'bg-sage-2/60 ring-sage/20'}`}>
      <p className="flex items-start gap-2 text-[13.5px] leading-snug text-ink">
        {!before && <Icon name="CheckCircle" size={15} className="mt-0.5 shrink-0 text-sage" />}
        <span>
          <span className="mb-0.5 block text-[10px] uppercase tracking-[0.16em] text-ink-3 md:hidden">{before ? 'Before' : 'With Vera'}</span>
          {text}
        </span>
      </p>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
          <span
            className={`absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-[900ms] ${EASE} ${before ? 'bg-rust' : 'bg-go'}`}
            style={{ transform: `scaleX(${on ? Math.max(h / max, 0.015) : 0})`, transitionDelay: on ? `${delay}ms` : '0ms' }}
          />
        </span>
        <span className={`num w-14 text-right text-[12px] ${before ? 'text-ink-2' : 'text-sage'}`}>{h < 0.1 ? `${Math.round(h * 60)} min` : `${h.toFixed(h < 1 ? 2 : 1)} h`}</span>
      </div>
    </div>
  )
}

function Verdict({ who, before, after }: { who: string; before: number; after: number }) {
  const cut = before ? Math.round((1 - after / before) * 100) : 0
  return (
    <div className="rounded-[2rem] bg-ink/[0.035] p-1.5 ring-1 ring-ink/[0.06]">
      <div className="flex items-end justify-between gap-6 rounded-[calc(2rem-0.375rem)] bg-card p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] md:p-7">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">{who}</p>
          <p className="mt-2 whitespace-nowrap text-2xl font-medium tabular-nums tracking-tight text-ink sm:text-3xl md:text-4xl">
            <span className="text-ink-3 line-through decoration-rust/60 decoration-2">{before.toFixed(1)} h</span>
            <span className="mx-2 text-ink-3">→</span>
            <span className="text-sage">{after.toFixed(1)} h</span>
          </p>
        </div>
        <span className="num rounded-full bg-sage-2 px-3 py-1.5 text-sm text-sage">−{cut}%</span>
      </div>
    </div>
  )
}
