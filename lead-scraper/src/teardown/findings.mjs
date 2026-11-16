// Turn measurements into teardown findings. Each finding says what we observed (with
// the number), why it likely costs sign-ups or trust, and the fix. Severity 3 = fix first.
// Thresholds follow public guidance where one exists: Google's Core Web Vitals (LCP
// "poor" above 4 s), WCAG 2.2 target size (24 px), WCAG 2 AA via axe-core.

const AXE_PLAIN = {
  'color-contrast': 'text with too little contrast to read comfortably',
  'image-alt': 'images with no text alternative',
  'link-name': 'links with no readable label',
  'button-name': 'buttons with no readable label',
  label: 'form fields with no label',
  'aria-allowed-attr': 'broken accessibility attributes',
  'aria-prohibited-attr': 'broken accessibility attributes',
  'aria-required-children': 'broken accessibility markup',
  'heading-order': 'headings out of order',
  'frame-title': 'embedded frames with no title',
  'nested-interactive': 'clickable elements nested inside each other',
  'select-name': 'dropdowns with no label',
  'svg-img-alt': 'icons with no text alternative',
  'aria-hidden-focus': 'hidden elements that still take keyboard focus',
  'list': 'lists built with the wrong markup',
  'listitem': 'lists built with the wrong markup',
};

const sec = (ms) => (ms / 1000).toFixed(1);
const mb = (b) => (b / 1e6).toFixed(1);
const SCREEN_NAME = { home: 'homepage', pricing: 'pricing page', signup: 'sign-up page', demo: 'demo', dashboard: 'dashboard' };

/**
 * @param screens  audit results (see audit.mjs), several devices per kind
 * @param lead     the lead row from the scrape
 */
