import { Icon } from '../ui/icons'

// Illustrative outputs, one per desk. Static pictures of what the client receives.

function Tag({ tone, children }: { tone: 'High' | 'Medium' | 'Check' | 'sage' | 'rust' | 'ochre'; children: React.ReactNode }) {
  const t =
    tone === 'High' || tone === 'sage'
      ? 'bg-sage-2 text-sage'
      : tone === 'Medium' || tone === 'ochre'
        ? 'bg-ochre-2 text-ochre'
        : 'bg-rust/10 text-rust'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${t}`}>{children}</span>
}

function Plate({ children, title, sub }: { children: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="rounded-[2rem] bg-ink/[0.035] p-1.5 ring-1 ring-ink/[0.06]">
      <div className="rounded-[calc(2rem-0.375rem)] bg-card p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_30px_60px_-30px_rgba(60,40,20,0.2)] md:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-ink/[0.06] pb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-3">{sub}</p>
            <p className="mt-1 text-[15px] font-medium text-ink">{title}</p>
          </div>
          <span className="rounded-full bg-paper-2 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-ink-3">Illustration</span>
        </div>
        {children}
      </div>
    </div>
  )
}

export function LeakSummary() {
  const groups = [
    ['Duplicate challans', '2 challans billed twice', '4.9'],
    ['Short supply at the gate', '4 loads short beyond 0.5%', '2.2'],
    ['Billed above PO rate', '5 cement challans, ₹24/bag', '0.5'],
  ]
  const over = [
    ['Steel', 'Wing B', '7.2 MT beyond allowance', '4.5'],
    ['Cement', 'Wing A', '620 bags beyond allowance', '2.4'],
    ['AAC blocks', 'Wing B', '2,850 nos beyond allowance', '1.8'],
  ]
  return (
    <Plate title="Material Leak Check · Jul–Sep" sub="1-page summary">
      <div className="grid grid-cols-2 gap-4 pt-5">
        <div className="col-span-2">
          <p className="display text-5xl text-ink md:text-6xl">₹16.1 L</p>
          <p className="mt-1 text-sm text-ink-2">leaking · 6.3% of ₹2.57 Cr bought · ₹64 L a year at this rate</p>
        </div>
        <div className="rounded-2xl bg-sage-2/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-sage">Recover from suppliers</p>
          <p className="num mt-1 text-2xl text-ink">₹7.5 L</p>
        </div>
        <div className="rounded-2xl bg-ochre-2/70 p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ochre">Stop on site</p>
          <p className="num mt-1 text-2xl text-ink">₹8.6 L</p>
        </div>
      </div>
      <ul className="mt-5 divide-y divide-ink/[0.06] text-sm">
        {groups.map(([a, b, c]) => (
          <li key={a} className="flex items-center justify-between gap-4 py-2.5">
            <span>
              <span className="text-ink">{a}</span>
              <span className="block text-xs text-ink-3">{b}</span>
            </span>
            <span className="num text-ink">₹{c} L</span>
          </li>
        ))}
        {over.map(([m, w, d, v]) => (
          <li key={m} className="flex items-center justify-between gap-4 py-2.5">
            <span>
              <span className="text-ink">{m} overuse · {w}</span>
              <span className="block text-xs text-ink-3">{d}</span>
            </span>
            <span className="num text-ink">₹{v} L</span>
          </li>
        ))}
      </ul>
    </Plate>
  )
}

export function BriefPhone() {
  const risks = [
    ['Kharadi', 'RA-07 unpaid for 41 days', '₹44.1 L'],
    ['Hinjewadi', 'RA-04 returned: JMR not signed', '₹18.6 L'],
    ['Nashik', 'Sand 6 brass with no PO', '₹46,800'],
    ['Kharadi', '60 bags left, 220 needed tomorrow', '₹42,000'],
    ['Baner', 'No report yesterday', '₹15,000'],
  ]
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="rounded-[2.75rem] bg-ink p-2 shadow-[0_50px_100px_-40px_rgba(30,20,10,0.55)] ring-1 ring-black/40">
        <div className="overflow-hidden rounded-[calc(2.75rem-0.5rem)] bg-[#efe7d9]">
          <div className="flex items-center gap-3 bg-[#1f3a33] px-5 pb-3 pt-6 text-paper">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper/15">
              <Icon name="Sparkle" size={14} />
            </span>
            <span>
              <span className="block text-[13px] font-medium">Vera · Site brief</span>
              <span className="block text-[10px] text-paper/60">today, 8:00 AM</span>
            </span>
          </div>
          <div className="space-y-2 p-3">
            <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 text-[12.5px] leading-relaxed text-ink shadow-[0_4px_14px_-8px_rgba(60,40,20,0.3)]">
              <p className="font-semibold">Fri, 6 Nov (for Thu, 5 Nov)</p>
              <p className="mt-1.5">
                <b>3 of 4 sites reported</b> · 102 people · 13/15 messages read
              </p>
              <p className="mt-1 text-rust">⚠ Baner Office Fit-out: no report</p>
              <p className="mt-2.5 font-semibold">Money at risk: ₹63.8 L</p>
              <ol className="mt-1 space-y-1">
                {risks.map(([s, t, v], i) => (
                  <li key={t} className="flex gap-1.5">
                    <span className="num text-ink-3">{i + 1}.</span>
                    <span>
                      {s}: {t}, <b className="num whitespace-nowrap">{v}</b>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 text-[12.5px] leading-relaxed text-ink shadow-[0_4px_14px_-8px_rgba(60,40,20,0.3)]">
              <p className="font-semibold">Sites</p>
              <p className="mt-1">• <b>Kharadi</b>: 56 people. Slab L3 shuttering 70%. Cement 400 bags in.</p>
              <p>• <b>Hinjewadi</b>: 16 people. PEB frames 18/24. Crane down 4 h.</p>
              <p>• <b>Nashik</b>: 30 people. PCC 61%. Client drawing pending.</p>
            </div>
            <div className="ml-auto w-max rounded-2xl rounded-tr-md bg-[#d9f2c9] px-3 py-2 text-[12.5px] text-ink">Call Sunrise accounts at 10 👍</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DebitNote() {
  const lines: [string, string, string, 'High' | 'Medium' | 'Check'][] = [
    ['Cement excess · RA-01', '76 bags × ₹365 × 1.25, less ₹31,937.50 taken in RA-02', '₹2,737.50', 'High'],
    ['Cement excess · RA-02', '129 bags × ₹365 × 1.25 · slips FI/TC/0121–0138', '₹58,856.25', 'High'],
    ['Steel excess · RA-03', '3.054 MT × ₹58,500 × 1.25 · BBS-TC-L9, L10', '₹2,23,323.75', 'High'],
    ['Steel scrap not returned · RA-01–03', '3.523 MT × ₹34,000 · weighbridge WB/2207, 2291', '₹1,19,782.00', 'High'],
    ['Cement excess · RA-03', '2 unsigned slips · lintels certified beyond BOQ', '₹54,750.00', 'Check'],
  ]
  return (
    <Plate title="Draft debit note · to deduct in RA-04" sub="Recovery pack · one contractor">
      <ul className="divide-y divide-ink/[0.06] pt-2">
        {lines.map(([a, b, c, t]) => (
          <li key={a} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3">
            <span className="text-sm text-ink">{a}</span>
            <span className="num text-right text-sm text-ink">{c}</span>
            <span className="text-xs leading-relaxed text-ink-3">{b}</span>
            <span className="text-right">
              <Tag tone={t}>{t}</Tag>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-paper-2/70 p-3 text-center">
        {[
          ['High', '₹4,04,699.50'],
          ['Medium', '₹0'],
          ['Check', '₹54,750'],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-ink-3">{k}</p>
            <p className="num mt-0.5 text-sm text-ink">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-3">Check lines need the contractor’s acknowledgement before deduction. CSV for the bill attached.</p>
    </Plate>
  )
}

export function Comparison() {
  const rows = [
    ['Cement', 'Contractor A', 16.6, 2.5],
    ['Cement', 'Contractor B', 4.6, 3],
    ['Steel', 'Contractor A', 5.7, 3],
    ['Steel', 'Contractor B', 2.3, 3],
  ] as const
  return (
    <Plate title="Wastage by contractor vs contract allowance" sub="Contractor comparison">
      <ul className="space-y-4 pt-5">
        {rows.map(([m, c, w, a]) => {
          const over = w > a
          return (
            <li key={m + c}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink">
                  {m} · <span className="text-ink-2">{c}</span>
                </span>
                <span className={`num ${over ? 'text-rust' : 'text-sage'}`}>
                  {w}% <span className="text-ink-3">/ {a}% allowed</span>
                </span>
              </div>
              <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-paper-2">
                <div className={`h-full origin-left rounded-full ${over ? 'bg-rust' : 'bg-sage'}`} style={{ transform: `scaleX(${Math.min(w / 18, 1)})` }} />
                <div className="absolute top-0 h-full w-px bg-ink/50" style={{ left: `${(a / 18) * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </Plate>
  )
}

