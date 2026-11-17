// Source for Type B: startups that announced a seed or Series A round recently, from the
// public RSS feeds of tech news sites (each feed's robots.txt is respected). The article
// gives the company, round, amount and date; the company website is the outbound link
// in the article that matches the company's name.
import * as cheerio from 'cheerio';
import { getText, pool } from '../http.mjs';
import { registrableDomain, isCompanySite } from '../domain.mjs';
import { count } from '../ledger.mjs';
import { isSaas, NOT_A_RAISE } from './saas.mjs';

// [name, feed URL, items per page]
export const FEEDS = [
  ['TechCrunch', 'https://techcrunch.com/category/venture/feed/', 20],
  ['Crunchbase News', 'https://news.crunchbase.com/feed/', 10],
  ['Tech Funding News', 'https://techfundingnews.com/feed/', 10],
  ['BetaKit', 'https://betakit.com/feed/', 150],
  ['GeekWire', 'https://www.geekwire.com/feed/', 35],
  ['Inc42', 'https://inc42.com/feed/', 24],
  ['Startup Daily', 'https://www.startupdaily.net/feed/', 10],
  ['Tech.eu', 'https://tech.eu/feed/', 20],
];

const RAISE = /^(.{2,60}?)(?:,\s[^,]{3,80},)?\s+(?:raises|raised|secures|secured|lands|bags|closes|gets|nabs|snags|picks up|announces)\s+(?:a\s+)?(?:(?:US|CA|AU|A|C)?\$|€|£|₹|rs\.?\s?|inr\s?)?\s*([\d.,]+)\s*(million|m|mn|billion|bn|k|crore|cr|lakh)?\b/i;
const ROUND = /\b(pre-seed|seed|series a|pre-series a|series b|series c|series d)\b/i;
const FX = { $: 1, '€': 1.08, '£': 1.27, '₹': 0.012 };
const SOCIAL = /(twitter|x|linkedin|facebook|instagram|youtube|tiktok|crunchbase|pitchbook|wikipedia|apple|google|medium|substack|github|bit\.ly|t\.co|techcrunch|betakit|geekwire|inc42|startupdaily|tech\.eu|techfundingnews|wordpress|gravatar|feedburner|eventbrite|lu\.ma|sifted|bloomberg|reuters|forbes|businesswire|prnewswire|globenewswire)\./i;

