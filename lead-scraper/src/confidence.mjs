// Confidence scores shown in the lead and batch workbooks (0-100, higher is better).

/**
 * Email confidence, 0-100: will this reach the right person?
 * Verification sets the base; where the address and the name came from adjusts it.
 */
export function emailConfidence(lead) {
  const c = lead.contact;
  let s = c.verification === 'ok' ? 85 : c.verification === 'catch_all' ? 55 : 20;
  const src = c.email_source || '';
  const why = [c.verification === 'ok' ? 'server confirmed the mailbox' : 'catch-all server: cannot be confirmed'];
  if (/hn profile|^company site/.test(src)) (s += 10), why.push('address published by them');
  else if (/trustmrr/.test(src)) (s += 5), why.push('name from their own TrustMRR listing');
  else if (/google \(LinkedIn/.test(src)) (s -= 10), why.push('name found by search: check LinkedIn');
  const emailDomain = c.email.split('@')[1];
  const companyDomain = lead.mail_domain || lead.domain;
  if (!/gmail|outlook|yahoo|icloud|proton/.test(emailDomain) && emailDomain !== companyDomain && !companyDomain.endsWith(emailDomain)) (s -= 15), why.push('address is on another domain');
  return { score: Math.max(10, Math.min(98, s)), why: why.join('; ') };
}

/** Teardown confidence, 0-100: how specific and well-founded is the email's content? */
export function teardownConfidence(t) {
  if (!t) return { score: 0, why: 'no teardown' };
  const used = t.email?.findings_used?.length || 0;
  const reviewed = ['file', 'ai'].includes(t.send_row.review) || t.findings.some((f) => f.metric === 'reviewed');
  const screens = Object.keys(t.shots || {}).length;
  let s = 35 + used * 12 + (reviewed ? 15 : 0) + (screens >= 3 ? 5 : 0);
  const why = [`${used} finding${used === 1 ? '' : 's'} in the email`, reviewed ? 'screens looked at by a person' : 'measured checks only', `${screens} screenshots`];
  return { score: Math.min(95, s), why: why.join('; ') };
}

