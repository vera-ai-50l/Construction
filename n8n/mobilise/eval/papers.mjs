// Desk 05 eval: sample papers with known answers.
// `fields` is what a careful reader copies off the paper (the answer key for the reading step);
// `expect` and `failing` are what the paper checks must then decide.
//
// Invented documents for the sample site (Sample Tower B, Thane; contractor Shree Ganesh
// Constructions Pvt. Ltd.; start 2026-11-20; contract ₹125 crore; peak labour 450). Every page
// carries a "SAMPLE FOR TESTING" watermark. Issuer names are made up. Each case says which
// line the paper belongs to, what must be read off it, and what the paper checks must decide.

export const SITE = {
  project: 'Sample Tower B, Thane', contractor_name: 'Shree Ganesh Constructions Pvt. Ltd.', contractor_aliases: ['SGC', 'Shree Ganesh Construction'],
  site_address: 'Plot 12, Majiwada, Thane West', site_keywords: ['majiwada', 'plot 12'],
  start_date: '2026-11-20', visit_date: '2026-11-18', contract_end: '2028-05-31', contract_value_inr: 1_250_000_000, peak_workers: 450, template_version: 'mob-v1',
}

const CO = 'Shree Ganesh Constructions Pvt. Ltd.'
const ADDR = 'Plot No. 12, Majiwada, Thane (West) 400601, Maharashtra'
const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`

const policy = ({ title, insurer, no, rows, foot }) => `
  <div class="hd"><div class="logo">${insurer}</div><div class="doc">${title}</div></div>
  <p class="no">Policy No. ${no}</p>
  <table class="kv">${rows.join('')}</table>
  <p class="foot">${foot}</p>
  <div class="sig"><div>For ${insurer}<br><br><i>Authorised Signatory</i></div><div class="stamp">ISSUED</div></div>`

export const CASES = [
  {
    id: 'car-ok', line: 'PAP-04', docType: 'car_policy', expect: 'accepted',
    fields: { holder_name: CO, site_address: ADDR, valid_from: '2026-11-01', valid_to: '2028-08-31', sum_insured_inr: 1_300_000_000, principal_named: true },
    html: policy({
      title: "Contractor's All Risks Insurance · Policy Schedule", insurer: 'Sahyadri General Assurance Ltd.', no: 'CAR/2026/MH/004417',
      rows: [row('Insured', `${CO} (Contractor)<br>Sample Developers Ltd. (Principal)`), row('Project', 'Sample Tower B, residential tower, G+32'), row('Project address', ADDR),
        row('Period of insurance', '01-11-2026 to 31-08-2028 (both days inclusive)'), row('Sum insured (contract works)', '₹ 1,30,00,00,000 (Rupees One Hundred Thirty Crore)'),
        row('Third party liability', '₹ 5,00,00,000 any one accident'), row('Deductible', '₹ 2,50,000 each claim')],
      foot: 'Principal is named as an additional insured for the contract works. Subject to the terms of the CAR policy wording.',
    }),
  },
  {
    id: 'car-low-sum', line: 'PAP-04', docType: 'car_policy', expect: 'rejected', failing: ['sumInsuredCoversContract'],
    fields: { holder_name: CO, site_address: ADDR, valid_from: '2026-11-01', valid_to: '2028-08-31', sum_insured_inr: 900_000_000, principal_named: true },
    html: policy({
      title: "Contractor's All Risks Insurance · Policy Schedule", insurer: 'Sahyadri General Assurance Ltd.', no: 'CAR/2026/MH/004502',
      rows: [row('Insured', `${CO} (Contractor)<br>Sample Developers Ltd. (Principal)`), row('Project address', ADDR),
        row('Period of insurance', '01-11-2026 to 31-08-2028'), row('Sum insured (contract works)', '₹ 90,00,00,000 (Rupees Ninety Crore)'), row('Third party liability', '₹ 5,00,00,000')],
      foot: 'Principal is named as an additional insured.',
    }),
  },
  {
    id: 'labour-licence-ok', line: 'PAP-02', docType: 'labour_licence', expect: 'accepted',
    fields: { holder_name: CO, site_address: ADDR, valid_from: '2026-10-12', valid_to: '2027-12-31', workers_covered: 500 },
    html: `<div class="hd gov"><div class="logo">Office of the Licensing Officer<br>Thane Division</div><div class="doc">Licence to Engage Contract Labour</div></div>
      <p class="no">Licence No. TNE/CL/2026/1187 · Date of issue: 12-10-2026</p>
      <table class="kv">${[row('Name of contractor', CO), row('Address of establishment', ADDR), row('Nature of work', 'Civil construction of residential tower'),
        row('Maximum number of workers to be employed', '500 (Five Hundred)'), row('Valid from', '12-10-2026'), row('Valid up to', '31-12-2027')].join('')}</table>
      <p class="foot">This licence is subject to the conditions printed overleaf. The licensee shall display this licence at the work site.</p>
      <div class="sig"><div><br><br><i>Licensing Officer</i></div><div class="stamp round">THANE</div></div>`,
  },
  {
    id: 'labour-licence-300', line: 'PAP-02', docType: 'labour_licence', expect: 'rejected', failing: ['coversPeakWorkers'],
    fields: { holder_name: CO, site_address: ADDR, valid_from: '2026-10-20', valid_to: '2027-12-31', workers_covered: 300 },
    html: `<div class="hd gov"><div class="logo">Office of the Licensing Officer<br>Thane Division</div><div class="doc">Licence to Engage Contract Labour</div></div>
      <p class="no">Licence No. TNE/CL/2026/1203 · Date of issue: 20-10-2026</p>
      <table class="kv">${[row('Name of contractor', CO), row('Address of establishment', ADDR), row('Maximum number of workers to be employed', '300 (Three Hundred)'),
        row('Valid from', '20-10-2026'), row('Valid up to', '31-12-2027')].join('')}</table>
      <div class="sig"><div><br><br><i>Licensing Officer</i></div><div class="stamp round">THANE</div></div>`,
  },
  {
    id: 'wc-expiring', line: 'PAP-03', docType: 'wc_policy', expect: 'rejected', failing: ['validBeyondStart'],
    fields: { holder_name: CO, valid_from: '2025-12-21', valid_to: '2026-12-20', workers_covered: 500 },
    html: policy({
      title: "Employees' Compensation Insurance · Schedule", insurer: 'Konkan Mutual General Insurance Co. Ltd.', no: 'EC/26/112093',
      rows: [row('Name of insured', CO), row('Business', 'Building construction contractor'), row('Location', ADDR),
        row('Period', '21-12-2025 to 20-12-2026'), row('Number of employees covered', '500'), row('Estimated wages', '₹ 18,00,00,000')],
      foot: 'Covers liability under the Employees\' Compensation Act, 1923 as applicable.',
    }),
  },
  {
    id: 'registration-wrong-site', line: 'PAP-01', docType: 'establishment_registration', expect: 'rejected', failing: ['siteMatches'],
    fields: { holder_name: CO, site_address: 'Survey No. 41, Wagle Estate, Thane (West) 400604', valid_to: '2029-03-31', workers_covered: 500 },
    html: `<div class="hd gov"><div class="logo">Registering Officer<br>Thane Division</div><div class="doc">Certificate of Registration of Establishment</div></div>
      <p class="no">Registration No. TNE/REG/2025/0874</p>
      <table class="kv">${[row('Name of employer', CO), row('Location of establishment', 'Survey No. 41, Wagle Estate, Thane (West) 400604'), row('Nature of work', 'Building construction'),
        row('Maximum number of workers', '500'), row('Date of registration', '05-06-2025'), row('Valid up to', '31-03-2029')].join('')}</table>
      <div class="sig"><div><br><br><i>Registering Officer</i></div><div class="stamp round">THANE</div></div>`,
  },
  {
    id: 'calibration-ok', line: 'PAP-06', docType: 'calibration_certificate', expect: 'accepted',
    fields: { issue_date: '2026-09-15', next_due_date: '2027-03-15' },
    html: `<div class="hd"><div class="logo">Precision Weighing Calibration Lab (sample)</div><div class="doc">Calibration Certificate</div></div>
      <p class="no">Certificate No. PWC/26/3391 · Lab accreditation: SAMPLE-0000</p>
      <table class="kv">${[row('Customer', CO), row('Equipment', 'Concrete batching plant, 60 m³/h: cement, water and aggregate weigh batchers; admixture dispenser'),
        row('Serial number', 'BP60-2219'), row('Site', ADDR), row('Date of calibration', '15-09-2026'), row('Next calibration due', '15-03-2027'), row('Result', 'Within ±1% on all batchers')].join('')}</table>
      <div class="sig"><div><br><br><i>Calibrated by</i></div><div><br><br><i>Approved by</i></div></div>`,
  },
  {
    id: 'worker-list-aadhaar', line: 'PAP-14', docType: 'worker_list', expect: 'rejected', failing: ['idMasked'],
    fields: { contains_unmasked_id: true },
    html: `<div class="hd"><div class="logo">${CO}</div><div class="doc">Worker list and ID check · Sample Tower B</div></div>
      <table class="grid"><tr><th>#</th><th>Name</th><th>Trade</th><th>Aadhaar number</th><th>Induction</th></tr>
      ${[['Ramesh Yadav', 'Mason', '2345 6789 0123'], ['Suresh Patil', 'Bar bender', '3456 7890 1234'], ['Mohd. Arif', 'Carpenter', '4567 8901 2345'], ['Sunita Bai', 'Helper', '5678 9012 3456'], ['Dinesh Kumar', 'Electrician', '6789 0123 4567']]
        .map((w, i) => `<tr><td>${i + 1}</td><td>${w[0]}</td><td>${w[1]}</td><td>${w[2]}</td><td>Planned 19-11-2026</td></tr>`).join('')}</table>
      <p class="foot">Total workers in first batch: 5 (list continues).</p>`,
  },
]

// The same two papers photographed on a phone, at an angle, on a desk.
export const PHOTO_CASES = ['car-ok', 'labour-licence-300']

// Voice notes with no line code in them (as Sarvam returns them): AI must pick the line from
// the area's open lines. Derived from the real transcripts in fixtures/sarvam.
export const VOICE = [
  { id: 'voice-lc-toilets', area: 'LC', line: 'LC-03', lang: 'hi-IN', text: 'टॉयलेट ब्लॉक में सिर्फ़ छह टॉयलेट हैं, महिलाओं के लिए अलग नहीं है, पानी की टंकी खाली है।' },
  { id: 'voice-sy-cement', area: 'SY', line: 'SY-01', lang: 'mr-IN', text: 'सिमेंटचा शेड ठीक आहे, पण पोती भिंतीला लागून ठेवली आहेत, बारा पोती उंच थप्पी आहेत.' },
  { id: 'voice-sf-earthing', area: 'SF', line: 'SF-08', lang: 'hi-IN', text: 'मेन डीबी चेक किया, आरसीसीबी लगा है, बट अर्थिंग पिट का टेस्ट रिपोर्ट नहीं है, कल तक भेजने को बोला है।' },
  { id: 'voice-bp-lab', area: 'BP', line: 'BP-06', lang: 'en-IN', text: 'Site lab has the compression testing machine, calibration sticker is from March, cube molds are only 12.' },
]

export const PAGE_CSS = `@page{size:A4;margin:0}body{margin:0;font:13px/1.45 "Noto Serif","Times New Roman",serif;color:#1b1b1b}
.page{position:relative;width:210mm;min-height:297mm;padding:18mm 18mm;box-sizing:border-box;overflow:hidden;background:#fff}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}.wm span{transform:rotate(-30deg);font:700 54px/1 Arial,sans-serif;color:rgba(200,30,30,.13);letter-spacing:4px;white-space:nowrap}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px double #333;padding-bottom:8px;margin-bottom:10px}.logo{font:700 16px/1.25 Arial,sans-serif;color:#123c69}.hd.gov .logo{color:#1b1b1b}
.doc{font:700 15px/1.2 Arial,sans-serif;text-align:right;max-width:55%}.no{font-family:monospace;font-size:12px;margin:4px 0 12px}
table.kv{border-collapse:collapse;width:100%}table.kv th{width:38%;text-align:left;vertical-align:top;font-weight:600;padding:7px 8px;border:1px solid #bbb;background:#f4f4f4}table.kv td{padding:7px 8px;border:1px solid #bbb}
table.grid{border-collapse:collapse;width:100%;margin-top:10px}table.grid th,table.grid td{border:1px solid #999;padding:6px 7px;text-align:left}table.grid th{background:#eee}
.foot{font-size:11.5px;color:#333;margin-top:14px}.sig{display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px}.stamp{border:3px solid #2a4fa3;color:#2a4fa3;font:700 15px Arial;padding:6px 14px;transform:rotate(-8deg)}.stamp.round{border-radius:50%;padding:22px 12px}`
