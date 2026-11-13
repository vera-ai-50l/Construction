import type { Metadata } from 'next'
import { Nav } from '@/components/ui/Nav'
import { Bezel } from '@/components/ui/Bezel'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Reveal } from '@/components/ui/Reveal'
import { Icon } from '@/components/ui/icons'
import { RecruitBoard } from '@/components/RecruitBoard'

export const metadata: Metadata = { title: 'Recruitment assistant · Vera' }

const BEFORE = [
  ['ClockCounterClockwise', 'A nurse messages about a job at 9 PM and hears back the next afternoon, if at all.'],
  ['Repeat', 'HR asks the same screening questions on the phone, one candidate at a time.'],
  ['Files', 'Certificates are chased one by one over WhatsApp and email.'],
  ['CalendarX', 'Interview times are fixed over several calls.'],
]
const AFTER = [
  ['Lightning', 'Every candidate gets a reply in seconds, at any hour.'],
  ['ListChecks', 'The same screening questions, in the same order, for every applicant.'],
  ['FileArrowUp', 'Document photos are collected in the chat, with reminders for anything missing.'],
  ['CalendarCheck', 'The candidate picks a slot from the hiring team’s free times; HR gets an alert.'],
]

export default function Page() {
  return (
    <>
      <Nav />
      <main className="px-4 pb-24 pt-32 md:px-8 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <Eyebrow>Recruitment assistant</Eyebrow>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] md:text-6xl">
              Every applicant answered in seconds. <span className="serif font-normal text-teal">HR sees only complete applications.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
              The assistant replies to candidates on WhatsApp, asks the screening questions, collects document photos, flags what is missing and books an interview from the hiring team’s free slots. Try it as a candidate.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-12">
            <RecruitBoard />
          </Reveal>

          <section className="mt-28">
            <Reveal>
              <Eyebrow>Before and after</Eyebrow>
              <h2 className="mt-6 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] md:text-5xl">Less chasing, and no good nurse lost to a slow reply.</h2>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {[
                { t: 'Today', rows: BEFORE, dark: false },
                { t: 'With the recruitment assistant', rows: AFTER, dark: true },
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
          </section>

          <section className="mt-24 grid gap-5 md:grid-cols-3">
            {[
              ['HandPalm', 'HR makes every decision', 'The assistant collects and organises. It never rejects or selects a candidate; anything outside a role’s requirements is flagged for HR.'],
              ['IdentificationBadge', 'Registration checked by HR', 'It checks that a registration number looks right. HR verifies it with the nursing council, as today.'],
              ['ListChecks', 'What we need to start', 'The requirements for each role, your screening questions, and the hiring team’s interview availability.'],
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
