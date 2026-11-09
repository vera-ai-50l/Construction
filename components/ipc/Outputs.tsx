'use client'

import type { Out, Rag } from '@/lib/ipc-flow.mjs'
import { Bezel } from '../ui/Bezel'
import { Icon } from '../ui/icons'
import { useRun } from '../run/Run'
import { clock, shortDate, useDone, useTrace } from './IpcRun'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'
const ragOf = (pct: number): Rag => (pct >= 95 ? 'green' : pct >= 76 ? 'amber' : 'red')
const RAG_CELL: Record<Rag, string> = {
  green: 'bg-sage-2 text-sage ring-sage/20',
  amber: 'bg-ochre-2 text-ochre ring-ochre/25',
  red: 'bg-rust/[0.09] text-rust ring-rust/25',
}
const RAG_DOT: Record<Rag, string> = { green: 'bg-sage', amber: 'bg-ochre', red: 'bg-rust' }

function CardHead({ icon, k, title, dark = false }: { icon: string; k: string; title: string; dark?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className={`text-[10px] uppercase tracking-[0.2em] ${dark ? 'text-paper/45' : 'text-ink-3'}`}>{k}</p>
        <h3 className={`mt-1.5 text-xl font-medium tracking-tight ${dark ? 'text-paper' : 'text-ink'}`}>{title}</h3>
      </div>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${dark ? 'bg-white/[0.07] text-rust-2' : 'bg-ink/[0.04] text-ink-2'}`}>
        <Icon name={icon} size={18} />
      </span>
    </div>
  )
}

/* Portfolio heatmap: every home × every audit, plus training. */
function Heatmap({ o, done }: { o: Out; done: boolean }) {
  const cols: { k: string; label: string; short: string }[] = [
    { k: 'hand', label: 'Hand hygiene', short: 'Hands' },
    { k: 'mattress', label: 'Mattresses', short: 'Matt.' },
    { k: 'commode', label: 'Commodes', short: 'Comm.' },
    { k: 'environment', label: 'Environment', short: 'Env.' },
    { k: 'training', label: 'Training', short: 'Train.' },
  ]
  return (
    <Bezel className="h-full" inner="flex h-full flex-col p-5 md:p-8">
      <CardHead icon="SquaresFour" k="For the adviser · October" title="Six homes on one page" />
      <div className="mt-6">
        <table className="w-full table-fixed border-separate border-spacing-1 text-left md:border-spacing-1.5">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-[0.04em] text-ink-3 md:text-[10px] md:tracking-[0.14em]">
              <th className="w-[34%] pb-1 font-normal md:w-[28%]">Home</th>
              {cols.map((c) => (
                <th key={c.k} className="pb-1 text-center font-normal">
                  <span className="md:hidden">{c.short}</span>
                  <span className="hidden md:inline">{c.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {o.homes.map((h, r) => {
              const overall = o.byHome.find((x) => x.home === h.id)!
              return (
                <tr key={h.id}>
                  <td className="pr-2">
                    <span className="flex items-center gap-2 text-[12px] text-ink md:text-[13px]">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${RAG_DOT[overall.rag]}`} />
                      <span className="truncate">{h.name}</span>
                    </span>
                    <span className="hidden pl-4 text-[11px] text-ink-3 md:block">
                      {h.beds} beds · {h.type}
                    </span>
                  </td>
                  {cols.map((c, ci) => {
                    const delay = `${(r * cols.length + ci) * 35}ms`
                    const base = `transition-all duration-700 ${EASE} ${done ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`
                    if (c.k === 'training') {
                      const t = o.trainingByHome.find((x) => x.home === h.id)!
                      const rag = ragOf(t.pct)
                      return (
                        <td key={c.k} className="text-center">
                          <span className={`num block rounded-lg px-0.5 py-2 text-[10.5px] ring-1 md:rounded-xl md:px-2 md:py-2.5 md:text-[13px] ${RAG_CELL[rag]} ${base}`} style={{ transitionDelay: delay }}>
                            {t.pct}%
                          </span>
                        </td>
                      )
                    }
                    const s = o.scores.find((x) => x.home === h.id && x.type === c.k)
                    return (
                      <td key={c.k} className="text-center">
                        {s ? (
                          <span className={`num block rounded-lg px-0.5 py-2 text-[10.5px] ring-1 md:rounded-xl md:px-2 md:py-2.5 md:text-[13px] ${RAG_CELL[s.rag]} ${base}`} style={{ transitionDelay: delay }}>
                            {s.pct}%
                          </span>
                        ) : (
                          <span className={`block rounded-lg border border-dashed border-rust/50 px-0.5 py-2 text-[10px] text-rust md:rounded-xl md:px-2 md:py-2.5 md:text-[11px] ${base}`} style={{ transitionDelay: delay }}>
                            not in
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sage" /> 95% and above</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ochre" /> 76–94%</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rust" /> 75% or less, or missing</span>
      </p>
      <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-ink/[0.07] pt-6 md:pt-8">
        {[
          [String(o.stats.lines), 'checklist lines scored'],
          [String(o.actions.length), 'actions raised'],
          [`${o.stats.returns}/${o.stats.expected}`, 'audits returned'],
        ].map(([a, b]) => (
          <div key={b}>
            <dt className="text-2xl font-medium tabular-nums tracking-tight text-ink md:text-3xl">{a}</dt>
            <dd className="mt-1 text-[11.5px] text-ink-3">{b}</dd>
          </div>
        ))}
      </dl>
    </Bezel>
  )
}

/* Outbreak alert with the 48-hour window drawn to scale. */
function OutbreakCard({ o, done }: { o: Out; done: boolean }) {
  const x = o.outbreaks[0]
  if (!x) return null
  const cases = o.symptoms.filter((s) => s.home === x.home && (s.symptom === 'D' || s.symptom === 'V' || s.symptom === 'D&V'))
  const t0 = Date.parse(x.firstOnset)
  const at = (iso: string) => (Date.parse(iso) - t0) / 3600e3
  const flagH = at(x.flaggedAt)
  return (
    <Bezel tone="dark" className="h-full" inner="flex h-full flex-col gap-6 p-6 md:p-8">
      <CardHead dark icon="Siren" k={`For ${x.name} · ${shortDate(x.flaggedAt)}, ${clock(x.flaggedAt)}`} title="Suspected D&V outbreak" />
      <div>
        <p className="text-4xl font-medium tabular-nums tracking-tight text-paper md:text-5xl">
          {x.cases} cases <span className="text-paper/45">in</span> {x.spanH} h
        </p>
        <p className="mt-2 text-sm text-paper/60">
          {x.residents} resident{x.residents === 1 ? '' : 's'} and {x.staff} staff member{x.staff === 1 ? '' : 's'} · flagged on the second case, not at handover days later
        </p>
      </div>
      {/* 48-hour ruler */}
      <div className="pt-6">
        <div className="relative h-px bg-white/15">
          <span className={`absolute inset-y-0 left-0 w-full origin-left bg-rust-2/60 transition-transform duration-[1400ms] ${EASE}`} style={{ transform: `scaleX(${done ? 1 : 0})` }} />
          {cases.map((c, i) => {
            const left = `${Math.min(100, (at(c.onset) / 48) * 100)}%`
            return (
              <span key={c.onset} className="absolute top-1/2" style={{ left }}>
                <span
                  className={`block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-espresso transition-all duration-700 ${EASE} ${c.who === 'staff' ? 'bg-[#f2c879]' : 'bg-rust-2'} ${done ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                  style={{ transitionDelay: `${400 + i * 350}ms` }}
                />
                <span className={`absolute left-0 top-3 -translate-x-1/2 whitespace-nowrap text-[10px] text-paper/55 transition-opacity duration-700 ${done ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: `${500 + i * 350}ms` }}>
                  {c.where}
                </span>
              </span>
            )
          })}
          <span className="absolute -top-7" style={{ left: `${(flagH / 48) * 100}%` }}>
            <span className={`block -translate-x-1/2 whitespace-nowrap rounded-full bg-rust px-2 py-0.5 text-[10px] font-medium text-paper transition-all duration-700 ${EASE} ${done ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`} style={{ transitionDelay: '1200ms' }}>
              flag · {clock(x.flaggedAt)}
            </span>
          </span>
        </div>
        <div className="mt-9 flex justify-between text-[10px] text-paper/35">
          <span>0 h · first case</span>
          <span>48 h window</span>
        </div>
      </div>
      <blockquote className="rounded-2xl bg-white/[0.05] p-4 text-[13px] leading-relaxed text-paper/75 ring-1 ring-white/10">
        <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-paper/40">Draft call note to the UKHSA health protection team</p>
        {x.note}
      </blockquote>
      <ul className="space-y-2 text-[13px] text-paper/70">
        {x.steps.slice(0, 4).map((s) => (
          <li key={s} className="flex gap-2">
            <Icon name="CheckSquare" size={15} className="mt-0.5 shrink-0 text-paper/40" />
            {s}
          </li>
        ))}
      </ul>
      <p className="mt-auto text-[11px] leading-relaxed text-paper/40">Standard outbreak checklist from local IPC guidance. Vera never advises on a resident’s treatment.</p>
    </Bezel>
  )
}

function ActionsCard({ o }: { o: Out }) {
  const name = (id: string) => o.homes.find((h) => h.id === id)?.name ?? id
  const top = o.actions.slice(0, 6)
  return (
    <Bezel className="h-full" inner="h-full p-6 md:p-8">
      <CardHead icon="ListChecks" k="For each home's owners" title={`Action plan · ${o.actions.length} items`} />
      <ul className="mt-6 divide-y divide-ink/[0.06]">
        {top.map((a, i) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${RAG_DOT[a.rag]}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] text-ink">{a.item}</span>
              <span className="block text-[11.5px] text-ink-3">
                {name(a.home)}
                {a.where ? ` · ${a.where}` : ''} · {a.owner}
              </span>
            </span>
            <span className="num shrink-0 rounded-full bg-ink/[0.04] px-2.5 py-1 text-[11px] text-ink-2">due {shortDate(a.due)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-ink-3">+{o.actions.length - top.length} more · sent to each owner the day the audit is in</p>
    </Bezel>
  )
}

function PackCard({ o }: { o: Out }) {
  // Show the home with a gap, so the pack visibly does its job.
  const p = o.packs.find((x) => x.rows.some((r) => r.status === 'partly' || r.status === 'gap')) ?? o.packs[0]
  const chip = {
    covered: 'bg-sage-2 text-sage',
    partly: 'bg-ochre-2 text-ochre',
    gap: 'bg-rust/10 text-rust',
    adviser: 'bg-ink/[0.05] text-ink-3',
  } as const
  const label = { covered: 'Evidenced', partly: 'Gap: audit missing', gap: 'No record', adviser: "Adviser's file" } as const
  return (
    <Bezel className="h-full" inner="h-full p-6 md:p-8">
      <CardHead icon="FolderOpen" k={`For CQC · ${p.name}`} title="Evidence pack, filed against the Code of Practice" />
      <ol className="mt-6 grid gap-x-6 sm:grid-cols-2">
        {p.rows.map((r) => (
          <li key={r.n} className="flex items-center justify-between gap-3 border-b border-ink/[0.06] py-2.5">
            <span className="flex min-w-0 items-baseline gap-2.5 text-[13px] leading-snug text-ink">
              <span className="num w-5 shrink-0 text-ink-3">{r.n}</span>
              <span>{r.title}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] ${chip[r.status]}`}>{label[r.status]}</span>
          </li>
        ))}
      </ol>
      <ul className="mt-5 flex flex-wrap gap-2">
        {p.files.map((f) => (
          <li key={f} className="flex items-center gap-1.5 rounded-full bg-paper-2/70 px-3 py-1.5 text-[11.5px] text-ink-2 ring-1 ring-ink/[0.05]">
            <Icon name="FileText" size={13} /> {f}
          </li>
        ))}
      </ul>
    </Bezel>
  )
}

function TrainingCard({ o }: { o: Out }) {
  const name = (id: string) => o.homes.find((h) => h.id === id)?.name ?? id
  const top = o.chase.slice(0, 5)
  const tone: Record<string, string> = {
    expired: 'bg-rust/10 text-rust',
    'never trained': 'bg-rust/10 text-rust',
    'due in 30 days': 'bg-ochre-2 text-ochre',
    'induction due': 'bg-ochre-2 text-ochre',
  }
  return (
    <Bezel className="h-full" inner="h-full p-6 md:p-8">
      <CardHead icon="Certificate" k="For each home manager" title={`Training chase · ${o.chase.length} staff`} />
      <ul className="mt-6 divide-y divide-ink/[0.06]">
        {top.map((c) => (
          <li key={c.staff} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <span className="min-w-0">
              <span className="num text-ink">{c.staff}</span>
              <span className="text-ink-3"> · {c.role} · {name(c.home)}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] ${tone[c.status]}`}>{c.status}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-3">Staff IDs only. Each manager gets their own list, earliest date first.</p>
    </Bezel>
  )
}

function SummaryCard({ o }: { o: Out }) {
  return (
    <Bezel tone="tint" className="h-full" inner="flex h-full flex-col p-6 md:p-8">
      <CardHead icon="Signature" k="For the adviser to sign" title="October summary, one page" />
      <ol className="mt-6 space-y-3">
        {o.summary.map((s, i) => (
          <li key={s} className="flex gap-3 text-[14.5px] leading-relaxed text-ink">
            <span className="num pt-0.5 text-[12px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
            {s}
          </li>
        ))}
      </ol>
      <div className="mt-auto flex items-end justify-between gap-6 pt-10">
        <span className="flex-1 border-b border-dashed border-ink/25 pb-1 text-[12px] text-ink-3">Reviewed and signed · Infection control adviser</span>
        <span className="flex items-center gap-1.5 text-[12px] text-sage">
          <Icon name="SealCheck" size={16} /> ready
        </span>
      </div>
    </Bezel>
  )
}

export function OutputsBoard({ fallback }: { fallback: Out }) {
  const { trace } = useTrace()
  const done = useDone()
  const r = useRun()
  const o = (r?.phase === 'done' && trace ? trace[trace.length - 1] : fallback) as Out
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
      <div className="md:col-span-7">
        <Heatmap o={o} done={done || !r} />
      </div>
      <div className="md:col-span-5">
        <OutbreakCard o={o} done={done || !r} />
      </div>
      <div className="md:col-span-5">
        <ActionsCard o={o} />
      </div>
      <div className="md:col-span-7">
        <PackCard o={o} />
      </div>
      <div className="md:col-span-5">
        <TrainingCard o={o} />
      </div>
      <div className="md:col-span-7">
        <SummaryCard o={o} />
      </div>
    </div>
  )
}
