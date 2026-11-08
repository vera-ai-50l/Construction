'use client'

// Desk 05: the day, step by step. Every Vera message here was produced by the workflow code
// (content/day-demo.json is written by n8n/mobilise/build.mjs); the contractor's side switches
// between English, Hindi and Marathi the way it would for a real contractor.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import demo from '@/content/day-demo.json'

type Msg = {
  from: 'vera' | 'them'; text: string; buttons?: string[]; template?: boolean; tap?: boolean; note?: boolean; after?: string
  file?: string; photo?: string; voice?: string; transcript?: string; replyTo?: string; caption?: string
}
type Thread = { who: string; sub: string; msgs: Msg[] }
type Lang = 'en' | 'hi' | 'mr'

const LANGS: { code: Lang; label: string }[] = [{ code: 'en', label: 'English' }, { code: 'hi', label: 'हिन्दी' }, { code: 'mr', label: 'मराठी' }]

const STEPS = [
  { id: 't5', when: 'T−5', title: 'Site set up', lead: 'Planning fills one form: site, contractor, dates, contract value, peak labour, phones and the contractor’s language. Vera copies the checklist for this site and sends both sides what they need.',
    points: ['The contractor gets one message per area, each line numbered. Replying to it is how a photo lands on the right line.', 'First contact is outside WhatsApp’s 24-hour window, so it goes as an approved template with a “Show me” button; the tap opens the lists.', 'The engineer gets a signed walk link, valid until the day after the visit.'] },
  { id: 't3', when: 'T−3', title: 'Papers and photos come in', lead: 'The contractor sends papers and photos on WhatsApp, as replies or with a line number. Vera files each one, reads the papers and checks them against this site’s facts.',
    points: ['A reply to the area message plus “2” files on PAP-02. “PAP 4” in the caption works too, and so does a spoken code in a voice note.', 'Papers are read by AI and checked by plain rules: the CAR policy here is sent back because ₹90 Cr is below the ₹125 Cr contract.', 'Twenty photos in a minute get one reply, not twenty. When Vera is not sure of the line, the sender taps one of two buttons.'] },
  { id: 't1', when: 'T−1', title: '7 PM gap list', lead: 'Every evening before the visit, the contractor gets what is still missing and why; the engineer gets one line: ready to travel, or which critical papers are still open.',
    points: ['Sent-back papers say what was wrong, in the contractor’s language; line texts stay as written on site.', 'The engineer does not chase papers. He sees the state of the site before he leaves.'] },
  { id: 'visit', when: 'Visit day', title: 'The walk', lead: 'The engineer opens the link on his phone. Tap a line, take the photo, speak the remark: the photo is born on its line, so nothing needs tagging later.',
    points: ['GPS is stored with every photo, with the phone’s own ± metres; each area counts as walked only with fixes inside it.', 'Indoors, a signed QR sticker at the door places the photos instead. A scan far from its area is not counted.', 'No signal: everything waits on the phone and sends itself later.'] },
  { id: 'evening', when: 'Evening', title: 'NOC report drafted', lead: 'When he taps Finish, the report is drafted: the recommendation comes from the checklist rules, AI only words his remarks in English, and the PDF comes to him on WhatsApp to sign with one tap.',
    points: ['Critical open or an area not walked: not ready. Majors open: ready with conditions, each with a due date.', 'His Hindi or Marathi remarks are printed as spoken, next to their English.', 'The tap from his own number is the sign-off, kept with the report.'] },
  { id: 'after', when: 'After', title: 'Open items closed on photos', lead: 'Each open item gets a due date. The contractor is reminded, replies with a photo, and the engineer accepts it from his phone instead of another visit.',
    points: ['Critical items overdue go to the project head.', 'A reply to the reminder binds to that item for certain.', 'Accept closes the item and the checklist line; “Not fixed” reopens it and tells the contractor.'] },
] as const

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g)
  return <>{parts.map((p, i) => (p.startsWith('*') && p.endsWith('*') && p.length > 2 ? <b key={i}>{p.slice(1, -1)}</b> : <span key={i}>{p}</span>))}</>
}

