// Optional headless-browser pass (--render / --screenshots). It reads pages the way a
// visitor sees them, screenshots the public screens a teardown needs, and checks
// whether a "public demo" really opens without a login. It never logs in, never
// fills forms, and stops at any login, CAPTCHA or bot check.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { USER_AGENT, robotsAllowsUrl } from '../http.mjs';

const require = createRequire(import.meta.url);
let browserPromise = null;

function browser() {
  if (!browserPromise) {
    const { chromium } = require('playwright');
    browserPromise = chromium.launch();
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = null;
}

async function withPage(fn) {
  const ctx = await (await browser()).newContext({ viewport: { width: 1440, height: 900 }, userAgent: USER_AGENT });
  const page = await ctx.newPage();
  try {
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

async function open(page, url) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  return res;
}

/** Same return shape as http.getText, but rendered by a browser. */
export async function renderGet(url) {
  if (!(await robotsAllowsUrl(url))) return { ok: false, status: 0, url, text: '', blocked: 'robots.txt' };
  try {
    return await withPage(async (page) => {
      const res = await open(page, url);
      return { ok: !!res && res.ok(), status: res ? res.status() : 0, url: page.url(), text: await page.content() };
    });
  } catch (e) {
    return { ok: false, status: 0, url, text: '', error: String(e.message).slice(0, 160) };
  }
}

const BOT_WALL = /captcha|verify you are human|security checkpoint|attention required/i;

async function inspect(page, url) {
  const res = await open(page, url);
  const text = (await page.evaluate(() => document.body?.innerText || '')).replace(/\s+/g, ' ');
  const hasPassword = (await page.locator('input[type=password]').count()) > 0;
  return {
    status: res ? res.status() : 0,
    final: page.url(),
    text,
    hasPassword,
    botWall: BOT_WALL.test(text),
    loginWall: hasPassword || /\/(login|signin|sign-in|auth)\b|^https?:\/\/(auth|login|accounts)\./i.test(page.url()),
  };
}

/**
 * Screenshot the public screens a teardown can use and test demo/signup pages.
 * @returns { shots: [{kind,url,file}], public_demo_open, signup: {...} }
 */
export async function captureLead(lead, outDir) {
  const s = lead.site;
  const dir = path.join(outDir, 'shots', lead.domain);
  await mkdir(dir, { recursive: true });
  const targets = [
    ['home', s.fetched_url],
    ['pricing', s.pricing_url],
    ['signup', s.signup_urls[0]],
    ['demo', s.public_demo_urls[0]],
  ].filter(([, u]) => u);

  const result = { shots: [], public_demo_open: null, signup: null };
  for (const [kind, url] of targets) {
    if (!(await robotsAllowsUrl(url))) continue;
    try {
      await withPage(async (page) => {
        const r = await inspect(page, url);
        if (r.botWall) return; // stop: no screenshots of bot checks, no retries
        const file = path.join(dir, `${kind}.png`);
        await page.screenshot({ path: file });
        result.shots.push({ kind, url: r.final, file });
        // Open = a populated page with no login and no "book a demo" form on it.
        const bookingForm = (await page.locator('input[type=email]').count()) > 0 && /book|schedule|request|talk to/i.test(r.text);
        if (kind === 'demo' && !r.loginWall && !bookingForm && r.text.length > 500) result.public_demo_open = r.final;
        if (kind === 'signup') {
          result.signup = {
            url: r.final,
            work_email_required: /work email|business email|company email|only work emails/i.test(r.text),
            oauth: ['google', 'github', 'microsoft'].filter((p) => new RegExp(`continue with ${p}|sign (up|in) with ${p}|\\b${p}\\b`, 'i').test(r.text)),
            invite_or_waitlist: /waitlist|request access|invite only|invitation/i.test(r.text),
          };
        }
      });
    } catch {
      /* one failed screen should not stop the run */
    }
  }
  return result;
}
