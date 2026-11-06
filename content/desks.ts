// Everything the demo page says about each offer lives here, so copy and figures
// can be changed in one place. Figures are illustrative (a typical ₹100–300 Cr
// contractor); the page labels them as such. Icon names map to components/ui/icons.tsx.

export type Step = { icon: string; title: string; detail: string }
export type Desk = {
  id: string
  num: string
  name: string
  kind: string
  status: 'Working demo' | 'Pilot-ready' | 'Building with first customers' | 'In design'
  audience: ('contractor' | 'developer')[]
  headline: string
  problem: string
  inputs: { icon: string; label: string }[]
  steps: Step[]
  outputs: string[]
  helps: { figure: string; text: string }[]
}

export const desks: Desk[] = [
  {
    id: 'leak-check',
    num: '01',
    name: 'Material Leak Check',
    kind: 'One-time check · one site',
    status: 'Working demo',
    audience: ['contractor', 'developer'],
    headline: 'Find what your site paid for and never got, in one week.',
    problem:
      'A challan gets billed twice. A truck is short at the weighbridge but the bill is for the full load. A supplier quietly bills ₹16 a bag above the PO. Stores issue more cement than the plaster on the wall needs. Nobody is hiding it. The registers simply never meet each other.',
    inputs: [
      { icon: 'Receipt', label: 'Purchase orders' },
      { icon: 'Truck', label: 'Delivery challans' },
      { icon: 'Scales', label: 'Gate / weighbridge book' },
      { icon: 'Package', label: 'Stores issue slips' },
      { icon: 'Ruler', label: 'BOQ work done' },
    ],
    steps: [
      { icon: 'Receipt', title: 'Read the registers', detail: 'POs, challans, gate entries, issue slips and BOQ progress are cleaned and lined up. Missing or unreadable rows are listed, not guessed.' },
      { icon: 'Link', title: 'PO → challan → gate', detail: 'Every challan is matched to its PO and to what the gate actually received. Duplicates, short supply beyond 0.5%, rates above PO and deliveries with no PO fall out.' },
      { icon: 'Calculator', title: 'Issue → BOQ', detail: 'Material needed = work done × consumption norm, plus the allowed wastage (cement 2%, steel 3%). Anything issued beyond that is overuse, by wing and supervisor.' },
      { icon: 'Stack', title: 'Stock vs next 8 weeks', detail: 'Book stock is compared with what the next two months of work needs: cash sitting in extra stock, and shortages that will stop a pour.' },
      { icon: 'FileText', title: '1-page ₹ summary', detail: 'One page for the MD: recoverable from suppliers, stoppable on site, and every line traceable to a challan or slip number.' },
    ],
    outputs: ['1-page ₹ summary for the MD', 'Supplier claim list with challan numbers', 'Overuse by wing and supervisor', 'Extra and short stock, valued'],
    helps: [
      { figure: '₹16.1 L', text: 'found on one illustrative site over 3 months: 6.3% of ₹2.57 Cr bought' },
      { figure: '₹7.5 L', text: 'recoverable from suppliers: duplicates, short supply, above-PO rates' },
      { figure: '~60 h', text: 'of register matching a quarter per site, done in code instead of by hand (estimate)' },
    ],
  },
  {
    id: 'site-desk',
    num: '02',
    name: 'Site Record Desk',
    kind: 'Daily and weekly · all sites',
    status: 'Working demo',
    audience: ['contractor', 'developer'],
    headline: 'Your supervisors keep sending voice notes. You get a record, every morning.',
    problem:
      'Site teams already report on WhatsApp: a Hindi voice note at 7:48, a challan photo at 9:15, a Marathi text when the crane stops. By evening it is 15 messages across four groups and nobody has written the DPR. When a client disputes a delay six months later, the proof is somewhere in a phone.',
    inputs: [
      { icon: 'Microphone', label: 'Voice notes (Hindi, Marathi, Hinglish)' },
      { icon: 'ChatCircleText', label: 'Texts' },
      { icon: 'Camera', label: 'Site photos' },
      { icon: 'Receipt', label: 'Challan photos' },
    ],
    steps: [
      { icon: 'Buildings', title: 'Site master', detail: 'Each site’s contractors, planned activities, supplier challan prefixes, open POs, labour day rate and pending RA bills, set up once.' },
      { icon: 'WhatsappLogo', title: 'Read every message', detail: 'Labour by contractor, progress, material received, stock left, hindrances and hours lost. A message Vera cannot read is marked “noted” for the supervisor, never guessed.' },
      { icon: 'Notebook', title: 'Daily site record', detail: 'One dated record per site: labour, progress, receipts, stock, and a hindrance register with the photos attached.' },
      { icon: 'Coins', title: 'Money at risk', detail: 'Idle labour × hours × day rate, client delays you can claim, unpaid or returned RA bills, deliveries with no PO, stock that will stop work, sites that went silent.' },
      { icon: 'PaperPlaneTilt', title: '8 AM brief + weekly report', detail: 'A WhatsApp brief for the owner before the day starts, a weekly progress report every Monday (planned against done, per site), and a Tally import file for the receipts.' },
    ],
    outputs: ['8 AM WhatsApp brief for the owner', 'Daily progress record per site', 'Weekly progress report: planned against done, per site', 'Hindrance register with photos and times', 'Tally receipt-note import'],
    helps: [
      { figure: '~8 h', text: 'a week saved per site: no daily or weekly report typed by hand (estimate)' },
      { figure: '₹63.8 L', text: 'at risk surfaced before 8 AM: an unpaid RA bill, a returned bill, idle crews, a no-PO delivery' },
      { figure: '0', text: 'new apps for site teams. They keep using WhatsApp' },
    ],
  },
  {
    id: 'stock-balance',
    num: '03',
    name: 'Cross-Site Stock Balance',
    kind: 'Weekly · across all sites',
    status: 'Building with first customers',
    audience: ['contractor', 'developer'],
    headline: 'One sheet a week: which site has too much, which will run short, and who sends what to whom.',
    problem:
      'With six or more sites running, one site holds 30 MT of steel it will not use for two months while another, 40 km away, places a fresh order for the same bars. Cement ages in one store while a pour stops for lack of it at another. Each site buys for itself, so cash stays stuck in stock nobody needs.',
    inputs: [
      { icon: 'Warehouse', label: 'Stock at each site' },
      { icon: 'Ruler', label: 'Next 4 weeks of planned work' },
      { icon: 'Receipt', label: 'Purchase requests and open POs' },
      { icon: 'Clock', label: 'Batch dates (cement, admixtures)' },
    ],
    steps: [
      { icon: 'Warehouse', title: 'Stock by site', detail: 'Book stock from every site’s stores register on one sheet, corrected by the latest physical count.' },
      { icon: 'Ruler', title: 'Need, next 4 weeks', detail: 'What each site will use in the next four weeks, from BOQ progress and the plan.' },
      { icon: 'Scales', title: 'Excess and shortage', detail: 'Stock above the need is excess, valued. Need above the stock is a shortage, with the date it will stop work. Old cement is marked to move first.' },
      { icon: 'ArrowsLeftRight', title: 'Who sends what to whom', detail: 'Excess at one site is matched to a shortage at another, with the distance and truck cost. Each move names the sending and receiving supervisor.' },
      { icon: 'ShoppingCart', title: 'One buy list', detail: 'Only what no site can spare goes to purchase, as one list for all sites instead of a PR from each.' },
      { icon: 'FileText', title: 'Transfer note + Tally', detail: 'A transfer note for each truck, and the Tally stock journal so both sites’ books stay right.' },
    ],
    outputs: ['Weekly stock sheet across all sites', 'Excess and shortage for the next 4 weeks, valued', 'Who sends what to whom, with supervisor names', 'One buy list for purchase', 'Cash stuck in excess stock, by site'],
    helps: [
      { figure: '₹14.9 L', text: 'of new steel not bought in an illustrative week: 24 MT sent 40 km from a site that did not need it' },
      { figure: '~5 h', text: 'a week of purchase calls to six sites, replaced by one Monday sheet (estimate)' },
      { figure: '1 list', text: 'for purchase: only what no site can spare' },
    ],
  },
  {
    id: 'wastage',
    num: '04',
    name: 'Supervisor-wise Wastage',
    kind: 'Part of the Leak Check · monthly',
    status: 'Working demo',
    audience: ['contractor', 'developer'],
    headline: 'See which supervisor, on which floor, used more than the allowed wastage.',
    problem:
      'A tower has eight or ten supervisors, each running a few floors. Cement, steel and RMC go to all of them from one store. At month end the site total looks fine, so nobody sees that one floor used 42 bags more than its work needed while the floor above was careful.',
    inputs: [
      { icon: 'Package', label: 'Stores issue slips, with supervisor' },
      { icon: 'Ruler', label: 'BOQ work done by floor' },
      { icon: 'Truck', label: 'RMC delivery tickets' },
      { icon: 'Sliders', label: 'Your allowed wastage norms' },
    ],
    steps: [
      { icon: 'Package', title: 'Slips by supervisor', detail: 'Every issue slip is tied to a supervisor, wing and floor. Slips with no name are sent back to stores to fill in, not guessed.' },
      { icon: 'Ruler', title: 'Work done by floor', detail: 'BOQ quantities done on each floor in the month: concrete, steel, blockwork, plaster.' },
      { icon: 'Calculator', title: 'Allowed quantity', detail: 'Work done × consumption norm, plus your allowed wastage: cement 2%, steel 3%, RMC 1.5%. Calculated in code.' },
      { icon: 'Warning', title: 'Over the limit', detail: 'Issued minus allowed, by supervisor, floor and material, valued at the PO rate. Supervisors within the limit are shown too.' },
      { icon: 'PaperPlaneTilt', title: 'Monthly table', detail: 'One table for the project manager, ranked by ₹ over the limit, with slip numbers. Each supervisor gets only their own lines.' },
    ],
    outputs: ['Wastage by supervisor, wing and floor', 'Over-limit quantity valued at the PO rate', 'Issue slip numbers behind every line', 'Each supervisor’s own lines on WhatsApp'],
    helps: [
      { figure: '₹65,670', text: 'over the allowed limit in one illustrative tower in one month, now with a name on every line' },
      { figure: '₹15,120', text: 'one line: Tower C, Floor 7, Supervisor A, 42 bags of cement over the 2% limit' },
      { figure: '~1 day', text: 'of QS work a month, splitting issues by supervisor, done in code (estimate)' },
    ],
  },
  {
    id: 'site-opening',
    num: '05',
    name: 'One-day Site Opening',
    kind: 'Per new site · first inspection',
    status: 'In design',
    audience: ['developer'],
    headline: 'For developers. The first inspection of a new site, done and written up in one day instead of three.',
    problem:
      'Before a contractor starts on a new site, the project team inspects the set-up: labour camp, stores yard, batching plant or RMC, formwork, safety, and a stack of certificates. It takes two to three days because papers are chased on the day, photos sit on personal phones, and the report is typed up afterwards from notes.',
    inputs: [
      { icon: 'ListChecks', label: 'Your mobilisation checklist (50–100 points)' },
      { icon: 'Certificate', label: 'Contractor certificates on WhatsApp' },
      { icon: 'Camera', label: 'Photos taken on the walk' },
      { icon: 'Microphone', label: 'Spoken remarks' },
    ],
    steps: [
      { icon: 'ListChecks', title: 'Your checklist', detail: 'Your existing checklist loaded once: labour camp, stores yard, batching plant or RMC, formwork, safety, documents.' },
      { icon: 'Certificate', title: 'Papers, 3 days before', detail: 'The contractor sends certificates on WhatsApp. Vera reads each one: BOCW registration, labour licence, workmen’s compensation, CAR insurance, plant calibration, consent to operate. Names, dates and amounts checked.' },
      { icon: 'WarningCircle', title: 'Missing list that evening', detail: 'The contractor gets one list of what is missing, expired or short, the same evening, so it is fixed before the visit and not during it.' },
      { icon: 'Camera', title: 'Checklist on the phone', detail: 'On the day, the engineer walks the site with the checklist on the phone. Each photo is tagged to a checklist line, with time and location.' },
      { icon: 'Microphone', title: 'Spoken remarks', detail: 'Remarks spoken in Hindi, Marathi or English become written observations against the right line.' },
      { icon: 'FileText', title: 'Report by evening', detail: 'By the end of the day the inspection report is about 80% written: passed, open and failed lines with photos. Open items are closed later on photos, without a second visit.' },
    ],
    outputs: ['Missing-document list, before the visit', 'Checklist with photos, time and location', 'Inspection report drafted the same day', 'Open items closed on photos'],
    helps: [
      { figure: '3 → 1 day', text: 'for the first inspection and its report, so the contractor starts two days sooner' },
      { figure: '~16 h', text: 'of engineer time saved per new site: no papers chased on the day, no report typed afterwards (estimate)' },
      { figure: '~80%', text: 'of the report written by the end of the visit, from tagged photos and spoken remarks' },
    ],
  },
  {
    id: 'plant-desk',
    num: '03',
    name: 'Plant & Formwork Desk',
    kind: 'Add-on · machines and formwork',
    status: 'Building with first customers',
    audience: ['contractor'],
    headline: 'No more breakdowns from a service nobody remembered, or hired machines idling on rent.',
    problem:
      'A transit mixer misses its 250-hour service and seizes mid-pour. A hired JCB sits idle at one site for nine days at ₹2,800 a day while another site hires a second one. Cup-lock and shuttering plates move between sites on a phone call, and every project ends 5–10% short. The crane’s load-test certificate lapses and work stops for an inspection.',
    inputs: [
      { icon: 'Toolbox', label: 'Asset register: owned and hired' },
      { icon: 'Gauge', label: 'Hour-meter photos on WhatsApp' },
      { icon: 'GasPump', label: 'Diesel issue slips' },
      { icon: 'ArrowsLeftRight', label: 'Formwork transfer notes' },
      { icon: 'Certificate', label: 'Certificates and insurance' },
    ],
    steps: [
      { icon: 'Toolbox', title: 'Asset register', detail: 'Every machine and formwork set, owned or hired: service interval in hours, hire rate, location, certificates. Set up once from your existing lists.' },
      { icon: 'Gauge', title: 'Read the hour-meters', detail: 'Operators already send hour-meter and diesel photos. Vera logs hours run, idle days and litres per hour, per machine.' },
      { icon: 'Wrench', title: 'Service due', detail: 'Hours since the last service against the interval: due this week, overdue, or run past it. Breakdowns are logged against the service history.' },
      { icon: 'Hourglass', title: 'Idle & hire check', detail: 'Hired machines idle beyond 3 days are flagged for off-hire with the rent saved. An owned machine idle at one site is offered before another site hires.' },
      { icon: 'Stack', title: 'Formwork tally', detail: 'Plates, props and cup-lock sent to each site or contractor against what came back, in use, or damaged for repair. Shortages are charged before the contractor leaves.' },
      { icon: 'Certificate', title: 'Certificates', detail: 'Load tests, insurance, fitness and PUC: reminders 30, 15 and 7 days ahead, so no machine is stopped at the gate.' },
      { icon: 'PaperPlaneTilt', title: 'Weekly plant brief', detail: 'Service bookings for the mechanic, off-hire calls for the purchase team, and formwork shortages to recover. On WhatsApp, Monday 8 AM.' },
    ],
    outputs: ['Service-due list per machine', 'Off-hire alerts with rent saved', 'Formwork and scaffolding tally by site and contractor', 'Certificate and insurance calendar'],
    helps: [
      { figure: '9 days', text: 'idle on hire is about ₹25,000 of rent on one illustrative backhoe. The alert pays for the month' },
      { figure: '250 h', text: 'service intervals tracked from the hour-meter photos operators already send' },
      { figure: '5–10%', text: 'of formwork that typically goes missing at the end of a project, now tallied by site and contractor' },
    ],
  },
]
