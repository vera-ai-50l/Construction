// Staff roster and attendance summary: compares who was planned with who is present, per ward
// and shift, against the hospital's own minimum-cover rules. It only reports and flags; it never
// assigns, schedules or disciplines anyone. All data here is SAMPLE data with staff IDs, no names.

export const SHIFTS = ['Morning', 'Evening', 'Night'] as const
export type Shift = (typeof SHIFTS)[number]
export const SHIFT_TIME: Record<Shift, string> = { Morning: '7 AM – 3 PM', Evening: '3 PM – 11 PM', Night: '11 PM – 7 AM' }

export const ROLES = ['Nurse', 'Ward assistant'] as const
export type Role = (typeof ROLES)[number]

export type Status = 'present' | 'late' | 'leave' | 'absent' | 'unmarked'
export const STATUS_LABEL: Record<Status, string> = { present: 'Present', late: 'Late', leave: 'On leave', absent: 'Absent', unmarked: 'Not yet marked' }

export type Entry = { date: string; shift: Shift; ward: string; staffId: string; role: Role; status: Status }
export type Rule = Record<Shift, Partial<Record<Role, number>>>
export type Ward = { id: string; name: string; rule: Rule }

// Minimum cover per ward, shift and role. In a pilot these come from the hospital.
export const WARDS: Ward[] = [
  { id: 'ICU', name: 'ICU', rule: { Morning: { Nurse: 10, 'Ward assistant': 2 }, Evening: { Nurse: 10, 'Ward assistant': 2 }, Night: { Nurse: 8, 'Ward assistant': 1 } } },
  { id: 'NICU', name: 'NICU', rule: { Morning: { Nurse: 6, 'Ward assistant': 1 }, Evening: { Nurse: 6, 'Ward assistant': 1 }, Night: { Nurse: 5, 'Ward assistant': 1 } } },
  { id: 'ER', name: 'Emergency', rule: { Morning: { Nurse: 6, 'Ward assistant': 2 }, Evening: { Nurse: 6, 'Ward assistant': 2 }, Night: { Nurse: 5, 'Ward assistant': 2 } } },
  { id: 'W3', name: 'Ward 3', rule: { Morning: { Nurse: 6, 'Ward assistant': 2 }, Evening: { Nurse: 5, 'Ward assistant': 2 }, Night: { Nurse: 4, 'Ward assistant': 1 } } },
  { id: 'W5', name: 'Ward 5', rule: { Morning: { Nurse: 6, 'Ward assistant': 2 }, Evening: { Nurse: 5, 'Ward assistant': 2 }, Night: { Nurse: 4, 'Ward assistant': 1 } } },
  { id: 'MAT', name: 'Maternity', rule: { Morning: { Nurse: 5, 'Ward assistant': 2 }, Evening: { Nurse: 5, 'Ward assistant': 2 }, Night: { Nurse: 4, 'Ward assistant': 1 } } },
  { id: 'OT', name: 'Operation theatres', rule: { Morning: { Nurse: 8, 'Ward assistant': 2 }, Evening: { Nurse: 6, 'Ward assistant': 2 }, Night: { Nurse: 2, 'Ward assistant': 1 } } },
]

export const TODAY = '2026-11-13'
export const WEEK = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
// The demo is "this morning at 7:25": today's evening and night shifts have not started.
export const NOW_SHIFT: Shift = 'Morning'

export const dayLabel = (iso: string, long = false) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

// Small seeded generator so the sample week is identical on every load.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Today's morning, set to a typical example (ICU short by one nurse,
// Emergency waiting on one mark), plus a few other everyday cases.
const TODAY_MORNING: Record<string, { extra?: number; set: [Role, number, Status][] }> = {
  ICU: { set: [['Nurse', 4, 'leave']] },
  ER: { set: [['Nurse', 2, 'unmarked']] },
  W3: { set: [] },
  W5: { extra: 1, set: [['Nurse', 3, 'absent']] },
  NICU: { set: [['Ward assistant', 1, 'absent']] },
  MAT: { set: [['Nurse', 1, 'late']] },
  OT: { extra: 1, set: [['Nurse', 6, 'unmarked']] },
}

export function sampleWeek(): Entry[] {
  const out: Entry[] = []
  const r = rng(13112026)
  WEEK.forEach((date, d) => {
    SHIFTS.forEach((shift, si) => {
      for (const w of WARDS) {
        const special = date === TODAY && shift === 'Morning' ? TODAY_MORNING[w.id] : undefined
        const future = date > TODAY || (date === TODAY && SHIFTS.indexOf(shift) > SHIFTS.indexOf(NOW_SHIFT))
        for (const role of ROLES) {
          const min = w.rule[shift][role] ?? 0
          const extra = special ? (role === 'Nurse' ? special.extra ?? 0 : 0) : role === 'Nurse' && r() < 0.55 ? 1 : 0
          // Each ward has its own pool of staff, rotated across shifts, so IDs recur realistically.
          const pool = (Math.max(...SHIFTS.map((x) => w.rule[x][role] ?? 0)) + 1) * 4
          for (let i = 1; i <= min + extra; i++) {
            const idx = ((d * 3 + si) * (min + 1) + i) % pool
            const staffId = `${w.id}-${role === 'Nurse' ? 'N' : 'A'}${String(idx + 1).padStart(2, '0')}`
            let status: Status = 'present'
            if (future) status = 'unmarked'
            else if (special) {
              const hit = special.set.find(([ro, idx]) => ro === role && idx === i)
              status = hit ? hit[2] : 'present'
            } else {
              const x = r()
              status = x < 0.02 ? 'leave' : x < 0.03 ? 'absent' : x < 0.06 ? 'late' : 'present'
            }
            out.push({ date, shift, ward: w.id, staffId, role, status })
          }
        }
      }
    })
  })
  return out
}

