// Pick who to email and write the teardown email in the positioning brief's voice:
// direct, plain, specific, no jargon, no emoji, no exclamation marks, no invented results.
import { SCREEN_NAME, withHook } from './findings.mjs';

// Inboxes that should never receive a cold email.
const DO_NOT_EMAIL = /^(security|legal|privacy|gdpr|dpo|press|media|pr|careers|jobs|apply|cv|resumes?|recruiting|hr|abuse|compliance|billing|finance|accounts|invoices?|noreply|no-reply|donotreply|academic|research|investors?|ir|support|help|helpdesk|feedback|events|community|partners?|partnerships|[a-z]+-ops|cancel|refunds?|unsubscribe)@/i;
const ROLE_ORDER = ['founders', 'founder', 'ceo', 'hello', 'hi', 'hey', 'contact', 'team', 'info', 'mail', 'general', 'welcome', 'sales'];

const firstWord = (s) => String(s || '').trim().split(/\s+/)[0];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Inbox clients cut subjects around 50-60 characters; keep the specific part.
const trimSubject = (t) => {
  const s = t.replace(/[!]+/g, '').replace(/\s+/g, ' ').trim();
  return s.length <= 60 ? s : s.slice(0, 57).replace(/\s+\S*$/, '') + '...';
};
const listJoin = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);

export function chooseRecipient(lead) {
  const people = [
    ...lead.site.people.map((p) => ({ name: p.name, title: p.title })),
    ...(lead.trustmrr?.founders || []).filter((f) => /^[A-Z][a-z]+(\s+[A-Z][\w'’-]+)+$/.test(f.name || '')).map((f) => ({ name: f.name, title: 'Founder' })),
  ];
  const usable = lead.emails.filter((e) => !DO_NOT_EMAIL.test(e.email) && e.verified !== 'invalid');
  const personal = usable.filter((e) => e.type === 'personal');
  const roleRank = (e) => {
    const i = ROLE_ORDER.indexOf(e.email.split('@')[0]);
    return i === -1 ? 99 : i;
  };
  const role = usable.filter((e) => e.type === 'role').sort((a, b) => roleRank(a) - roleRank(b));
  const pick = personal[0] || role[0];
  if (!pick) return null;

  const local = pick.email.split('@')[0].toLowerCase();
  // A named person whose first name matches the mailbox ("manu@" -> Manu X).
  const match = people.find((p) => local.startsWith(firstWord(p.name).toLowerCase()) && firstWord(p.name).length > 1);
  // Small companies: address the founder by name even on a shared inbox.
  const founder = people.find((p) => /founder|ceo/i.test(p.title));
  const small = lead.trustmrr || (lead.yc?.team_size != null && lead.yc.team_size <= 20);
  let person = match || (small && founder) || null;
  // A personal mailbox that is just a first name ("manu@") tells us who reads it.
  if (!person && pick.type === 'personal' && /^[a-z]{3,12}$/.test(local)) person = { name: cap(local), title: '' };
  const [first, ...rest] = person ? person.name.split(/\s+/) : [];
  return {
    email: pick.email,
    email_type: pick.type,
    first_name: person ? first : '',
    last_name: person ? rest.join(' ') : '',
    title: person?.title || '',
    greeting: person ? `Hi ${first}` : `Hi ${lead.name} team`,
  };
}

const OFFER = {
  type_a: 'I can send a free before/after mock of your {screen}, no call needed.',
  default: 'I can send a free before/after of your {screen}, no call needed.',
};

/** Build the first email and a follow-up from the top findings. */
export function writeEmail(lead, recipient, found, strengthsList, screensAudited = []) {
  // screensAudited: plain names of the screens we opened, e.g. ['homepage', 'pricing page']
  const top = [];
  for (const f of found) {
    if (top.length === 3) break;
    if (!top.some((t) => t.key === f.key)) top.push(withHook(f, lead.name));
  }
  const mainScreen = SCREEN_NAME[top[0]?.screen] || 'homepage';
  const lead0 = top[0];

  // Subject: the most specific thing we found, in their words. Alternate: a buying
  // signal (an open design role) or the second finding, for an A/B test.
  const subject = trimSubject(lead0?.subject || `${lead.name.toLowerCase()}'s ${mainScreen}`);
  const role = lead.hiring?.design_roles?.[0]?.title;
  const subjectAlt = trimSubject(
    role
      ? `while ${lead.name.toLowerCase()} hires a ${role.toLowerCase().replace(/^(senior|staff|lead|founding|sr\.?)\s+/, '')}`
      : found.map((f) => withHook(f, lead.name)).find((f) => f.subject && f.key !== lead0?.key)?.subject ||
          `first look at ${lead.name.toLowerCase()}`,
  );

  const greeting = `${recipient?.greeting || `Hi ${lead.name} team`},`;
  // The first sentence is the inbox preview, so it carries the hook, not a pleasantry.
  const opener = `${lead0?.hook || lead0?.issue || ''} ${lead0?.impact || ''}`.trim();
  const rest = top.slice(1);
  const strength = strengthsList[0];
  const lines = [
    greeting,
    '',
    opener,
    '',
    `I went through ${lead.name} as a new visitor, on a laptop and on a phone${screensAudited.length ? ` (${listJoin(screensAudited)})` : ''}.` +
      (strength ? ` What works: ${strength}.` : ''),
    ...(rest.length
      ? ['', rest.length > 1 ? 'Two more things I would fix:' : 'One more thing I would fix:', '', ...rest.map((f, i) => `${i + 1}. ${f.issue} ${f.impact}`)]
      : []),
    '',
    (OFFER[lead.profile] || OFFER.default).replace('{screen}', mainScreen) + ' Want me to send it?',
  ];
  const followup = [
    greeting,
    '',
    `Following up on ${lead.name}. The quickest win: ${lead0 ? lead0.fix.charAt(0).toLowerCase() + lead0.fix.slice(1) : 'tightening the first screen'}`,
    '',
    `Happy to send the before/after of your ${mainScreen} if you reply "yes".`,
  ];
  return {
    subject,
    subject_alt: subjectAlt,
    body: lines.join('\n'),
    followup: followup.join('\n'),
    first_line: opener,
    findings_used: top,
  };
}