export function findings(screens, lead) {
  const out = [];
  const add = (f) => out.push(f);
  const get = (kind, device) => screens.find((s) => s.kind === kind && s.device === device && !s.error && !s.blocked);

  const homeD = get('home', 'desktop');
  const homeM = get('home', 'mobile');
  const signup = get('signup', 'desktop');
  const pricing = get('pricing', 'desktop');
  const dash = get('dashboard', 'desktop');

  if (homeD?.lcp_ms > 4000) {
    add({
      key: 'slow_lcp', screen: 'home', severity: homeD.lcp_ms > 6000 ? 3 : 2, metric: `${sec(homeD.lcp_ms)}s`,
      issue: `The main content of your homepage took ${sec(homeD.lcp_ms)}s to appear in our test, on a fast connection. Google treats anything over 4s as poor.`,
      impact: 'Visitors on slower phones see a blank or half-loaded page and leave before reading your headline.',
      fix: 'Serve the hero image and fonts first and defer heavy scripts; aim for under 2.5s.',
    });
  }
  if (homeD?.bytes > 5e6) {
    add({
      key: 'heavy_page', screen: 'home', severity: homeD.bytes > 8e6 ? 3 : 2, metric: `${mb(homeD.bytes)} MB / ${homeD.requests} requests`,
      issue: `Your homepage downloads ${mb(homeD.bytes)} MB across ${homeD.requests} requests.`,
      impact: 'On mobile data that is a slow first visit, and slow first visits bounce.',
      fix: 'Compress images (WebP/AVIF), lazy-load below-the-fold media, trim unused scripts.',
    });
  }
  if (homeM?.overflow_px > 8) {
    add({
      key: 'mobile_overflow', screen: 'home', severity: 3, metric: `${homeM.overflow_px}px wider than screen`,
      issue: `On a phone (390px wide) your homepage scrolls sideways: something is ${homeM.overflow_px}px wider than the screen.`,
      impact: 'A page that wobbles sideways reads as broken, and mobile visitors leave.',
      fix: 'Find the over-wide element (often a code block, table or fixed-width image) and let it wrap or scroll inside its box.',
    });
  }
  if (homeM?.small_targets >= 8) {
    add({
      key: 'small_targets', screen: 'home', severity: homeM.small_targets >= 30 ? 2 : 1, metric: `${homeM.small_targets} targets < 24px`,
      issue: `${homeM.small_targets} buttons and links on your mobile homepage are smaller than 24px, the minimum touch size in the accessibility guidelines.`,
      impact: 'Small targets cause mis-taps, which makes the site feel fiddly on a phone.',
      fix: 'Give tappable elements at least 24×24px of hit area (44px is better for primary buttons).',
    });
  }
  if (homeD && homeD.ctas_above_fold.length === 0 && homeD.text_length > 300) {
    add({
      key: 'no_cta_fold', screen: 'home', severity: 3, metric: 'no CTA in first screen',
      issue: 'On a laptop screen there is no sign-up or demo button visible until you scroll.',
      impact: 'Visitors who are ready to act have to hunt for the next step; many will not.',
      fix: 'Put one primary action (sign up or book a demo) in the first screen, next to the headline.',
    });
  }
  const distinctCtas = [...new Set((homeD?.ctas_above_fold || []).map((c) => c.toLowerCase().replace(/\s+/g, ' ')))];
  if (distinctCtas.length >= 3) {
    add({
      key: 'competing_ctas', screen: 'home', severity: 1, metric: `${distinctCtas.length} different CTAs above fold`,
      issue: `The first screen of your homepage asks visitors to do ${distinctCtas.length} different things (${distinctCtas.slice(0, 3).map((c) => `"${c}"`).join(', ')}).`,
      impact: 'When every button asks for attention, none of them gets it.',
      fix: 'Keep one primary action and make the rest secondary links.',
    });
  }
  const axe = homeD?.axe;
  if (axe) {
    const serious = axe.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const nodes = serious.reduce((s, v) => s + v.nodes, 0);
    if (nodes >= 5) {
      // Name only the problems we can describe in plain words.
      const named = serious.sort((a, b) => b.nodes - a.nodes).map((v) => AXE_PLAIN[v.id]).filter(Boolean);
      const top = [...new Set(named)].slice(0, 2);
      if (!top.length) top.push('markup that screen readers cannot follow');
      add({
        key: 'a11y', screen: 'home', severity: nodes >= 25 ? 2 : 1, metric: `${nodes} serious/critical WCAG issues`,
        issue: `An automated accessibility check (WCAG 2 AA) found ${nodes} serious issues on your homepage, mostly ${top.join(' and ')}.`,
        impact: 'Hard-to-read text hurts every visitor, and accessibility gaps are a growing legal risk in the US and EU.',
        fix: 'Raise text contrast to at least 4.5:1 and label every button, link and image.',
      });
    }
  }
  if (homeM?.tiny_text >= 15) {
    add({
      key: 'tiny_text', screen: 'home', severity: 1, metric: `${homeM.tiny_text} text elements < 12px on mobile`,
      issue: `${homeM.tiny_text} pieces of text on your mobile homepage are under 12px.`,
      impact: 'People pinch-zoom or skip what they cannot read.',
      fix: 'Keep body text at 16px on mobile and secondary text at 13px or more.',
    });
  }
  if (homeD?.font_families.length >= 4) {
    add({
      key: 'many_fonts', screen: 'home', severity: 1, metric: `${homeD.font_families.length} typefaces`,
      issue: `Your homepage uses ${homeD.font_families.length} different typefaces (${homeD.font_families.slice(0, 4).join(', ')}).`,
      impact: 'Mixed type makes a product look assembled from parts rather than designed.',
      fix: 'Settle on one or two families and a fixed type scale.',
    });
  }
  if (homeD?.broken_images > 0) {
    add({
      key: 'broken_images', screen: 'home', severity: 2, metric: `${homeD.broken_images} broken images`,
      issue: `${homeD.broken_images} image${homeD.broken_images > 1 ? 's' : ''} on your homepage failed to load in our test.`,
      impact: 'A broken image on the first page makes a product look unmaintained.',
      fix: 'Check the image URLs and add fallbacks.',
    });
  }
  if ((homeD?.console_errors?.length || 0) >= 3) {
    add({
      key: 'console_errors', screen: 'home', severity: 1, metric: `${homeD.console_errors.length} JS errors`,
      issue: `Your homepage throws ${homeD.console_errors.length} JavaScript errors while loading.`,
      impact: 'Errors on load often mean a widget, form or tracking script is silently not working.',
      fix: 'Open the browser console on the homepage and clear these.',
    });
  }
  if (homeD && !homeD.meta_description) {
    add({
      key: 'no_meta', screen: 'home', severity: 1, metric: 'no meta description',
      issue: 'Your homepage has no meta description, so Google and link previews write their own.',
      impact: 'Search and social previews undersell the product.',
      fix: 'Add a one-sentence description that states who it is for and the result.',
    });
  }

  // Sign-up and access
  if (signup && !signup.blocked) {
    if (signup.inputs >= 6) {
      add({
        key: 'long_signup', screen: 'signup', severity: 2, metric: `${signup.inputs} fields`,
        issue: `Your sign-up form asks for ${signup.inputs} fields before anyone sees the product.`,
        impact: 'Every extra field before the first look at the product loses people.',
        fix: 'Ask for email (or Google) only; collect the rest during onboarding.',
      });
    }
    if (signup.work_email && lead.profile === 'type_a') {
      add({
        key: 'work_email', screen: 'signup', severity: 2, metric: 'personal emails rejected',
        issue: 'Your sign-up turns away personal email addresses.',
        impact: 'Founders and freelancers who try tools on a Gmail account cannot get in.',
        fix: 'Accept personal emails and qualify later, or offer Google sign-in.',
      });
    }
    if (signup.inputs >= 3 && signup.oauth.length === 0 && !signup.login_wall) {
      add({
        key: 'no_oauth', screen: 'signup', severity: 1, metric: 'no Google/GitHub sign-in',
        issue: 'Sign-up has no "Continue with Google" option.',
        impact: 'One-click sign-in is the fastest way to get a visitor into the product.',
        fix: 'Add Google (and GitHub for developer tools) sign-in.',
      });
    }
  }
  if (!lead.site.signup_urls.length && !lead.site.ctas.free_trial && lead.access.level === 'E') {
    add({
      key: 'no_self_serve', screen: 'home', severity: lead.profile === 'type_a' ? 3 : 2, metric: 'sales-only access',
      issue: 'The only way to see the product is to book a call: there is no trial, sandbox or interactive demo.',
      impact: 'Buyers who want to look first, which is most of them, leave without leaving their email.',
      fix: 'Add a self-guided interactive demo of the main screen, or a free trial.',
    });
  }
  if (lead.profile === 'type_a' && (!lead.site.pricing_url || (pricing && !pricing.prices_visible))) {
    add({
      key: 'no_pricing', screen: 'pricing', severity: 1, metric: 'no visible prices',
      issue: lead.site.pricing_url ? 'Your pricing page does not show a price.' : 'There is no pricing page linked from the homepage.',
      impact: 'For a self-serve product, hidden pricing stalls the decision to sign up.',
      fix: 'Show plans with prices, even if the top tier says "contact us".',
    });
  }

  // Logged-in dashboard (only when a saved session exists)
  if (dash && !dash.login_wall) {
    if (dash.max_table_columns >= 10) {
      add({
        key: 'wide_tables', screen: 'dashboard', severity: 2, metric: `${dash.max_table_columns} columns`,
        issue: `The main table in your dashboard shows ${dash.max_table_columns} columns at once.`,
        impact: 'Users cannot find the two columns they came for, so they export to a spreadsheet instead.',
        fix: 'Show 5–7 default columns and let users add the rest.',
      });
    }
    if (dash.empty_cell_share >= 0.4) {
      add({
        key: 'empty_cells', screen: 'dashboard', severity: 2, metric: `${Math.round(dash.empty_cell_share * 100)}% empty cells`,
        issue: `${Math.round(dash.empty_cell_share * 100)}% of table cells in your dashboard are empty or a dash.`,
        impact: 'The few real signals get lost among empty cells.',
        fix: 'Hide empty columns by default and highlight rows that need attention.',
      });
    }
    if (dash.tiny_text >= 20) {
      add({
        key: 'dash_tiny_text', screen: 'dashboard', severity: 2, metric: `${dash.tiny_text} text elements < 12px`,
        issue: `${dash.tiny_text} pieces of text in your dashboard are under 12px.`,
        impact: 'Data people strain to read is data they do not act on.',
        fix: 'Set a 13px floor for table text and 12px for labels.',
      });
    }
    if (dash.nav_items >= 25) {
      add({
        key: 'dash_nav', screen: 'dashboard', severity: 1, metric: `${dash.nav_items} navigation links`,
        issue: `The dashboard navigation shows ${dash.nav_items} links at once.`,
        impact: 'New users do not know where to start, which slows activation.',
        fix: 'Group navigation into 5–7 sections and collapse the rest.',
      });
    }
  }
  return out.sort((a, b) => b.severity - a.severity);
}