export type RoleCount = { role: Role; min: number; planned: number; present: number; late: number; leave: number; absent: number; unmarked: number; short: number }
export type WardSummary = { ward: Ward; roles: RoleCount[]; state: 'ok' | 'risk' | 'below' | 'norule' | 'future' }

// `live` marks shifts after the current one as not started; an uploaded roster is read as-is.
export function summarize(entries: Entry[], date: string, shift: Shift, wards: Ward[] = WARDS, live = true): WardSummary[] {
  const future = live && (date > TODAY || (date === TODAY && SHIFTS.indexOf(shift) > SHIFTS.indexOf(NOW_SHIFT)))
  return wards.map((ward) => {
    const mine = entries.filter((e) => e.date === date && e.shift === shift && e.ward === ward.id)
    const roles = ROLES.map((role) => {
      const r = mine.filter((e) => e.role === role)
      const count = (s: Status) => r.filter((e) => e.status === s).length
      const present = count('present') + count('late')
      const min = ward.rule[shift]?.[role] ?? 0
      return { role, min, planned: r.length, present, late: count('late'), leave: count('leave'), absent: count('absent'), unmarked: count('unmarked'), short: Math.max(0, min - present) }
    }).filter((x) => x.planned > 0 || x.min > 0)
    let state: WardSummary['state'] = 'ok'
    if (future) state = 'future'
    else if (!roles.some((x) => x.min > 0)) state = 'norule'
    else if (roles.some((x) => x.present + x.unmarked < x.min)) state = 'below'
    else if (roles.some((x) => x.present < x.min)) state = 'risk'
    return { ward, roles, state }
  })
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

// The message the duty manager receives.
export function morningMessage(summaries: WardSummary[], date: string, shift: Shift): string {
  const order = { below: 0, risk: 1, ok: 2, norule: 3, future: 4 }
  const lines = [`Staffing summary - ${shift.toLowerCase()} shift, ${dayLabel(date)}`]
  for (const s of [...summaries].sort((a, b) => order[a.state] - order[b.state])) {
    const nurse = s.roles.find((r) => r.role === 'Nurse')
    const wa = s.roles.find((r) => r.role === 'Ward assistant')
    if (!nurse) continue
    const notes: string[] = []
    if (nurse.leave) notes.push(`${nurse.leave} on leave`)
    if (nurse.absent) notes.push(`${nurse.absent} absent`)
    if (nurse.unmarked) notes.push(`${nurse.unmarked} not yet marked`)
    let line = `${s.ward.name}: ${nurse.present} of ${nurse.planned} planned present.`
    if (notes.length) line += ` ${notes.join(', ').replace(/^./, (c) => c.toUpperCase())}.`
    if (nurse.present >= nurse.min && !notes.length) line += ' OK.'
    lines.push(line)
    if (nurse.present + nurse.unmarked < nurse.min) lines.push(`Below minimum of ${nurse.min}. Needs ${plural(nurse.short, 'nurse')}.`)
    else if (nurse.present < nurse.min) lines.push(`Minimum ${nurse.min} only if the unmarked ${nurse.unmarked === 1 ? 'nurse arrives' : 'nurses arrive'}.`)
    else if (s.state === 'ok' && notes.length) lines.push(`Minimum of ${nurse.min} still met.`)
    if (wa && wa.present + wa.unmarked < wa.min) lines.push(`Ward assistants ${wa.present} of ${wa.min}. Needs ${plural(wa.short, 'ward assistant')}.`)
  }
  return lines.join('\n')
}

// ---- Bring-your-own roster: CSV in, entries out ----
export const CSV_HEADER = 'date,shift,ward,staff_id,role,status'

export function toCsv(entries: Entry[]): string {
  return [CSV_HEADER, ...entries.map((e) => [e.date, e.shift, e.ward, e.staffId, e.role, e.status].join(','))].join('\n')
}

export function parseCsv(text: string): { entries: Entry[]; errors: string[] } {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  const errors: string[] = []
  const head = lines.shift()?.toLowerCase().split(',').map((h) => h.trim()) ?? []
  const col = (n: string) => head.indexOf(n)
  const need = ['date', 'shift', 'ward', 'staff_id', 'role', 'status']
  const missing = need.filter((n) => col(n) < 0)
  if (missing.length) return { entries: [], errors: [`Missing column(s): ${missing.join(', ')}. Expected header: ${CSV_HEADER}`] }
  const norm = <T extends string>(v: string, opts: readonly T[]) => opts.find((o) => o.toLowerCase() === v.trim().toLowerCase())
  const statusAlias: Record<string, Status> = { p: 'present', present: 'present', late: 'late', l: 'leave', leave: 'leave', 'on leave': 'leave', a: 'absent', absent: 'absent', '': 'unmarked', unmarked: 'unmarked', 'not marked': 'unmarked' }
  const entries: Entry[] = []
  lines.forEach((l, i) => {
    const c = l.split(',')
    const shift = norm(c[col('shift')] ?? '', SHIFTS)
    const role = norm(c[col('role')] ?? '', ROLES)
    const status = statusAlias[(c[col('status')] ?? '').trim().toLowerCase()]
    const date = (c[col('date')] ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !shift || !role || !status) {
      if (errors.length < 5) errors.push(`Row ${i + 2}: could not read "${l.slice(0, 60)}"`)
      return
    }
    entries.push({ date, shift, ward: (c[col('ward')] ?? '').trim(), staffId: (c[col('staff_id')] ?? '').trim(), role, status })
  })
  return { entries, errors }
}
