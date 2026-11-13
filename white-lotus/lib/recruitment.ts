// Recruitment assistant: replies to candidates, asks the screening questions, collects documents,
// flags what is missing and books an interview. It never rejects or selects anyone: anything
// outside a role's stated requirements is flagged for HR to decide. SAMPLE roles and candidates.

export type RoleId = 'icu-nurse' | 'ward-nurse' | 'ot-tech' | 'ward-assistant'
export type DocId = 'resume' | 'registration' | 'qualification' | 'id' | 'bls'

export const DOCS: Record<DocId, string> = {
  resume: 'Resume',
  registration: 'Nursing council registration certificate',
  qualification: 'Qualification certificate',
  id: 'ID proof (Aadhaar or PAN)',
  bls: 'BLS certificate',
}

export type Opening = {
  id: RoleId
  title: string
  department: string
  openings: number
  qualifications: string[]
  minYears: number
  needsRegistration: boolean
  docs: DocId[]
  note: string
}

export const OPENINGS: Opening[] = [
  {
    id: 'icu-nurse',
    title: 'Staff Nurse – ICU',
    department: 'Critical Care',
    openings: 4,
    qualifications: ['B.Sc Nursing', 'GNM'],
    minYears: 2,
    needsRegistration: true,
    docs: ['resume', 'registration', 'qualification', 'bls', 'id'],
    note: '2 years of ICU or critical-care experience and a valid BLS certificate.',
  },
  {
    id: 'ward-nurse',
    title: 'Staff Nurse – Wards',
    department: 'Nursing',
    openings: 6,
    qualifications: ['B.Sc Nursing', 'GNM'],
    minYears: 0,
    needsRegistration: true,
    docs: ['resume', 'registration', 'qualification', 'id'],
    note: 'Freshers welcome. State Nursing Council registration required.',
  },
  {
    id: 'ot-tech',
    title: 'OT Technician',
    department: 'Operation Theatres',
    openings: 2,
    qualifications: ['B.Sc OT Technology', 'Diploma in OT Technology'],
    minYears: 1,
    needsRegistration: false,
    docs: ['resume', 'qualification', 'id'],
    note: '1 year of experience in an operation theatre.',
  },
  {
    id: 'ward-assistant',
    title: 'Ward Assistant',
    department: 'Patient Services',
    openings: 5,
    qualifications: ['12th pass', '10th pass'],
    minYears: 0,
    needsRegistration: false,
    docs: ['resume', 'id'],
    note: 'Freshers welcome. Training is given on joining.',
  },
]

// The hiring team's interview availability next week (sample). A slot is taken once a
// candidate in the pipeline has booked it.
export const SLOTS = [
  'Mon 16 Nov, 10:00 AM',
  'Mon 16 Nov, 10:30 AM',
  'Mon 16 Nov, 2:30 PM',
  'Tue 17 Nov, 10:00 AM',
  'Tue 17 Nov, 11:00 AM',
  'Tue 17 Nov, 3:00 PM',
  'Wed 18 Nov, 10:30 AM',
  'Wed 18 Nov, 2:30 PM',
]
export const freeSlots = (list: { slot: string }[]) => SLOTS.filter((s) => !list.some((c) => c.slot === s))

export type Stage = 'Screening' | 'Documents pending' | 'Interview booked' | 'For HR review'
export type Candidate = {
  id: string
  name: string
  role: RoleId
  qualification: string
  years: number
  registration: string
  notice: string
  docs: DocId[]
  slot: string
  firstReplySec: number
  appliedDaysAgo: number
  flags: string[]
  stage: Stage
}

export const opening = (id: RoleId) => OPENINGS.find((o) => o.id === id)!
export const missingDocs = (c: Pick<Candidate, 'role' | 'docs'>) => opening(c.role).docs.filter((d) => !c.docs.includes(d))

// Flags are notes for HR, never a decision.
export function flagsFor(c: Pick<Candidate, 'role' | 'years' | 'qualification' | 'registration'>): string[] {
  const o = opening(c.role)
  const f: string[] = []
  if (c.years < o.minYears) f.push(`${c.years} yr experience; role asks for ${o.minYears}`)
  if (c.qualification && !o.qualifications.includes(c.qualification)) f.push(`Qualification “${c.qualification}” not in the role’s list`)
  if (o.needsRegistration && !validRegistration(c.registration)) f.push('Registration number missing or unreadable')
  return f
}

