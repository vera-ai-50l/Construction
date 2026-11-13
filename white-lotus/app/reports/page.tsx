import type { Metadata } from 'next'
import { Nav } from '@/components/ui/Nav'
import { Bezel } from '@/components/ui/Bezel'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Reveal } from '@/components/ui/Reveal'
import { Icon } from '@/components/ui/icons'
import { ReportBoard } from '@/components/ReportBoard'

export const metadata: Metadata = { title: 'Weekly report · Vera' }

const BEFORE = [
  ['Files', 'On Monday someone opens the attendance sheet, the hiring tracker and the HR inbox.'],
  ['Calculator', 'The numbers are copied into a template and checked by hand.'],
  ['HourglassMedium', 'The report reaches leadership mid-week, already out of date.'],
  ['Shuffle', 'The format changes with whoever builds it.'],
]
const AFTER = [
  ['ArrowsClockwise', 'The numbers are pulled from the roster, the recruitment sheet and the HR assistant.'],
  ['Clock', 'The report arrives every Monday at 9:00 AM, by email or WhatsApp.'],
  ['ListChecks', 'The same short format every week, with the three or four things that need attention.'],
  ['ShieldCheck', 'Summary figures only: no patient details and no individual staff names.'],
]

export default function Page() {
  return (
    <>
      <Nav />
      <main className="px-4 pb-24 pt-32 md:px-8 md:pt-40 print:p-0">
        <div className="mx-auto max-w-[1200px]">
          <Reveal className="print:hidden">
            <Eyebrow>Weekly report</Eyebrow>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] md:text-6xl">
              One short weekly report, <span className="serif font-normal text-teal">without anyone building it by hand.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
              Staffing gaps, hiring progress and the questions staff ask HR, gathered from the tools already running and sent at a fixed time. Choose who gets it and press build.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-12 print:mt-0">
            <ReportBoard />
          </Reveal>

          <section className="mt-28 print:hidden">
            <Reveal>
              <Eyebrow>Before and after</Eyebrow>
              <h2 className="mt-6 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] md:text-5xl">From Wednesday’s spreadsheet to Monday’s summary.</h2>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {[
                { t: 'Today', rows: BEFORE, dark: false },
                { t: 'With the weekly report', rows: AFTER, dark: true },
              ].map((c, ci) => (
                <Reveal key={c.t} delay={ci * 120}>
                  <Bezel tone={c.dark ? 'dark' : 'light'} className="h-full" inner="h-full p-7 md:p-8">
                    <p className={`text-[11px] uppercase tracking-[0.2em] ${c.dark ? 'text-[#7fd1c4]' : 'text-ink-3'}`}>{c.t}</p>
                    <ul className="mt-6 space-y-5">
                      {c.rows.map(([ic, text], i) => (
                        <Reveal as="li" key={text} delay={200 + i * 120} className="flex gap-4">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.dark ? 'bg-white/[0.07] text-[#7fd1c4]' : 'bg-ground text-ink-2'}`}>
                            <Icon name={ic} size={18} />
                          </span>
                          <span className={`pt-2 text-[15px] leading-relaxed ${c.dark ? 'text-white/75' : 'text-ink-2'}`}>{text}</span>
                        </Reveal>
                      ))}
                    </ul>
                  </Bezel>
                </Reveal>
              ))}
            </div>
            <p className="mt-4 px-1 text-[12px] text-ink-3">To start, we agree with leadership which numbers matter and where they come from, then replace one manual report and compare.</p>
          </section>
        </div>
      </main>
    </>
  )
}
