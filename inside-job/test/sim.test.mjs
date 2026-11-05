import { generateLevel, astar, cellAt, cellCenter } from '../src/core/level.js';
import { Sim } from '../src/core/sim.js';
import { T } from '../src/core/data.js';
import { segIntersect, segDist } from '../src/core/geom.js';

function bot(seed, opts = {}) {
  const L = generateLevel({ seed, theme: opts.theme || 'bank', tier: opts.tier || 3 });
  if (opts.noGuards) L.guards = [];
  const S = new Sim(L, {});
  let seq = 0; const cmds = []; let hold = false;
  const hacker = () => ({ cmd: cmds.slice(-8), hold });
  const send = (...c) => cmds.push([++seq, ...c]);
  const dt = 1 / 30;
  let log = [];
  const doorOk = (d) => d.kind === 'swing' || (d.kind === 'entry') || (d.kind === 'edoor' && S.doors[d.id].o > 0.9) || (d.kind === 'vault' && S.vaultOpen);
  const willBeOn = (i) => { const t = S.t; S.t += 0.7; const on = S.laserOn(i); S.t = t; return on; };
  for (let i = 0; i < L.lasers.length; i++) if (L.lasers[i].kind === 'hard') S.lasers[i].st = 2;
  if (opts.noGuards) for (const c of S.cams) c.st = 2;
  function tick(inp) { S.step(dt, inp, hacker()); }
  function goTo(x, z, maxT = 120) {
    const t0 = S.t;
    for (;;) {
      if (S.phase !== 'play') return false;
      const path = astar(L, cellAt(L, S.r.x, S.r.z), cellAt(L, x, z), doorOk, L.blk);
      if (!path) { log.push('nopath'); return false; }
      if (path.length <= 1) {
        const d = Math.hypot(x - S.r.x, z - S.r.z);
        if (d < 0.25) return true;
        tick({ mx: 0, mz: 1, a: Math.atan2(z - S.r.z, x - S.r.x), pitch: 0 });
      } else {
        const c = cellCenter(L, path[1]);
        // wait for pulse lasers in the way
        let blocked = false;
        for (let i = 0; i < L.lasers.length; i++) {
          const lz = L.lasers[i];
          if (!S.laserOn(i) && !willBeOn(i)) continue;
          if (segIntersect(S.r.x, S.r.z, c.x, c.z, lz.x1, lz.z1, lz.x2, lz.z2) || segDist(lz.x1, lz.z1, lz.x2, lz.z2, c.x, c.z) < 0.5) blocked = true;
        }
        if (blocked) tick({ a: S.r.a }); else
        tick({ mx: 0, mz: 1, a: Math.atan2(c.z - S.r.z, c.x - S.r.x), pitch: 0 });
      }
      if (S.t - t0 > maxT) { log.push('timeout'); return false; }
    }
  }
  function standAt(x, z, nx, nz) { // stand in front of a wall object
    return goTo(x + nx * 0.75, z + nz * 0.75);
  }
  function holdUse(a, pitch, until, maxT = 20, tgt) {
    const t0 = S.t;
    while (!until() && S.t - t0 < maxT && S.phase === 'play') {
      if (tgt) { a = face(tgt.x, tgt.z); pitch = Math.atan2(tgt.y + 0.15 - S.r.eye, Math.max(0.2, Math.hypot(tgt.x - S.r.x, tgt.z - S.r.z))); }
      tick({ a, pitch, use: true });
    }
    return until();
  }
  // nearest free cell next to a furniture piece
  function besideFurn(f) {
    let best = null;
    for (const c of [[f.x + f.hx + 0.55, f.z], [f.x - f.hx - 0.55, f.z], [f.x, f.z + f.hz + 0.55], [f.x, f.z - f.hz - 0.55]]) {
      const ci = cellAt(L, c[0], c[1]); if (ci < 0 || L.blk[ci] || L.cell[ci] !== L.cell[cellAt(L, f.x, f.z)]) continue;
      const p = astar(L, cellAt(L, S.r.x, S.r.z), ci, doorOk, L.blk);
      if (p && (!best || p.length < best.n)) best = { x: c[0], z: c[1], n: p.length };
    }
    return best;
  }
  const face = (x, z) => Math.atan2(z - S.r.z, x - S.r.x);

  // 1. pick the entry door
  const ed = L.doors[0];
  goTo(ed.x, ed.z + 0.9);
  if (!holdUse(face(ed.x, ed.z), 0, () => S.doors[0].picked)) return { fail: 'pick', log };
  // 2. each zone junction
  for (let z = 0; z < L.zones; z++) {
    const p = L.panels[L.junction[z]];
    if (!standAt(p.x, p.z, p.nx, p.nz)) return { fail: 'reach junction ' + z, log };
    if (!holdUse(face(p.x, p.z), 0, () => S.r.panel)) return { fail: 'open junction ' + z + ' focus=' + JSON.stringify(S.focus), log };
    send('serial', p.id, S.panels[p.id].code); tick({ a: S.r.a });
    tick({ a: S.r.a });
    if (!S.zoneOn(z)) return { fail: 'zone not hacked ' + z, log };
    S.panelAction({ type: 'close' });
    for (const d of L.doors) if (d.kind === 'edoor' && d.ctrl === z && !S.doors[d.id].eopen) { while (S.bw < 1) tick({ a: S.r.a }); send('door', d.id); tick({ a: S.r.a }); }
    for (let i = 0; i < 40; i++) tick({ a: S.r.a });
  }
  // 3. vault pad
  const vp = L.panels[L.vaultPad];
  if (!standAt(vp.x, vp.z, vp.nx, vp.nz)) return { fail: 'reach vaultpad', log };
  if (!holdUse(face(vp.x, vp.z), 0, () => S.r.panel)) return { fail: 'open vaultpad', log };
  for (const g of S.panels[vp.id].glyphs) S.panelAction({ type: 'key', d: L.cipher[g] });
  if (!S.panels[vp.id].done) return { fail: 'vaultpad code', log };
  // 4. timelock
  const vd = L.doors[L.vaultDoor];
  const vr = L.rooms[L.vaultRoom];
  const outside = L.rooms[vd.a === L.vaultRoom ? vd.b : vd.a];
  // stand on the near side of the vault door
  const e = vd.edges[0];
  let sx = vd.x, sz = vd.z;
  if (e.h) sz += (outside.y < e.y ? -0.8 : 0.8); else sx += (outside.x < e.x ? -0.8 : 0.8);
  if (!goTo(sx, sz)) return { fail: 'reach vault door', log };
  hold = true;
  if (!holdUse(face(vd.x, vd.z), 0, () => S.vaultOpen, 40)) return { fail: 'timelock ' + S.timelock.toFixed(2) + ' focus=' + JSON.stringify(S.focus) + ' bw=' + S.bw.toFixed(1), log };
  hold = false;
  for (let i = 0; i < 150; i++) tick({ a: S.r.a });
  // 5. grab primary
  const pi = L.loot.findIndex((l) => l.primary), it = L.loot[pi];
  if (it.kind === 'painting') standAt(it.x, it.z, it.nx, it.nz); else { const b = besideFurn(L.furn[it.furn]); if (!b) return { fail: 'no spot near primary', log }; goTo(b.x, b.z); }
  for (let i = 0; i < 10; i++) tick({ a: S.r.a });
  if (!holdUse(0, 0, () => S.loot[pi] === 1, 20, it)) return { fail: 'grab primary focus=' + JSON.stringify(S.focus) + ' d=' + Math.hypot(it.x - S.r.x, it.z - S.r.z).toFixed(2), log };
  // 6. back to van, secure, leave
  if (!goTo(L.van.x + (L.spawn.x > L.van.x ? 2.2 : -2.2), L.van.z - 1.5)) return { fail: 'return to van', log };
  if (!holdUse(face(L.van.x, L.van.z), 0, () => S.r.bag.length === 0)) return { fail: 'secure', log };
  holdUse(face(L.van.x, L.van.z), 0, () => S.phase !== 'play');
  return { ok: S.phase, sum: S.summary(), snapBytes: JSON.stringify(S.snapshot()).length };
}

