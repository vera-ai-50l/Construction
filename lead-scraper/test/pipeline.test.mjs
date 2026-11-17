import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { remarks } from '../src/remarks.mjs';
import { score } from '../src/score.mjs';
import { PRESETS } from '../src/pipeline.mjs';

const site = (o = {}) => ({ reachable: true, people: [], emails: [], public_demo_urls: [], demo_embeds: [], app_urls: [], login_urls: [], signup_urls: [], ctas: {}, built_with: [], ai_terms: [], pricing_url: null, ...o });

test('remarks say whether a login is needed and what the teardown can use', () => {
  const lead = { domain: 'acme.ai', profile: 'type_b', site: site(), product_access: { login_required: 'yes', mode: 'self-serve-work-email', detail: 'free sign-up, work email only' }, emails: [{ email: 'hello@acme.ai' }], hiring: { design_roles: [{ title: 'Product Designer' }], oldest_design_role_days: 61 } };
  const r = remarks(lead);
  assert.ok(r.includes('Login required: free sign-up, work email only'));
  assert.ok(r.some((x) => /^Teardown: a person signs up/.test(x)));
  assert.ok(r.some((x) => /only a shared inbox found \(hello@acme\.ai\)/.test(x)));
  assert.ok(r.some((x) => /hiring "Product Designer" \(open 61 days\)/.test(x)));
  const de = remarks({ domain: 'acme.de', site: site(), contact: { email: 'jo@acme.de', verification: 'ok' } });
  assert.ok(de.some((x) => /^Compliance: German/.test(x)));
});

test('Shopify stores score on overlay, size signals and US/EU base', () => {
  const store = { overlay: 'accessiBe', default_theme: false, theme: 'Custom', theme_store_id: null, images_missing_alt: 12, paid_apps: ['Klaviyo', 'Gorgias'], products: 80, last_product_update_days: 5, us_eu: true };
  const lead = { store, site: site(), contact: { email: 'amy@brand.com', verification: 'ok' }, emails: [] };
  const s = score(lead);
  assert.equal(s.parts.access, 25);
  assert.ok(s.total >= 70, `expected a strong store, got ${s.total}`);
  const weak = score({ ...lead, store: { ...store, overlay: null, paid_apps: [], images_missing_alt: 0, us_eu: false, last_product_update_days: 400 }, contact: null });
  assert.ok(weak.total < s.total - 20);
});

test('presets exist and the n8n workflows wire every node', () => {
  assert.deepEqual(Object.keys(PRESETS), ['type_a', 'type_b', 'type_c']);
  execFileSync(process.execPath, ['deploy/n8n/build.mjs']);
  const wf = JSON.parse(readFileSync('deploy/n8n/type-a-leads.json', 'utf8'));
  const names = new Set(wf.nodes.map((n) => n.name));
  for (const n of ['Schedule', 'Start run', 'Check run', 'Done?', 'Google Sheet']) assert.ok(names.has(n), n);
  assert.equal(wf.connections['Failed?'].main[1][0].node, 'Wait 5 min'); // still running -> wait again
  assert.match(JSON.stringify(wf.nodes.find((n) => n.name === 'Start run').parameters), /type_a/);
});
