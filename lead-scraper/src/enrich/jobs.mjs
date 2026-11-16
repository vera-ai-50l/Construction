// Hiring signals from public job-board APIs (Ashby, Greenhouse, Lever).
// An open product-design role is a buying signal: budget and need, plus a gap to bridge.
import { getJson } from '../http.mjs';

const DESIGN_ROLE = /\b(product designer|ux|ui\/ux|ui designer|user experience|interaction designer|design engineer|head of design|design lead|founding designer|brand designer|visual designer)\b/i;
const NOT_DESIGN = /\b(design system(s)? engineer|chip|hardware|mechanical|circuit|asic|verification)\b/i;

const daysSince = (iso) => (iso ? Math.round((Date.now() - Date.parse(iso)) / 864e5) : null);

async function ashby(slug) {
  const d = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);
  if (!d?.jobs) return null;
  return d.jobs.map((j) => ({ title: j.title, url: j.jobUrl, posted: j.publishedAt || null }));
}
async function greenhouse(slug) {
  const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`);
  if (!d?.jobs) return null;
  return d.jobs.map((j) => ({ title: j.title, url: j.absolute_url, posted: j.first_published || j.updated_at || null }));
}
async function lever(slug) {
  const d = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
  if (!Array.isArray(d)) return null;
  return d.map((j) => ({ title: j.text, url: j.hostedUrl, posted: j.createdAt ? new Date(j.createdAt).toISOString() : null }));
}
const READERS = { ashby, greenhouse, lever };

/**
 * @param boards  ATS boards linked from the site ([{ats, slug}])
 * @param guessSlugs  slugs to try on Ashby when the site links no board (company name, domain stem)
 */
export async function hiringSignals(boards, guessSlugs = []) {
  const tried = [...boards];
  for (const s of guessSlugs) if (s && !tried.some((b) => b.slug === s)) tried.push({ ats: 'ashby', slug: s, guessed: true });

  for (const b of tried) {
    const read = READERS[b.ats];
    if (!read) continue;
    const jobs = await read(b.slug);
    if (!jobs || (b.guessed && jobs.length === 0)) continue;
    const design = jobs
      .filter((j) => DESIGN_ROLE.test(j.title) && !NOT_DESIGN.test(j.title))
      .map((j) => ({ ...j, days_open: daysSince(j.posted) }));
    return {
      ats: b.ats,
      board_slug: b.slug,
      board_guessed: !!b.guessed,
      open_jobs: jobs.length,
      design_roles: design,
      oldest_design_role_days: design.reduce((m, j) => Math.max(m, j.days_open || 0), 0) || null,
    };
  }
  return { ats: null, open_jobs: null, design_roles: [], oldest_design_role_days: null };
}
