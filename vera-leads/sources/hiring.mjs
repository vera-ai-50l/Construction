// Job posts -> hiring signals for construction firms in MMR and Pune.
// A contractor or developer hiring site, planning, billing, QS or stores staff is running more sites
// than its team can report on. Angle: the 2–3 day site report done in under a day, and material checked.
//
// Jobs come from Apify actors (Naukri, LinkedIn Jobs) or from a JSON export of any jobs actor.
// Field names differ between actors, so the normaliser tries the common ones.
import { config } from '../config.mjs'
import { readItems, runActor } from '../lib/apify.mjs'
import { addSignal, upsertAccount } from '../lib/store.mjs'
import { companyKey, daysBetween, log, parseDate, pick, today } from '../lib/util.mjs'
import { regionOf } from './maharera.mjs'

// Some actors return the company and locations as objects ({ name, websiteUrl }, [{ label }]).
const label = v => (v && typeof v === 'object' ? v.name || v.label || v.city || '' : v)

export function normaliseJob(j, now = new Date()) {
  const loc = pick(j, 'location', 'jobLocation', 'locations', 'place', 'city')
  const co = pick(j, 'companyName', 'company', 'company_name', 'employer', 'hiringOrganization', 'organization')
  const coObj = co && typeof co === 'object' ? co : {}
  return {
    title: String(pick(j, 'title', 'jobTitle', 'designation', 'position', 'name')).trim(),
    company: String(label(co) || '').replace(/\s+/g, ' ').trim(),
    location: Array.isArray(loc) ? loc.map(label).filter(Boolean).join(', ') : String(label(loc) || ''),
    url: pick(j, 'jobUrl', 'url', 'link', 'jdURL', 'applyUrl', 'jobLink'),
    posted: parseDate(pick(j, 'postedAt', 'postedDate', 'createdDate', 'datePosted', 'date', 'posted', 'footerPlaceholderLabel', 'publishedAt', 'createdAt'), now),
    website: pick(j, 'companyWebsite', 'companyUrl', 'website') || coObj.websiteUrl || '',
    companyLinkedin: pick(j, 'companyLinkedinUrl', 'companyLinkedIn', 'companyLink'),
    industry: String(pick(j, 'industry') || ''),
    // Naukri marks posts by placement consultants; "hiringFor" means the post is on someone else's behalf.
    consultant: j.consultant === true || !!coObj.hiringFor,
    id: String(pick(j, 'jobId', 'id', 'jobID') || ''),
  }
}

export function isStaffing(company) {
  const k = companyKey(company).replace(/-/g, ' ')
  return config.doNotContact.staffing.some(w => k.includes(w))
}

// Keep a post only if it is clearly a construction employer: either the company name says so,
// or the role only exists on a construction site.
const SITE_ONLY_ROLE = /site|quantity|\bqs\b|store|billing|civil|structural|shuttering|formwork|rcc/i
const CONSTRUCTION_INDUSTRY = /construct|real estate|infrastructure|civil/i
export function isConstruction(job) {
  return config.hiring.industryMatch.test(job.company) || SITE_ONLY_ROLE.test(job.title) || CONSTRUCTION_INDUSTRY.test(job.industry || '')
}

// Group jobs by company and add one signal per job. Returns counts.
export function ingestJobs(db, rawJobs, { now = today() } = {}) {
  const cfg = config.hiring
  const c = { jobs: rawJobs.length, kept: 0, companies: 0, dropped: { role: 0, old: 0, staffing: 0, notConstruction: 0, noCompany: 0 } }
  const seenJob = new Set()
  const byCo = new Map()
  for (const raw of rawJobs) {
    const j = normaliseJob(raw, new Date(now))
    if (!j.company) { c.dropped.noCompany++; continue }
    if (!cfg.roleMatch.test(j.title)) { c.dropped.role++; continue }
    if (j.posted && daysBetween(j.posted, now) > cfg.maxAgeDays) { c.dropped.old++; continue }
    if (j.consultant || isStaffing(j.company)) { c.dropped.staffing++; continue }
    if (!isConstruction(j)) { c.dropped.notConstruction++; continue }
    const dupe = (j.id || j.url || j.title + j.location) + j.company
    if (seenJob.has(dupe)) continue
    seenJob.add(dupe)
    c.kept++
    const k = companyKey(j.company)
    ;(byCo.get(k) || byCo.set(k, []).get(k)).push(j)
  }
  for (const jobs of byCo.values()) {
    const j0 = jobs[0]
    const region = regionOf(...jobs.map(j => j.location))
    const a = upsertAccount(db, { name: j0.company, website: j0.website, region, city: j0.location.split(',')[0], linkedinCompany: j0.companyLinkedin, kind: 'contractor_or_developer' })
    if (!a) continue
    c.companies++
    a.openRoles = Math.max(a.openRoles || 0, jobs.length)
    const roles = [...new Set(jobs.map(j => j.title))]
    for (const j of jobs) {
      addSignal(db, a, {
        type: 'hiring', key: j.id || j.url || j.title + j.location, source: 'jobs',
        date: j.posted || now, title: `Hiring: ${j.title}`, detail: `${jobs.length} open site role${jobs.length > 1 ? 's' : ''}: ${roles.slice(0, 3).join(', ')}`,
        url: j.url, location: j.location, role: j.title, openRoles: jobs.length,
      })
    }
  }
  return c
}

function naukriInput(keyword, location) {
  // Input of valig/naukri-jobs-scraper (the default actor): newest first, last 30 days, company posts only
  // (jobPostType 1 leaves out placement consultants). If you swap actors, match its input here.
  return { keywords: keyword, location, sort: 'f', jobAge: '30', jobPostType: ['1'], limit: config.hiring.maxPerSearch }
}
function linkedinInput(keyword, location) {
  const u = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location + ', India')}&f_TPR=r2592000`
  return { urls: [u], limitPerSource: config.hiring.maxPerSearch, scrapeCompany: true } // curious_coder/linkedin-jobs-scraper input (Nov 2026)
}

export async function run(db, { board = 'naukri', files = [] } = {}) {
  let items = []
  if (files.length) items = files.flatMap(readItems)
  else {
    const { keywords, locations } = config.hiring
    const actor = board === 'linkedin' ? config.hiring.linkedinActor : config.hiring.naukriActor
    for (const kw of keywords) for (const loc of locations) {
      try { items.push(...await runActor(actor, board === 'linkedin' ? linkedinInput(kw, loc) : naukriInput(kw, loc))) }
      catch (e) { log(`  skipped "${kw}" in ${loc}: ${e.message}`) }
    }
  }
  return ingestJobs(db, items)
}