function parseAmount(title) {
  const m = title.match(RAISE);
  if (!m) return null;
  const n = Number(String(m[2]).replace(/,/g, ''));
  const unit = (m[3] || '').toLowerCase();
  let usd = unit.startsWith('b') ? n * 1e9 : unit === 'k' ? n * 1e3 : unit === 'crore' || unit === 'cr' ? n * 1e7 : unit === 'lakh' ? n * 1e5 : n * 1e6;
  const cur = (title.match(/€|£|₹|rs\.?\s?\d|inr/i)?.[0] || '$')[0];
  usd *= FX[cur === 'r' || cur === 'R' || cur === 'i' || cur === 'I' ? '₹' : cur] || 1;
  return { company: m[1].replace(/^(exclusive|scoop|breaking):\s*/i, '').replace(/['’]s$/, '').trim(), amount_usd: Math.round(usd) };
}

/** The company website: an outbound link in the article whose domain matches the name. */
function companySite(html, company, articleUrl) {
  const $ = cheerio.load(html);
  const body = $('article, .entry-content, .article-content, .post-content, main').first();
  const scope = body.length ? body : $('body');
  const key = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  const host = registrableDomain(articleUrl);
  const links = scope.find('a[href^="http"]').map((_, a) => $(a).attr('href')).get();
  for (const href of links) {
    const d = registrableDomain(href);
    if (!d || d === host || SOCIAL.test(d + '.') || !isCompanySite(href)) continue;
    const stem = d.split('.')[0].replace(/[^a-z0-9]/g, '');
    const first = company.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
    if (key && stem && (stem.startsWith(key.slice(0, 5)) || key.startsWith(stem.slice(0, 5)) || (first.length >= 4 && stem.includes(first)))) return `https://${d}/`;
  }
  return null;
}

/**
 * Fallback when the article does not link the company: try the usual domains for the
 * name and keep one whose page title or first text names the company.
 */
export async function guessSite(company) {
  const words = company.toLowerCase().replace(/\b(inc|ltd|llc|technologies|technology|labs|ai|hq|app|software|corp|co)\b\.?/g, ' ').replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const slug = words.join('');
  const full = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tries = [...new Set([`${full}.com`, `${slug}.com`, `${slug}.ai`, `${full}.ai`, `${slug}.io`, `${slug}.co`, `get${slug}.com`, `try${slug}.com`, `${slug}hq.com`, `use${slug}.com`])];
  for (const d of tries) {
    const r = await getText(`https://${d}/`);
    if (!r.ok) continue;
    const head = cheerio.load(r.text);
    const text = `${head('title').text()} ${head('meta[property="og:site_name"]').attr('content') || ''} ${head('h1').first().text()}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (text.includes(slug) && !/(domain|parked|for sale|godaddy|sedo|hugedomains)/i.test(r.text.slice(0, 3000))) return `https://${registrableDomain(r.url) || d}/`;
  }
  return null;
}

/**
 * Recent seed / Series A raises by B2B software companies.
 * @param opts { months, maxPagesPerFeed, minUsd, maxUsd, log }
 */
export async function fundingNews({ months = 9, maxPagesPerFeed = 12, minUsd = 1e6, maxUsd = 40e6, log } = {}) {
  const since = Date.now() - months * 30 * 864e5;
  const raises = new Map();
  for (const [name, feed] of FEEDS) {
    let pages = 0;
    let old = false;
    for (let p = 1; p <= maxPagesPerFeed && !old; p++) {
      const r = await getText(p === 1 ? feed : `${feed}?paged=${p}`);
      if (!r.ok) {
        if (p === 1) log?.(`funding: ${name} skipped (${r.blocked || r.status || r.error})`);
        break;
      }
      pages++;
      const $ = cheerio.load(r.text, { xmlMode: true });
      const items = $('item').toArray();
      if (!items.length) break;
      for (const it of items) {
        const title = $(it).find('title').first().text().trim();
        const link = $(it).find('link').first().text().trim();
        const date = Date.parse($(it).find('pubDate').first().text());
        const desc = cheerio.load($(it).find('description').first().text() || '').text().slice(0, 600);
        count('funding_articles');
        if (date && date < since) {
          old = true;
          continue;
        }
        if (NOT_A_RAISE.test(title)) continue;
        const a = parseAmount(title);
        if (!a) continue;
        count('funding_raises');
        const text = `${title} ${desc} ${$(it).find('category').map((_, c) => $(c).text()).get().join(' ')}`;
        const round = (text.match(ROUND)?.[1] || '').toLowerCase();
        if (/series [b-d]/.test(round) || a.amount_usd < minUsd || a.amount_usd > maxUsd) continue;
        if (!isSaas(text)) continue;
        const key = a.company.toLowerCase();
        if (!raises.has(key)) raises.set(key, { ...a, round: round || 'undisclosed', date: date ? new Date(date).toISOString().slice(0, 10) : '', title, link, source: name, desc });
      }
    }
    log?.(`funding: ${name}: ${pages} feed pages read`);
  }
  log?.(`funding: ${raises.size} SaaS seed/Series A raises; finding websites`);
  // Website from the article itself.
  const rows = [];
  await pool([...raises.values()], 4, async (r) => {
    const art = await getText(r.link);
    let site = art.ok ? companySite(art.text, r.company, r.link) : null;
    let guessed = false;
    if (!site) (site = await guessSite(r.company)), (guessed = !!site);
    if (!site) return count('funding_no_website');
    rows.push({
      name: r.company,
      website: site,
      source: 'funding-news',
      source_url: r.link,
      description: r.desc.slice(0, 240),
      funding: { round: r.round, amount_usd: r.amount_usd, date: r.date, headline: r.title, outlet: r.source, url: r.link, site_guessed: guessed },
    });
  });
  rows.sort((a, b) => String(b.funding.date).localeCompare(String(a.funding.date)));
  count('funding_kept', rows.length);
  return rows;
}
