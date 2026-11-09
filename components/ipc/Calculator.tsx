'use client'

import { useMemo, useState } from 'react'
import { hoursAndPounds, type Assumptions } from '@/lib/ipc-flow.mjs'
import { Bezel } from '../ui/Bezel'
import { Icon } from '../ui/icons'
import { Count } from './Count'
import { gbp } from '@/lib/format'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

type Inputs = { homes: number; beds: number; managerRate: number; consultantRate: number; pricePerHome: number }
const DEFAULTS: Inputs = { homes: 6, beds: 42, managerRate: 24.19, consultantRate: 115, pricePerHome: 150 }

const SLIDERS: { k: keyof Inputs; label: string; min: number; max: number; step: number; fmt: (n: number) => string; note: string }[] = [
  { k: 'homes', label: 'Care homes advised', min: 1, max: 30, step: 1, fmt: (n) => String(n), note: 'Sample: 6' },
  { k: 'beds', label: 'Beds per home', min: 10, max: 100, step: 1, fmt: (n) => String(n), note: 'England average: ~24 residential, ~54 nursing' },
  { k: 'managerRate', label: 'Home manager, cost per hour', min: 15, max: 40, step: 0.01, fmt: (n) => gbp(n, 2), note: '£36k salary + NI + pension' },
  { k: 'consultantRate', label: 'Adviser, value per hour', min: 60, max: 300, step: 1, fmt: (n) => gbp(n), note: 'NHS locum top rate: £115' },
  { k: 'pricePerHome', label: 'Vera price per home, per month', min: 0, max: 400, step: 5, fmt: (n) => gbp(n), note: 'Hypothesis: £150–300' },
]

