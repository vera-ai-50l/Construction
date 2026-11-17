// Access level and a provisional score using the report's 100-point model.
// Redesign opportunity can only be judged by looking at the product, so it is a
// placeholder (12/25) until someone does the teardown and fills it in.

const AI_BUILT = ['lovable', 'bolt', 'base44', 'replit', 'v0'];
const AI_BUILDER_KEYWORDS = /\b(lovable|bolt\.new|bolt|base44|replit|v0)\b/i;

export function accessLevel(site, render) {
  if (render?.public_demo_open) return { level: 'A', evidence: render.public_demo_open };
  if (site.public_demo_urls.length) return { level: 'A?', evidence: site.public_demo_urls[0] };
  if (site.demo_embeds.length) return { level: 'B', evidence: site.demo_embeds[0].split('|')[1] };
  if (site.ctas.interactive) return { level: 'B?', evidence: 'interactive-demo call to action on site' };
  if (site.demo_credentials_hint) return { level: 'C', evidence: 'demo credentials mentioned on site' };
  if (site.signup_urls.length || site.ctas.free_trial) return { level: 'D', evidence: site.signup_urls[0] || 'free-trial call to action' };
  if (site.app_urls.length || site.login_urls.length) return { level: 'D?', evidence: site.app_urls[0] || site.login_urls[0] };
  return { level: 'E', evidence: site.ctas.book_demo ? 'book-a-demo only' : 'no product access found' };
}

const ACCESS_POINTS = { A: 25, 'A?': 23, B: 23, 'B?': 20, C: 20, D: 12, 'D?': 10, E: 3 };

export function aiBuilt(site, lead) {
  const fromSite = site.built_with.filter((t) => AI_BUILT.includes(t));
  if (fromSite.length) return { value: 'yes', evidence: `site fingerprint: ${fromSite.join(', ')}` };
  const kw = (lead.trustmrr?.keywords || []).join(' ');
  if (AI_BUILDER_KEYWORDS.test(kw)) return { value: 'yes', evidence: `TrustMRR stack: ${kw.match(AI_BUILDER_KEYWORDS)[0]}` };
  if (/\bsupabase\b/i.test(kw)) return { value: 'maybe', evidence: 'Supabase backend (common with AI builders)' };
  return { value: 'unknown', evidence: '' };
}

const cap = (n, max) => Math.max(0, Math.min(max, n));

// Type C (Shopify stores): the whole storefront is public, so access is full; the
// questions are accessibility room, size, reach and timing.
function scoreStore(lead) {
  const st = lead.store;
  const s = lead.site;
  const access = 25;
  let redesign = 8;
  if (st.overlay) redesign += 7;
  if (st.default_theme) redesign += 4;
  if (st.images_missing_alt >= 10) redesign += 4;
  else if (st.images_missing_alt >= 3) redesign += 2;
  let commercial = 6 + Math.min(9, st.paid_apps.length * 3);
  if (!st.theme_store_id && st.theme) commercial += 2; // custom theme: someone paid for it
  if ((st.products || 0) >= 50) commercial += 2;
  if (st.products_capped && st.paid_apps.length >= 4) commercial -= 4; // probably above the $25M band
  let reach = 0;
  if (lead.contact?.verification === 'ok') reach += 8;
  else if (lead.contact) reach += 5;
  if (s.people?.length) reach += 4;
  if (lead.emails?.some((e) => e.type === 'personal')) reach += 2;
  if (s.linkedin_company) reach += 1;
  let timing = 2;
  const fresh = st.newest_product_days ?? st.last_product_update_days;
  if (fresh != null && fresh <= 30) timing += 4;
  else if (fresh != null && fresh <= 90) timing += 2;
  if (st.overlay) timing += 3; // already worried about accessibility
  const fit = st.us_eu ? 5 : 1;
  const parts = { access, redesign: cap(redesign, 25), commercial: cap(commercial, 20), reach: cap(reach, 15), timing: cap(timing, 10), fit };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { parts, total, priority: total >= 85 ? 1 : total >= 70 ? 2 : total >= 55 ? 3 : total >= 40 ? 4 : 5 };
}