// A format check only. The number itself is verified with the nursing council by HR.
export const validRegistration = (s: string) => /^[A-Za-z0-9][A-Za-z0-9/ .-]{3,24}$/.test(s.trim()) && /\d{3,}/.test(s)

export function stageOf(c: Omit<Candidate, 'stage' | 'flags'> & { flags?: string[] }): Stage {
  if (missingDocs(c).length) return c.docs.length ? 'Documents pending' : 'Screening'
  if ((c.flags ?? flagsFor(c)).length) return 'For HR review'
  return c.slot ? 'Interview booked' : 'Documents pending'
}

function make(c: Omit<Candidate, 'stage' | 'flags'>): Candidate {
  const flags = flagsFor(c)
  return { ...c, flags, stage: stageOf({ ...c, flags }) }
}

// This week's applications so far (sample).
export const PIPELINE: Candidate[] = [
  make({ id: 'C-1041', name: 'Priya S.', role: 'icu-nurse', qualification: 'B.Sc Nursing', years: 4, registration: 'MH-RN-58213', notice: '30 days', docs: ['resume', 'registration', 'qualification', 'bls', 'id'], slot: 'Mon 16 Nov, 10:00 AM', firstReplySec: 4, appliedDaysAgo: 4 }),
  make({ id: 'C-1042', name: 'Rahul K.', role: 'ward-assistant', qualification: '12th pass', years: 1, registration: '', notice: 'Immediately', docs: ['resume', 'id'], slot: 'Tue 17 Nov, 11:00 AM', firstReplySec: 3, appliedDaysAgo: 4 }),
  make({ id: 'C-1043', name: 'Ancy T.', role: 'ward-nurse', qualification: 'GNM', years: 0, registration: 'KL-31478', notice: 'Immediately', docs: ['resume', 'registration', 'qualification'], slot: '', firstReplySec: 5, appliedDaysAgo: 3 }),
  make({ id: 'C-1044', name: 'Meena R.', role: 'icu-nurse', qualification: 'GNM', years: 1, registration: 'MH-RN-60127', notice: '60 days', docs: ['resume', 'registration', 'qualification', 'bls', 'id'], slot: '', firstReplySec: 4, appliedDaysAgo: 3 }),
  make({ id: 'C-1045', name: 'Imran A.', role: 'ot-tech', qualification: 'Diploma in OT Technology', years: 3, registration: '', notice: '30 days', docs: ['resume', 'qualification', 'id'], slot: 'Mon 16 Nov, 2:30 PM', firstReplySec: 6, appliedDaysAgo: 2 }),
  make({ id: 'C-1046', name: 'Sneha P.', role: 'ward-nurse', qualification: 'B.Sc Nursing', years: 2, registration: 'MH-RN-61840', notice: '15 days', docs: ['resume'], slot: '', firstReplySec: 3, appliedDaysAgo: 2 }),
  make({ id: 'C-1047', name: 'Joseph M.', role: 'ward-assistant', qualification: '10th pass', years: 0, registration: '', notice: 'Immediately', docs: ['resume', 'id'], slot: 'Tue 17 Nov, 3:00 PM', firstReplySec: 4, appliedDaysAgo: 1 }),
  make({ id: 'C-1048', name: 'Kavita D.', role: 'ward-nurse', qualification: 'GNM', years: 5, registration: 'MH-RN-44502', notice: '30 days', docs: ['resume', 'registration', 'qualification', 'id'], slot: 'Wed 18 Nov, 10:30 AM', firstReplySec: 5, appliedDaysAgo: 1 }),
  make({ id: 'C-1049', name: 'Arjun N.', role: 'ot-tech', qualification: 'B.Sc OT Technology', years: 0, registration: '', notice: 'Immediately', docs: [], slot: '', firstReplySec: 4, appliedDaysAgo: 0 }),
]

export function pipelineStats(list: Candidate[]) {
  const n = list.length
  const complete = list.filter((c) => missingDocs(c).length === 0).length
  const booked = list.filter((c) => c.stage === 'Interview booked').length
  const review = list.filter((c) => c.stage === 'For HR review').length
  const pending = list.filter((c) => c.stage === 'Documents pending' || c.stage === 'Screening').length
  const avgReply = n ? Math.round(list.reduce((s, c) => s + c.firstReplySec, 0) / n) : 0
  const waiting = list.filter((c) => missingDocs(c).length && c.appliedDaysAgo >= 2)
  return { n, complete, booked, review, pending, avgReply, waiting }
}
