#!/usr/bin/env node
// Guided product tour, run on YOUR computer. For each product in the list it opens a
// visible browser on the sign-up page and waits while you sign up or log in. Press Enter
// when you are on the dashboard; from there the script walks the product by itself:
// follows the app's own menu links (never buttons, never forms), screenshots every
// screen on a laptop and a phone, and records page text, load time, console errors and
// accessibility problems. Everything lands in tours/<domain>/ for the analysis.
//
//   npm run tour -- out/send-2026-11-19/send-plan.xlsx      (tab "2 Log in today")
//   npm run tour -- --only natural.com,buywander.com out/send-2026-11-19/send-plan.xlsx
//
// Safe by design: it only follows links inside the product, and skips anything that
// looks like log out, delete, billing, payment, invite, export or settings changes.
// It never types, submits or clicks a button. Your session is saved to auth/<domain>.json
// (private, git-ignored) so the dashboard teardown can reuse it.
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';
import ExcelJS from 'exceljs';
import { registrableDomain } from './domain.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AXE = require.resolve('axe-core/axe.min.js');
const { values: args, positionals } = parseArgs({ allowPositionals: true, options: { only: { type: 'string' }, sheet: { type: 'string', default: '2 Log in today' }, pages: { type: 'string', default: '12' } } });
const PLAN = positionals[0] || 'out/send-2026-11-19/send-plan.xlsx';
const SKIP = /log ?out|sign ?out|delete|remove|cancel|unsubscribe|deactivate|billing|checkout|payment|pay\b|upgrade|invoice|invite|export|download|api[- ]?key|token|danger|close account|reset/i;

// Products to tour, from the send plan.
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(PLAN);
const ws = wb.getWorksheet(args.sheet);
// ExcelJS rows are 1-based with gaps: read cell by cell.
const head = [];
ws.getRow(1).eachCell((c, col) => (head[col] = String(c.value || '').trim().replace(/\s+/g, '_')));
const cellText = (v) => (v && typeof v === 'object' ? v.text || v.hyperlink || '' : v ?? '');
const products = [];
ws.eachRow((row, i) => {
  if (i === 1) return;
  const r = {};
  head.forEach((h, col) => h && (r[h] = cellText(row.getCell(col).value)));
  const url = String(r.sign_up_url || r.website || '');
  const domain = registrableDomain(String(r.website || url)) || registrableDomain(url);
  if (url && (!args.only || args.only.split(',').includes(domain))) products.push({ company: r.company, domain, url, website: r.website });
});
console.log(`${products.length} products to tour. For each: log in or sign up in the browser window, open the main dashboard, then press Enter here.\n`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const browser = await chromium.launch({ headless: false });

async function capture(page, dir, name, mobile = false) {
  const t0 = Date.now();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  const shot = path.join(dir, `${name}${mobile ? '-mobile' : ''}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => page.screenshot({ path: shot }));
  const info = await page.evaluate(() => {
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    return {
      url: location.href,
      title: document.title,
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((h) => h.innerText.trim()).slice(0, 20),
      buttons: [...document.querySelectorAll('button,[role=button],a.btn,a[class*=button]')].filter(visible).map((b) => b.innerText.trim()).filter(Boolean).slice(0, 40),
      text: document.body.innerText.replace(/\n{3,}/g, '\n\n').slice(0, 6000),
      empty_states: [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && /no (data|projects?|items?|results?|records?)|nothing (here|yet)|get started|empty/i.test(e.textContent || '')).map((e) => e.textContent.trim()).slice(0, 10),
    };
  });
  await page.addScriptTag({ path: AXE }).catch(() => {});
  const axe = await page.evaluate(async () => (window.axe ? (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length })) : [])).catch(() => []);
  return { ...info, shot, axe, settle_ms: Date.now() - t0 };
}

for (const p of products) {
  const dir = path.join('tours', p.domain);
  await mkdir(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  console.log(`\n=== ${p.company} (${p.domain}) ===`);
  const t0 = Date.now();
  await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log(`could not open: ${e.message}`));
  const signupLoadMs = Date.now() - t0;
  const signup = await capture(page, dir, '00-signup');
  const answer = (await rl.question('Log in / sign up, open the dashboard, then press Enter (type "skip" to skip this one): ')).trim().toLowerCase();
  if (answer === 'skip') {
    await writeFile(path.join(dir, 'tour.json'), JSON.stringify({ ...p, skipped: true, signup }, null, 2));
    await ctx.close();
    continue;
  }
  await mkdir('auth', { recursive: true });
  await ctx.storageState({ path: path.join('auth', `${p.domain}.json`) });
  const start = page.url();
  const origin = new URL(start).origin;
  const screens = [await capture(page, dir, '01-dashboard')];
  // Walk the product's own menu: same-origin links only, safe ones only.
  const links = await page.evaluate(() => [...document.querySelectorAll('nav a[href], aside a[href], header a[href], [role=navigation] a[href], a[href]')].map((a) => ({ href: a.href, text: (a.innerText || a.getAttribute('aria-label') || '').trim() })));
  const queue = [...new Map(links.filter((l) => l.href.startsWith(origin) && !SKIP.test(`${l.text} ${l.href}`) && l.href !== start && !l.href.includes('#')).map((l) => [l.href.split('?')[0], l])).values()].slice(0, Number(args.pages));
  let n = 2;
  for (const l of queue) {
    try {
      await page.goto(l.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (new URL(page.url()).origin !== origin) continue;
      screens.push({ link_text: l.text, ...(await capture(page, dir, String(n++).padStart(2, '0') + '-' + (l.text || 'page').replace(/[^a-z0-9]+/gi, '-').slice(0, 30).toLowerCase())) });
    } catch (e) {
      screens.push({ link_text: l.text, url: l.href, error: String(e.message).slice(0, 120) });
    }
  }
  // The dashboard and the sign-up page on a phone.
  const mctx = await browser.newContext({ ...require('playwright').devices['iPhone 13'], storageState: path.join('auth', `${p.domain}.json`) });
  const mpage = await mctx.newPage();
  const mobile = [];
  for (const [name, u] of [['01-dashboard', start], ['00-home', p.website || origin]]) {
    try {
      await mpage.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
      mobile.push({ name, ...(await capture(mpage, dir, name, true)) });
    } catch (e) {
      mobile.push({ name, error: String(e.message).slice(0, 120) });
    }
  }
  await mctx.close();
  await writeFile(path.join(dir, 'tour.json'), JSON.stringify({ ...p, toured_at: new Date().toISOString(), signup_load_ms: signupLoadMs, signup, screens, mobile, console_errors: [...new Set(errors)].slice(0, 30) }, null, 2));
  console.log(`saved ${screens.length} screens + ${mobile.length} phone screens to ${dir}`);
  await ctx.close();
}
rl.close();
await browser.close();
console.log('\nDone. Zip the tours/ folder and send it (auth/ stays on your computer).');
