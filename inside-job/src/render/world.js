// The 3D world for one job: static building + live objects driven by the Sim.
import * as THREE from 'three';
import { T, WALL_H, THEMES, LOOT } from '../core/data.js';
import { GST } from '../core/sim.js';
import { createLighting, patchMaterial } from './lighting.js';
import { buildMaterials, textCanvas } from './materials.js';
import { buildArchitecture, skylineMaterial, skyTexture, DOOR_H, HT } from './architecture.js';
import { buildFurniture, glbFurniture, lootTemplate, templateMeshes, instanceTemplate, lootMatrix, artAtlas, buildDecor, yawOfDir, geoGroup } from './props.js';
import { GeoBuilder, mat } from './geo.js';
import { drawPanel } from '../ui/panelart.js';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _c = new THREE.Color(), _v = new THREE.Vector3();

// additive cone with soft falloff (camera + flashlight beams)
function beamMaterial(color, strength) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: strength } },
    vertexShader: `varying float vT; varying vec3 vC; varying vec3 vN; varying vec3 vV;
      #include <common>
      attribute float aT;
      void main(){ vT = uv.y; vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
        #endif
        vec4 p = vec4(position,1.0);
        #ifdef USE_INSTANCING
        p = instanceMatrix * p;
        #endif
        vec4 mv = modelViewMatrix * p; vV = -mv.xyz;
        mat3 nm = mat3(modelViewMatrix);
        #ifdef USE_INSTANCING
        nm = nm * mat3(instanceMatrix);
        #endif
        vN = normalize(nm * normal);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uK; varying float vT; varying vec3 vC; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = abs(dot(normalize(vN), normalize(vV))); float a = pow(1.0 - vT, 1.6) * uK * (0.25 + 0.75 * edge);
        gl_FragColor = vec4(uColor * vC * a, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}
// flashlight cookie: hot centre, soft falloff, a faint reflector ring
function goboTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, '#f4f4f4'); gr.addColorStop(0.42, '#9a9a9a');
  gr.addColorStop(0.62, '#5a5a5a'); gr.addColorStop(0.7, '#6e6e6e'); gr.addColorStop(0.78, '#3a3a3a'); gr.addColorStop(0.98, '#000000');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// cone along +z from origin, length 1, radius 1 at the far end; uv.y = 0 at apex
function coneGeometry() {
  const g = new THREE.CylinderGeometry(1, 0.02, 1, 24, 1, true);
  g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2);
  // CylinderGeometry uv.y: 0 at bottom (radiusBottom=0.02 -> apex after flip)
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  return g;
}

export class World {
  constructor(L, assets, opts = {}) {
    this.L = L; this.assets = assets; this.opts = opts;
    const q = this.quality = opts.quality || 'medium';
    const scene = this.scene = new THREE.Scene();
    this.modelMaterials = new Map();
    const lighting = this.lighting = createLighting(L);
    this.modelMaterial = (source) => {
      if (!this.modelMaterials.has(source)) {
        this.modelMaterials.set(source, patchMaterial(source.clone(), lighting));
      }
      return this.modelMaterials.get(source);
    };
    const M = this.M = buildMaterials(assets, THEMES[L.theme], lighting);
    M.floor_carpet.color.set(M.carpetColor[L.theme]);
    M.art = patchMaterial(new THREE.MeshStandardMaterial({ map: artAtlas(), roughness: 0.6 }), lighting);
    M.sky = skylineMaterial();
    scene.environment = assets.env;
    scene.background = skyTexture();
    scene.fog = new THREE.Fog(0x141c2a, 34, 155);

    // ---------- static geometry ----------
    const { G, fixtures, sky } = buildArchitecture(L, M);
    for (const f of L.furn) buildFurniture(G, L, f);
    buildDecor(G, L);
    this.camStatic(G); this.laserStatic(G); this.panelStatic(G); this.yardStatic(G);
    const stat = geoGroup(G, M);
    const shadows = q === 'high';
    stat.traverse((o) => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); o.castShadow = shadows && !o.material.transparent; o.receiveShadow = shadows; } });
    scene.add(stat);
    scene.add(geoGroup(sky, M));
    for (const im of glbFurniture(L, assets, this.modelMaterial)) { im.castShadow = shadows; im.receiveShadow = shadows; scene.add(im); }

    this.buildFixtures(fixtures);
    this.buildLoot();
    this.buildDoors();
    this.buildCams();
    this.buildLasers();
    this.buildPanels();
    this.buildGuards();
    this.buildFx();
    this.roomFx = L.rooms.map(() => ({ target: -1, t0: -10, lv: 0 }));
    this.t = 0;
  }

  // ======================= fixtures =======================
  buildFixtures(list) {
    const geos = { panel: new THREE.BoxGeometry(0.6, 0.025, 0.6), strip: new THREE.BoxGeometry(0.16, 0.025, 1.25), disc: new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20) };
    this.fixtures = {};
    this.fixByRoom = this.L.rooms.map(() => []);
    for (const kind of Object.keys(geos)) {
      const items = list.filter((f) => f.kind === kind);
      if (!items.length) continue;
      const im = new THREE.InstancedMesh(geos[kind], new THREE.MeshBasicMaterial({ color: 0xffffff }), items.length);
      items.forEach((f, i) => {
        const r = this.L.rooms[f.room];
        const along = r.corr && r.w > r.h ? Math.PI / 2 : 0;
        im.setMatrixAt(i, mat(f.x, WALL_H - 0.012, f.z, along));
        im.setColorAt(i, _c.setRGB(0.05, 0.05, 0.05));
        this.fixByRoom[f.room].push([im, i]);
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      this.scene.add(im); this.fixtures[kind] = im;
    }
    // street lamp head
    const lamp = this.lighting.lamp;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.28), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.6, 3) }));
    head.position.set(lamp.x, lamp.y + 0.05, lamp.z); this.scene.add(head);
  }

  setFixtureRoom(i, lv) {
    const base = this.lighting.roomColor(i);
    const mx = Math.max(base[0], base[1], base[2]) || 1;
    const k = 0.04 + lv * 3.2;
    for (const [im, idx] of this.fixByRoom[i]) { im.setColorAt(idx, _c.setRGB((base[0] / mx) * k, (base[1] / mx) * k, (base[2] / mx) * k)); im.instanceColor.needsUpdate = true; }
  }

  // ======================= static extras =======================
  yardStatic(G) {
    const lamp = this.lighting.lamp;
    G.cyl('metalDark', 0.09, lamp.y + 0.1, 10, mat(lamp.x, 0, lamp.z + 0.9), { r1: 0.06 });
    G.box('metalDark', 0.08, 0.08, 0.95, mat(lamp.x, lamp.y + 0.1, lamp.z + 0.45));
    G.box('metalDark', 0.6, 0.12, 0.32, mat(lamp.x, lamp.y + 0.1, lamp.z));
    // wall lamp above entry
    const d = this.L.doors[0];
    G.box('metalDark', 0.72, 0.1, 0.22, mat(d.x, DOOR_H.entry + 0.43, d.z + 0.22));
    G.box('lampWarm', 0.64, 0.025, 0.09, mat(d.x, DOOR_H.entry + 0.417, d.z + 0.28));
    G.box('brass', 0.82, 0.35, 0.03, mat(d.x + 0.98, 1.50, d.z + HT + 0.026));
    const plate = textCanvas(256, 108, (ctx, w, h) => {
      ctx.fillStyle = '#1c2b34'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ba8b52'; ctx.fillRect(10, 12, 5, h - 24);
      ctx.fillStyle = '#ead9b7'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('SERVICE', 30, 48);
      ctx.fillStyle = '#bdc9cc'; ctx.font = '20px monospace'; ctx.fillText('01  /  ENTRY', 30, 79);
    });
    const tex = new THREE.CanvasTexture(plate); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.79, 0.32),
      new THREE.MeshBasicMaterial({ map: tex, color: 0xd2d2d2 }));
    sign.position.set(d.x + 0.98, 1.675, d.z + HT + 0.042);
    this.scene.add(sign);
  }

  camStatic(G) {
    for (const c of this.L.cams) G.box('white', 0.07, 0.16, 0.07, mat(c.x, c.h - 0.04, c.z));
  }

  laserStatic(G) {
    for (const lz of this.L.lasers) {
      const yaw = Math.atan2(lz.x2 - lz.x1, lz.z2 - lz.z1);
      const hs = lz.kind === 'hard' ? [0.3, 0.62, 0.94, 1.26, 1.58] : [0.35, 0.8, 1.25];
      lz.hs = hs;
      for (const [x, z] of [[lz.x1, lz.z1], [lz.x2, lz.z2]]) {
        G.box('metalDark', 0.1, hs[hs.length - 1] + 0.22, 0.1, mat(x, 0.08, z, yaw));
        for (const y of hs) G.box('ledRed', 0.04, 0.04, 0.11, mat(x, y - 0.02, z, yaw));
      }
    }
  }

  panelStatic(G) {
    for (const p of this.L.panels) {
      const ws = { x: p.x + p.nx * (HT - 0.07), z: p.z + p.nz * (HT - 0.07) };
      p.ws = ws;
      const yaw = yawOfDir(p.nx, p.nz);
      const dims = p.kind === 'keypad' || p.kind === 'vaultpad' ? [0.3, 0.36, 0.05] : [0.46, 0.5, 0.07];
      p.dims = dims;
      G.box(p.kind === 'fuse' ? 'pcbBox' : p.kind === 'junction' ? 'paint' : 'plastic', dims[0], dims[1], dims[2], mat(ws.x + p.nx * dims[2] / 2, p.y - dims[1] / 2, ws.z + p.nz * dims[2] / 2, yaw));
      // conduit up to the ceiling
      if (p.kind !== 'keypad' && p.kind !== 'vaultpad') G.box('metalDark', 0.05, WALL_H - p.y - dims[1] / 2, 0.05, mat(ws.x + p.nx * 0.03, p.y + dims[1] / 2, ws.z + p.nz * 0.03, yaw));
    }
  }

  // ======================= loot =======================
  buildLoot() {
    const L = this.L;
    const kinds = [...new Set(L.loot.map((it) => it.kind))];
    this.lootIM = [];       // per item: [[im, idx], ...]
    this.lootMat = [];
    for (const it of L.loot) {
      if (it.kind === 'painting') { it.x += it.nx * (HT - 0.05); it.z += it.nz * (HT - 0.05); it.nx0 = it.nx; }
      this.lootMat[it.id] = lootMatrix(it); this.lootIM[it.id] = [];
    }
    for (const k of kinds) {
      const items = L.loot.filter((it) => it.kind === k);
      const tpl = lootTemplate(k, this.assets, this.M);
      const materialFor = this.assets.models[LOOT[k].model] ? this.modelMaterial : (m) => m;
      const ims = instanceTemplate(templateMeshes(tpl, 6), items.map((it) => this.lootMat[it.id]), materialFor);
      if (materialFor !== this.modelMaterial) for (const im of ims) im.userData.part.owned = true;
      for (const im of ims) { this.scene.add(im); items.forEach((it, i) => this.lootIM[it.id].push([im, i])); }
    }
    // glints
    const n = L.loot.length;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), ph = new Float32Array(n), on = new Float32Array(n).fill(1);
    L.loot.forEach((it, i) => { pos.set([it.x + (it.kind === 'painting' ? it.nx * 0.1 : 0), it.y + (it.kind === 'painting' ? 0 : 0.18), it.z + (it.kind === 'painting' ? it.nz * 0.1 : 0)], i * 3); ph[i] = i * 1.7; });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    g.setAttribute('aOn', new THREE.BufferAttribute(on, 1));
    this.glintMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uMap: { value: this.assets.tex.spark || null }, uScale: { value: 600 } },
      vertexShader: `attribute float aPh; attribute float aOn; uniform float uT; uniform float uScale; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float tw = pow(0.5+0.5*sin(uT*2.3+aPh),6.0);
          vA = aOn * (0.25 + 0.75*tw); gl_PointSize = aOn * uScale * (0.05 + 0.09*tw) / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vec3(2.4,1.9,1.1) * t.rgb * t.a * vA, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.glints = new THREE.Points(g, this.glintMat);
    this.glints.frustumCulled = false;
    this.scene.add(this.glints);
    this.lootState = L.loot.map(() => 0);
  }

  // ======================= doors =======================
  buildDoors() {
    const L = this.L, M = this.M;
    this.doorViews = [];
    const leafGeo = (w, h, t) => { const g = new THREE.BoxGeometry(w, h, t); g.translate(w / 2, h / 2, 0); return g; };
    const swings = L.doors.filter((d) => d.kind === 'swing' || d.kind === 'entry');
    const edoors = L.doors.filter((d) => d.kind === 'edoor');
    // swing leaves (double doors)
    const nLeaves = swings.reduce((s, d) => s + 2 * d.edges.length, 0);
    const leafW = T / 2 - 0.03;
    this.leafIM = new THREE.InstancedMesh(leafGeo(leafW, DOOR_H.swing - 0.02, 0.045), M.woodDark, Math.max(1, nLeaves));
    this.handleIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 0.14), M.chrome, Math.max(1, nLeaves));
    this.winIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.6, 0.05), M.glass, Math.max(1, nLeaves));
    const entryMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x59606a, roughness: 0.5, metalness: 0.6 }), this.lighting);
    this.entryIM = new THREE.InstancedMesh(leafGeo(leafW, DOOR_H.entry - 0.02, 0.06), entryMat, 2);
    let li = 0, ei = 0;
    for (const d of swings) {
      const leaves = [];
      const x0 = d.horiz ? d.x - d.width / 2 : d.x, z0 = d.horiz ? d.z : d.z - d.width / 2;
      const x1 = d.horiz ? d.x + d.width / 2 : d.x, z1 = d.horiz ? d.z : d.z + d.width / 2;
      const yA = d.horiz ? 0 : -Math.PI / 2, yB = d.horiz ? Math.PI : Math.PI / 2;
      const sA = d.horiz ? -1 : 1;
      if (d.kind === 'entry') { leaves.push({ im: this.entryIM, i: ei++, hx: x0, hz: z0, yaw: yA, s: sA }); leaves.push({ im: this.entryIM, i: ei++, hx: x1, hz: z1, yaw: yB, s: -sA }); }
      else for (let k = 0; k < d.edges.length; k++) {
        // per edge two leaves
        const ox = d.horiz ? (k - (d.edges.length - 1) / 2) * T : 0, oz = d.horiz ? 0 : (k - (d.edges.length - 1) / 2) * T;
        const ax = d.x + ox - (d.horiz ? T / 2 : 0), az = d.z + oz - (d.horiz ? 0 : T / 2);
        const bx = d.x + ox + (d.horiz ? T / 2 : 0), bz = d.z + oz + (d.horiz ? 0 : T / 2);
        leaves.push({ im: this.leafIM, i: li++, hx: ax, hz: az, yaw: yA, s: sA, h: true });
        leaves.push({ im: this.leafIM, i: li++, hx: bx, hz: bz, yaw: yB, s: -sA, h: true });
      }
      this.doorViews[d.id] = { kind: d.kind, leaves, last: -1 };
    }
    this.leafIM.count = li; this.handleIM.count = li; this.winIM.count = li;
    for (const im of [this.leafIM, this.handleIM, this.winIM, this.entryIM]) { im.frustumCulled = false; this.scene.add(im); }
    // sliding e-doors
    const nHalves = edoors.length * 2;
    const slideMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x8b939c, roughness: 0.35, metalness: 0.75, map: M.tex.steel }), this.lighting);
    this.slideIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, DOOR_H.edoor, 0.07).translate(0, DOOR_H.edoor / 2, 0), slideMat, Math.max(1, nHalves));
    this.stripeIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.075).translate(0, 1.15, 0), patchMaterial(new THREE.MeshStandardMaterial({ color: 0xe8b420, roughness: 0.5 }), this.lighting), Math.max(1, nHalves));
    this.statusIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.07, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, edoors.length * 2));
    let hi = 0, si = 0;
    for (const d of edoors) {
      const yaw = d.horiz ? 0 : Math.PI / 2;
      const ax = d.horiz ? 1 : 0, az = d.horiz ? 0 : 1;
      this.doorViews[d.id] = { kind: 'edoor', halves: [hi, hi + 1], status: [si, si + 1], yaw, ax, az, last: -1, lastC: '' };
      hi += 2;
      const nx = d.horiz ? 0 : 1, nz = d.horiz ? 1 : 0;
      for (const s of [-1, 1]) this.statusIM.setMatrixAt(si++, mat(d.x + nx * s * (HT + 0.02), DOOR_H.edoor + 0.2, d.z + nz * s * (HT + 0.02), yaw));
    }
    this.slideIM.count = hi; this.stripeIM.count = hi; this.statusIM.count = si;
    for (const im of [this.slideIM, this.stripeIM, this.statusIM]) { im.frustumCulled = false; this.scene.add(im); }
    this.statusIM.instanceMatrix.needsUpdate = true;
    // vault door
    const vd = L.doors[L.vaultDoor];
    const vr = L.vaultRoom, nearRoom = vd.a === vr ? vd.b : vd.a;
    const nr = L.rooms[nearRoom], vroom = L.rooms[vr];
    let nx = 0, nz = 0;
    if (vd.horiz) nz = (nr.y + nr.h / 2) > (vroom.y + vroom.h / 2) ? 1 : -1; else nx = (nr.x + nr.w / 2) > (vroom.x + vroom.w / 2) ? 1 : -1;
    const grp = new THREE.Group();
    const vm = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xb5bcc4, roughness: 0.28, metalness: 0.95, map: M.tex.steel }), this.lighting);
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.42, 40), vm); slab.rotation.x = Math.PI / 2; slab.position.set(0.95, 1.32, 0.21);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.05, 8, 40), M.chrome); ring.position.set(0.95, 1.32, 0.44);
    const wheel = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16), M.chrome); hub.rotation.x = Math.PI / 2; wheel.add(hub);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.045, 0.045), M.chrome); sp.rotation.z = i * Math.PI / 3; wheel.add(sp); }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 32), M.chrome); wheel.add(rim);
    wheel.position.set(0.95, 1.32, 0.52);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), M.chrome); b.rotation.z = a; b.position.set(0.95 + Math.cos(a) * 1.22, 1.32 + Math.sin(a) * 1.22, 0.2); grp.add(b); }
    grp.add(slab, ring, wheel);
    // place: hinge at one side of the opening, on the near side of the wall
    const hingeX = vd.horiz ? vd.x - 0.95 : vd.x + nx * (HT + 0.02), hingeZ = vd.horiz ? vd.z + nz * (HT + 0.02) : vd.z - 0.95;
    const pivot = new THREE.Group(); pivot.position.set(hingeX, 0, hingeZ);
    pivot.rotation.y = vd.horiz ? (nz > 0 ? 0 : Math.PI) : (nx > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (!vd.horiz) { pivot.position.set(vd.x + nx * (HT + 0.02), 0, vd.z + (nx > 0 ? 0.95 : -0.95) * 1); }
    if (vd.horiz && nz < 0) pivot.position.x = vd.x + 0.95;
    pivot.add(grp);
    this.scene.add(pivot);
    // frame (static ring on the wall)
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 10, 44), vm);
    frame.position.set(vd.x + nx * (HT + 0.03), 1.32, vd.z + nz * (HT + 0.03));
    frame.rotation.y = vd.horiz ? 0 : Math.PI / 2;
    this.scene.add(frame);
    // timelock display
    const tc = document.createElement('canvas'); tc.width = 256; tc.height = 96;
    const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.27), new THREE.MeshBasicMaterial({ map: tt, color: new THREE.Color(1.6, 1.6, 1.6) }));
    disp.position.set(vd.x + nx * (HT + 0.02), 2.86, vd.z + nz * (HT + 0.02));
    disp.rotation.y = yawOfDir(nx, nz);
    this.scene.add(disp);
    this.vault = { pivot, wheel, nx, nz, sign: vd.horiz ? (nz > 0 ? -1 : 1) : (nx > 0 ? 1 : -1), tc, tt, last: '' };
  }

  // ======================= cameras =======================
  buildCams() {
    const L = this.L, n = L.cams.length;
    this.camN = n;
    if (!n) return;
    const bodyG = new GeoBuilder();
    bodyG.box('a', 0.16, 0.13, 0.34, mat(0, -0.065, 0.05));
    bodyG.box('a', 0.2, 0.02, 0.4, mat(0, 0.065, 0.07));
    const body = bodyG.build().get('a');
    const lensG = new THREE.CylinderGeometry(0.045, 0.05, 0.04, 14); lensG.rotateX(Math.PI / 2); lensG.translate(0, 0, 0.235);
    this.camBody = new THREE.InstancedMesh(body, this.M.white, n);
    this.camLens = new THREE.InstancedMesh(lensG, this.M.plastic, n);
    this.camLed = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 8, 6).translate(0.05, 0.02, 0.22), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    this.camCone = new THREE.InstancedMesh(coneGeometry(), beamMaterial(0xffffff, 0.05), n);
    this.camCone.frustumCulled = false;
    for (let i = 0; i < n; i++) { this.camLed.setColorAt(i, _c.setRGB(4, 0.2, 0.1)); this.camCone.setColorAt(i, _c.setRGB(1, 0.2, 0.15)); }
    for (const im of [this.camBody, this.camLens, this.camLed, this.camCone]) { im.frustumCulled = false; this.scene.add(im); }
  }

  // ======================= lasers =======================
  buildLasers() {
    const L = this.L;
    const nb = L.lasers.reduce((s, l) => s + (l.hs ? l.hs.length : 0), 0);
    this.beamN = nb;
    if (!nb) return;
    const core = new THREE.CylinderGeometry(0.006, 0.006, 1, 5); core.rotateZ(Math.PI / 2);
    const halo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6); halo.rotateZ(Math.PI / 2);
    this.beamCore = new THREE.InstancedMesh(core, this.M.laser, nb);
    this.beamHalo = new THREE.InstancedMesh(halo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.05, 0.04), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), nb);
    this.beamMats = [];
    let k = 0;
    for (const lz of L.lasers) {
      const len = Math.hypot(lz.x2 - lz.x1, lz.z2 - lz.z1);
      const yaw = Math.atan2(-(lz.z2 - lz.z1), lz.x2 - lz.x1);
      const mx = (lz.x1 + lz.x2) / 2, mz = (lz.z1 + lz.z2) / 2;
      lz.beams = [];
      for (const y of lz.hs) { const m = mat(mx, y, mz, yaw, len, 1, 1); this.beamMats[k] = m; lz.beams.push(k); k++; }
    }
    for (const im of [this.beamCore, this.beamHalo]) { im.frustumCulled = false; this.scene.add(im); }
  }

  // ======================= panels =======================
  buildPanels() {
    this.panelViews = this.L.panels.map((p) => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const screen = p.kind === 'keypad' || p.kind === 'vaultpad';
      const m = patchMaterial(new THREE.MeshStandardMaterial({ map: tex, roughness: screen ? 0.3 : 0.55, metalness: 0.1, emissive: screen ? 0xffffff : 0x000000, emissiveMap: screen ? tex : null, emissiveIntensity: screen ? 0.55 : 0 }), this.lighting);
      const [w, h, dd] = p.dims;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.01, h - 0.01), m);
      mesh.position.set(p.ws.x + p.nx * (dd + 0.002), p.y - h / 2 + h / 2, p.ws.z + p.nz * (dd + 0.002));
      mesh.position.y = p.y; // panel centre height
      mesh.rotation.y = yawOfDir(p.nx, p.nz);
      this.scene.add(mesh);
      return { c, tex, mesh, key: '' };
    });
  }

  // ======================= guards =======================
  buildGuards() {
    this.guardViews = [];
    this.spots = [];
    const nSpot = this.quality === 'low' ? 1 : this.quality === 'medium' ? 2 : 3;
    for (let i = 0; i < nSpot; i++) {
      const s = new THREE.SpotLight(0xdfe8ff, 0, 18, 0.36, 0.5, 1.4);
      this.scene.add(s, s.target); this.spots.push(s);
    }
    this.flashBeamMat = beamMaterial(0xcfdcff, 0.075);
    this.coneGeo = coneGeometry();
    for (const key of ['guard', 'guard_supervisor']) {
      const model = this.assets.models[key];
      if (!model || model.userData.height) continue;
      const box = new THREE.Box3().setFromObject(model);
      model.userData.height = Math.max(0.1, box.max.y - box.min.y);
      model.userData.base = box.min.y;
    }
    this.goboTex = goboTexture();
    for (const s of this.spots) s.map = this.goboTex;
  }

  makeGuard(g) {
    const key = this.assets.models.guard_supervisor && (g.id % 3 === 2 || g.id >= this.L.guards.length) ? 'guard_supervisor' : 'guard';
    const src = this.assets.models[key];
    const root = new THREE.Group();
    let mixer = null, acts = null;
    if (src) {
      const m = src.clone(true);
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.userData.keep = true;
        o.material = Array.isArray(o.material) ? o.material.map(this.modelMaterial) : this.modelMaterial(o.material);
        o.frustumCulled = false;
        o.castShadow = this.quality === 'high';
      });
      const scale = 1.82 / src.userData.height;
      m.scale.multiplyScalar(scale);
      m.position.y -= src.userData.base * scale;
      root.add(m);
      mixer = new THREE.AnimationMixer(m);
      const clips = this.assets.anims[key] || [];
      const get = (n) => { const c = clips.find((x) => x.name === n); if (!c) return null; const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); return a; };
      acts = { idle: get('idle'), walk: get('walk'), run: get('sprint') };
      if (acts.idle) acts.idle.setEffectiveWeight(1);
      mixer.update(g.id * 0.37);
    } else {
      root.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.2, 4, 8).translate(0, 0.9, 0), this.M.paint));
    }
    const beam = new THREE.Mesh(this.coneGeo, this.flashBeamMat);
    beam.scale.set(2.3, 2.3, 7.5); beam.position.set(0.18, 1.32, 0.25); beam.rotation.x = 0.16;
    root.add(beam);
    const ic = document.createElement('canvas'); ic.width = ic.height = 64;
    const it = new THREE.CanvasTexture(ic); it.colorSpace = THREE.SRGBColorSpace;
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: it, depthTest: false, transparent: true }));
    icon.scale.set(0.42, 0.42, 1); icon.position.y = 2.25; icon.renderOrder = 10;
    root.add(icon);
    this.scene.add(root);
    const v = { root, mixer, acts, beam, icon, ic, it, iconKey: '', w: { idle: 1, walk: 0, run: 0 } };
    this.guardViews[g.id] = v;
    return v;
  }

  drawIcon(v, st, meter) {
    const key = st + ':' + Math.round(meter * 10);
    if (key === v.iconKey) return; v.iconKey = key;
    const g = v.ic.getContext('2d'); g.clearRect(0, 0, 64, 64);
    const alert = st === GST.alert, sus = st === GST.sus || st === GST.inv || st === GST.search;
    if (!alert && !sus && meter < 0.05) { v.icon.visible = false; return; }
    v.icon.visible = true;
    const col = alert ? '#ff3b30' : '#ffc23a';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = col; g.beginPath(); g.arc(32, 32, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (alert ? 1 : Math.min(1, meter))); g.stroke();
    g.fillStyle = col; g.font = '700 34px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(alert ? '!' : '?', 32, 34);
    v.it.needsUpdate = true;
  }

  // ======================= effects =======================
  buildFx() {
    // smoke sprites
    this.smokeSprites = [];
    const sm = this.assets.tex.smoke;
    for (let i = 0; i < 64; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sm || null, transparent: true, depthWrite: false, opacity: 0, color: 0x9aa0a8 }));
      s.visible = false; this.scene.add(s); this.smokeSprites.push(s);
    }
    // EMP / decoy pulses
    this.pulses = [];
    this.pulseGeo = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
    this.decoyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), this.M.metal);
    this.decoyMesh.visible = false; this.scene.add(this.decoyMesh);
    this.seenEv = 0;
    // hacker marker
    const mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 3) }));
    const mkRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.42, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 2), transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    this.marker = new THREE.Group(); this.marker.add(mk, mkRing); mkRing.position.y = -1.2; this.marker.visible = false;
    this.scene.add(this.marker);
  }

  pulse(x, z, color, r1, dur) {
    const m = new THREE.Mesh(this.pulseGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, 0.06, z); this.scene.add(m);
    this.pulses.push({ m, t0: this.t, dur, r1 });
  }

  // ======================= per-frame update =======================
  update(sim, dt, camera, extra = {}) {
    const L = this.L;
    this.t += dt;
    const t = this.t;
    // ---- rooms / lights
    for (let i = 0; i < L.rooms.length; i++) {
      const f = this.roomFx[i];
      const target = sim.lightOn(i);
      if (target !== f.target) { if (f.target !== -1) f.t0 = t; else f.t0 = -10; f.target = target; }
      const e = t - f.t0;
      let lv;
      if (target) lv = e > 0.7 ? 1 : (Math.sin(e * 70) > 0.1 || e > 0.55 ? 1 : 0.08) * Math.min(1, 0.3 + e * 2);
      else lv = e > 0.18 ? 0 : (Math.sin(e * 90) > 0 ? 0.6 : 0.05);
      if (this.lighting.setLevel(i, lv)) this.setFixtureRoom(i, lv);
    }
    // ---- loot
    const on = this.glints.geometry.attributes.aOn;
    for (let i = 0; i < L.loot.length; i++) {
      const st = sim.loot[i] ? 1 : 0;
      if (st !== this.lootState[i]) {
        this.lootState[i] = st;
        for (const [im, idx] of this.lootIM[i]) { im.setMatrixAt(idx, st ? ZERO : _m.multiplyMatrices(this.lootMat[i], im.userData.part.m)); im.instanceMatrix.needsUpdate = true; }
        on.array[i] = st ? 0 : 1; on.needsUpdate = true;
      }
    }
    const foc = sim.focus;
    this.glintMat.uniforms.uT.value = t;
    // ---- doors
    for (const d of L.doors) {
      const v = this.doorViews[d.id], s = sim.doors[d.id];
      if (!v) continue;
      if (v.kind === 'swing' || v.kind === 'entry') {
        const key = Math.round(s.o * 200) * s.sign;
        if (key === v.last) continue; v.last = key;
        for (const lf of v.leaves) {
          const ang = lf.s * s.sign * 1.45 * s.o;
          const M = mat(lf.hx, 0.01, lf.hz, lf.yaw + ang);
          lf.im.setMatrixAt(lf.i, M); lf.im.instanceMatrix.needsUpdate = true;
          if (lf.h) {
            this.handleIM.setMatrixAt(lf.i, M.clone().multiply(mat(T / 2 - 0.12, 1.02, 0, 0))); this.handleIM.instanceMatrix.needsUpdate = true;
            this.winIM.setMatrixAt(lf.i, M.clone().multiply(mat(T / 4, 1.2, 0))); this.winIM.instanceMatrix.needsUpdate = true;
          }
        }
      } else if (v.kind === 'edoor') {
        const key = Math.round(s.o * 200);
        const lock = sim.lockdown > sim.t;
        const col = lock ? (Math.sin(t * 8) > 0 ? 'a' : 'b') : s.o > 0.5 ? 'g' : s.eopen ? 'g' : sim.zoneOn(d.ctrl) ? 'y' : 'r';
        if (key !== v.last) {
          v.last = key;
          const hw = d.width / 2;
          for (let k = 0; k < 2; k++) {
            const sg = k ? 1 : -1;
            const off = sg * (hw / 2 + s.o * hw * 0.92);
            const M = mat(d.x + v.ax * off, 0, d.z + v.az * off, v.yaw, hw, 1, 1);
            this.slideIM.setMatrixAt(v.halves[k], M); this.stripeIM.setMatrixAt(v.halves[k], M);
          }
          this.slideIM.instanceMatrix.needsUpdate = true; this.stripeIM.instanceMatrix.needsUpdate = true;
        }
        if (col !== v.lastC) {
          v.lastC = col;
          const c = col === 'g' ? [0.2, 3, 0.6] : col === 'y' ? [3, 1.8, 0.2] : col === 'a' ? [4, 0.3, 0.1] : col === 'b' ? [0.3, 0.02, 0.01] : [3, 0.15, 0.1];
          for (const si of v.status) this.statusIM.setColorAt(si, _c.setRGB(...c));
          this.statusIM.instanceColor.needsUpdate = true;
        }
      }
    }
    // vault
    {
      const vs = sim.doors[L.vaultDoor];
      this.vault.pivot.children[0].rotation.y = this.vault.sign * -1.75 * vs.o;
      if (sim.timelockActive) this.vault.wheel.rotation.z -= dt * 2.4;
      const key = Math.round(sim.timelock * 100) + ':' + (sim.vaultOpen ? 1 : 0) + ':' + (sim.timelockActive ? 1 : 0) + ':' + (sim.panels[L.vaultPad].done ? 1 : 0);
      if (key !== this.vault.last) {
        this.vault.last = key;
        const g = this.vault.tc.getContext('2d');
        g.fillStyle = '#05080a'; g.fillRect(0, 0, 256, 96);
        const pct = Math.round(sim.timelock * 100);
        const col = sim.vaultOpen ? '#3cff7a' : sim.timelockActive ? '#ffd24a' : sim.panels[L.vaultPad].done ? '#7dc8ff' : '#ff4a3a';
        g.fillStyle = col; g.font = '700 26px "Barlow Condensed", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(sim.vaultOpen ? 'TIMELOCK RELEASED' : sim.panels[L.vaultPad].done ? 'TIMELOCK ' + pct + '%' : 'SEALED', 14, 30);
        g.fillStyle = '#1a2228'; g.fillRect(14, 58, 228, 18); g.fillStyle = col; g.fillRect(14, 58, 228 * sim.timelock, 18);
        this.vault.tt.needsUpdate = true;
      }
    }
    // ---- cameras
    for (let i = 0; i < this.camN; i++) {
      const c = L.cams[i], s = sim.cams[i];
      const a = s.a;
      const yaw = Math.atan2(Math.cos(a), Math.sin(a));
      const M = mat(c.x, c.h - 0.05, c.z, yaw, 1, 1, 1, 0.42);
      this.camBody.setMatrixAt(i, M); this.camLens.setMatrixAt(i, M); this.camLed.setMatrixAt(i, M);
      const active = sim.camActive(i);
      const disabled = s.st === 2;
      const looped = s.st === 1;
      const seeing = sim.camSeeing === i;
      this.camCone.setMatrixAt(i, disabled || (!active && !looped) ? ZERO : M.clone().multiply(mat(0, 0, 0.25, 0, Math.tan(c.fov) * 5.5, Math.tan(c.fov) * 3.0, 5.5)));
      const blink = Math.sin(t * 6 + i) > 0;
      this.camLed.setColorAt(i, disabled ? _c.setRGB(0, 0, 0) : looped ? _c.setRGB(0.2, 1.2, 4) : !active ? _c.setRGB(blink ? 1 : 0, 0.6, 0) : seeing ? _c.setRGB(6, 0.3, 0.1) : blink ? _c.setRGB(4, 0.15, 0.08) : _c.setRGB(0.6, 0.03, 0.02));
      this.camCone.setColorAt(i, looped ? _c.setRGB(0.25, 0.6, 1.4) : seeing ? _c.setRGB(2.2, 0.3, 0.15) : _c.setRGB(1, 0.18, 0.12).multiplyScalar(0.6 + 0.4 * s.meter));
    }
    if (this.camN) for (const im of [this.camBody, this.camLens, this.camLed, this.camCone]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    // ---- lasers
    if (this.beamN) {
      for (let i = 0; i < L.lasers.length; i++) {
        const lz = L.lasers[i], s = sim.lasers[i];
        let vis = sim.laserOn(i);
        if (!vis && s.until > sim.t && s.until - sim.t < 1.5) vis = Math.sin(t * 40) > 0.3; // about to come back
        if (vis && sim.laserOn(i) && lz.kind === 'pulse') { // warm-up flicker at the start of each on-phase
          const per = lz.on + lz.off; const ph = ((sim.t / per + lz.ph) % 1 + 1) % 1;
          if (ph * per < 0.15) vis = Math.sin(t * 60) > 0;
        }
        for (const k of lz.beams) { this.beamCore.setMatrixAt(k, vis ? this.beamMats[k] : ZERO); this.beamHalo.setMatrixAt(k, vis ? this.beamMats[k] : ZERO); }
      }
      this.beamCore.instanceMatrix.needsUpdate = true; this.beamHalo.instanceMatrix.needsUpdate = true;
    }
    // ---- panels
    for (let i = 0; i < L.panels.length; i++) {
      const p = L.panels[i], s = sim.panels[i], v = this.panelViews[i];
      const lock = s.lock > sim.t ? Math.ceil(s.lock - sim.t) : 0;
      const key = (s.code || '') + '|' + (s.glyphs || []).join('') + '|' + (s.entry || []).length + '|' + (s.fuses ? s.fuses.map((f) => f.c + '' + f.n + (f.pulled ? 1 : 0)).join('') : '') + '|' + (s.done ? 1 : 0) + '|' + lock + '|' + (p.kind === 'junction' ? sim.zoneOn(p.zone) : 0);
      if (key === v.key) continue; v.key = key;
      const g = v.c.getContext('2d');
      g.clearRect(0, 0, 256, 256);
      drawPanel(g, 256, 256 * (p.dims[1] / p.dims[0]) > 256 ? 256 : 256, p, s, { now: sim.t, zoneOn: p.kind === 'junction' && sim.zoneOn(p.zone) });
      v.tex.needsUpdate = true;
    }
    // ---- guards
    for (const sp of this.spots) sp.intensity = 0;
    const flashers = [];
    for (const g of sim.guards) {
      const v = this.guardViews[g.id] || this.makeGuard(g);
      const ko = g.st === GST.ko;
      const yaw = Math.atan2(Math.cos(g.a + (g.lookOff || 0) * 0.6), Math.sin(g.a + (g.lookOff || 0) * 0.6));
      v.root.position.set(g.x, ko ? 0.14 : 0, g.z);
      v.root.rotation.set(ko ? -Math.PI / 2 : 0, ko ? yaw : yaw, 0, 'YXZ');
      if (v.mixer) {
        const sp = ko ? 0 : g.speed || 0;
        const want = ko ? { idle: 1, walk: 0, run: 0 } : sp < 0.15 ? { idle: 1, walk: 0, run: 0 } : sp < 2.6 ? { idle: 0, walk: 1, run: 0 } : { idle: 0, walk: 0, run: 1 };
        const k = Math.min(1, dt * 6);
        for (const n of ['idle', 'walk', 'run']) { v.w[n] += (want[n] - v.w[n]) * k; if (v.acts[n]) v.acts[n].setEffectiveWeight(v.w[n]); }
        if (v.acts.walk) v.acts.walk.timeScale = Math.max(0.6, sp / 1.45);
        if (v.acts.run) v.acts.run.timeScale = Math.max(0.7, sp / 4.2);
        v.mixer.update(dt);
      }
      const flash = sim.guardFlashOn(g);
      v.beam.visible = flash && !ko;
      if (flash && !ko) flashers.push(g);
      this.drawIcon(v, ko ? -1 : g.st, Math.min(1, g.meter));
    }
    // assign spot lights to the nearest flashing guards
    if (flashers.length && camera) {
      flashers.sort((a, b) => ((a.x - camera.position.x) ** 2 + (a.z - camera.position.z) ** 2) - ((b.x - camera.position.x) ** 2 + (b.z - camera.position.z) ** 2));
      for (let i = 0; i < Math.min(this.spots.length, flashers.length); i++) {
        const g = flashers[i], sp = this.spots[i];
        const a = g.a + (g.lookOff || 0) * 0.6;
        const fx = Math.cos(a), fz = Math.sin(a);
        sp.position.set(g.x + fx * 0.3 - fz * 0.15, 1.35, g.z + fz * 0.3 + fx * 0.15);
        sp.target.position.set(g.x + fx * 8, 0.2, g.z + fz * 8);
        sp.intensity = g.st === GST.alert ? 16 : 11;
      }
    }
    // ---- smoke
    let si = 0;
    for (const s of sim.smoke) {
      const age = sim.t - s.t0, life = s.until - s.t0;
      const fade = Math.min(1, age / 0.6) * Math.min(1, (s.until - sim.t) / 2.5);
      const grow = Math.min(1, 0.35 + age / 2.2);
      const lit = 0.25 + 0.5 * Math.min(1, this.lighting.sample(s.x, s.z));
      for (let k = 0; k < 14 && si < this.smokeSprites.length; k++, si++) {
        const sp = this.smokeSprites[si];
        const a = k * 2.399 + s.x, r = (0.25 + ((k * 0.618) % 1) * 0.75) * s.r * 0.75 * grow;
        sp.visible = true;
        sp.position.set(s.x + Math.cos(a) * r, 0.3 + ((k * 0.37) % 1) * 1.9 * grow + age * 0.03, s.z + Math.sin(a) * r);
        const sc = (1.6 + ((k * 0.41) % 1) * 1.6) * grow; sp.scale.set(sc, sc, 1);
        sp.material.opacity = 0.55 * fade; sp.material.rotation = a + age * 0.1 * (k % 2 ? 1 : -1);
        sp.material.color.setScalar(lit);
      }
      void life;
    }
    for (; si < this.smokeSprites.length; si++) this.smokeSprites[si].visible = false;
    // ---- events -> pulses
    for (const e of sim.events) {
      if (e.id <= this.seenEv) continue;
      this.seenEv = e.id;
      if (e.type === 'emp') this.pulse(e.args[0] / 10, e.args[1] / 10, new THREE.Color(0.4, 1.4, 3.5), 8.5, 0.9);
      if (e.type === 'noise' && e.args[3] === 'decoy') this.pulse(e.args[0] / 10, e.args[1] / 10, new THREE.Color(2, 1.6, 0.6), 3, 0.7);
    }
    this.pulses = this.pulses.filter((p) => {
      const k = (this.t - p.t0) / p.dur;
      if (k >= 1) { this.scene.remove(p.m); p.m.material.dispose(); return false; }
      const r = 0.3 + p.r1 * (1 - (1 - k) ** 3);
      p.m.scale.set(r, 1, r); p.m.material.opacity = (1 - k) ** 1.5;
      return true;
    });
    // ---- thrown decoy in flight
    const th = sim.thrown.find((x) => !x.done);
    if (th) {
      const k = Math.min(1, (sim.t - th.t0) / (th.at - th.t0));
      this.decoyMesh.visible = true;
      this.decoyMesh.position.set(th.x0 + (th.x - th.x0) * k, 1.4 + Math.sin(k * Math.PI) * 1.1 - k * 1.3, th.z0 + (th.z - th.z0) * k);
      this.decoyMesh.rotation.x += dt * 12;
    } else this.decoyMesh.visible = false;
    // ---- hacker marker
    if (extra.marker) {
      this.marker.visible = true;
      this.marker.position.set(extra.marker[0], 1.4 + Math.sin(t * 3) * 0.08, extra.marker[1]);
      this.marker.children[0].rotation.y = t * 1.5;
      const s = 1 + 0.15 * Math.sin(t * 4); this.marker.children[1].scale.set(s, 1, s);
    } else this.marker.visible = false;
    void foc;
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry && !o.userData.keep && (!o.userData.part || o.userData.part.owned)) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) { if (m.map && m.map.isCanvasTexture) m.map.dispose(); }
    });
    for (const m of this.modelMaterials.values()) m.dispose();
    for (const k of Object.keys(this.M)) { const m = this.M[k]; if (m && m.isMaterial) m.dispose(); }
    for (const k of Object.keys(this.M.tex || {})) this.M.tex[k].dispose();
    for (const u of ['ijCell', 'ijLight', 'ijRoom']) this.lighting.uniforms[u].value.dispose();
  }
}
