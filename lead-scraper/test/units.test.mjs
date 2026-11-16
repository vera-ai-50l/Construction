import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, robotsAllows } from '../src/http.mjs';
import { parseCsv } from '../src/sources/seed.mjs';
import { registrableDomain, isCompanySite } from '../src/domain.mjs';
import { parseTrustmrrPage } from '../src/sources/trustmrr.mjs';
import { accessLevel, aiBuilt, score } from '../src/score.mjs';
import { toCsv } from '../src/export.mjs';

test('robots: star group, longest match wins, empty Disallow allows', () => {
  const rules = parseRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /app\nAllow: /app/public\nDisallow:\n');
  assert.equal(robotsAllows(rules, '/pricing'), true);
  assert.equal(robotsAllows(rules, '/app/settings'), false);
  assert.equal(robotsAllows(rules, '/app/public/x'), true);
});

test('csv: quotes, commas and newlines', () => {
  const rows = parseCsv('name,website,notes\n"Acme, Inc",acme.com,"said ""hi""\nthere"\n');
  assert.deepEqual(rows, [{ name: 'Acme, Inc', website: 'acme.com', notes: 'said "hi"\nthere' }]);
});

test('domains', () => {
  assert.equal(registrableDomain('https://app.foo.co.uk/x'), 'foo.co.uk');
  assert.equal(registrableDomain('www.Bar.io'), 'bar.io');
  assert.equal(isCompanySite('https://github.com/acme'), false);
  assert.equal(isCompanySite('acme.ai'), true);
});

test('trustmrr page: revenue from title, org from JSON-LD', () => {
  const ld = { '@graph': [{ '@type': 'Organization', name: 'Acme', url: 'https://acme.app/', keywords: ['B2B', 'lovable'], founder: [{ name: 'Jo Doe' }] }] };
  const html = `<title>Acme revenue: $12,345 in the last 30 days | TrustMRR</title><script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  const r = parseTrustmrrPage(html, 'https://trustmrr.com/startup/acme');
  assert.equal(r.trustmrr.revenue_30d_usd, 12345);
  assert.equal(r.website, 'https://acme.app/');
  assert.equal(r.trustmrr.founders[0].name, 'Jo Doe');
});

const site = (over = {}) => ({
  public_demo_urls: [], demo_embeds: [], ctas: {}, demo_credentials_hint: false, signup_urls: [], app_urls: [], login_urls: [],
  built_with: [], people: [], pricing_url: null, linkedin_company: null, x_handle: null, ai_term_hits: 0, large_company_hint: false, ...over,
});

test('access levels follow the report scale', () => {
  assert.equal(accessLevel(site({ demo_embeds: ['storylane|x.storylane.io/share/1'] })).level, 'B');
  assert.equal(accessLevel(site({ signup_urls: ['https://a.com/signup'] })).level, 'D');
  assert.equal(accessLevel(site()).level, 'E');
  assert.equal(accessLevel(site(), { public_demo_open: 'https://demo.a.com' }).level, 'A');
});

test('AI-built detection uses site fingerprints and TrustMRR stack', () => {
  assert.equal(aiBuilt(site({ built_with: ['lovable'] }), {}).value, 'yes');
  assert.equal(aiBuilt(site(), { trustmrr: { keywords: ['nextjs', 'supabase'] } }).value, 'maybe');
});

test('score stays within the 100-point model and CSV escapes', () => {
  const lead = {
    profile: 'type_b', name: 'Acme, "Inc"', domain: 'acme.ai', website: 'acme.ai', sources: ['seed'], source_url: '', checked_at: '',
    site: site({ fetched_url: 'https://acme.ai/', ai_terms: [], people: [{ name: 'Jo Doe', title: 'CEO' }] }),
    access: { level: 'D', evidence: '' }, ai_built: { value: 'unknown', evidence: '' },
    hiring: { open_jobs: 6, design_roles: [{ title: 'Product Designer', days_open: 90, url: 'u' }], oldest_design_role_days: 90 },
    emails: [{ email: 'jo@acme.ai', type: 'personal' }], yc: { team_size: 25, stage: 'Early', batch: 'Winter 2025' }, flags: [],
  };
  lead.score = score(lead);
  assert.ok(lead.score.total > 0 && lead.score.total <= 100);
  assert.equal(lead.score.parts.access, 12);
  assert.match(toCsv([lead]), /"Acme, ""Inc"""/);
});
