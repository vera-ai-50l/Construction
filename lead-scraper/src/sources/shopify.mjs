// Source + signals for Type C: US/EU Shopify brands (accessibility + conversion fix).
// Stores come from Common Crawl's index of *.myshopify.com hosts (free); each store's
// public homepage and /products.json give the signals. Nothing logs in or buys anything.
import { getText, pool } from '../http.mjs';
import { registrableDomain } from '../domain.mjs';
import { commonCrawlHostnames } from './commoncrawl.mjs';
import { count } from '../ledger.mjs';
import { runActor } from '../apify.mjs';
import { cacheGet, cachePut } from '../http.mjs';

// Shopify's free themes: a store still on one of these has probably never been redesigned.
const FREE_THEMES = /^(dawn|refresh|sense|craft|crave|ride|taste|studio|colorblock|origin|spotlight|publisher|trade|horizon|fabric|atelier|heritage|tinker|savor|pitch|dwell|vessel|vision|debut|brooklyn|minimal|narrative|simple|supply|venture|boundless|express)$/i;
// Accessibility overlay widgets (they do not stop lawsuits: a strong reason to talk).
const OVERLAYS = [
  ['accessiBe', /acsbapp\.com|accessibe\.com/i],
  ['UserWay', /userway\.org/i],
  ['AudioEye', /audioeye\.com/i],
  ['EqualWeb', /equalweb\.com|nagich/i],
  ['Accessibly', /accessibly\.app|onthemap.*accessib/i],
  ['Eye-Able', /eye-able/i],
  ['Recite Me', /reciteme\.com/i],
  ['Allyable', /allyable/i],
  ['Adally', /adally\.com/i],
  ['Max Access', /maxaccess/i],
  ['Elfsight accessibility', /elfsight.*accessib/i],
];
// Paid apps that imply a store with real volume (a revenue proxy, not a measurement).
const PAID_APPS = [
  ['Klaviyo', /static\.klaviyo\.com|klaviyo\.js/i],
  ['Gorgias', /gorgias/i],
  ['Recharge', /rechargecdn|rechargepayments|rc_container/i],
  ['Yotpo', /yotpo/i],
  ['Okendo', /okendo/i],
  ['Attentive', /attn\.tv|attentivemobile/i],
  ['Postscript', /postscript\.io/i],
  ['Rebuy', /rebuyengine/i],
  ['Smile.io', /smile\.io/i],
  ['Loop Returns', /loopreturns/i],
  ['Nosto', /nosto/i],
  ['Searchanise', /searchanise/i],
];
const EU = /^(at|be|bg|hr|cy|cz|dk|ee|fi|fr|de|gr|hu|ie|it|lv|lt|lu|mt|nl|pl|pt|ro|sk|si|es|se)$/;
const CC_COUNTRY = { uk: 'GB', us: 'US' };
const JUNK = /^(test|dev|staging|demo|sandbox|my-?store|shop\d*|store\d*|[a-z0-9]{1,3}|[0-9a-f]{8,}|.*-(dev|test|staging)\d*)$/i;

const json = (html, name) => {
  const m = html.match(new RegExp(`Shopify\\.${name}\\s*=\\s*(\\{[^;]*?\\}|"[^"]*")\\s*;`));
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
};

/** Signals from a store's homepage HTML (+ its products.json when allowed). */
export async function storeSignals(url) {
  const home = await getText(url);
  if (!home.ok) return { ok: false, status: home.status, blocked: home.blocked || null };
  const html = home.text;
  const finalUrl = home.url || url;
  if (!/cdn\.shopify\.com|Shopify\.shop\s*=/.test(html)) return { ok: false, not_shopify: true };
  if (/\/password\b/.test(new URL(finalUrl).pathname) || /<form[^>]+\/password/i.test(html) && html.length < 60000) return { ok: false, closed: true };
  const theme = json(html, 'theme') || {};
  const currency = json(html, 'currency')?.active || null;
  const market = json(html, 'country') || null;
  const host = new URL(finalUrl).hostname.replace(/^www\./, '');
  const tld = host.split('.').pop();
  const ld = html.match(/"addressCountry"\s*:\s*"([A-Za-z]{2})"/)?.[1]?.toUpperCase() || null;
  const country = ld || (tld.length === 2 ? CC_COUNTRY[tld] || tld.toUpperCase() : null);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const s = {
    ok: true,
    url: finalUrl,
    host,
    custom_domain: !/myshopify\.com$/.test(host),
    theme: theme.name || theme.schema_name || null,
    theme_schema: theme.schema_name || null,
    theme_store_id: theme.theme_store_id || null,
    default_theme: FREE_THEMES.test(theme.schema_name || '') || FREE_THEMES.test(theme.name || ''),
    currency,
    market,
    country,
    us_eu: country ? country === 'US' || country === 'GB' || EU.test(country.toLowerCase()) : ['USD', 'EUR', 'GBP'].includes(currency),
    overlay: OVERLAYS.find(([, re]) => re.test(html))?.[0] || null,
    paid_apps: PAID_APPS.filter(([, re]) => re.test(html)).map(([n]) => n),
    images: imgs.length,
    images_missing_alt: imgs.filter((t) => !/\salt\s*=/i.test(t)).length,
    title: (html.match(/<title[^>]*>([^<]*)/i)?.[1] || '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').trim().slice(0, 120),
  };
  // Catalogue size and activity (public endpoint; skipped when robots.txt says no).
  const p = await getText(new URL('/products.json?limit=250', finalUrl).href);
  if (p.ok) {
    try {
      const products = JSON.parse(p.text).products || [];
      s.products = products.length;
      s.products_capped = products.length === 250;
      // Newest product published (updated_at changes on every inventory sync, so it says little).
      const newest = Math.max(0, ...products.map((x) => Date.parse(x.published_at || x.created_at || 0) || 0));
      s.newest_product_days = newest ? Math.round((Date.now() - newest) / 864e5) : null;
      s.price_range = products.length ? (() => {
        const prices = products.flatMap((x) => (x.variants || []).map((v) => Number(v.price))).filter((n) => n > 0);
        return prices.length ? [Math.min(...prices), Math.max(...prices)] : null;
      })() : null;
    } catch {
      /* not JSON: leave unknown */
    }
  }
  return s;
}