// Runs the flow's own "Hours & £" step on whatever the visitor sets.
export function Calculator() {
  const [x, setX] = useState<Inputs>(DEFAULTS)
  const v = useMemo(() => {
    const homes = Array.from({ length: x.homes }, () => ({ beds: x.beds }))
    const a: Partial<Assumptions> = { managerRate: x.managerRate, consultantRate: x.consultantRate, pricePerHome: x.pricePerHome }
    return hoursAndPounds({ homes, assumptions: a }).value
  }, [x])
  const m = v.month
  const changed = (Object.keys(DEFAULTS) as (keyof Inputs)[]).some((k) => DEFAULTS[k] !== x[k])
  const homeEach = m.homePounds / v.homes
  const maxH = Math.max(...v.lines.map((l) => l.before))
  const breakEven = homeEach >= x.pricePerHome

  return (
    <div className="grid gap-5 md:grid-cols-12">
      {/* Inputs */}
      <div className="md:col-span-5">
        <Bezel className="h-full" inner="flex h-full flex-col p-6 md:p-8">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">Your numbers</p>
            <button
              type="button"
              onClick={() => setX(DEFAULTS)}
              disabled={!changed}
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-ink-2 transition-colors duration-500 hover:bg-ink/[0.05] disabled:cursor-default disabled:opacity-35"
            >
              <Icon name="ArrowCounterClockwise" size={12} /> Sample values
            </button>
          </div>
          <div className="mt-6 space-y-7">
            {SLIDERS.map((s) => (
              <label key={s.k} className="block">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] text-ink">{s.label}</span>
                  <span className="num text-lg font-medium text-ink">{s.fmt(x[s.k])}</span>
                </span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={x[s.k]}
                  onChange={(e) => setX({ ...x, [s.k]: Number(e.target.value) })}
                  className="vera-range mt-3 w-full"
                  style={{ ['--p' as string]: `${((x[s.k] - s.min) / (s.max - s.min)) * 100}%` }}
                />
                <span className="mt-1.5 block text-[11px] text-ink-3">{s.note}</span>
              </label>
            ))}
          </div>
        </Bezel>
      </div>

      {/* Headline */}
      <div className="md:col-span-7">
        <Bezel tone="dark" className="h-full" inner="flex h-full flex-col gap-8 p-6 md:p-9">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-paper/45">
              Value a year · {v.homes} home{v.homes === 1 ? '' : 's'} × {x.beds} beds
            </p>
            <p className="mt-3 text-6xl font-medium tracking-[-0.04em] text-paper md:text-8xl">
              <Count value={v.year.pounds} prefix="£" mono={false} />
            </p>
            <p className="mt-3 text-[15px] text-paper/65">
              <Count value={m.pounds} prefix="£" decimals={2} className="text-paper" /> a month ·{' '}
              <Count value={m.homeSaved + m.adviserSaved} decimals={1} suffix=" hours" className="text-paper" /> a month back · <Count value={v.year.hours} suffix=" hours a year" className="text-paper" />
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
            {[
              { k: 'Homes · hours a month', v: <Count value={m.homeSaved} decimals={1} suffix=" h" />, s: <><Count value={m.homePounds} prefix="£" decimals={2} /> of manager time</> },
              { k: 'Adviser · hours a month', v: <Count value={m.adviserSaved} decimals={1} suffix=" h" />, s: <><Count value={m.adviserPounds} prefix="£" decimals={2} /> of consultant time</> },
              { k: 'Vera price a year', v: <Count value={v.year.price} prefix="£" />, s: <>{gbp(x.pricePerHome)} × {v.homes} × 12</> },
              { k: 'Value ÷ price', v: <Count value={v.roi} decimals={1} suffix="×" />, s: <>net <Count value={Math.abs(m.net * 12)} prefix={m.net < 0 ? '−£' : '£'} /> a year</> },
            ].map((c) => (
              <div key={c.k} className="bg-espresso p-4 md:p-5">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-paper/45">{c.k}</dt>
                <dd className="mt-1.5 text-2xl font-medium tracking-tight text-paper md:text-3xl [&>span]:font-sans">{c.v}</dd>
                <dd className="mt-1 text-[12px] text-paper/55">{c.s}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-3 text-[13px] leading-relaxed text-paper/70 md:grid-cols-2">
            <p className="flex gap-2.5">
              <Icon name={breakEven ? 'CheckCircle' : 'Info'} size={16} className={`mt-0.5 shrink-0 ${breakEven ? 'text-[#7fd1a3]' : 'text-[#f2c879]'}`} />
              <span>
                Each home gets back <span className="num text-paper">{(m.homeSaved / v.homes).toFixed(1)} h</span> of manager time, worth <span className="num text-paper">{gbp(homeEach, 2)}</span> a month,{' '}
                {breakEven ? 'so the home covers the price on manager time alone.' : 'below the price: the adviser’s time and outbreak days carry the case.'}
              </span>
            </p>
            <p className="flex gap-2.5">
              <Icon name="Siren" size={16} className="mt-0.5 shrink-0 text-rust-2" />
              <span>
                Not in the £: about <span className="num text-paper">{v.year.outbreaks.toFixed(1)}</span> D&V outbreaks a year across these homes; closing on day 1–3 instead of later goes with{' '}
                <span className="num text-paper">{v.year.closureDaysSaved.toFixed(1)}</span> fewer days closed to admissions.
              </span>
            </p>
          </div>
        </Bezel>
      </div>

      {/* Task by task */}
      <div className="md:col-span-12">
        <Bezel inner="p-6 md:p-9">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">Task by task · hours a month, all {v.homes} homes</p>
              <h3 className="mt-2 text-2xl font-medium tracking-tight text-ink">Where the hours come from</h3>
            </div>
            <p className="flex items-center gap-5 text-[12px] text-ink-2" aria-label="Legend">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-rust" /> Paper process
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-go" /> With Vera
              </span>
            </p>
          </div>
          <div className="mt-8 hidden grid-cols-[1.3fr_2.6fr_5rem_5rem_5rem] gap-4 border-b border-ink/[0.07] pb-2 text-[10px] uppercase tracking-[0.16em] text-ink-3 md:grid">
            <span>Task</span>
            <span />
            <span className="text-right">Before</span>
            <span className="text-right">After</span>
            <span className="text-right">Saved</span>
          </div>
          <ul>
            {v.lines.map((l) => (
              <li key={l.k} className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-ink/[0.05] py-3 md:grid-cols-[1.3fr_2.6fr_5rem_5rem_5rem]">
                <span className="text-[13.5px] text-ink">
                  {l.t}
                  <span className="ml-2 rounded-full bg-ink/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-3">{l.who}</span>
                </span>
                <span className="col-span-2 row-start-2 flex flex-col gap-[2px] md:col-span-1 md:row-start-auto" title={`${l.t}: ${l.before} h before, ${l.after} h after`}>
                  <Bar w={l.before / maxH} tone="before" />
                  <Bar w={l.after / maxH} tone="after" />
                </span>
                <span className="num hidden text-right text-[13px] text-ink-2 md:block">{l.before.toFixed(1)}</span>
                <span className="num hidden text-right text-[13px] text-ink-2 md:block">{l.after.toFixed(1)}</span>
                <span className="num text-right text-[13px] font-medium text-ink">−{l.saved.toFixed(1)} h</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-ink-3">
            Minutes per home per month, before → after: hand hygiene 75 → 45; mattresses 4.4 → 3.5 a bed; commodes 50 → 35; environment 105 → 75; action plan 90 → 20; training matrix 60 → 10; monthly report 90 → 10; CQC folder 60 → 10; outbreak paperwork 420 → 120 per outbreak. Adviser, per home: reading returns 60 → 10; writing advice 60 → 15; phone queries 30 → 20.
          </p>
        </Bezel>
      </div>
    </div>
  )
}

// Thin bar, 4px rounded data-end, square at the baseline; grows with transform only.
function Bar({ w, tone }: { w: number; tone: 'before' | 'after' }) {
  return (
    <span className="relative block h-2.5 w-full">
      <span
        className={`absolute inset-y-0 left-0 w-full origin-left rounded-r-[4px] transition-transform duration-700 ${EASE} ${tone === 'before' ? 'bg-rust' : 'bg-go'} group-hover:brightness-110`}
        style={{ transform: `scaleX(${Math.max(w, 0.004)})` }}
      />
    </span>
  )
}
