import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { selectLeads, checkEmail } from '../src/daily.mjs';
import { writeDocs, readDocs, restoreState, queueId, queueDoc } from '../src/desk.mjs';

const lead = (o) => ({ company: 'Acme', domain: 'acme.com', website: 'https://acme.com', first_name: 'Ana', last_name: 'Lee', email: 'ana@acme.com', email_verification: 'ok', fit_score: 50, login_required: 'no', ...o });

test('selectLeads keeps named, new, verifiable people and routes logins', () => {
  const scored = {
    type_b: [
      lead({}),
      lead({ domain: 'shared.com', email: 'hello@shared.com' }), // shared inbox
      lead({ domain: 'firma.de', email: 'max@firma.de' }), // Germany: LinkedIn only
      lead({ domain: 'old.com', email: 'jo@old.com' }), // already pushed
      lead({ domain: 'oldco.com', email: 'sam@oldco.com' }), // colleague already pushed
      lead({ domain: 'risky.com', email: 'x@risky.com', email_verification: 'invalid' }),
      lead({ domain: 'gated.com', email: 'kim@gated.com', login_required: 'yes' }),
      lead({ domain: 'noname.com', email: 'pat@noname.com', first_name: '' }),
    ],
    type_b_jobs: [lead({ email: 'other@acme.com' }), lead({ domain: 'cc.com', email: 'cc@cc.com', email_verification: 'catch_all', fit_score: 90 })],
  };
  const pushed = [{ email: 'jo@old.com', domain: 'old.com' }, { email: 'lee@oldco.com', domain: 'oldco.com' }];
  const r = selectLeads(scored, pushed, { maxTeardowns: 10, maxLogins: 5 });
  assert.deepEqual(r.teardown.map((x) => x.domain), ['acme.com', 'cc.com']); // verified first, one per company
  assert.equal(r.teardown[0].preset, 'type_b');
  assert.deepEqual(r.logins.map((x) => x.domain), ['gated.com']);
});

test('checkEmail flags placeholders and missing parts', () => {
  const ok = { subject: "'welcome back' on a first visit", subject_alt: 'Ana, about your home screen', email_body: 'Hi Ana,\n\nShort.', followup_1: 'Hi Ana,\n\nOne more.', followup_2: 'Hi Ana,\n\nLast note.' };
  assert.deepEqual(checkEmail(ok), []);
  assert.ok(checkEmail({ ...ok, followup_2: '' }).includes('followup_2 missing'));
  assert.ok(checkEmail({ ...ok, email_body: 'Hi [FIRST_NAME],' }).includes('placeholder left in'));
  assert.ok(checkEmail({ ...ok, subject: 'wow!' }).includes('exclamation mark in subject'));
});

test('desk documents round-trip and rebuild state without losing local memory', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'desk-'));
  const id = queueId('2026-11-19', 'Ana@Acme.com');
  assert.equal(id, '2026-11-19_ana@acme.com');
  const { count, manifests } = writeDocs(path.join(dir, 'desk'), [
    { collection: 'queue', doc_id: id, data: queueDoc(lead({ subject: 's' }), '2026-11-19') },
    { collection: 'ledger', doc_id: 'pushed-2026-11-19-0800', data: { log: [{ date: '2026-11-19', email: 'ana@acme.com', domain: 'acme.com' }] } },
    { collection: 'ledger', doc_id: 'state-type_b-2026-11-18', data: { preset: 'type_b', date: '2026-11-18', next_offset: 60, delivered: ['a.com'] } },
    { collection: 'ledger', doc_id: 'state-type_b-2026-11-19', data: { preset: 'type_b', date: '2026-11-19', next_offset: 120, delivered: ['a.com', 'b.com'] } },
  ]);
  assert.equal(count, 4);
  const writes = JSON.parse(readFileSync(manifests[0], 'utf8'));
  assert.equal(writes[0].op, 'set');
  assert.equal(readDocs(path.join(dir, 'desk'), 'queue')[0].status, 'pending');
  const stateDir = path.join(dir, 'state');
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(path.join(stateDir, 'type_b.json'), JSON.stringify({ next_offset: 200, delivered: ['local.com'] }));
  const r = restoreState(readDocs(path.join(dir, 'desk'), 'ledger'), stateDir);
  assert.equal(r.pushed, 1);
  const s = JSON.parse(readFileSync(path.join(stateDir, 'type_b.json'), 'utf8'));
  assert.equal(s.next_offset, 200);
  assert.deepEqual(s.delivered.sort(), ['a.com', 'b.com', 'local.com']);
});
