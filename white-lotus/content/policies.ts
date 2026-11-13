// Approved HR documents the employee assistant may answer from.
// SAMPLE TEXT written for this demo. In a pilot these are replaced by the hospital's own
// approved policies, and HR reviews every answer before staff use it.
// Each section is one retrievable chunk; keep sections short and self-contained.

export type PolicySection = { heading: string; text: string }
export type Policy = { id: string; title: string; owner: string; version: string; sections: PolicySection[] }

export const HR_CONTACT = {
  name: 'Anita D’Souza',
  role: 'HR Executive (sample contact)',
  ext: '2104',
  hours: 'Mon–Sat, 9:30 AM to 5:30 PM',
}

export const policies: Policy[] = [
  {
    id: 'leave',
    title: 'Leave Policy',
    owner: 'Human Resources',
    version: 'Sample v1 · April 2026',
    sections: [
      {
        heading: 'Types of leave and yearly entitlement',
        text: 'Permanent staff receive three kinds of paid leave each calendar year: 12 days of casual leave (CL), 12 days of sick leave (SL) and 18 days of earned leave (EL), also called privilege leave (PL). Earned leave accrues at 1.5 days for each completed month of service. Staff on probation accrue earned leave but can use it only after confirmation. Contract and trainee staff follow the leave terms in their appointment letter.',
      },
      {
        heading: 'Applying for leave',
        text: 'Apply for planned leave on the HRMS app at least 7 days in advance; for 3 or more consecutive days apply at least 15 days in advance. The ward in-charge or reporting manager approves it, and for nursing staff the Nursing Superintendent is informed so the roster can be adjusted. Leave is confirmed only after approval appears on HRMS. Leave taken without approval is treated as unauthorised absence.',
      },
      {
        heading: 'Casual leave rules',
        text: 'Casual leave can be taken for half a day or for up to 3 days at a time. It cannot be combined with earned leave. Unused casual leave lapses on 31 December and is not carried forward or paid out.',
      },
      {
        heading: 'Sick leave and medical certificate',
        text: 'Inform your ward in-charge before the start of your shift if you are unwell, by call or the HRMS app. Sick leave of more than 2 consecutive days needs a medical certificate from a registered medical practitioner, uploaded on HRMS within 3 days of returning. Unused sick leave can be carried forward up to a maximum of 36 days.',
      },
      {
        heading: 'Earned leave carry-forward and encashment',
        text: 'Unused earned leave carries forward to the next year up to a maximum balance of 45 days. Days above 45 lapse on 31 December. Earned leave can be encashed only at the time of resignation or retirement, calculated on basic salary, up to the 45-day limit.',
      },
      {
        heading: 'Checking your leave balance',
        text: 'Your current leave balance is shown on the HRMS app under Leave > My Balance, updated every night. The assistant cannot see individual balances. If the balance looks wrong, raise a ticket on HRMS or contact HR.',
      },
      {
        heading: 'Maternity leave',
        text: 'Women employees with at least 80 days of service in the 12 months before the expected delivery date are entitled to 26 weeks of paid maternity leave, of which up to 8 weeks can be taken before delivery, as provided under the Maternity Benefit Act, 1961 (as amended in 2017). For a third or later child the entitlement is 12 weeks. Women who adopt a child below 3 months, or commissioning mothers, receive 12 weeks. Apply on HRMS with a doctor’s certificate at least 8 weeks before the leave starts.',
      },
      {
        heading: 'Paternity leave',
        text: 'Male employees receive 5 working days of paid paternity leave, to be taken within 3 months of the child’s birth or adoption. Apply on HRMS with the birth or adoption record.',
      },
      {
        heading: 'Bereavement leave',
        text: 'Up to 3 days of paid bereavement leave are given on the death of a spouse, child, parent, sibling or parent-in-law. Inform your manager as soon as you can; the leave can be regularised on HRMS after you return.',
      },
    ],
  },
  {
    id: 'shifts',
    title: 'Shifts, Attendance and Swaps',
    owner: 'Nursing Administration and HR',
    version: 'Sample v1 · April 2026',
    sections: [
      {
        heading: 'Shift timings',
        text: 'Clinical areas run three shifts: Morning 7:00 AM to 3:00 PM, Evening 3:00 PM to 11:00 PM and Night 11:00 PM to 7:00 AM. Administrative staff work 9:30 AM to 5:30 PM, Monday to Saturday. Each shift starts with a 15-minute handover at the nursing station, which is part of the shift.',
      },
      {
        heading: 'Marking attendance and late arrival',
        text: 'Mark attendance on the biometric device at the start and end of every shift. A grace period of 10 minutes applies. Three late marks in a calendar month are adjusted as half a day of casual leave. If you forget to punch, request a correction on HRMS within 48 hours; your ward in-charge approves it.',
      },
      {
        heading: 'Shift swaps',
        text: 'Two staff of the same role and ward may swap shifts. Submit the swap request on HRMS at least 48 hours before the first shift involved; both staff and the ward in-charge must approve it. Emergency swaps need verbal approval from the duty manager and must be entered on HRMS the same day. No one may work two consecutive shifts (16 hours) without the Nursing Superintendent’s approval.',
      },
      {
        heading: 'Weekly off and roster publication',
        text: 'Every employee gets one weekly off in each 7-day roster. The roster for the next month is published on HRMS by the 25th of the current month. Requests for specific weekly offs must reach the ward in-charge by the 20th.',
      },
      {
        heading: 'Night shift allowance',
        text: 'Staff working a night shift receive a night shift allowance of ₹300 per night, paid with the next month’s salary. Staff who work more than 10 night shifts in a month also receive one additional compensatory off. Nursing staff are not rostered for more than 7 consecutive nights.',
      },
      {
        heading: 'Overtime and compensatory off',
        text: 'Extra hours beyond the rostered shift, approved by the duty manager, are recorded on HRMS. Each 8 hours of approved extra work earns one compensatory off (comp off), which must be used within 60 days. Clinical staff are not paid overtime in cash unless HR announces it for a specific period.',
      },
    ],
  },
  {
    id: 'holidays',
    title: 'Holiday List 2026',
    owner: 'Human Resources',
    version: 'Sample v1 · January 2026',
    sections: [
      {
        heading: 'Paid holidays in 2026',
        text: 'The hospital observes 10 paid holidays in 2026. Fixed national holidays: Republic Day (Monday 26 January), Labour Day (Friday 1 May), Independence Day (Saturday 15 August), Gandhi Jayanti (Friday 2 October) and Christmas (Friday 25 December). Five festival holidays are announced by HR circular in January each year based on the local calendar.',
      },
      {
        heading: 'Working on a holiday',
        text: 'The hospital runs every day, so clinical staff may be rostered on a holiday. Staff who work on a paid holiday receive a compensatory off, to be used within 60 days, or double wages for that day if the comp off cannot be given. Administrative staff are off on paid holidays unless their manager rosters them.',
      },
    ],
  },
  {
    id: 'pay',
    title: 'Salary, Payslips and Reimbursements',
    owner: 'Human Resources and Finance',
    version: 'Sample v1 · April 2026',
    sections: [
      {
        heading: 'Salary date and payslips',
        text: 'Salary is credited to your registered bank account on the last working day of each month. Payslips are available on the HRMS app under Pay > Payslips from the 1st of the following month. The assistant cannot see individual salaries or payslips. For a query on your own pay, raise a ticket on HRMS or contact HR.',
      },
      {
        heading: 'Changing bank details',
        text: 'To change your salary bank account, submit the bank details change form on HRMS with a cancelled cheque or bank statement before the 20th of the month. Changes submitted after the 20th apply from the following month.',
      },
      {
        heading: 'Provident Fund and ESI',
        text: 'Eligible employees are enrolled in the Employees’ Provident Fund (EPF), and where applicable in ESI, from the date of joining. Your UAN number is shown on HRMS under Profile. Questions on withdrawals or transfers go to the HR payroll desk.',
      },
      {
        heading: 'Conference and CME reimbursement',
        text: 'Clinical staff may claim registration fees for one approved CME, workshop or conference per year, up to ₹10,000 for nurses and technicians and ₹25,000 for doctors. Get approval from your head of department before registering. Submit the claim on HRMS within 30 days of the event with the receipt and attendance certificate.',
      },
    ],
  },
  {
    id: 'conduct',
    title: 'Uniform, ID Card and Conduct',
    owner: 'Human Resources',
    version: 'Sample v1 · April 2026',
    sections: [
      {
        heading: 'Uniform',
        text: 'The hospital issues three sets of uniform on joining and two replacement sets every year. Nursing staff must wear the issued uniform and closed, non-slip footwear on duty. To request a replacement, apply on HRMS; uniforms are issued from the linen store on Tuesdays and Fridays.',
      },
      {
        heading: 'ID card and lost ID card',
        text: 'Your ID card must be worn and visible at all times on hospital premises. Report a lost ID card to Security and HR the same day. A replacement is issued within 2 working days for a fee of ₹200, deducted from salary; the fee is waived if the card was damaged during work.',
      },
      {
        heading: 'Mobile phones and social media',
        text: 'Personal mobile phones must not be used in patient-care areas except in an emergency. Never photograph patients, patient records or clinical areas, and never post hospital or patient information on social media or WhatsApp groups. Breaches are handled under the disciplinary policy.',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Staff Health and Safety',
    owner: 'Infection Control and HR',
    version: 'Sample v1 · April 2026',
    sections: [
      {
        heading: 'Needle-stick and sharps injury',
        text: 'If you get a needle-stick or sharps injury: wash the area with soap and running water at once, do not squeeze or suck the wound, inform your ward in-charge, and report to the Emergency Department within 2 hours so post-exposure prophylaxis (PEP) can be assessed. Fill the sharps injury form on HRMS the same day. Testing and any treatment are free for staff.',
      },
      {
        heading: 'Vaccination for staff',
        text: 'All clinical staff must complete Hepatitis B vaccination, provided free by the hospital. Annual influenza vaccination is offered free each year in October. Vaccination records are kept by the Employee Health Clinic.',
      },
      {
        heading: 'Mandatory training',
        text: 'Every new employee completes induction, fire safety and infection control training in the first month. Nursing staff must hold a valid Basic Life Support (BLS) certificate, renewed every 2 years; ICU and Emergency nurses also need Advanced Cardiac Life Support (ACLS). Training dates are published on HRMS under Learning.',
      },
    ],
  },
  {
    id: 'grievance',
    title: 'Grievance, POSH and Exit',
    owner: 'Human Resources',
    version: 'Sample v1 · April 2026',
    sections: [
      {
        heading: 'Raising a grievance',
        text: 'Raise a work-related grievance first with your reporting manager. If it is not resolved within 7 days, raise it on HRMS under Help > Grievance, where HR acknowledges it within 2 working days. You can also write directly to the HR Manager. Grievances are handled confidentially.',
      },
      {
        heading: 'Sexual harassment (POSH)',
        text: 'The hospital has an Internal Committee under the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013. Complaints can be made in writing to any Internal Committee member within 3 months of the incident; the member list is displayed in every department and on HRMS. Complaints are confidential, and retaliation against a complainant is a disciplinary offence.',
      },
      {
        heading: 'Resignation and notice period',
        text: 'Submit your resignation on HRMS. The notice period is 30 days for nurses, technicians and support staff, and 60 days for doctors and managers, unless your appointment letter says otherwise. Unused earned leave cannot be adjusted against the notice period. Full and final settlement is paid within 45 days of the last working day.',
      },
      {
        heading: 'Experience and relieving letter',
        text: 'The relieving letter and experience certificate are issued on the last working day, once the no-dues form is cleared by your department, the linen store, the library and Finance.',
      },
    ],
  },
]

// One chunk per section, with a stable id the UI can link to.
export type Chunk = { id: string; policyId: string; policy: string; heading: string; text: string; version: string }
export const chunks: Chunk[] = policies.flatMap((p) =>
  p.sections.map((s, i) => ({ id: `${p.id}-${i + 1}`, policyId: p.id, policy: p.title, heading: s.heading, text: s.text, version: p.version })),
)

export const SAMPLE_QUESTIONS = [
  'How many earned leaves do I get in a year?',
  'What are the night shift timings and allowance?',
  'How do I swap a shift with a colleague?',
  'I got a needle-stick injury, what should I do?',
  'When is salary credited?',
  'How long is maternity leave?',
  'Can I carry forward my casual leave?',
  'What is my exact leave balance?',
]
