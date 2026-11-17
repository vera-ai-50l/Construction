// The name a company presents, for sheets and emails. Sources give poor names: Show HN
// post titles ("Same prompt tested across Replit..."), project slugs on builder hosts
// ("ai agents for ngos beta 83"), or a person's name. Prefer the site's own author or
// title, then the company mail domain, then the domain.
import { isSharedHost } from './domain.mjs';

const clean = (s) => String(s || '').replace(/[®™©]/g, '').replace(/&amp;/g, '&').replace(/,?\s+(inc|llc|ltd|gmbh|corp|co|s\.?a\.?s?|pty ltd)\.?$/i, '').trim();
const pretty = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const titleHead = (l) => clean(l.site?.title).split(/\s+[|–—-]\s+|:\s/)[0].trim();

export function brandName(l) {
  const looksLikeBrand = (n) => n && n.length >= 2 && n.length <= 30 && n.split(/\s+/).length <= 4 && !/^(show hn|my |i |we |home|welcome|lovable|base44|bolt|replit|pricing|sign in|log ?in)\b/i.test(n) && !/\.(lovable|base44|replit|bolt)\b/.test(n) && n.toLowerCase() !== String(l.contact?.first_name || '').toLowerCase();
  const author = clean(l.site?.meta_author);
  if (isSharedHost(l.domain)) {
    const stem = l.mail_domain && l.mail_domain !== l.domain ? pretty(l.mail_domain.split('.')[0]) : '';
    return [author, titleHead(l), stem].find(looksLikeBrand) || clean(l.name);
  }
  if (l.sources?.[0] === 'showhn' || !looksLikeBrand(clean(l.name))) {
    return pretty([author, titleHead(l)].find(looksLikeBrand) || l.domain.split('.')[0]);
  }
  return clean(l.name);
}
