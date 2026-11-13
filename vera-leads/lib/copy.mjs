// Merge fields for Saleshandy. The first line names the company's own event; the rest of the email
// is the same template for everyone (see docs/vera-outreach.md). Plain, factual, no em dashes.
import { prettyCompany } from './util.mjs'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthYear = d => (d && /^\d{4}-\d{2}/.test(d) ? `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '')
const titleCase = s => String(s || '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\b(Ii|Iii|Iv)\b/g, m => m.toUpperCase())
const aOrAn = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w
const cityOf = loc => titleCase(String(loc || '').split(',')[0].trim())

// Short role name for a sentence: "Site Engineer - Civil (5-8 yrs)" -> "site engineer"
export function roleShort(t = '') {
  return String(t).toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').split(/[-|/,]| for | at /)[0].replace(/\bcivil\b/g, '').replace(/\s+/g, ' ').trim()
}

export function mergeFields(account, sig) {
  const company = prettyCompany(account.name)
  const project = titleCase(sig?.project || '')
  const f = { company, project, signalType: sig?.type || '', signalLine: '', angle: '', sourceUrl: sig?.url || '' }
  if (!sig) return f
  switch (sig.type) {
    case 'maharera_new':
      f.signalLine = `Saw ${project || 'your new project'} come up on MahaRERA${sig.location ? ' in ' + cityOf(sig.location) : ''}. Congratulations on the launch.`
      f.angle = 'Site records are easiest to get right from the first pour.'
      break
    case 'maharera_extension':
      f.signalLine = `Saw the MahaRERA completion date for ${project || 'one of your projects'} has moved to ${monthYear(sig.completion) || 'a later date'}.`
      f.angle = 'When timelines stretch, the MD usually wants site updates faster.'
      break
    case 'maharera_deadline':
      f.signalLine = `${project || 'Your project'} is due for completion on MahaRERA by ${monthYear(sig.completion) || 'soon'}.`
      f.angle = 'The last stretch is where delays and material overruns cost the most.'
      break
    case 'hiring': {
      const n = account.openRoles || sig.openRoles || 1
      const role = roleShort(sig.role) || 'site'
      f.signalLine = n > 1
        ? `Saw ${company} is hiring for ${n} site roles${sig.location ? ' in ' + cityOf(sig.location) : ''}, including ${aOrAn(role)}.`
        : `Saw ${company} is hiring ${aOrAn(role)}${sig.location ? ' in ' + cityOf(sig.location) : ''}.`
      f.angle = 'Usually that means more sites than the team can report on.'
      break
    }
    case 'list': {
      const city = cityOf(account.city || sig.location)
      f.signalLine = `Came across ${company} while looking at construction firms${city ? ' in ' + city : ''}.`
      f.angle = 'On most sites, the office hears about problems days after they happen.'
      f.sourceUrl = ''
      break
    }
    default:
      f.signalLine = sig.title || ''
  }
  return f
}