export function score(lead) {
  if (lead.store) return scoreStore(lead);
  const s = lead.site;
  const access = ACCESS_POINTS[lead.access.level] ?? 3;

  // Redesign: placeholder until inspected; the brief's thesis (AI-built apps look
  // generic) earns a small, labelled bump.
  // The vibe check (build fingerprints + default-design patterns) is the best
  // outside evidence of redesign room; still a placeholder until someone looks.
  const v = lead.vibe?.verdict;
  const redesign = v === 'vibe-coded' ? 18 : v === 'likely vibe-coded' ? 15 : v === 'polished' ? 5 : lead.ai_built.value === 'yes' ? 15 : 12;

  let commercial = 6;
  const rev = lead.trustmrr?.revenue_30d_usd;
  if (rev != null) commercial = rev >= 50000 ? 18 : rev >= 10000 ? 14 : rev >= 3000 ? 10 : 7;
  const team = lead.yc?.team_size;
  if (team != null) commercial = Math.max(commercial, team >= 50 ? 16 : team >= 20 ? 13 : team >= 8 ? 10 : 7) + (lead.yc.stage === 'Growth' ? 3 : 0);
  const stars = lead.github?.stars;
  if (stars != null) commercial = Math.max(commercial, stars >= 10000 ? 10 : stars >= 3000 ? 8 : 6);
  if (s.pricing_url) commercial += 2;
  if ((lead.hiring.open_jobs || 0) >= 5) commercial += 2;
  if (s.large_company_hint) commercial -= 6; // can pay, but rarely buys from a small studio

  let reach = 0;
  if (lead.contact?.verification === 'ok') reach += 8;
  else if (lead.contact) reach += 5;
  const named = s.people.length || lead.trustmrr?.founders?.length;
  if (named) reach += 6;
  if (lead.emails.some((e) => e.type === 'personal')) reach += 4;
  else if (lead.emails.length) reach += 2;
  if (s.linkedin_company) reach += 2;
  if (s.x_handle) reach += 1;
  if ((team != null && team <= 20) || lead.trustmrr) reach += 2;

  let timing = 0;
  if (lead.hiring.design_roles.length) timing += 4;
  if ((lead.hiring.oldest_design_role_days || 0) >= 60) timing += 2;
  if ((lead.hiring.open_jobs || 0) > 0 || lead.yc?.is_hiring) timing += 1;
  if (s.ai_term_hits >= 3) timing += 2;
  const founded = lead.trustmrr?.founded ? Date.parse(lead.trustmrr.founded) : null;
  const ycYear = Number(String(lead.yc?.batch || '').match(/\d{4}/)?.[0] || 0);
  if ((founded && Date.now() - founded < 548 * 864e5) || ycYear >= new Date().getFullYear() - 1) timing += 1;

  const fit = (lead.profile === 'type_a' || lead.profile === 'vibe') && lead.ai_built.value === 'unknown' && !/vibe/.test(v || '') ? 3 : 5;

  const parts = {
    access,
    redesign,
    commercial: cap(commercial, 20),
    reach: cap(reach, 15),
    timing: cap(timing, 10),
    fit,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  const priority = total >= 85 ? 1 : total >= 70 ? 2 : total >= 55 ? 3 : total >= 40 ? 4 : 5;
  return { parts, total, priority };
}

/** Problems to fix or check before outreach. */
export function flags(lead) {
  const out = [];
  const s = lead.site;
  if (!s.reachable) out.push(s.blocked ? `site blocked (${s.blocked})` : `site unreachable (${s.http_status || s.error || 'no response'})`);
  if (s.reachable && s.js_only && !lead.rendered) out.push('client-rendered site: page text not read (browser off)');
  if (s.large_company_hint) out.push('public or very large company: likely in-house design, long cycle');
  if (lead.access.level === 'E' && !lead.emails.length && !s.people.length) out.push('no product access and no contact found');
  return out;
}
