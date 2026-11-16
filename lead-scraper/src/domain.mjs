// Turn any URL-ish string into a normalised site URL and a registrable domain.
const TWO_LEVEL = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'co.in', 'co.nz', 'com.br', 'co.jp', 'com.sg', 'co.za', 'com.mx']);

const SHARED_HOSTS = /\.(lovable\.app|lovableproject\.com|base44\.app|bolt\.host|replit\.app|vercel\.app|netlify\.app|pages\.dev|onrender\.com|fly\.dev)$/;

export const isSharedHost = (domain) => SHARED_HOSTS.test(String(domain || '').toLowerCase());

export function toUrl(input) {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!u.hostname.includes('.')) return null;
    return u;
  } catch {
    return null;
  }
}

export function registrableDomain(input) {
  const u = typeof input === 'string' ? toUrl(input) : input;
  if (!u) return null;
  const hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  // On shared app hosts every subdomain is a different product.
  if (SHARED_HOSTS.test(hostname)) return hostname;
  const parts = hostname.split('.');
  const lastTwo = parts.slice(-2).join('.');
  return TWO_LEVEL.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

/** Homepage URL for a company website value. */
export function homepage(input) {
  const u = toUrl(input);
  if (!u) return null;
  return `https://${u.hostname.toLowerCase()}/`;
}

// Hosts that are platforms, not company websites.
const PLATFORM = /(^|\.)(github\.com|github\.io|linkedin\.com|twitter\.com|x\.com|medium\.com|notion\.site|substack\.com|youtube\.com|google\.com|apple\.com|ycombinator\.com|producthunt\.com|storylane\.io|navattic\.com|arcade\.software|lemonsqueezy\.com|gumroad\.com|stripe\.com|whop\.com|chromewebstore\.google\.com|chrome\.google\.com|apps\.apple\.com|play\.google\.com|reddit\.com|facebook\.com|instagram\.com|tiktok\.com|linktr\.ee|carrd\.co|beacons\.ai)$/i;

export function isCompanySite(input) {
  const u = toUrl(input);
  return !!u && !PLATFORM.test(u.hostname);
}
