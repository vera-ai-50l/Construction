// Measure the screens a visitor sees. Every number here is something we observed,
// so the teardown can quote it. Nothing logs in, fills a form or gets past a bot check.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { USER_AGENT, robotsAllowsUrl } from '../http.mjs';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

let browserPromise = null;
export function browser() {
  if (!browserPromise) browserPromise = require('playwright').chromium.launch();
  return browserPromise;
}
export async function closeBrowser() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = null;
}

export const DESKTOP = { viewport: { width: 1440, height: 900 } };
export const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

const BOT_WALL = /captcha|verify you are human|security checkpoint|attention required|access denied/i;
const CTA_TEXT = /\b(sign ?up|get started|start (for )?free|try (it )?(for )?free|start (your )?trial|book (a )?demo|request (a )?demo|get (a )?demo|create (an )?account|join|try now|start building|get access)\b/i;

// Runs inside the page.
function measure({ ctaSource, foldHeight }) {
  const cta = new RegExp(ctaSource, 'i');
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const doc = document.documentElement;
  const interactive = [...document.querySelectorAll('a[href], button, [role=button], input:not([type=hidden]), select, textarea')].filter(visible);
  const smallTargets = interactive.filter((el) => {
    if (el.closest('p, li p, span p') && el.tagName === 'A') return false; // inline text links are exempt (WCAG 2.5.8)
    const r = el.getBoundingClientRect();
    return r.width < 24 || r.height < 24;
  });
  const textEls = [...document.querySelectorAll('p, span, a, li, td, th, label, button, h1, h2, h3, h4, h5, h6, div')].filter(
    (el) => el.childElementCount === 0 && (el.textContent || '').trim().length > 3 && visible(el),
  );
  const tiny = textEls.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12);
  const fonts = new Set(textEls.slice(0, 400).map((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase()));
  const ctas = interactive
    .filter((el) => cta.test((el.innerText || el.value || el.getAttribute('aria-label') || '').trim()))
    .map((el) => ({ text: (el.innerText || el.value || '').trim().slice(0, 40), top: el.getBoundingClientRect().top + window.scrollY }));
  const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]), select, textarea')].filter(visible);
  const body = (document.body?.innerText || '').replace(/\s+/g, ' ');
  const tables = [...document.querySelectorAll('table')].filter(visible);
  const cells = tables.flatMap((t) => [...t.querySelectorAll('td')]);
  const emptyCells = cells.filter((c) => /^(|-|–|—|n\/a|null|0)$/i.test((c.textContent || '').trim()));
  return {
    title: document.title,
    meta_description: document.querySelector('meta[name="description"]')?.content || '',
    og_image: !!document.querySelector('meta[property="og:image"]'),
    h1: [...document.querySelectorAll('h1')].filter(visible).map((h) => h.innerText.trim().slice(0, 120)),
    overflow_px: Math.max(0, doc.scrollWidth - window.innerWidth),
    page_height: doc.scrollHeight,
    small_targets: smallTargets.length,
    small_target_examples: smallTargets.slice(0, 5).map((el) => (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)),
    tiny_text: tiny.length,
    font_families: [...fonts].filter(Boolean),
    ctas_above_fold: ctas.filter((c) => c.top < foldHeight).map((c) => c.text),
    ctas_total: ctas.length,
    inputs: inputs.length,
    // Only count a provider when the page says so in words ("Continue with Google").
    oauth: ['google', 'github', 'microsoft', 'apple'].filter((p) => new RegExp(`(continue|sign (up|in)|log ?in) with ${p}`, 'i').test(body)),
    work_email: /work email|business email|company email|only work emails|personal emails? (are )?not/i.test(body),
    captcha: !!document.querySelector('iframe[src*="captcha"], iframe[src*="turnstile"], .g-recaptcha, .h-captcha'),
    prices_visible: /[$€£₹]\s?\d/.test(body),
    contact_sales_only: /contact (sales|us) for pricing|custom pricing/i.test(body) && !/[$€£₹]\s?\d/.test(body),
    broken_images: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && visible(i)).length,
    password_field: !!document.querySelector('input[type=password]'),
    text_length: body.length,
    tables: tables.length,
    max_table_columns: Math.max(0, ...tables.map((t) => Math.max(0, ...[...t.rows].map((r) => r.cells.length)))),
    empty_cell_share: cells.length ? +(emptyCells.length / cells.length).toFixed(2) : null,
    nav_items: [...document.querySelectorAll('nav a, aside a, [role=navigation] a')].filter(visible).length,
  };
}

