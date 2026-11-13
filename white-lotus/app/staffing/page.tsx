import type { Metadata } from 'next'
import { Nav } from '@/components/ui/Nav'
import { Bezel } from '@/components/ui/Bezel'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Reveal } from '@/components/ui/Reveal'
import { Icon } from '@/components/ui/icons'
import { StaffingBoard } from '@/components/StaffingBoard'

export const metadata: Metadata = { title: 'Staffing summary · Vera' }

const BEFORE = [
  ['7:00', 'Shift starts. Absences reach ward in-charges as calls and WhatsApp messages.'],
  ['7:15 – 9:30', 'Each in-charge counts heads and phones the nursing office.'],
  ['~10:00', 'Someone builds the staffing sheet by hand from the calls.'],
  ['Late morning', 'A short ward is found on rounds, and cover is arranged late.'],
]
const AFTER = [
  ['7:00', 'Shift starts. Staff mark attendance as they do today, on the biometric or the register.'],
  ['7:25', 'Vera reads the roster and attendance, matches staff by ID and applies each ward’s minimum.'],
  ['7:30', 'The duty manager gets one message: ICU needs 1 nurse, Emergency is waiting on 1 mark.'],
  ['7:35', 'The duty manager decides who to call or move. Vera never assigns anyone.'],
]

export default function Page() {
  return (
    <>
      <Nav />
      <main className="px-4 pb-24 pt-32 md:px-8 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <Eyebrow>Staffing summary</Eyebrow>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] md:text-6xl">
              Which wards are short, <span className="serif font-normal text-teal">in one message at 7:30.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
              Planned against present for every ward and shift, checked against the hospital’s own minimum cover. Pick a day and shift, open a ward, change someone’s mark, and send the duty manager’s summary.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-12">
            <StaffingBoard />
          </Reveal>

          {/* Before and after */}
          <section className="mt-28">
            <Reveal>
              <Eyebrow>Before and after</Eyebrow>
              <h2 className="mt-6 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] md:text-5xl">From a sheet built by 10, to a message at 7:30.</h2>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {[
                { t: 'Today, by hand', rows: BEFORE, dark: false },
                { t: 'With the daily summary', rows: AFTER, dark: true },
              ].map((c, ci) => (
                <Reveal key={c.t} delay={ci * 120}>
                  <Bezel tone={c.dark ? 'dark' : 'light'} className="h-full" inner="h-full p-7 md:p-8">
                    <p className={`text-[11px] uppercase tracking-[0.2em] ${c.dark ? 'text-[#7fd1c4]' : 'text-ink-3'}`}>{c.t}</p>
                    <ol className="relative mt-6 space-y-6">
                      <span aria-hidden className={`absolute bottom-2 left-[5px] top-2 w-px ${c.dark ? 'bg-white/15' : 'bg-ink/10'}`} />
                      {c.rows.map(([time, text], i) => (
                        <Reveal as="li" key={time} delay={200 + i * 140} className="relative grid grid-cols-[1.5rem_6.5rem_1fr] gap-2">
                          <span className={`mt-1.5 h-[11px] w-[11px] rounded-full ring-4 ${c.dark ? 'bg-[#7fd1c4] ring-night' : i === 3 ? 'bg-below ring-card' : 'bg-ink/30 ring-card'}`} />
                          <span className={`num text-[13px] ${c.dark ? 'text-white' : 'text-ink'}`}>{time}</span>
                          <span className={`text-[14.5px] leading-relaxed ${c.dark ? 'text-white/70' : 'text-ink-2'}`}>{text}</span>
                        </Reveal>
                      ))}
                    </ol>
                  </Bezel>
                </Reveal>
              ))}
            </div>
            <p className="mt-4 px-1 text-[12px] text-ink-3">Times are illustrative. We measure them on one ward first, against what the ward manager builds by hand.</p>
          </section>

          {/* Safeguards and pilot inputs */}
          <section className="mt-24 grid gap-5 md:grid-cols-3">
            {[
              ['ShieldCheck', 'Reports and flags only', 'It never schedules, assigns or disciplines anyone. The duty manager decides every move.'],
              ['IdentificationCard', 'Staff IDs, not names', 'IDs can replace names while we start. Only the people you name receive the summary.'],
              ['FileCsv', 'What we need from you', 'One week of roster and attendance (spreadsheet, HRMS export or register photos), the minimum-cover rules, and who receives the message.'],
            ].map(([ic, t, d], i) => (
              <Reveal key={t} delay={i * 90}>
                <Bezel className="h-full" inner="h-full p-7">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-2 text-teal">
                    <Icon name={ic} size={20} />
                  </span>
                  <p className="mt-7 text-lg font-semibold tracking-tight">{t}</p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{d}</p>
                </Bezel>
              </Reveal>
            ))}
          </section>
        </div>
      </main>
    </>
  )
}
