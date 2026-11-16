import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRecipient, writeEmail } from '../src/teardown/email.mjs';
import { findings } from '../src/teardown/findings.mjs';
import { reviewFindings, Review } from '../src/teardown/review.mjs';

const lead = (over = {}) => ({
  name: 'Acme', profile: 'type_b', domain: 'acme.ai', yc: { team_size: 12 },
  site: { people: [{ name: 'Jo Doe', title: 'Co-founder & CEO' }], signup_urls: [], ctas: {}, demo_embeds: [], pricing_url: null },
  access: { level: 'D' }, emails: [], ...over,
});

test('recipient: never security/support inboxes; founder name on small teams', () => {
  assert.equal(chooseRecipient(lead({ emails: [{ email: 'security@acme.ai', type: 'role' }] })), null);
  const r = chooseRecipient(lead({ emails: [{ email: 'support@acme.ai', type: 'role' }, { email: 'hello@acme.ai', type: 'role' }] }));
  assert.equal(r.email, 'hello@acme.ai');
  assert.equal(r.greeting, 'Hi Jo');
  const big = chooseRecipient(lead({ yc: { team_size: 200 }, emails: [{ email: 'hello@acme.ai', type: 'role' }] }));
  assert.equal(big.greeting, 'Hi Acme team');
});

test('findings quote measured numbers and stay quiet when there is nothing', () => {
  const screens = [
    { kind: 'home', device: 'desktop', lcp_ms: 7000, bytes: 1e6, requests: 40, ctas_above_fold: [], text_length: 2000, axe: [], font_families: ['inter'], broken_images: 0, console_errors: [], meta_description: 'x' },
    { kind: 'home', device: 'mobile', overflow_px: 120, small_targets: 3, tiny_text: 0 },
  ];
  const f = findings(screens, lead());
  assert.deepEqual(f.map((x) => x.key).sort(), ['mobile_overflow', 'no_cta_fold', 'slow_lcp']);
  assert.match(f.find((x) => x.key === 'slow_lcp').issue, /7\.0s/);
  assert.equal(findings([], lead()).length, 0);
});

test('email: reviewed findings first, three at most, no exclamation marks', () => {
  const review = Review.parse({
    visual_findings: [{ screen: 'home', severity: 3, issue: 'The headline is vague.', impact: 'People leave.', fix: 'Say what it does.' }],
    strength: 'the demo is public', looks_ai_generated: false, ai_look_evidence: '',
    subject: "acme's vague headline", hook: 'The headline is vague.',
  });
  const measured = [
    { key: 'a', screen: 'home', severity: 2, issue: 'Measured A.', impact: 'x.', fix: 'Fix a.' },
    { key: 'b', screen: 'home', severity: 1, issue: 'Measured B.', impact: 'y.', fix: 'Fix b.' },
    { key: 'c', screen: 'home', severity: 1, issue: 'Measured C.', impact: 'z.', fix: 'Fix c.' },
  ];
  const mail = writeEmail(lead(), { greeting: 'Hi Jo' }, [...reviewFindings(review), ...measured], [review.strength], ['homepage']);
  assert.equal(mail.findings_used.length, 3);
  // The reviewed finding opens the email (it is the inbox preview); the rest are listed.
  assert.match(mail.body, /^Hi Jo,\n\nThe headline is vague\. People leave\./);
  assert.match(mail.body, /1\. Measured A\./);
  assert.doesNotMatch(mail.body, /!/);
  assert.equal(mail.subject, "acme's vague headline");
  assert.ok(mail.subject.length <= 60);
});

test('subjects from measured findings name the company and the number', () => {
  const mail = writeEmail(
    lead({ hiring: { design_roles: [{ title: 'Senior Product Designer' }] } }),
    null,
    [{ key: 'slow_lcp', screen: 'home', severity: 3, metric: '8.4s', issue: 'Slow.', impact: 'Bad.', fix: 'Faster.' }],
    [],
  );
  assert.equal(mail.subject, 'acme took 8.4s to load');
  assert.equal(mail.subject_alt, 'while acme hires a product designer');
  assert.match(mail.body, /^Hi Acme team,\n\nYour homepage's main content took 8\.4s/);
});
