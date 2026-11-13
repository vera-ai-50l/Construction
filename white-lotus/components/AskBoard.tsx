'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { AskResult } from '@/lib/answer'
import { HR_CONTACT, policies, SAMPLE_QUESTIONS, chunks } from '@/content/policies'
import { Bezel } from './ui/Bezel'
import { Icon } from './ui/icons'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'
type Msg = { id: number; role: 'user'; text: string } | { id: number; role: 'bot'; q: string; r: AskResult } | { id: number; role: 'error'; text: string }
type InboxItem = { q: string; reason: string; at: string }
type Asked = { q: string; topic: string; mode: AskResult['mode'] }

const load = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : d
  } catch {
    return d
  }
}
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {}
}

const STEPS = [
  { icon: 'ChatCircleText', t: 'Question', d: 'From a staff member' },
  { icon: 'MagnifyingGlass', t: 'Search', d: `${chunks.length} approved sections` },
  { icon: 'Sparkle', t: 'Answer', d: 'Only from what was found, with sources' },
  { icon: 'UserSwitch', t: 'Or hand to HR', d: 'When the documents don’t cover it' },
]

export function AskBoard() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(-1)
  const [status, setStatus] = useState<{ ai: boolean; model: string } | null>(null)
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [asked, setAsked] = useState<Asked[]>([])
  const [tab, setTab] = useState<'inbox' | 'topics' | 'docs'>('inbox')
  const [cited, setCited] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const n = useRef(0)

  useEffect(() => {
    setInbox(load('wl-hr-inbox', []))
    setAsked(load('wl-asked', []))
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ ai: false, model: '' }))
  }, [])
  // Scroll only the chat box, never the page.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy])

  async function send(q: string) {
    const question = q.trim()
    if (!question || busy) return
    const previous = [...msgs].reverse().find((m) => m.role === 'user')?.text
    setMsgs((m) => [...m, { id: ++n.current, role: 'user', text: question }])
    setInput('')
    setBusy(true)
    setStep(0)
    const t1 = setTimeout(() => setStep(1), 350)
    const t2 = setTimeout(() => setStep(2), 900)
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, previous }) })
      const data = await res.json()
      clearTimeout(t1)
      clearTimeout(t2)
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      const r = data as AskResult
      setStep(r.mode === 'handover' ? 3 : 2)
      setMsgs((m) => [...m, { id: ++n.current, role: 'bot', q: question, r }])
      setCited([...new Set(r.segments.flatMap((s) => s.cites.map((c) => c.chunkId)))])
      const topic = r.mode === 'handover' ? 'Not covered: sent to HR' : (r.retrieved[0]?.policy ?? 'Other')
      const nextAsked = [...asked, { q: question, topic, mode: r.mode }].slice(-200)
      setAsked(nextAsked)
      save('wl-asked', nextAsked)
      if (r.mode === 'handover') {
        const item = { q: question, reason: r.handover?.reason ?? '', at: new Date().toISOString() }
        const next = [item, ...inbox].slice(0, 50)
        setInbox(next)
        save('wl-hr-inbox', next)
        setTab('inbox')
      }
    } catch (e) {
      clearTimeout(t1)
      clearTimeout(t2)
      setMsgs((m) => [...m, { id: ++n.current, role: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' }])
    } finally {
      setBusy(false)
      setTimeout(() => setStep(-1), 1600)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Chat */}
      <div className="min-w-0 lg:col-span-7">
        <Bezel inner="flex h-[min(78dvh,760px)] min-h-[560px] flex-col overflow-hidden">
          {/* Header + pipeline */}
          <div className="border-b border-ink/[0.06] px-5 pb-4 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal text-white">
                  <Icon name="Flower" size={19} weight="regular" />
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold tracking-tight">HR Assistant</p>
                  <p className="text-[11.5px] text-ink-3">Answers from approved HR documents only</p>
                </div>
              </div>
              {status && (
                <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-medium ${status.ai ? 'bg-teal-2 text-teal' : 'bg-risk-2 text-risk'}`} title={status.ai ? `Model: ${status.model}` : 'Add ANTHROPIC_API_KEY to turn on AI wording'}>
                  {status.ai ? 'AI answers on' : 'Passages mode (no AI key)'}
                </span>
              )}
            </div>
            <ol className="mt-4 grid grid-cols-4 gap-1.5">
              {STEPS.map((s, i) => {
                const on = step === i || (step === 3 && i === 1) || (step === 2 && i < 2) || (busy && i <= step)
                const handover = i === 3 && step === 3
                return (
                  <li key={s.t} className={`relative overflow-hidden rounded-xl px-2.5 py-2 ring-1 transition-all duration-500 ${EASE} ${handover ? 'bg-risk-2 ring-risk/30' : on ? 'bg-teal-2 ring-teal/25' : 'bg-ground ring-transparent'}`}>
                    {busy && step === i && <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent [animation:sweep_1.1s_linear_infinite]" />}
                    <span className={`relative flex items-center gap-1.5 text-[11.5px] font-medium ${handover ? 'text-risk' : on ? 'text-teal' : 'text-ink-2'}`}>
                      <Icon name={s.icon} size={13} weight={on || handover ? 'bold' : 'light'} /> {s.t}
                    </span>
                    <span className="relative mt-0.5 hidden text-[10.5px] leading-tight text-ink-3 sm:block">{s.d}</span>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-ground/60 px-4 py-5 md:px-5">
            {msgs.length === 0 && (
              <div className="mx-auto max-w-md pt-6 text-center">
                <p className="text-[15px] font-medium">Ask anything a staff member would ask HR.</p>
                <p className="mt-1.5 text-[13px] text-ink-3">Try one of these, or type your own. Ask something the policies don’t cover to see the hand-over to HR.</p>
              </div>
            )}
            {msgs.map((m) =>
              m.role === 'user' ? (
                <p key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[14px] text-white [animation:rise_400ms_cubic-bezier(0.16,1,0.3,1)]">
                  {m.text}
                </p>
              ) : m.role === 'error' ? (
                <p key={m.id} className="max-w-[85%] rounded-2xl bg-below-2 px-4 py-2.5 text-[13.5px] text-below">
                  {m.text}
                </p>
              ) : (
                <Answer key={m.id} r={m.r} />
              ),
            )}
            {busy && (
              <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-card px-4 py-3 text-[12.5px] text-ink-3 ring-1 ring-ink/[0.05]">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-teal [animation:dot_1.1s_ease_infinite]" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
                {step <= 1 ? 'Searching approved documents…' : 'Writing the answer from what was found…'}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-ink/[0.06] bg-card p-3">
            <div className="-mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {SAMPLE_QUESTIONS.concat(['Is there parking for two-wheelers?']).map((q) => (
                <button key={q} type="button" onClick={() => send(q)} disabled={busy} className="shrink-0 cursor-pointer rounded-full bg-ground px-3 py-1.5 text-[12px] text-ink-2 ring-1 ring-ink/[0.05] transition-colors hover:bg-teal-2 hover:text-teal disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={400}
                placeholder="Type a question, e.g. how many sick leaves do I get?"
                className="min-w-0 flex-1 rounded-full bg-ground px-4 py-3 text-[14px] outline-none ring-1 ring-ink/[0.06] placeholder:text-ink-3 focus:ring-teal/40"
                aria-label="Your question"
              />
              <button type="submit" disabled={busy || !input.trim()} className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-teal text-white transition-transform duration-500 ${EASE} active:scale-95 disabled:opacity-40`} aria-label="Send">
                <Icon name="PaperPlaneRight" size={17} weight="fill" />
              </button>
            </form>
          </div>
        </Bezel>
      </div>

      {/* Side panel */}
      <div className="min-w-0 lg:col-span-5">
        <Bezel inner="p-5">
          <div className="flex rounded-full bg-ground p-1" role="tablist">
            {(
              [
                ['inbox', `HR inbox${inbox.length ? ` · ${inbox.length}` : ''}`],
                ['topics', 'What staff ask'],
                ['docs', 'Approved documents'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 cursor-pointer rounded-full px-2 py-1.5 text-[12px] transition-all duration-500 ${EASE} ${tab === k ? 'bg-card text-ink shadow-[0_4px_14px_-6px_rgba(16,40,40,0.35)]' : 'text-ink-3 hover:text-ink'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="mt-4 max-h-[620px] overflow-y-auto pr-1">
            {tab === 'inbox' && <Inbox items={inbox} onClear={() => { setInbox([]); save('wl-hr-inbox', []) }} />}
            {tab === 'topics' && <Topics asked={asked} />}
            {tab === 'docs' && <Docs cited={cited} />}
          </div>
        </Bezel>
      </div>
    </div>
  )
}

function Answer({ r }: { r: AskResult }) {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState<number | null>(null)
  // Number each distinct cited section once, in order of first use.
  const order = useMemo(() => {
    const ids: string[] = []
    for (const s of r.segments) for (const c of s.cites) if (c.chunkId && !ids.includes(c.chunkId)) ids.push(c.chunkId)
    return ids
  }, [r])
  const quotes = useMemo(() => {
    const m = new Map<string, { policy: string; heading: string; quotes: string[] }>()
    for (const s of r.segments)
      for (const c of s.cites) {
        const e = m.get(c.chunkId) ?? { policy: c.policy, heading: c.heading, quotes: [] }
        if (!e.quotes.includes(c.quote)) e.quotes.push(c.quote)
        m.set(c.chunkId, e)
      }
    return m
  }, [r])
  const usedIds = new Set(order)

  const badge =
    r.mode === 'ai'
      ? { t: 'Answer from approved policy', c: 'bg-teal-2 text-teal', i: 'SealCheck' }
      : r.mode === 'passages'
        ? { t: 'Approved passages', c: 'bg-ground-2 text-ink-2', i: 'BookOpenText' }
        : { t: 'Handed to HR', c: 'bg-risk-2 text-risk', i: 'UserSwitch' }

  return (
    <div className="max-w-[92%] [animation:rise_500ms_cubic-bezier(0.16,1,0.3,1)]">
      <div className="rounded-2xl rounded-bl-md bg-card px-4 py-3.5 ring-1 ring-ink/[0.05] shadow-[0_10px_30px_-24px_rgba(16,40,40,0.4)]">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${badge.c}`}>
          <Icon name={badge.i} size={12} weight="bold" /> {badge.t}
        </span>
        {r.note && <p className="mt-2 text-[11.5px] text-ink-3">{r.note}</p>}

        {r.mode === 'passages' ? (
          <div className="mt-2.5 space-y-2.5">
            {r.segments.map((s, i) => (
              <blockquote key={i} className="border-l-2 border-teal/40 pl-3 text-[13.5px] leading-relaxed text-ink">
                {s.text}
                <span className="mt-1 block text-[11px] text-teal">
                  {s.cites[0]?.policy} · {s.cites[0]?.heading}
                </span>
              </blockquote>
            ))}
          </div>
        ) : (
          <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {r.segments.map((s, i) => (
              <span key={i}>
                {s.text.replace(/\*\*/g, '')}
                {[...new Set(s.cites.map((c) => c.chunkId))].map((id) => {
                  const k = order.indexOf(id) + 1
                  return (
                    <button key={id} type="button" onClick={() => setFocus(focus === k ? null : k)} className={`mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-[1px] cursor-pointer items-center justify-center rounded-full px-1 align-middle text-[10px] font-semibold transition-colors ${focus === k ? 'bg-teal text-white' : 'bg-teal-2 text-teal hover:bg-teal hover:text-white'}`} aria-label={`Source ${k}`}>
                      {k}
                    </button>
                  )
                })}
              </span>
            ))}
          </p>
        )}

        {r.mode === 'handover' && r.handover && (
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-risk-2/70 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-risk">
              <Icon name="UserCircle" size={18} />
            </span>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Passed to <span className="font-medium text-ink">{r.handover.to}</span>, ext. {r.handover.ext}. Logged in the HR inbox so HR can see what keeps coming up.
            </p>
          </div>
        )}

        {order.length > 0 && r.mode === 'ai' && (
          <ol className="mt-3 space-y-1.5 border-t border-ink/[0.06] pt-2.5">
            {order.map((id, i) => {
              const q = quotes.get(id)!
              return (
                <li key={id} className={`rounded-lg px-2 py-1.5 text-[11.5px] transition-colors duration-300 ${focus === i + 1 ? 'bg-teal-2' : ''}`}>
                  <span className="font-semibold text-teal">{i + 1}</span> <span className="text-ink">{q.policy}</span> <span className="text-ink-3">· {q.heading}</span>
                  {focus === i + 1 && <span className="mt-1 block italic text-ink-2">“{q.quotes.join(' … ')}”</span>}
                </li>
              )
            })}
          </ol>
        )}
      </div>
      <button type="button" onClick={() => setOpen(!open)} className="mt-1.5 flex cursor-pointer items-center gap-1 px-2 text-[11.5px] text-ink-3 hover:text-ink">
        <Icon name={open ? 'CaretUp' : 'CaretDown'} size={11} /> How this answer was found · {(r.ms / 1000).toFixed(1)} s{r.model ? ` · ${r.model}` : ''}
      </button>
      {open && (
        <div className="mt-1.5 rounded-xl bg-card p-3 ring-1 ring-ink/[0.05] [animation:rise_400ms_cubic-bezier(0.16,1,0.3,1)]">
          <p className="text-[11px] text-ink-3">Top matches among {chunks.length} approved sections (BM25 keyword score). Below 4.0, the question goes straight to HR without calling the AI.</p>
          {r.retrieved.length === 0 && <p className="mt-2 text-[12px] text-ink-2">No section shares any meaningful word with the question.</p>}
          <ul className="mt-2 space-y-2">
            {r.retrieved.map((h) => {
              const max = Math.max(...r.retrieved.map((x) => x.score), 4)
              return (
                <li key={h.id} className="text-[12px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-ink">
                      {h.policy} · <span className="text-ink-2">{h.heading}</span>
                      {usedIds.has(h.id) && <span className="ml-1.5 rounded-full bg-teal-2 px-1.5 text-[10px] text-teal">cited</span>}
                    </span>
                    <span className="num shrink-0 text-ink-2">{h.score.toFixed(1)}</span>
                  </div>
                  <span className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-ground-2">
                    <span className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${h.score >= 4 ? 'bg-teal' : 'bg-ink/25'}`} style={{ transform: `scaleX(${h.score / max})` }} />
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-ink-3">matched: {h.matched.join(', ')}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function Inbox({ items, onClear }: { items: InboxItem[]; onClear: () => void }) {
  return (
    <div>
      <div className="flex items-start gap-3 rounded-2xl bg-ground p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-teal ring-1 ring-ink/[0.06]">
          <Icon name="UserCircle" size={19} />
        </span>
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Questions the assistant could not answer go to <span className="font-medium text-ink">{HR_CONTACT.name}</span>, {HR_CONTACT.role}, ext. {HR_CONTACT.ext} ({HR_CONTACT.hours}).
        </p>
      </div>
      {items.length === 0 ? (
        <p className="mt-6 text-center text-[13px] text-ink-3">Nothing handed over yet. Try asking about parking or the canteen.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-ink/[0.06]">
            {items.map((it, i) => (
              <li key={it.at + i} className="py-3 [animation:rise_400ms_cubic-bezier(0.16,1,0.3,1)]">
                <p className="text-[13.5px] text-ink">“{it.q}”</p>
                <p className="mt-0.5 text-[11.5px] text-ink-3">
                  {new Date(it.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · {it.reason}
                </p>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onClear} className="mt-2 cursor-pointer text-[11.5px] text-ink-3 underline underline-offset-4 hover:text-ink">
            Clear inbox
          </button>
        </>
      )}
    </div>
  )
}

function Topics({ asked }: { asked: Asked[] }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of asked) m.set(a.topic, (m.get(a.topic) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [asked])
  const answered = asked.filter((a) => a.mode !== 'handover').length
  if (!asked.length) return <p className="mt-6 text-center text-[13px] text-ink-3">Ask a few questions; this shows which policies staff ask about most, and what HR still has to answer.</p>
  const max = counts[0][1]
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-ground p-3.5">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{asked.length}</p>
          <p className="text-[11.5px] text-ink-3">questions asked</p>
        </div>
        <div className="rounded-2xl bg-ground p-3.5">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{Math.round((answered / asked.length) * 100)}%</p>
          <p className="text-[11.5px] text-ink-3">answered without HR</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {counts.map(([t, c]) => (
          <li key={t}>
            <div className="flex justify-between text-[12.5px]">
              <span className={t.startsWith('Not covered') ? 'text-risk' : 'text-ink'}>{t}</span>
              <span className="num text-ink-2">{c}</span>
            </div>
            <span className="relative mt-1 block h-2 overflow-hidden rounded-full bg-ground-2">
              <span className={`absolute inset-y-0 left-0 w-full origin-left rounded-r-[4px] transition-transform duration-700 ${EASE} ${t.startsWith('Not covered') ? 'bg-risk' : 'bg-teal'}`} style={{ transform: `scaleX(${c / max})` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-ink-3">Stored in this browser only, for the demo.</p>
    </div>
  )
}

function Docs({ cited }: { cited: string[] }) {
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    if (cited.length) setOpen(cited[0].split('-')[0])
  }, [cited])
  return (
    <div>
      <p className="mb-3 text-[12px] leading-relaxed text-ink-3">Sample policy text for this demo. In use, HR supplies and approves these documents, and reviews the answers.</p>
      <ul className="space-y-2">
        {policies.map((p) => {
          const isOpen = open === p.id
          const hits = p.sections.filter((_, i) => cited.includes(`${p.id}-${i + 1}`)).length
          return (
            <li key={p.id} className="rounded-2xl bg-ground ring-1 ring-ink/[0.04]">
              <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-3 text-left">
                <span>
                  <span className="block text-[13.5px] font-medium">{p.title}</span>
                  <span className="block text-[11px] text-ink-3">
                    {p.sections.length} sections · {p.owner} · {p.version}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {hits > 0 && <span className="rounded-full bg-teal px-2 py-0.5 text-[10px] font-medium text-white">cited</span>}
                  <Icon name={isOpen ? 'Minus' : 'Plus'} size={14} />
                </span>
              </button>
              {isOpen && (
                <ol className="space-y-2.5 px-3.5 pb-3.5 [animation:rise_400ms_cubic-bezier(0.16,1,0.3,1)]">
                  {p.sections.map((s, i) => {
                    const on = cited.includes(`${p.id}-${i + 1}`)
                    return (
                      <li key={s.heading} className={`rounded-xl p-3 text-[12.5px] leading-relaxed ${on ? 'bg-teal-2 ring-1 ring-teal/25' : 'bg-card'}`}>
                        <span className="block font-medium text-ink">{s.heading}</span>
                        <span className="mt-1 block text-ink-2">{s.text}</span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
