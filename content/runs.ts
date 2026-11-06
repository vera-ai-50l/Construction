// What each desk's "Run the flow" demo fixes, row by row. `step` is the index of the
// flow step (content/desks.ts) that catches the problem. Figures match the output mocks
// and are illustrative sample data.

export type RunRow = { source: string; before: string; issue: string; after: string; step: number }

export const runs: Record<string, RunRow[]> = {
  'leak-check': [
    { source: 'Challan register', before: 'Challan SBS/0712 on INV-SBS-012 and 012-R', issue: 'Both passed for payment', after: '2 challans billed twice · recover ₹4.8 L', step: 1 },
    { source: 'Gate book', before: '4 steel loads under challan weight', issue: 'Paid at challan weight', after: 'Short beyond 0.5% · recover ₹2.2 L', step: 1 },
    { source: 'Supplier bills', before: 'Cement billed at ₹396 a bag', issue: 'PO rate is ₹372', after: '₹24 a bag above PO · recover ₹0.5 L', step: 1 },
    { source: 'Stores issue slips', before: 'Wing B issued 52.0 MT steel', issue: 'Never compared with the work done', after: '7.2 MT beyond allowance · ₹4.5 L', step: 2 },
    { source: 'Stores issue slips', before: 'Cement and AAC issued, wings A and B', issue: 'No norm applied', after: '620 bags + 2,850 blocks over · ₹4.1 L', step: 2 },
    { source: 'Book stock', before: '1,900 bags cement in the yard', issue: 'Next 8 weeks need 1,100', after: '800 bags extra · hold the next order', step: 3 },
  ],
  'site-desk': [
    { source: 'WhatsApp · Kharadi', before: 'Voice note, 0:42, Hindi', issue: 'Nobody listens till evening', after: '56 people · slab L3 shuttering 70%', step: 1 },
    { source: 'WhatsApp · Kharadi', before: 'Photo of challan, 400 bags', issue: 'Not in the stores register', after: 'Receipt logged to PO/KH/118 · Tally line ready', step: 2 },
    { source: 'WhatsApp · Hinjewadi', before: '“Crane band hai, 4 ghante”', issue: 'Lost in the group chat', after: 'Hindrance: 4 h, 16 idle, photo attached', step: 2 },
    { source: 'RA bill tracker', before: 'RA-07 submitted 41 days ago', issue: 'Nobody is chasing it', after: '₹44.1 L at risk · call accounts at 10', step: 3 },
    { source: 'WhatsApp · Kharadi', before: '“Cement 60 bag bacha hai”', issue: 'Tomorrow’s pour needs 220', after: 'Shortage flagged before the pour', step: 3 },
    { source: 'Planning team', before: 'Weekly report typed from 7 daily reports', issue: 'Ready on Wednesday, figures differ', after: 'Monday 9 AM: planned against done, per site', step: 4 },
  ],
  'plant-desk': [
    { source: 'Operator WhatsApp', before: 'DG 125 kVA diesel log', issue: 'Litres never set against hours', after: '3.9 L/h vs 3.1 norm · check diesel', step: 1 },
    { source: 'Hour-meter photo', before: 'Transit mixer TM-04 · 262 h', issue: 'Service was due at 250 h', after: 'Overdue · mechanic booked Tuesday', step: 2 },
    { source: 'Hire register', before: 'Hired backhoe, Nashik', issue: 'Idle 9 days, rent still running', after: 'Off-hire call · save ₹25,200', step: 3 },
    { source: 'Plant list', before: 'Concrete pump idle at Hinjewadi', issue: 'Kharadi plans to hire one', after: 'Move it instead of hiring', step: 3 },
    { source: 'Formwork challans', before: 'Cup-lock: 1,200 sent, 1,086 back', issue: 'Contractor leaves on Friday', after: '114 short · charge before exit', step: 4 },
    { source: 'Certificates file', before: 'Tower crane TC-2 load test', issue: 'Expires in 12 days', after: 'Inspection booked · gate stays open', step: 5 },
  ],
  'stock-balance': [
    { source: '6 site stores', before: 'Stock kept in 6 separate registers', issue: 'Nobody sees the total', after: 'One sheet: ₹1.9 Cr of stock across 6 sites', step: 0 },
    { source: 'Baner', before: 'TMT 16 mm · 30 MT in the yard', issue: 'No slab needs it for 9 weeks', after: 'Excess ₹18.6 L · offered to other sites', step: 2 },
    { source: 'Kharadi', before: '340 bags OPC 53, made week 36', issue: 'Ageing in a damp store', after: 'Move first · Wagholi pours next week', step: 2 },
    { source: 'Chakan', before: 'Slab L9 in 2 weeks needs 24 MT', issue: 'PO for 24 MT about to go out', after: 'Send from Baner, 40 km · ₹14.9 L not bought', step: 3 },
    { source: 'Purchase', before: '14 purchase requests from 6 sites', issue: 'Each site buys for itself', after: 'One buy list: 5 items no site can spare', step: 4 },
    { source: 'Both sites’ books', before: 'Steel moved by truck', issue: 'Transfer never recorded', after: 'Transfer note + Tally stock journal', step: 5 },
  ],
  wastage: [
    { source: 'Stores issue slips', before: '312 slips, Tower C, October', issue: 'No supervisor name on 9', after: '303 tied to a supervisor · 9 back to stores', step: 0 },
    { source: 'BOQ progress', before: 'Work done kept by wing only', issue: 'Cannot be split by supervisor', after: 'Floor 7 · 118 m³ concrete · Supervisor A', step: 1 },
    { source: 'Floor 7 · Supervisor A', before: '1,005 bags cement issued', issue: 'No limit applied', after: 'Allowed 963 (944 + 2%) · 42 over · ₹15,120', step: 3 },
    { source: 'Floor 5 · Supervisor B', before: '21.4 MT steel issued', issue: 'Hidden in the site total', after: 'Allowed 20.9 (with 3%) · 0.5 MT over · ₹31,000', step: 3 },
    { source: 'Floor 8 · Supervisor C', before: '880 bags cement issued', issue: 'Assumed over, like Floor 7', after: 'Within the limit · allowed 892', step: 3 },
    { source: 'Month end', before: 'Site total: cement 1.1% over', issue: 'Hides who is over', after: 'Ranked table to the PM · each supervisor gets their lines', step: 4 },
  ],
  'site-opening': [
    { source: 'Contractor WhatsApp', before: '14 certificates sent as photos', issue: 'Checked by hand on the day', after: '12 in order · 2 flagged before the visit', step: 1 },
    { source: 'CAR insurance', before: 'Policy for ₹42 Cr', issue: 'Contract value is ₹58 Cr', after: 'Under-insured · on the missing list', step: 1 },
    { source: 'Labour licence', before: 'Valid to 30 September', issue: 'Lapsed before mobilisation', after: 'Renewal asked for the same evening', step: 2 },
    { source: 'Site walk', before: 'Photos on the engineer’s own phone', issue: 'Sorted into the report later', after: '86 photos tagged to checklist lines, with location', step: 3 },
    { source: 'Site walk', before: '“Camp mein toilet 6 hai, chahiye 9”', issue: 'Remark in a notebook', after: 'Line 14 · camp toilets 6 of 9 · open item', step: 4 },
    { source: 'Inspection report', before: 'Typed up over two days', issue: 'The go-ahead waits for it', after: 'Draft at 6 PM · 78 of 86 lines pass · 8 open', step: 5 },
  ],
}
