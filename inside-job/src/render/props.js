// Furniture, loot, wall art and the van. Procedural pieces are merged into the
// static GeoBuilder; GLB pieces and loot are instanced (one draw call per
// source primitive, regardless of how many copies are placed).
import * as THREE from 'three';
import { FURN, LOOT, WALL_H } from '../core/data.js';
import { RNG, hashStr } from '../core/rng.js';
import { GeoBuilder, mat } from './geo.js';
import { normalized } from './assets.js';

const NRM = [[0, 1], [-1, 0], [0, -1], [1, 0]];
export const yawOfSide = (s) => Math.atan2(NRM[s][0], NRM[s][1]);
export const yawOfDir = (dx, dz) => Math.atan2(dx, dz); // local +z -> (dx,dz)

// ---------------- procedural furniture ----------------
export function buildFurniture(G, L, f) {
  const yaw = yawOfSide(f.rot | 0);
  const F = mat(f.x, 0, f.z, yaw);
  const part = (k, sx, sy, sz, lx, ly, lz, opts) => G.box(k, sx, sy, sz, F.clone().multiply(mat(lx, ly, lz, opts && opts.yaw || 0, 1, 1, 1, opts && opts.pitch || 0)), opts);
  const cylp = (k, r, h, lx, ly, lz, seg = 12, o) => G.cyl(k, r, h, seg, F.clone().multiply(mat(lx, ly, lz)), o);
  const rng = new RNG(hashStr(L.seed + ':f' + f.id));
  const d = FURN[f.type];
  const w = d.w, dp = d.d, h = d.h;
  switch (f.type) {
    case 'desk': {
      part('woodDark', w, 0.04, dp, 0, h - 0.04, 0);
      for (const s of [-1, 1]) part('woodDark', 0.04, h - 0.04, dp - 0.02, s * (w / 2 - 0.02), 0, 0);
      part('woodDark', w - 0.08, 0.42, 0.02, 0, 0.28, -dp / 2 + 0.06);
      part('plastic', 0.56, 0.34, 0.03, 0.25, h + 0.11, -dp / 2 + 0.16);
      part('screen', 0.52, 0.3, 0.004, 0.25, h + 0.13, -dp / 2 + 0.176);
      part('plastic', 0.05, 0.13, 0.05, 0.25, h, -dp / 2 + 0.13);
      part('plastic', 0.22, 0.015, 0.16, 0.25, h, -dp / 2 + 0.14);
      part('plastic', 0.4, 0.02, 0.13, -0.45, h, 0.12);
      if (rng.chance(0.6)) part('paper', 0.22, 0.03, 0.3, -0.5, h, -0.15, { yaw: 0.3 });
      break;
    }
    case 'table': {
      part('woodLight', w, 0.05, dp, 0, h - 0.05, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) part('metalDark', 0.05, h - 0.05, 0.05, sx * (w / 2 - 0.08), 0, sz * (dp / 2 - 0.08));
      if (rng.chance(0.5)) part('paper', 0.3, 0.02, 0.22, 0.35, h, 0.2, { yaw: -0.4 });
      break;
    }
    case 'shelf': {
      for (const s of [-1, 1]) part('metalDark', 0.04, h, dp, s * (w / 2 - 0.02), 0, 0);
      part('paint', w - 0.04, h, 0.02, 0, 0, -dp / 2 + 0.01);
      const levels = [0.06, 0.58, 1.09, 1.62, 2.14];
      for (const y of levels) part('metal', w - 0.06, 0.03, dp - 0.03, 0, y, 0);
      for (const y of [0.09, 0.61, 1.12, 1.65]) {
        let x = -w / 2 + 0.08;
        while (x < w / 2 - 0.2) {
          const bw = 0.08 + rng.next() * 0.25, bh = 0.2 + rng.next() * 0.25;
          if (y === 1.12 && Math.abs(x + bw / 2) < 0.35) { x += 0.12; continue; }
          if (rng.chance(0.78)) part(rng.chance(0.5) ? 'cardboard' : rng.chance(0.5) ? 'paper' : 'binder', bw, bh, dp * (0.5 + rng.next() * 0.35), x + bw / 2, y, 0);
          x += bw + 0.02 + rng.next() * 0.05;
        }
      }
      break;
    }
    case 'cabinet': {
      part('paint', w, h, dp, 0, 0, 0);
      for (let i = 0; i < 3; i++) {
        const y = 0.06 + i * (h - 0.1) / 3;
        part('metalDark', w - 0.05, 0.012, 0.006, 0, y + (h - 0.1) / 3 - 0.01, dp / 2);
        part('chrome', 0.2, 0.025, 0.03, 0, y + (h - 0.1) / 6, dp / 2 + 0.012);
      }
      break;
    }
    case 'rack': {
      part('metalDark', w, h, dp, 0, 0, 0);
      part('plastic', w - 0.06, h - 0.12, 0.01, 0, 0.06, dp / 2 + 0.002);
      for (let i = 0; i < 9; i++) {
        const y = 0.2 + i * 0.2;
        part('metal', w - 0.14, 0.012, 0.008, 0, y + 0.08, dp / 2 + 0.007);
        for (let k = 0; k < 4; k++) if (rng.chance(0.7)) part(rng.chance(0.75) ? 'ledG' : 'ledB', 0.018, 0.012, 0.006, -w / 2 + 0.1 + k * 0.045, y, dp / 2 + 0.009);
      }
      break;
    }
    case 'counter': {
      part('woodDark', w, h - 0.05, dp, 0, 0, 0);
      part('stone', w + 0.04, 0.05, dp + 0.06, 0, h - 0.05, 0.02);
      part('trim', w + 0.02, 0.08, 0.02, 0, 0.0, dp / 2 + 0.01);
      part('glass', w - 0.1, 0.55, 0.012, 0, h, -dp / 2 + 0.12);
      break;
    }
    case 'pedestal': {
      part('white', 0.5, h - 0.03, 0.5, 0, 0, 0);
      part('stone', 0.56, 0.03, 0.56, 0, h - 0.03, 0);
      part('glass', 0.46, 0.52, 0.46, 0, h, 0, { skip: ['ny'] });
      part('brass', 0.12, 0.05, 0.005, 0, 0.75, 0.252);
      break;
    }
    case 'case': {
      part('woodDark', w, h - 0.02, dp, 0, 0, 0);
      part('metal', w + 0.02, 0.02, dp + 0.02, 0, h - 0.02, 0);
      part('glass', w - 0.04, 0.45, dp - 0.04, 0, h, 0, { skip: ['ny'] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) part('metal', 0.02, 0.45, 0.02, sx * (w / 2 - 0.03), h, sz * (dp / 2 - 0.03));
      part('metal', w - 0.02, 0.015, dp - 0.02, 0, h + 0.45, 0);
      break;
    }
    case 'crate': {
      part('crateWood', w, h, dp, 0, 0, 0);
      for (const y of [0.02, h - 0.12]) part('woodDark', w + 0.02, 0.1, dp + 0.02, 0, y, 0);
      part('woodDark', 0.1, h - 0.24, dp + 0.02, 0, 0.12, 0);
      break;
    }
    case 'crates': {
      part('crateWood', 1.2, 1.0, 1.1, 0, 0, 0);
      part('woodDark', 1.22, 0.08, 1.12, 0, 0.92, 0);
      part('cardboard', 0.66, 0.5, 0.6, -0.22 + rng.next() * 0.1, 1.0, -0.1, { yaw: rng.next() * 0.3 });
      part('cardboard', 0.5, 0.42, 0.48, 0.3, 1.0, 0.2, { yaw: -rng.next() * 0.3 });
      part('cardboard', 0.42, 0.36, 0.4, -0.15, 1.5, -0.05, { yaw: rng.next() * 0.5 });
      break;
    }
    case 'monitors': {
      part('metalDark', w, 0.04, dp, 0, 0.72, 0);
      for (const s of [-1, 1]) part('metalDark', 0.04, 0.72, dp - 0.04, s * (w / 2 - 0.03), 0, 0);
      for (const [i, x] of [-0.52, 0, 0.52].entries()) {
        const yawM = (i - 1) * -0.25;
        part('plastic', 0.5, 0.32, 0.03, x, 0.85, -0.18 + Math.abs(i - 1) * 0.06, { yaw: yawM });
        part('cctv', 0.46, 0.28, 0.004, x + Math.sin(yawM) * 0.017, 0.87, -0.18 + Math.abs(i - 1) * 0.06 + Math.cos(yawM) * 0.017, { yaw: yawM });
        part('plastic', 0.05, 0.12, 0.05, x, 0.76, -0.22);
      }
      part('plastic', 0.42, 0.02, 0.14, 0, 0.76, 0.18);
      break;
    }
    case 'pallet': {
      for (let i = 0; i < 5; i++) part('crateWood', 0.17, 0.025, dp, -w / 2 + 0.1 + i * (w - 0.2) / 4, 0.115, 0);
      for (const sx of [-1, 0, 1]) part('woodDark', 0.12, 0.09, dp, sx * (w / 2 - 0.08), 0.025, 0);
      part('crateWood', w, 0.025, dp, 0, 0, 0);
      const top = rng.chance(0.5) ? 'cashBlock' : 'wrap';
      part(top, w - 0.1, h - 0.14, dp - 0.1, 0, 0.14, 0);
      break;
    }
    case 'lockers': {
      part('paint', w, h, dp, 0, 0, 0);
      for (let i = 0; i < 3; i++) {
        const x = -w / 2 + w / 6 + i * w / 3;
        part('metalDark', 0.008, h - 0.1, 0.006, x + w / 6, 0.05, dp / 2);
        for (let v = 0; v < 4; v++) part('metalDark', w / 3 - 0.14, 0.012, 0.006, x, h - 0.25 - v * 0.04, dp / 2);
        part('chrome', 0.025, 0.12, 0.03, x + w / 6 - 0.06, 1.0, dp / 2 + 0.012);
      }
      break;
    }
    case 'bench': {
      part('woodLight', w, 0.06, dp, 0, 0.39, 0);
      for (const s of [-1, 1]) part('metalDark', 0.06, 0.39, dp - 0.08, s * (w / 2 - 0.15), 0, 0);
      break;
    }
    case 'van': buildVan(G, f); break;
    default:
  }
}

function buildVan(G, f) {
  const F = mat(f.x, 0, f.z, Math.PI / 2); // local +z = world +x (van front)
  const P = (k, sx, sy, sz, lx, ly, lz, pitch = 0) => G.box(k, sx, sy, sz, F.clone().multiply(mat(lx, ly, lz, 0, 1, 1, 1, pitch)));
  // local: x = width (2.1), z = length (front +z)
  P('vanBody', 2.06, 1.95, 4.15, 0, 0.42, -0.62);
  P('vanBody', 2.02, 1.2, 1.3, 0, 0.42, 2.0);
  P('vanBody', 1.98, 0.22, 0.7, 0, 1.36, 1.6, -0.5);
  P('vanGlass', 1.86, 0.62, 0.04, 0, 1.25, 2.38, -0.5);
  for (const s of [-1, 1]) {
    P('vanGlass', 0.02, 0.48, 0.85, s * 1.012, 1.3, 1.85);
    P('vanStripe', 0.01, 0.16, 4.1, s * 1.034, 1.15, -0.6);
    P('chrome', 0.06, 0.03, 0.12, s * 1.06, 1.35, 1.35);
  }
  P('lampWarm', 0.32, 0.14, 0.02, -0.72, 0.85, 2.66);
  P('lampWarm', 0.32, 0.14, 0.02, 0.72, 0.85, 2.66);
  P('metalDark', 1.9, 0.32, 0.04, 0, 0.5, 2.67);
  P('ledRed', 0.12, 0.3, 0.02, -0.92, 1.0, -2.71);
  P('ledRed', 0.12, 0.3, 0.02, 0.92, 1.0, -2.71);
  P('metalDark', 0.01, 1.7, 0.01, 0, 0.55, -2.705);
  P('rubber', 2.1, 0.2, 0.2, 0, 0.38, -2.72);
  P('rubber', 2.1, 0.2, 0.16, 0, 0.38, 2.68);
  // roof: rack + dish
  P('metalDark', 1.6, 0.05, 2.6, 0, 2.38, -0.9);
  G.cyl('metal', 0.36, 0.05, 16, F.clone().multiply(mat(0.3, 2.5, -1.5, 0, 1, 1, 1, -0.9)));
  G.cyl('metalDark', 0.03, 0.22, 6, F.clone().multiply(mat(0.3, 2.42, -1.5)));
  G.cyl('metalDark', 0.012, 0.9, 5, F.clone().multiply(mat(-0.6, 2.42, -2.2)));
  for (const [x, z] of [[-0.92, 1.85], [0.92, 1.85], [-0.92, -1.75], [0.92, -1.75]]) {
    G.cyl('rubber', 0.37, 0.24, 14, F.clone().multiply(mat(x + (x < 0 ? -0.12 : 0.12), 0.37, z, Math.PI / 2, 1, 1, 1, Math.PI / 2)));
    G.cyl('chrome', 0.18, 0.245, 10, F.clone().multiply(mat(x + (x < 0 ? -0.122 : 0.122), 0.37, z, Math.PI / 2, 1, 1, 1, Math.PI / 2)));
  }
}

// ---------------- instancing helpers ----------------
export function templateMeshes(group, maxPrims = 8) {
  group.updateMatrixWorld(true);
  const out = [];
  group.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) out.push({ geo: o.geometry, mat: o.material, m: o.matrixWorld.clone() }); });
  out.sort((a, b) => b.geo.attributes.position.count - a.geo.attributes.position.count);
  return out.slice(0, maxPrims);
}

