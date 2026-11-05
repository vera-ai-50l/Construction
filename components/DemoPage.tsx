import type { ReactNode } from 'react'
import { Bezel } from './ui/Bezel'
import { Eyebrow } from './ui/Eyebrow'
import { PillButton } from './ui/PillButton'
import { Reveal } from './ui/Reveal'
import { Icon } from './ui/icons'
import { Flow } from './Flow'
import { BeforeAfter, RunButton, RunProvider, RunReveal } from './run/Run'
import { RunChat } from './run/RunChat'
import { Nav } from './Nav'
import { HeroVisual } from './mocks/HeroVisual'
import { BriefPhone, Comparison, DebitNote, LeakSummary, PlantBoard, SurplusMatch } from './mocks/Outputs'
import { desks, type Desk } from '@/content/desks'
import { runs } from '@/content/runs'
import { chats } from '@/content/chats'
import { contact, type Audience } from '@/content/site'

const MOCKS: Record<string, ReactNode> = {
  'leak-check': <LeakSummary />,
  'site-desk': <BriefPhone />,
  'free-issue': (
    <div className="space-y-6">
      <DebitNote />
      <Comparison />
    </div>
  ),
  'plant-desk': <PlantBoard />,
  surplus: <SurplusMatch />,
}

const DEV_ORDER = ['free-issue', 'site-desk', 'surplus']

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
  const dev = audience === 'developer'
  const review = audience === 'review'
  return (
    <section id="top" className="relative overflow-hidden px-4 pb-20 pt-32 md:px-8 md:pb-32 md:pt-44">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(192,138,43,0.16),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -left-60 top-80 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(111,127,98,0.14),transparent)]" />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-16 md:grid-cols-[1.15fr_1fr] md:gap-20">
        <div>
          <Reveal>
            <Eyebrow tone={firm || review ? 'rust' : 'light'}>
              {review ? 'Built for contractors · shared for your feedback' : firm ? `Prepared for ${firm}` : 'Vera · AI back office for construction'}
            </Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="display mt-7 text-[2.75rem] leading-[1.02] text-ink sm:text-6xl md:text-[5.25rem]">
              {review ? (
                <>
                  A back office for the contractors <em className="text-rust">who build your projects</em>.
                </>
              ) : dev ? (
                <>
                  Recover every bag <em className="text-rust">you issued free</em>, with the evidence.
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
                ? 'Vera reads a contractor’s registers, challans and WhatsApp site groups, reconciles them in code, and gives them daily records, material reconciliations and the money they are losing. Contractors with clean records bill correctly, report on time and waste less, which shows up on your projects.'
                : dev
                ? 'Vera reconciles the cement and steel you supply to each contractor against certified work, contract wastage and earlier deductions, and drafts the debit note for the next RA bill.'
                : 'Vera is a back office that reads your registers, challans and WhatsApp site groups, reconciles them in code, and hands you the rupees: what to claim from suppliers, what to stop on site, and what is idle.'}
            </p>
          </Reveal>
          <Reveal delay={240} className="mt-10 flex flex-wrap items-center gap-3">
            <PillButton href="#desks">See what Vera does</PillButton>
            {review ? (
              <PillButton href="#feedback" variant="light">
                Where we need your view
              </PillButton>
            ) : (
              <PillButton href={contactHref()} variant="light" external={contactHref().startsWith('http')}>
                {dev ? 'Talk to us about a pilot' : 'Book a Leak Check'}
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
        <Reveal delay={200}>
          <HeroVisual />
        </Reveal>
      </div>

      <Reveal delay={120} className="relative mx-auto mt-24 max-w-[1240px]">
        <dl className="grid grid-cols-2 gap-y-10 border-t border-ink/[0.08] pt-10 md:grid-cols-4">
          {(dev
            ? [
                ['2–3%', 'wastage your contracts allow'],
                ['1.25×', 'typical recovery rate on the excess'],
                ['3', 'confidence labels on every line'],
                ['1 week', 'from registers to debit note'],
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
  { icon: 'Package', title: 'Free-issue wastage', text: 'Steel beyond the 3% allowance, never recovered in the RA bill.', size: 'md:col-span-4', tone: 'tint' },
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
    { icon: 'PaperPlaneTilt', k: 'Act', t: 'A list you can use today', d: 'Claims for suppliers, deductions for contractors, an 8 AM brief, a Tally import. Each line carries its challan, slip or MB reference.' },
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
          {review ? 'Five desks we are building for contractors.' : list.length === 5 ? 'Five desks. Start with one, add the rest when it proves itself.' : 'Three desks for the developer’s side of the table.'}
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

function DeskSection({ d, index }: { d: Desk; index: number }) {
  const flip = index % 2 === 1
  return (
    <Section id={d.id} className={index % 2 === 1 ? 'bg-paper-2/60' : ''}>
      <RunProvider n={d.steps.length}>
      {/* Header */}
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-end">
        <Reveal>
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>Desk {d.num}</Eyebrow>
            <StatusChip status={d.status} />
          </div>
          <h2 className="display mt-6 text-5xl leading-[1] text-ink md:text-7xl">{d.name}</h2>
          <p className="mt-5 max-w-2xl text-xl leading-snug text-ink-2 md:text-2xl">{d.headline}</p>
        </Reveal>
        <Reveal delay={100}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">The problem</p>
          <p className="mt-3 text-base leading-relaxed text-ink-2">{d.problem}</p>
        </Reveal>
      </div>

      {/* Flow */}
      <Reveal delay={60} className="mt-16 md:mt-20">
        <Bezel inner="px-6 py-10 md:px-10 md:py-12">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">The flow · {d.steps.length} steps</p>
              <p className="mt-2 text-sm text-ink-2">Sample data. Press run and watch each step fix what it catches.</p>
            </div>
            <RunButton />
          </div>
          <Flow steps={d.steps} />
          {runs[d.id] && <BeforeAfter rows={runs[d.id]} steps={d.steps} />}
        </Bezel>
      </Reveal>

      {/* What goes in / what comes out */}
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
      {chats[d.id] && (
        <Reveal className="mt-20 border-t border-ink/[0.07] pt-16 md:mt-28 md:pt-24">
          <RunChat chat={chats[d.id]} />
        </Reveal>
      )}
      </RunProvider>
    </Section>
  )
}

/* ───────────── Review: what it changes for the developer ───────────── */

const FOR_DEVELOPER: { icon: string; title: string; text: string }[] = [
  { icon: 'Scales', title: 'Free-issue settled on evidence', text: 'Contractor and developer work from the same slips, measurement book, BBS and stock counts. RA-bill deductions stop being an argument about estimates.' },
  { icon: 'Notebook', title: 'A daily record from every package', text: 'Labour, progress, receipts and hindrances, dated and with photos, from each contractor. Planning sees the site as it was yesterday, not as it was at the monthly review.' },
  { icon: 'Clock', title: 'Delays with timestamps', text: 'Crane down four hours, drawing pending, client hold: logged when it happens. Extension and claim discussions start from the same facts.' },
  { icon: 'Warning', title: 'Fewer stoppages', text: 'Cement that will not last tomorrow’s pour, a machine past its service, a certificate about to lapse: flagged to the contractor before work stops.' },
  { icon: 'Recycle', title: 'Less waste across sites', text: 'Overuse beyond the norm, scrap that never returned, stock bought at one site while it lies at another. The same material, used once.' },
  { icon: 'Users', title: 'Nothing new for site teams', text: 'Supervisors keep sending WhatsApp voice notes and photos. No app to roll out, no training for your engineers or the contractor’s.' },
]

const FD_SPANS = ['md:col-span-4', 'md:col-span-2', 'md:col-span-2', 'md:col-span-4', 'md:col-span-3', 'md:col-span-3']

function ForDeveloper() {
  return (
    <Section id="for-you">
      <div className="grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-end">
        <Reveal>
          <Eyebrow>On your projects</Eyebrow>
          <h2 className="display mt-6 text-4xl leading-[1.05] text-ink md:text-6xl">What changes when your contractors run on it.</h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="max-w-xl text-lg leading-relaxed text-ink-2">
            Vera is sold to contractors. The developer is not asked to buy anything or change any system. The benefit reaches the project because the contractor’s records are complete, on time and checkable.
          </p>
        </Reveal>
      </div>
      <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
        {FOR_DEVELOPER.map((x, i) => (
          <Reveal key={x.title} delay={(i % 3) * 80} className={FD_SPANS[i]}>
            <Bezel className="h-full" inner="flex h-full flex-col gap-8 p-7 md:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.04] text-rust">
                <Icon name={x.icon} size={20} />
              </span>
              <div>
                <h3 className={`display leading-tight text-ink ${FD_SPANS[i] === 'md:col-span-2' ? 'text-2xl' : 'text-3xl'}`}>{x.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{x.text}</p>
              </div>
            </Bezel>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

const QUESTIONS = [
  ['Free-issue', 'On your projects, which record settles a free-issue dispute: the stores slip, the contractor’s acknowledgement, or the yard count?'],
  ['RA bills', 'Where do RA-bill disagreements with contractors usually start, and what evidence ends them?'],
  ['Site records', 'What makes a contractor’s DPR useful to your planning team, and what makes it ignored?'],
  ['Biggest losses', 'Which contractor problems cost your projects the most: material, labour, plant and formwork, or paperwork?'],
  ['Plant & formwork', 'How are formwork shortages and idle hired equipment handled with contractors today?'],
  ['Adoption', 'Who inside a contractor’s firm should own a tool like this, and what would stop them using it?'],
]

function Feedback() {
  return (
    <Section id="feedback">
      <div className="grid gap-16 md:grid-cols-[1fr_1.3fr] md:gap-20">
        <Reveal className="md:sticky md:top-28 md:self-start">
          <Eyebrow tone="rust">Your guidance</Eyebrow>
          <h2 className="display mt-6 text-4xl leading-[1.05] text-ink md:text-6xl">Where we would value your view.</h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
            You see how contractors actually work on large projects. These are the questions we cannot answer from the outside.
          </p>
        </Reveal>
        <ol className="space-y-4">
          {QUESTIONS.map(([k, q], i) => (
            <Reveal as="li" key={k} delay={(i % 3) * 70}>
              <Bezel inner="flex gap-6 p-6 md:p-7">
                <span className="num pt-1 text-sm text-rust">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="block text-[11px] uppercase tracking-[0.18em] text-ink-3">{k}</span>
                  <span className="mt-2 block text-lg leading-snug text-ink">{q}</span>
                </span>
              </Bezel>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  )
}

/* ───────────── Engagement ───────────── */

function Engagement({ audience }: { audience: Audience }) {
  const dev = audience === 'developer'
  const steps = dev
    ? [
        ['Day 0', 'Sign the NDA. Pick one contractor package where you supply cement or steel.'],
        ['Day 1–3', 'Share three months of free-issue slips, returns, yard counts, MB and RA bills. Excel or scans are fine.'],
        ['Day 7', 'Recovery pack: draft debit note, evidence trail, confidence on every line, contractor comparison.'],
        ['Then', 'You review every line with the contractor before anything is deducted.'],
      ]
    : [
        ['Day 0', 'Sign the NDA. Pick one site and three months.'],
        ['Day 1–3', 'Share POs, challans, gate book, issue slips and BOQ progress. Excel, Tally exports or photos.'],
        ['Day 7', 'One-page ₹ summary for the MD, supplier claim list and overuse by wing.'],
        ['Then', 'You check every line against its challan or slip before anything goes to a supplier.'],
      ]
  return (
    <Section id="engage">
      <div className="grid gap-16 md:grid-cols-[1fr_1.1fr] md:gap-20">
        <Reveal>
          <Eyebrow>{dev ? 'Pilot' : 'How we start'}</Eyebrow>
          <h2 className="display mt-6 text-4xl leading-[1.05] text-ink md:text-6xl">{dev ? 'One package, in a week.' : 'Start with one site and one week.'}</h2>
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
            <p className="text-[11px] uppercase tracking-[0.2em] text-paper/50">{dev ? 'Pilot · one contractor package' : 'Material Leak Check · one site'}</p>
            <p className="display mt-4 text-5xl leading-tight md:text-6xl">{dev ? 'One package. One week.' : 'One site. One week.'}</p>
            <p className="mt-10 text-[11px] uppercase tracking-[0.2em] text-paper/45">What you get</p>
            <ul className="mt-5 space-y-4 text-[15px] text-paper/75">
              {(dev
                ? ['Draft debit note ready for the next RA bill', 'Evidence trail: slips, MB entries, BBS, RA numbers', 'High / Medium / Check on every line', 'Wastage comparison across your contractors']
                : ['1-page ₹ summary for the MD', 'Supplier claim list with challan numbers', 'Overuse by wing and supervisor', 'Extra and short stock, valued']
              ).map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <Icon name="Check" size={16} className="text-rust-2" /> {x}
                </li>
              ))}
            </ul>
            <p className="mt-10 text-sm leading-relaxed text-paper/60">Registers are shared under NDA, used only for your report, and deleted on request.</p>
            <div className="mt-10">
              <PillButton href={contactHref()} variant="light" external={contactHref().startsWith('http')}>
                {dev ? 'Talk to us about a pilot' : 'Book a Leak Check'}
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
    ['Is the AI deciding how much we recover?', 'No. AI reads voice notes, photos and scanned documents. Every rupee figure comes from fixed rules in code: quantities, rates, allowances and earlier deductions. You can check each line against the document it cites.'],
    ['What if a message or a register entry is unclear?', 'It is listed as unclear, with the original attached, for a person to confirm. Vera does not fill gaps with guesses; on the free-issue desk such lines are marked Check.'],
    ['What data do you need, and who sees it?', 'Exports or photos of the registers you already keep. Everything is covered by an NDA, used only for your reports, and deleted on request.'],
    ['Does it work with Tally?', 'Yes. Receipts and stock journals come out as Tally import files, so your accountant does not re-enter anything.'],
    audience === 'developer'
      ? ['Will contractors accept the deductions?', 'Each line carries the slip numbers, the measurement book entry, the BBS and the RA bill it relates to, and a confidence label. High lines are backed by signed slips and certified quantities; Check lines go to the contractor for acknowledgement first.']
      : ['What are Plant & Formwork and Surplus Stock?', 'Two add-ons we are building with our first customers. They use the same WhatsApp and register data to catch overdue services, hired machines idling on rent, missing formwork, and stock that one site holds while another buys it again.'],
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
            {audience === 'review' ? 'Tell us what we have got wrong.' : audience === 'developer' ? 'Pick one package. We will show you the recovery in a week.' : 'Pick one site. We will show you the leak in a week.'}
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
          <p className="mx-auto mt-8 max-w-md text-xs text-ink-3">{audience === 'review' ? 'This page uses fictional sample data only. We are not asking for any project data.' : 'We will not ask for real project data until an NDA is signed.'}</p>
        </Bezel>
      </Reveal>
    </Section>
  )
}

function Footer() {
  return (
    <footer className="px-4 pb-14 md:px-8">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-4 border-t border-ink/[0.08] pt-8 text-xs leading-relaxed text-ink-3 md:flex-row md:items-start md:justify-between">
        <p className="display text-lg text-ink">Vera</p>
        <p className="max-w-2xl">
          Sample data: every site, contractor, supplier and person named on this page is fictional. Figures are illustrative of a ₹100–300 Cr contractor and are not results from any client. Desks 04 and 05 are being built with first customers.
        </p>
      </div>
    </footer>
  )
}

/* ───────────── Page ───────────── */

export function DemoPage({ firm, audience }: { firm: string; audience: Audience }) {
  const review = audience === 'review'
  const list = audience === 'developer' ? DEV_ORDER.map((id) => desks.find((d) => d.id === id)!).filter(Boolean) : desks
  const links = [
    { href: '#problem', label: 'Problem' },
    { href: '#how', label: 'How it works' },
    { href: '#desks', label: 'Desks' },
    review ? { href: '#feedback', label: 'Your view' } : { href: '#engage', label: audience === 'developer' ? 'Pilot' : 'How we start' },
    { href: '#faq', label: 'FAQ' },
  ]
  return (
    <>
      <Nav links={links} cta={review ? { href: '#feedback', label: 'Share your view' } : { href: '#contact', label: 'Talk to us' }} />
      <main>
        <Hero firm={firm} audience={audience} />
        <Leaks />
        <How />
        {review && <ForDeveloper />}
        <DeskIndex list={list} review={review} />
        {list.map((d, i) => (
          <DeskSection key={d.id} d={d} index={i} />
        ))}
        {review ? <Feedback /> : <Engagement audience={audience} />}
        <Faq audience={audience} />
        <Contact firm={firm} audience={audience} />
      </main>
      <Footer />
    </>
  )
}