const S_info = () => { const D = globalThis.DBG; globalThis.DBG = null; if (!D) return ''; const { it, r, L } = D; return JSON.stringify({ it: { x: it.x, y: it.y, z: it.z, kind: it.kind }, r: { x: r.x, z: r.z, a: r.a, pitch: r.pitch, eye: r.eye }, furn: L.furn[it.furn] && { x: L.furn[it.furn].x, z: L.furn[it.furn].z, hx: L.furn[it.furn].hx, hz: L.furn[it.furn].hz } }); };
let ok = 0; const fails = [];
for (let i = 0; i < 30; i++) {
  const res = bot('bot' + i, { noGuards: true, theme: ['bank', 'museum', 'tech'][i % 3], tier: 1 + (i % 6) });
  if (res.ok === 'won') ok++; else fails.push(['bot' + i, res.fail, res.log.slice(-3), S_info()]);
  if (i === 0) console.log('summary', JSON.stringify(res.sum), 'snapshot bytes', res.snapBytes);
}
console.log('full-flow wins', ok, '/ 30');
for (const f of fails) console.log('FAIL', ...f);

// guard stress: random wandering runner, ensure no exceptions and guards react
let caught = 0, alarms = 0, t0 = Date.now(), maxSnap = 0;
for (let i = 0; i < 12; i++) {
  const L = generateLevel({ seed: 'stress' + i, theme: 'museum', tier: 6 });
  const S = new Sim(L, {});
  S.doors[0].picked = true; S.zones = 7;
  for (const d of L.doors) if (d.kind === 'edoor') S.doors[d.id].eopen = true;
  let a = -Math.PI / 2;
  for (let k = 0; k < 30 * 240 && S.phase === 'play'; k++) {
    if (k % 45 === 0) a += (Math.random() - 0.5) * 2.5;
    S.step(1 / 30, { mx: 0, mz: 1, a, pitch: 0, sprint: k % 300 < 100, crouch: k % 500 > 400 }, {});
    if (k % 3 === 0) maxSnap = Math.max(maxSnap, JSON.stringify(S.snapshot()).length);
  }
  if (S.phase === 'bust') caught++;
  alarms += S.stats.alarms;
}
console.log('stress: busts', caught, '/12, alarms', alarms, 'max snapshot bytes', maxSnap, 'ms', Date.now() - t0);

