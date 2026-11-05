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
    { source: 'WhatsApp · Baner', before: 'No message yesterday', issue: 'A silent site goes unnoticed', after: 'In the 8 AM brief: no report', step: 4 },
  ],
  'free-issue': [
    { source: 'Issue slips', before: 'Cement slips FI/TC/0121–0138', issue: 'Never set against the measurement book', after: '1,629 bags used · 1,500 allowed · 129 over', step: 2 },
    { source: 'Bar bending schedule', before: 'Steel for floors L9 and L10', issue: 'Wastage estimated, not measured', after: '3.054 MT beyond BBS + 3%', step: 2 },
    { source: 'Scrap yard', before: 'Two weighbridge slips of scrap', issue: 'Expected scrap never worked out', after: '3.523 MT not returned · ₹1,19,782', step: 3 },
    { source: 'RA-02 bill', before: '₹31,937.50 already deducted', issue: 'Could be deducted twice', after: 'Netted off · RA-01 line now ₹2,737.50', step: 4 },
    { source: 'Issue slips', before: '2 slips with no contractor signature', issue: 'Would be disputed', after: 'Marked Check · ₹54,750 held back', step: 5 },
    { source: 'RA-04 bill', before: 'Deduction for the month', issue: 'Argued from estimates', after: 'Debit note ₹4,04,699.50 with every reference', step: 6 },
  ],
  'plant-desk': [
    { source: 'Operator WhatsApp', before: 'DG 125 kVA diesel log', issue: 'Litres never set against hours', after: '3.9 L/h vs 3.1 norm · check diesel', step: 1 },
    { source: 'Hour-meter photo', before: 'Transit mixer TM-04 · 262 h', issue: 'Service was due at 250 h', after: 'Overdue · mechanic booked Tuesday', step: 2 },
    { source: 'Hire register', before: 'Hired backhoe, Nashik', issue: 'Idle 9 days, rent still running', after: 'Off-hire call · save ₹25,200', step: 3 },
    { source: 'Plant list', before: 'Concrete pump idle at Hinjewadi', issue: 'Kharadi plans to hire one', after: 'Move it instead of hiring', step: 3 },
    { source: 'Formwork challans', before: 'Cup-lock: 1,200 sent, 1,086 back', issue: 'Contractor leaves on Friday', after: '114 short · charge before exit', step: 4 },
    { source: 'Certificates file', before: 'Tower crane TC-2 load test', issue: 'Expires in 12 days', after: 'Inspection booked · gate stays open', step: 5 },
  ],
  surplus: [
    { source: 'Baner stores', before: 'TMT 12 mm · 6.2 MT', issue: 'No slab left that uses it', after: 'Surplus ₹3.8 L listed for other sites', step: 1 },
    { source: 'Baner stores', before: '340 bags OPC 53, made week 36', issue: '68 days old and ageing', after: 'Use first · move this week', step: 2 },
    { source: 'Nashik stores', before: 'Tile adhesive · 42 bags', issue: 'Expires in 5 weeks', after: 'Offered to Kharadi finishing', step: 2 },
    { source: 'Transport', before: 'Baner to Kharadi · 12 km', issue: 'Nobody priced the move', after: 'Saves ₹80,200 after ₹3,400 transport', step: 3 },
    { source: 'Purchase request', before: 'PR/KH/233 · 220 bags for Kharadi', issue: 'About to become a PO', after: 'PO held · transfer from Baner', step: 4 },
    { source: 'Both sites’ books', before: 'Stock moved by truck', issue: 'Transfer never recorded', after: 'Transfer note + Tally stock journal', step: 5 },
  ],
}
