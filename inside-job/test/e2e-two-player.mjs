// Two-player end-to-end: two separate browser contexts (= two machines) over the WS relay.
// Needs the game served first (npm run dev) and Playwright with Chromium installed.
// Usage: node test/e2e-two-player.mjs [ws|bc]   (screenshots go to test/shots/)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('playwright-core')); }
import fs from 'node:fs';
const dir = fileURLToPath(new URL('./shots/', import.meta.url)); fs.mkdirSync(dir, { recursive: true });
const net = process.argv[2] || 'ws';
const origin = process.env.IJ_TEST_ORIGIN || 'http://localhost:8080';
const crew = 'T' + Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z]/g, 'Q').padEnd(4, 'Q');
const browser = await chromium.launch({ executablePath: process.env.IJ_CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const mk = async (name, role) => {
  const ctx = net === 'bc' && globalThis.sharedCtx ? globalThis.sharedCtx : await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  if (net === 'bc') globalThis.sharedCtx = ctx;
  const page = await ctx.newPage();
  page.logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') page.logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => page.logs.push('PAGEERROR: ' + e.message));
  await page.goto(`${origin}/?crew=${crew}&name=${name}&role=${role}&auto&manual&net=${net}`, { waitUntil: 'domcontentloaded' });
  return page;
};
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const A = await mk('Ann', 'runner');
const B = await mk('Bo', 'hacker');
const t0 = Date.now();
// lobby -> job
await A.waitForFunction(() => IJ.app.partner, null, { timeout: 15000 });
await A.waitForTimeout(400);
await B.screenshot({ path: dir + 'tp-safe-hacker.png' });
/* fast: skipped runner 3D screenshot */
const dbg = () => ({ mode: IJ.app.mode, me: IJ.app.me, partner: IJ.app.partner && IJ.app.partner.p.who, rev: IJ.app.crew.rev, prev: IJ.app.partner && IJ.app.partner.p.crew && IJ.app.partner.p.crew.rev, asset: IJ.app.assetProg, hasAssets: !!IJ.app.assets, job: IJ.app.job && IJ.app.job.n });
try { await A.waitForFunction(() => IJ.app.mode === 'job' && IJ.app.sim, null, { timeout: 120000 }); }
catch (e) { console.log('A', JSON.stringify(await A.evaluate(dbg))); console.log('B', JSON.stringify(await B.evaluate(dbg))); console.log(A.logs, B.logs); process.exit(1); }
console.log('runner in job after', Date.now() - t0, 'ms');
await B.waitForFunction(() => IJ.app.mode === 'job' && IJ.app.hk, null, { timeout: 15000 });
ok(await A.evaluate(() => IJ.app.job.n) === await B.evaluate(() => IJ.app.job.n), 'both in the same job');
ok(await A.evaluate(() => IJ.app.job.c.id) === await B.evaluate(() => IJ.app.job.c.id), 'same contract');
// Render until the van receives a live JPEG before stubbing the runner renderer.
await A.evaluate(() => { IJ.app.view.dragLook = true; IJ.app.view.pause.classList.remove('show'); IJ.app.manualStep && IJ.app.manualStep(1 / 30); });
let hasBodycam = false;
for (let i = 0; i < 20 && !hasBodycam; i++) {
  await A.evaluate(() => IJ.app.manualStep(1 / 30));
  await A.waitForTimeout(140);
  hasBodycam = await B.evaluate(() => {
    IJ.app.manualStep(1 / 30);
    return IJ.app.hk.el.camImage.naturalWidth > 0;
  });
}
ok(hasBodycam && await B.evaluate(() => {
  const img = IJ.app.hk.el.camImage;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.drawImage(img, 0, 0, 24, 16);
  const pixels = ctx.getImageData(0, 0, 24, 16).data;
  return pixels.some((value, i) => i % 4 !== 3 && value > 40);
}), 'van received a visible runner bodycam frame');
await A.evaluate(() => { IJ.app._render = IJ.app.view.render.bind(IJ.app.view); IJ.app.view.render = () => {}; });
const stepBoth = async (n) => {
  for (let i = 0; i < n; i++) {
    await A.evaluate(() => { for (let k = 0; k < 3; k++) IJ.app.manualStep && IJ.app.manualStep(1 / 30); });
    await B.evaluate(() => IJ.app.manualStep && IJ.app.manualStep(1 / 10));
  }
};
await stepBoth(10);
ok(await B.evaluate(() => !IJ.app.hkWait), 'hacker receives runner snapshots');
const snapT = await B.evaluate(() => IJ.app.lastSnap && IJ.app.lastSnap.t);
ok(snapT > 0, 'hacker snapshot time ' + snapT);
// hacker command -> runner sim
const v = await A.evaluate(() => [IJ.app.sim.r.x, IJ.app.sim.r.z]);
await B.evaluate(([x, z]) => IJ.app.hk.send('mark', x + 3, z), v);
await stepBoth(8);
const mark = await A.evaluate(() => IJ.app.sim.mark && [IJ.app.sim.mark.x, IJ.app.sim.mark.z, IJ.app.sim.ack]);
ok(mark && Math.abs(mark[0] - (v[0] + 3)) < 0.01, 'hacker mark reached runner sim: ' + JSON.stringify(mark));
ok(await B.evaluate(() => IJ.app.hk.pending.length) === 0, 'acked command pruned on hacker');
await B.evaluate(() => IJ.app.hk.frame(0.016));
await B.screenshot({ path: dir + 'tp-job-hacker.png' });

/* fast: skipped runner 3D screenshot */
// core mechanic: runner reads the junction serial off the wall, hacker types it in
const jid = await A.evaluate(() => IJ.app.L.panels.findIndex((p) => p.kind === 'junction'));
const code = await A.evaluate((id) => { const p = IJ.app.L.panels[id], S = IJ.app.sim; S.r.x = p.x + p.nx * 0.7; S.r.z = p.z + p.nz * 0.7; const a = Math.atan2(-p.nz, -p.nx); S.r.a = a; IJ.app.view.yaw = a; IJ.app.view.pitch = 0; S.openPanel(id); return S.panels[id].code; }, jid);
await stepBoth(6);
await B.evaluate(() => IJ.app.hk.frame(0.016));
await B.screenshot({ path: dir + 'tp-junction-hacker.png' });

/* fast: skipped runner 3D screenshot */
await B.fill('input.hk-serial', code);
await B.press('input.hk-serial', 'Enter');
await stepBoth(8);
const zon = await A.evaluate((id) => (IJ.app.sim.zones >> IJ.app.L.panels[id].zone) & 1, jid);
ok(zon === 1, 'serial ' + code + ' read on the wall + typed by the van networked the zone');
await B.evaluate(() => IJ.app.hk.frame(0.016));
await B.screenshot({ path: dir + 'tp-junction-hacker2.png' });
// end the job
await A.evaluate(() => IJ.app.sim.end('bail', 'abort'));
await stepBoth(30);
await A.waitForFunction(() => IJ.app.mode === 'results', null, { timeout: 10000 }).catch(() => {});
await B.waitForFunction(() => IJ.app.mode === 'results', null, { timeout: 10000 }).catch(() => {});
ok(await A.evaluate(() => IJ.app.mode) === 'results', 'runner sees results');
ok(await B.evaluate(() => IJ.app.mode) === 'results', 'hacker sees results');
await A.waitForTimeout(1500);
await A.screenshot({ path: dir + 'tp-res-runner.png' });
for (const [P, who] of [[A, 'runner'], [B, 'hacker']]) {
  const bytes = await P.evaluate(() => new TextEncoder().encode(JSON.stringify(IJ.app.link.mine)).length);
  ok(bytes <= 3800, who + ' presence after the job is ' + bytes + ' bytes (room cap 4096)');
}
await B.screenshot({ path: dir + 'tp-res-hacker.png' });
const ca = await A.evaluate(() => [IJ.app.crew.jobs, IJ.app.crew.rev, IJ.app.crew.history.length]);
const cb = await B.evaluate(() => [IJ.app.crew.jobs, IJ.app.crew.rev, IJ.app.crew.history.length]);
ok(JSON.stringify(ca) === JSON.stringify(cb) && ca[0] === 1, 'crew synced after job ' + JSON.stringify(ca) + ' vs ' + JSON.stringify(cb));
// back to safehouse on both -> board re-dealt identically
await A.evaluate(() => IJ.app.showSafehouse());
await B.evaluate(() => IJ.app.showSafehouse());
await A.waitForTimeout(600);
const ba = await A.evaluate(() => IJ.app.contracts().map((c) => c.id).join());
const bb = await B.evaluate(() => IJ.app.contracts().map((c) => c.id).join());
ok(ba === bb, 'new board identical on both: ' + ba);
await B.screenshot({ path: dir + 'tp-safe2-hacker.png' });
for (const [n, p] of [['runner', A], ['hacker', B]]) if (p.logs.length) console.log(n + ' logs:\n  ' + p.logs.slice(0, 15).join('\n  '));
await browser.close();
