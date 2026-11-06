import type { ReactNode } from 'react'
import { Bezel } from './ui/Bezel'
import { Eyebrow } from './ui/Eyebrow'
import { PillButton } from './ui/PillButton'
import { Reveal } from './ui/Reveal'
import { Icon } from './ui/icons'
import { Flow } from './Flow'
import { BeforeAfter, RunButton, RunProvider, RunReveal, RunZone } from './run/Run'
import { RunChat } from './run/RunChat'
import { Nav } from './Nav'
import { HeroVisual } from './mocks/HeroVisual'
import { BriefPhone, InspectionReport, LeakSummary, PlantBoard, StockSheet, WastageTable } from './mocks/Outputs'
import { desks, type Desk } from '@/content/desks'
import { runs } from '@/content/runs'
import { chats } from '@/content/chats'
import { contact, type Audience } from '@/content/site'

const MOCKS: Record<string, ReactNode> = {
  'leak-check': <LeakSummary />,
  'site-desk': <BriefPhone />,
  'stock-balance': <StockSheet />,
  wastage: <WastageTable />,
  'site-opening': <InspectionReport />,
  'plant-desk': <PlantBoard />,
}

// Each link shows only the desks meant for it, numbered in the order shown.
function desksFor(audience: Audience): Desk[] {
  const who = audience === 'review' ? 'developer' : 'contractor'
  const list = desks.filter((d) => d.audience.includes(who))
  // The developer brief leads with the desk built only for developers.
  if (who === 'developer') list.sort((a, b) => Number(onlyDev(b)) - Number(onlyDev(a)))
  return list.map((d, i) => ({ ...d, num: String(i + 1).padStart(2, '0') }))
}

const onlyDev = (d: Desk) => d.audience.length === 1 && d.audience[0] === 'developer'

function DevChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rust px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-paper">
      <Icon name="Buildings" size={12} /> For developers
    </span>
  )
}

function contactHref() {
  if (contact.whatsapp) return `https://wa.me/${contact.whatsapp}`
  if (contact.email) return `mailto:${contact.email}`
  return '#contact'
}

