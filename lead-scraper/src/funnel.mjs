// Funnel report: from what each source gave us to verified named emails, per source,
// with the tool used at each step and what the paid steps cost.
import { snapshot, getCount } from './ledger.mjs';

const VIBE = (l) => /vibe/.test(l.vibe?.verdict || '');

const SOURCE_NOTES = {
  trustmrr: ['TrustMRR pages read', 'revenue >= --min-revenue in 30 days'],
  'google-footprint': ['Google results (Apify)', 'builder-hosted product pages'],
  commoncrawl: ['Common Crawl builder-hosted apps', 'not a throwaway project'],
  showhn: ['Show HN posts', 'a product, not a dev tool'],
  yc: ['YC companies in the dataset', 'active, B2B, AI + dashboards/analytics/evals/agents, batch in the last 2 years, team 2-40'],
  shopify: ['Shopify stores read (Common Crawl / Google)', 'own domain, open (no password page), 5+ products'],
};

export function funnelReport({ candidates, leads, kept, queue, args }) {
  const sources = [...new Set(leads.map((l) => l.sources[0]))];
  const by = (list, src) => list.filter((l) => l.sources[0] === src);
  const rawBySource = {
    trustmrr: getCount('trustmrr_pages_read'),
    'google-footprint': getCount('serp_results'),
    commoncrawl: getCount('commoncrawl_hosts'),
    yc: getCount('yc_considered'),
    shopify: getCount('shopify_stores_read'),
    showhn: getCount('showhn_posts'),
  };
  const passedBySource = { trustmrr: getCount('trustmrr_passed_filter'), 'google-footprint': getCount('serp_kept'), commoncrawl: getCount('commoncrawl_kept'), showhn: getCount('showhn_kept'), yc: getCount('yc_matched'), shopify: getCount('shopify_stores_kept') };

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
      paid_product: L.filter((l) => l.paid_product).length,
      not_polished: K.filter((l) => l.site?.reachable).length,
      vibe_coded: K.filter(VIBE).length,
      design_role_open: K.filter((l) => l.hiring?.design_roles?.length).length,
      store_us_eu: K.filter((l) => l.store?.us_eu).length,
      overlay_found: K.filter((l) => l.store?.overlay).length,
      login_checked: K.filter((l) => l.product_access && l.product_access.login_required !== 'unknown').length,
      login_not_required: K.filter((l) => l.product_access?.login_required === 'no').length,
      sent_to_contact_finding: Q.length,
      mail_domain_known: Q.filter((l) => l.mail_domain).length,
      finder_found_people: Q.filter((l) => l.finder_people > 0).length,
      name_search_found: Q.filter((l) => l.search_people?.length).length,
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
    ['sampled', 'Sampled from source', sources.map((x) => SOURCE_NOTES[x]?.[0] || x).join(' / ')],
    ['passed_source_filter', 'Passed source filter', sources.map((x) => SOURCE_NOTES[x]?.[1] || x).join('; ')],
    ['taken_into_run', 'Taken into this run', `--limit ${args.limit} per source`],
    ['unique_companies', 'Unique companies', 'dedupe by domain'],
    ['site_reachable', 'Website reachable', 'HTTP + headless browser'],
    ['paid_product', 'Paid product', 'TrustMRR revenue, or prices/pricing found on the site'],
    ['not_polished', 'Not professionally designed', 'vibe check (fingerprints, design patterns, design spend)'],
    ['vibe_coded', 'Vibe-coded or likely', 'vibe check'],
    ['design_role_open', 'Open design role (buying signal)', 'Ashby / Greenhouse / Lever job boards'],
    ['store_us_eu', 'Store based in the US or EU', 'Shopify store settings (country, currency)'],
    ['overlay_found', 'Accessibility overlay installed', 'script on the homepage (accessiBe, UserWay, AudioEye...)'],
    ['login_checked', 'Login wall checked', 'sign-up / app page opened in a browser'],
    ['login_not_required', 'Product visible without login', 'public demo, sandbox or embedded tour'],
    ['sent_to_contact_finding', 'Sent to contact finding', `top ${args['max-contacts']} by score`],
    ['mail_domain_known', 'Company mail domain known', 'own domain, or the domain a builder-hosted app publishes'],
    ['finder_found_people', 'Finder returned people', `finder: ${args.finder}`],
    ['name_search_found', 'Named via Google (LinkedIn titles)', args['name-search'] ? 'Apify google-search-scraper, 1 query per anonymous company' : 'off (--name-search)'],
    ['named_person', 'Named decision-maker known', 'finder + TrustMRR founder + people on site'],
    ['email_candidate', 'Email candidate checked', `up to ${args['max-candidates']} per lead`],
    ['verified_ok', 'Verified email (ok)', `verifier: ${args.verifier}`],
    ['catch_all', 'Catch-all (unconfirmable)', `verifier: ${args.verifier}`],
  ];
  // Vibe-check steps only mean something for the vibe profile.
  if (!leads.some((l) => l.profile === 'vibe')) for (let i = STEPS.length - 1; i >= 0; i--) if (['paid_product', 'not_polished', 'vibe_coded'].includes(STEPS[i][0])) STEPS.splice(i, 1);
  const OPTIONAL = new Set(['paid_product', 'not_polished', 'vibe_coded', 'finder_found_people', 'name_search_found', 'design_role_open', 'store_us_eu', 'overlay_found', 'login_checked', 'login_not_required', 'mail_domain_known']);
  for (let i = STEPS.length - 1; i >= 0; i--) if (OPTIONAL.has(STEPS[i][0]) && !total[STEPS[i][0]]) STEPS.splice(i, 1);
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
  return { markdown, data: { rows, total, ledger, steps: STEPS.map(([key, label, tool]) => ({ key, label, tool })), emails_verified: getCount('emails_verified') } };
}
