'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildReport, type Report } from '@/lib/report'
import { Bezel } from './ui/Bezel'
import { Icon } from './ui/icons'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'
const RECIPIENTS = ['HR Director', 'Medical Superintendent', 'Nursing Superintendent', 'CEO']

export function ReportBoard() {
  const report = useMemo(() => buildReport(), [])
  const [to, setTo] = useState<string[]>(['HR Director', 'Medical Superintendent', 'Nursing Superintendent'])
  const [format, setFormat] = useState<'email' | 'whatsapp'>('email')
  const [phase, setPhase] = useState<'idle' | 'gathering' | 'ready'>('idle')
  const [src, setSrc] = useState(0)

  useEffect(() => {
    if (phase !== 'gathering') return
    if (src >= 3) {
      const t = setTimeout(() => setPhase('ready'), 450)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setSrc((n) => n + 1), 700)
    return () => clearTimeout(t)
  }, [phase, src])

  function build() {
    setSrc(0)
    setPhase('gathering')
  }

  const sources = [
    { icon: 'UsersThree', t: 'Roster and attendance', d: `${report.sources.records.toLocaleString('en-IN')} shift records · ${report.staffing.shifts} shifts so far` },
    { icon: 'Briefcase', t: 'Recruitment sheet', d: `${report.sources.applications} applications this week` },
    { icon: 'ChatsCircle', t: 'HR assistant log', d: `${report.sources.questions} staff questions` },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Settings and sources */}
      <div className="min-w-0 print:hidden lg:col-span-4">
        <div className="space-y-4 lg:sticky lg:top-28">
          <Bezel inner="p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-3">Sent to</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {RECIPIENTS.map((r) => {
                const on = to.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTo(on ? to.filter((x) => x !== r) : [...to, r])}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] ring-1 transition-colors duration-300 ${on ? 'bg-ink text-white ring-ink' : 'bg-card text-ink-2 ring-ink/10 hover:ring-ink/25'}`}
                  >
                    <Icon name={on ? 'Check' : 'Plus'} size={11} weight="bold" /> {r}
                  </button>
                )
              })}
            </div>
            <p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-ink-3">When</p>
            <p className="mt-1.5 flex items-center gap-2 text-[13.5px] text-ink">
              <Icon name="CalendarBlank" size={16} /> Every Monday at 9:00 AM
            </p>
            <p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-ink-3">Format</p>
            <div className="mt-2 flex rounded-full bg-ground p-1">
              {(
                [
                  ['email', 'Email · full report', 'EnvelopeSimple'],
                  ['whatsapp', 'WhatsApp · 5 lines', 'ChatCircleText'],
                ] as const
              ).map(([k, l, ic]) => (
                <button key={k} type="button" onClick={() => setFormat(k)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[12px] transition-all duration-500 ${EASE} ${format === k ? 'bg-card text-ink shadow-[0_4px_14px_-6px_rgba(16,40,40,0.35)]' : 'text-ink-3'}`}>
                  <Icon name={ic} size={13} /> {l}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={build}
              disabled={phase === 'gathering'}
              className={`group relative mt-6 flex w-full cursor-pointer items-center justify-between overflow-hidden rounded-full bg-teal py-2 pl-5 pr-2 text-[14px] font-medium text-white transition-transform duration-500 ${EASE} active:scale-[0.98] disabled:cursor-default`}
            >
              {phase === 'idle' && <span className="pointer-events-none absolute inset-0 rounded-full bg-white/20 [animation:pulse-ring_2.2s_cubic-bezier(0.16,1,0.3,1)_infinite]" />}
              <span className="relative">{phase === 'gathering' ? 'Building…' : phase === 'ready' ? 'Build again' : 'Build this week’s report'}</span>
              <span className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ${EASE} group-hover:translate-x-0.5`}>
                <Icon name={phase === 'ready' ? 'ArrowCounterClockwise' : 'Play'} size={13} weight="fill" />
              </span>
            </button>
          </Bezel>

          <Bezel inner="p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-3">Pulled automatically from</p>
            <ul className="mt-3 space-y-2.5">
              {sources.map((s, i) => {
                const done = phase === 'ready' || (phase === 'gathering' && src > i)
                const busy = phase === 'gathering' && src === i
                return (
                  <li key={s.t} className={`flex items-center gap-3 rounded-2xl p-2.5 transition-colors duration-500 ${done ? 'bg-teal-2/60' : 'bg-ground'}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? 'bg-teal text-white' : 'bg-card text-ink-2 ring-1 ring-ink/[0.06]'}`}>
                      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal/25 border-t-teal" /> : <Icon name={done ? 'Check' : s.icon} size={15} weight={done ? 'bold' : 'light'} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">{s.t}</span>
                      <span className="block truncate text-[11.5px] text-ink-3">{s.d}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">Summary figures only. No patient details, and no individual staff names.</p>
          </Bezel>
        </div>
      </div>

      {/* The report */}
      <div className="min-w-0 lg:col-span-8 print:col-span-12">
        {phase !== 'ready' ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-[1.75rem] border border-dashed border-ink/15 bg-card/50 p-8 text-center">
            {phase === 'gathering' ? (
              <p className="text-[14px] text-ink-2">Gathering this week’s numbers… {Math.min(src + 1, 3)} of 3 sources</p>
            ) : (
              <div>
                <Icon name="FileText" size={36} className="mx-auto text-ink-3" />
                <p className="mt-3 text-[15px] font-medium">The report appears here.</p>
                <p className="mt-1 text-[13px] text-ink-3">Press “Build this week’s report”. In use, it is built and sent on its own.</p>
              </div>
            )}
          </div>
        ) : format === 'whatsapp' ? (
          <WhatsApp report={report} to={to} />
        ) : (
          <Email report={report} to={to} />
        )}
      </div>
    </div>
  )
}

function Section({ i, title, children }: { i: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 [animation:rise_600ms_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: `${150 + i * 140}ms` }}>
      <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">
        <span className="h-px w-5 bg-ink/20" /> {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Bar({ v, max, tone = 'bg-teal' }: { v: number; max: number; tone?: string }) {
  return (
    <span className="relative block h-2 w-full overflow-hidden rounded-full bg-ground-2">
      <span className={`absolute inset-y-0 left-0 w-full origin-left rounded-r-[4px] transition-transform duration-1000 ${EASE} ${tone}`} style={{ transform: `scaleX(${max ? v / max : 0})` }} />
    </span>
  )
}

function Email({ report: r, to }: { report: Report; to: string[] }) {
  const s = r.staffing
  const maxBelow = Math.max(...s.byWard.map((w) => w.count), 1)
  const maxTopic = Math.max(...r.hr.topics.map((t) => t.asked))
  return (
    <div className="rounded-[1.75rem] bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.06] [animation:rise_600ms_cubic-bezier(0.16,1,0.3,1)]">
      <article className="rounded-[calc(1.75rem-0.375rem)] bg-card px-6 py-7 shadow-[0_30px_60px_-34px_rgba(16,40,40,0.25)] md:px-10 md:py-9">
        {/* Email header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/[0.07] pb-5 text-[12px] text-ink-3">
          <div className="space-y-0.5">
            <p>
              <span className="text-ink-2">From:</span> Vera reports
            </p>
            <p>
              <span className="text-ink-2">To:</span> {to.length ? to.join(', ') : 'nobody selected'}
            </p>
            <p>
              <span className="text-ink-2">Subject:</span> <span className="text-ink">Weekly HR and staffing summary, {s.from} – {s.to}</span>
            </p>
          </div>
          <button type="button" onClick={() => window.print()} className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-ink-2 ring-1 ring-ink/10 hover:bg-ground print:hidden">
            <Icon name="Printer" size={14} /> Print or save as PDF
          </button>
        </div>

        <h2 className="mt-7 text-3xl font-semibold tracking-[-0.03em]">
          Weekly summary <span className="serif font-normal text-teal">· HR and staffing</span>
        </h2>
        <p className="mt-1 text-[13px] text-ink-3">
          {s.from} – {s.to} (week to date) · built automatically from three sources · sample data
        </p>

        {/* KPI tiles */}
        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [`${s.attendance}%`, 'attendance on shifts so far', 'UsersThree'],
            [`${s.belowTotal}`, `ward-shifts below minimum, of ${s.wardShifts}`, 'WarningCircle'],
            [`${r.hiring.booked}`, `interviews booked · ${r.hiring.n} applications`, 'CalendarCheck'],
            [`${r.hr.rate}%`, `of ${r.hr.asked} staff questions answered without HR`, 'ChatsCircle'],
          ].map(([a, b, ic], i) => (
            <div key={b} className="rounded-2xl bg-ground p-4 [animation:rise_600ms_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: `${i * 90}ms` }}>
              <Icon name={ic} size={16} className="text-teal" />
              <p className="mt-3 text-[28px] font-semibold leading-none tabular-nums tracking-tight">{a}</p>
              <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">{b}</p>
            </div>
          ))}
        </div>

        <Section i={0} title="Needs attention this week">
          <ol className="space-y-3">
            {r.attention.map((a, i) => (
              <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed text-ink">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-risk-2 text-[11px] font-semibold text-risk">{i + 1}</span>
                {a}
              </li>
            ))}
          </ol>
        </Section>

        <Section i={1} title="Staffing">
          <p className="text-[13.5px] text-ink-2">
            {s.shifts} shifts across {s.byWard.length} wards. {s.leave} on leave, {s.absent} absent, {s.late} late. Each dot is one shift, red where cover fell below the ward’s minimum.
          </p>
          <ul className="mt-4 space-y-2">
            {s.byWard.map((w) => (
              <li key={w.ward} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-[13px] sm:grid-cols-[10rem_1fr_6rem_2rem]">
                <span className="truncate">{w.ward}</span>
                <span className="flex flex-wrap gap-[3px]">
                  {w.marks.map((m, i) => (
                    <span key={i} className={`h-2.5 w-2.5 rounded-[3px] ${m ? 'bg-below' : 'bg-ok/70'}`} />
                  ))}
                </span>
                <span className="hidden sm:block">
                  <Bar v={w.count} max={maxBelow} tone="bg-below" />
                </span>
                <span className="num text-right text-ink-2">{w.count}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section i={2} title="Hiring">
          <p className="text-[13.5px] text-ink-2">
            {r.hiring.n} applications for {r.hiring.openings} openings. Average first reply {r.hiring.avgReply} seconds. {r.hiring.complete} applications complete without chasing.
          </p>
          <div className="-mx-1 mt-4 overflow-x-auto px-1">
            <table className="w-full min-w-[460px] text-left text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  <th className="pb-2 font-normal">Role</th>
                  <th className="pb-2 text-right font-normal">Openings</th>
                  <th className="pb-2 text-right font-normal">Applied</th>
                  <th className="pb-2 text-right font-normal">Complete</th>
                  <th className="pb-2 text-right font-normal">Interviews</th>
                </tr>
              </thead>
              <tbody>
                {r.hiring.byRole.map((x) => (
                  <tr key={x.role} className="border-t border-ink/[0.05]">
                    <td className="py-2">{x.role}</td>
                    <td className="num py-2 text-right text-ink-2">{x.openings}</td>
                    <td className="num py-2 text-right">{x.applied}</td>
                    <td className="num py-2 text-right">{x.complete}</td>
                    <td className="num py-2 text-right font-medium text-ok">{x.booked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section i={3} title="Staff questions to HR">
          <p className="text-[13.5px] text-ink-2">
            {r.hr.asked} questions to the HR assistant. {r.hr.answered} answered from approved policy; {r.hr.toHR} passed to HR.
          </p>
          <div className="mt-4 grid gap-6 md:grid-cols-[1.4fr_1fr]">
            <ul className="space-y-2">
              {r.hr.topics.map((t) => (
                <li key={t.topic} className="grid grid-cols-[9.5rem_1fr_2rem] items-center gap-3 text-[12.5px]">
                  <span className="truncate">{t.topic}</span>
                  <Bar v={t.asked} max={maxTopic} />
                  <span className="num text-right text-ink-2">{t.asked}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl bg-risk-2/50 p-4">
              <p className="text-[12px] font-medium text-risk">Not in any policy yet</p>
              <ul className="mt-2 space-y-1.5 text-[12.5px]">
                {r.hr.notCovered.map((t) => (
                  <li key={t.theme} className="flex justify-between gap-3">
                    <span>{t.theme}</span>
                    <span className="num text-ink-2">{t.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <p className="mt-10 border-t border-ink/[0.07] pt-5 text-[11.5px] leading-relaxed text-ink-3">
          Built automatically from the roster and attendance data, the recruitment sheet and the HR assistant’s log. Summary figures only: no patient details and no individual staff names. Sample data for this demo.
        </p>
      </article>
    </div>
  )
}

function WhatsApp({ report, to }: { report: Report; to: string[] }) {
  const lines = report.whatsapp.split('\n')
  return (
    <div className="mx-auto max-w-[420px] rounded-[2.6rem] bg-night p-2.5 shadow-[0_40px_80px_-40px_rgba(16,40,40,0.6)] ring-1 ring-black/40 [animation:rise_600ms_cubic-bezier(0.16,1,0.3,1)]">
      <div className="overflow-hidden rounded-[2.1rem] bg-[#efeae2]">
        <div className="flex items-center gap-3 bg-[#0f5a52] px-4 pb-3 pt-5 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Icon name="ChartBar" size={16} />
          </span>
          <span className="flex-1">
            <span className="block text-[14px] font-medium">Vera · Weekly summary</span>
            <span className="block truncate text-[11px] text-white/70">to {to.join(', ') || 'nobody selected'}</span>
          </span>
          <span className="num text-[11px] text-white/70">Mon 9:00</span>
        </div>
        <div className="min-h-[380px] px-3 py-5">
          <div className="mr-6 rounded-2xl rounded-tl-md bg-white px-3.5 py-3 text-[13px] leading-relaxed text-ink shadow-sm">
            {lines.map((l, i) => (
              <p key={i} className={`${i === 0 ? 'mb-1 font-semibold' : 'mt-1'} [animation:rise_400ms_cubic-bezier(0.16,1,0.3,1)_both]`} style={{ animationDelay: `${i * 220}ms` }}>
                {l}
              </p>
            ))}
            <span className="mt-1 block text-right text-[10px] text-ink-3">9:00 AM ✓✓</span>
          </div>
        </div>
      </div>
    </div>
  )
}
