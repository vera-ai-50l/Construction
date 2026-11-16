// Source: Common Crawl's public URL index, for apps still on a builder's own host
// (x.lovable.app, x.base44.app ...). Free; no search engine involved.
// The index is a shared, often overloaded service: one request at a time, long gaps,
// retries with backoff, and every page cached so it is asked only once a week.
import { cacheGet, cachePut, USER_AGENT } from '../http.mjs';
import { count } from '../ledger.mjs';

const INDEX = 'https://index.commoncrawl.org';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const BUILDER_HOSTS = ['lovable.app', 'base44.app', 'bolt.host', 'replit.app'];

// Paths that show a product people pay for or sign in to.
const PAID_PATH = /\/(pricing|plans|subscribe|checkout|billing|upgrade)\b/i;
const AUTH_PATH = /\/(login|signin|sign-in|signup|sign-up|auth|register|dashboard|app)\b/i;
// Throwaway projects: previews, copies, tutorials, random ids.
const JUNK_HOST = /^(preview-|id-|[a-z0-9]{20,}\.)|\b(test|demo|copy|remix|clone|template|tutorial|my-app|untitled|hello-world|portfolio|resume|cv|wedding|birthday)\b/i;

async function indexGet(url, log) {
  const key = 'CC ' + url;
  const hit = await cacheGet(key);
  if (hit) return hit;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(280000) });
      const text = await res.text();
      if (res.ok && !text.startsWith('<html')) {
        await cachePut(key, text);
        return text;
      }
      if (res.status === 404) return '';
      log?.(`commoncrawl: ${res.status}, retrying`);
    } catch (e) {
      log?.(`commoncrawl: ${e.message.slice(0, 60)}, retrying`);
    }
    await sleep(15000 * (attempt + 1));
  }
  return null;
}

export async function latestCrawl(log) {
  const text = await indexGet(`${INDEX}/collinfo.json`, log);
  return text ? JSON.parse(text)[0].id : null;
}

/**
 * Builder-hosted apps from the latest crawl, best first: apps whose pricing or sign-in
 * pages were crawled, then the rest.
 * @param opts { hosts, crawl, log }
 */
export async function commonCrawlApps({ hosts = BUILDER_HOSTS, crawl, log } = {}) {
  crawl ||= await latestCrawl(log);
  if (!crawl) throw new Error('Common Crawl index unavailable');
  const apps = new Map(); // hostname -> {paths}
  for (const builder of hosts) {
    const base = `${INDEX}/${crawl}-index?url=*.${builder}&output=json&fl=url,status`;
    const info = await indexGet(base + '&showNumPages=true', log);
    const pages = info ? JSON.parse(info).pages || 0 : 0;
    let missing = 0;
    for (let p = 0; p < pages; p++) {
      await sleep(5000);
      const text = await indexGet(`${base}&page=${p}`, log);
      if (text == null) {
        missing++;
        continue;
      }
      for (const line of text.split('\n')) {
        if (!line) continue;
        let r;
        try {
          r = JSON.parse(line);
        } catch {
          continue;
        }
        if (r.status !== '200') continue;
        count('commoncrawl_urls');
        const u = new URL(r.url);
        const host = u.hostname.toLowerCase();
        if (!host.endsWith('.' + builder) || host.split('.').length !== builder.split('.').length + 1) continue;
        if (!apps.has(host)) apps.set(host, new Set());
        apps.get(host).add(u.pathname);
      }
    }
    log?.(`commoncrawl: ${builder}: ${pages - missing}/${pages} index pages read`);
  }
  count('commoncrawl_hosts', apps.size);
  const rows = [];
  for (const [host, paths] of apps) {
    if (JUNK_HOST.test(host)) continue;
    const ps = [...paths];
    const paid = ps.some((p) => PAID_PATH.test(p));
    const auth = ps.some((p) => AUTH_PATH.test(p));
    rows.push({
      name: host.split('.')[0].replace(/-[a-z0-9]{4,6}$/, '').replace(/-/g, ' '),
      website: `https://${host}/`,
      source: 'commoncrawl',
      cc: { crawl, pages_crawled: ps.length, pricing_path: paid, auth_path: auth },
      _rank: (paid ? 2 : 0) + (auth ? 1 : 0) + Math.min(ps.length, 20) / 100,
    });
  }
  rows.sort((a, b) => b._rank - a._rank);
  count('commoncrawl_kept', rows.length);
  return rows;
}
