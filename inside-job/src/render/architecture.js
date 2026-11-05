// Static building geometry: floors, thin walls, ceilings, door headers and
// casings, baseboards, facade, fence, light fixtures and yard dressing.
import * as THREE from 'three';
import { T, WALL_H, ROOMS } from '../core/data.js';
import { E_WALL, E_DOOR, hIdx, vIdx } from '../core/level.js';
import { GeoBuilder, mat } from './geo.js';

export const HT = 0.09;          // wall half thickness
export const FACADE_H = 7.6, FENCE_H = 2.7;
export const DOOR_H = { swing: 2.2, entry: 2.2, edoor: 2.45, vault: 2.6 };
const PLAIN_CEIL = new Set(['lobby', 'hall', 'gallery', 'exec', 'lounge', 'teller']);

export function buildArchitecture(L, M) {
  const G = new GeoBuilder();
  const W = L.W, H = L.H, cell = L.cell;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : cell[y * W + x]);
  const eh = (x, y) => (x < 0 || x >= W || y < 0 || y > H ? 0 : L.eh[hIdx(L, x, y)]);
  const ev = (x, y) => (x < 0 || x > W || y < 0 || y >= H ? 0 : L.ev[vIdx(L, x, y)]);
  const room = (id) => L.rooms[id];
  const wallKey = (id) => (id >= 0 && room(id).type === 'vault' ? 'vaultWall' : 'wall');
  // side height/material for a wall face looking into cell `me` with `other` behind it
  const sideInfo = (me, other) => {
    if (me < 0) return null;
    if (me === 0) return other > 0 ? { h: FACADE_H, k: 'facade', base: false } : { h: FENCE_H, k: 'facade', base: false };
    return { h: WALL_H, k: wallKey(me), base: room(me).type !== 'vault', panel: PLAIN_CEIL.has(room(me).type) };
  };

  // vertical quad from (xa,za) to (xb,zb), facing n (auto-oriented)
  const vquad = (k, xa, za, xb, zb, y0, y1, n) => {
    const ux = xb - xa, uz = zb - za;
    if ((-uz * n[0] + ux * n[2]) < 0) { [xa, xb] = [xb, xa]; [za, zb] = [zb, za]; }
    G.quad(k, [xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], n);
  };
  const baseboard = (xa, za, xb, zb, n) => {
    const o = 0.014, bh = 0.11;
    const ox = n[0] * o, oz = n[2] * o;
    vquad('trim', xa + ox, za + oz, xb + ox, zb + oz, 0, bh, n);
    // top strip
    const p = [[xa, bh, za], [xb, bh, zb], [xb + ox, bh, zb + oz], [xa + ox, bh, za + oz]];
    const cr = (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]) - (p[1][2] - p[0][2]) * (p[2][0] - p[0][0]);
    if (cr < 0) G.quad('trim', p[0], p[1], p[2], p[3], [0, 1, 0]); else G.quad('trim', p[3], p[2], p[1], p[0], [0, 1, 0]);
  };
  const wallFace = (side, xa, za, xb, zb, n) => {
    if (!side) return;
    const rail = side.panel ? 1.035 : 0;
    if (side.panel) {
      vquad('wainscot', xa, za, xb, zb, 0, 1.008, n);
      vquad('brass', xa, za, xb, zb, 1.008, rail, n);
    }
    vquad(side.k, xa, za, xb, zb, rail, side.h, n);
    if (side.base) baseboard(xa, za, xb, zb, n);
  };

  // ---------- walls on horizontal edges ----------
  for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) {
    const v = eh(x, y); if (v !== E_WALL) continue;
    const A = at(x, y - 1), B = at(x, y);
    const z = y * T;
    const extW = eh(x - 1, y) !== E_WALL && (ev(x, y - 1) === E_WALL || ev(x, y) === E_WALL);
    const extE = eh(x + 1, y) !== E_WALL && (ev(x + 1, y - 1) === E_WALL || ev(x + 1, y) === E_WALL);
    const freeW = eh(x - 1, y) !== E_WALL && !extW, freeE = eh(x + 1, y) !== E_WALL && !extE;
    const x0 = x * T - (extW ? HT : 0), x1 = (x + 1) * T + (extE ? HT : 0);
    const sa = sideInfo(A, B), sb = sideInfo(B, A);
    wallFace(sa, x0, z - HT, x1, z - HT, [0, 0, -1]);
    wallFace(sb, x0, z + HT, x1, z + HT, [0, 0, 1]);
    const ch = Math.max(sa ? sa.h : 0, sb ? sb.h : 0); const ck = (sa && sa.k === 'facade') || (sb && sb.k === 'facade') ? 'facade' : 'wall';
    if (ch && freeW) vquad(ck, x * T, z - HT, x * T, z + HT, 0, ch, [-1, 0, 0]);
    if (ch && freeE) vquad(ck, (x + 1) * T, z - HT, (x + 1) * T, z + HT, 0, ch, [1, 0, 0]);
  }
  // ---------- walls on vertical edges ----------
  for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) {
    const v = ev(x, y); if (v !== E_WALL) continue;
    const A = at(x - 1, y), B = at(x, y);
    const xw = x * T;
    const extN = ev(x, y - 1) !== E_WALL && (eh(x - 1, y) === E_WALL || eh(x, y) === E_WALL);
    const extS = ev(x, y + 1) !== E_WALL && (eh(x - 1, y + 1) === E_WALL || eh(x, y + 1) === E_WALL);
    const freeN = ev(x, y - 1) !== E_WALL && !extN, freeS = ev(x, y + 1) !== E_WALL && !extS;
    const z0 = y * T - (extN ? HT : 0), z1 = (y + 1) * T + (extS ? HT : 0);
    const sa = sideInfo(A, B), sb = sideInfo(B, A);
    wallFace(sa, xw - HT, z0, xw - HT, z1, [-1, 0, 0]);
    wallFace(sb, xw + HT, z0, xw + HT, z1, [1, 0, 0]);
    const ch = Math.max(sa ? sa.h : 0, sb ? sb.h : 0); const ck = (sa && sa.k === 'facade') || (sb && sb.k === 'facade') ? 'facade' : 'wall';
    if (ch && freeN) vquad(ck, xw - HT, y * T, xw + HT, y * T, 0, ch, [0, 0, -1]);
    if (ch && freeS) vquad(ck, xw - HT, (y + 1) * T, xw + HT, (y + 1) * T, 0, ch, [0, 0, 1]);
  }

  // ---------- doors: headers + casings ----------
  for (const d of L.doors) {
    const dh = DOOR_H[d.kind];
    const es = d.edges;
    if (d.horiz) {
      const y = es[0].y, z = y * T;
      const xs = es.map((e) => e.x); const x0 = Math.min(...xs) * T, x1 = (Math.max(...xs) + 1) * T;
      const A = at(es[0].x, y - 1), B = at(es[0].x, y);
      const sa = sideInfo(A, B), sb = sideInfo(B, A);
      if (sa) vquad(sa.k, x0, z - HT, x1, z - HT, dh, sa.h, [0, 0, -1]);
      if (sb) vquad(sb.k, x0, z + HT, x1, z + HT, dh, sb.h, [0, 0, 1]);
      G.quad('wall', [x0, dh, z - HT], [x1, dh, z - HT], [x1, dh, z + HT], [x0, dh, z + HT], [0, -1, 0]);
      const ck = d.kind === 'vault' ? 'metal' : d.kind === 'edoor' ? 'metalDark' : 'trim';
      for (const [s, side] of [[-1, sa], [1, sb]]) {
        if (!side || (side.k === 'facade' && d.kind !== 'entry')) continue;
        const zc = z + s * (HT + 0.012);
        G.box(ck, 0.09, dh + 0.09, 0.03, mat(x0 - 0.045, 0, zc));
        G.box(ck, 0.09, dh + 0.09, 0.03, mat(x1 + 0.045, 0, zc));
        G.box(ck, x1 - x0 + 0.18, 0.09, 0.03, mat((x0 + x1) / 2, dh, zc));
      }
    } else {
      const x = es[0].x, xw = x * T;
      const ys = es.map((e) => e.y); const z0 = Math.min(...ys) * T, z1 = (Math.max(...ys) + 1) * T;
      const A = at(x - 1, es[0].y), B = at(x, es[0].y);
      const sa = sideInfo(A, B), sb = sideInfo(B, A);
      if (sa) vquad(sa.k, xw - HT, z0, xw - HT, z1, dh, sa.h, [-1, 0, 0]);
      if (sb) vquad(sb.k, xw + HT, z0, xw + HT, z1, dh, sb.h, [1, 0, 0]);
      G.quad('wall', [xw - HT, dh, z0], [xw + HT, dh, z0], [xw + HT, dh, z1], [xw - HT, dh, z1], [0, -1, 0]);
      const ck = d.kind === 'vault' ? 'metal' : d.kind === 'edoor' ? 'metalDark' : 'trim';
      for (const [s, side] of [[-1, sa], [1, sb]]) {
        if (!side || (side.k === 'facade' && d.kind !== 'entry')) continue;
        const xc = xw + s * (HT + 0.012);
        G.box(ck, 0.03, dh + 0.09, 0.09, mat(xc, 0, z0 - 0.045));
        G.box(ck, 0.03, dh + 0.09, 0.09, mat(xc, 0, z1 + 0.045));
        G.box(ck, 0.03, 0.09, z1 - z0 + 0.18, mat(xc, dh, (z0 + z1) / 2));
      }
    }
  }

  // ---------- floors + ceilings ----------
  const yard = L.rooms[0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = at(x, y); if (id < 0) continue;
    const r = room(id);
    const x0 = x * T, x1 = x0 + T, z0 = y * T, z1 = z0 + T;
    let fk;
    if (id === 0) fk = y === yard.y ? 'sidewalk' : 'asphalt';
    else fk = 'floor_' + ((ROOMS[r.type] && ROOMS[r.type].floor) || 'tile');
    G.quad(fk, [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0]);
    if (id > 0) {
      const ck = r.type === 'vault' ? 'vaultWall' : PLAIN_CEIL.has(r.type) ? 'ceilPlain' : 'ceiling';
      G.quad(ck, [x0, WALL_H, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], [x0, WALL_H, z1], [0, -1, 0]);
    }
  }
  // street beyond the fence (seen over it from the yard? no - fence is above eye height) - skip.

  // ---------- cornice on the facade ----------
  {
    const zf = yard.y * T;
    G.box('trim', (W - 2) * T + 0.4, 0.35, 0.36, mat((W / 2) * T, FACADE_H - 0.35, zf));
    G.box('trim', (W - 2) * T + 0.2, 0.12, 0.26, mat((W / 2) * T, 3.6, zf));
  }

  // ---------- light fixtures ----------
  const fixtures = [];
  for (const r of L.rooms) {
    if (r.id === 0) continue;
    for (const p of r.lights) fixtures.push({ x: p.x, z: p.z, room: r.id, kind: r.corr ? 'strip' : PLAIN_CEIL.has(r.type) ? 'disc' : 'panel' });
  }

  // ---------- yard dressing ----------
  const v = L.van;
  // parking bay lines
  for (const dx of [-3.4, 3.4]) G.box('paintLine', 0.12, 0.01, 2.8, mat(v.x + dx, 0.004, v.z));
  G.box('paintLine', 0.12, 0.01, 2.4, mat(v.x + (v.x > (W * T) / 2 ? -8 : 8), 0.004, v.z));
  // dumpster against the fence, away from the van
  const dumpX = v.x > (W * T) / 2 ? 3.2 : (W - 3) * T;
  const dz = (yard.y + yard.h) * T - 1.0;
  G.box('paint', 2.0, 1.25, 1.3, mat(dumpX, 0.12, dz));
  G.box('metalDark', 2.1, 0.08, 1.4, mat(dumpX, 1.37, dz, 0, 1, 1, 1, -0.08));
  for (const ox of [-0.8, 0.8]) G.cyl('rubber', 0.07, 0.12, 8, mat(dumpX + ox, 0, dz));
  // distant skyline
  const sky = buildSkyline(L);
  return { G, fixtures, sky };
}

