// Plain-language remarks for each lead: what the next person in the workflow needs to
// know before the teardown or the email (login walls, contact caveats, compliance).
import { isRoleMailbox } from './enrich/site.mjs';
import { isSharedHost } from './domain.mjs';

const NO_COLD_EMAIL = /\.(de|at)$/;

export function remarks(lead) {
  const out = [];
  const s = lead.site || {};
  const add = (tag, text) => out.push(`${tag}: ${text}`);

  // Reaching the product (what a teardown can show).
  const pa = lead.product_access;
  if (pa) {
    const label = { no: 'Login NOT required', yes: 'Login required', unknown: 'Login unclear' }[pa.login_required];
    add(label, pa.detail);
    if (pa.mode === 'sales-gated') add('Teardown', 'no self-serve access: use the public site, demo videos or screenshots');
    if (pa.mode === 'waitlist') add('Teardown', 'product is behind a waitlist: public pages only');
    if (/self-serve/.test(pa.mode)) add('Teardown', 'a person signs up (work account) and saves the session for the dashboard teardown');
  } else if (lead.store) {
    add('Login NOT required', 'public storefront: the teardown can use the homepage, a collection, a product page and the cart');
  } else if (s.reachable) {
    if (s.public_demo_urls?.length || s.demo_embeds?.length) add('Login NOT required', 'public or embedded demo on the site');
    else if (s.app_urls?.length || s.login_urls?.length || s.signup_urls?.length) add('Login required', 'product sits behind sign-in; public pages only unless someone signs up');
  }
  if (s.blocked) add('Site', `blocked by ${s.blocked}: check by hand`);
  else if (s.reachable === false) add('Site', 'not reachable');
  if (s.reachable && !s.pricing_url && s.paid_signal === false && lead.profile !== 'type_c') add('Pricing', 'no public pricing found');

  // Contact.
  const c = lead.contact;
  if (c?.email) {
    if (c.verification === 'catch_all') add('Email', 'catch-all server: send in the separate small batch');
    if (/google \(LinkedIn/.test(c.email_source || '')) add('Email', 'name found by Google search: open the LinkedIn link before sending');
    const companyDomain = lead.mail_domain || lead.domain;
    const d = c.email.split('@')[1];
    if (!/gmail|outlook|yahoo|icloud|proton/.test(d) && companyDomain && d !== companyDomain && !companyDomain.endsWith(d)) add('Email', `address is on ${d}, not ${companyDomain}`);
  } else {
    const shared = (lead.emails || s.emails || []).filter((e) => isRoleMailbox(e.email));
    add('Email', shared.length ? `only a shared inbox found (${shared[0].email}): find the founder before sending` : 'no email found yet');
  }
  if (NO_COLD_EMAIL.test(lead.mail_domain || lead.domain || '')) add('Compliance', 'German/Austrian company: no cold email, use LinkedIn');
  if (isSharedHost(lead.domain)) add('Site', 'app still on a builder host (no own domain)');

  // Buying signals and fit.
  const role = lead.hiring?.design_roles?.[0];
  if (role) add('Signal', `hiring "${role.title}"${lead.hiring.oldest_design_role_days ? ` (open ${lead.hiring.oldest_design_role_days} days)` : ''}`);
  if (lead.yc?.batch) add('Signal', `YC ${lead.yc.batch}${lead.yc.stage ? `, ${lead.yc.stage}` : ''}, team of ${lead.yc.team_size ?? '?'}`);
  if (lead.trustmrr?.revenue_30d_usd) add('Signal', `$${lead.trustmrr.revenue_30d_usd} revenue in the last 30 days (TrustMRR, Stripe-verified)`);
  if (/vibe/.test(lead.vibe?.verdict || '')) add('Signal', `${lead.vibe.verdict}: ${(lead.vibe.reasons || []).slice(0, 2).join('; ')}`);
  if (lead.vibe?.verdict === 'polished' && lead.profile === 'vibe') add('Fit', 'site looks professionally designed');
  if (s.large_company_hint) add('Fit', 'large or public company: in-house design likely, long cycle');

  // Shopify stores (Type C).
  const st = lead.store;
  if (st) {
    if (st.overlay) add('Signal', `accessibility overlay installed (${st.overlay}): overlays do not stop lawsuits`);
    if (st.theme) {
      const base = st.theme_schema && st.theme_schema !== st.theme ? ` (built on ${st.theme_schema})` : '';
      add('Store', st.default_theme ? `on Shopify's free ${st.theme_schema || st.theme} theme${st.theme !== (st.theme_schema || st.theme) ? ` ("${st.theme}")` : ''}: little or no custom design` : `${st.theme_store_id ? 'paid theme-store' : 'custom'} theme "${st.theme}"${base}`);
    }
    if (st.country) add('Store', `based in ${st.country}${st.currency ? `, sells in ${st.currency}` : ''}`);
    if (st.products != null) add('Store', `${st.products}${st.products_capped ? '+' : ''} products${st.newest_product_days != null ? `, newest added ${st.newest_product_days} days ago` : ''}`);
    if (st.images_missing_alt) add('Accessibility', `${st.images_missing_alt} of ${st.images} homepage images have no alt text`);
    if (st.paid_apps?.length) add('Size signal', `uses ${st.paid_apps.join(', ')}`);
  }
  return out;
}
