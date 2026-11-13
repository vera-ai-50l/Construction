'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Bezel } from './ui/Bezel'
import { Icon } from './ui/icons'
import {
  DOCS,
  OPENINGS,
  PIPELINE,
  flagsFor,
  freeSlots,
  missingDocs,
  opening,
  pipelineStats,
  stageOf,
  validRegistration,
  type Candidate,
  type DocId,
  type RoleId,
  type Stage,
} from '@/lib/recruitment'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'
type Step = 'role' | 'name' | 'qualification' | 'experience' | 'registration' | 'notice' | 'docs' | 'slot' | 'done'
type Line = { id: number; from: 'bot' | 'me'; text: string; doc?: boolean }

const STAGE_CHIP: Record<Stage, string> = {
  Screening: 'bg-ink/[0.05] text-ink-2',
  'Documents pending': 'bg-risk-2 text-risk',
  'Interview booked': 'bg-ok-2 text-ok',
  'For HR review': 'bg-teal-2 text-teal',
}

const blank = (): Omit<Candidate, 'stage' | 'flags'> => ({
  id: 'C-1050',
  name: '',
  role: 'icu-nurse',
  qualification: '',
  years: 0,
  registration: '',
  notice: '',
  docs: [],
  slot: '',
  firstReplySec: 2,
  appliedDaysAgo: 0,
})

