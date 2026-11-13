// Everything the team is likely to tune lives here. Edit freely; no code changes needed elsewhere.
// Keys and tokens are read from environment variables, never from this file.
//
// Target (Nov 2026): construction only. Mid-size contractors and developers in MMR and Pune,
// roughly ₹50–500 Cr revenue. The buyer is the MD or owner, who often runs projects too.

export const config = {
  // ---------- Who we sell to ----------
  buyerTitles: ['Managing Director', 'MD', 'Director', 'Founder', 'Owner', 'Proprietor', 'Partner', 'CEO', 'Project Head', 'Head of Projects', 'VP Projects', 'GM Projects', 'Project Director'],
  offer: 'Material Leak Check (one site) and Site Record Desk',

  // Regions we work. Rows outside these districts are kept but score lower.
  regions: {
    mmr: ['mumbai city', 'mumbai suburban', 'mumbai', 'thane', 'palghar', 'raigad', 'navi mumbai', 'kalyan', 'bhiwandi', 'panvel', 'vasai', 'virar', 'mira bhayandar', 'mira road', 'dombivli', 'ulhasnagar', 'ambernath', 'badlapur'],
    pune: ['pune', 'pimpri', 'chinchwad', 'hinjewadi', 'wakad', 'kharadi', 'hadapsar', 'baner', 'wagholi', 'talegaon', 'chakan'],
  },

  // Never cold-contact these. Matched against the company key, so "Macrotech Developers Ltd" matches "macrotech".
  doNotContact: {
    // Existing relationships: handled by warm intro only.
    relationship: ['lodha', 'macrotech'],
    // Too large for Vera today: long procurement, IT review, SAP.
    tooLarge: [
      'godrej', 'oberoi', 'dlf', 'tata housing', 'tata realty', 'tata projects', 'mahindra lifespace', 'kalpataru', 'hiranandani',
      'runwal', 'rustomjee', 'keystone', 'piramal', 'l t', 'larsen', 'shapoorji', 'k raheja', 'raheja', 'adani', 'wadhwa',
      'sunteck', 'raymond', 'birla estates', 'puravankara', 'sobha', 'brigade', 'prestige', 'panchshil', 'kolte patil',
      'vtp', 'kumar properties', 'paranjape', 'gera', 'dosti', 'hubtown', 'indiabulls', 'omkar', 'shriram', 'afcons',
      'nagarjuna', 'ncc', 'capacite', 'b g shirke', 'jmc', 'simplex', 'gammon', 'hcc', 'hindustan construction', 'ahluwalia',
      'pnc infratech', 'dilip buildcon', 'kec', 'j kumar', 'nbcc', 'ircon', 'cidco', 'mhada', 'mmrda',
    ],
    // Recruiters and staffing firms post jobs for others. A job from them says nothing about them.
    staffing: ['consult', 'placement', 'staffing', 'manpower', 'recruit', 'hr solution', 'hr services', 'talent', 'jobs', 'careers', 'outsourc', 'search partners', 'hiring'],
  },

  // ---------- Signals ----------
  maharera: {
    // The public project search. Check the live page once and adjust the query string if MahaRERA changes it.
    // {page} is replaced with 1, 2, 3...
    searchUrl: process.env.MAHARERA_URL || 'https://maharera.maharashtra.gov.in/projects-search-result?project_name=&project_location=&project_completion_date=&project_state=27&project_district=0&carpetAreas=&completionDate_from=&completionDate_to=&page={page}',
    maxPages: 40,
    gapMs: 3000, // pause between pages; be gentle with a government site
    // Registration numbers look like P51800012345. Newer formats are allowed for.
    regNo: /\b(P[A-Z]?\d{10,14}|PR\d{10,14})\b/g,
    // A project whose completion date is this close (or already past) is a "deadline pressure" signal.
    deadlineWindowDays: 180,
  },

  hiring: {
    // Apify actors. Swap for any Naukri or LinkedIn Jobs actor; the normaliser reads common field names.
    naukriActor: process.env.NAUKRI_ACTOR || 'muhammadafzal/naukri-jobs-scraper',
    linkedinActor: process.env.LINKEDIN_JOBS_ACTOR || 'curious_coder/linkedin-jobs-scraper',
    maxPerSearch: 100,
    maxAgeDays: 45, // drop posts older than this
    keywords: ['site engineer civil', 'planning engineer construction', 'quantity surveyor', 'billing engineer civil', 'store keeper construction', 'site supervisor civil', 'project manager civil', 'purchase executive construction'],
    locations: ['Mumbai', 'Thane', 'Navi Mumbai', 'Pune'],
    // A title must match to count. Stops "civil engineer (software)" style noise.
    roleMatch: /(site|planning|billing|project|qs|quantity|store|stores|execution|civil|structural|mep|safety|purchase|procurement).*(engineer|surveyor|keeper|supervisor|manager|incharge|in-charge|executive|officer)|quantity surveyor|storekeeper|store keeper|\bqs\b/i,
    // Company names that mark a construction business. Other employers (IT firms hiring "project managers") are dropped.
    industryMatch: /construct|builder|developer|infra|realty|realtor|real estate|estate|projects|engineering|contract|civil|housing|homes|buildcon|buildtech|properties|space|habitat|epc|structur|interior|landmark|group/i,
  },

  // ---------- Scoring ----------
  // Points per signal. Fresher signals score higher (halved every `halfLifeDays`).
  score: {
    halfLifeDays: 45,
    weights: {
      maharera_new: 30,
      maharera_extension: 40,
      maharera_deadline: 25,
      hiring: 25,
      manual: 20,
      list: 30, // imported from a Lead Finder list you chose: no event, but enough to clear the export score
    },
    bonus: {
      inRegion: 15, // MMR or Pune
      multiProject: 15, // promoter has 2+ projects on MahaRERA: a repeat builder, not a one-off
      bulkHiring: 10, // 3+ open site roles: more sites than the team can report on
      bothSignals: 10, // on MahaRERA and hiring at the same time
      verifiedContact: 10,
    },
    minToExport: 30,
  },

  // ---------- Outreach rules ----------
  outreach: {
    recontactAfterDays: 90, // never email the same person twice within this
    // New people per weekly export, signal firms first, Lead Finder lists fill the rest.
    // 3 inboxes x 30 a day x 5 days = 450 sends a week; a 3-email sequence = 150 new people a week.
    perExport: 150,
    // MillionVerifier results we accept for cold email. "catch_all" goes to its own file.
    acceptResults: ['ok'],
    // India DPDP Rules bind fully from this date; plan to move toward intros and inbound before it.
    dpdpDate: '2027-05-13',
  },
}
