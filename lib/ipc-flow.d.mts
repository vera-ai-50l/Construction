// Types for lib/ipc-flow.mjs (plain JS so n8n can paste each step into a Code node).

export type Rag = 'green' | 'amber' | 'red'
export type AuditType = 'hand' | 'mattress' | 'commode' | 'environment'

export type Home = { id: string; name: string; type: string; beds: number; manager: string }
export type Audit = { home: string; type: AuditType; date: string; by: string; checked: number; fails: { item: string; where: string }[] }
export type Symptom = { home: string; who: 'resident' | 'staff'; where: string; symptom: string; onset: string }
export type TrainingRow = { home: string; staff: string; role: string; started: string; ipc: string }

export type Sample = { month: string; asOf: string; adviser: string; homes: Home[]; audits: Audit[]; symptoms: Symptom[]; training: TrainingRow[] }

export type Score = { home: string; type: AuditType; checked: number; failed: number; pct: number; rag: Rag }
export type Action = { home: string; type: AuditType; item: string; where: string; owner: string; rag: Rag; due: string }
export type Outbreak = {
  home: string; name: string; cases: number; residents: number; staff: number
  firstOnset: string; flaggedAt: string; spanH: number; where: string; steps: string[]; note: string
}
export type Chase = TrainingRow & { status: 'expired' | 'never trained' | 'due in 30 days' | 'induction due'; due: string }
export type TrainingByHome = { home: string; staff: number; pct: number; expired: number; never: number; dueSoon: number }
export type PackRow = { n: number; title: string; status: 'covered' | 'partly' | 'gap' | 'adviser'; records: string[] }
export type Pack = { home: string; name: string; rows: PackRow[]; covered: number; files: string[] }

export type Assumptions = {
  managerRate: number; consultantRate: number; pricePerHome: number
  outbreaksPerHomeYear: number; closureDays: number; earlyCloseRatio: number
}
export type ValueLine = { k: string; t: string; who: 'home' | 'adviser'; before: number; after: number; saved: number }
export type Value = {
  assumptions: Assumptions
  homes: number
  lines: ValueLine[]
  month: {
    homeBefore: number; homeAfter: number; homeSaved: number
    adviserBefore: number; adviserAfter: number; adviserSaved: number
    homePounds: number; adviserPounds: number; pounds: number; price: number; net: number
  }
  year: { hours: number; pounds: number; homePounds: number; adviserPounds: number; price: number; outbreaks: number; closureDaysSaved: number }
  perHome: { homeHours: number; adviserHours: number; pounds: number }
  roi: number
}

// Everything accumulates step by step; later fields are absent on earlier steps' output.
export type Out = Omit<Sample, 'audits'> & {
  auditTypes: Record<AuditType, { name: string; owner: string; unit: string }>
  audits: Audit[]
  missing: { home: string; type: AuditType }[]
  rejected: { home: string; type: string; why: string }[]
  stats: { homes: number; beds: number; returns: number; expected: number; lines: number }
  scores: Score[]
  actions: Action[]
  byHome: { home: string; pct: number; rag: Rag; missing: number }[]
  outbreaks: Outbreak[]
  watch: { home: string; cases: number }[]
  trainingByHome: TrainingByHome[]
  chase: Chase[]
  packs: Pack[]
  summary: string[]
  value: Value
}

type Step = { name: string; fn: (input: unknown) => unknown }
export const flow: { id: string; name: string; path: string; sample: string; note: string; steps: Step[] }

export function hoursAndPounds(input: { homes: { beds: number }[]; assumptions?: Partial<Assumptions> }): { value: Value }
export function runAll(body: Sample): Out[]
