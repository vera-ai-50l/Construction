// Read a company's own public pages and pull out the signals the ICP report uses:
// how the product can be seen (demo, signup, login), AI positioning, how it was
// built, published contact details, people named on the site, and job boards.
import * as cheerio from 'cheerio';
import { getText } from '../http.mjs';
import { registrableDomain } from '../domain.mjs';

// Interactive-demo vendors. A hit means real product screens are public (Level B).
const DEMO_VENDORS = [
  ['storylane', /([a-z0-9-]+\.)?storylane\.io\/(share|demo)\/[^\s"'<>]+|app\.storylane\.io\/demo\/[^\s"'<>]+/gi],
  ['navattic', /capture\.navattic\.com\/[^\s"'<>]+|[a-z0-9-]+\.navattic\.com\/[^\s"'<>]+/gi],
  ['arcade', /(demo|app)\.arcade\.software\/[^\s"'<>]+/gi],
  ['supademo', /app\.supademo\.com\/(demo|embed)\/[^\s"'<>]+/gi],
  ['walnut', /app\.(teamwalnut|walnut)\.(com|io)\/[^\s"'<>]+/gi],
  ['reprise', /[a-z0-9-]+\.(getreprise|reprise)\.com\/[^\s"'<>]+/gi],
  ['howdygo', /app\.howdygo\.com\/[^\s"'<>]+/gi],
  ['tourial', /[a-z0-9-]+\.tourial\.com\/[^\s"'<>]+/gi],
  ['saleo', /[a-z0-9-]+\.saleo\.io\/[^\s"'<>]+/gi],
];

// "How was this site built" fingerprints (Category D and Shopify tagging).
const BUILT_WITH = [
  ['lovable', /lovable\.app|made with lovable|gpt-engineer|lovable-tagger|cdn\.gpteng\.co/i],
  ['bolt', /bolt\.new|bolt\.host|made in bolt/i],
  ['base44', /base44\.(app|com)|made with base44/i],
  ['replit', /\.replit\.app|replit\.dev/i],
  ['v0', /v0\.dev|v0\.app/i],
  ['framer', /framerusercontent\.com|framer\.website/i],
  ['webflow', /webflow\.(com|io)|wf-page/i],
  ['shopify-store', /cdn\.shopify\.com|myshopify\.com/i],
];

const AI_TERMS = /\b(ai[- ]agents?|agentic|copilot|llms?|genai|generative ai|ai[- ]assistant|ai[- ]powered|powered by ai|machine learning|ai-native|autonomous agent)\b/gi;

const PAGE_HINTS = {
  pricing: /\/pricing\b|\/plans\b/i,
  about: /\/(about|company|team|our-team|leadership|founders?)\b/i,
  contact: /\/(contact|support)\b/i,
  careers: /\/(careers|jobs|join-us|work-with-us|hiring)\b/i,
  demo: /\/(demo|tour|product-tour|interactive-demo|self-guided|sandbox|playground)\b/i,
  security: /\/(security|trust)\b/i,
};

const CTA = {
  book_demo: /\b(book|request|get|schedule)\s+a\s+demo\b|\btalk to (sales|us)\b|\bcontact sales\b/i,
  free_trial: /\b(start|try)\s+(it\s+)?(for\s+)?free\b|\bfree trial\b|\bget started( for)? free\b|\bsign up( for)? free\b/i,
  interactive: /\b(take a (product )?tour|product tour|interactive demo|explore the (product|demo)|self-guided|live demo|try the demo|see it in action)\b/i,
};

const GENERIC_MAILBOX = /^(info|hello|hi|hey|contact|mail|email|sales|support|help|team|admin|press|media|pr|careers|jobs|hr|apply|cv|resumes?|recruiting|privacy|legal|security|abuse|compliance|billing|finance|accounts|partners?|partnerships|marketing|office|enquiries|inquiries|founders?|welcome|general|ops|operations|[a-z]+-ops|academic|academia|research|investors?|ir|feedback|community|events|noreply|no-reply|donotreply)@/i;
const TITLE_RE = /\b(co-?founder|founder|ceo|chief executive|cto|chief technology|cpo|chief product|vp,? (of )?product|head of (product|design)|design lead|product lead)\b/i;
const NAME_RE = /^[A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){1,3}$/;
// Capitalised phrases that look like names but are headings.
const NOT_A_NAME = /\b(founders?|team|area|our|meet|about|leadership|company|careers|contact|story|mission|board|advisors?|investors?|the)\b/i;

const uniq = (a) => [...new Set(a.filter(Boolean))];

function absolute(href, base) {
  try {
    return new URL(href, base).href.replace(/#.*$/, '');
  } catch {
    return null;
  }
}

function visibleText($) {
  $('script,style,noscript,svg,template').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function findEmails(rawHtml, domain) {
  // Undo JSON/HTML escaping so "\u003ehello@x.com" or "hello@x.com\" read cleanly.
  const html = rawHtml.replace(/\\u00[0-9a-f]{2}/gi, ' ').replace(/\\\//g, '/').replace(/&#64;|&commat;/g, '@');
  const found = new Set();
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of html.matchAll(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi)) found.add(m[0].toLowerCase());
  return [...found]
    .map((e) => e.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').replace(/^\d+-(?=[a-z])/i, ''))
    .filter((e) => !/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(e))
    .filter((e) => !/(sentry|wixpress|example\.com|domain\.com|email\.com|yourcompany|godaddy)/i.test(e))
    // Only addresses on the company's own domain: those are the ones it chose to publish.
    .filter((e) => registrableDomain(e.split('@')[1]) === domain)
    .map((e) => ({ email: e, type: GENERIC_MAILBOX.test(e) ? 'role' : 'personal' }));
}

// People named with a title on the company's own about/team pages. Heuristic: a short
// capitalised line directly before or after a line that holds a title.
function findPeople($, company, onAboutPage) {
  const own = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ownCompany = (title) => {
    // "CEO at Acme" / "CEO, Acme" / "CEO @ Acme": keep only if Acme is this company.
    const m = title.match(/(?:\bat\b|@|,)\s*([A-Za-z0-9][\w .&-]{1,40})$/);
    if (!m) return onAboutPage; // a bare title is trusted only on the about/team page
    return own && m[1].toLowerCase().replace(/[^a-z0-9]/g, '').includes(own.slice(0, 6));
  };
  const lines = [];
  $('h1,h2,h3,h4,h5,h6,p,span,div,li,strong,b')
    .filter((_, el) => $(el).children().length === 0)
    .each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t && t.length < 80) lines.push(t);
    });
  const people = [];
  for (let i = 0; i < lines.length; i++) {
    const title = lines[i].match(TITLE_RE);
    if (!title) continue;
    // "Jane Doe, Co-founder & CEO" on one line
    const inline = lines[i].match(/^([A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){1,3})\s*[,–—|-]\s*(.+)$/);
    if (inline && TITLE_RE.test(inline[2])) {
      if (ownCompany(inline[2])) people.push({ name: inline[1], title: inline[2].slice(0, 60) });
      continue;
    }
    const near = [lines[i - 1], lines[i + 1]].find((l) => l && NAME_RE.test(l) && !TITLE_RE.test(l));
    if (near && ownCompany(lines[i])) people.push({ name: near, title: lines[i].slice(0, 60) });
  }
  const seen = new Set();
  return people
    .filter((p) => !NOT_A_NAME.test(p.name) && p.name.length <= 40)
    .filter((p) => !seen.has(p.name) && seen.add(p.name))
    .slice(0, 8);
}

function atsFrom(urls) {
  const boards = [];
  for (const u of urls) {
    let m;
    if ((m = u.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i))) boards.push({ ats: 'ashby', slug: m[1] });
    else if ((m = u.match(/(?:job-)?boards(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([^/?#&]+)/i))) boards.push({ ats: 'greenhouse', slug: m[1] });
    else if ((m = u.match(/jobs\.(?:eu\.)?lever\.co\/([^/?#]+)/i))) boards.push({ ats: 'lever', slug: m[1] });
    else if ((m = u.match(/([a-z0-9-]+)\.recruitee\.com/i))) boards.push({ ats: 'recruitee', slug: m[1] });
    else if ((m = u.match(/apply\.workable\.com\/([^/?#]+)/i))) boards.push({ ats: 'workable', slug: m[1] });
  }
  const seen = new Set();
  return boards.filter((b) => !seen.has(b.ats + b.slug) && seen.add(b.ats + b.slug));
}

/**
 * @param site  homepage URL
 * @param opts  { maxPages, get }  `get` defaults to plain HTTP; pass a browser-backed
 *              getter (same return shape) to read client-rendered sites.
 */
export async function enrichSite(site, { maxPages = 6, get = getText, company = '' } = {}) {
  const getText_ = get;
  const domain = registrableDomain(site);
  const home = await getText_(site);
  const out = {
    domain,
    fetched_url: home.url,
    http_status: home.status,
    reachable: home.ok,
    blocked: home.blocked || null,
    error: home.error || null,
    title: '',
    meta_description: '',
    pages_read: [],
    demo_embeds: [],
    public_demo_urls: [],
    app_urls: [],
    login_urls: [],
    signup_urls: [],
    ctas: {},
    demo_credentials_hint: false,
    large_company_hint: false,
    ai_term_hits: 0,
    ai_terms: [],
    built_with: [],
    shopify_app_listing: null,
    open_source_repo: null,
    pricing_url: null,
    emails: [],
    people: [],
    linkedin_company: null,
    x_handle: null,
    ats_boards: [],
    js_only: false,
  };
  if (!home.ok) return out;

  const pages = [{ kind: 'home', url: home.url, html: home.text }];
  const $home = cheerio.load(home.text);
  out.title = $home('title').first().text().trim().slice(0, 140);
  out.meta_description = ($home('meta[name="description"]').attr('content') || '').trim().slice(0, 240);

  // Pick the internal pages worth reading.
  const homeLinks = uniq($home('a[href]').map((_, a) => absolute($home(a).attr('href'), home.url)).get());
  const internal = homeLinks.filter((u) => registrableDomain(u) === domain);
  const picked = [];
  for (const [kind, re] of Object.entries(PAGE_HINTS)) {
    const hit = internal.find((u) => re.test(new URL(u).pathname));
    if (hit && !picked.some((p) => p.url === hit)) picked.push({ kind, url: hit });
  }
  for (const p of picked.slice(0, maxPages)) {
    const r = await getText_(p.url);
    if (r.ok) pages.push({ kind: p.kind, url: r.url, html: r.text });
  }
  out.pages_read = pages.map((p) => `${p.kind}:${p.url}`);
  out.pricing_url = pages.find((p) => p.kind === 'pricing')?.url || null;

  const allLinks = [];
  let homeText = '';
  for (const p of pages) {
    const $ = cheerio.load(p.html);
    const links = $('a[href]')
      .map((_, a) => ({ href: absolute($(a).attr('href'), p.url), text: $(a).text().replace(/\s+/g, ' ').trim() }))
      .get()
      .filter((l) => l.href);
    const iframes = $('iframe[src]').map((_, f) => absolute($(f).attr('src'), p.url)).get();
    allLinks.push(...links, ...iframes.map((href) => ({ href, text: '' })));

    // Demo embeds can be in iframes, links or script-built markup, so scan raw HTML too.
    for (const [vendor, re] of DEMO_VENDORS) {
      for (const m of p.html.matchAll(re)) out.demo_embeds.push(`${vendor}|${m[0].replace(/\\\//g, '/').slice(0, 160)}`);
    }
    for (const [tool, re] of BUILT_WITH) if (re.test(p.html)) out.built_with.push(tool);

    if (p.kind === 'about' || p.kind === 'home') out.people.push(...findPeople(cheerio.load(p.html), company || domain.split('.')[0], p.kind === 'about'));
    out.emails.push(...findEmails(p.html, domain));

    const text = visibleText($);
    if (p.kind === 'home') homeText = text;
    for (const [k, re] of Object.entries(CTA)) if (re.test(text)) out.ctas[k] = true;
    if (/demo (account|credentials|login)|username\s*:\s*\S+\s+password\s*:/i.test(text)) out.demo_credentials_hint = true;
    if (/investor relations|\b(NYSE|NASDAQ|LSE)\s*:\s*[A-Z]{1,5}\b|fortune 500 company|publicly traded/i.test(text)) out.large_company_hint = true;
  }

  // Classify every outbound link once.
  for (const { href, text } of allLinks) {
    let u;
    try {
      u = new URL(href);
    } catch {
      continue;
    }
    const host = u.hostname.toLowerCase();
    const sameCompany = registrableDomain(u) === domain;
    const t = (text || '').toLowerCase();
    if (sameCompany && /^(app|dashboard|console|platform|portal|studio|cloud|my)\./.test(host)) out.app_urls.push(u.origin + '/');
    // Public demo candidates: a demo/sandbox host (the demo may live on another domain,
    // e.g. demo.matomo.cloud for matomo.org), or a demo-labelled link whose URL is itself
    // a demo, not a homepage, signup or booking page. Checked later with --screenshots.
    const demoHost = /^(demo|sandbox|play|playground)\./.test(host);
    const demoPath = /demo|sandbox|playground/i.test(u.pathname) && !/\/(book|request|schedule|contact|get)[-_]?(a[-_])?demo|sign-?up|register|login/i.test(u.pathname);
    if ((sameCompany && demoHost) || (demoHost && /demo/.test(t))) out.public_demo_urls.push(href);
    else if (sameCompany && demoPath && /\b(live demo|public demo|try (the )?(live )?demo|demo account|open (the )?demo|sandbox)\b/.test(t)) out.public_demo_urls.push(href);
    if (sameCompany && (/\/(login|log-in|signin|sign-in)\b/i.test(u.pathname) || /^(log ?in|sign ?in)$/.test(t))) out.login_urls.push(href);
    if (sameCompany && (/\/(signup|sign-up|register|get-started|start)\b/i.test(u.pathname) || /^(sign ?up|get started|start (for )?free|try (it )?(for )?free)$/.test(t))) out.signup_urls.push(href);
    if (/linkedin\.com\/company\/[^/?#]+/i.test(href) && !out.linkedin_company) out.linkedin_company = href.match(/https?:\/\/[^?#]*linkedin\.com\/company\/[^/?#]+/i)?.[0] || null;
    if (/^(x|twitter)\.com$/.test(host.replace(/^www\./, '')) && !out.x_handle) {
      const h = u.pathname.split('/')[1];
      if (h && !/^(intent|share|home|i)$/.test(h)) out.x_handle = '@' + h;
    }
    if (host === 'github.com' && !out.open_source_repo) {
      const seg = u.pathname.split('/').filter(Boolean);
      if (seg.length >= 1 && !/^(features|about|sponsors|marketplace|topics)$/.test(seg[0])) out.open_source_repo = `https://github.com/${seg.slice(0, 2).join('/')}`;
    }
    if (host === 'apps.shopify.com' && !out.shopify_app_listing) out.shopify_app_listing = href;
  }

  const hits = (homeText.match(AI_TERMS) || []).map((x) => x.toLowerCase());
  out.ai_term_hits = hits.length;
  out.ai_terms = uniq(hits).slice(0, 8);
  out.js_only = homeText.length < 400; // likely a client-rendered site: re-check with --render
  out.ats_boards = atsFrom(allLinks.map((l) => l.href));

  for (const k of ['demo_embeds', 'public_demo_urls', 'app_urls', 'login_urls', 'signup_urls', 'built_with']) out[k] = uniq(out[k]).slice(0, 10);
  const seenEmail = new Set();
  out.emails = out.emails.filter((e) => !seenEmail.has(e.email) && seenEmail.add(e.email)).slice(0, 10);
  const seenPerson = new Set();
  out.people = out.people.filter((p) => !seenPerson.has(p.name) && seenPerson.add(p.name)).slice(0, 8);
  return out;
}
