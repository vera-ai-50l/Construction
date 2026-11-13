import type { Metadata } from 'next'
import { Nav } from '@/components/ui/Nav'
import { Bezel } from '@/components/ui/Bezel'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Reveal } from '@/components/ui/Reveal'
import { Icon } from '@/components/ui/icons'
import { AskBoard } from '@/components/AskBoard'

export const metadata: Metadata = { title: 'HR assistant · White Lotus' }

const BEFORE = [
  ['PhoneCall', 'A nurse calls or messages HR: “How many PL can I carry forward?”'],
  ['Repeat', 'HR answers the same question for the tenth time this week.'],
  ['Moon', 'Night-shift staff wait until the morning for a reply.'],
  ['EyeSlash', 'Nobody sees which questions keep coming back.'],
]
const AFTER = [
  ['Lightning', 'The answer arrives in seconds, at any hour, in the staff member’s language.'],
  ['BookOpenText', 'Every answer shows the policy section it came from.'],
  ['UserSwitch', 'Anything not in an approved document goes to a named HR person.'],
  ['ChartBar', 'HR sees what staff ask and where the FAQ needs work.'],
]

export default function Page() {
  return (
    <>
      <Nav />
      <main className="px-4 pb-24 pt-32 md:px-8 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <Eyebrow>HR assistant</Eyebrow>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] md:text-6xl">
              Staff ask. It answers from approved policy, <span className="serif font-normal text-teal">or hands to HR.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
              It searches the approved HR documents, writes a short answer only from what it finds, and shows where each line came from. In use, staff ask on WhatsApp; here it runs in the browser.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-12">
            <AskBoard />
          </Reveal>

          <section className="mt-28">
            <Reveal>
              <Eyebrow>Before and after</Eyebrow>
              <h2 className="mt-6 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] md:text-5xl">HR stops repeating answers, and starts seeing the questions.</h2>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {[
                { t: 'Today', rows: BEFORE, dark: false },
                { t: 'With the assistant', rows: AFTER, dark: true },
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
              ['ShieldCheck', 'General policy first', 'No payslips, balances or personal records in the first phase. Questions that need them go to HR, or point to where staff can see their own record.'],
              ['Stethoscope', 'No medical advice', 'It repeats what an approved document says, for example the needle-stick steps, and nothing beyond it.'],
              ['ListChecks', 'What we need from you', 'Your policy documents and FAQ, HR’s review of every answer, and the name of the person who receives hand-overs.'],
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
