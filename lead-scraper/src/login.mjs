#!/usr/bin/env node
// Save your own login session for one product, so `npm run teardown` can screenshot its
// dashboard. Run this on your computer (it opens a visible browser):
//   npm run login -- https://app.example.com example.com
// Sign up or log in by hand, open the main dashboard, then press Enter here.
// The session is saved to auth/<domain>.json. Keep that folder private: it holds your cookies.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { registrableDomain } from './domain.mjs';

const [url, domainArg] = process.argv.slice(2);
if (!url) {
  console.error('Usage: npm run login -- <login or signup url> [domain]');
  process.exit(1);
}
const domain = domainArg || registrableDomain(url);
const { chromium } = createRequire(import.meta.url)('playwright');

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(url);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question(`Log in to ${domain} in the browser window, open the main dashboard, then press Enter here... `);
rl.close();
await mkdir('auth', { recursive: true });
const file = path.join('auth', `${domain}.json`);
await ctx.storageState({ path: file });
// Remember which page is the dashboard, so the teardown opens the same one.
await writeFile(path.join('auth', `${domain}.url`), page.url());
console.log(`Saved ${file}. Dashboard to audit: ${page.url()}`);
await browser.close();
