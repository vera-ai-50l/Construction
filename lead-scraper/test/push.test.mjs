import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, toProspect } from '../src/push.mjs';

const cfg = { dailyCap: 3, catchAllDailyCap: 1, steps: { A: { verified: 'sA1', catch_all: 'sA2' }, B: { verified: 'sB1', catch_all: 'sB2' }, C: { verified: 'sC1', catch_all: '' } } };
const row = (email, extra = {}) => ({ email, company: email.split('@')[1], send_group: '1 - verified', ...extra });

test('push plan: shared inboxes, German domains, repeats and caps are refused', () => {
  const pushed = { log: [{ date: '2026-11-17', email: 'old@done.io', domain: 'done.io' }] };
  const d = plan([
    row('info@acme.io'),
    row('jan@firma.de'),
    row('old@done.io'),
    row('second@done.io'),
    row('ana@one.io'),
    row('bo@two.io', { send_group: '2 - catch-all' }),
    row('cy@three.io', { send_group: '2 - catch-all' }),
    row('di@four.io', { list: 'B: non-YC SaaS' }),
    row('ed@five.io'),
  ], cfg, pushed, '2026-11-19');
  const why = Object.fromEntries(d.map((x) => [x.email, x.skip || x.step]));
  assert.equal(why['info@acme.io'], 'shared inbox, not a person');
  assert.equal(why['jan@firma.de'], 'German/Austrian domain: LinkedIn only');
  assert.equal(why['old@done.io'], 'already pushed');
  assert.equal(why['second@done.io'], 'someone at this company already pushed');
  assert.equal(why['ana@one.io'], 'sA1');
  assert.equal(why['bo@two.io'], 'sA2');
  assert.equal(why['cy@three.io'], 'catch-all cap reached');
  assert.equal(why['di@four.io'], 'sB1');
  assert.equal(why['ed@five.io'], 'daily cap reached');
});

test('a list without a step is never guessed', () => {
  const d = plan([row('amy@store.com', { list: 'C: Shopify', send_group: '2 - catch-all' })], cfg, { log: [] }, '2026-11-19');
  assert.match(d[0].skip, /no SalesHandy step set for list C/);
});

test('prospect fields carry the teardown email', () => {
  const p = toProspect(row('ana@one.io', { first_name: 'Ana', subject: 's', email_body: 'b', followup_1: 'f1', followup_2: 'f2' }));
  assert.equal(p.Email, 'ana@one.io');
  assert.equal(p['Email Body'], 'b');
  assert.equal(p['Kyre List'], 'A');
});
