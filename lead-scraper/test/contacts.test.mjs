import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Isolated cache, a fake MillionVerifier key and a mocked fetch: no network, no credits.
const cache = mkdtempSync(path.join(tmpdir(), 'leads-cache-'));
process.env.LEADS_CACHE_DIR = cache;
process.env.LEADS_HOST_GAP_MS = '0';
process.env.MILLIONVERIFIER_API_KEY = 'test-key';
const RESULTS = { 'jo@acme.io': 'invalid', 'jo.doe@acme.io': 'ok', 'sam@catchy.io': 'catch_all' };
const realFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = async (url) => {
    const email = new URL(url).searchParams.get('email');
    return new Response(JSON.stringify({ email, result: RESULTS[email] || 'invalid' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
});
after(() => {
  globalThis.fetch = realFetch;
  rmSync(cache, { recursive: true, force: true });
});

const { emailPatterns, findContact } = await import('../src/enrich/contacts.mjs');

test('patterns: first@ first, accents stripped', () => {
  assert.deepEqual(emailPatterns('Jösé', 'De la Cruz', 'x.io').slice(0, 2), ['jose@x.io', 'jose.delacruz@x.io']);
  assert.deepEqual(emailPatterns('', 'Doe', 'x.io'), []);
});

test('verified pattern wins; shared inboxes never become the contact', async () => {
  const lead = {
    domain: 'acme.io',
    site: { people: [{ name: 'Jo Doe', title: 'Founder & CEO' }], emails: [{ email: 'hello@acme.io', type: 'role' }] },
  };
  const { contact, tried } = await findContact(lead, []);
  assert.equal(contact.email, 'jo.doe@acme.io');
  assert.equal(contact.verification, 'ok');
  assert.equal(contact.first_name, 'Jo');
  assert.ok(tried.includes('jo@acme.io:invalid'));
  assert.ok(!tried.some((t) => t.startsWith('hello@')));
});

test('catch-all domains keep one flagged guess', async () => {
  const lead = { domain: 'catchy.io', site: { people: [], emails: [] }, trustmrr: { founders: [{ name: 'Sam Lee' }] } };
  const { contact } = await findContact(lead, []);
  assert.equal(contact.email, 'sam@catchy.io');
  assert.equal(contact.verification, 'catch_all');
});

test('apify people come first and their email is checked as given', async () => {
  RESULTS['ceo@acme.io'] = 'ok';
  const lead = { domain: 'acme.io', site: { people: [], emails: [] } };
  const { contact } = await findContact(lead, [{ first_name: 'Ana', last_name: 'Ray', title: 'CEO', email: 'ceo@acme.io', source: 'apify-leads-finder' }]);
  assert.equal(contact.email, 'ceo@acme.io');
  assert.equal(contact.email_source, 'apify-leads-finder');
});
