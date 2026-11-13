import { Nav } from '@/components/ui/Nav'
import { Bezel } from '@/components/ui/Bezel'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Pill } from '@/components/ui/Pill'
import { Reveal } from '@/components/ui/Reveal'
import { Icon } from '@/components/ui/icons'
import { morningMessage, sampleWeek, summarize, TODAY } from '@/lib/staffing'
import { chunks } from '@/content/policies'

const PILOTS = [
  {
    href: '/staffing',
    tag: 'For the duty manager',
    title: 'Staffing summary',
    line: 'Every morning, one message showing which wards are short-staffed, so gaps are fixed early.',
    problem: 'When someone is absent or a shift is swapped, the news travels by phone and WhatsApp, and the staffing sheet is built by hand. Gaps are often found late.',
    does: 'Reads the roster and attendance, applies your minimum cover for each ward and shift, and sends the duty manager a short summary at a time you choose.',
    prove: 'Two to four weeks on one ward, such as the ICU, checked against what the ward manager builds by hand.',
    icon: 'UsersThree',
    cta: 'Open the staffing summary',
  },
  {
    href: '/ask',
    tag: 'For every staff member',
    title: 'HR assistant',
    line: 'Staff get answers in seconds, and HR stops repeating the same ones.',
    problem: 'HR answers the same questions again and again: leave, shift timings, holidays, pay dates, how to apply for things.',
    does: 'Answers only from the policy documents HR has approved, shows the source for every answer, and passes anything it is not sure about to a named HR person.',
    prove: 'One department to start, counting how many questions are answered without HR, and how quickly.',
    icon: 'ChatsCircle',
    cta: 'Ask the HR assistant',
  },
  {
    href: '/recruitment',
    tag: 'For candidates and HR',
    title: 'Recruitment assistant',
    line: 'Every applicant gets a reply in minutes, and HR sees only complete applications.',
    problem: 'Replies to candidates are slow, the same screening questions are asked on every call, and documents are chased one by one.',
    does: 'Replies on WhatsApp, asks the screening questions, collects document photos, flags what is missing and books an interview. It never rejects or selects anyone.',
    prove: 'Thirty days on one department’s hiring: time to first reply, documents complete without chasing, interviews booked.',
    icon: 'Briefcase',
    cta: 'Apply as a candidate',
  },
  {
    href: '/reports',
    tag: 'For leadership',
    title: 'Weekly report',
    line: 'One short weekly summary, without anyone building it by hand.',
    problem: 'Reports are assembled by hand from several spreadsheets, arrive late, and are out of date by the time they are read.',
    does: 'Pulls staffing gaps, hiring progress and staff questions from the tools in use, and sends the same short report every Monday by email or WhatsApp.',
    prove: 'Replace one manual report and compare the time taken and the accuracy with today’s method.',
    icon: 'ChartBar',
    cta: 'Build the weekly report',
  },
]

const PRINCIPLES = [
  ['Flag', 'Start small', 'One ward or one department, a short pilot with a clear start and end.'],
  ['ChartLineUp', 'Measure on your data', 'We agree what success looks like before we begin and report the real numbers, good or bad.'],
  ['HandPalm', 'People decide', 'The tools collect, check, remind and report. Staff and managers make every decision.'],
  ['ShieldCheck', 'Protect data', 'Only the data needed, limited access, and a written note on storage, access and deletion before any pilot.'],
]