// Google footprints for small/mid Shopify brands (used when Common Crawl is down, or to
// add stores that already care about accessibility). About $0.0045 per result page.
export const STORE_FOOTPRINTS = [
  '"powered by shopify" "accessibility statement" "shipping"',
  '"powered by shopify" "accessibility" "free shipping on orders over"',
  '"powered by shopify" "we ship to" "united states" "returns"',
  '"powered by shopify" "shipping to europe" "returns"',
  '"© 2026" "powered by shopify" "shop now"',
];
export async function googleStoreHosts({ queries = STORE_FOOTPRINTS, pagesPerQuery = 3, log } = {}) {
  const input = { queries: queries.join('\n'), maxPagesPerQuery: pagesPerQuery, resultsPerPage: 10, countryCode: 'us', mobileResults: false };
  const key = 'shopify-serp:' + JSON.stringify(input);
  let pages = await cacheGet(key);
  if (!pages) {
    pages = await runActor('apify/google-search-scraper', input, { log });
    await cachePut(key, pages);
  }
  const hosts = new Set();
  for (const p of pages) for (const r of p.organicResults || []) {
    try {
      const h = new URL(r.url).hostname.toLowerCase().replace(/^www\./, '');
      if (!/(shopify|amazon|etsy|ebay|reddit|youtube|facebook|instagram|pinterest|linkedin|medium|wikipedia)\./.test(h)) hosts.add(h);
    } catch {}
  }
  log?.(`shopify: google footprints gave ${hosts.size} sites`);
  return [...hosts];
}

/**
 * Shopify stores with their signals, best candidates first.
 * @param opts { limit, offset, maxPages, log }
 */
export async function shopifyStores({ limit = 50, offset = 0, maxPages = 2, log } = {}) {
  let hosts = [];
  try {
    hosts = (await commonCrawlHostnames('myshopify.com', { maxPages, log })).filter((h) => h.split('.').length === 3 && !JUNK.test(h.split('.')[0]));
  } catch (e) {
    log?.(`shopify: Common Crawl unavailable (${e.message})`);
  }
  // Fallback / top-up: Google footprints (paid, small).
  if (hosts.length < limit * 4) hosts = [...new Set([...(await googleStoreHosts({ log }).catch((e) => (log?.(`shopify: google footprints failed: ${e.message}`), []))), ...hosts])];
  // Spread the sample across the list instead of taking the alphabetical head.
  const want = Math.min(hosts.length, limit * 8);
  const step = Math.max(1, Math.floor(hosts.length / want));
  const sample = Array.from({ length: want }, (_, i) => hosts[(i * step + offset) % hosts.length]);
  log?.(`shopify: reading ${sample.length} of ${hosts.length} stores`);
  const out = [];
  let read = 0;
  await pool(sample, 8, async (h) => {
    const s = await storeSignals(`https://${h}/`).catch(() => ({ ok: false }));
    read++;
    if (read % 50 === 0) log?.(`shopify: ${read}/${sample.length} read, ${out.length} kept`);
    count('shopify_stores_read');
    if (!s.ok || !s.custom_domain || (s.products ?? 1) < 5) return;
    out.push({
      name: (s.title.split(/\s+[|–—-]\s+/)[0] || h.split('.')[0]).slice(0, 60),
      website: s.url,
      source: 'shopify',
      source_url: `https://${h}/`,
      description: s.title,
      store: s,
    });
  });
  // Best candidates first: US/EU, overlay installed, custom theme, paying for apps.
  const rank = (r) => (r.store.us_eu ? 4 : 0) + (r.store.overlay ? 3 : 0) + (r.store.paid_apps.length >= 2 ? 2 : r.store.paid_apps.length ? 1 : 0) + (r.store.images_missing_alt >= 5 ? 1 : 0);
  out.sort((a, b) => rank(b) - rank(a));
  count('shopify_stores_kept', out.length);
  return out;
}

export const storeDomain = (r) => registrableDomain(r.website);