/** Things that work, so the email can open with one genuine strength. */
export function strengths(screens, lead) {
  const s = [];
  const homeD = screens.find((x) => x.kind === 'home' && x.device === 'desktop' && !x.error);
  const homeM = screens.find((x) => x.kind === 'home' && x.device === 'mobile' && !x.error);
  const signup = screens.find((x) => x.kind === 'signup' && !x.error);
  if (lead.site.demo_embeds.length || lead.access.level === 'A') s.push('letting visitors click through the product before signing up is the right call');
  if (signup?.oauth?.length) s.push(`one-click ${signup.oauth[0][0].toUpperCase() + signup.oauth[0].slice(1)} sign-up keeps the first step short`);
  if (homeD?.lcp_ms && homeD.lcp_ms < 2000) s.push('the homepage loads quickly');
  if (homeD?.ctas_above_fold.length === 1) s.push(`the homepage has one clear next step ("${homeD.ctas_above_fold[0]}")`);
  if (homeM && homeM.overflow_px <= 8 && homeM.small_targets < 8) s.push('the mobile layout holds up well');
  if (lead.site.pricing_url) s.push('your pricing is public');
  return s;
}

export { SCREEN_NAME };

// Subject line + opening sentence for each measured finding. Subjects are short,
// lowercase, and only make sense for this company (its name plus a number we measured).
const HOOKS = {
  slow_lcp: (n, c) => [`${c} took ${n}s to load`, `Your homepage's main content took ${n}s to appear in my test, on a fast connection.`],
  heavy_page: (n, c) => [`${c}'s ${n} mb homepage`, `Your homepage downloads ${n} MB before it settles.`],
  mobile_overflow: (n, c) => [`${c} scrolls sideways on phones`, 'On a phone, your homepage scrolls sideways.'],
  small_targets: (n, c) => [`${n} tiny tap targets on ${c}`, `On a phone, ${n} buttons and links on your homepage are too small to tap reliably.`],
  no_cta_fold: (n, c) => [`no signup button on ${c}'s first screen`, 'On a laptop, your homepage shows no sign-up or demo button until you scroll.'],
  competing_ctas: (n, c) => [`${n} buttons competing on ${c}'s homepage`, `The first screen of your homepage asks visitors to do ${n} different things.`],
  a11y: (n, c) => [`${n} accessibility errors on ${c}`, `An accessibility check flagged ${n} serious issues on your homepage.`],
  tiny_text: (n, c) => [`${n} bits of tiny text on ${c}`, `On a phone, ${n} pieces of text on your homepage are under 12px.`],
  many_fonts: (n, c) => [`${n} typefaces on ${c}'s homepage`, `Your homepage mixes ${n} different typefaces.`],
  broken_images: (n, c) => [`a broken image on ${c}'s homepage`, 'An image on your homepage failed to load when I visited.'],
  console_errors: (n, c) => [`${n} javascript errors on ${c}`, `Your homepage throws ${n} JavaScript errors while loading.`],
  no_meta: (n, c) => [`${c} has no google description`, 'Your homepage has no meta description, so Google writes its own.'],
  long_signup: (n, c) => [`the ${n}-field signup at ${c}`, `Your sign-up form asks for ${n} fields before anyone sees the product.`],
  work_email: (n, c) => [`${c} turns away gmail signups`, 'Your sign-up rejects personal email addresses.'],
  no_oauth: (n, c) => [`no google signup on ${c}`, 'Your sign-up has no "Continue with Google" option.'],
  no_self_serve: (n, c) => [`no way to try ${c} without a call`, 'The only way to see your product is to book a call.'],
  no_pricing: (n, c) => [`where is ${c}'s pricing?`, 'I could not find a price anywhere on your site.'],
  wide_tables: (n, c) => [`the ${n}-column table in ${c}`, `The main table in your dashboard shows ${n} columns at once.`],
  empty_cells: (n, c) => [`${n}% empty cells in ${c}'s dashboard`, `${n}% of the table cells in your dashboard are empty.`],
  dash_tiny_text: (n, c) => [`tiny text in ${c}'s dashboard`, `${n} pieces of text in your dashboard are under 12px.`],
  dash_nav: (n, c) => [`${n} menu links in ${c}`, `Your dashboard navigation shows ${n} links at once.`],
};

/** Add `subject` and `hook` to a measured finding (reviewed findings bring their own). */
export function withHook(f, companyName) {
  if (f.subject) return f;
  const make = HOOKS[f.key];
  if (!make) return f;
  const n = parseFloat(String(f.metric).replace(/,/g, '')) || '';
  const [subject, hook] = make(n, companyName.toLowerCase());
  return { ...f, subject, hook };
}
