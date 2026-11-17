// Can we see the product without a sales call? Opens the sign-up (or app / login) page
// the site links to and reads it the way a visitor would. It never fills a form, never
// signs up and stops at any bot check. Result goes in lead.product_access:
//   { login_required: 'no' | 'yes' | 'unknown', mode, detail, url }
// modes: public-demo, self-serve, self-serve-work-email, waitlist, sales-gated, open-source, unknown
import { USER_AGENT, robotsAllowsUrl } from '../http.mjs';
import { browser } from '../teardown/audit.mjs';

const WAITLIST = /\b(join (the )?waitlist|waiting list|request (early )?access|request an invite|invite[- ]only|apply for (early )?access|get early access|private beta|early access program)\b/i;
const BOOK_DEMO = /\b(book|request|schedule|get) (a )?(demo|call|meeting)|talk to (sales|us|an expert)|contact sales\b/i;
const CARD = /credit card required|enter (your )?(card|payment)|add a payment method/i;
const NO_CARD = /no credit card|without a credit card|no card required/i;
const WORK_EMAIL = /work email|business email|company email|only work emails|personal emails? (are )?not/i;
const BOT_WALL = /captcha|verify you are human|security checkpoint|attention required|access denied/i;

async function readPage(url) {
  const ctx = await (await browser()).newContext({ viewport: { width: 1440, height: 900 }, userAgent: USER_AGENT });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const r = await page.evaluate(() => ({
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 20000),
      password: !!document.querySelector('input[type=password]'),
      email: !!document.querySelector('input[type=email], input[name*=email i], input[autocomplete=email]'),
      inputs: document.querySelectorAll('input:not([type=hidden]), textarea, select').length,
    }));
    return { ...r, final: page.url() };
  } finally {
    await ctx.close();
  }
}

/** Classify how a visitor gets into the product. */
export async function probeAccess(lead) {
  const s = lead.site;
  if (!s?.reachable) return { login_required: 'unknown', mode: 'unknown', detail: 'site not reachable', url: '' };
  // A demo anyone can open beats everything else.
  if (lead.render?.public_demo_open || s.public_demo_urls?.length) {
    const url = lead.render?.public_demo_open || s.public_demo_urls[0];
    return { login_required: 'no', mode: 'public-demo', detail: 'public demo or sandbox opens without an account', url };
  }
  if (s.demo_embeds?.length) {
    return { login_required: 'no', mode: 'public-demo', detail: `interactive demo embedded on the site (${s.demo_embeds[0].split('|')[0]})`, url: s.demo_embeds[0].split('|')[1] || '' };
  }
  const url = s.signup_urls?.[0] || s.app_urls?.[0] || s.login_urls?.[0];
  if (!url) {
    if (s.open_source_repo) return { login_required: 'no', mode: 'open-source', detail: `self-host from ${s.open_source_repo}`, url: s.open_source_repo };
    if (s.ctas?.book_demo) return { login_required: 'yes', mode: 'sales-gated', detail: 'only "book a demo" on the site: no self-serve sign-up found', url: '' };
    return { login_required: 'unknown', mode: 'unknown', detail: 'no sign-up, app or demo link found on the site', url: '' };
  }
  if (!(await robotsAllowsUrl(url))) return { login_required: 'unknown', mode: 'unknown', detail: 'sign-up page disallowed by robots.txt', url };
  let p;
  try {
    p = await readPage(url);
  } catch (e) {
    return { login_required: 'unknown', mode: 'unknown', detail: `sign-up page did not load (${String(e.message).split('\n')[0].slice(0, 60)})`, url };
  }
  if (BOT_WALL.test(p.text.slice(0, 2000)) && p.text.length < 3000) return { login_required: 'unknown', mode: 'unknown', detail: 'bot check on the sign-up page', url };
  const oauth = ['Google', 'GitHub', 'Microsoft', 'Apple'].filter((n) => new RegExp(`(continue|sign (up|in)|log ?in|start) with ${n}`, 'i').test(p.text));
  const extras = [oauth.length ? `sign in with ${oauth.join('/')}` : '', CARD.test(p.text) && !NO_CARD.test(p.text) ? 'card required' : NO_CARD.test(p.text) ? 'no card needed' : ''].filter(Boolean);
  const tail = extras.length ? ` (${extras.join(', ')})` : '';
  if (WAITLIST.test(p.text)) return { login_required: 'yes', mode: 'waitlist', detail: 'waitlist or request-access page: no instant sign-up', url: p.final };
  if (p.password || p.email || oauth.length) {
    if (WORK_EMAIL.test(p.text)) return { login_required: 'yes', mode: 'self-serve-work-email', detail: `free sign-up, work email only${tail}`, url: p.final };
    return { login_required: 'yes', mode: 'self-serve', detail: `free self-serve sign-up${tail}`, url: p.final };
  }
  if (BOOK_DEMO.test(p.text)) return { login_required: 'yes', mode: 'sales-gated', detail: 'sign-up link leads to a demo or contact form', url: p.final };
  return { login_required: 'unknown', mode: 'unknown', detail: 'sign-up page has no form we could recognise', url: p.final };
}
