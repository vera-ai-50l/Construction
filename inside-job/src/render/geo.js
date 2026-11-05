// Geometry accumulator: collects quads/boxes per material key and builds one
// merged BufferGeometry per key (few draw calls for the whole building).
import * as THREE from 'three';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();

export class GeoBuilder {
  constructor() { this.g = new Map(); }
  _get(k) { let b = this.g.get(k); if (!b) { b = { p: [], n: [], uv: [], i: [] }; this.g.set(k, b); } return b; }

  // Quad given 4 world corners in CCW order seen from the front, plus a normal.
  // UVs: world-space metres projected on the dominant axis plane (seamless).
  quad(k, a, b, c, d, n, uvs) {
    const B = this._get(k), base = B.p.length / 3;
    for (const p of [a, b, c, d]) { B.p.push(p[0], p[1], p[2]); B.n.push(n[0], n[1], n[2]); }
    if (uvs) for (const u of uvs) B.uv.push(u[0], u[1]);
    else for (const p of [a, b, c, d]) { const uv = worldUV(p, n); B.uv.push(uv[0], uv[1]); }
    B.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Box of size (sx,sy,sz) centred at local origin (y from 0..sy if opts.floor), transformed by m.
  box(k, sx, sy, sz, m, opts = {}) {
    const hx = sx / 2, hz = sz / 2, y0 = opts.center ? -sy / 2 : 0, y1 = y0 + sy;
    const faces = [
      ['px', [hx, y0, hz], [hx, y0, -hz], [hx, y1, -hz], [hx, y1, hz], [1, 0, 0]],
      ['nx', [-hx, y0, -hz], [-hx, y0, hz], [-hx, y1, hz], [-hx, y1, -hz], [-1, 0, 0]],
      ['py', [-hx, y1, hz], [hx, y1, hz], [hx, y1, -hz], [-hx, y1, -hz], [0, 1, 0]],
      ['ny', [-hx, y0, -hz], [hx, y0, -hz], [hx, y0, hz], [-hx, y0, hz], [0, -1, 0]],
      ['pz', [-hx, y0, hz], [hx, y0, hz], [hx, y1, hz], [-hx, y1, hz], [0, 0, 1]],
      ['nz', [hx, y0, -hz], [-hx, y0, -hz], [-hx, y1, -hz], [hx, y1, -hz], [0, 0, -1]],
    ];
    _nm.getNormalMatrix(m);
    for (const f of faces) {
      if (opts.skip && opts.skip.includes(f[0])) continue;
      const pts = f.slice(1, 5).map((p) => { _v.set(p[0], p[1], p[2]).applyMatrix4(m); return [_v.x, _v.y, _v.z]; });
      _n.set(f[5][0], f[5][1], f[5][2]).applyMatrix3(_nm).normalize();
      this.quad(k, pts[0], pts[1], pts[2], pts[3], [_n.x, _n.y, _n.z]);
    }
  }

  // Vertical cylinder (radius r, height h) standing on local origin.
  cyl(k, r, h, seg, m, opts = {}) {
    const B = this._get(k);
    _nm.getNormalMatrix(m);
    const r1 = opts.r1 != null ? opts.r1 : r;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      const pts = [[Math.cos(a0) * r, 0, Math.sin(a0) * r], [Math.cos(a1) * r, 0, Math.sin(a1) * r], [Math.cos(a1) * r1, h, Math.sin(a1) * r1], [Math.cos(a0) * r1, h, Math.sin(a0) * r1]];
      const base = B.p.length / 3;
      const nrm = [[Math.cos(a0), 0, Math.sin(a0)], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a0), 0, Math.sin(a0)]];
      for (let j = 0; j < 4; j++) {
        _v.set(...pts[j]).applyMatrix4(m); B.p.push(_v.x, _v.y, _v.z);
        _n.set(...nrm[j]).applyMatrix3(_nm).normalize(); B.n.push(_n.x, _n.y, _n.z);
        B.uv.push((s / seg) * Math.PI * 2 * r, pts[j][1]);
      }
      B.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    if (!opts.noCap) {
      const base = B.p.length / 3;
      _v.set(0, h, 0).applyMatrix4(m); B.p.push(_v.x, _v.y, _v.z);
      _n.set(0, 1, 0).applyMatrix3(_nm).normalize(); B.n.push(_n.x, _n.y, _n.z); B.uv.push(0, 0);
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        _v.set(Math.cos(a) * r1, h, Math.sin(a) * r1).applyMatrix4(m); B.p.push(_v.x, _v.y, _v.z);
        B.n.push(_n.x, _n.y, _n.z); B.uv.push(Math.cos(a) * r1, Math.sin(a) * r1);
      }
      for (let s = 0; s < seg; s++) B.i.push(base, base + 2 + s, base + 1 + s);
    }
  }

  build() {
    const out = new Map();
    for (const [k, B] of this.g) {
      if (!B.i.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      g.setIndex(B.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(B.i, 1) : new THREE.Uint16BufferAttribute(B.i, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      out.set(k, g);
    }
    return out;
  }
}

export function worldUV(p, n) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return [p[0], p[2]];
  if (ax >= az) return [p[2] * (n[0] > 0 ? -1 : 1), p[1]];
  return [p[0] * (n[2] > 0 ? 1 : -1), p[1]];
}

// matrix helper: translate + yaw (+ optional uniform scale)
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function mat(x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0) {
  _e.set(pitch, yaw, roll, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}
