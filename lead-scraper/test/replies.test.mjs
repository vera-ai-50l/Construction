import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saleshandyAlert } from '../src/replies.mjs';

const ev = (event, reply, extra = {}) => ({ event, prospect: { firstName: 'Julian', lastName: 'Fx', email: 'julian@fx.example', company: 'Athletedata' }, replyContent: reply, sequenceName: 'Kyre A · verified', subject: "'all whoop slots are taken'", ...extra });

test('reply alerts: interested, unsubscribe, out-of-office, bounce', () => {
  const yes = saleshandyAlert(ev('reply-received', '<p>Yes, send it over!</p><p>On Tue, 17 Nov 2026 Kyre wrote: ...</p>'));
  assert.equal(yes.kind, 'interested');
  assert.ok(yes.notify && yes.urgent);
  assert.match(yes.text, /Interested reply.*Julian Fx \(Athletedata\)/);
  assert.match(yes.text, /“Yes, send it over!”/);
  assert.doesNotMatch(yes.text, /wrote:/);
  assert.equal(saleshandyAlert(ev('reply-received', 'Please remove me from your list')).kind, 'unsubscribe');
  const ooo = saleshandyAlert(ev('reply-received', 'I am out of the office until Monday.'));
  assert.equal(ooo.kind, 'out_of_office');
  assert.equal(ooo.notify, false);
  assert.equal(saleshandyAlert(ev('email-bounced', '')).kind, 'bounce');
  assert.equal(saleshandyAlert(ev('reply-received', 'What would this cost?')).kind, 'question');
  assert.match(saleshandyAlert(ev('reply-received', 'a < b & c')).text, /a &lt; b &amp; c/);
});

test('the relay workflow embeds the classifier and wires both webhooks', async () => {
  const { execFileSync } = await import('node:child_process');
  const { readFileSync } = await import('node:fs');
  execFileSync(process.execPath, ['deploy/n8n/build-relay.mjs']);
  const wf = JSON.parse(readFileSync('deploy/n8n/kyre-telegram-relay.json', 'utf8'));
  const code = wf.nodes.find((x) => x.name === 'Read the event').parameters.jsCode;
  assert.match(code, /function saleshandyAlert/);
  assert.equal(wf.connections['Worth a ping?'].main[0][0].node, 'Telegram: reply alert');
  assert.deepEqual(wf.nodes.filter((x) => x.type === 'n8n-nodes-base.webhook').map((x) => x.parameters.path).sort(), ['kyre-notify', 'kyre-replies']);
  // The embedded code runs on its own (no imports), as n8n will run it.
  const fn = new Function(`${code.replace('return { json:', 'const out = {json:').replace(/;\s*$/, ';')}; return out;`.replace('$json.body || $json', 'input'));
  assert.ok(fn);
});