export default function Home() {
  const msg = morningMessage(summarize(sampleWeek(), TODAY, 'Morning'), TODAY, 'Morning').split('\n')
  return (
    <>
      <Nav />
      <main>
        {/* Hero: editorial split */}
        <section className="relative overflow-hidden px-4 pb-20 pt-32 md:px-8 md:pb-28 md:pt-44">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(18,22,22,0.07)_1px,transparent_1.2px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
          <div aria-hidden className="pointer-events-none absolute -right-40 top-10 hidden h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(14,110,106,0.12),transparent)] md:block" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-16 md:grid-cols-[1.05fr_1fr]">
            <div>
              <Reveal>
                <Eyebrow>Working demo · for hospital HR teams</Eyebrow>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="mt-7 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-6xl md:text-[4.6rem]">
                  Less chasing for HR. <span className="serif font-normal text-teal">More time for people.</span>
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
                  Four everyday jobs, working here on sample data: a 7:30 staffing message for the duty manager, an assistant that answers staff questions from approved policy, a recruitment assistant that screens candidates and books interviews, and a weekly report that builds itself.
                </p>
              </Reveal>
              <Reveal delay={240} className="mt-10 flex flex-wrap gap-3">
                <Pill href="#tools">See the four tools</Pill>
                <Pill href="/ask" variant="light">
                  Ask the HR assistant
                </Pill>
              </Reveal>
              <Reveal delay={300}>
                <p className="mt-8 flex max-w-md items-start gap-2 text-xs leading-relaxed text-ink-3">
                  <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
                  Sample data throughout. Staff appear as IDs, candidates and policies are examples, and no hospital system is connected.
                </p>
              </Reveal>
            </div>

            {/* Z-axis cascade of the two products */}
            <Reveal delay={200} className="relative mx-auto w-full max-w-[460px] pb-24">
              <Bezel className="relative z-[1] md:-rotate-[1.5deg]" inner="p-5">
                <div className="flex items-center gap-3 border-b border-ink/[0.06] pb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal text-white">
                    <Icon name="FirstAid" size={16} weight="regular" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-ink">Vera · Staffing</p>
                    <p className="text-[11px] text-ink-3">to Duty Manager · 7:30 AM</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl rounded-tl-md bg-[#e9f6ef] px-4 py-3 text-[12.5px] leading-relaxed text-ink">
                  {msg.slice(0, 5).map((l, i) => (
                    <p key={i} className={i === 0 ? 'font-semibold' : /Below|Needs/.test(l) ? 'text-below' : ''}>
                      {l}
                    </p>
                  ))}
                  <p className="text-ink-3">…</p>
                </div>
              </Bezel>
              <Bezel className="absolute -bottom-2 right-0 z-[2] w-[86%] md:-right-8 md:rotate-[2deg]" inner="p-4">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-[12.5px] text-white">How do I swap a shift with a colleague?</p>
                <div className="mt-2.5 max-w-[92%] rounded-2xl rounded-bl-md bg-ground-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink">
                  Submit the swap on HRMS at least 48 hours before the first shift; both of you and the ward in-charge approve it.
                  <span className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-teal">
                    <Icon name="BookOpenText" size={12} /> Shifts, Attendance and Swaps · Shift swaps
                  </span>
                </div>
              </Bezel>
            </Reveal>
          </div>
        </section>

        {/* The four tools */}
        <section id="tools" className="scroll-mt-24 px-4 py-24 md:px-8 md:py-32">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <Eyebrow>Four tools</Eyebrow>
              <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-6xl">
                Each one works on its own. <span className="serif font-normal text-teal">Start with whichever helps most.</span>
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-5 md:grid-cols-2">
              {PILOTS.map((p, i) => (
                <Reveal key={p.href} delay={i * 100}>
                  <Bezel className="h-full" inner="flex h-full flex-col p-7 md:p-9">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-2 text-teal">
                        <Icon name={p.icon} size={22} />
                      </span>
                      <span className="rounded-full bg-ink/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-2">{p.tag}</span>
                    </div>
                    <h3 className="mt-8 text-3xl font-semibold tracking-[-0.03em]">{p.title}</h3>
                    <p className="mt-2 text-[15px] text-ink-2">{p.line}</p>
                    <dl className="mt-8 space-y-5 border-t border-ink/[0.06] pt-6 text-[14.5px] leading-relaxed">
                      {[
                        ['Today', p.problem],
                        ['What it does', p.does],
                        ['How we would start', p.prove],
                      ].map(([k, v]) => (
                        <div key={k} className="grid gap-1 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
                          <dt className="text-[11px] uppercase tracking-[0.16em] text-ink-3 sm:pt-1">{k}</dt>
                          <dd className="text-ink-2">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-auto pt-9">
                      <Pill href={p.href} variant={i % 2 === 0 ? 'dark' : 'teal'}>
                        {p.cta}
                      </Pill>
                    </div>
                  </Bezel>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="bg-night px-4 py-24 text-white md:px-8 md:py-32">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <Eyebrow dark>How we work with your team</Eyebrow>
              <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-6xl">
                The tools report. <span className="serif font-normal text-[#7fd1c4]">People decide.</span>
              </h2>
            </Reveal>
            <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRINCIPLES.map(([ic, t, d], i) => (
                <Reveal as="li" key={t} delay={i * 80}>
                  <Bezel tone="dark" className="h-full" inner="h-full p-7">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.07] text-[#7fd1c4]">
                      <Icon name={ic} size={20} />
                    </span>
                    <p className="mt-8 text-xl font-medium tracking-tight">{t}</p>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">{d}</p>
                  </Bezel>
                </Reveal>
              ))}
            </ul>
            <p className="mt-16 border-t border-white/10 pt-8 text-xs leading-relaxed text-white/40">
              Prepared by Vera AI, November 2026. Everything on these pages is sample data: {sampleWeek().length.toLocaleString('en-IN')} shift records with staff IDs only, {chunks.length} example HR policy sections and example candidates. Time saved is measured on your own data once we start.
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
