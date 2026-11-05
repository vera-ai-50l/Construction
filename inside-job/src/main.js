// Entry point. Normal play goes through App (title -> crew -> safehouse ->
// job). `?dev` skips the shell and drops straight into a job for one player
// (add `role=hacker` for the van), which the screenshot scripts use.
import { getRenderer, guessQuality } from './render/gfx.js';
import { loadAssets } from './render/assets.js';
import { generateLevel } from './core/level.js';
import { Sim } from './core/sim.js';
import { World } from './render/world.js';
import { RunnerView } from './game/runner.js';
import { HackerView } from './ui/hacker.js';
import { App } from './app.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams((typeof location !== 'undefined' && location.search) || '');

function progress(p, text) {
  const l = $('#loading'); l.classList.add('show');
  l.querySelector('.ld-bar i').style.width = Math.round(p * 100) + '%';
  if (text) l.querySelector('.ld-txt').textContent = text;
}
function hideLoading() { $('#loading').classList.remove('show'); }

function bootHacker(stage, contract) {
  const L = generateLevel(contract);
  const sim = new Sim(L, {});
  const hk = new HackerView(stage, L, contract);
  hideLoading();
  const IJ = window.IJ = { L, sim, hk, frames: 0,
    pose(x, z, a) { sim.r.x = x; sim.r.z = z; sim.r.a = a; },
    runner: { a: L.spawn.a, pitch: 0 } };
  const tick = (dt) => { sim.step(dt, IJ.runner, hk.out()); hk.setSnap(sim.snapshot()); hk.frame(dt); IJ.frames++; };
  IJ.tick = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); return IJ.frames; };
  if (params.has('manual')) { IJ.frames = 1; return; }
  let last = performance.now();
  const frame = (now) => { const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000)); last = now; IJ.runner.a = sim.r.a; tick(dt); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}

async function boot() {
  const stage = $('#stage');
  if (params.get('role') === 'hacker') {
    const c = { seed: params.get('seed') || 'dev-1', theme: params.get('theme') || 'bank', tier: +(params.get('tier') || 3), twist: params.get('twist') || 'none', name: 'Dev Job' };
    return bootHacker(stage, c);
  }
  const renderer = getRenderer(stage);
  const quality = params.get('q') || guessQuality(renderer);
  progress(0, 'Loading the crew’s gear…');
  const assets = await loadAssets(renderer, (p) => progress(p * 0.9));
  progress(0.92, 'Casing the building…');
  await new Promise((r) => setTimeout(r, 30));
  const contract = { seed: params.get('seed') || 'dev-1', theme: params.get('theme') || 'bank', tier: +(params.get('tier') || 3), twist: params.get('twist') || 'none', name: 'Dev Job' };
  const L = generateLevel(contract);
  const sim = new Sim(L, {}, { testMode: true });
  const world = new World(L, assets, { quality });
  const view = new RunnerView({ renderer, world, sim, L, contract, root: stage, quality });
  if (params.has('nolock')) view.dragLook = true, view.pause.classList.remove('show');
  view.manual = params.has('manual');
  view.render(1 / 60);
  hideLoading();
  const hacker = { cmd: [], hold: false };
  let last = performance.now();
  const IJ = window.IJ = { L, sim, world, view, renderer, quality, frames: 0,
    pose(x, z, a, pitch = 0) { sim.r.x = x; sim.r.z = z; view.yaw = a; view.pitch = pitch; sim.r.a = a; view.snapExposure = true; },
    hacker };
  const tick = (dt) => {
    const inp = view.input(dt);
    sim.step(dt, inp, hacker);
    view.render(dt);
    IJ.frames++;
  };
  // test hook: ?manual renders only when asked (software GL in CI is very slow)
  IJ.tick = (n = 1, dt = 1 / 30, inp) => { for (let i = 0; i < n; i++) { if (inp) Object.assign(view.keys, {}); tick(dt); } return IJ.frames; };
  if (params.has('manual')) { IJ.frames = 1; return; }
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000)); last = now;
    tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (params.has('dev')) boot().catch((e) => { console.error(e); progress(1, 'Something went wrong: ' + (e && e.message)); });
else {
  try { new App(); } catch (e) { console.error(e); progress(1, 'Something went wrong: ' + (e && e.message)); }
}
