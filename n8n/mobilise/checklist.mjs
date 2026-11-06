// Desk 05: the mobilisation checklist template (version 1).
//
// One template, copied into the database for each new site (a "mobilisation").
// Every line has a fixed code (LC-03), so a photo, a caption, a reply or a voice
// remark can always point at exactly one line.
//
//   evidence  document  a paper (PDF or photo of a paper). AI reads the fields, code checks them.
//             photo     a site photo. The engineer judges it on the day; AI only files it.
//             both      a paper and a photo.
//   when      paper     expected from the contractor before the visit (T-3 to T-1)
//             walk      checked by the engineer on the day of the visit
//   severity  critical  open = no NOC
//             major     NOC can be given with a dated condition
//             minor     noted in the report
//   rules     deterministic checks on the fields AI read from the paper (see logic.mjs: checkPaper)
//   hint      what good evidence looks like. Used in the AI prompt and shown to the contractor.
//
// Numbers marked "set by QA" are typical values. Lodha QA / EHS sets the real ones once,
// in `params`, and they apply to every site.

export const TEMPLATE_VERSION = 'mob-v1'

export const params = {
  calibrationMaxAgeDays: 180, // batching plant / CTM / total station, if the certificate states no validity (set by QA)
  coverBeyondStartDays: 90, // policies and licences must stay valid at least this long after start (set by QA)
  workersPerToilet: 25, // set by EHS
  workersPerSafetyOfficer: 500, // set by EHS
  cementStackMaxBags: 10, // set by QA
  geofence: { goodFixM: 15, weakFixM: 40, edgeBufferM: 10 },
}

export const areas = [
  { code: 'PAP', name: 'Papers and licences', icon: 'FileText', walk: false },
  { code: 'DR', name: 'Drawings and design readiness', icon: 'Ruler', walk: true },
  { code: 'LC', name: 'Labour camp', icon: 'Tent', walk: true },
  { code: 'SY', name: 'Stores yard', icon: 'Warehouse', walk: true },
  { code: 'BP', name: 'Batching plant / RMC', icon: 'Factory', walk: true },
  { code: 'FW', name: 'Formwork and scaffolding', icon: 'Stack', walk: true },
  { code: 'SF', name: 'Safety set-up', icon: 'HardHat', walk: true },
]

const L = (code, text, evidence, when, severity, extra = {}) => ({ code, area: code.split('-')[0], text, evidence, when, severity, ...extra })

