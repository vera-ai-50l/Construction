// Matte surfaces, muted tile patterns and a few small textures keep the
// geometry and pools of light legible against the night palette.
import * as THREE from 'three';
import { patchMaterial } from './lighting.js';

function mkCanvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }

// Tileable value noise
function lattice(p, seed) { const g = new Float32Array(p * p); let s = seed >>> 0 || 1; for (let i = 0; i < g.length; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; g[i] = s / 4294967296; } return g; }
function tnoise(n, p, seed, out, amp) {
  const g = lattice(p, seed);
  for (let y = 0; y < n; y++) {
    const fy = (y / n) * p, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = iy % p, y1 = (iy + 1) % p;
    for (let x = 0; x < n; x++) {
      const fx = (x / n) * p, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % p, x1 = (ix + 1) % p;
      const a = g[y0 * p + x0], b = g[y0 * p + x1], c = g[y1 * p + x0], d = g[y1 * p + x1];
      out[y * n + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
    }
  }
}
function fbm(n, p0, oct, seed, gain = 0.5) {
  const out = new Float32Array(n * n); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) { tnoise(n, p0 << o, seed + o * 101, out, amp); tot += amp; amp *= gain; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function toTex(c, srgb, rep = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(rep, rep);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function fromField(n, f) { // f(x,y,i) -> [r,g,b]
  const c = mkCanvas(n), ctx = c.getContext('2d'), img = ctx.createImageData(n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, v = f(x, y, i);
    d[i * 4] = v[0]; d[i * 4 + 1] = v[1]; d[i * 4 + 2] = v[2]; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}
const g8 = (v) => { const q = Math.max(0, Math.min(255, v * 255)); return [q, q, q]; };

function genTextures() {
  const out = {};
  const N = 128;
  const masonry = mkCanvas(128), stone = masonry.getContext('2d');
  stone.fillStyle = '#515766'; stone.fillRect(0, 0, 128, 128);
  const slabs = ['#9d9fa6', '#92949e', '#a8a8ab', '#9c9da4'];
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 ? -32 : 0;
    for (let col = 0; col < 3; col++) {
      const x = col * 64 + offset, y = row * 32;
      stone.fillStyle = slabs[(row + col % 2) % slabs.length]; stone.fillRect(x, y, 63, 31);
      stone.fillStyle = '#b4b4b8'; stone.fillRect(x, y, 63, 1);
    }
  }
  out.masonry = toTex(masonry, true);
  // plaster: soft mottling + fine grain
  { const h = fbm(N, 4, 4, 11, 0.55);
    out.plaster = toTex(fromField(N, (x, y, i) => g8(0.9 + (h[i] - 0.5) * 0.08)), true); }
  // carpet: dense fibre noise + faint diamond pattern
  { const m = fbm(N, 8, 3, 29);
    out.carpet = toTex(fromField(N, (x, y, i) => {
      const u = x / N * 8, v = y / N * 8; const dia = Math.abs(((u + v) % 1) - 0.5) < 0.04 || Math.abs((((u - v) % 1) + 1) % 1 - 0.5) < 0.04 ? 0.08 : 0;
      return g8(0.76 + (m[i] - 0.5) * 0.12 + dia); }), true); }
  // floor tile: 2x2 tiles, grout lines
  { const f = fbm(N, 8, 3, 31); const half = N / 2, gr = 2;
    out.tile = toTex(fromField(N, (x, y, i) => {
      const gx = x % half, gy = y % half; const grout = gx < gr || gy < gr;
      const tid = (x >= half ? 1 : 0) + (y >= half ? 2 : 0);
      if (grout) return g8(0.59);
      return g8(0.88 + [0.02, -0.055, 0.0, 0.025][tid] + (f[i] - 0.5) * 0.045); }), true); }
  // concrete: blotches, speckles, faint cracks
  { const h = fbm(N, 4, 4, 41, 0.6);
    out.concrete = toTex(fromField(N, (x, y, i) => g8(0.78 + (h[i] - 0.5) * 0.08)), true); }
  // asphalt
  { const h = fbm(N, 8, 3, 47);
    out.asphalt = toTex(fromField(N, (x, y, i) => g8(0.64 + (h[i] - 0.5) * 0.07)), true); }
  // diamond plate (vault floor)
  { const n = 256; const h = new Float32Array(n * n); const f = fbm(n, 8, 3, 59);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx = (x % 32) - 16, cy = (y % 32) - 16; const alt = ((Math.floor(x / 32) + Math.floor(y / 32)) & 1);
      const a = alt ? 0.785 : -0.785; const rx = cx * Math.cos(a) - cy * Math.sin(a), ry = cx * Math.sin(a) + cy * Math.cos(a);
      h[y * n + x] = Math.max(0, 1 - (rx * rx) / 100 - (ry * ry) / 6);
    }
    out.diamond = toTex(fromField(n, (x, y, i) => g8(0.66 + h[i] * 0.13 + (f[i] - 0.5) * 0.07)), true); }
  // brushed steel
  { const n = 256; const f = new Float32Array(n * n); tnoise(n, 4, 61, f, 0.3); const ln = lattice(n, 67);
    out.steel = toTex(fromField(n, (x, y, i) => g8(0.62 + (ln[y] - 0.5) * 0.12 + (f[i] - 0.15) * 0.2)), true); }
  // acoustic ceiling tiles
  { const f = fbm(N, 8, 2, 71); const half = N / 2;
    out.ceiling = toTex(fromField(N, (x, y, i) => {
      const gx = x % half, gy = y % half; const grid = gx < 6 || gy < 6;
      return grid ? g8(0.58) : g8(0.86 + (f[i] - 0.5) * 0.08); }), true); }
  // CCTV monitor wall (4 feeds) and desktop screens
  { const c = mkCanvas(256), g = c.getContext('2d');
    g.fillStyle = '#05080a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * 128 + 4, y = Math.floor(i / 2) * 128 + 4;
      const gr = g.createLinearGradient(x, y, x, y + 120); gr.addColorStop(0, '#2a3a36'); gr.addColorStop(1, '#0d1412');
      g.fillStyle = gr; g.fillRect(x, y, 120, 120);
      g.strokeStyle = '#4c6a62'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 10, y + 110); g.lineTo(x + 50, y + 60); g.lineTo(x + 110, y + 60); g.moveTo(x + 50, y + 60); g.lineTo(x + 50, y + 10); g.stroke();
      g.fillStyle = '#d0f0e0'; g.font = '10px monospace'; g.fillText('CAM 0' + (i + 1), x + 6, y + 14);
      g.fillStyle = '#e04040'; g.fillRect(x + 104, y + 6, 8, 8);
    }
    for (let y = 0; y < 256; y += 3) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 256, 1); }
    out.cctvTex = toTex(c, true); }
  { const c = mkCanvas(256), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#0d2340'); gr.addColorStop(1, '#2a1640'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 0, 256, 14);
    g.fillStyle = 'rgba(230,240,255,0.92)'; g.fillRect(30, 40, 150, 110); g.fillStyle = '#3a5a8a'; g.fillRect(30, 40, 150, 12);
    for (let i = 0; i < 7; i++) { g.fillStyle = '#9aa8bc'; g.fillRect(40, 62 + i * 11, 60 + ((i * 37) % 70), 4); }
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(210, 30 + i * 36, 26, 22); }
    out.desktopTex = toTex(c, true); }
  { const c = mkCanvas(256), g = c.getContext('2d');
    for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 64) {
      g.fillStyle = '#7f9a6c'; g.fillRect(x, y, 64, 32); g.fillStyle = '#93ae7e'; g.fillRect(x + 2, y + 2, 60, 28);
      g.fillStyle = '#e8e0c8'; g.fillRect(x + 26, y, 12, 32); g.strokeStyle = 'rgba(40,60,30,0.6)'; g.strokeRect(x + 0.5, y + 0.5, 63, 31);
    }
    out.cashTex = toTex(c, true, 1.2); }
  return out;
}

