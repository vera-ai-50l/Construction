// Line-of-sight and collision against the edge-wall grid.
import { T } from './data.js';
import { hIdx, vIdx, E_WALL, E_DOOR } from './level.js';

// S.doorOpen(id) -> 0..1 ; S.smoke -> [{x,z,r}]
export function losBlocked(L, S, x0, z0, x1, z1, opt) {
  const W = L.W, H = L.H;
  let cx = Math.floor(x0 / T), cy = Math.floor(z0 / T);
  const ex = Math.floor(x1 / T), ey = Math.floor(z1 / T);
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const sx = dx > 0 ? 1 : -1, sy = dz > 0 ? 1 : -1;
  const adx = Math.abs(dx), adz = Math.abs(dz);
  let tMaxX = adx > 1e-9 ? (sx > 0 ? (cx + 1) * T - x0 : x0 - cx * T) / adx : Infinity;
  let tMaxY = adz > 1e-9 ? (sy > 0 ? (cy + 1) * T - z0 : z0 - cy * T) / adz : Infinity;
  const tdX = adx > 1e-9 ? T / adx : Infinity, tdY = adz > 1e-9 ? T / adz : Infinity;
  const low = opt && opt.low, noFurn = opt && opt.noFurn, lowDist = (opt && opt.lowDist) || 1.5;
  const seen = [];
  for (let iter = 0; iter < 256; iter++) {
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return true;
    if (!noFurn) {
      const fl = L.cellFurn[cy * W + cx];
      if (fl) for (const fid of fl) {
        if (seen.includes(fid)) continue; seen.push(fid);
        const f = L.furn[fid];
        if (f.cls === 'none') continue;
        if (f.cls === 'low' && !low) continue;
        const tt = rayBox(x0, z0, dx, dz, f.x - f.hx, f.z - f.hz, f.x + f.hx, f.z + f.hz);
        if (tt < 0 || tt > 1) continue;
        if (f.cls === 'tall') return true;
        if ((1 - tt) * len < lowDist) return true; // low cover close to the target
      }
    }
    if (cx === ex && cy === ey) break;
    if (tMaxX > 1 && tMaxY > 1) break;
    let v, door;
    if (tMaxX < tMaxY) {
      const i = vIdx(L, sx > 0 ? cx + 1 : cx, cy);
      v = L.ev[i]; if (v === E_DOOR) door = L.evD[i];
      cx += sx; tMaxX += tdX;
    } else {
      const i = hIdx(L, cx, sy > 0 ? cy + 1 : cy);
      v = L.eh[i]; if (v === E_DOOR) door = L.ehD[i];
      cy += sy; tMaxY += tdY;
    }
    if (v === E_WALL) return true;
    if (v === E_DOOR && S.doorOpen(door) < 0.35) return true;
  }
  if (S.smoke && S.smoke.length) for (const s of S.smoke) if (segDist(x0, z0, x1, z1, s.x, s.z) < s.r * 0.8) return true;
  return false;
}

export function rayBox(x0, z0, dx, dz, bx0, bz0, bx1, bz1) {
  let tmin = -Infinity, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (x0 < bx0 || x0 > bx1) return -1; }
  else { let a = (bx0 - x0) / dx, b = (bx1 - x0) / dx; if (a > b) [a, b] = [b, a]; tmin = Math.max(tmin, a); tmax = Math.min(tmax, b); }
  if (Math.abs(dz) < 1e-9) { if (z0 < bz0 || z0 > bz1) return -1; }
  else { let a = (bz0 - z0) / dz, b = (bz1 - z0) / dz; if (a > b) [a, b] = [b, a]; tmin = Math.max(tmin, a); tmax = Math.min(tmax, b); }
  if (tmax < Math.max(tmin, 0)) return -1;
  return tmin < 0 ? 0 : tmin;
}

export function segDist(x0, z0, x1, z1, px, pz) {
  const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - x0) * dx + (pz - z0) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x0 + t * dx - px, z0 + t * dz - pz);
}

export function segIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const d = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (Math.abs(d) < 1e-12) return false;
  const u = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / d;
  const v = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

// Solid edges near (x,z). S.doorSolid(id) -> bool
function pushSeg(p, ax, az, bx, bz, rad) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = ((p.x - ax) * dx + (p.z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx, qz = az + t * dz;
  let ox = p.x - qx, oz = p.z - qz; const d = Math.hypot(ox, oz);
  if (d >= rad) return;
  if (d < 1e-6) { ox = -dz; oz = dx; const l = Math.hypot(ox, oz); ox /= l; oz /= l; p.x = qx + ox * rad; p.z = qz + oz * rad; return; }
  p.x = qx + (ox / d) * rad; p.z = qz + (oz / d) * rad;
}

export function collide(L, S, p, r) {
  const W = L.W, H = L.H, WT = 0.09;
  for (let it = 0; it < 3; it++) {
    const cx = Math.floor(p.x / T), cy = Math.floor(p.z / T);
    for (let y = cy - 1; y <= cy + 2; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || y < 0 || x >= W || y > H) continue;
      const i = hIdx(L, x, y), v = L.eh[i];
      if (v === E_WALL || (v === E_DOOR && S.doorSolid(L.ehD[i]))) pushSeg(p, x * T, y * T, (x + 1) * T, y * T, r + WT);
    }
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 2; x++) {
      if (x < 0 || y < 0 || x > W || y >= H) continue;
      const i = vIdx(L, x, y), v = L.ev[i];
      if (v === E_WALL || (v === E_DOOR && S.doorSolid(L.evD[i]))) pushSeg(p, x * T, y * T, x * T, (y + 1) * T, r + WT);
    }
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const fl = L.cellFurn[y * W + x]; if (!fl) continue;
      for (const fid of fl) {
        const f = L.furn[fid];
        if (f.type === 'cone' || f.type === 'pouf') continue;
        const qx = Math.max(f.x - f.hx, Math.min(p.x, f.x + f.hx)), qz = Math.max(f.z - f.hz, Math.min(p.z, f.z + f.hz));
        let ox = p.x - qx, oz = p.z - qz; const d = Math.hypot(ox, oz);
        if (d >= r) continue;
        if (d < 1e-6) { // inside: push out along smallest axis
          const pxp = f.x + f.hx - p.x, pxn = p.x - (f.x - f.hx), pzp = f.z + f.hz - p.z, pzn = p.z - (f.z - f.hz);
          const m = Math.min(pxp, pxn, pzp, pzn);
          if (m === pxp) p.x = f.x + f.hx + r; else if (m === pxn) p.x = f.x - f.hx - r; else if (m === pzp) p.z = f.z + f.hz + r; else p.z = f.z - f.hz - r;
        } else { p.x = qx + (ox / d) * r; p.z = qz + (oz / d) * r; }
      }
    }
  }
  return p;
}

// Walkable straight segment for guards (used to smooth grid paths).
export function walkable(L, S, x0, z0, x1, z1) {
  return !losBlocked(L, S, x0, z0, x1, z1, { low: true, lowDist: 99 }) && !furnNear(L, x0, z0, x1, z1);
}
function furnNear(L, x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.4);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
    const c = Math.floor(z / T) * L.W + Math.floor(x / T);
    if (L.blk[c]) return true;
  }
  return false;
}

export function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
export function lerpAng(a, b, t) { return a + angDiff(b, a) * t; }
