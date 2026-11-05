// After a run: who gets which part, and a WhatsApp thread where that person asks follow-up
// questions and Vera answers from the same records. Sample data; figures match the mocks.

export type Route = { icon: string; role: string; gets: string; when: string }
export type Msg = { from: 'vera' | 'them'; text: string; files?: string[] }
export type Chat = { routes: Route[]; phone: { who: string; sub: string }; msgs: Msg[] }

export const chats: Record<string, Chat> = {
  'leak-check': {
    routes: [
      { icon: 'Crown', role: 'MD / owner', gets: '1-page ₹ summary: ₹16.1 L, recover vs stop', when: 'WhatsApp + PDF, Monday 9 AM' },
      { icon: 'ShoppingCart', role: 'Purchase head', gets: 'Supplier claim list with challan numbers, draft debit notes', when: 'WhatsApp + Excel' },
      { icon: 'Bank', role: 'Accounts', gets: 'Hold payment on the duplicate invoice until the supplier replies', when: 'WhatsApp, same day' },
      { icon: 'HardHat', role: 'Site engineer, Wing B', gets: 'Steel overuse by supervisor, with issue slip numbers', when: 'WhatsApp' },
      { icon: 'Warehouse', role: 'Stores in-charge', gets: '800 bags extra: hold the next cement order', when: 'WhatsApp' },
    ],
    phone: { who: 'Vera · Purchase', sub: 'to Purchase head · Kharadi site' },
    msgs: [
      { from: 'vera', text: 'Supplier claims · Kharadi · Jul–Sep\n₹7.5 L to recover from 3 suppliers.\n1. Shree Balaji Steels: SBS/0712 billed twice, ₹4.8 L\n2. Short at the gate, 4 steel loads, ₹2.2 L\n3. Cement ₹24/bag above PO, ₹0.5 L\nReply with a number for the proof.', files: ['Claim list.xlsx', 'Draft debit notes.pdf'] },
      { from: 'them', text: '1 ka proof bhejo' },
      { from: 'vera', text: 'SBS/0712 · TMT 16 mm · 8.2 MT\nReceived 6 Oct, gate entry + weighbridge WB-0026.\nBilled on INV-SBS-012 (7 Oct) and again on INV-SBS-012-R. Both passed for payment.', files: ['Challan SBS-0712.pdf', 'INV-SBS-012 + 012-R.pdf', 'WB-0026.pdf'] },
      { from: 'them', text: 'Accounts ko bolo payment hold kare' },
      { from: 'vera', text: 'Sent to Accounts: hold ₹4.8 L on INV-SBS-012-R until Shree Balaji replies. I’ll remind you on Thursday if there is no reply.' },
    ],
  },
  'site-desk': {
    routes: [
      { icon: 'Crown', role: 'Owner', gets: 'The 8 AM brief: all sites, money at risk', when: 'WhatsApp, 8 AM daily' },
      { icon: 'HardHat', role: 'Each site engineer', gets: 'Only their site: open hindrances, stock that will run out', when: 'WhatsApp, 8 AM' },
      { icon: 'Bank', role: 'Accounts', gets: 'RA bills unpaid or returned, with days pending', when: 'WhatsApp + Tally file' },
      { icon: 'ShoppingCart', role: 'Purchase', gets: 'Deliveries with no PO, shortages for tomorrow', when: 'WhatsApp' },
    ],
    phone: { who: 'Vera · Site brief', sub: 'to Owner · reply to ask anything' },
    msgs: [
      { from: 'vera', text: 'Money at risk: ₹63.8 L across 4 sites. Reply with a site or a number for details.' },
      { from: 'them', text: 'Hinjewadi RA-04 kyun return hua?' },
      { from: 'vera', text: 'Returned 2 Nov: the JMR for PEB frames is not signed by the client’s engineer. ₹18.6 L. Site engineer says the signature is expected Friday.', files: ['RA-04 return note.pdf'] },
      { from: 'them', text: 'Nashik mein kal kitne log?' },
      { from: 'vera', text: 'No plan for tomorrow from Nashik yet. I’ve asked the supervisor and will update you by 10 AM.' },
      { from: 'them', text: 'ok, RA-04 ka Thursday ko yaad dilana' },
      { from: 'vera', text: 'Done. Reminder for Thursday 10 AM to chase the JMR signature.' },
    ],
  },
  'free-issue': {
    routes: [
      { icon: 'Calculator', role: 'QS / billing engineer', gets: 'Recovery pack: draft debit note, CSV for the RA bill', when: 'WhatsApp + PDF + CSV' },
      { icon: 'Handshake', role: 'Contractor’s PM', gets: 'Statement with every slip, for acknowledgement before the bill', when: 'WhatsApp + PDF' },
      { icon: 'Crown', role: 'Project manager', gets: 'Wastage by contractor vs contract allowance', when: 'Each RA period' },
      { icon: 'Warehouse', role: 'Stores', gets: 'Slips still unsigned, scrap yet to come back', when: 'WhatsApp' },
    ],
    phone: { who: 'Vera · Free-issue', sub: 'to QS · RA-04 recovery pack' },
    msgs: [
      { from: 'vera', text: 'RA-04 recovery pack ready for Contractor A.\nHigh ₹4,04,699.50 · Check ₹54,750\nCheck lines need the contractor’s signature before deduction.', files: ['DN draft RA-04.pdf', 'RA-04 recovery.csv'] },
      { from: 'them', text: 'Scrap ₹1.19 L kaise aaya?' },
      { from: 'vera', text: 'Steel cutting loss within the 3% allowance should come back as weighed scrap: 3.523 MT for RA-01 to RA-03. The store received none against it. 3.523 MT × ₹34,000 = ₹1,19,782.', files: ['BBS L7–L10.pdf', 'Yard counts.pdf'] },
      { from: 'them', text: 'Check wale contractor ko bhejo' },
      { from: 'vera', text: 'Sent to Contractor A’s PM with the two unsigned slips. I’ll move them to High once they are signed.' },
    ],
  },
  'plant-desk': {
    routes: [
      { icon: 'Wrench', role: 'Mechanic', gets: 'Service bookings: TM-04 overdue at 262 h', when: 'WhatsApp, Monday 8 AM' },
      { icon: 'ShoppingCart', role: 'Purchase', gets: 'Off-hire calls with the rent saved', when: 'WhatsApp, same day' },
      { icon: 'HardHat', role: 'Site in-charge', gets: 'Formwork short before the contractor leaves', when: 'WhatsApp' },
      { icon: 'Crown', role: 'Plant head', gets: 'Weekly plant brief: idle, due, certificates', when: 'WhatsApp, Monday 8 AM' },
    ],
    phone: { who: 'Vera · Plant', sub: 'to Plant head · weekly brief' },
    msgs: [
      { from: 'vera', text: 'Plant brief: 1 overdue service, 1 off-hire (save ₹25,200), 114 cup-lock ledgers short at Baner, TC-2 load test due in 12 days.' },
      { from: 'them', text: 'Kharadi ko pump kab chahiye?' },
      { from: 'vera', text: 'Slab L4 pour on 12 Nov, 8 hours. The Hinjewadi pump is idle since 1 Nov, 28 km away. Moving it costs ₹6,500; hiring for the day costs ₹18,000.' },
      { from: 'them', text: 'Move karo' },
      { from: 'vera', text: 'Move note sent to the Hinjewadi in-charge and the Kharadi PM. Kharadi’s pump hire request is on hold.' },
    ],
  },
  surplus: {
    routes: [
      { icon: 'ShoppingCart', role: 'Buyer', gets: 'Before-PO check: stock already at another site', when: 'WhatsApp, when a PR is raised' },
      { icon: 'Warehouse', role: 'Both storekeepers', gets: 'Transfer note for the truck', when: 'WhatsApp + PDF' },
      { icon: 'Bank', role: 'Accounts', gets: 'Tally stock journal so both books stay right', when: 'Tally import file' },
      { icon: 'Crown', role: 'Owner', gets: 'Surplus by site, valued, ageing first', when: 'Monthly' },
    ],
    phone: { who: 'Vera · Purchase', sub: 'to Buyer · PR/KH/233' },
    msgs: [
      { from: 'vera', text: 'PR/KH/233 · 220 bags OPC 53 for Kharadi.\nBaner has 340 bags, 12 km away. Transfer saves ₹80,200 after ₹3,400 transport. Transfer instead of a PO?' },
      { from: 'them', text: '68 din purana cement theek hai?' },
      { from: 'vera', text: 'Made in week 36. Within your 90-day rule until 24 Nov. Kharadi uses all 220 bags by 14 Nov.' },
      { from: 'them', text: 'Approve' },
      { from: 'vera', text: 'Transfer note TN/BN-KH/014 sent to both stores. Tally stock journal ready. PR/KH/233 closed without a PO.', files: ['TN-BN-KH-014.pdf'] },
    ],
  },
}
