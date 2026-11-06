'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/icons'
import { RunButton, useRun } from './Run'
import type { Chat } from '@/content/chats'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

// After a run finishes: each person's part is "sent", then the phone plays the thread,
// where that person asks follow-up questions and Vera answers from the records.
export function RunChat({ chat, compact = false }: { chat: Chat; compact?: boolean }) {
  const r = useRun()
  const done = r?.phase === 'done'
  const [count, setCount] = useState(0)
  const [ms, setMs] = useState(1)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMs(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1)
  }, [])

  // Reset when a new run starts.
  useEffect(() => {
    if (!done) setCount(0)
  }, [done])

  useEffect(() => {
    if (!done || count >= chat.msgs.length) return
    const next = chat.msgs[count]
    const wait = count === 0 ? 1200 + chat.routes.length * 180 : next.from === 'vera' ? 1700 : 1300
    const t = setTimeout(() => setCount((c) => c + 1), wait * ms)
    return () => clearTimeout(t)
  }, [done, count, chat, ms])

  useEffect(() => {
    const el = box.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [count])

  const typing = done && count < chat.msgs.length && chat.msgs[count].from === 'vera'

  const phoneEl = (
    <>
      <div className="mx-auto w-full max-w-[340px] md:w-[340px]">
        <div className="rounded-[2.75rem] bg-ink p-2 shadow-[0_50px_100px_-40px_rgba(30,20,10,0.55)] ring-1 ring-black/40">
          <div className="flex h-[600px] flex-col overflow-hidden rounded-[calc(2.75rem-0.5rem)] bg-[#efe7d9]">
            <div className="flex shrink-0 items-center gap-3 bg-[#1f3a33] px-5 pb-3 pt-6 text-paper">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper/15">
                <Icon name="Sparkle" size={14} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{chat.phone.who}</span>
                <span className="block truncate text-[10px] text-paper/60">{typing ? 'typing…' : chat.phone.sub}</span>
              </span>
            </div>
            <div ref={box} className="flex-1 space-y-2 overflow-y-auto p-3 [scrollbar-width:none]">
              {count === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-xs text-ink-3">
                  <Icon name="ChatCircleDots" size={28} />
                  {done ? 'Sending…' : 'Messages arrive here when the run finishes.'}
                </div>
              )}
              {chat.msgs.slice(0, count).map((m, i) => (
                <div key={i} className={`flex [animation:type-in_500ms_cubic-bezier(0.16,1,0.3,1)] ${m.from === 'them' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink shadow-[0_4px_14px_-8px_rgba(60,40,20,0.3)] ${
                      m.from === 'them' ? 'rounded-tr-md bg-[#d9f2c9]' : 'rounded-tl-md bg-card'
                    }`}
                  >
                    {m.text}
                    {m.files && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {m.files.map((f) => (
                          <span key={f} className="inline-flex items-center gap-1 rounded-lg bg-paper-2 px-2 py-1 text-[11px] text-ink-2">
                            <Icon name={/\.xlsx|\.csv/.test(f) ? 'FileXls' : 'FilePdf'} size={13} className="text-rust" /> {f}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {typing && count > 0 && (
                <div className="flex justify-start">
                  <span className="flex gap-1 rounded-2xl rounded-tl-md bg-card px-3.5 py-3">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-3 [animation:dot_1.2s_cubic-bezier(0.32,0.72,0,1)_infinite]" style={{ animationDelay: `${i * 160}ms` }} />
                    ))}
                  </span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-ink/[0.06] bg-[#efe7d9] px-3 py-2.5">
              <span className="flex-1 rounded-full bg-card px-4 py-2 text-[12px] text-ink-3">Ask Vera anything…</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f3a33] text-paper">
                <Icon name="Microphone" size={14} />
              </span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-ink-3">Illustration · sample data</p>
      </div>
    </>
  )

  if (compact)
    return (
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">Who hears about it, on WhatsApp</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {chat.routes.map((x, i) => (
            <li
              key={x.role}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] ring-1 transition-all duration-700 ${EASE} ${done ? 'bg-sage-2 text-ink ring-sage/30' : 'bg-card text-ink-2 ring-ink/10'}`}
              style={{ transitionDelay: done ? `${i * 180}ms` : '0ms' }}
              title={x.gets}
            >
              <Icon name={done ? 'Checks' : x.icon} size={14} className={done ? 'text-sage' : 'text-ink-3'} /> {x.role}
            </li>
          ))}
        </ul>
        <div className="mt-8">{phoneEl}</div>
      </div>
    )

  return (
    <div className="grid gap-12 md:grid-cols-[1fr_auto] md:items-start md:gap-16">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">After the run · who hears about it</p>
        <h3 className="display mt-4 text-3xl leading-[1.05] text-ink md:text-4xl">Each person gets their part, on WhatsApp. Then they can ask.</h3>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
          Nobody has to read the whole report. Vera sends each person only what they act on. They reply with a question and get the answer from the same records, with the slip or challan attached. If the record is not there, Vera says so and asks the site.
        </p>

        <ol className="mt-8 divide-y divide-ink/[0.07] border-y border-ink/[0.07]">
          {chat.routes.map((x, i) => (
            <li key={x.role} className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-4 py-4">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 transition-all duration-700 ${EASE} ${done ? 'bg-sage-2 text-sage ring-sage/30' : 'bg-card text-ink-3 ring-ink/10'}`}
                style={{ transitionDelay: done ? `${i * 180}ms` : '0ms' }}
              >
                <Icon name={x.icon} size={18} />
              </span>
              <span>
                <span className="block text-[15px] font-medium text-ink">{x.role}</span>
                <span className="block text-sm leading-relaxed text-ink-2">{x.gets}</span>
                <span className="mt-0.5 block text-xs text-ink-3">{x.when}</span>
              </span>
              <span
                className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-all duration-700 ${EASE} ${done ? 'bg-sage-2 text-sage opacity-100' : 'bg-paper-2 text-ink-3 opacity-70'}`}
                style={{ transitionDelay: done ? `${i * 180}ms` : '0ms' }}
              >
                {done ? <><Icon name="Checks" size={12} /> Sent</> : 'Waiting'}
              </span>
            </li>
          ))}
        </ol>
        {!done && r?.phase === 'idle' && (
          <div className="mt-8">
            <RunButton />
          </div>
        )}
      </div>

      {phoneEl}
    </div>
  )
}
