'use client'

import { useEffect, useState } from 'react'
import { Icon } from './ui/icons'
import { useInView } from './ui/Reveal'
import type { Step } from '@/content/desks'

// Animated workflow: steps light up one after another while the diagram is on screen.
// Hover or tap a step to hold it and read what happens there.
export function Flow({ steps, tone = 'light' }: { steps: Step[]; tone?: 'light' | 'dark' }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const [active, setActive] = useState(-1)
  const [held, setHeld] = useState<number | null>(null)
  const n = steps.length

  useEffect(() => {
    if (!inView || held !== null) return
    const t = setInterval(() => setActive((a) => (a >= n + 1 ? 0 : a + 1)), 1100)
    return () => clearInterval(t)
  }, [inView, held, n])

  const shown = held ?? Math.min(Math.max(active, 0), n - 1)
  const lit = held ?? active
  const dark = tone === 'dark'
  const progress = n > 1 ? Math.min(Math.max(lit, 0), n - 1) / (n - 1) : 1

  return (
    <div ref={ref} className="w-full">
      {/* Desktop: horizontal rail */}
      <div className="relative hidden md:block">
        <div className={`absolute left-[calc(100%/var(--n)/2)] right-[calc(100%/var(--n)/2)] top-6 h-px ${dark ? 'bg-white/10' : 'bg-ink/10'}`} style={{ ['--n' as string]: n }}>
          <div
            className="h-full origin-left bg-rust transition-transform duration-[1000ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `scaleX(${lit < 0 ? 0 : progress})` }}
          />
        </div>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => {
            const on = i <= lit
            const cur = i === shown
            return (
              <li key={s.title} className="flex flex-col items-center px-1 text-center">
                <button
                  type="button"
                  onMouseEnter={() => setHeld(i)}
                  onMouseLeave={() => setHeld(null)}
                  onFocus={() => setHeld(i)}
                  onBlur={() => setHeld(null)}
                  onClick={() => setHeld(held === i ? null : i)}
                  aria-label={s.title}
                  className="group relative flex h-12 w-12 items-center justify-center rounded-full outline-none"
                >
                  {cur && on && <span className="absolute inset-0 rounded-full bg-rust/30 [animation:pulse-ring_1.6s_cubic-bezier(0.16,1,0.3,1)_infinite]" />}
                  <span
                    className={`relative flex h-12 w-12 items-center justify-center rounded-full ring-1 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      on
                        ? 'bg-rust text-paper ring-rust shadow-[0_10px_30px_-10px_rgba(180,83,42,0.7)]'
                        : dark
                          ? 'bg-espresso text-paper/50 ring-white/15'
                          : 'bg-card text-ink-3 ring-ink/10'
                    } ${cur ? 'scale-110' : 'scale-100'} group-hover:scale-110`}
                  >
                    <Icon name={s.icon} size={20} />
                  </span>
                </button>
                <span className={`num mt-4 text-[10px] tracking-[0.18em] ${dark ? 'text-paper/40' : 'text-ink-3'}`}>{String(i + 1).padStart(2, '0')}</span>
                <span className={`mt-1 text-[13px] font-medium leading-snug transition-colors duration-500 ${on ? (dark ? 'text-paper' : 'text-ink') : dark ? 'text-paper/50' : 'text-ink-3'}`}>{s.title}</span>
              </li>
            )
          })}
        </ol>
        <div className={`mx-auto mt-8 max-w-2xl rounded-2xl px-6 py-5 text-center ${dark ? 'bg-white/[0.04] ring-1 ring-white/10' : 'bg-paper-2/70 ring-1 ring-ink/[0.05]'}`}>
          <p key={shown} className={`text-[15px] leading-relaxed [animation:type-in_600ms_cubic-bezier(0.16,1,0.3,1)] ${dark ? 'text-paper/80' : 'text-ink-2'}`}>
            <span className={`font-medium ${dark ? 'text-paper' : 'text-ink'}`}>{steps[shown].title}. </span>
            {steps[shown].detail}
          </p>
        </div>
      </div>

      {/* Mobile: vertical list, every detail visible */}
      <ol className="relative md:hidden">
        <span className={`absolute bottom-6 left-6 top-6 w-px ${dark ? 'bg-white/10' : 'bg-ink/10'}`}>
          <span className="block h-full origin-top bg-rust transition-transform duration-[1000ms] ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ transform: `scaleY(${lit < 0 ? 0 : progress})` }} />
        </span>
        {steps.map((s, i) => {
          const on = i <= lit
          return (
            <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
              <span className={`relative z-[1] flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-700 ${on ? 'bg-rust text-paper ring-rust' : dark ? 'bg-espresso text-paper/50 ring-white/15' : 'bg-card text-ink-3 ring-ink/10'}`}>
                <Icon name={s.icon} size={20} />
              </span>
              <div className="pt-1">
                <p className={`text-[15px] font-medium ${dark ? 'text-paper' : 'text-ink'}`}>{s.title}</p>
                <p className={`mt-1 text-sm leading-relaxed ${dark ? 'text-paper/65' : 'text-ink-2'}`}>{s.detail}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
