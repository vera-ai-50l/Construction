'use client'

import { useEffect, useState } from 'react'
import { Icon } from '../ui/icons'

// Hero: a site message on the left becomes a structured record on the right, on a loop.
const SCENES = [
  {
    from: 'Sunil · Kharadi',
    kind: 'Voice note · 0:42',
    icon: 'Microphone',
    text: '“Aaj Ramesh ki team ke 34 log aaye hain aur Sai ke steel waale 22 log. Teesre floor ka slab shuttering 70% ho gaya.”',
    rows: [
      ['Labour', 'Ramesh 34 · Sai 22'],
      ['Progress', 'Slab L3 shuttering 70%'],
      ['Record', 'Kharadi DPR · 07:48'],
    ],
    flag: { tone: 'sage', text: 'Logged to the daily record' },
  },
  {
    from: 'Sunil · Kharadi',
    kind: 'Challan photo',
    icon: 'Receipt',
    text: 'DECCAN CEMENT AGENCIES · Challan DCA/4471 · OPC 53 · 400 Bags',
    rows: [
      ['Received', 'Cement 400 bags'],
      ['Matched', 'PO/KH/118 · rate ₹380'],
      ['Tally', 'Receipt note ready'],
    ],
    flag: { tone: 'sage', text: 'PO matched' },
  },
  {
    from: 'Vikas · Hinjewadi',
    kind: 'Text · Marathi',
    icon: 'ChatCircleText',
    text: '“क्रेन ४ तास बंद होती. १६ जण बसून होते.”',
    rows: [
      ['Hindrance', 'Crane breakdown · 4 h'],
      ['Idle', '16 people'],
      ['Cost', '16 × 4/8 × ₹750 = ₹6,000'],
    ],
    flag: { tone: 'rust', text: 'Added to money at risk' },
  },
]

export function HeroVisual() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SCENES.length), 4200)
    return () => clearInterval(t)
  }, [])
  const s = SCENES[i]
  return (
    <div className="relative">
      <div className="rounded-[2.25rem] bg-ink/[0.035] p-1.5 ring-1 ring-ink/[0.06]">
        <div className="overflow-hidden rounded-[calc(2.25rem-0.375rem)] bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_40px_80px_-40px_rgba(0,0,0,0.25)]">
          {/* WhatsApp side */}
          <div className="bg-[#eeeeec] px-5 pb-5 pt-4 md:px-6">
            <div className="flex items-center justify-between text-[11px] text-ink-3">
              <span className="flex items-center gap-2">
                <Icon name="WhatsappLogo" size={14} /> Site group · today
              </span>
              <span className="num">{['07:48', '09:15', '12:40'][i]}</span>
            </div>
            <div key={i} className="mt-4 max-w-[92%] rounded-2xl rounded-tl-md bg-card px-4 py-3 shadow-[0_6px_18px_-10px_rgba(0,0,0,0.25)] [animation:type-in_700ms_cubic-bezier(0.16,1,0.3,1)]">
              <div className="flex items-center gap-2 text-[11px] font-medium text-sage">
                <Icon name={s.icon} size={13} /> {s.from} · <span className="font-normal text-ink-3">{s.kind}</span>
              </div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{s.text}</p>
            </div>
          </div>
          {/* Vera side */}
          <div className="relative px-5 pb-6 pt-5 md:px-6">
            <div className="absolute -top-3 left-1/2 flex h-6 -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-paper">
              <Icon name="Sparkle" size={11} /> Vera reads it
            </div>
            <dl key={'r' + i} className="mt-2 divide-y divide-ink/[0.06]">
              {s.rows.map(([k, v], j) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-4 py-2.5 opacity-0 [animation:type-in_700ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
                  style={{ animationDelay: `${350 + j * 220}ms` }}
                >
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-ink-3">{k}</dt>
                  <dd className="num text-right text-[14px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div
              key={'f' + i}
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium opacity-0 [animation:type-in_700ms_cubic-bezier(0.16,1,0.3,1)_1100ms_forwards] ${s.flag.tone === 'rust' ? 'bg-rust/10 text-rust' : 'bg-sage-2 text-sage'}`}
            >
              <Icon name={s.flag.tone === 'rust' ? 'Warning' : 'CheckCircle'} size={13} /> {s.flag.text}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
        {SCENES.map((_, j) => (
          <span key={j} className={`h-1 rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${j === i ? 'w-8 bg-ink' : 'w-3 bg-ink/15'}`} />
        ))}
      </div>
    </div>
  )
}
