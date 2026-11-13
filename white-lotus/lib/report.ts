// Weekly report: one short summary for leadership, built from the tools already running
// (roster and attendance, the recruitment sheet, the HR assistant's log). Summary figures only,
// computed in code from the same sample data the other pages show.

import { dayLabel, NOW_SHIFT, sampleWeek, SHIFTS, summarize, TODAY, WARDS, WEEK, type Shift } from './staffing'
import { missingDocs, OPENINGS, PIPELINE, pipelineStats } from './recruitment'

// The HR assistant's log for the week (sample): questions by policy topic, and themes no
// approved document covers (each one went to HR).
export const HR_LOG = {
  topics: [
    { topic: 'Leave', asked: 34, answered: 33 },
    { topic: 'Shifts and swaps', asked: 22, answered: 22 },
    { topic: 'Salary and payslips', asked: 17, answered: 14 },
    { topic: 'Holidays', asked: 9, answered: 9 },
    { topic: 'Uniform and ID card', asked: 6, answered: 6 },
    { topic: 'Staff health and safety', asked: 5, answered: 5 },
    { topic: 'Training', asked: 4, answered: 4 },
    { topic: 'Resignation and exit', asked: 3, answered: 3 },
  ],
  notCovered: [
    { theme: 'Staff canteen timings', count: 5 },
    { theme: 'Parking for two-wheelers', count: 4 },
    { theme: 'Hostel for new nurses', count: 3 },
    { theme: 'Locker allocation', count: 2 },
  ],
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)

export function buildReport() {
  const entries = sampleWeek()
  // Shifts that have run so far this week: every shift before today, and today's up to now.
  const ran: { date: string; shift: Shift }[] = []
  for (const date of WEEK.filter((d) => d <= TODAY))
    for (const shift of SHIFTS) if (date < TODAY || SHIFTS.indexOf(shift) <= SHIFTS.indexOf(NOW_SHIFT)) ran.push({ date, shift })

  const byWard = WARDS.map((w) => ({ ward: w.name, below: [] as { date: string; shift: Shift }[], marks: [] as boolean[] }))
  for (const r of ran) {
    summarize(entries, r.date, r.shift).forEach((s, i) => {
      const below = s.state === 'below'
      byWard[i].marks.push(below)
      if (below) byWard[i].below.push(r)
    })
  }
  const done = entries.filter((e) => ran.some((r) => r.date === e.date && r.shift === e.shift) && e.status !== 'unmarked')
  const present = done.filter((e) => e.status === 'present' || e.status === 'late').length
  const staffing = {
    shifts: ran.length,
    wardShifts: ran.length * WARDS.length,
    belowTotal: byWard.reduce((s, w) => s + w.below.length, 0),
    attendance: pct(present, done.length),
    leave: done.filter((e) => e.status === 'leave').length,
    absent: done.filter((e) => e.status === 'absent').length,
    late: done.filter((e) => e.status === 'late').length,
    byWard: byWard.map((w) => ({ ...w, count: w.below.length })),
    from: dayLabel(WEEK[0]),
    to: dayLabel(TODAY),
  }
  const worst = [...staffing.byWard].sort((a, b) => b.count - a.count)[0]
  const worstShift = worst?.below.length
    ? SHIFTS.map((s) => ({ s, n: worst.below.filter((b) => b.shift === s).length })).sort((a, b) => b.n - a.n)[0].s
    : null

  const p = pipelineStats(PIPELINE)
  const hiring = {
    ...p,
    openings: OPENINGS.reduce((s, o) => s + o.openings, 0),
    byRole: OPENINGS.map((o) => {
      const mine = PIPELINE.filter((c) => c.role === o.id)
      return { role: o.title, openings: o.openings, applied: mine.length, complete: mine.filter((c) => !missingDocs(c).length).length, booked: mine.filter((c) => c.stage === 'Interview booked').length }
    }),
  }

  const asked = HR_LOG.topics.reduce((s, t) => s + t.asked, 0) + HR_LOG.notCovered.reduce((s, t) => s + t.count, 0)
  const answered = HR_LOG.topics.reduce((s, t) => s + t.answered, 0)
  const hr = { asked, answered, rate: pct(answered, asked), toHR: asked - answered, topics: HR_LOG.topics, notCovered: HR_LOG.notCovered }

  const attention: string[] = []
  if (worst?.count)
    attention.push(`${worst.ward} fell below its minimum on ${worst.count} of ${staffing.shifts} shifts${worstShift ? `, most often on ${worstShift.toLowerCase()} shifts` : ''}. Worth a look at the ${worstShift?.toLowerCase() ?? ''} roster.`)
  if (p.waiting.length)
    attention.push(`${p.waiting.length} applicant${p.waiting.length > 1 ? 's have' : ' has'} been waiting on documents for 2 days or more (${p.waiting.map((c) => c.name).join(', ')}). The assistant has sent reminders; HR may want to call.`)
  if (p.review) attention.push(`${p.review} complete application${p.review > 1 ? 's are' : ' is'} waiting for an HR decision because of a flag (for example experience below the role’s requirement).`)
  const top = HR_LOG.notCovered.slice(0, 2)
  attention.push(`${hr.asked - HR_LOG.topics.reduce((s, t) => s + t.asked, 0)} staff questions were not covered by any policy, led by ${top.map((t) => `${t.theme.toLowerCase()} (${t.count})`).join(' and ')}. Adding these to the FAQ lets the assistant answer them next time.`)

  const whatsapp = [
    `White Lotus · weekly summary, ${staffing.from} – ${staffing.to}`,
    `Staffing: ${staffing.belowTotal} ward-shifts below minimum out of ${staffing.wardShifts}. Attendance ${staffing.attendance}%.${worst?.count ? ` Most gaps: ${worst.ward} (${worst.count}).` : ''}`,
    `Hiring: ${p.n} applications, ${p.complete} complete, ${p.booked} interviews booked, ${p.review} for HR review.`,
    `HR questions: ${hr.asked} asked, ${hr.rate}% answered without HR.`,
    `Full report sent by email.`,
  ].join('\n')

  return { staffing, worst, worstShift, hiring, hr, attention, whatsapp, sources: { records: entries.length, applications: PIPELINE.length, questions: asked } }
}

export type Report = ReturnType<typeof buildReport>