// Small helper canvases used by props
export function textCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }

export function buildMaterials(assets, theme, lighting) {
  const P = genTextures();
  const A = assets.tex;
  const std = (o) => patchMaterial(new THREE.MeshStandardMaterial(o), lighting);
  const rep = (t, k) => { if (!t) return null; const c = t.clone(); c.repeat.set(k, k); c.needsUpdate = true; return c; };
  // UVs are in metres; repeat = 1 / metres-per-tile
  const M = {};
  M.wall = std({ color: theme.wall, map: rep(P.plaster, 1 / 2.4), roughness: 0.92 });
  M.wallDark = std({ color: new THREE.Color(theme.wall).multiplyScalar(0.55), map: rep(P.plaster, 1 / 2.4), roughness: 0.85 });
  M.wainscot = std({ color: 0x354e52, roughness: 0.83 });
  M.facade = std({ color: 0xc0b9ad, map: rep(P.masonry, 1 / 3.2), roughness: 0.94 });
  M.trim = std({ color: theme.trim, roughness: 0.45, metalness: 0.0 });
  M.ceiling = std({ color: 0xd6d6d2, map: rep(P.ceiling, 1 / 1.2), roughness: 0.95 });
  M.floor_marble = std({ color: 0xe0d9ce, map: rep(A.marble_d, 1 / 3.2), roughness: 0.46 });
  M.floor_wood = std({ color: 0xcfb59a, map: rep(A.wood_d, 1 / 2.4), roughness: 0.84 });
  M.floor_carpet = std({ color: 0x5a4a48, map: rep(P.carpet, 1 / 1.6), roughness: 1 });
  M.floor_tile = std({ color: 0xdce4e4, map: rep(P.tile, 1 / 1.8), roughness: 0.83 });
  M.floor_concrete = std({ color: 0xb0aca6, map: rep(P.concrete, 1 / 4), roughness: 0.91 });
  M.floor_steel = std({ color: 0xa8acb2, map: rep(P.diamond, 1 / 1.2), roughness: 0.53, metalness: 0.62 });
  M.asphalt = std({ color: 0x4e5968, map: rep(P.asphalt, 1 / 5), roughness: 0.95 });
  M.sidewalk = std({ color: 0x9e9d97, map: rep(P.concrete, 1 / 3), roughness: 0.94 });
  M.vaultWall = std({ color: 0x8d9298, map: rep(P.steel, 1 / 1.2), roughness: 0.35, metalness: 0.9 });
  M.carpetColor = { bank: 0x51322f, museum: 0x2f3a4a, tech: 0x3b4048 };
  // props
  M.woodDark = std({ color: 0x6b4a33, map: rep(A.wood_d, 1 / 1.4), roughness: 0.5 });
  M.woodLight = std({ color: 0xc9a27c, map: rep(A.wood_d, 1 / 1.4), roughness: 0.55 });
  M.metal = std({ color: 0x9aa0a6, map: rep(P.steel, 1), roughness: 0.32, metalness: 0.9 });
  M.metalDark = std({ color: 0x2c3036, roughness: 0.45, metalness: 0.7 });
  M.paint = std({ color: 0x3f4f5e, roughness: 0.5, metalness: 0.3 });
  M.plastic = std({ color: 0x1b1d21, roughness: 0.42 });
  M.white = std({ color: 0xe8e4dc, roughness: 0.4 });
  M.stone = std({ color: 0xece6dc, map: rep(A.marble_d, 1 / 2), roughness: 0.25 });
  M.cardboard = std({ color: 0xa57d52, map: rep(P.concrete, 1 / 1.2), roughness: 0.95 });
  M.crateWood = std({ color: 0xa88458, map: rep(A.wood_d, 1 / 1.0), roughness: 0.85 });
  M.fabric = std({ color: 0x40464f, map: rep(P.carpet, 1), roughness: 1 });
  M.glass = std({ color: 0xcfe6ee, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 2.2 });
  M.gold = std({ color: 0xffc56b, roughness: 0.22, metalness: 1, normalMap: rep(A.gold_n, 1) });
  M.cash = std({ color: 0x9fbf8a, roughness: 0.85 });
  M.paper = std({ color: 0xe9e1cc, roughness: 0.9 });
  M.rubber = std({ color: 0x141414, roughness: 0.9 });
  M.vanBody = std({ color: 0x1f2a33, roughness: 0.28, metalness: 0.6 });
  M.vanGlass = std({ color: 0x0b0f14, roughness: 0.05, metalness: 0.2 });
  M.chrome = std({ color: 0xdddddd, roughness: 0.08, metalness: 1 });
  M.frame = std({ color: 0x9a7a3e, roughness: 0.35, metalness: 0.8 });
  M.canvasArt = std({ color: 0xffffff, map: A.painting1 || null, roughness: 0.7 });
  M.binder = std({ color: 0x2b4a7a, roughness: 0.6 });
  M.brass = std({ color: 0xb08d57, roughness: 0.3, metalness: 1 });
  M.cashBlock = std({ color: 0xffffff, map: P.cashTex, roughness: 0.85 });
  M.wrap = std({ color: 0xb9b2a4, roughness: 0.22, map: rep(P.concrete, 1) });
  M.vanStripe = std({ color: 0xd88a2a, roughness: 0.35, metalness: 0.3 });
  M.pcb = std({ color: 0x1d6b3a, roughness: 0.5 });
  M.pcbBox = std({ color: 0x4c5a46, roughness: 0.55, metalness: 0.35 });
  M.ribbon = std({ color: 0x8a1c1c, roughness: 0.6 });
  M.paintLine = std({ color: 0xd8d4c8, roughness: 0.7 });
  M.ceilPlain = std({ color: 0xe2ded6, map: rep(P.plaster, 1 / 2.4), roughness: 0.9 });
  // unlit / emissive
  M.ledG = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 4, 0.8) });
  M.ledB = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 6) });
  M.lampWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.3, 3.2) });
  M.cctv = new THREE.MeshBasicMaterial({ map: P.cctvTex, color: new THREE.Color(1.3, 1.3, 1.3) });
  M.fixture = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });
  M.screen = new THREE.MeshBasicMaterial({ map: P.desktopTex, color: new THREE.Color(1.1, 1.1, 1.1) });
  M.ledRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.15) });
  M.laser = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.25, 0.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  M.cone = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  M.tex = P;
  return M;
}
