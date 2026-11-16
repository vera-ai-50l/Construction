// Funnel report: from what each source gave us to verified named emails, per source,
// with the tool used at each step and what the paid steps cost.
import { snapshot, getCount } from './ledger.mjs';

const VIBE = (l) => /vibe/.test(l.vibe?.verdict || '');

export function funnelReport({ candidates, leads, kept, queue, args }) {
  const sources = [...new Set(leads.map((l) => l.sources[0]))];
  const by = (list, src) => list.filter((l) => l.sources[0] === src);
  const rawBySource = {
    trustmrr: getCount('trustmrr_pages_read'),
    'google-footprint': getCount('serp_results'),
  };
  const passedBySource = { trustmrr: getCount('trustmrr_passed_filter') };

  const rows = [];
  for (const src of sources) {
    const L = by(leads, src);
    const K = by(kept, src);
    const Q = by(queue, src);
    rows.push({
      source: src,
      sampled: rawBySource[src] ?? candidates.filter((c) => c.source === src).length,
      passed_source_filter: passedBySource[src] ?? candidates.filter((c) => c.source === src).length,
      taken_into_run: candidates.filter((c) => c.source === src).length,
      unique_companies: L.length,
      site_reachable: L.filter((l) => l.site?.reachable).length,
      not_polished: K.filter((l) => l.site?.reachable).length,
      vibe_coded: K.filter(VIBE).length,
      sent_to_contact_finding: Q.length,
      finder_found_people: Q.filter((l) => l.finder_people > 0).length,
      named_person: Q.filter((l) => l.contact_people > 0).length,
      email_candidate: Q.filter((l) => (l.contact_trail || []).length > 0).length,
      verified_ok: Q.filter((l) => l.contact?.verification === 'ok').length,
      catch_all: Q.filter((l) => l.contact?.verification === 'catch_all').length,
    });
  }
  const total = Object.fromEntries(Object.keys(rows[0] || { source: 0 }).map((k) => [k, k === 'source' ? 'ALL' : rows.reduce((s, r) => s + (r[k] || 0), 0)]));
  const ledger = snapshot();
  const verified = total.verified_ok || 0;
  const usable = verified + (total.catch_all || 0);

  const STEPS = [
    ['sampled', 'Sampled from source', 'TrustMRR pages read / Google results (Apify google-search-scraper)'],
    ['passed_source_filter', 'Passed source filter', `TrustMRR revenue >= $${args['min-revenue']}/30d; Google: builder-hosted product pages`],
    ['taken_into_run', 'Taken into this run', `--limit ${args.limit}`],
    ['unique_companies', 'Unique companies', 'dedupe by domain'],
    ['site_reachable', 'Website reachable', 'HTTP + headless browser'],
    ['not_polished', 'Not professionally designed', 'vibe check (fingerprints, design patterns, design spend)'],
    ['vibe_coded', 'Vibe-coded or likely', 'vibe check'],
    ['sent_to_contact_finding', 'Sent to contact finding', `top ${args['max-contacts']} by score`],
    ['finder_found_people', 'Finder returned people', `finder: ${args.finder}`],
    ['named_person', 'Named decision-maker known', 'finder + TrustMRR founder + people on site'],
    ['email_candidate', 'Email candidate checked', `up to ${args['max-candidates']} per lead`],
    ['verified_ok', 'Verified email (ok)', `verifier: ${args.verifier}`],
    ['catch_all', 'Catch-all (unconfirmable)', `verifier: ${args.verifier}`],
  ];
  const head = `| Step | Tool | ${rows.map((r) => r.source).join(' | ')} | All |`;
  const sep = `| --- | --- | ${rows.map(() => '---').join(' | ')} | --- |`;
  const body = STEPS.map(([k, label, tool]) => `| ${label} | ${tool} | ${rows.map((r) => r[k] ?? '').join(' | ')} | ${total[k] ?? ''} |`);
  const costLines = Object.entries(ledger.costs).map(([tool, c]) => `| ${tool} | ${c.units} ${c.unit}${c.units === 1 ? '' : 's'} | $${c.usd.toFixed(4)} |`);
  const markdown = [
    `# Funnel ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    head,
    sep,
    ...body,
    '',
    '| Paid tool | Units | Cost |',
    '| --- | --- | --- |',
    ...(costLines.length ? costLines : ['| none | 0 | $0.0000 |']),
    `| **Total** | | **$${ledger.total_usd.toFixed(4)}** |`,
    '',
    `Emails verified (checks spent): ${getCount('emails_verified')}`,
    `Cost per verified named email: ${verified ? '$' + (ledger.total_usd / verified).toFixed(4) : 'n/a'}`,
    `Cost per usable named email (ok + catch-all): ${usable ? '$' + (ledger.total_usd / usable).toFixed(4) : 'n/a'}`,
    '',
    'Free steps (TrustMRR pages, websites, job boards) cost nothing but time. Apify costs are the usage Apify reports for each run.',
  ].join('\n');
  return { markdown, data: { rows, total, ledger, emails_verified: getCount('emails_verified') } };
}