export function instanceTemplate(parts, matrices, materialFor) {
  const out = [];
  const tmp = new THREE.Matrix4();
  for (const p of parts) {
    const m = Array.isArray(p.mat) ? p.mat[0] : p.mat;
    const im = new THREE.InstancedMesh(p.geo, materialFor(m), matrices.length);
    matrices.forEach((M, i) => { tmp.multiplyMatrices(M, p.m); im.setMatrixAt(i, tmp); });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.userData.part = p;
    out.push(im);
  }
  return out;
}

export function geoGroup(G, M) {
  const grp = new THREE.Group();
  for (const [k, g] of G.build()) grp.add(new THREE.Mesh(g, M[k] || M.white));
  return grp;
}

// GLB furniture: returns list of InstancedMesh
export function glbFurniture(L, assets, materialFor) {
  const byType = new Map();
  for (const f of L.furn) {
    const d = FURN[f.type];
    if (!d.model || !assets.models[d.model]) continue;
    if (!byType.has(f.type)) byType.set(f.type, []);
    const yaw = yawOfSide(f.rot | 0) + (f.type === 'cone' ? f.id * 1.3 : 0);
    byType.get(f.type).push(mat(f.x, 0, f.z, yaw));
  }
  const out = [];
  for (const [type, ms] of byType) {
    const d = FURN[type];
    const opt = type === 'plant' ? { height: d.h * 1.1 } : type === 'cone' ? { height: 0.7 } : { fitW: d.w, fitD: d.d };
    const tpl = normalized(assets.models[d.model], opt);
    out.push(...instanceTemplate(templateMeshes(tpl, 10), ms, materialFor));
  }
  return out;
}