function Section({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 px-4 py-24 md:px-8 md:py-36 ${className}`}>
      <div className="mx-auto max-w-[1240px]">{children}</div>
    </section>
  )
}

/* ───────────── Hero ───────────── */

function Hero({ firm, audience }: { firm: string; audience: Audience }) {
  const review = audience === 'review'
  return (
    <section id="top" className="relative overflow-hidden px-4 pb-20 pt-32 md:px-8 md:pb-32 md:pt-44">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(23,23,23,0.09)_1px,transparent_1.3px)] [background-size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-10 h-[560px] w-[560px] bg-[radial-gradient(rgba(229,13,37,0.55)_1.6px,transparent_1.9px)] [background-size:22px_22px] [mask-image:radial-gradient(closest-side,black,transparent)] hidden md:block md:-right-10" />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-16 md:grid-cols-[1.15fr_1fr] md:gap-20">
        <div>
          <Reveal>
            <Eyebrow tone={firm || review ? 'rust' : 'light'}>
              {review ? 'Vera · for developers' : firm ? `Prepared for ${firm}` : 'Vera · AI back office for construction'}
            </Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="display mt-7 text-[2.75rem] leading-[1.02] text-ink sm:text-6xl md:text-[5.25rem]">
              {review ? (
                <>
                  Hours back for your site teams. <em className="text-rust">Rupees you can see.</em>
                </>
              ) : (
                <>
                  Your sites already send the data. <em className="text-rust">We turn it into money</em> you can recover.
                </>
              )}
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
              {review
                ? 'Vera works like a back-office team for your projects. It reads what your sites already send, does the checking your engineers now do by hand, and shows the time and money it saves on every site.'
                : 'Vera is a back office that reads your registers, challans and WhatsApp site groups, reconciles them in code, and hands you the rupees: what to claim from suppliers, what to stop on site, and what is idle.'}
            </p>
          </Reveal>
          <Reveal delay={240} className="mt-10 flex flex-wrap items-center gap-3">
            <PillButton href={review ? '#five' : '#desks'}>{review ? 'See the five fixes' : 'See what Vera does'}</PillButton>
            {review ? (
              <PillButton href="#ai" variant="light">
                How the AI is used
              </PillButton>
            ) : (
              <PillButton href={contactHref()} variant="light" external={contactHref().startsWith('http')}>
                Book a Leak Check
              </PillButton>
            )}
          </Reveal>
          <Reveal delay={320}>
            <p className="mt-8 flex max-w-md items-start gap-2 text-xs leading-relaxed text-ink-3">
              <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
              Sample data. Every site, contractor and supplier on this page is fictional, and figures are illustrative of a ₹100–300 Cr contractor.
            </p>
          </Reveal>
        </div>
        <Reveal delay={200} className={review ? 'hidden md:block' : ''}>
          <HeroVisual />
        </Reveal>
      </div>

      <Reveal delay={120} className="relative mx-auto mt-24 max-w-[1240px]">
        <dl className="grid grid-cols-2 gap-y-10 border-t border-ink/[0.08] pt-10 md:grid-cols-4">
          {(review
            ? [
                ['3 → 1 day', 'first inspection of a new site'],
                ['~8 h', 'a week saved per site on progress reports'],
                ['₹16.1 L', 'leakage found on one sample site in 3 months'],
                ['0', 'new apps for site teams'],
              ]
            : [
                ['6.3%', 'of material spend leaking on an illustrative site'],
                ['8 AM', 'WhatsApp brief, every morning'],
                ['0', 'new apps for your site team'],
                ['100%', 'of rupee maths done in code, not AI'],
              ]
          ).map(([a, b]) => (
            <div key={b} className="pr-6">
              <dt className="display text-4xl text-ink md:text-5xl">{a}</dt>
              <dd className="mt-2 max-w-[14rem] text-sm text-ink-3">{b}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  )
}

/* ───────────── Where money goes ───────────── */

const LEAKS: { icon: string; title: string; text: string; size: string; tone?: 'dark' | 'tint' }[] = [
  { icon: 'Copy', title: 'The same challan, billed twice', text: 'Two copies of one delivery reach accounts a week apart. Nobody holds the gate book next to the bill.', size: 'md:col-span-7 md:row-span-2', tone: 'dark' },
  { icon: 'Scales', title: 'Short at the weighbridge', text: 'The truck weighs 1.2 MT light. The bill is for the full load.', size: 'md:col-span-5' },
  { icon: 'TrendUp', title: 'Rate above the PO', text: '₹16 a bag more, quietly, on every challan for a quarter.', size: 'md:col-span-5' },
  { icon: 'Users', title: 'Labour idle on a breakdown', text: '16 people sit for four hours. It is never claimed as a hindrance.', size: 'md:col-span-4' },
  { icon: 'Warning', title: 'A pour stopped for 60 bags', text: 'Cement runs out the evening before a slab. Labour and the pump wait half a day.', size: 'md:col-span-4', tone: 'tint' },
  { icon: 'Hourglass', title: 'Hired plant on rent, idle', text: 'A backhoe idles nine days at ₹2,800 a day.', size: 'md:col-span-4' },
  { icon: 'Stack', title: 'Formwork that never comes back', text: 'Every project ends 5–10% short on plates and props.', size: 'md:col-span-6' },
  { icon: 'Warehouse', title: 'Stock bought twice', text: 'One site holds 340 bags while another, 12 km away, raises a PO.', size: 'md:col-span-6' },
]

function Leaks() {
  return (
    <Section id="problem">
      <div className="grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-end">
        <Reveal>
          <Eyebrow>The problem</Eyebrow>
          <h2 className="display mt-6 text-4xl leading-[1.05] text-ink md:text-6xl">Money leaves a site quietly, in eight ordinary ways.</h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="max-w-xl text-lg leading-relaxed text-ink-2">
            Nobody is hiding it. The purchase register, the gate book, the stores slips and the WhatsApp groups simply never meet. Vera puts them on the same page every day, so each rupee has a source document behind it.
          </p>
        </Reveal>
      </div>
      <div className="mt-16 grid grid-cols-1 gap-4 md:auto-rows-[minmax(190px,auto)] md:grid-cols-12 md:gap-5">
        {LEAKS.map((l, i) => (
          <Reveal key={l.title} delay={(i % 4) * 70} className={l.size}>
            <Bezel className="h-full" tone={l.tone === 'dark' ? 'dark' : l.tone === 'tint' ? 'tint' : 'light'} inner="flex flex-col justify-between gap-8 p-7 md:p-8">
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${l.tone === 'dark' ? 'bg-white/[0.07] text-rust-2' : 'bg-ink/[0.04] text-rust'}`}>
                <Icon name={l.icon} size={20} />
              </span>
              <div>
                <h3 className={`display ${i === 0 ? 'text-3xl md:text-5xl' : 'text-2xl'} leading-tight ${l.tone === 'dark' ? 'text-paper' : 'text-ink'}`}>{l.title}</h3>
                <p className={`mt-3 max-w-md text-[15px] leading-relaxed ${l.tone === 'dark' ? 'text-paper/65' : 'text-ink-2'}`}>{l.text}</p>
              </div>
            </Bezel>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ───────────── How it works ───────────── */

function How() {
  const stages = [
    { icon: 'WhatsappLogo', k: 'Capture', t: 'Nothing new to learn', d: 'Supervisors keep sending voice notes, photos and texts to the site group. Stores keep their registers. You share exports from Tally or Excel.' },
    { icon: 'Calculator', k: 'Reconcile', t: 'Maths in code, not in AI', d: 'AI only reads messages and documents. Every rupee is computed by fixed rules you can check: PO against challan against gate, issue against BOQ norm.' },
    { icon: 'PaperPlaneTilt', k: 'Act', t: 'A list you can use today', d: 'Claims for suppliers, hindrances you can claim, an 8 AM brief, a Tally import. Each line carries its challan, slip or bill reference.' },
  ]
  const trust = [
    ['ShieldCheck', 'Your data under NDA, deleted on request'],
    ['MagnifyingGlass', 'Unclear entries are flagged, never guessed'],
    ['Link', 'Every finding traces to a document number'],
    ['Translate', 'Hindi, Marathi and Hinglish voice notes'],
    ['FileXls', 'Works with your Tally and Excel'],
    ['Phone', 'Your team needs nothing but WhatsApp'],
  ]
  return (
    <section id="how" className="scroll-mt-24 bg-espresso px-4 py-24 text-paper md:px-8 md:py-36">
      <div className="mx-auto max-w-[1240px]">
        <Reveal>
          <Eyebrow tone="dark">How it works</Eyebrow>
          <h2 className="display mt-6 max-w-3xl text-4xl leading-[1.05] md:text-6xl">Three steps, the same for every desk.</h2>
        </Reveal>
        <ol className="mt-16 grid gap-5 md:grid-cols-3">
          {stages.map((s, i) => (
            <Reveal as="li" key={s.k} delay={i * 110}>
              <Bezel tone="dark" inner="p-8 md:p-9">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-rust-2">
                    <Icon name={s.icon} size={22} />
                  </span>
                  <span className="num text-xs text-paper/40">0{i + 1}</span>
                </div>
                <p className="mt-10 text-[11px] uppercase tracking-[0.2em] text-paper/45">{s.k}</p>
                <h3 className="display mt-2 text-3xl">{s.t}</h3>
                <p className="mt-4 text-[15px] leading-relaxed text-paper/65">{s.d}</p>
              </Bezel>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={120}>
          <ul className="mt-14 grid gap-x-10 gap-y-5 border-t border-white/10 pt-10 sm:grid-cols-2 md:grid-cols-3">
            {trust.map(([ic, t]) => (
              <li key={t} className="flex items-center gap-3 text-[15px] text-paper/75">
                <Icon name={ic} size={18} className="shrink-0 text-rust-2" /> {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

/* ───────────── Review: five problems, five fixes ───────────── */

const FIVE: { id: string; problem: string; fix: string; big: string; effect: string }[] = [
  { id: 'site-opening', problem: 'The first inspection of a new site takes 2–3 days.', fix: 'Papers checked 3 days before. Checklist, photos and remarks on a phone. Report drafted the same evening.', big: '3 → 1 day', effect: 'per new site. About 16 engineer hours saved; the contractor starts two days sooner.' },
  { id: 'leak-check', problem: 'Material paid for but not received, billed twice, or above the PO rate.', fix: 'Matches every PO, challan, gate entry and issue slip against the BOQ work done.', big: '₹16.1 L', effect: 'found on one sample site in 3 months. About 60 hours of register matching saved.' },
  { id: 'site-desk', problem: 'Daily and weekly progress reports typed by hand, and late.', fix: 'Reads the WhatsApp voice notes and photos supervisors already send.', big: '~8 h', effect: 'a week saved per site. Reports on time, in one format.' },
  { id: 'stock-balance', problem: 'One site holds excess steel while another buys it fresh.', fix: 'One weekly sheet across sites: excess, shortage, and who sends what to whom.', big: '₹14.9 L', effect: 'of steel not bought in one sample week. Less cash stuck in idle stock.' },
  { id: 'wastage', problem: 'Nobody sees which supervisor wasted above the allowed limit.', fix: 'Ties every issue slip to a supervisor and floor, and checks it against the work done.', big: '₹65,670', effect: 'over the limit in one tower in a month, with a name on every line.' },
]

function FiveFixes({ list }: { list: Desk[] }) {
  const name = (id: string) => list.find((d) => d.id === id)
  return (
    <Section id="five">
      <Reveal>
        <Eyebrow>Five problems, five fixes</Eyebrow>
        <h2 className="display mt-6 max-w-4xl text-4xl leading-[1.05] text-ink md:text-6xl">Where your teams lose hours today, and what Vera gives back.</h2>
      </Reveal>
      <div className="mt-14 hidden grid-cols-[3rem_1.1fr_1.1fr_1fr_2.5rem] gap-6 px-7 text-[11px] uppercase tracking-[0.18em] text-ink-3 md:grid">
        <span />
        <span>The problem today</span>
        <span>What Vera does</span>
        <span>The effect</span>
        <span />
      </div>
      <ol className="mt-4 space-y-3">
        {FIVE.map((f, i) => {
          const d = name(f.id)
          if (!d) return null
          return (
            <Reveal as="li" key={f.id} delay={(i % 3) * 70}>
              <a href={`#${f.id}`} className="group block">
                <Bezel inner="grid gap-4 p-6 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5 md:grid-cols-[3rem_1.1fr_1.1fr_1fr_2.5rem] md:items-start md:gap-6 md:p-7">
                  <span className="num text-sm text-rust md:pt-1">{d.num}</span>
                  <span>
                    {onlyDev(d) && (
                      <span className="mb-3 block">
                        <DevChip />
                      </span>
                    )}
                    <span className="display block text-2xl leading-tight text-ink">{d.name}</span>
                    <span className="mt-2 block text-[15px] leading-relaxed text-ink-2">{f.problem}</span>
                  </span>
                  <span className="text-[15px] leading-relaxed text-ink-2">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-3 md:hidden">What Vera does</span>
                    {f.fix}
                  </span>
                  <span className="rounded-2xl bg-sage-2/60 px-4 py-3 md:bg-transparent md:p-0">
                    <span className="display block text-3xl leading-none text-ink">{f.big}</span>
                    <span className="mt-2 block text-sm leading-relaxed text-ink-2">{f.effect}</span>
                  </span>
                  <span className="hidden h-10 w-10 items-center justify-center rounded-full bg-ink/[0.05] text-ink transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:scale-105 md:flex">
                    <Icon name="ArrowDownRight" size={16} />
                  </span>
                </Bezel>
              </a>
            </Reveal>
          )
        })}
      </ol>
      <Reveal delay={100}>
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-3">
          Sample data; hours are estimates. Each desk below has a Run the flow button: press it to watch Vera fix sample records step by step.
        </p>
      </Reveal>
    </Section>
  )
}

function AiUse() {
  const helps = [
    ['Microphone', 'Voice notes', 'Supervisors speak in Hindi, Marathi or Hinglish. AI turns them into written records.'],
    ['Receipt', 'Handwriting and photos', 'Challans, slips and certificates photographed on site are read into rows.'],
    ['Link', 'Names that do not match', '“Shree Balaji Steels” and “SBS Pune” are matched as the same supplier.'],
    ['Camera', 'Photos to checklist', 'A photo from the site walk is placed against the right checklist line.'],
  ]
  const not = [
    ['Calculator', 'Money', 'Every rupee figure, quantity and limit comes from fixed rules in code. You can check each line against the document it cites.'],
    ['WarningCircle', 'Guessing', 'When AI is not sure what a note or a photo says, it is flagged for a person, with the original attached.'],
  ]
  return (
    <section id="ai" className="scroll-mt-24 bg-rust px-4 py-24 text-white md:px-8 md:py-36">
      <div className="mx-auto max-w-[1240px]">
        <Reveal>
          <Eyebrow tone="onred">How the AI is used</Eyebrow>
          <h2 className="display mt-6 max-w-3xl text-4xl leading-[1.05] md:text-6xl">AI reads. Code counts. People decide.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
            Your teams do not have to learn AI. They keep using WhatsApp and their registers. AI only reads; it never decides a rupee figure.
          </p>
        </Reveal>
        <div className="mt-16 grid gap-5 md:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <Bezel tone="onred" className="h-full" inner="h-full p-8 md:p-10">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white">Where AI helps</p>
              <ul className="mt-8 grid gap-8 sm:grid-cols-2">
                {helps.map(([ic, t, d]) => (
                  <li key={t}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
                      <Icon name={ic} size={20} />
                    </span>
                    <p className="mt-5 text-lg text-paper">{t}</p>
                    <p className="mt-2 text-[15px] leading-relaxed text-white/75">{d}</p>
                  </li>
                ))}
              </ul>
            </Bezel>
          </Reveal>
          <Reveal delay={110}>
            <Bezel tone="onred" className="h-full" inner="h-full p-8 md:p-10">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Where AI is not used</p>
              <ul className="mt-8 space-y-8">
                {not.map(([ic, t, d]) => (
                  <li key={t} className="flex gap-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/85">
                      <Icon name={ic} size={20} />
                    </span>
                    <span>
                      <span className="block text-lg text-paper">{t}</span>
                      <span className="mt-2 block text-[15px] leading-relaxed text-white/75">{d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Bezel>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ───────────── Desk index ───────────── */

function StatusChip({ status }: { status: Desk['status'] }) {
  const t = status === 'Working demo' ? 'bg-sage-2 text-sage' : status === 'Pilot-ready' ? 'bg-ochre-2 text-ochre' : 'bg-ink/[0.05] text-ink-2'
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${t}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" /> {status}
  </span>
}

function DeskIndex({ list, review = false }: { list: Desk[]; review?: boolean }) {
  const spans = list.length === 5 ? ['md:col-span-7', 'md:col-span-5', 'md:col-span-4', 'md:col-span-4', 'md:col-span-4'] : ['md:col-span-6', 'md:col-span-6', 'md:col-span-12']
  return (
    <Section id="desks">
      <Reveal>
        <Eyebrow>{review ? 'What Vera does' : 'What we sell'}</Eyebrow>
        <h2 className="display mt-6 max-w-4xl text-4xl leading-[1.05] text-ink md:text-6xl">
          {review ? `${list.length} desks we are building.` : `${list.length} desks. Start with one, add the rest when it proves itself.`}
        </h2>
      </Reveal>
      <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
        {list.map((d, i) => (
          <Reveal key={d.id} delay={i * 70} className={spans[i] || 'md:col-span-4'}>
            <a href={`#${d.id}`} className="group block h-full">
              <Bezel className="h-full" inner="flex h-full flex-col gap-10 p-7 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-1 md:p-8">
                <div className="flex items-center justify-between gap-3">
                  <span className="num text-sm text-ink-3">{d.num}</span>
                  <StatusChip status={d.status} />
                </div>
                <div className="mt-auto">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">{d.kind}</p>
                  <h3 className="display mt-2 text-3xl text-ink md:text-[2.1rem]">{d.name}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{d.headline}</p>
                  <div className="mt-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="display text-3xl text-rust">{d.helps[0].figure}</p>
                      <p className="mt-1 max-w-xs text-xs text-ink-3">{d.helps[0].text}</p>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.05] text-ink transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-[1px] group-hover:scale-105">
                      <Icon name="ArrowDownRight" size={16} />
                    </span>
                  </div>
                </div>
              </Bezel>
            </a>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ───────────── One desk ───────────── */

function DeskSection({ d, index, compact = false }: { d: Desk; index: number; compact?: boolean }) {
  const flip = index % 2 === 1
  return (
    <Section id={d.id} className={index % 2 === 1 ? 'bg-paper-2/60' : ''}>
      <RunProvider n={d.steps.length}>
        {/* Header */}
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-end md:gap-10">
          <Reveal>
            <div className="flex flex-wrap items-center gap-2.5">
              <Eyebrow>Desk {d.num}</Eyebrow>
              {onlyDev(d) && <DevChip />}
              <StatusChip status={d.status} />
            </div>
            <h2 className="display mt-6 text-[2.6rem] leading-[1] text-ink sm:text-5xl md:text-7xl">{d.name}</h2>
            <p className="mt-5 max-w-2xl text-lg leading-snug text-ink-2 md:text-2xl">{compact ? d.headline.replace(/^For developers\. /, '') : d.headline}</p>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">The problem</p>
            <p className="mt-3 text-base leading-relaxed text-ink-2">{d.problem}</p>
          </Reveal>
        </div>

        {/* Effect */}
        {compact && (
          <Reveal delay={60} className="mt-10 md:mt-14">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">The effect · sample site, illustrative</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              {d.helps.map((h) => (
                <div key={h.text} className="rounded-2xl bg-card px-5 py-4 ring-1 ring-ink/[0.06]">
                  <dt className="display text-3xl leading-none text-rust">{h.figure}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink-2">{h.text}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        )}

        <RunZone label={`${d.name} · sample data`}>
          {/* Flow */}
          <Reveal delay={60} className={compact ? 'mt-10 md:mt-14' : 'mt-16 md:mt-20'}>
            <Bezel inner="px-5 py-8 md:px-10 md:py-12">
              <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">The flow · {d.steps.length} steps</p>
                  <p className="mt-2 text-sm text-ink-2">Press the button and watch each step fix what it catches.</p>
                </div>
                <RunButton big className="w-full md:w-auto" />
              </div>
              <Flow steps={d.steps} />
              {runs[d.id] && <BeforeAfter rows={runs[d.id]} steps={d.steps} />}
            </Bezel>
          </Reveal>

          {compact ? (
            <div className="mt-12 grid gap-12 md:mt-16 md:grid-cols-[1.15fr_1fr] md:gap-16">
              <Reveal className="md:sticky md:top-28 md:self-start">
                <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-ink-3">What comes out</p>
                <RunReveal>{MOCKS[d.id]}</RunReveal>
              </Reveal>
              {chats[d.id] && (
                <Reveal delay={100}>
                  <RunChat chat={chats[d.id]} compact />
                </Reveal>
              )}
            </div>
          ) : (
            <div className={`mt-16 grid gap-12 md:mt-20 md:grid-cols-[1fr_1.15fr] md:gap-16 ${flip ? 'md:[&>*:first-child]:order-2' : ''}`}>
              <div className="space-y-12">
                <Reveal>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">What you already have</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {d.inputs.map((x) => (
                      <li key={x.label} className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-ink ring-1 ring-ink/[0.07]">
                        <Icon name={x.icon} size={16} className="text-rust" /> {x.label}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal delay={80}>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">What you get</p>
                  <ul className="mt-5 divide-y divide-ink/[0.07] border-y border-ink/[0.07]">
                    {d.outputs.map((x) => (
                      <li key={x} className="flex items-center gap-3 py-3.5 text-[15px] text-ink">
                        <Icon name="CheckCircle" size={18} className="shrink-0 text-sage" /> {x}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal delay={140}>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">How it helps</p>
                  <dl className="mt-5 space-y-6">
                    {d.helps.map((h) => (
                      <div key={h.text} className="grid grid-cols-[7.5rem_1fr] items-baseline gap-4">
                        <dt className="display text-3xl text-ink">{h.figure}</dt>
                        <dd className="text-sm leading-relaxed text-ink-2">{h.text}</dd>
                      </div>
                    ))}
                  </dl>
                </Reveal>
              </div>
              <Reveal delay={120} className="md:sticky md:top-28 md:self-start">
                <RunReveal>{MOCKS[d.id]}</RunReveal>
              </Reveal>
            </div>
          )}
        </RunZone>
        {!compact && chats[d.id] && (
          <Reveal className="mt-20 border-t border-ink/[0.07] pt-16 md:mt-28 md:pt-24">
            <RunChat chat={chats[d.id]} />
          </Reveal>
        )}
      </RunProvider>
    </Section>
  )
}

/* ───────────── Engagement ───────────── */

function Engagement() {
  const steps = [
        ['Day 0', 'Sign the NDA. Pick one site and three months.'],
        ['Day 1–3', 'Share POs, challans, gate book, issue slips and BOQ progress. Excel, Tally exports or photos.'],
        ['Day 7', 'One-page ₹ summary for the MD, supplier claim list and overuse by wing.'],
        ['Then', 'You check every line against its challan or slip before anything goes to a supplier.'],
  ]
  return (
    <Section id="engage">
      <div className="grid gap-16 md:grid-cols-[1fr_1.1fr] md:gap-20">
        <Reveal>
          <Eyebrow>How we start</Eyebrow>
          <h2 className="display mt-6 text-4xl leading-[1.05] text-ink md:text-6xl">Start with one site and one week.</h2>
          <ol className="mt-12 space-y-0">
            {steps.map(([k, t], i) => (
              <li key={k} className="grid grid-cols-[6rem_1fr] gap-4 border-t border-ink/[0.08] py-5">
                <span className="num text-sm text-rust">{k}</span>
                <span className="text-[15px] leading-relaxed text-ink-2">{t}</span>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delay={120}>
          <Bezel tone="dark" inner="p-8 md:p-12">
            <p className="text-[11px] uppercase tracking-[0.2em] text-paper/50">Material Leak Check · one site</p>
            <p className="display mt-4 text-5xl leading-tight md:text-6xl">One site. One week.</p>
            <p className="mt-10 text-[11px] uppercase tracking-[0.2em] text-paper/45">What you get</p>
            <ul className="mt-5 space-y-4 text-[15px] text-paper/75">
              {['1-page ₹ summary for the MD', 'Supplier claim list with challan numbers', 'Overuse by wing and supervisor', 'Extra and short stock, valued'].map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <Icon name="Check" size={16} className="text-rust-2" /> {x}
                </li>
              ))}
            </ul>
            <p className="mt-10 text-sm leading-relaxed text-paper/60">Registers are shared under NDA, used only for your report, and deleted on request.</p>
            <div className="mt-10">
              <PillButton href={contactHref()} variant="light" external={contactHref().startsWith('http')}>
                Book a Leak Check
              </PillButton>
            </div>
          </Bezel>
        </Reveal>
      </div>
    </Section>
  )
}

/* ───────────── FAQ ───────────── */

function Faq({ audience }: { audience: Audience }) {
  const qs: [string, string][] = [
    ['Does my site team have to install anything?', 'No. Supervisors keep using the WhatsApp groups they use today. Vera reads the group; the team does not change how it works.'],
    ['Is the AI deciding the rupee figures?', 'No. AI reads voice notes, photos and scanned documents. Every rupee figure comes from fixed rules in code: quantities, rates, norms and allowances. You can check each line against the document it cites.'],
    ['What if a message or a register entry is unclear?', 'It is listed as unclear, with the original attached, for a person to confirm. Vera does not fill gaps with guesses.'],
    ['What data do you need, and who sees it?', 'Exports or photos of the registers you already keep. Everything is covered by an NDA, used only for your reports, and deleted on request.'],
    ['Does it work with Tally?', 'Yes. Receipts and stock journals come out as Tally import files, so your accountant does not re-enter anything.'],
    ['What are Cross-Site Stock Balance and Plant & Formwork?', 'Two add-ons we are building with our first customers. They use the same WhatsApp and register data to catch stock that one site holds while another buys it again, overdue services, hired machines idling on rent, and missing formwork.'],
  ]
  return (
    <Section id="faq" className="bg-paper-2/60">
      <div className="grid gap-12 md:grid-cols-[1fr_1.6fr] md:gap-20">
        <Reveal>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="display mt-6 text-4xl leading-[1.05] text-ink md:text-6xl">{audience === 'review' ? 'What contractors ask first.' : 'What owners ask first.'}</h2>
        </Reveal>
        <Reveal delay={100}>
          <div className="divide-y divide-ink/[0.08] border-y border-ink/[0.08]">
            {qs.map(([q, a]) => (
              <details key={q} className="group py-2 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-lg text-ink">
                  {q}
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.05]">
                    <span className="absolute h-px w-3.5 bg-ink" />
                    <span className="absolute h-px w-3.5 rotate-90 bg-ink transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-open:rotate-0" />
                  </span>
                </summary>
                <p className="max-w-2xl pb-5 pr-12 text-[15px] leading-relaxed text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

/* ───────────── Contact + footer ───────────── */

function Contact({ firm, audience }: { firm: string; audience: Audience }) {
  const has = contact.whatsapp || contact.email
  return (
    <Section id="contact">
      <Reveal>
        <Bezel tone="tint" inner="relative overflow-hidden px-7 py-16 text-center md:px-16 md:py-24">
          <Eyebrow>{audience === 'review' ? 'Thank you' : firm ? `Next step for ${firm}` : 'Next step'}</Eyebrow>
          <h2 className="display mx-auto mt-6 max-w-3xl text-4xl leading-[1.05] text-ink md:text-6xl">
            {audience === 'review' ? 'Pick one site and one problem. We will show you the hours and rupees.' : 'Pick one site. We will show you the leak in a week.'}
          </h2>
          {has ? (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {contact.whatsapp && (
                <PillButton href={`https://wa.me/${contact.whatsapp}`} external>
                  WhatsApp {contact.name || 'us'}
                  {contact.whatsappLabel ? ` · ${contact.whatsappLabel}` : ''}
                </PillButton>
              )}
              {contact.email && (
                <PillButton href={`mailto:${contact.email}`} variant="light">
                  {contact.email}
                </PillButton>
              )}
            </div>
          ) : (
            <p className="mx-auto mt-8 max-w-lg text-ink-2">
              {audience === 'review'
                ? 'Reply on the thread this link came in. You are welcome to forward it to colleagues who work with contractors.'
                : 'Reply on the thread this link came in, and we will set up a 20-minute walkthrough on your own numbers.'}
            </p>
          )}
          <p className="mx-auto mt-8 max-w-md text-xs text-ink-3">{audience === 'review' ? 'This page uses fictional sample data only. We will not ask for real project data until an NDA is signed.' : 'We will not ask for real project data until an NDA is signed.'}</p>
        </Bezel>
      </Reveal>
    </Section>
  )
}

function Footer({ list }: { list: Desk[] }) {
  const later = list.filter((d) => d.status !== 'Working demo').map((d) => d.num)
  const note = later.length ? ` Desk${later.length > 1 ? 's' : ''} ${later.join(', ').replace(/, (?=[^,]*$)/, ' and ')} ${later.length > 1 ? 'are' : 'is'} still being built or designed.` : ''
  return (
    <footer className="px-4 pb-14 md:px-8">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-4 border-t border-ink/[0.08] pt-8 text-xs leading-relaxed text-ink-3 md:flex-row md:items-start md:justify-between">
        <p className="display text-lg text-ink">Vera</p>
        <p className="max-w-2xl">
          Sample data: every site, contractor, supplier and person named on this page is fictional. Figures are illustrative of a ₹100–300 Cr contractor and are not results from any client.{note}
        </p>
      </div>
    </footer>
  )
}

/* ───────────── Page ───────────── */

export function DemoPage({ firm, audience }: { firm: string; audience: Audience }) {
  const review = audience === 'review'
  const list = desksFor(audience)
  const links = review
    ? [
        { href: '#five', label: 'Five fixes' },
        { href: '#ai', label: 'How AI is used' },
        { href: `#${list[0].id}`, label: 'The desks' },
      ]
    : [
        { href: '#problem', label: 'Problem' },
        { href: '#how', label: 'How it works' },
        { href: '#desks', label: 'Desks' },
        { href: '#engage', label: 'How we start' },
        { href: '#faq', label: 'FAQ' },
      ]
  return (
    <>
      <Nav links={links} cta={{ href: '#contact', label: 'Talk to us' }} />
      <main>
        <Hero firm={firm} audience={audience} />
        {review ? (
          <>
            <FiveFixes list={list} />
            <AiUse />
          </>
        ) : (
          <>
            <Leaks />
            <How />
            <DeskIndex list={list} />
          </>
        )}
        {list.map((d, i) => (
          <DeskSection key={d.id} d={d} index={i} compact={review} />
        ))}
        {!review && <Engagement />}
        {!review && <Faq audience={audience} />}
        <Contact firm={firm} audience={audience} />
      </main>
      <Footer list={list} />
    </>
  )
}