function Bubble({ m }: { m: Msg }) {
  if (m.note) return <p className="py-1 text-center text-[11px] text-ink-3">{m.text}</p>
  const mine = m.from === 'them'
  if (m.tap) return <div className="flex justify-end"><span className="rounded-full bg-sage-2 px-3 py-1 text-xs text-ink-2">tapped “{m.text}”</span></div>
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {m.after && <span className="mb-1 text-[10px] uppercase tracking-wider text-ink-3">{m.after}</span>}
      <div className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm ${mine ? 'rounded-br-md bg-[#dcf2d2] text-ink' : 'rounded-bl-md bg-card text-ink ring-1 ring-line'}`}>
        {m.template && <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-3">approved template</span>}
        {m.replyTo && <span className="mb-1 block truncate rounded-md border-l-2 border-sage bg-ink/5 px-2 py-1 text-[11px] text-ink-2"><Rich text={m.replyTo} /></span>}
        {m.file && <span className="mb-1 flex items-center gap-2 rounded-md bg-ink/5 px-2 py-1.5 text-xs"><span aria-hidden>📄</span>{m.file}</span>}
        {m.photo && <span className="mb-1 flex h-20 w-44 items-center justify-center rounded-md bg-gradient-to-br from-[#b9a98f] to-[#7d6b55] text-xs text-paper">📷 {m.photo}</span>}
        {m.voice && <span className="mb-1 flex items-center gap-2 text-xs text-ink-2"><span aria-hidden>🎙</span>voice note · {m.voice}</span>}
        {m.transcript && <span className="block text-[11px] italic text-ink-3">heard: {m.transcript}</span>}
        {m.caption && <span className="block">{m.caption}</span>}
        {m.text && <Rich text={m.text} />}
      </div>
      {m.buttons && (
        <div className="mt-1 flex max-w-[88%] flex-wrap gap-1">
          {m.buttons.map((b) => <span key={b} className="rounded-lg bg-card px-3 py-1.5 text-xs text-sage ring-1 ring-line">{b}</span>)}
        </div>
      )}
    </div>
  )
}

function Phone({ who, sub, msgs, children }: { who: string; sub: string; msgs?: Msg[]; children?: React.ReactNode }) {
  return (
    <div className="w-full max-w-[360px] overflow-hidden rounded-[28px] bg-espresso p-2 shadow-xl">
      <div className="rounded-[22px] bg-paper-2">
        <div className="rounded-t-[22px] bg-espresso/95 px-4 pb-2 pt-3 text-paper">
          <p className="text-sm font-medium">{who}</p>
          <p className="text-[11px] opacity-70">{sub}</p>
        </div>
        <div className="flex max-h-[560px] min-h-[200px] flex-col gap-2 overflow-y-auto p-3">
          {msgs?.map((m, i) => <Bubble key={i} m={m} />)}
          {children}
        </div>
      </div>
    </div>
  )
}

export function DayDemo() {
  const [step, setStep] = useState(0)
  const [lang, setLang] = useState<Lang>('en')
  useEffect(() => { try { const l = localStorage.getItem('vera-day-lang'); if (l === 'hi' || l === 'mr') setLang(l) } catch {} }, [])
  const pick = (l: Lang) => { setLang(l); try { localStorage.setItem('vera-day-lang', l) } catch {} }
  const s = STEPS[step]
  const c = demo.languages[lang] as unknown as Record<string, Thread & { engineer?: string }>
  const e = demo.engineer
  const v = demo.visit

  return (
    <main className="mx-auto min-h-dvh max-w-6xl bg-paper px-4 pb-16 pt-8 text-ink md:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">Vera · Desk 05 · One-day mobilisation</p>
          <h1 className="font-display mt-2 text-3xl leading-tight md:text-4xl">{demo.project}: the day, step by step</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-2">Every Vera message below was produced by the workflow code on a sample site. Only what the contractor and engineer send is made up.</p>
        </div>
        <div className="flex items-center gap-2 text-sm" role="radiogroup" aria-label="Contractor's language">
          <span className="text-ink-3">Contractor reads in</span>
          {LANGS.map((l) => (
            <button key={l.code} role="radio" aria-checked={lang === l.code} onClick={() => pick(l.code)} className={`rounded-full px-3 py-1 ${lang === l.code ? 'bg-espresso text-paper' : 'bg-card ring-1 ring-line'}`}>{l.label}</button>
          ))}
        </div>
      </header>

      <nav className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0" aria-label="Steps">
        {STEPS.map((x, i) => (
          <button key={x.id} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}
            className={`shrink-0 rounded-xl px-4 py-2 text-left ring-1 ring-line ${i === step ? 'bg-espresso text-paper' : 'bg-card text-ink-2'}`}>
            <span className="block font-mono text-[11px] opacity-70">{x.when}</span>
            <span className="text-sm">{x.title}</span>
          </button>
        ))}
      </nav>

      <section className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12">
        <div>
          <p className="font-mono text-xs text-ink-3">{s.when}</p>
          <h2 className="font-display mt-1 text-2xl">{s.title}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{s.lead}</p>
          <ul className="mt-5 flex flex-col gap-3">
            {s.points.map((p) => <li key={p} className="flex gap-3 text-[14px] leading-relaxed text-ink-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rust" aria-hidden />{p}</li>)}
          </ul>
          {s.id === 'visit' && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/walk" className="rounded-lg bg-espresso px-4 py-2.5 text-sm text-paper">Open the walk page (demo)</Link>
              <Link href="/walk/stickers" className="rounded-lg bg-card px-4 py-2.5 text-sm ring-1 ring-line">QR sticker sheet</Link>
            </div>
          )}
          {s.id === 'evening' && (
            <div className="mt-6"><a href="/desk05/sample-noc-report.pdf" className="rounded-lg bg-espresso px-4 py-2.5 text-sm text-paper">Open the sample report (PDF)</a></div>
          )}
          <div className="mt-8 flex gap-3">
            <button disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-lg bg-card px-4 py-2 text-sm ring-1 ring-line disabled:opacity-40">← Previous</button>
            <button disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)} className="rounded-lg bg-rust px-4 py-2 text-sm text-paper disabled:opacity-40">Next →</button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 md:items-start xl:flex-row">
          {s.id === 't5' && <>
            <Phone who={c.t5.who} sub={c.t5.sub} msgs={c.t5.msgs} />
            <Phone who="Engineer" sub="walk link" msgs={[{ from: 'vera', text: e.walkLink }]} />
          </>}
          {s.id === 't3' && <Phone who={c.t3.who} sub={c.t3.sub} msgs={c.t3.msgs} />}
          {s.id === 't1' && <>
            <Phone who={c.t1.who} sub={c.t1.sub} msgs={c.t1.msgs} />
            <Phone who="Engineer" sub="7 PM brief" msgs={[{ from: 'vera', text: c.t1.engineer || '' }]} />
          </>}
          {s.id === 'visit' && (
            <Phone who="Walk page" sub="engineer's phone, 10:05 to 12:40">
              <div className="rounded-xl bg-card p-3 text-sm ring-1 ring-line">
                <p className="font-medium">Areas walked</p>
                <ul className="mt-2 flex flex-col gap-1 text-[13px] text-ink-2">
                  {v.areas.map((a) => <li key={a.area} className="flex justify-between"><span>{a.area}</span><span className="tabular-nums">{a.minutes} min{a.stickers ? ' · sticker' : ''}</span></li>)}
                </ul>
              </div>
              <div className="rounded-xl bg-card p-3 text-sm ring-1 ring-line">
                <p className="text-sage">📍 Inside Labour camp · ±7 m</p>
                <p className="mt-1 text-[13px] text-ink-2">LC-03 Toilets · Not OK · photo + voice remark</p>
              </div>
              <div className="rounded-xl bg-card p-3 text-sm ring-1 ring-line">
                <p className="text-sage">🏷 Sticker scanned: Batching plant</p>
                <p className="mt-1 text-[13px] text-ink-2">Site lab is indoors; the sticker places BP-06.</p>
              </div>
            </Phone>
          )}
          {s.id === 'evening' && (
            <Phone who="Engineer" sub="report to sign" msgs={[{ from: 'vera', text: e.noc.text, file: e.noc.file, buttons: e.noc.buttons }, { from: 'them', text: 'With conditions', tap: true }]}>
              <p className="py-1 text-center text-[11px] text-ink-3">{v.done}/{v.total} lines closed · {v.prewritten}% of lines had evidence on file before he wrote a word</p>
            </Phone>
          )}
          {s.id === 'after' && <>
            <Phone who={c.after.who} sub={c.after.sub} msgs={c.after.msgs} />
            <Phone who="Engineer" sub="photo to approve" msgs={[{ from: 'vera', text: e.closure.text, photo: 'Earthing pit test report', buttons: e.closure.buttons }, { from: 'them', text: e.closure.buttons[0], tap: true }]} />
          </>}
        </div>
      </section>
    </main>
  )
}