// ---------------- loot ----------------
function procLoot(kind, M) {
  const G = new GeoBuilder();
  const B = (k, sx, sy, sz, x, y, z, yaw = 0) => G.box(k, sx, sy, sz, mat(x, y, z, yaw));
  switch (kind) {
    case 'cash':
      for (let i = 0; i < 6; i++) { const x = (i % 3 - 1) * 0.17, z = (Math.floor(i / 3) - 0.5) * 0.09, y = 0; B('cash', 0.155, 0.06, 0.07, x, y, z, (i * 0.37) % 0.2 - 0.1); B('paper', 0.03, 0.062, 0.072, x, y, z, (i * 0.37) % 0.2 - 0.1); }
      for (let i = 0; i < 3; i++) B('cash', 0.155, 0.06, 0.07, (i - 1) * 0.12, 0.06, 0, 0.3 * i);
      break;
    case 'gold':
      for (let i = 0; i < 3; i++) B('gold', 0.25, 0.07, 0.11, 0, 0, (i - 1) * 0.12);
      for (let i = 0; i < 2; i++) B('gold', 0.25, 0.07, 0.11, 0, 0.07, (i - 0.5) * 0.12, Math.PI / 2 * 0 + 0.0);
      break;
    case 'drive':
      B('plastic', 0.12, 0.025, 0.08, 0, 0, 0); B('ledB', 0.01, 0.004, 0.004, 0.04, 0.025, 0.04); B('metal', 0.03, 0.01, 0.02, -0.07, 0.008, 0);
      break;
    case 'proto':
      B('metalDark', 0.2, 0.04, 0.2, 0, 0, 0); B('pcb', 0.14, 0.01, 0.14, 0, 0.04, 0); B('gold', 0.06, 0.012, 0.06, 0, 0.05, 0); B('ledB', 0.12, 0.003, 0.003, 0, 0.051, 0.06);
      break;
    case 'bonds':
      B('paper', 0.24, 0.05, 0.32, 0, 0, 0); B('ribbon', 0.25, 0.051, 0.03, 0, 0, 0); B('paper', 0.24, 0.04, 0.32, 0.02, 0.05, 0.01, 0.15);
      break;
    case 'painting':
      B('frame', 1.12, 0.86, 0.06, 0, -0.43, 0.03); G.quad('canvasArt', [-0.5, -0.37, 0.065], [0.5, -0.37, 0.065], [0.5, 0.37, 0.065], [-0.5, 0.37, 0.065], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      break;
    default:
  }
  const grp = geoGroup(G, M);
  return grp;
}

export function lootTemplate(kind, assets, M) {
  const def = LOOT[kind];
  if (def.model && assets.models[def.model]) return normalized(assets.models[def.model], { size: def.size });
  return procLoot(kind, M);
}

// world matrix for a loot item
export function lootMatrix(it) {
  if (it.kind === 'painting') return mat(it.x + it.nx * 0.02, it.y, it.z + it.nz * 0.02, yawOfDir(it.nx, it.nz), it.primary ? 1.25 : 1, it.primary ? 1.25 : 1, 1);
  return mat(it.x, it.y, it.z, (it.id * 2.3) % (Math.PI * 2));
}

// ---------------- decor art atlas ----------------
export function artAtlas() {
  const c = document.createElement('canvas'); c.width = 768; c.height = 512;
  const g = c.getContext('2d');
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pals = [['#1c2a3a', '#c9a96e', '#e8e0d0', '#8a3b2e'], ['#20302a', '#d8c8a0', '#6e8a5a', '#2e2a26'], ['#3a1e1e', '#e0b080', '#a04030', '#f0e6d8'],
    ['#101820', '#4a7090', '#d0d8e0', '#e0a040'], ['#2a2420', '#b08860', '#e8d8c0', '#506878'], ['#181818', '#e8e8e8', '#c03028', '#305090']];
  for (let i = 0; i < 6; i++) {
    const x0 = (i % 3) * 256, y0 = Math.floor(i / 3) * 256, p = pals[i];
    g.fillStyle = p[0]; g.fillRect(x0, y0, 256, 256);
    if (i % 3 === 0) { // landscape: horizon gradient + hills
      const gr = g.createLinearGradient(0, y0, 0, y0 + 256); gr.addColorStop(0, p[0]); gr.addColorStop(0.55, p[1]); gr.addColorStop(1, p[3]);
      g.fillStyle = gr; g.fillRect(x0, y0, 256, 256);
      for (let k = 0; k < 3; k++) { g.fillStyle = [p[3], p[0], '#000'][k]; g.globalAlpha = 0.5 + k * 0.2; g.beginPath(); g.moveTo(x0, y0 + 256); for (let x = 0; x <= 256; x += 16) g.lineTo(x0 + x, y0 + 150 + k * 30 + Math.sin(x * 0.03 + k * 2 + i) * 18 + rnd() * 6); g.lineTo(x0 + 256, y0 + 256); g.fill(); }
      g.globalAlpha = 1;
    } else if (i % 3 === 1) { // abstract blocks
      for (let k = 0; k < 9; k++) { g.fillStyle = p[k % 4]; g.globalAlpha = 0.85; g.fillRect(x0 + rnd() * 200, y0 + rnd() * 200, 30 + rnd() * 120, 20 + rnd() * 110); }
      g.globalAlpha = 1; g.strokeStyle = '#111'; g.lineWidth = 6; for (let k = 0; k < 3; k++) { g.beginPath(); const xx = x0 + 40 + rnd() * 180; g.moveTo(xx, y0); g.lineTo(xx, y0 + 256); g.stroke(); }
    } else { // portrait silhouette
      const gr = g.createRadialGradient(x0 + 128, y0 + 100, 10, x0 + 128, y0 + 128, 200); gr.addColorStop(0, p[1]); gr.addColorStop(1, p[0]);
      g.fillStyle = gr; g.fillRect(x0, y0, 256, 256);
      g.fillStyle = p[3]; g.beginPath(); g.ellipse(x0 + 128, y0 + 105, 42, 54, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x0 + 128, y0 + 250, 95, 90, 0, Math.PI, 0); g.fill();
    }
    // craquelure / varnish
    g.globalAlpha = 0.08; for (let k = 0; k < 900; k++) { g.fillStyle = rnd() < 0.5 ? '#000' : '#fff'; g.fillRect(x0 + rnd() * 256, y0 + rnd() * 256, 1.5, 1.5); } g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function buildDecor(G, L) {
  for (const d of L.decor) {
    const yaw = yawOfDir(d.nx, d.nz);
    const w = 0.9 + (d.v % 3) * 0.15, h = 0.7 + ((d.v + 1) % 3) * 0.12;
    const M = mat(d.x + d.nx * 0.076, 1.62, d.z + d.nz * 0.076, yaw); // slot is 0.04 off the edge; wall face at HT
    G.box('frame', w + 0.1, h + 0.1, 0.05, M.clone().multiply(mat(0, -(h + 0.1) / 2, 0)));
    const u0 = (d.v % 3) / 3, v0 = 1 - (Math.floor(d.v / 3) + 1) / 2;
    const pts = [[-w / 2, -h / 2, 0.028], [w / 2, -h / 2, 0.028], [w / 2, h / 2, 0.028], [-w / 2, h / 2, 0.028]].map((p) => { const v = new THREE.Vector3(...p).applyMatrix4(M); return [v.x, v.y, v.z]; });
    G.quad('art', pts[0], pts[1], pts[2], pts[3], [d.nx, 0, d.nz], [[u0 + 0.01, v0 + 0.01], [u0 + 1 / 3 - 0.01, v0 + 0.01], [u0 + 1 / 3 - 0.01, v0 + 0.49], [u0 + 0.01, v0 + 0.49]]);
    // picture light
    G.box('brass', 0.4, 0.04, 0.08, M.clone().multiply(mat(0, h / 2 + 0.12, 0.06)));
  }
}

export { WALL_H };