// The vault timelock must be finishable on every twist with no upgrades:
// the van saves to its cap, then both hold; repeat until the vault opens.
import { TWISTS } from '../src/core/data.js';
import { currentStep, stateFromSim, stateFromSnap, planSteps } from '../src/core/guide.js';
const tlFails = [];
for (const twist of Object.keys(TWISTS)) {
  const L = generateLevel({ seed: 'tl-' + twist, theme: 'bank', tier: 3, twist });
  L.guards = [];
  const S = new Sim(L, {});
  S.panels[L.vaultPad].done = true; S.zones = (1 << L.zones) - 1;
  const vd = L.doors[L.vaultDoor];
  const near = L.rooms[vd.a === L.vaultRoom ? vd.b : vd.a];
  const e = vd.edges[0];
  S.r.x = vd.x; S.r.z = vd.z;
  if (e.h) S.r.z += near.y < e.y ? -0.8 : 0.8; else S.r.x += near.x < e.x ? -0.8 : 0.8;
  const a = Math.atan2(vd.z - S.r.z, vd.x - S.r.x);
  let holding = false;
  for (let k = 0; k < 30 * 300 && !S.vaultOpen; k++) {
    if (!holding && S.bw >= S.bwMax - 0.01) holding = true;
    if (holding && S.bw <= 0.05) holding = false;
    S.step(1 / 30, { a, pitch: 0, use: holding }, { hold: holding });
  }
  if (!S.vaultOpen) tlFails.push(twist + ' (bw cap ' + S.bwMax + ', timelock ' + S.timelock.toFixed(2) + ')');
}
console.log('timelock finishable on every twist:', tlFails.length ? 'FAIL ' + tlFails.join(', ') : 'yes');

// The crew plan reads the same from the sim (runner) and the snapshot (hacker).
let planMismatch = 0;
for (let i = 0; i < 40; i++) {
  const L = generateLevel({ seed: 'plan' + i, theme: ['bank', 'museum', 'tech'][i % 3], tier: 1 + (i % 8) });
  const S = new Sim(L, {});
  const steps = planSteps(L);
  // walk the state forward through the plan and compare at each stage
  const stages = [
    () => {}, () => { S.doors[0].picked = true; },
    ...Array.from({ length: L.zones }, (_, z) => () => { S.zones |= 1 << z; for (const d of L.doors) if (d.kind === 'edoor' && d.ctrl === z) S.doors[d.id].eopen = true; }),
    () => { S.panels[L.vaultPad].done = true; }, () => { S.vaultOpen = true; },
  ];
  let last = -1;
  for (const st of stages) {
    st();
    const a = currentStep(L, stateFromSim(L, S)), b = currentStep(L, stateFromSnap(L, S.snapshot()));
    if (a.n !== b.n || a.runner !== b.runner || a.hacker !== b.hacker) planMismatch++;
    if (a.n < last) planMismatch++;
    last = a.n;
    if (!a.runner || !a.hacker || a.total !== steps.length) planMismatch++;
  }
}
console.log('crew plan matches on both screens:', planMismatch ? 'FAIL ' + planMismatch : 'yes');
if (tlFails.length || planMismatch || ok < 30) process.exitCode = 1;
