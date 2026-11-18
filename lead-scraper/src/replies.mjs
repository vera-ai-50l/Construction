// Turn a SalesHandy webhook event into a Telegram alert. Self-contained (no imports) so
// the n8n workflow can embed the function as-is (deploy/n8n/build-relay.mjs).
//
// Kinds: interested, question, not_now, unsubscribe, out_of_office, reply (unclear),
// bounce, sequence_paused, account_problem. Out-of-office replies never ping anyone.
export function saleshandyAlert(body) {
  const flat = {};
  const walk = (o, p = '') => {
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
    else flat[p.toLowerCase()] = o;
  };
  walk(body || {});
  const find = (...names) => {
    for (const n of names) for (const [k, v] of Object.entries(flat)) if ((k === n || k.endsWith(`.${n}`)) && v != null && v !== '') return String(v);
    return '';
  };
  const strip = (s) => String(s || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').trim();
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const event = find('event', 'webhookevent', 'eventtype', 'type').toLowerCase();
  const email = find('email', 'prospectemail', 'contactemail', 'toemail').toLowerCase();
  const name = [find('firstname', 'first name', 'first_name'), find('lastname', 'last name', 'last_name')].filter(Boolean).join(' ') || find('name', 'prospectname');
  const company = find('company', 'companyname', 'company name');
  const sequence = find('sequencename', 'sequencetitle', 'sequence.title', 'sequence.name');
  const subject = find('subject', 'emailsubject');
  // The reply text: keep only the new part, not the quoted thread.
  let reply = strip(find('replycontent', 'replytext', 'replybody', 'emailbody', 'body', 'content', 'message', 'text'));
  reply = reply.split(/\n?On .{5,80} wrote:|\n-{2,}\s*Original Message|\nFrom: /i)[0].trim().slice(0, 700);

  let kind = 'reply';
  if (/bounce/.test(event)) kind = 'bounce';
  else if (/unsubscrib/.test(event)) kind = 'unsubscribe';
  else if (/sequence-paused|sequence_paused/.test(event)) kind = 'sequence_paused';
  else if (/account/.test(event)) kind = 'account_problem';
  else if (/out of (the )?office|auto(matic)?[- ]?reply|on (annual )?leave|vacation|away until|currently away|limited access to (my )?email/i.test(reply)) kind = 'out_of_office';
  else if (/unsubscribe|remove me|stop (emailing|contacting)|not interested|no thanks|no, thanks|don'?t (email|contact)|please stop/i.test(reply)) kind = 'unsubscribe';
  else if (/^\s*(yes|yep|yeah|sure|ok(ay)?|please do|go ahead)\b|send (it|me|over|the before)|interested|sounds good|would love|let'?s (talk|chat|do)|book|call|happy to|keen|curious/i.test(reply)) kind = 'interested';
  else if (/not (right )?now|maybe later|next (month|quarter|year)|after (the|our)|busy|circle back|reach out (later|again)/i.test(reply)) kind = 'not_now';
  else if (/\?/.test(reply)) kind = 'question';

  const head = {
    interested: '🔥 <b>Interested reply</b>',
    question: '❓ <b>Question in a reply</b>',
    reply: '💬 <b>New reply</b>',
    not_now: '🕓 <b>Not now</b>',
    unsubscribe: '🚫 <b>Unsubscribe / not interested</b>',
    bounce: '⚠️ <b>Bounce</b>',
    sequence_paused: '⏸️ <b>Sequence paused</b>',
    account_problem: '🔌 <b>Sending account problem</b>',
  }[kind];
  const next = {
    interested: 'Reply today: send the before/after (mock of the screen in their teardown).',
    question: 'Answer their question today.',
    reply: 'Read and answer today.',
    not_now: 'Thank them; note a follow-up date.',
    unsubscribe: 'Nothing to do: blocked from further emails.',
    bounce: 'Address blocked. If bounces climb past 3% today, pause sending.',
    sequence_paused: 'Check the sequence in SalesHandy (bounce limit or a sending issue).',
    account_problem: 'Reconnect the inbox in SalesHandy, or sends stop.',
  }[kind];
  const notify = kind !== 'out_of_office';
  const who = [name, company && `(${company})`].filter(Boolean).join(' ') || email || 'Unknown prospect';
  const lines = [
    `${head || '💬 <b>SalesHandy event</b>'}: ${esc(who)}`,
    email && `✉️ ${esc(email)}`,
    reply && `\n“${esc(reply)}”`,
    subject && `\nTheir teardown: <i>${esc(subject)}</i>`,
    sequence && `Sequence: ${esc(sequence)}`,
    next && `\n👉 ${next}`,
    'Open SalesHandy inbox: https://my.saleshandy.com/unified-inbox',
  ].filter(Boolean);
  return { notify, kind, email, text: lines.join('\n'), urgent: kind === 'interested' || kind === 'question' };
}