export function RecruitBoard() {
  const [lines, setLines] = useState<Line[]>([])
  const [step, setStep] = useState<Step>('role')
  const [typing, setTyping] = useState(false)
  const [me, setMe] = useState(blank)
  const [started, setStarted] = useState(false)
  const [text, setText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const n = useRef(0)
  const queue = useRef<Promise<void>>(Promise.resolve())

  // Bot lines arrive one after another with a short typing pause, like a real chat.
  function bot(...texts: string[]) {
    for (const t of texts) {
      queue.current = queue.current.then(
        () =>
          new Promise<void>((res) => {
            setTyping(true)
            setTimeout(() => {
              setTyping(false)
              setLines((l) => [...l, { id: ++n.current, from: 'bot', text: t }])
              res()
            }, 650)
          }),
      )
    }
  }
  const say = (t: string, doc = false) => setLines((l) => [...l, { id: ++n.current, from: 'me', text: t, doc }])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [lines, typing])

  function start() {
    setStarted(true)
    say('Hi, I saw the nursing jobs post. Are you hiring?')
    bot('Hello! Thank you for your interest in joining our hospital. We have these openings. Which role are you applying for?')
  }

  function restart() {
    setLines([])
    setStep('role')
    setMe(blank())
    setStarted(false)
    setToast(null)
  }

  const op = opening(me.role)
  const live: Candidate | null = started && me.name ? { ...me, flags: flagsFor(me), stage: stageOf(me) } : null
  const all = live ? [live, ...PIPELINE] : PIPELINE
  const stats = pipelineStats(all)
  const slots = useMemo(() => freeSlots(PIPELINE).slice(0, 3), [])

  function pickRole(id: RoleId) {
    const o = opening(id)
    say(o.title)
    setMe((m) => ({ ...m, role: id }))
    bot(`${o.title}, ${o.department}. ${o.note}`, 'May I have your full name?')
    setStep('name')
  }

  function answer(raw: string) {
    const v = raw.trim()
    if (!v) return
    if (step === 'name') {
      say(v)
      setMe((m) => ({ ...m, name: v.split(' ').length > 1 ? `${v.split(' ')[0]} ${v.split(' ').at(-1)![0]}.` : v }))
      bot(`Thanks, ${v.split(' ')[0]}. What is your highest qualification?`)
      setStep('qualification')
    } else if (step === 'qualification') {
      say(v)
      setMe((m) => ({ ...m, qualification: v }))
      bot('How many years of experience do you have in this kind of role?')
      setStep('experience')
    } else if (step === 'experience') {
      const years = v.toLowerCase().startsWith('fresh') ? 0 : parseInt(v, 10)
      if (Number.isNaN(years)) {
        say(v)
        bot('Sorry, please send the number of years, for example 3. If you are a fresher, send 0.')
        return
      }
      say(v)
      setMe((m) => ({ ...m, years }))
      const note = years < op.minYears ? [`Thank you. This role lists ${op.minYears} years. I have noted yours for the HR team, who decide on every application. Let’s continue.`] : []
      if (op.needsRegistration) {
        bot(...note, 'Please send your State Nursing Council registration number.')
        setStep('registration')
      } else {
        bot(...note, 'When could you join if selected?')
        setStep('notice')
      }
    } else if (step === 'registration') {
      say(v)
      setMe((m) => ({ ...m, registration: v }))
      if (!validRegistration(v)) bot('That does not look like a registration number. I have saved it as sent; HR will check it with you.')
      bot('When could you join if selected?')
      setStep('notice')
    } else if (step === 'notice') {
      say(v)
      setMe((m) => ({ ...m, notice: v }))
      bot(`Almost done. Please send clear photos of these documents:\n${op.docs.map((d) => `• ${DOCS[d]}`).join('\n')}`)
      setStep('docs')
    }
  }

  function sendDoc(d: DocId) {
    say(`📎 ${DOCS[d]}.jpg`, true)
    const docs = [...me.docs, d]
    setMe((m) => ({ ...m, docs }))
    const left = op.docs.filter((x) => !docs.includes(x))
    if (left.length) {
      bot(`Received: ${DOCS[d]}. Still needed: ${left.map((x) => DOCS[x]).join(', ')}.`)
    } else {
      const flagged = flagsFor(me).length > 0
      if (flagged) {
        bot('Thank you, your application is complete. The HR team will review it and message you about an interview within 2 working days.')
        setStep('done')
        setTimeout(() => setToast(`Complete application for review: ${op.title}`), 1400)
      } else {
        bot('Thank you, your application is complete. Please choose an interview slot:')
        setStep('slot')
      }
    }
  }

  function later() {
    say('I will send the rest later')
    bot('No problem, your answers are saved. I will remind you tomorrow at 10 AM about the documents still needed.')
    setStep('done')
  }

  function pickSlot(s: string) {
    say(s)
    setMe((m) => ({ ...m, slot: s }))
    bot(`Booked: ${s}, HR Office, 2nd floor. Please bring the originals of your documents. Reply here if you need to change the time.`)
    setStep('done')
    setTimeout(() => setToast(`Complete application · ${op.title} · interview ${s}`), 1400)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    answer(text)
    setText('')
  }

  const quick: { label: string; act: () => void }[] = !started
    ? []
    : step === 'role'
      ? [...OPENINGS.map((o) => ({ label: o.title, act: () => pickRole(o.id) })), { label: 'What is the salary?', act: () => { say('What is the salary?'); bot('Salary depends on the role and your experience, and HR shares it at the interview. I have noted your question for them. Which role are you applying for?') } }]
      : step === 'name'
        ? [{ label: 'Neha Kulkarni', act: () => answer('Neha Kulkarni') }]
        : step === 'qualification'
          ? op.qualifications.map((q) => ({ label: q, act: () => answer(q) }))
          : step === 'experience'
            ? ['0', '1', '2', '4', '6'].map((y) => ({ label: y === '0' ? 'Fresher' : `${y} years`, act: () => answer(y) }))
            : step === 'registration'
              ? [{ label: 'MH-RN-62391', act: () => answer('MH-RN-62391') }]
              : step === 'notice'
                ? ['Immediately', '15 days', '30 days', '60 days'].map((x) => ({ label: x, act: () => answer(x) }))
                : step === 'docs'
                  ? [...missingDocs(me).map((d) => ({ label: `📎 ${DOCS[d]}`, act: () => sendDoc(d) })), ...(me.docs.length ? [{ label: 'I’ll send the rest later', act: later }] : [])]
                  : step === 'slot'
                    ? slots.map((s) => ({ label: s, act: () => pickSlot(s) }))
                    : []
  const canType = started && ['name', 'qualification', 'experience', 'registration', 'notice'].includes(step)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Candidate's WhatsApp */}
      <div className="min-w-0 lg:col-span-5">
        <div className="mx-auto max-w-[420px] rounded-[2.6rem] bg-night p-2.5 shadow-[0_40px_80px_-40px_rgba(16,40,40,0.6)] ring-1 ring-black/40">
          <div className="flex h-[min(76dvh,700px)] min-h-[560px] flex-col overflow-hidden rounded-[2.1rem] bg-[#efeae2]">
            <div className="flex items-center gap-3 bg-[#0f5a52] px-4 pb-3 pt-5 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Icon name="Briefcase" size={16} weight="regular" />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-medium">Hospital Careers</span>
                <span className="block text-[11px] text-white/70">{typing ? 'typing…' : 'Replies in seconds, any hour'}</span>
              </span>
              {started && (
                <button type="button" onClick={restart} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10" aria-label="Start again">
                  <Icon name="ArrowCounterClockwise" size={14} />
                </button>
              )}
            </div>
            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-4">
              {!started && (
                <div className="mx-auto mt-16 max-w-[17rem] text-center">
                  <p className="text-[13.5px] text-ink">You are the candidate.</p>
                  <p className="mt-1 text-[12.5px] text-ink-3">Apply for a job the way a nurse would, on WhatsApp. Watch HR’s sheet on the right fill itself in.</p>
                  <button type="button" onClick={start} className={`group relative mt-5 inline-flex cursor-pointer items-center gap-3 rounded-full bg-teal py-2 pl-5 pr-2 text-[13.5px] font-medium text-white transition-transform duration-500 ${EASE} active:scale-[0.97]`}>
                    <span className="pointer-events-none absolute inset-0 rounded-full bg-teal/40 [animation:pulse-ring_2.2s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
                    <span className="relative">Start as a candidate</span>
                    <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                      <Icon name="Play" size={13} weight="fill" />
                    </span>
                  </button>
                </div>
              )}
              {lines.map((l) => (
                <p
                  key={l.id}
                  className={`max-w-[82%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm [animation:rise_350ms_cubic-bezier(0.16,1,0.3,1)] ${
                    l.from === 'me' ? 'ml-auto rounded-br-md bg-[#d9fdd3] text-ink' : 'rounded-tl-md bg-white text-ink'
                  } ${l.doc ? 'italic text-ink-2' : ''}`}
                >
                  {l.text}
                </p>
              ))}
              {typing && (
                <span className="flex w-fit gap-1 rounded-2xl rounded-tl-md bg-white px-3.5 py-3 shadow-sm">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-3 [animation:dot_1.1s_ease_infinite]" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
              )}
              {step === 'done' && !typing && (
                <p className="mx-auto mt-3 w-fit rounded-full bg-white/70 px-3 py-1 text-[11px] text-ink-3">Conversation complete · tap ↻ to apply again</p>
              )}
            </div>
            {started && step !== 'done' && (
              <div className="border-t border-black/5 bg-white/80 p-2.5">
                {quick.length > 0 && (
                  <div className="-mx-1 mb-2 flex flex-wrap gap-1.5 px-1">
                    {quick.map((q) => (
                      <button key={q.label} type="button" disabled={typing} onClick={q.act} className="cursor-pointer rounded-full bg-white px-3 py-1.5 text-[12px] text-teal ring-1 ring-teal/25 transition-colors hover:bg-teal-2 disabled:opacity-40">
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
                {canType && (
                  <form onSubmit={onSubmit} className="flex gap-2">
                    <input value={text} onChange={(e) => setText(e.target.value)} disabled={typing} maxLength={80} placeholder="Type a reply" aria-label="Your reply" className="min-w-0 flex-1 rounded-full bg-white px-4 py-2.5 text-[13.5px] outline-none ring-1 ring-black/10 focus:ring-teal/40" />
                    <button type="submit" disabled={typing || !text.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-teal text-white disabled:opacity-40">
                      <Icon name="PaperPlaneRight" size={15} weight="fill" />
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HR's sheet */}
      <div className="min-w-0 lg:col-span-7">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [String(stats.n), 'applications this week'],
            [`${stats.avgReply} sec`, 'average first reply'],
            [String(stats.complete), 'complete, no chasing'],
            [String(stats.booked), 'interviews booked'],
          ].map(([a, b]) => (
            <Bezel key={b} inner="p-4">
              <p className="text-2xl font-semibold tabular-nums tracking-tight">{a}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-3">{b}</p>
            </Bezel>
          ))}
        </div>

        <Bezel className="relative mt-4" inner="p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-3">For the HR team</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">Applications sheet, filled in by the assistant</h3>
            </div>
            <p className="text-[11.5px] text-ink-3">Sample candidates · flags are notes, not decisions</p>
          </div>
          <div className="-mx-1 mt-4 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  <th className="pb-2 pr-3 font-normal">Candidate</th>
                  <th className="pb-2 pr-3 font-normal">Role</th>
                  <th className="pb-2 pr-3 text-right font-normal">Exp.</th>
                  <th className="pb-2 pr-3 font-normal">Documents</th>
                  <th className="pb-2 pr-3 font-normal">Status</th>
                  <th className="pb-2 font-normal">Interview</th>
                </tr>
              </thead>
              <tbody>
                {all.map((c) => {
                  const miss = missingDocs(c)
                  const isLive = live && c.id === live.id
                  const need = opening(c.role).docs.length
                  return (
                    <tr key={c.id} className={`border-t border-ink/[0.05] align-top transition-colors duration-700 ${isLive ? 'bg-teal-2/60' : ''}`}>
                      <td className="py-2.5 pr-3">
                        <span className="block font-medium text-ink">
                          {c.name || '…'} {isLive && <span className="ml-1 rounded-full bg-teal px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-white">live</span>}
                        </span>
                        <span className="num text-[11px] text-ink-3">{c.id}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-ink-2">{opening(c.role).title}</td>
                      <td className="num py-2.5 pr-3 text-right">{c.qualification ? `${c.years}y` : '–'}</td>
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-1.5">
                          <span className="flex gap-[2px]">
                            {Array.from({ length: need }).map((_, i) => (
                              <span key={i} className={`h-2 w-2 rounded-[2px] ${i < need - miss.length ? 'bg-ok' : 'bg-ink/15'}`} />
                            ))}
                          </span>
                          <span className="num text-[11px] text-ink-3">
                            {need - miss.length}/{need}
                          </span>
                        </span>
                        {miss.length > 0 && c.docs.length > 0 && <span className="mt-0.5 block text-[10.5px] text-risk">needs {miss.map((d) => DOCS[d].split(' (')[0]).join(', ')}</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-medium ${STAGE_CHIP[c.stage]}`}>{c.stage}</span>
                        {c.flags.length > 0 && <span className="mt-0.5 block max-w-[12rem] text-[10.5px] text-ink-3">{c.flags[0]}</span>}
                      </td>
                      <td className="py-2.5 text-[11.5px] text-ink-2">{c.slot || '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {toast && (
            <div className="absolute -top-3 right-4 flex max-w-[90%] items-center gap-2.5 rounded-full bg-night py-2 pl-2 pr-4 text-[12px] text-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] [animation:rise_500ms_cubic-bezier(0.16,1,0.3,1)]">
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal">
                <span className="absolute inset-0 rounded-full bg-teal/50 [animation:pulse-ring_1.6s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
                <Icon name="BellRinging" size={14} className="relative" />
              </span>
              <span className="truncate">HR alert: {toast}</span>
            </div>
          )}
        </Bezel>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {OPENINGS.map((o) => (
            <div key={o.id} className="rounded-2xl bg-card p-4 ring-1 ring-ink/[0.06]">
              <p className="flex items-baseline justify-between gap-2 text-[13.5px] font-medium">
                {o.title} <span className="num text-[11px] font-normal text-ink-3">{o.openings} openings</span>
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{o.note}</p>
              <p className="mt-2 text-[11px] text-ink-3">Documents: {o.docs.map((d) => DOCS[d].split(' (')[0]).join(' · ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
