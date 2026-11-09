import type { Out, Rag } from '@/lib/ipc-flow.mjs'
import { Icon } from '../ui/icons'

const DOT: Record<Rag, string> = { green: 'bg-sage', amber: 'bg-ochre', red: 'bg-rust' }

// Z-axis cascade: paper audit forms drift behind the one-page board they become.
// Pure CSS keyframes on transform and opacity; the board loops its rows and the outbreak toast.
export function HeroBoard({ o }: { o: Out }) {
  const ob = o.outbreaks[0]
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-10 pt-6 md:pt-10">
      {/* Paper forms (desktop only: overlap would crowd touch targets on phones) */}
      <div aria-hidden className="no-motion-ok absolute -left-6 top-0 hidden w-[58%] rounded-2xl bg-card p-4 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.35)] ring-1 ring-ink/[0.06] [animation:drift-a_9s_cubic-bezier(0.45,0,0.2,1)_infinite] md:block">
        <p className="text-[9px] uppercase tracking-[0.18em] text-ink-3">Mattress audit · paper</p>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="mt-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px] ring-1 ring-ink/25" />
            <span className="h-1.5 flex-1 rounded-full bg-ink/[0.07]" style={{ width: `${60 + ((i * 17) % 30)}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="no-motion-ok absolute -right-4 top-10 hidden w-[50%] rounded-2xl bg-card p-4 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.35)] ring-1 ring-ink/[0.06] [animation:drift-b_11s_cubic-bezier(0.45,0,0.2,1)_infinite] md:block">
        <p className="text-[9px] uppercase tracking-[0.18em] text-ink-3">Hand hygiene · 5 moments</p>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 15 }).map((_, i) => (
            <span key={i} className={`h-3 rounded-[3px] ${i === 6 || i === 11 ? 'bg-rust/25' : 'bg-ink/[0.07]'}`} />
          ))}
        </div>
      </div>

      {/* The board */}
      <div className="relative mt-16 rounded-[2rem] bg-ink/[0.035] p-1.5 ring-1 ring-ink/[0.06] md:mt-24">
        <div className="rounded-[calc(2rem-0.375rem)] bg-card p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_40px_80px_-40px_rgba(0,0,0,0.35),0_10px_30px_-16px_rgba(0,0,0,0.12)] md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-3">October · {o.stats.homes} homes · {o.stats.beds} beds</p>
              <p className="mt-1 text-lg font-medium tracking-tight text-ink">Infection control, one page</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-sage-2 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-sage">
              <span className="h-1.5 w-1.5 rounded-full bg-sage [animation:dot_1.6s_cubic-bezier(0.32,0.72,0,1)_infinite]" /> live
            </span>
          </div>
          <ul className="mt-5 space-y-1.5">
            {o.homes.map((h, i) => {
              const b = o.byHome.find((x) => x.home === h.id)!
              return (
                <li
                  key={h.id}
                  className="no-motion-ok flex items-center justify-between rounded-xl bg-paper-2/60 px-3.5 py-2.5 [animation:row-in_8s_cubic-bezier(0.16,1,0.3,1)_infinite]"
                  style={{ animationDelay: `${i * 140}ms` }}
                >
                  <span className="flex items-center gap-2.5 text-[13px] text-ink">
                    <span className={`h-2 w-2 rounded-full ${DOT[b.rag]}`} />
                    {h.name}
                  </span>
                  <span className="num text-[12px] text-ink-2">{b.missing ? `${b.missing} audit missing` : `${b.pct}%`}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Outbreak toast */}
      {ob && (
        <div className="no-motion-ok absolute -bottom-2 left-4 right-4 [animation:toast_8s_cubic-bezier(0.16,1,0.3,1)_infinite] md:-right-8 md:left-auto md:w-[78%]">
          <div className="rounded-[1.5rem] bg-white/[0.06] p-1 ring-1 ring-ink/10">
            <div className="flex items-start gap-3 rounded-[calc(1.5rem-0.25rem)] bg-espresso px-4 py-3.5 text-paper shadow-[0_24px_50px_-20px_rgba(0,0,0,0.6)]">
              <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rust">
                <span className="absolute inset-0 rounded-full bg-rust/50 [animation:pulse-ring_1.6s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
                <Icon name="Siren" size={15} className="relative" />
              </span>
              <span>
                <span className="block text-[13px] font-medium">Suspected D&V outbreak · {ob.name}</span>
                <span className="block text-[12px] text-paper/60">
                  {ob.cases} cases in {ob.spanH} h · HPT call note drafted
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
