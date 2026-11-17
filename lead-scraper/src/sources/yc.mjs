// Source: the public YC company dataset (https://github.com/yc-oss/api), refreshed daily.
import { count } from '../ledger.mjs';
import { getJson } from '../http.mjs';

const ALL = 'https://yc-oss.github.io/api/companies/all.json';

const text = (c) =>
  [c.one_liner, c.long_description, (c.tags || []).join(' '), (c.industries || []).join(' '), c.subindustry]
    .filter(Boolean)
    .join(' \n ');

const batchYear = (batch) => {
  const m = String(batch || '').match(/(\d{4})|([WSFX])(\d{2})\b/);
  if (!m) return 0;
  return m[1] ? Number(m[1]) : 2000 + Number(m[3]);
};

/**
 * @param {object} q  { include: RegExp, exclude?: RegExp, minYear?, minTeam?, maxTeam?, b2bOnly? }
 */
export async function ycCompanies(q) {
  const all = await getJson(ALL);
  if (!Array.isArray(all)) throw new Error('Could not load the YC dataset');
  count('yc_considered', all.length);
  const rows = all
    .filter((c) => c.status === 'Active' && c.website)
    .filter((c) => !q.minYear || batchYear(c.batch) >= q.minYear)
    .filter((c) => !q.minTeam || (c.team_size || 0) >= q.minTeam)
    .filter((c) => !q.maxTeam || (c.team_size || 0) <= q.maxTeam)
    .filter((c) => !q.b2bOnly || /B2B|Industrials|Healthcare|Fintech/i.test(c.industry || ''))
    .filter((c) => q.include.test(text(c)))
    .filter((c) => !q.exclude || !q.exclude.test(text(c)))
    // Default: hiring companies first, then bigger teams. q.recentFirst: newest batch
    // first (closest to the funding round), then hiring.
    .sort((a, b) =>
      q.recentFirst
        ? batchYear(b.batch) - batchYear(a.batch) || batchSeason(b.batch) - batchSeason(a.batch) || Number(!!b.isHiring) - Number(!!a.isHiring)
        : Number(!!b.isHiring) - Number(!!a.isHiring) || (b.team_size || 0) - (a.team_size || 0))
    .map((c) => ({
      name: c.name,
      website: c.website,
      source: 'yc',
      source_url: c.url,
      description: c.one_liner || '',
      yc: {
        batch: c.batch,
        team_size: c.team_size || null,
        stage: c.stage,
        is_hiring: !!c.isHiring,
        location: c.all_locations || '',
        tags: c.tags || [],
      },
    }));
  count('yc_matched', rows.length);
  return rows;
}
// Within a year: Winter < Spring < Summer < Fall.
const batchSeason = (b = '') => ({ winter: 1, x: 1, w: 1, spring: 2, summer: 3, s: 3, fall: 4, f: 4 })[String(b).toLowerCase().match(/^(winter|spring|summer|fall|[wxsf])/)?.[1]] || 0;
