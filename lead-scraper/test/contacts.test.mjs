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

const { emailPatterns, findContacts, candidatesFor, knownPeople } = await import('../src/enrich/contacts.mjs');
const { snapshot } = await import('../src/ledger.mjs');
const opts = { finder: 'none', verifier: 'mv', maxCandidates: 3 };

test('patterns: first@ first, accents stripped', () => {
  assert.deepEqual(emailPatterns('Jösé', 'De la Cruz', 'x.io').slice(0, 2), ['jose@x.io', 'jose.delacruz@x.io']);
  assert.deepEqual(emailPatterns('', 'Doe', 'x.io'), []);
});

test('candidates: capped, no shared inboxes, no patterns on shared app hosts', () => {
  const people = [{ first_name: 'Jo', last_name: 'Doe', title: 'CEO', email: '', source: 'trustmrr' }];
  assert.deepEqual(candidatesFor({ domain: 'acme.io' }, people, 2).map((c) => c.email), ['jo@acme.io', 'jo.doe@acme.io']);
  assert.deepEqual(candidatesFor({ domain: 'thing.lovable.app' }, people, 3), []);
  const lead = { domain: 'acme.io', site: { people: [], emails: [{ email: 'hello@acme.io' }] } };
  assert.equal(knownPeople(lead).length, 0);
});

test('batch: verified pattern wins, catch-all stops and is flagged, rounds only retry unresolved', async () => {
  const acme = { domain: 'acme.io', site: { people: [{ name: 'Jo Doe', title: 'Founder & CEO' }], emails: [{ email: 'hello@acme.io', type: 'role' }] } };
  const catchy = { domain: 'catchy.io', site: { people: [], emails: [] }, trustmrr: { founders: [{ name: 'Sam Lee' }] } };
  const nobody = { domain: 'nobody.io', site: { people: [], emails: [] } };
  await findContacts([acme, catchy, nobody], opts);
  assert.equal(acme.contact.email, 'jo.doe@acme.io');
  assert.equal(acme.contact.verification, 'ok');
  assert.deepEqual(acme.contact_trail, ['jo@acme.io:invalid', 'jo.doe@acme.io:ok']);
  assert.equal(catchy.contact.email, 'sam@catchy.io');
  assert.equal(catchy.contact.verification, 'catch_all');
  assert.equal(catchy.contact_trail.length, 1);
  assert.equal(nobody.contact, null);
  assert.equal(snapshot().counts.emails_verified, 3);
});

test('a finder email is checked as given, before patterns', async () => {
  RESULTS['ceo@acme.io'] = 'ok';
  const lead = { domain: 'acme.io', site: { people: [], emails: [] } };
  const people = knownPeople(lead, [{ first_name: 'Ana', last_name: 'Ray', title: 'CEO', email: 'ceo@acme.io', source: 'finder:pipelinelabs' }]);
  const c = candidatesFor(lead, people);
  assert.equal(c[0].email, 'ceo@acme.io');
  assert.equal(c[0].origin, 'finder:pipelinelabs');
});

test('legal notices name the owner; companies and hosts are not people', async () => {
  const { legalPeople, isRoleMailbox } = await import('../src/enrich/site.mjs');
  assert.equal(legalPeople('Directeur de la publication : M. Marc Pfeiler. Hébergeur : OVH')[0].name, 'Marc Pfeiler');
  assert.equal(legalPeople('Geschäftsführer: Anna Müller')[0].name, 'Anna Müller');
  assert.equal(legalPeople('This site is operated by Jane Smith, a sole trader')[0].name, 'Jane Smith');
  assert.deepEqual(legalPeople('operated by Acme Labs Inc'), []);
  assert.ok(isRoleMailbox('grow@x.io') && !isRoleMailbox('jake@x.io'));
});

test('builder-hosted apps use the company domain their pages publish', () => {
  const lead = { domain: 'loadit.lovable.app', site: { emails: [{ email: 'support@optimizeit.ai' }, { email: 'legal@optimizeit.ai' }, { email: 'me@gmail.com' }], people: [{ name: 'Lucas Cannon', title: 'Founder & CEO' }] } };
  assert.deepEqual(candidatesFor(lead, knownPeople(lead), 2).map((c) => c.email), ['lucas@optimizeit.ai', 'lucas.cannon@optimizeit.ai']);
  assert.deepEqual(candidatesFor({ domain: 'x.lovable.app', site: { emails: [] } }, knownPeople({ site: { people: [{ name: 'Jo Doe', title: 'CEO' }] } })), []);
});