export function PlantBoard() {
  const rows: [string, string, string, string, 'rust' | 'ochre' | 'sage'][] = [
    ['Wrench', 'Transit mixer TM-04 · Kharadi', '262 h since service · interval 250 h', 'Overdue', 'rust'],
    ['Hourglass', 'Hired backhoe · Nashik', 'Idle 9 days at ₹2,800/day', 'Off-hire: save ₹25,200', 'rust'],
    ['ArrowsLeftRight', 'Concrete pump · Hinjewadi', 'Idle; Kharadi plans to hire one on 12 Nov', 'Move instead', 'ochre'],
    ['Stack', 'Cup-lock ledgers 1.5 m · Baner', 'Sent 1,200 · back 1,086 · in use 0', '114 short', 'rust'],
    ['Certificate', 'Tower crane TC-2 · load test', 'Expires in 12 days', 'Book inspection', 'ochre'],
    ['Gauge', 'DG 125 kVA · Kharadi', '3.9 L/h vs 3.1 L/h norm', 'Check diesel', 'ochre'],
    ['CheckCircle', 'Batching plant · Kharadi', 'Serviced 3 days ago', 'OK', 'sage'],
  ]
  return (
    <Plate title="Plant brief · Monday 8 AM" sub="Plant & Formwork Desk">
      <ul className="divide-y divide-ink/[0.06] pt-1">
        {rows.map(([ic, a, b, c, t]) => (
          <li key={a} className="flex items-start gap-3 py-3">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t === 'rust' ? 'bg-rust/10 text-rust' : t === 'ochre' ? 'bg-ochre-2 text-ochre' : 'bg-sage-2 text-sage'}`}>
              <Icon name={ic} size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">{a}</span>
              <span className="block text-xs text-ink-3">{b}</span>
            </span>
            <Tag tone={t}>{c}</Tag>
          </li>
        ))}
      </ul>
    </Plate>
  )
}

export function SurplusMatch() {
  return (
    <Plate title="Transfer suggestion · this week" sub="Surplus Stock Exchange">
      <div className="grid gap-3 pt-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="rounded-2xl bg-paper-2/70 p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-3">Baner · closing</p>
          <p className="num mt-1 text-xl text-ink">340 bags OPC 53</p>
          <p className="mt-1 text-xs text-ink-3">Made week 36 · 68 days old</p>
          <Tag tone="ochre">Use first</Tag>
        </div>
        <div className="flex items-center justify-center gap-2 text-ink-3 md:flex-col">
          <Icon name="ArrowsLeftRight" size={20} />
          <span className="num text-[11px]">12 km · ₹3,400</span>
        </div>
        <div className="rounded-2xl bg-paper-2/70 p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-3">Kharadi · slab L4</p>
          <p className="num mt-1 text-xl text-ink">needs 220 bags</p>
          <p className="mt-1 text-xs text-ink-3">PR/KH/233 raised yesterday</p>
          <Tag tone="rust">Hold the PO</Tag>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-sage-2/60 px-4 py-3">
        <span className="text-sm text-ink">Saving after transport</span>
        <span className="num text-lg text-ink">₹80,200</span>
      </div>
      <ul className="mt-4 divide-y divide-ink/[0.06] text-sm">
        {[
          ['TMT 12 mm · Baner', '6.2 MT over the next 8 weeks’ need', '₹3.8 L'],
          ['Tile adhesive · Nashik', '42 bags, expiry in 5 weeks', '₹21,000'],
          ['AAC blocks · Hinjewadi', '1,800 nos, no masonry planned', '₹1.1 L'],
        ].map(([a, b, c]) => (
          <li key={a} className="flex items-center justify-between gap-4 py-2.5">
            <span>
              <span className="text-ink">{a}</span>
              <span className="block text-xs text-ink-3">{b}</span>
            </span>
            <span className="num text-ink">{c}</span>
          </li>
        ))}
      </ul>
    </Plate>
  )
}
