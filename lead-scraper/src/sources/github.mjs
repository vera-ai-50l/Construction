// Source: popular open-source B2B products on GitHub that have a company homepage.
// Uses the public search API (10 requests/minute without a token; set GITHUB_TOKEN for 30).
import { getJson } from '../http.mjs';
import { isCompanySite } from '../domain.mjs';

export async function githubProducts({ topics, minStars = 1500, perTopic = 30 }) {
  const headers = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const seen = new Map();
  for (const topic of topics) {
    const q = encodeURIComponent(`topic:${topic} stars:>=${minStars} archived:false`);
    const data = await getJson(
      `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${perTopic}`,
      { headers },
    );
    for (const r of data?.items || []) {
      if (!r.homepage || !isCompanySite(r.homepage) || seen.has(r.full_name)) continue;
      seen.set(r.full_name, {
        name: r.owner?.login || r.name,
        website: r.homepage,
        source: 'github',
        source_url: r.html_url,
        description: r.description || '',
        github: {
          repo: r.full_name,
          stars: r.stargazers_count,
          pushed_at: r.pushed_at,
          topic,
          owner_type: r.owner?.type,
        },
      });
    }
  }
  // Organisation-owned repos are far more likely to have a company behind them.
  return [...seen.values()].filter((x) => x.github.owner_type === 'Organization');
}