function buildSkyline(L) {
  const G = new GeoBuilder();
  const cx = (L.W * T) / 2, cz = (L.H * T) / 2;
  let s = 1234567;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
    const d = 70 + rnd() * 60;
    const w = 14 + rnd() * 22, h = 18 + rnd() * 50;
    G.box('sky', w, h, 12 + rnd() * 10, mat(cx + Math.cos(a) * d, -2, cz + Math.sin(a) * d, -a + Math.PI / 2));
  }
  return G;
}

export function skylineMaterial() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#07090d'; g.fillRect(0, 0, 256, 256);
  let s = 99;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let y = 4; y < 256; y += 10) for (let x = 3; x < 256; x += 8) {
    const r = rnd();
    if (r < 0.2) { g.fillStyle = r < 0.05 ? '#9fb6d8' : r < 0.12 ? '#ffcf8a' : '#e8b06a'; g.globalAlpha = 0.35 + rnd() * 0.65; g.fillRect(x, y, 5, 6); }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 20, 1 / 20);
  return new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.75, 0.75, 0.8), fog: true });
}

export function skyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#04060b'); gr.addColorStop(0.36, '#0b1220'); gr.addColorStop(0.47, '#2a2730'); gr.addColorStop(0.5, '#3a2f2c'); gr.addColorStop(0.53, '#0c0e12'); gr.addColorStop(1, '#050608');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
