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
      <div className="rounded-[calc(2rem-0.375rem)] bg-card p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_30px_60px_-30px_rgba(0,0,0,0.2)] md:p-7">
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
    ['Duplicate challans', '2 challans billed twice', '4.8'],
    ['Short supply at the gate', '4 loads short beyond 0.5%', '2.2'],
    ['Billed above PO rate', '5 cement challans, ₹24/bag', '0.5'],
  ]
  const over = [
    ['Steel', 'Wing B', '7.2 MT beyond allowance', '4.5'],
    ['Cement', 'Wing A', '620 bags beyond allowance', '2.3'],
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
        <div className="overflow-hidden rounded-[calc(2.75rem-0.5rem)] bg-[#eeeeec]">
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
            <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 text-[12.5px] leading-relaxed text-ink shadow-[0_4px_14px_-8px_rgba(0,0,0,0.3)]">
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
            <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 text-[12.5px] leading-relaxed text-ink shadow-[0_4px_14px_-8px_rgba(0,0,0,0.3)]">
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

export function StockSheet() {
  const sites = [
    ['Baner', 'TMT 16 mm', '+30 MT', 'excess'],
    ['Chakan', 'TMT 16 mm', '−24 MT by 18 Nov', 'short'],
    ['Kharadi', 'OPC 53 (wk 36)', '+340 bags', 'excess'],
    ['Wagholi', 'OPC 53', '−300 bags by 14 Nov', 'short'],
    ['Hinjewadi', 'AAC blocks', '+1,800 nos', 'excess'],
    ['Nashik', 'Tile adhesive', '−60 bags', 'short'],
  ]
  return (
    <Plate title="Stock balance · week 45 · 6 sites" sub="Cross-Site Stock Balance">
      <div className="grid grid-cols-3 gap-3 pt-5">
        {[
          ['Excess', '₹31.2 L', 'bg-ochre-2/70 text-ochre'],
          ['Short, 4 weeks', '₹22.4 L', 'bg-rust/10 text-rust'],
          ['To buy', '₹5.3 L', 'bg-sage-2/60 text-sage'],
        ].map(([a, b, t]) => (
          <div key={a} className={`rounded-2xl p-3.5 ${t.split(' ')[0]}`}>
            <p className={`text-[10px] uppercase tracking-[0.14em] ${t.split(' ')[1]}`}>{a}</p>
            <p className="num mt-1 text-lg text-ink md:text-xl">{b}</p>
          </div>
        ))}
      </div>
      <ul className="mt-5 divide-y divide-ink/[0.06] text-sm">
        {sites.map(([a, b, c, k]) => (
          <li key={a} className="flex items-center justify-between gap-4 py-2.5">
            <span>
              <span className="text-ink">{a}</span>
              <span className="block text-xs text-ink-3">{b}</span>
            </span>
            <span className={`num text-[13px] ${k === 'short' ? 'text-rust' : 'text-ochre'}`}>{c}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-ink-3">Who sends what to whom</p>
      <ul className="mt-2 space-y-2 text-sm">
        {[
          ['Baner → Chakan', '24 MT steel · 40 km', '₹14.9 L'],
          ['Kharadi → Wagholi', '300 bags, oldest first · 18 km', '₹1.1 L'],
          ['Hinjewadi → Kharadi', '1,800 AAC blocks · 28 km', '₹1.1 L'],
        ].map(([a, b, c]) => (
          <li key={a} className="flex items-center justify-between gap-4 rounded-2xl bg-sage-2/50 px-4 py-2.5">
            <span>
              <span className="flex items-center gap-1.5 text-ink">
                <Icon name="ArrowsLeftRight" size={14} className="text-sage" /> {a}
              </span>
              <span className="block text-xs text-ink-3">{b}</span>
            </span>
            <span className="num text-ink">{c}</span>
          </li>
        ))}
      </ul>
    </Plate>
  )
}

export function WastageTable() {
  const rows = [
    ['A', 'Floor 7', 'Cement', '42 bags', '₹15,120'],
    ['A', 'Floor 7', 'Steel', '0.2 MT', '₹12,400'],
    ['B', 'Floor 5', 'Steel', '0.5 MT', '₹31,000'],
    ['D', 'Floor 6', 'RMC', '1.1 m³', '₹7,150'],
    ['C', 'Floor 8', 'Cement', 'within', '—'],
  ]
  const rank = [
    ['B', 31000],
    ['A', 27520],
    ['D', 7150],
    ['C', 0],
  ] as const
  return (
    <Plate title="Wastage over the limit · Tower C · October" sub="Supervisor-wise Wastage">
      <div className="pt-5">
        <p className="display text-5xl text-ink">₹65,670</p>
        <p className="mt-1 text-sm text-ink-2">over the allowed wastage · cement 2%, steel 3%, RMC 1.5%</p>
      </div>
      <div className="mt-5 space-y-2.5">
        {rank.map(([n, v]) => (
          <div key={n} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm">
            <span className="text-ink">Supervisor {n}</span>
            <span className="h-2 overflow-hidden rounded-full bg-paper-2">
              <span className={`block h-full rounded-full ${v ? 'bg-rust/70' : 'bg-sage'}`} style={{ width: `${v ? Math.max((v / 31000) * 100, 6) : 4}%` }} />
            </span>
            <span className={`num text-right text-[13px] ${v ? 'text-ink' : 'text-sage'}`}>{v ? `₹${v.toLocaleString('en-IN')}` : 'within'}</span>
          </div>
        ))}
      </div>
      <table className="mt-6 w-full text-left text-[13px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
            <th className="pb-2 font-normal">Sup.</th>
            <th className="pb-2 font-normal">Floor</th>
            <th className="pb-2 font-normal">Material</th>
            <th className="pb-2 text-right font-normal">Over</th>
            <th className="pb-2 text-right font-normal">₹</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/[0.06]">
          {rows.map((r) => (
            <tr key={r.join()} className="text-ink">
              {r.map((c, i) => (
                <td key={i} className={`py-2 ${i >= 3 ? 'num text-right' : ''} ${c === 'within' ? 'text-sage' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-ink-3">Every line opens to its issue slips. Valued at the PO rate.</p>
    </Plate>
  )
}

export function InspectionReport() {
  const parts = [
    ['Documents', 12, 14],
    ['Labour camp', 15, 18],
    ['Stores yard', 10, 10],
    ['Batching plant / RMC', 11, 12],
    ['Formwork', 9, 9],
    ['Safety', 21, 23],
  ] as const
  return (
    <Plate title="First inspection · Tower B" sub="One-day Site Opening">
      <div className="flex items-end justify-between gap-4 pt-5">
        <div>
          <p className="display text-5xl text-ink">78 / 86</p>
          <p className="mt-1 text-sm text-ink-2">lines pass · 8 open, none stops work</p>
        </div>
        <Tag tone="sage">Draft · 6:04 PM</Tag>
      </div>
      <div className="mt-6 space-y-3">
        {parts.map(([n, a, b]) => (
          <div key={n} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="text-ink">{n}</span>
            <span className="h-2 overflow-hidden rounded-full bg-paper-2">
              <span className={`block h-full rounded-full ${a === b ? 'bg-sage' : 'bg-ochre'}`} style={{ width: `${(a / b) * 100}%` }} />
            </span>
            <span className="num text-right text-[13px] text-ink-2">
              {a}/{b}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-ink-3">Open items · closed later on photos</p>
      <ul className="mt-2 divide-y divide-ink/[0.06] text-sm">
        {[
          ['Line 3 · CAR insurance', 'Policy ₹42 Cr, contract ₹58 Cr', 'Renewal asked'],
          ['Line 14 · Camp toilets', '6 of 9, photo 9:52 AM', 'Thursday'],
          ['Line 71 · Fire extinguishers', 'Stores, not tagged, photo 2:31 PM', 'Thursday'],
        ].map(([a, b, c]) => (
          <li key={a} className="flex items-center justify-between gap-4 py-2.5">
            <span className="flex items-start gap-2">
              <Icon name="Image" size={16} className="mt-0.5 shrink-0 text-ink-3" />
              <span>
                <span className="text-ink">{a}</span>
                <span className="block text-xs text-ink-3">{b}</span>
              </span>
            </span>
            <Tag tone="ochre">{c}</Tag>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-3">
        <Icon name="MapPin" size={13} /> 86 photos, each tagged to a line with time and location
      </p>
    </Plate>
  )
}
