'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bezel } from './ui/Bezel'
import { Icon } from './ui/icons'
import {
  dayLabel,
  morningMessage,
  parseCsv,
  sampleWeek,
  SHIFT_TIME,
  SHIFTS,
  STATUS_LABEL,
  summarize,
  toCsv,
  TODAY,
  WARDS,
  WEEK,
  type Entry,
  type Shift,
  type Status,
  type Ward,
  type WardSummary,
} from '@/lib/staffing'

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'
const CYCLE: Status[] = ['present', 'late', 'absent', 'leave', 'unmarked']

const STATE: Record<WardSummary['state'], { label: string; chip: string; dot: string; icon: string }> = {
  below: { label: 'Below minimum', chip: 'bg-below-2 text-below', dot: 'bg-below', icon: 'WarningCircle' },
  risk: { label: 'Waiting on marks', chip: 'bg-risk-2 text-risk', dot: 'bg-risk', icon: 'Clock' },
  ok: { label: 'Cover met', chip: 'bg-ok-2 text-ok', dot: 'bg-ok', icon: 'CheckCircle' },
  future: { label: 'Not started', chip: 'bg-ink/[0.05] text-ink-3', dot: 'bg-ink/20', icon: 'HourglassMedium' },
  norule: { label: 'No rule set', chip: 'bg-ink/[0.05] text-ink-3', dot: 'bg-ink/20', icon: 'Question' },
}
const STATUS_CHIP: Record<Status, string> = {
  present: 'bg-ok-2 text-ok ring-ok/20',
  late: 'bg-risk-2 text-risk ring-risk/25',
  absent: 'bg-below-2 text-below ring-below/25',
  leave: 'bg-below-2/60 text-below ring-below/15',
  unmarked: 'bg-card text-ink-3 ring-ink/15 border-dashed',
}

