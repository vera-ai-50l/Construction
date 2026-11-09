import type { ReactNode } from 'react'
import type { Out } from '@/lib/ipc-flow.mjs'
import type { RunRow } from '@/content/runs'
import { assumptions, context, ipcSteps, sources } from '@/content/ipc'
import { Bezel } from '../ui/Bezel'
import { Eyebrow } from '../ui/Eyebrow'
import { PillButton } from '../ui/PillButton'
import { Reveal } from '../ui/Reveal'
import { Icon } from '../ui/icons'
import { Nav } from '../Nav'
import { Flow } from '../Flow'
import { BeforeAfter, RunButton, RunProvider, RunZone } from '../run/Run'
import { ResultsGate, StepConsole, TraceProvider } from './IpcRun'
import { OutputsBoard } from './Outputs'
import { MonthLanes } from './MonthLanes'
import { Calculator } from './Calculator'
import { HeroBoard } from './HeroBoard'
import { gbp } from '@/lib/format'

function Section({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 px-4 py-24 md:px-8 md:py-36 ${className}`}>
      <div className="mx-auto max-w-[1240px]">{children}</div>
    </section>
  )
}

const day = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// The before → after rows under the Run button. Every "after" is read off the flow's own output.
export function runRows(o: Out): RunRow[] {
  const name = (id: string) => o.homes.find((h) => h.id === id)?.name ?? id
  const rows: RunRow[] = []
  const miss = o.missing[0]
  if (miss) {
    const a = o.actions.find((x) => x.home === miss.home && x.type === miss.type)
    rows.push({ source: `${name(miss.home)} · audit returns`, before: `${o.auditTypes[miss.type].name} audit for October`, issue: 'Never sent; nobody noticed until the report', after: `Flagged on day 1 · manager asked, due ${a ? day(a.due) : ''}`, step: 0 })
  }
  rows.push({ source: `${o.stats.homes} homes · paper forms`, before: `${o.stats.lines} checklist lines on ${o.stats.returns} forms`, issue: 'Scored by hand, typed up at month end', after: `${o.scores.length} audits scored · ${o.actions.length} actions, each with an owner`, step: 1 })
  const red = [...o.scores].sort((a, b) => a.pct - b.pct)[0]
  if (red) {
    const first = o.actions.find((x) => x.home === red.home && x.type === red.type)
    rows.push({ source: `${name(red.home)} · ${o.auditTypes[red.type].name.toLowerCase()} audit`, before: `${red.checked - red.failed} of ${red.checked} passed`, issue: 'Filed in a ring binder', after: `Red ${red.pct}% · ${red.failed} actions, due ${first ? day(first.due) : ''}`, step: 1 })
  }
  const ob = o.outbreaks[0]
  if (ob) {
    rows.push({ source: `${ob.name} · symptom log`, before: `D&V in ${ob.where}`, issue: 'Spotted at a later handover', after: `Suspected outbreak at ${ob.flaggedAt.slice(11, 16)} on ${day(ob.flaggedAt)} · HPT call note ready`, step: 2 })
  }
  const w = o.watch[0]
  if (w) {
    const rooms = o.symptoms.filter((s) => s.home === w.home).map((s) => s.where.replace('Room ', ''))
    rows.push({ source: `${name(w.home)} · symptom log`, before: `Diarrhoea in rooms ${rooms.join(' and ')}`, issue: 'Linked or not? Nobody is sure', after: 'Not within 48 h of each other · kept on watch', step: 2 })
  }
  rows.push({ source: `${o.stats.homes} training spreadsheets`, before: `${o.training.length} staff, one date each`, issue: 'Expiries found at inspection', after: `${o.chase.length} to chase, earliest date first`, step: 3 })
  rows.push({ source: 'CQC inspection', before: '“Show us your infection control evidence”', issue: 'Two days to pull the folder together', after: `${o.packs.length} packs, filed against the 10 criteria`, step: 4 })
  const m = o.value.month
  rows.push({ source: "The adviser's month", before: `${m.adviserBefore} h reading returns and writing advice`, issue: `${o.stats.homes} homes, ${o.stats.homes} formats`, after: `${m.adviserAfter} h reviewing and signing · ${gbp(m.adviserPounds, 2)} back`, step: 5 })
  return rows
}

export function IpcPage({ out }: { out: Out }) {
  const v = out.value
  const rows = runRows(out)
  return (
    <>
      <Nav
        links={[
          { href: '#month', label: 'Before & after' },
          { href: '#flow', label: 'The flow' },
          { href: '#outputs', label: 'Results' },
          { href: '#value', label: 'Value' },
          { href: '#sources', label: 'Sources' },
        ]}
        cta={{ href: '#flow', label: 'Run the flow' }}
      />
      <main>
        {/* ───────────── Hero ───────────── */}
        <section id="top" className="relative overflow-hidden px-4 pb-20 pt-32 md:px-8 md:pb-28 md:pt-44">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(23,23,23,0.08)_1px,transparent_1.3px)] [background-size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
          <div aria-hidden className="pointer-events-none absolute -right-32 top-24 hidden h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(15,139,95,0.10),transparent)] md:block" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 md:grid-cols-[1.1fr_1fr] md:gap-16">
            <div>
              <Reveal>
                <Eyebrow tone="rust">Vera · IPC Compliance Kit</Eyebrow>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="display mt-7 text-[2.7rem] leading-[1.02] text-ink sm:text-6xl md:text-[5rem]">
                  Infection control for every home, <em className="text-rust">on one page by the 1st.</em>
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
                  Each month a care home walks four infection-control audits on paper, types them up, chases training and posts a report to its adviser. Vera takes the returns as they come in, scores them, sends each action to its owner, flags a D&V cluster on the second case and files the CQC evidence. The adviser reviews one page and signs.
                </p>
              </Reveal>
              <Reveal delay={240} className="mt-10 flex flex-wrap items-center gap-3">
                <PillButton href="#flow">Run the flow</PillButton>
                <PillButton href="#value" variant="light">
                  See the £ maths
                </PillButton>
              </Reveal>
              <Reveal delay={320}>
                <p className="mt-8 flex max-w-md items-start gap-2 text-xs leading-relaxed text-ink-3">
                  <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
                  Sample data: six fictional care homes, October 2026. No resident names anywhere: rooms and staff IDs only.
                </p>
              </Reveal>
            </div>
            <Reveal delay={200}>
              <HeroBoard o={out} />
            </Reveal>
          </div>

          <Reveal delay={120} className="relative mx-auto mt-24 max-w-[1240px]">
            <dl className="grid grid-cols-2 gap-y-10 border-t border-ink/[0.08] pt-10 md:grid-cols-4">
              {[
                [`${v.month.homeSaved} h`, `a month back for the managers of ${v.homes} homes`],
                [`${v.month.adviserSaved} h`, 'a month back for the adviser'],
                [gbp(v.year.pounds), `a year, at ${gbp(v.assumptions.managerRate, 2)} and ${gbp(v.assumptions.consultantRate)} an hour`],
                ['2nd case', 'is when a D&V cluster is flagged, with the call note drafted'],
              ].map(([a, b]) => (
                <div key={b} className="pr-6">
                  <dt className="text-4xl font-medium tabular-nums tracking-[-0.04em] text-ink md:text-5xl">{a}</dt>
                  <dd className="mt-2 max-w-[15rem] text-sm text-ink-3">{b}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* ───────────── Context ───────────── */}
        <Section id="why" className="!pt-8">
          <div className="grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-end">
            <Reveal>
              <Eyebrow>Why it matters</Eyebrow>
              <h2 className="display mt-6 text-4xl leading-[1.05] text-ink md:text-6xl">The checks are clinical. The paperwork is not.</h2>
            </Reveal>
            <Reveal delay={100}>
              <p className="max-w-xl text-lg leading-relaxed text-ink-2">
                CQC judges infection control under its Safe question against the ten criteria of the Code of Practice. The physical checks need trained eyes. Scoring, typing up, chasing and filing do not, and they are what crowds out the adviser’s judgement.
              </p>
            </Reveal>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
            {context.map((c, i) => (
              <Reveal key={c.figure} delay={(i % 4) * 70} className={['md:col-span-5', 'md:col-span-7', 'md:col-span-7', 'md:col-span-5'][i]}>
                <Bezel className="h-full" tone={i === 1 ? 'dark' : 'light'} inner="flex h-full flex-col justify-between gap-10 p-7 md:p-8">
                  <p className={`text-5xl font-medium tabular-nums tracking-[-0.04em] md:text-6xl ${i === 1 ? 'text-paper' : 'text-ink'}`}>{c.figure}</p>
                  <div>
                    <p className={`max-w-md text-[15px] leading-relaxed ${i === 1 ? 'text-paper/70' : 'text-ink-2'}`}>{c.text}</p>
                    <a href={sources[c.source].href} target="_blank" rel="noopener noreferrer" className={`mt-4 inline-flex items-center gap-1.5 text-[12px] underline decoration-1 underline-offset-4 ${i === 1 ? 'text-paper/45 decoration-white/20' : 'text-ink-3 decoration-ink/20'}`}>
                      Source <Icon name="ArrowUpRight" size={12} />
                    </a>
                  </div>
                </Bezel>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ───────────── Before & after: one month ───────────── */}
        <Section id="month" className="bg-paper-2/50">
          <Reveal>
            <Eyebrow>Before & after</Eyebrow>
            <h2 className="display mt-6 max-w-4xl text-4xl leading-[1.05] text-ink md:text-6xl">One home’s October, played back twice.</h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
              Left, the month as it runs today: paper, a spreadsheet and an email. Right, the same month with Vera. The audits still get walked. What disappears is everything after the clipboard.
            </p>
          </Reveal>
          <Reveal delay={100} className="mt-14">
            <MonthLanes lines={v.lines} homes={v.homes} />
          </Reveal>
        </Section>

        {/* ───────────── The flow + results (one run drives both) ───────────── */}
        <RunProvider n={ipcSteps.length}>
          <TraceProvider>
            <RunZone label="October · 6 homes · 6 steps">
              <Section id="flow">
                <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-end">
                  <Reveal>
                    <Eyebrow>The flow</Eyebrow>
                    <h2 className="display mt-6 text-4xl leading-[1.05] text-ink md:text-6xl">
                      Six steps. <em className="text-rust">Press run</em> and October goes through all of them.
                    </h2>
                  </Reveal>
                  <Reveal delay={100}>
                    <p className="text-lg leading-relaxed text-ink-2">
                      The button runs the real workflow in your browser: the same code that runs in n8n when a home submits its returns. Scores, the outbreak rule, dates and pounds are fixed code. No AI decides anything here.
                    </p>
                    <div className="mt-8">
                      <RunButton big />
                    </div>
                  </Reveal>
                </div>
                <Reveal delay={80} className="mt-16">
                  <Flow steps={ipcSteps} />
                </Reveal>
                <Reveal delay={80} className="mt-12">
                  <StepConsole steps={ipcSteps} />
                </Reveal>
                <BeforeAfter rows={rows} steps={ipcSteps} where="in October's returns" />
              </Section>

              <Section id="outputs" className="!pt-0">
                <Reveal>
                  <Eyebrow>What comes out</Eyebrow>
                  <h2 className="display mt-6 max-w-4xl text-4xl leading-[1.05] text-ink md:text-6xl">Six things land the morning after month end.</h2>
                  <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">One board for the adviser, an alert for the home with the cluster, a list for every owner, a pack for CQC and a page to sign.</p>
                </Reveal>
                <div className="mt-14">
                  <ResultsGate>
                    <OutputsBoard fallback={out} />
                  </ResultsGate>
                </div>
              </Section>
            </RunZone>
          </TraceProvider>
        </RunProvider>

        {/* ───────────── Value ───────────── */}
        <Section id="value" className="bg-paper-2/50">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-end">
            <Reveal>
              <Eyebrow>The value, in pounds and hours</Eyebrow>
              <h2 className="display mt-6 text-4xl leading-[1.05] text-ink md:text-6xl">
                {gbp(v.year.pounds)} a year <em className="text-rust">for six homes.</em> Move the sliders.
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-lg leading-relaxed text-ink-2">
                This runs the flow’s own Hours & £ step. Only time is counted in pounds: manager hours at their cost to the home, adviser hours at a consultant’s rate. Faster outbreak response is shown, not priced.
              </p>
            </Reveal>
          </div>
          <Reveal delay={80} className="mt-14">
            <Calculator />
          </Reveal>
        </Section>

        {/* ───────────── Guardrails ───────────── */}
        <Section id="trust">
          <Reveal>
            <Eyebrow>How it is built</Eyebrow>
            <h2 className="display mt-6 max-w-3xl text-4xl leading-[1.05] text-ink md:text-6xl">Software for the paperwork. Clinicians for the judgement.</h2>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              ['ShieldCheck', 'No resident names', 'Audits, actions and training carry no resident data. The symptom log uses room numbers only. Each home signs a data processing agreement; records stay in a UK region, with every access logged.'],
              ['Stethoscope', 'No clinical advice', 'Vera never suggests a treatment or an antibiotic for anyone. Outbreak steps are the standard local checklist. The adviser reviews and signs every report.'],
              ['Robot', 'AI reads, code counts', 'AI turns a photo of a paper form into rows and drafts wording. Scores, the 48-hour rule, due dates and every pound are fixed code you can check.'],
            ].map(([ic, t, d], i) => (
              <Reveal key={t} delay={i * 90}>
                <Bezel className="h-full" inner="h-full p-7 md:p-8">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.04] text-rust">
                    <Icon name={ic} size={20} />
                  </span>
                  <h3 className="mt-8 text-2xl font-medium tracking-tight text-ink">{t}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{d}</p>
                </Bezel>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ───────────── Sources ───────────── */}
        <Section id="sources" className="bg-espresso text-paper">
          <Reveal>
            <Eyebrow tone="dark">Method & sources</Eyebrow>
            <h2 className="display mt-6 max-w-3xl text-4xl leading-[1.05] md:text-6xl">Every number, and where it comes from.</h2>
          </Reveal>
          <Reveal delay={80}>
            <ul className="mt-14 divide-y divide-white/10 border-y border-white/10">
              {assumptions.map((a) => (
                <li key={a.label} className="grid gap-2 py-5 md:grid-cols-[1.1fr_0.7fr_2.4fr] md:gap-8">
                  <span className="text-[15px] text-paper">{a.label}</span>
                  <span className="num text-[15px] text-rust-2">{a.value}</span>
                  <span className="text-[14px] leading-relaxed text-paper/65">
                    {a.how}
                    {a.source && (
                      <>
                        {' '}
                        <a href={sources[a.source].href} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-paper/45 underline decoration-white/20 underline-offset-4 hover:text-paper">
                          Source ↗
                        </a>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={80}>
            <ol className="mt-12 grid gap-x-10 gap-y-3 text-[13px] text-paper/55 md:grid-cols-2">
              {Object.values(sources).map((s, i) => (
                <li key={s.href} className="flex gap-3">
                  <span className="num text-paper/30">{String(i + 1).padStart(2, '0')}</span>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline decoration-white/15 underline-offset-4 hover:text-paper">
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </Reveal>
          <p className="mt-16 border-t border-white/10 pt-8 text-xs leading-relaxed text-paper/40">
            Vera · IPC Compliance Kit · prepared November 2026. Homes, staff and cases are fictional sample data. Time per task is Vera’s estimate, to be confirmed with a working adviser before any figure is quoted to a client.
          </p>
        </Section>
      </main>
    </>
  )
}
