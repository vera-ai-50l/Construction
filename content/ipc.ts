// Copy, steps and sources for /ipc (Vera health 01: IPC Compliance Kit).
// Every figure on the page is computed by lib/ipc-flow.mjs from lib/ipc-sample.json, or from
// the assumptions below. The homes are fictional.

import type { Step } from './desks'

export const ipcSteps: Step[] = [
  {
    icon: 'Tray',
    title: 'Collect returns',
    detail: "Each home's four monthly audits arrive as a phone checklist or a photo of the paper form. Rows are cleaned. A missing audit is listed, never guessed.",
  },
  {
    icon: 'ClipboardText',
    title: 'Score & action plan',
    detail: 'Each audit is scored: 95% and above green, 76–94% amber, 75% or less red. Every failed item becomes an action with an owner and a due date: 7 days for red, 14 for amber.',
  },
  {
    icon: 'Siren',
    title: 'Outbreak watch',
    detail: 'The symptom log is checked each time a case is added. Two or more people with diarrhoea or vomiting at one home within 48 hours is a suspected outbreak, so Vera drafts the call note to the UKHSA health protection team.',
  },
  {
    icon: 'Certificate',
    title: 'Training check',
    detail: 'Every staff member is checked against a yearly IPC refresher and a 14-day induction for new starters. Each home gets a chase list, earliest date first.',
  },
  {
    icon: 'FolderOpen',
    title: 'Evidence pack',
    detail: "The month's records are filed against the ten criteria of the Code of Practice on infection prevention and control, ready for CQC. The adviser gets a one-page summary to review and sign.",
  },
  {
    icon: 'Calculator',
    title: 'Hours & £',
    detail: 'Time saved against the paper process, per home and for the adviser, priced at current wage rates. The same code drives the calculator further down.',
  },
]

// Assumptions behind the £ figures. `key` matches lib/ipc-flow.mjs where it is an input.
export const assumptions: { label: string; value: string; how: string; source?: string }[] = [
  {
    label: 'Home manager / IPC lead',
    value: '£24.19 an hour',
    how: '£36,000 salary + employer NI (15% above £5,000) + 3% pension = £41,730, over 1,725 working hours (37.5 h × 46 weeks).',
    source: 'payscale',
  },
  {
    label: 'Consultant microbiologist',
    value: '£115 an hour',
    how: 'Top of the advertised NHS locum rate for a consultant microbiologist / infection control doctor (£90–115 an hour). Private advisory work is usually billed higher, so this is conservative.',
    source: 'locum',
  },
  {
    label: 'Audits per home per month',
    value: '4',
    how: 'Hand hygiene, mattresses and covers, commodes, and the care environment: each set monthly in the care-home IPC audit toolkit most local teams use.',
    source: 'toolkit',
  },
  {
    label: 'Audit scoring',
    value: '95 / 76',
    how: '95% and above compliant, 76–94% partial, 75% or less minimal. The same bands as the care-home audit tools.',
    source: 'toolkit',
  },
  {
    label: 'Suspected D&V outbreak',
    value: '2+ in 48 h',
    how: 'Two or more residents or staff with diarrhoea and/or vomiting within 48 hours: call the UKHSA health protection team.',
    source: 'ukhsa',
  },
  {
    label: 'D&V outbreaks a year',
    value: '0.371 per home',
    how: '795 outbreaks in 379 care homes over four years in Cheshire & Merseyside: 37.1 per 100 homes a year.',
    source: 'inns',
  },
  {
    label: 'Days closed per outbreak',
    value: '6 → 2.65',
    how: 'Median closure was 6 days. Homes that closed within 3 days of the first case had 0.442 times the closure days (IRR). This is an association, not proof, so it is not counted in £.',
    source: 'inns',
  },
  {
    label: 'Minutes per task',
    value: 'Estimates',
    how: 'Vera’s estimates for a 42-bed home, set out line by line in the calculator. Physical checks stay (a mattress still has to be unzipped); only scoring, typing up, chasing, reporting and filing go. To confirm with a working adviser.',
  },
]

export const sources: Record<string, { label: string; href: string }> = {
  inns: { label: 'Inns et al. 2018, gastroenteritis outbreaks in care homes in North West England, 2012–2016 (BMC Public Health)', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5898054/' },
  ukhsa: { label: 'UKHSA South East, winter readiness for care homes 2026/27', href: 'https://www.england.nhs.uk/south-east/wp-content/uploads/sites/45/2026/09/UKHSA-Winter-Readiness-26_27.pdf' },
  toolkit: { label: 'Infection Prevention Control, care home audit tools and CQC pack (Oct 2025)', href: 'https://www.infectionpreventioncontrol.co.uk/wp-content/uploads/2025/10/00-Website-contents-sheet-for-Care-Homes-CQC-Pack-October-2025.pdf' },
  code: { label: 'DHSC, Health and Social Care Act 2008 code of practice on the prevention and control of infections (updated Dec 2022)', href: 'https://www.gov.uk/government/publications/the-health-and-social-care-act-2008-code-of-practice-on-the-prevention-and-control-of-infections-and-related-guidance' },
  cqc: { label: 'CQC, how well are people protected by the prevention and control of infection?', href: 'https://cqc.org.uk/node/2689' },
  locum: { label: 'NHS locum consultant microbiologist / infection control doctor, £90–115 an hour (Watford)', href: 'https://jobijoba.co.uk/detail/92/b23c04c770f20a6ab18337fe5e195d83' },
  payscale: { label: 'Payscale, care home manager pay in the UK, 2026', href: 'https://www.payscale.com/research/UK/Job=Care_Home_Manager/Salary/8161c761/Leadership' },
  homes: { label: 'Lottie, how many care homes are there in the UK (2026)', href: 'https://lottie.org/data-insight/how-many-care-homes-in-the-uk/' },
  jrf: { label: 'Joseph Rowntree Foundation, is excessive paperwork in care homes undermining care?', href: 'https://jrf.org.uk/report/excessive-paperwork-care-homes-undermining-care-older-people' },
  workforce: { label: 'CQC, State of Care 2024/25: adult social care workforce', href: 'https://www.cqc.org.uk/publications/major-report/state-care/2024-2025/access/asc' },
}

// Context figures quoted on the page, each with its source key.
export const context: { figure: string; text: string; source: string }[] = [
  { figure: '14,800+', text: 'CQC-registered care homes in England, each expected to evidence infection control under the Safe key question.', source: 'homes' },
  { figure: '37.1', text: 'D&V outbreaks per 100 care homes a year in one English region, with a median 6 days closed to admissions.', source: 'inns' },
  { figure: '25%', text: 'yearly staff turnover in care homes, so IPC induction and training records never stand still.', source: 'workforce' },
  { figure: '~50%', text: 'of care-home paperwork is rarely used, yet managers keep producing it to show compliance.', source: 'jrf' },
]