export const lines = [
  // ---------------- Papers (contractor sends before the visit) ----------------
  L('PAP-01', 'Establishment registration for this site (OSH Code; BOCW registration accepted during transition)', 'document', 'paper', 'critical', {
    docType: 'establishment_registration', rules: ['nameMatchesContractor', 'siteMatches', 'validOnStart', 'coversPeakWorkers'],
    hint: 'Registration certificate showing the contractor name, this site address and the maximum number of workers.' }),
  L('PAP-02', 'Contract labour licence (OSH Code single licence; CLRA Form VI accepted during transition)', 'document', 'paper', 'critical', {
    docType: 'labour_licence', rules: ['nameMatchesContractor', 'siteMatches', 'validBeyondStart', 'coversPeakWorkers'],
    hint: 'Licence with licence number, validity dates and the maximum workers allowed. Must cover the planned peak labour.' }),
  L('PAP-03', "Employees' compensation (WC) policy", 'document', 'paper', 'critical', {
    docType: 'wc_policy', rules: ['nameMatchesContractor', 'validBeyondStart', 'coversPeakWorkers'],
    hint: 'Policy schedule page: insured name, policy period, number of workers covered.' }),
  L('PAP-04', "Contractor's All Risks (CAR) policy with third-party liability", 'document', 'paper', 'critical', {
    docType: 'car_policy', rules: ['nameMatchesContractor', 'siteMatches', 'validBeyondStart', 'sumInsuredCoversContract', 'principalNamed'],
    hint: 'Policy schedule: insured parties (developer named as principal), project address, period, sum insured, TPL limit.' }),
  L('PAP-05', 'ESIC and PF registration codes', 'document', 'paper', 'major', {
    docType: 'esic_pf', rules: ['nameMatchesContractor'],
    hint: 'ESIC and EPFO registration letters or portal screenshots with the contractor name and codes.' }),
  L('PAP-06', 'Batching plant calibration certificate (weigh batchers, admixture dispenser)', 'document', 'paper', 'critical', {
    docType: 'calibration_certificate', rules: ['calibrationCurrent'], appliesIf: 'onSitePlant',
    hint: 'Certificate from an accredited agency, plant serial number, date of calibration and next due date.' }),
  L('PAP-07', 'Consent to Operate (MPCB) for the batching plant', 'document', 'paper', 'critical', {
    docType: 'consent_to_operate', rules: ['siteMatches', 'validOnStart'], appliesIf: 'onSitePlant',
    hint: 'MPCB consent order for this plant at this address, with validity date and capacity.' }),
  L('PAP-08', 'RMC supplier: approved vendor letter and approved mix designs', 'document', 'paper', 'critical', {
    docType: 'rmc_tieup', rules: ['validOnStart'], appliesIf: 'rmc',
    hint: 'Vendor approval and mix design approval for each grade, signed by the structural consultant.' }),
  L('PAP-09', 'Safety officer appointment letter and qualification', 'document', 'paper', 'critical', {
    docType: 'safety_officer', rules: ['safetyOfficersEnough'],
    hint: 'Appointment letter naming the safety officer(s) for this site, with qualification certificate.' }),
  L('PAP-10', 'Site EHS plan approved by developer EHS', 'document', 'paper', 'major', {
    docType: 'ehs_plan', rules: ['siteMatches'],
    hint: 'Site-specific safety plan with approval signature or approval email.' }),
  L('PAP-11', 'Emergency plan: nearest hospital tie-up and ambulance contact', 'document', 'paper', 'major', {
    docType: 'emergency_plan', rules: [],
    hint: 'Emergency plan with hospital name, distance, phone numbers and ambulance arrangement.' }),
  L('PAP-12', 'Lifting appliances: load test certificates (tower crane, hoist) by competent person', 'document', 'paper', 'critical', {
    docType: 'load_test', rules: ['validOnStart'], appliesIf: 'lifting',
    hint: 'Test certificate per machine: serial number, safe working load, test date, next due date.' }),
  L('PAP-13', 'Temporary power: connection approval and licensed electrical supervisor', 'document', 'paper', 'major', {
    docType: 'electrical', rules: [],
    hint: 'Power connection sanction or DG arrangement, and the licence of the electrical supervisor.' }),
  L('PAP-14', 'Worker list with ID check (ID numbers masked) and induction plan', 'document', 'paper', 'major', {
    docType: 'worker_list', rules: [],
    hint: 'List of workers with contractor, trade and ID check status. Aadhaar numbers must be masked.' }),
  L('PAP-15', 'Quality assurance plan and inspection test plan approved by developer QA', 'document', 'paper', 'major', {
    docType: 'qap', rules: [],
    hint: 'QAP / ITP document with developer QA approval.' }),
  L('PAP-16', 'Survey instruments calibration (total station, auto level)', 'document', 'paper', 'minor', {
    docType: 'calibration_certificate', rules: ['calibrationCurrent'],
    hint: 'Calibration certificate per instrument with serial number and date.' }),

  // ---------------- Drawings and design readiness ----------------
  L('DR-01', 'Latest GFC drawings at site; drawing register matches the design register', 'both', 'walk', 'critical', {
    hint: 'Photo of the drawing register at site. Vera compares revisions with the design team register.' }),
  L('DR-02', 'Superseded drawings stamped and removed from site', 'photo', 'walk', 'major', { hint: 'Photo of the superseded-drawings file or stamp.' }),
  L('DR-03', 'Structural consultant approvals for mix designs and design basis received', 'document', 'paper', 'major', {
    docType: 'design_approval', rules: [], hint: 'Approval letter or email from the structural consultant.' }),
  L('DR-04', 'Formwork / shoring scheme approved by structural consultant', 'document', 'paper', 'critical', {
    docType: 'formwork_scheme', rules: [], hint: 'Approved formwork drawings or scheme with approval stamp.' }),
  L('DR-05', 'Site logistics plan: crane positions, batching plant, material routes, as approved', 'both', 'walk', 'major', {
    hint: 'Approved layout drawing, and a photo from the site showing it is set out that way.' }),
  L('DR-06', 'Benchmark and grid lines established and recorded', 'photo', 'walk', 'major', { hint: 'Photo of the benchmark pillar and the grid reference.' }),
  L('DR-07', 'RFI log and design query contact agreed', 'document', 'paper', 'minor', {
    docType: 'rfi_log', rules: [], hint: 'RFI register format and the named design contact.' }),
  L('DR-08', 'Sample and mock-up approval plan', 'document', 'paper', 'minor', { docType: 'mockup_plan', rules: [], hint: 'List of samples and mock-ups with dates.' }),

  // ---------------- Labour camp ----------------
  L('LC-01', 'Camp location safe: not low-lying, not under power lines, layout as approved', 'photo', 'walk', 'critical', { hint: 'Wide photo of the camp with surroundings.' }),
  L('LC-02', 'Rooms: ventilation, windows, space per person as per developer camp standard', 'photo', 'walk', 'major', { hint: 'Inside one room, showing windows and beds.' }),
  L('LC-03', 'Toilets: enough for the workforce, separate for women, clean, with water', 'photo', 'walk', 'critical', {
    count: 'toilets', hint: 'Toilet block from outside showing the count, and one inside.' }),
  L('LC-04', 'Bathing and washing area with drainage', 'photo', 'walk', 'major', { hint: 'Washing area and drain.' }),
  L('LC-05', 'Drinking water: potable source, marked, away from toilets and washing areas', 'photo', 'walk', 'critical', { hint: 'Water point with its marking; test report if any.' }),
  L('LC-06', 'Kitchen separate from rooms; gas cylinders not inside rooms', 'photo', 'walk', 'critical', { hint: 'Kitchen area and where cylinders are kept.' }),
  L('LC-07', 'Electrical: RCCB/ELCB, earthing, no loose wiring', 'photo', 'walk', 'critical', { hint: 'Distribution board with RCCB, and a typical room wiring.' }),
  L('LC-08', 'Fire extinguishers and fire buckets, charged, with dates', 'photo', 'walk', 'critical', { hint: 'Extinguisher with its tag showing the refill date.' }),
  L('LC-09', 'First-aid box stocked; trained first-aider named', 'photo', 'walk', 'major', { hint: 'Open first-aid box and the first-aider board.' }),
  L('LC-10', 'Creche where required (OSH Code / state rules)', 'photo', 'walk', 'major', { appliesIf: 'creche', hint: 'Creche room.' }),
  L('LC-11', 'Waste bins, drainage, mosquito control', 'photo', 'walk', 'minor', { hint: 'Waste collection point and drains.' }),
  L('LC-12', 'Notice board: wage days, grievance contact, emergency numbers (Hindi / Marathi)', 'photo', 'walk', 'minor', { hint: 'Notice board, readable.' }),
  L('LC-13', 'Lighting for night movement', 'photo', 'walk', 'minor', { hint: 'Camp lighting.' }),
  L('LC-14', 'Boundary and security for the camp', 'photo', 'walk', 'minor', { hint: 'Camp gate and boundary.' }),

  // ---------------- Stores yard ----------------
  L('SY-01', 'Cement shed: weatherproof, raised floor, stacks within limit, away from walls', 'photo', 'walk', 'critical', { hint: 'Inside the shed showing floor, stack height and wall gap.' }),
  L('SY-02', 'Cement stacked first-in first-out, week of manufacture visible', 'photo', 'walk', 'major', { hint: 'Stack labels / bag dates.' }),
  L('SY-03', 'Steel stacked off the ground, diameter-wise, tagged', 'photo', 'walk', 'major', { hint: 'Steel yard with sleepers and tags.' }),
  L('SY-04', 'Sand and aggregate bays on hard ground, separated', 'photo', 'walk', 'minor', { hint: 'Material bays.' }),
  L('SY-05', 'Admixtures and chemicals stored with safety data sheets', 'photo', 'walk', 'major', { hint: 'Chemical store with MSDS file.' }),
  L('SY-06', 'Diesel and flammables stored apart, no-smoking signs, extinguisher', 'photo', 'walk', 'critical', { hint: 'Diesel store with signage and extinguisher.' }),
  L('SY-07', 'Gate entry and stores registers set up (challan, gate book, issue slips)', 'photo', 'walk', 'major', { hint: 'First pages of the gate book and stores register.' }),
  L('SY-08', 'Weighing arrangement for incoming material (weighbridge or tie-up)', 'both', 'walk', 'minor', { hint: 'Weighbridge or tie-up letter.' }),
  L('SY-09', 'Fire extinguishers in stores', 'photo', 'walk', 'major', { hint: 'Extinguisher with tag.' }),
  L('SY-10', 'Truck access and turning space kept clear', 'photo', 'walk', 'minor', { hint: 'Access road.' }),

  // ---------------- Batching plant / RMC ----------------
  L('BP-01', 'Batching plant installed and running at planned capacity', 'photo', 'walk', 'critical', { appliesIf: 'onSitePlant', hint: 'Plant with its name plate.' }),
  L('BP-02', 'Calibration status on the plant matches the certificate', 'photo', 'walk', 'critical', { appliesIf: 'onSitePlant', hint: 'Calibration sticker and serial plate.' }),
  L('BP-03', 'Aggregate bins separated; moisture check arrangement', 'photo', 'walk', 'major', { appliesIf: 'onSitePlant', hint: 'Bins and moisture meter.' }),
  L('BP-04', 'Water tank clean; water test report available', 'both', 'walk', 'major', { appliesIf: 'onSitePlant', hint: 'Tank and the water test report.' }),
  L('BP-05', 'Cement silo with level indicator', 'photo', 'walk', 'minor', { appliesIf: 'onSitePlant', hint: 'Silo and indicator.' }),
  L('BP-06', 'Site lab: calibrated compression testing machine, cube moulds, curing tank, slump cone', 'photo', 'walk', 'critical', { hint: 'Lab with CTM calibration tag and moulds.' }),
  L('BP-07', 'Dust control as per consent conditions (sprinklers, covered conveyors)', 'photo', 'walk', 'major', { appliesIf: 'onSitePlant', hint: 'Sprinklers / covers.' }),
  L('BP-08', 'Transit mixers and concrete pump available as planned', 'photo', 'walk', 'major', { hint: 'Transit mixers and pump at site.' }),
  L('BP-09', 'RMC plant visited or audit report on file', 'document', 'paper', 'major', { docType: 'rmc_audit', rules: [], appliesIf: 'rmc', hint: 'Audit report of the RMC plant.' }),
  L('BP-10', 'Trial mix done for the first grade to be poured', 'document', 'paper', 'major', { docType: 'trial_mix', rules: [], hint: 'Trial mix report with cube results.' }),

  // ---------------- Formwork and scaffolding ----------------
  L('FW-01', 'Formwork quantity at site matches the cycle plan', 'photo', 'walk', 'major', { count: 'formwork sets', hint: 'Stacked formwork, countable.' }),
  L('FW-02', 'Formwork panels cleaned, oiled, not damaged', 'photo', 'walk', 'major', { hint: 'Close-up of panels.' }),
  L('FW-03', 'Props and scaffold material in good condition, quantity as planned', 'photo', 'walk', 'major', { hint: 'Props and scaffold stack.' }),
  L('FW-04', 'Formwork storage area level and drained', 'photo', 'walk', 'minor', { hint: 'Storage area.' }),
  L('FW-05', 'Scaffold tagging system in place (green / red tags)', 'photo', 'walk', 'minor', { hint: 'Tag samples.' }),

  // ---------------- Safety set-up ----------------
  L('SF-01', 'Hoarding and barricading on the full boundary; signage', 'photo', 'walk', 'critical', { hint: 'Boundary hoarding and gate.' }),
  L('SF-02', 'Main gate: security, visitor register, vehicle entry control', 'photo', 'walk', 'major', { hint: 'Gate cabin and register.' }),
  L('SF-03', 'Induction room and toolbox talk area; induction records started', 'photo', 'walk', 'major', { hint: 'Induction room and register.' }),
  L('SF-04', 'PPE stock for the planned workforce: helmets, shoes, full-body harness, jackets', 'photo', 'walk', 'critical', { count: 'harnesses', hint: 'PPE store showing quantities.' }),
  L('SF-05', 'Safety nets and edge protection material at site', 'photo', 'walk', 'major', { hint: 'Nets and edge protection stock.' }),
  L('SF-06', 'Fire point and emergency assembly point marked', 'photo', 'walk', 'major', { hint: 'Assembly point sign.' }),
  L('SF-07', 'First-aid room and ambulance arrangement', 'photo', 'walk', 'major', { hint: 'First-aid room.' }),
  L('SF-08', 'Site electrical: main DB with RCCB, earthing pits, licensed electrician on site', 'photo', 'walk', 'critical', { hint: 'Main DB and earthing pit.' }),
  L('SF-09', 'Lifting appliances: test tags on machine, operator licences', 'photo', 'walk', 'critical', { appliesIf: 'lifting', hint: 'Crane test tag and operator card.' }),
  L('SF-10', 'Safety officer present on site (met in person)', 'photo', 'walk', 'critical', { hint: 'Engineer notes the name; photo optional.' }),
  L('SF-11', 'Housekeeping and lighting of work areas', 'photo', 'walk', 'minor', { hint: 'General site view.' }),
  L('SF-12', 'Excavation edges protected, access ladders', 'photo', 'walk', 'critical', { appliesIf: 'excavation', hint: 'Excavation edge and ladder.' }),
  L('SF-13', 'Emergency contact board at gate and camp', 'photo', 'walk', 'minor', { hint: 'Board, readable.' }),
  L('SF-14', 'Permit-to-work system: hot work, work at height, confined space', 'document', 'paper', 'major', { docType: 'ptw', rules: [], hint: 'Permit formats and the permit register.' }),
]

// Lines that apply to one site, from its set-up answers.
export function linesFor(site) {
  const flags = {
    onSitePlant: site.concrete === 'plant',
    rmc: site.concrete === 'rmc',
    lifting: !!site.lifting,
    creche: !!site.creche,
    excavation: !!site.excavation,
  }
  return lines.filter((l) => !l.appliesIf || flags[l.appliesIf])
}
