// After a run: who gets which part, and a WhatsApp thread where that person asks follow-up
// questions and Vera answers from the same records. Sample data; figures match the mocks.

export type Route = { icon: string; role: string; gets: string; when: string }
export type Msg = { from: 'vera' | 'them'; text: string; files?: string[] }
export type Chat = { routes: Route[]; phone: { who: string; sub: string }; msgs: Msg[] }

const PLANT: Chat = {
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
}

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
      { icon: 'ChartLineUp', role: 'Projects / planning', gets: 'Weekly progress: planned against done, per site', when: 'PDF + Excel, Monday 9 AM' },
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
  'stock-balance': {
    routes: [
      { icon: 'ShoppingCart', role: 'Purchase head', gets: 'One buy list for all sites: only what no site can spare', when: 'WhatsApp + Excel, Monday 9 AM' },
      { icon: 'Warehouse', role: 'Sending site: stores + supervisor', gets: 'What to load, for which site, on which day', when: 'WhatsApp + transfer note' },
      { icon: 'HardHat', role: 'Receiving site supervisor', gets: 'What is arriving and when, so no PO is raised', when: 'WhatsApp' },
      { icon: 'Bank', role: 'Accounts', gets: 'Tally stock journal so both books stay right', when: 'Tally import file' },
      { icon: 'Crown', role: 'MD', gets: 'Cash stuck in excess stock, by site', when: 'WhatsApp, Monday' },
    ],
    phone: { who: 'Vera · Stock balance', sub: 'to Purchase head · Monday sheet' },
    msgs: [
      { from: 'vera', text: 'Stock balance · week 45 · 6 sites\nExcess ₹31.2 L. Short ₹22.4 L in the next 4 weeks.\n3 transfers cover ₹18.3 L of the shortage.\nBuy list: 5 items, ₹4.1 L.', files: ['Stock balance wk45.xlsx'] },
      { from: 'them', text: 'Chakan ka steel PO roko?' },
      { from: 'vera', text: 'Yes. Baner has 30 MT TMT 16 mm and no slab using it for 9 weeks. Chakan needs 26 MT for slab L9 on 18 Nov. Truck cost ₹14,000. ₹16.1 L not spent.' },
      { from: 'them', text: 'Theek hai, bhejo' },
      { from: 'vera', text: 'Transfer note TN/BN-CK/021 sent to Ramesh (Baner stores) and Sunil (Chakan supervisor): 26 MT, loading Wednesday. Chakan PR closed. Tally journal ready.', files: ['TN-BN-CK-021.pdf'] },
    ],
  },
  wastage: {
    routes: [
      { icon: 'Crown', role: 'Project manager', gets: 'Supervisors ranked by ₹ over the limit, with slip numbers', when: 'WhatsApp + Excel, 1st of the month' },
      { icon: 'HardHat', role: 'Each supervisor', gets: 'Only their own floors and lines, with the slips', when: 'WhatsApp' },
      { icon: 'Warehouse', role: 'Stores in-charge', gets: 'Slips with no supervisor name, to fill in', when: 'WhatsApp, same day' },
      { icon: 'Ruler', role: 'QS / planning', gets: 'The norms and limits used, to change if needed', when: 'Excel' },
    ],
    phone: { who: 'Vera · Wastage', sub: 'to Project manager · Tower C' },
    msgs: [
      { from: 'vera', text: 'Wastage over limit · Tower C · October\n₹65,670 over the allowed limit.\nB ₹31,000 · A ₹27,520 · D ₹7,150 · C within the limit.\nReply with a name for details.', files: ['Wastage by supervisor.xlsx'] },
      { from: 'them', text: 'A ka detail' },
      { from: 'vera', text: 'Supervisor A · Floor 7\nCement: 1,005 bags issued, 963 allowed (944 + 2%). 42 over, ₹15,120.\nSteel: 0.2 MT over, ₹12,400.\n11 issue slips attached.', files: ['Floor 7 issue slips.pdf'] },
      { from: 'them', text: 'Pichle mahine bhi?' },
      { from: 'vera', text: 'September: 18 bags over on Floor 6, ₹6,480. Over the limit two months running. B was within the limit in September.' },
      { from: 'them', text: 'A ko bhejo, kal tak jawab chahiye' },
      { from: 'vera', text: 'Sent to Supervisor A with the 11 slips. I’ll remind you tomorrow at 6 PM if there is no reply.' },
    ],
  },
  'site-opening': {
    routes: [
      { icon: 'HardHat', role: 'Contractor’s project manager', gets: 'Missing and expired papers, 3 days before the visit', when: 'WhatsApp, same evening' },
      { icon: 'ListChecks', role: 'Inspecting engineer', gets: 'The checklist on the phone, with documents already checked', when: 'On the day' },
      { icon: 'ShieldCheck', role: 'Safety officer', gets: 'Safety open items, each with its photo', when: 'WhatsApp' },
      { icon: 'Crown', role: 'Head of projects', gets: 'The draft report and open items, for the go-ahead', when: 'WhatsApp + PDF, 6 PM' },
    ],
    phone: { who: 'Vera · Site opening', sub: 'to Head of projects · Tower B' },
    msgs: [
      { from: 'vera', text: 'Site opening · Tower B\nInspection done today, 9:40 AM to 4:10 PM.\n78 of 86 lines pass. 8 open, none stops work.\nDraft report attached.', files: ['Inspection report (draft).pdf'] },
      { from: 'them', text: 'Kya open hai?' },
      { from: 'vera', text: '1. CAR insurance below contract value (renewal asked)\n2. Labour camp toilets: 6 of 9\n3. Fire extinguishers at stores not tagged\nand 5 small items. Each has a photo.' },
      { from: 'them', text: 'Safety wale kab tak?' },
      { from: 'vera', text: 'The contractor says Thursday. I’ll ask for photos on Thursday at 5 PM and close the lines on them, with no second visit.' },
      { from: 'them', text: 'Conditional go-ahead draft bana do' },
      { from: 'vera', text: 'Drafted, listing the 8 open items with their dates. Sent to you for signature.', files: ['Conditional go-ahead (draft).pdf'] },
    ],
  },
  'plant-desk': PLANT,
}
