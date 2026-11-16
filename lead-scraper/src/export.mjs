// Write leads as CSV (one row per company, for sheets and outreach tools) and JSON (everything).
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const COLUMNS = [
  ['priority', (l) => l.score.priority],
  ['score', (l) => l.score.total],
  ['profile', (l) => l.profile],
  ['offer', (l) => l.offer],
  ['company', (l) => l.name],
  ['website', (l) => l.site.fetched_url || l.website],
  ['domain', (l) => l.domain],
  ['description', (l) => l.description || l.site.meta_description],
  ['access_level', (l) => l.access.level],
  ['access_evidence', (l) => l.access.evidence],
  ['public_demo_url', (l) => l.render?.public_demo_open || l.site.public_demo_urls[0] || l.site.demo_embeds[0]?.split('|')[1] || ''],
  ['signup_url', (l) => l.site.signup_urls[0] || ''],
  ['app_url', (l) => l.site.app_urls[0] || l.site.login_urls[0] || ''],
  ['pricing_url', (l) => l.site.pricing_url || ''],
  ['work_email_to_sign_up', (l) => (l.render?.signup ? (l.render.signup.work_email_required ? 'yes' : 'no') : '')],
  ['ai_built', (l) => l.ai_built.value],
  ['ai_built_evidence', (l) => l.ai_built.evidence],
  ['built_with', (l) => l.site.built_with.join(' ')],
  ['ai_terms_on_site', (l) => l.site.ai_terms.join(' ')],
  ['open_source_repo', (l) => l.site.open_source_repo || l.github?.repo || ''],
  ['revenue_30d_usd', (l) => l.trustmrr?.revenue_30d_usd ?? ''],
  ['yc_batch', (l) => l.yc?.batch || ''],
  ['team_size', (l) => l.yc?.team_size ?? ''],
  ['github_stars', (l) => l.github?.stars ?? ''],
  ['open_jobs', (l) => l.hiring.open_jobs ?? ''],
  ['design_roles_open', (l) => l.hiring.design_roles.map((j) => `${j.title} (${j.days_open ?? '?'}d)`).join('; ')],
  ['design_role_urls', (l) => l.hiring.design_roles.map((j) => j.url).join(' ')],
  ['people', (l) => [...l.site.people.map((p) => `${p.name} (${p.title})`), ...(l.trustmrr?.founders || []).map((f) => `${f.name} (founder, TrustMRR)`)].join('; ')],
  ['emails', (l) => l.emails.map((e) => e.email + (e.verified ? `[${e.verified}]` : '')).join(' ')],
  ['email_types', (l) => l.emails.map((e) => e.type).join(' ')],
  ['linkedin_company', (l) => l.site.linkedin_company || ''],
  ['x_handle', (l) => l.site.x_handle || ''],
  ['screenshots', (l) => (l.render?.shots || []).map((s) => s.file).join(' ')],
  ['flags', (l) => l.flags.join('; ')],
  ['source', (l) => l.sources.join(' ')],
  ['source_url', (l) => l.source_url],
  ['score_parts', (l) => Object.entries(l.score.parts).map(([k, v]) => `${k}:${v}`).join(' ')],
  ['checked_at', (l) => l.checked_at],
];

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(leads) {
  const head = COLUMNS.map(([k]) => k).join(',');
  const body = leads.map((l) => COLUMNS.map(([, f]) => cell(f(l))).join(','));
  return [head, ...body].join('\n') + '\n';
}

export async function writeOutputs(leads, outDir) {
  await mkdir(outDir, { recursive: true });
  const sorted = [...leads].sort((a, b) => b.score.total - a.score.total);
  await writeFile(path.join(outDir, 'leads.csv'), toCsv(sorted));
  await writeFile(path.join(outDir, 'leads.json'), JSON.stringify(sorted, null, 2));
  return { csv: path.join(outDir, 'leads.csv'), json: path.join(outDir, 'leads.json') };
}
