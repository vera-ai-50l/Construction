// Polite HTTP: honest user agent, robots.txt, per-host spacing, a disk cache,
// and no attempt to get past logins, CAPTCHAs or bot checks.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const USER_AGENT =
  process.env.LEADS_USER_AGENT ||
  'Mozilla/5.0 (compatible; lead-research-bot/0.1; respects robots.txt)';

const CACHE_DIR = process.env.LEADS_CACHE_DIR || path.resolve('out/cache');
const CACHE_TTL_MS = Number(process.env.LEADS_CACHE_DAYS || 7) * 864e5;
const HOST_GAP_MS = Number(process.env.LEADS_HOST_GAP_MS || 1200);
const TIMEOUT_MS = 20000;
const MAX_BYTES = 3_000_000;

const lastHit = new Map(); // host -> timestamp of last request
const robotsCache = new Map(); // origin -> rules | null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function spaceOut(host) {
  // Reserve the next slot before waiting, so parallel callers queue up.
  const now = Date.now();
  const next = Math.max(now, (lastHit.get(host) || 0) + HOST_GAP_MS);
  lastHit.set(host, next);
  if (next > now) await sleep(next - now);
}

const cacheFile = (key) =>
  path.join(CACHE_DIR, createHash('sha1').update(key).digest('hex') + '.json');

export async function cacheGet(key) {
  try {
    const f = cacheFile(key);
    const s = await stat(f);
    if (Date.now() - s.mtimeMs > CACHE_TTL_MS) return null;
    return JSON.parse(await readFile(f, 'utf8'));
  } catch {
    return null;
  }
}

export async function cachePut(key, value) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFile(key), JSON.stringify(value));
}

// Minimal robots.txt reader: the "*" group (and ours), Allow/Disallow, longest match wins.
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (field === 'allow' || field === 'disallow')) {
        current.rules.push({ allow: field === 'allow', path: value });
      }
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a.includes('lead-research-bot')));
  const star = groups.filter((g) => g.agents.includes('*'));
  return (mine.length ? mine : star).flatMap((g) => g.rules);
}

export function robotsAllows(rules, pathname) {
  if (!rules) return true;
  let best = null;
  for (const r of rules) {
    if (r.path === '') continue; // "Disallow:" with no path allows everything
    const pattern = '^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    if (new RegExp(pattern).test(pathname) && (!best || r.path.length >= best.path.length)) best = r;
  }
  return !best || best.allow;
}

async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let rules = null;
  try {
    const res = await rawFetch(origin + '/robots.txt');
    if (res.ok && /text\/plain/i.test(res.headers.get('content-type') || '')) {
      rules = parseRobots(await res.text());
    }
  } catch {
    rules = null; // unreachable robots.txt: treat as no rules
  }
  robotsCache.set(origin, rules);
  return rules;
}

/** True when robots.txt lets us fetch this URL. */
export async function robotsAllowsUrl(url) {
  const u = new URL(url);
  return robotsAllows(await robotsFor(u.origin), u.pathname + u.search);
}

async function rawFetch(url, { accept = 'text/html,application/json;q=0.9,*/*;q=0.5' } = {}) {
  const u = new URL(url);
  await spaceOut(u.host);
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en' },
  });
}

/**
 * GET a page as text. Returns { ok, status, url (final), text, blocked, error }.
 * `blocked` is set when robots.txt disallows the path or a bot wall answers;
 * blocked pages are recorded, never retried with tricks.
 */
export async function getText(url, { useCache = true, checkRobots = true } = {}) {
  const key = 'GET ' + url;
  if (useCache) {
    const hit = await cacheGet(key);
    if (hit) return hit;
  }
  let result;
  try {
    const u = new URL(url);
    if (checkRobots) {
      const rules = await robotsFor(u.origin);
      if (!robotsAllows(rules, u.pathname + u.search)) {
        return { ok: false, status: 0, url, text: '', blocked: 'robots.txt' };
      }
    }
    const res = await rawFetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const text = buf.subarray(0, MAX_BYTES).toString('utf8');
    const botWall =
      res.status === 403 || res.status === 429 || res.status === 503
        ? /cloudflare|captcha|vercel security checkpoint|attention required|verify you are human/i.test(text)
          ? 'bot-check'
          : null
        : null;
    result = { ok: res.ok, status: res.status, url: res.url, text, blocked: botWall };
  } catch (e) {
    result = { ok: false, status: 0, url, text: '', error: String(e.message || e).slice(0, 160) };
  }
  if (useCache && (result.ok || result.status === 404)) await cachePut(key, result);
  return result;
}

/** GET JSON from an API (no robots check: these are documented public APIs). */
export async function getJson(url, { useCache = true, headers = {} } = {}) {
  const key = 'JSON ' + url;
  if (useCache) {
    const hit = await cacheGet(key);
    if (hit) return hit;
  }
  try {
    const u = new URL(url);
    await spaceOut(u.host);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(60000),
      headers: { 'user-agent': USER_AGENT, accept: 'application/json', ...headers },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (useCache) await cachePut(key, data);
    return data;
  } catch {
    return null;
  }
}

/** Run `fn` over `items` with at most `n` in flight. */
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