export function StaffingBoard() {
  const [entries, setEntries] = useState<Entry[]>(() => sampleWeek())
  const [source, setSource] = useState<{ kind: 'sample' } | { kind: 'upload'; name: string }>({ kind: 'sample' })
  const [date, setDate] = useState(TODAY)
  const [shift, setShift] = useState<Shift>('Morning')
  const [open, setOpen] = useState<string | null>('ICU')
  const [edits, setEdits] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const live = source.kind === 'sample'

  const dates = useMemo(() => (live ? WEEK : [...new Set(entries.map((e) => e.date))].sort().slice(-7)), [entries, live])
  const wards: Ward[] = useMemo(() => {
    const known = new Set(WARDS.map((w) => w.id))
    const extra = [...new Set(entries.map((e) => e.ward))].filter((w) => !known.has(w)).map((id) => ({ id, name: id, rule: { Morning: {}, Evening: {}, Night: {} } }))
    return [...WARDS.filter((w) => entries.some((e) => e.ward === w.id)), ...extra]
  }, [entries])
  const summaries = useMemo(() => summarize(entries, date, shift, wards, live), [entries, date, shift, wards, live])
  const message = useMemo(() => morningMessage(summaries, date, shift), [summaries, date, shift])
  const counts = { below: summaries.filter((s) => s.state === 'below').length, risk: summaries.filter((s) => s.state === 'risk').length }

  function cycle(e: Entry) {
    setEntries((all) => all.map((x) => (x === e ? { ...x, status: CYCLE[(CYCLE.indexOf(x.status) + 1) % CYCLE.length] } : x)))
    setEdits((n) => n + 1)
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    const { entries: rows, errors: errs } = parseCsv(await f.text())
    setErrors(errs)
    if (!rows.length) return
    const last = [...new Set(rows.map((r) => r.date))].sort().at(-1)!
    setEntries(rows)
    setSource({ kind: 'upload', name: f.name })
    setDate(last)
    setShift('Morning')
    setOpen(null)
  }

  function download() {
    const blob = new Blob([toCsv(sampleWeek())], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'white-lotus-sample-roster.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function reset() {
    setEntries(sampleWeek())
    setSource({ kind: 'sample' })
    setDate(TODAY)
    setShift('Morning')
    setErrors([])
    setEdits(0)
    setOpen('ICU')
  }

  return (
    <div>
      {/* Toolbar */}
      <Bezel inner="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:pb-0">
          {dates.map((d) => {
            const day = SHIFTS.flatMap((s) => summarize(entries, d, s, wards, live))
            const bad = day.filter((s) => s.state === 'below').length
            const on = d === date
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                className={`relative flex shrink-0 cursor-pointer flex-col items-start rounded-2xl px-3.5 py-2 text-left transition-all duration-500 ${EASE} ${on ? 'bg-ink text-white' : 'bg-ground hover:bg-ground-2'}`}
              >
                <span className={`text-[10px] uppercase tracking-[0.16em] ${on ? 'text-white/60' : 'text-ink-3'}`}>{d === TODAY && live ? 'Today' : dayLabel(d).split(' ')[0]}</span>
                <span className="text-[13px] font-medium">{dayLabel(d).split(' ').slice(1).join(' ')}</span>
                {bad > 0 && <span className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${on ? 'bg-[#ff8a9d]' : 'bg-below'}`} title={`${bad} below minimum`} />}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-ground p-1" role="tablist" aria-label="Shift">
            {SHIFTS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={shift === s}
                onClick={() => setShift(s)}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] transition-all duration-500 ${EASE} ${shift === s ? 'bg-card text-ink shadow-[0_4px_14px_-6px_rgba(16,40,40,0.35)]' : 'text-ink-3 hover:text-ink'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-3.5 py-2 text-[12.5px] font-medium text-white transition-transform duration-500 active:scale-[0.97]">
            <Icon name="UploadSimple" size={14} /> Try your roster (CSV)
          </button>
          <button type="button" onClick={download} className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] text-ink-2 ring-1 ring-ink/10 hover:bg-ground">
            <Icon name="DownloadSimple" size={14} /> Sample CSV
          </button>
          {(source.kind === 'upload' || edits > 0) && (
            <button type="button" onClick={reset} className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] text-ink-2 hover:bg-ground">
              <Icon name="ArrowCounterClockwise" size={14} /> Reset
            </button>
          )}
        </div>
      </Bezel>
      <p className="mt-3 px-2 text-[12px] text-ink-3">
        {source.kind === 'upload' ? (
          <>
            Showing <span className="text-ink">{source.name}</span>: {entries.length} rows. Wards not in the rule list show “No rule set”. Your file stays in this browser.
          </>
        ) : (
          <>
            Sample week, {entries.length.toLocaleString('en-IN')} shift records with staff IDs only. It is 7:25 AM on {dayLabel(TODAY, true)}; later shifts have not started.
          </>
        )}
        {errors.length > 0 && <span className="mt-1 block text-below">{errors.join(' · ')}</span>}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Ward cards */}
        <div className="min-w-0 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 px-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {shift} shift · {SHIFT_TIME[shift]} · {dayLabel(date)}
            </h2>
            <p className="text-[13px] text-ink-2">
              <span className="text-below">{counts.below} below minimum</span> · <span className="text-risk">{counts.risk} waiting on marks</span>
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {summaries.map((s) => (
              <WardCard key={s.ward.id} s={s} open={open === s.ward.id} onToggle={() => setOpen(open === s.ward.id ? null : s.ward.id)} staff={entries.filter((e) => e.date === date && e.shift === shift && e.ward === s.ward.id)} onCycle={cycle} />
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 px-1 text-[12.5px] text-ink-3">
            <Icon name="HandTap" size={15} /> Open a ward and tap a staff ID to change their mark. The summary and the message update at once.
          </p>
        </div>

        {/* Duty manager's phone */}
        <div className="min-w-0 lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <Phone message={message} stamp={`${date}-${shift}-${source.kind}`} edits={edits} future={summaries.every((s) => s.state === 'future')} />
            <Rules shift={shift} wards={wards} />
          </div>
        </div>
      </div>

      <Heatmap entries={entries} dates={dates} wards={wards} live={live} date={date} shift={shift} onPick={(d, s) => { setDate(d); setShift(s) }} />
    </div>
  )
}

function WardCard({ s, open, onToggle, staff, onCycle }: { s: WardSummary; open: boolean; onToggle: () => void; staff: Entry[]; onCycle: (e: Entry) => void }) {
  const st = STATE[s.state]
  const nurse = s.roles.find((r) => r.role === 'Nurse')
  const wa = s.roles.find((r) => r.role === 'Ward assistant')
  const notes = nurse ? [nurse.leave && `${nurse.leave} on leave`, nurse.absent && `${nurse.absent} absent`, nurse.unmarked && s.state !== 'future' && `${nurse.unmarked} not marked`, nurse.late && `${nurse.late} late`].filter(Boolean) : []
  return (
    <li className={open ? 'sm:col-span-2' : ''}>
      <div className={`rounded-[1.4rem] p-1 ring-1 transition-colors duration-500 ${s.state === 'below' ? 'bg-below/[0.06] ring-below/25' : 'bg-ink/[0.03] ring-ink/[0.06]'}`}>
        <div className="rounded-[calc(1.4rem-0.25rem)] bg-card p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_16px_40px_-28px_rgba(16,40,40,0.3)]">
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer items-start justify-between gap-3 text-left">
            <span>
              <span className="block text-[15px] font-semibold tracking-tight text-ink">{s.ward.name}</span>
              <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.chip}`}>
                <Icon name={st.icon} size={12} weight="bold" /> {st.label}
              </span>
            </span>
            {nurse && (
              <span className="text-right">
                <span className="block text-[26px] font-semibold leading-none tracking-tight tabular-nums">
                  {s.state === 'future' ? nurse.planned : nurse.present}
                  <span className="text-ink-3">/{s.state === 'future' ? nurse.min : nurse.planned}</span>
                </span>
                <span className="mt-1 block text-[11px] text-ink-3">{s.state === 'future' ? 'planned / minimum' : `nurses present · min ${nurse.min}`}</span>
              </span>
            )}
          </button>
          {nurse && s.state !== 'future' && <CoverBar have={nurse.present} wait={nurse.unmarked} planned={nurse.planned} min={nurse.min} />}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-2">
            <span>{notes.length ? notes.join(' · ') : s.state === 'future' ? 'Roster published' : 'Everyone marked present'}</span>
            {wa && s.state !== 'future' && (
              <span className={wa.present + wa.unmarked < wa.min ? 'font-medium text-below' : 'text-ink-3'}>
                Ward asst. {wa.present}/{wa.min}
              </span>
            )}
          </div>
          {nurse && nurse.short > 0 && s.state === 'below' && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-below-2 px-3 py-2 text-[12.5px] font-medium text-below">
              <Icon name="UserPlus" size={15} /> Needs {nurse.short} nurse{nurse.short > 1 ? 's' : ''}: the duty manager decides who to call or move.
            </p>
          )}
          {open && (
            <div className="mt-4 border-t border-ink/[0.06] pt-3 [animation:rise_500ms_cubic-bezier(0.16,1,0.3,1)]">
              <ul className="flex flex-wrap gap-1.5">
                {staff.map((e) => (
                  <li key={e.staffId + e.role}>
                    <button
                      type="button"
                      onClick={() => onCycle(e)}
                      disabled={s.state === 'future'}
                      title={`${e.staffId} · ${e.role} · ${STATUS_LABEL[e.status]} (tap to change)`}
                      className={`num flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-[11.5px] ring-1 transition-all duration-300 active:scale-95 disabled:cursor-default ${STATUS_CHIP[e.status]}`}
                    >
                      {e.role === 'Ward assistant' && <Icon name="Broom" size={11} />}
                      {e.staffId}
                      <span className="font-sans text-[10px] opacity-80">{STATUS_LABEL[e.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

// One block per planned nurse, with a marker at the ward's minimum.
function CoverBar({ have, wait, planned, min }: { have: number; wait: number; planned: number; min: number }) {
  const total = Math.max(planned, min)
  return (
    <div className="relative mt-4">
      <div className="flex gap-[3px]">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-[3px] transition-colors duration-500 ${i < have ? 'bg-ok' : i < have + wait ? 'bg-risk/60' : i < planned ? 'bg-below/70' : 'bg-below/20 ring-1 ring-inset ring-below/40'}`}
          />
        ))}
      </div>
      <span className="absolute -top-1.5 h-5 w-[2px] rounded bg-ink" style={{ left: `calc(${(min / total) * 100}% - 1px)` }} title={`Minimum ${min}`} />
    </div>
  )
}

function Phone({ message, stamp, edits, future }: { message: string; stamp: string; edits: number; future: boolean }) {
  const lines = message.split('\n')
  const [sent, setSent] = useState(false)
  const [shown, setShown] = useState(lines.length)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    setSent(false)
    setShown(lines.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp])

  useEffect(() => {
    if (!edits) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 900)
    return () => clearTimeout(t)
  }, [edits])

  useEffect(() => {
    if (!sent || shown >= lines.length) return
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 900 : 260)
    return () => clearTimeout(t)
  }, [sent, shown, lines.length])

  function send() {
    setSent(true)
    setShown(0)
  }
  // Before a send, the whole message is shown; edits to marks re-render it in place.
  const vis = sent ? shown : lines.length

  return (
    <div className="mx-auto max-w-[400px] rounded-[2.6rem] bg-night p-2.5 shadow-[0_40px_80px_-40px_rgba(16,40,40,0.6)] ring-1 ring-black/40">
      <div className="overflow-hidden rounded-[2.1rem] bg-[#efeae2]">
        <div className="flex items-center gap-3 bg-[#0f5a52] px-4 pb-3 pt-5 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Icon name="FirstAid" size={16} weight="regular" />
          </span>
          <span className="flex-1">
            <span className="block text-[14px] font-medium">Vera · Staffing</span>
            <span className="block text-[11px] text-white/70">to Duty Manager, Nursing Office</span>
          </span>
          <span className="num text-[11px] text-white/70">7:30</span>
        </div>
        <div className="min-h-[340px] px-3 py-4">
          {future ? (
            <p className="mx-auto mt-24 max-w-[16rem] text-center text-[12.5px] text-ink-3">This shift has not started. Its summary is sent 30 minutes after the shift begins.</p>
          ) : (
            <div className={`ml-0 mr-6 rounded-2xl rounded-tl-md bg-white px-3.5 py-3 text-[13px] leading-relaxed text-ink shadow-sm transition-shadow duration-700 ${flash ? 'shadow-[0_0_0_3px_rgba(14,110,106,0.35)]' : ''}`}>
              {sent && vis === 0 ? (
                <span className="flex gap-1 py-1" aria-label="typing">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-3 [animation:dot_1.1s_ease_infinite]" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
              ) : (
                lines.slice(0, vis).map((l, i) => (
                  <p key={i + l} className={`${i === 0 ? 'mb-1 font-semibold' : ''} ${/^Below|Needs|Ward assistants/.test(l) ? 'font-medium text-below' : /^Minimum \d+ only/.test(l) ? 'text-risk' : ''} ${sent ? '[animation:rise_400ms_cubic-bezier(0.16,1,0.3,1)]' : ''}`}>
                    {l}
                  </p>
                ))
              )}
              {vis >= lines.length && <span className="mt-1 block text-right text-[10px] text-ink-3">7:30 AM ✓✓</span>}
            </div>
          )}
        </div>
        <div className="border-t border-black/5 bg-white/70 p-3">
          <button
            type="button"
            onClick={send}
            disabled={future}
            className={`group relative flex w-full cursor-pointer items-center justify-between overflow-hidden rounded-full bg-teal py-2 pl-5 pr-2 text-[13.5px] font-medium text-white transition-transform duration-500 ${EASE} active:scale-[0.98] disabled:cursor-default disabled:opacity-40`}
          >
            {!sent && !future && <span className="pointer-events-none absolute inset-0 rounded-full bg-white/20 [animation:pulse-ring_2.2s_cubic-bezier(0.16,1,0.3,1)_infinite]" />}
            <span className="relative">{sent ? 'Send again' : 'Send the morning summary'}</span>
            <span className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ${EASE} group-hover:translate-x-0.5`}>
              <Icon name={sent ? 'ArrowCounterClockwise' : 'PaperPlaneRight'} size={14} weight="fill" />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

function Rules({ shift, wards }: { shift: Shift; wards: Ward[] }) {
  return (
    <Bezel className="mt-6" inner="p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-3">Minimum cover · {shift} shift</p>
      <p className="mt-1 text-[12.5px] text-ink-2">Set by the hospital per ward and shift. Sample values.</p>
      <table className="mt-3 w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
            <th className="pb-1.5 font-normal">Ward</th>
            <th className="pb-1.5 text-right font-normal">Nurses</th>
            <th className="pb-1.5 text-right font-normal">Ward asst.</th>
          </tr>
        </thead>
        <tbody>
          {wards.map((w) => (
            <tr key={w.id} className="border-t border-ink/[0.05]">
              <td className="py-1.5">{w.name}</td>
              <td className="num py-1.5 text-right">{w.rule[shift].Nurse ?? '–'}</td>
              <td className="num py-1.5 text-right">{w.rule[shift]['Ward assistant'] ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Bezel>
  )
}

function Heatmap({ entries, dates, wards, live, date, shift, onPick }: { entries: Entry[]; dates: string[]; wards: Ward[]; live: boolean; date: string; shift: Shift; onPick: (d: string, s: Shift) => void }) {
  const grid = useMemo(() => {
    const out = new Map<string, WardSummary>()
    for (const d of dates) for (const s of SHIFTS) for (const w of summarize(entries, d, s, wards, live)) out.set(`${d}|${s}|${w.ward.id}`, w)
    return out
  }, [entries, dates, wards, live])
  const tone: Record<WardSummary['state'], string> = { below: 'bg-below', risk: 'bg-risk', ok: 'bg-ok/80', future: 'hatch bg-ground-2', norule: 'bg-ink/10' }
  return (
    <Bezel className="mt-14" inner="p-5 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-3">The week at a glance</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">Every ward, every shift</h3>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-2">
          {(['ok', 'risk', 'below', 'future'] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-[3px] ${tone[k]}`} /> {STATE[k].label}
            </span>
          ))}
        </p>
      </div>
      <div className="-mx-1 mt-5 overflow-x-auto px-1">
        <table className="w-full min-w-[640px] border-separate border-spacing-[3px]">
          <thead>
            <tr>
              <th />
              {dates.map((d) => (
                <th key={d} colSpan={3} className="pb-1 text-center text-[10.5px] font-normal text-ink-3">
                  {dayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wards.map((w) => (
              <tr key={w.id}>
                <td className="whitespace-nowrap pr-3 text-[12px] text-ink-2">{w.name}</td>
                {dates.flatMap((d) =>
                  SHIFTS.map((s) => {
                    const c = grid.get(`${d}|${s}|${w.id}`)
                    if (!c) return <td key={d + s} />
                    const sel = d === date && s === shift
                    const n = c.roles.find((r) => r.role === 'Nurse')
                    return (
                      <td key={d + s}>
                        <button
                          type="button"
                          onClick={() => onPick(d, s)}
                          title={`${w.name} · ${dayLabel(d)} · ${s}: ${STATE[c.state].label}${n ? ` (${n.present}/${n.min} nurses)` : ''}`}
                          className={`block h-6 w-full min-w-[14px] cursor-pointer rounded-[4px] transition-transform duration-300 hover:scale-110 ${tone[c.state]} ${sel ? 'ring-2 ring-ink ring-offset-1' : ''}`}
                        />
                      </td>
                    )
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px] text-ink-3">Each day has three cells: morning, evening, night. Click any cell to open that shift.</p>
    </Bezel>
  )
}