async function largestContentfulPaint(page) {
  return page
    .evaluate(
      () =>
        new Promise((resolve) => {
          let last = null;
          try {
            new PerformanceObserver((list) => {
              const e = list.getEntries();
              if (e.length) last = e[e.length - 1].startTime;
            }).observe({ type: 'largest-contentful-paint', buffered: true });
          } catch {
            /* not supported */
          }
          setTimeout(() => resolve(last), 600);
        }),
    )
    .catch(() => null);
}

async function runAxe(page) {
  try {
    await page.addScriptTag({ path: AXE_PATH });
    const r = await page.evaluate(async () => {
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
    });
    return r;
  } catch {
    return null;
  }
}

/**
 * Open one screen, measure it and screenshot it.
 * @returns { kind, device, url, final_url, status, blocked, login_wall, load_ms, lcp_ms, bytes, requests, console_errors, axe, shot, ...measure() }
 */
export async function auditScreen({ kind, url, device = 'desktop', shotDir, storageState, axe = false }) {
  const out = { kind, device, url };
  if (!url) return { ...out, error: 'no url' };
  if (!storageState && !(await robotsAllowsUrl(url))) return { ...out, blocked: 'robots.txt' };
  const opts = device === 'mobile' ? MOBILE : DESKTOP;
  const ctx = await (await browser()).newContext({
    ...opts,
    userAgent: device === 'mobile' ? `${USER_AGENT} Mobile` : USER_AGENT,
    // Needed to add the accessibility checker to pages with a strict content policy.
    bypassCSP: true,
    ...(storageState ? { storageState } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  let bytes = 0;
  let requests = 0;
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  page.on('requestfinished', async (r) => {
    requests++;
    const s = await r.sizes().catch(() => null);
    bytes += s?.responseBodySize || 0;
  });
  try {
    const t0 = Date.now();
    const res = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    out.load_ms = Date.now() - t0;
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    out.status = res ? res.status() : 0;
    out.final_url = page.url();
    out.lcp_ms = await largestContentfulPaint(page);
    const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    if (BOT_WALL.test(text.slice(0, 2000)) && text.length < 3000) {
      out.blocked = 'bot-check';
      return out;
    }
    Object.assign(out, await page.evaluate(measure, { ctaSource: CTA_TEXT.source, foldHeight: opts.viewport.height }));
    out.login_wall = out.password_field || /\/(login|signin|sign-in|auth)\b|^https?:\/\/(auth|login|accounts)\./i.test(out.final_url);
    if (axe) out.axe = await runAxe(page);
    out.bytes = bytes;
    out.requests = requests;
    out.console_errors = [...new Set(errors)].slice(0, 10);
    if (shotDir) {
      await mkdir(shotDir, { recursive: true });
      out.shot = path.join(shotDir, `${kind}-${device}.png`);
      await page.screenshot({ path: out.shot });
    }
  } catch (e) {
    out.error = String(e.message).split('\n')[0].slice(0, 160);
  } finally {
    await ctx.close();
  }
  return out;
}

/** Saved login session for a domain, created by `npm run login` (see README). */
export function sessionFor(authDir, domain) {
  const f = path.join(authDir, `${domain}.json`);
  return existsSync(f) ? f : null;
}
