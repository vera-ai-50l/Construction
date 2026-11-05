// Everything the demo page says about each offer lives here, so copy and figures
// can be changed in one place. Figures are illustrative (a typical ₹100–300 Cr
// contractor); the page labels them as such. Icon names map to components/ui/icons.tsx.

export type Step = { icon: string; title: string; detail: string }
export type Desk = {
  id: string
  num: string
  name: string
  kind: string
  status: 'Working demo' | 'Pilot-ready' | 'Building with first customers'
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
    audience: ['contractor'],
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
      { figure: '₹8.6 L', text: 'stoppable on site: issue beyond what the work needed' },
    ],
  },
  {
    id: 'site-desk',
    num: '02',
    name: 'Site Record Desk',
    kind: 'Monthly · all sites',
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
      { icon: 'PaperPlaneTilt', title: '8 AM brief + Tally', detail: 'A WhatsApp brief for the owner before the day starts, and a Tally import file for the day’s receipts.' },
    ],
    outputs: ['8 AM WhatsApp brief for the owner', 'Daily progress record per site', 'Hindrance register with photos and times', 'Tally receipt-note import'],
    helps: [
      { figure: '13 / 15', text: 'messages turned into records on an illustrative day; the 2 unclear ones flagged, not guessed' },
      { figure: '₹63.8 L', text: 'at risk surfaced before 8 AM: an unpaid RA bill, a returned bill, idle crews, a no-PO delivery' },
      { figure: '0', text: 'new apps for site teams. They keep using WhatsApp' },
    ],
  },
  {
    id: 'free-issue',
    num: '03',
    name: 'Free-Issue Reconciliation',
    kind: 'Developer ↔ contractor · per package',
    status: 'Pilot-ready',
    audience: ['developer', 'contractor'],
    headline: 'Know exactly what to recover in the next RA bill, line by line.',
    problem:
      'The developer issues cement and steel to the contractor free. The contract allows 2–3% wastage and recovers the rest at 1.25× the issue rate. In practice the reconciliation is done late, from estimates, and scrap that should come back to the store never does. Recoveries are missed, or argued away for lack of evidence.',
    inputs: [
      { icon: 'Package', label: 'Free-issue register (slips)' },
      { icon: 'Recycle', label: 'Returns and weighed scrap' },
      { icon: 'Warehouse', label: 'Yard stock counts' },
      { icon: 'Ruler', label: 'Measurement book' },
      { icon: 'Table', label: 'BOQ norms and BBS' },
      { icon: 'Scroll', label: 'RA bills' },
    ],
    steps: [
      { icon: 'Scroll', title: 'Contract & registers', detail: 'Load the contract terms: free-issue materials, allowed wastage per material, recovery multiplier, issue rates, scrap rate.' },
      { icon: 'Warehouse', title: 'Issued − returned − in stock', detail: 'For each contractor, material and RA period: consumed = opening + issued − returned − closing yard stock.' },
      { icon: 'Ruler', title: 'Work done → need', detail: 'Measurement book × norms. Steel comes from the bar bending schedule where there is one. Allowed = need × (1 + contract wastage).' },
      { icon: 'Recycle', title: 'Steel scrap check', detail: 'Cutting loss inside the allowance must come back as weighed scrap. Scrap that never reached the store is recoverable.' },
      { icon: 'Calculator', title: 'Recovery', detail: 'Excess × issue rate × multiplier, minus anything earlier RA bills already deducted. Never counted twice.' },
      { icon: 'SealCheck', title: 'Confidence labels', detail: 'Rule-based. High: signed slips and certified quantities. Medium: a yard count missing, or steel from norms instead of BBS. Check: unsigned slip, certified beyond BOQ, or a data gap.' },
      { icon: 'FileText', title: 'Recovery pack', detail: 'Draft debit note with slip, MB and RA references, a CSV for the bill, and a contractor-by-contractor wastage comparison.' },
    ],
    outputs: ['Draft RA-bill deduction / debit note', 'Evidence trail: slips, MB entries, BBS, RA numbers', 'High / Medium / Check on every line', 'Contractor comparison: wastage % by material'],
    helps: [
      { figure: '5.7%', text: 'steel wastage against 3% allowed for one illustrative contractor, while the other ran at 2.3%' },
      { figure: '₹0', text: 'counted twice: a recovery already taken in RA-02 is subtracted, line by line' },
      { figure: '1 week', text: 'from three months of registers to a ready deduction, under NDA' },
    ],
  },
  {
    id: 'plant-desk',
    num: '04',
    name: 'Plant & Formwork Desk',
    kind: 'Add-on to the Site Record Desk',
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
  {
    id: 'surplus',
    num: '05',
    name: 'Surplus Stock Exchange',
    kind: 'Add-on · across all sites',
    status: 'Building with first customers',
    audience: ['contractor', 'developer'],
    headline: 'Use what is lying at one site before buying it again for another.',
    problem:
      'A site winding down holds 340 bags of cement, 6 MT of steel and half a pallet of tile adhesive. A site 12 km away raises a fresh PO for the same items the same week. Cement passes 90 days in a damp store and loses strength. Leftovers get sold as scrap at the end of the project.',
    inputs: [
      { icon: 'Warehouse', label: 'Stock at each site' },
      { icon: 'Ruler', label: 'Next 8 weeks of planned work' },
      { icon: 'Receipt', label: 'Purchase requests and open POs' },
      { icon: 'Clock', label: 'Batch dates (cement, admixtures)' },
    ],
    steps: [
      { icon: 'Warehouse', title: 'Stock by site', detail: 'Book stock from the stores registers, corrected by the latest physical count, including sites that are closing.' },
      { icon: 'Ruler', title: 'Upcoming need', detail: 'What each site needs in the next 8 weeks, from BOQ progress and the plan. Anything above that is surplus.' },
      { icon: 'Hourglass', title: 'Ageing', detail: 'Cement by manufacture week, admixtures by expiry. Old stock is moved first, to the site that will use it soonest.' },
      { icon: 'ArrowsLeftRight', title: 'Match surplus to need', detail: 'Surplus at one site against need at another, with transport cost. A transfer is suggested only when it saves money.' },
      { icon: 'MagnifyingGlass', title: 'Before-PO check', detail: 'A new purchase request is checked against stock elsewhere. If it exists, the buyer sees the transfer option first.' },
      { icon: 'FileText', title: 'Transfer note + Tally', detail: 'Transfer note for the trucks, and the Tally stock journal so both sites’ books stay right.' },
    ],
    outputs: ['Surplus list by site, valued', 'Transfer suggestions with the saving', 'Before-PO check for the purchase team', 'Ageing stock alerts'],
    helps: [
      { figure: '₹83,600', text: 'PO avoided in an illustrative week: 220 bags moved 12 km for ₹3,400 instead of bought new' },
      { figure: '90 days', text: 'cement ageing caught before strength is lost, and used first' },
      { figure: '1 check', text: 'before every PO: “do we already have this somewhere?”' },
    ],
  },
]
