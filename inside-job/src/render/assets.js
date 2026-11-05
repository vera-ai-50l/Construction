// Asset loading: optimized GLBs (meshopt + webp), textures, HDR environment.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { supportsHDR } from './gfx.js';

export const MODEL_NAMES = ['guard', 'guard_supervisor', 'sofa_velvet', 'sofa_leather', 'chair_damask', 'chair_sheen', 'pouf', 'plant', 'watch', 'amber', 'skull',
  'camera_antique', 'vase', 'corset', 'pot', 'cone', 'lantern', 'dragon', 'lamp_barn'];
const TEX = ['wood_d', 'marble_d', 'flashlight', 'smoke', 'spark', 'painting1', 'gold_n'];

// The self-hosted build can skip base64 decoding. The artifact host serves
// the same assets through the build's text copies.
async function fetchBin(url) {
  if (document.getElementById('app')?.hasAttribute('data-standalone')) {
    const binary = await fetch(url);
    if (binary.ok) return binary.arrayBuffer();
  }
  const r = await fetch(url + '.b64.txt');
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const s = atob((await r.text()).trim());
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b.buffer;
}

let cache = null;
export function assetBase() {
  return (typeof window !== 'undefined' && window.IJ_ASSETS) || 'assets/';
}

export function loadAssets(renderer, onProgress) {
  if (cache) return cache;
  const base = assetBase();
  const manager = new THREE.LoadingManager();
  let done = 0; const total = MODEL_NAMES.length + TEX.length + 1;
  const tick = () => { done++; onProgress && onProgress(done / total); };
  const gltf = new GLTFLoader(manager); gltf.setMeshoptDecoder(MeshoptDecoder);
  const texL = new THREE.TextureLoader(manager);
  const out = { models: {}, anims: {}, tex: {}, env: null };
  const jobs = [];
  for (const n of MODEL_NAMES) jobs.push(fetchBin(base + 'models/' + n + '.glb').then((buf) => gltf.parseAsync(buf, base + 'models/')).then((g) => {
    const root = g.scene;
    const kill = [];
    root.traverse((o) => {
      // sample-scene leftovers shipped inside some GLBs (studio floor, bulb, backdrop)
      if (o.isLight || o.isCamera || /groundplane|backdrop|^bulb$/i.test(o.name)) { kill.push(o); return; }
      if (o.isMesh) {
        o.castShadow = false; o.receiveShadow = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = Math.min(m.opacity, 0.42); m.depthWrite = false; m.roughness = Math.min(m.roughness, 0.15); }
          if (m.sheen) m.sheen = 0;
          if (m.map) m.map.anisotropy = 4;
        }
      }
    });
    for (const k of kill) if (k.parent) k.parent.remove(k);
    out.models[n] = root; out.anims[n] = g.animations || [];
    tick();
  }).catch((e) => { console.warn('model failed', n, e); tick(); }));
  for (const n of TEX) jobs.push(texL.loadAsync(base + 'tex/' + n + '.webp').then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (n.endsWith('_d') || n === 'painting1' || n === 'flashlight') t.colorSpace = THREE.SRGBColorSpace;
    out.tex[n] = t; tick();
  }).catch(() => tick()));
  jobs.push((supportsHDR(renderer) ? fetchBin(base + 'env/lobby.exr').then((buf) => {
    const d = new EXRLoader().setDataType(THREE.HalfFloatType).parse(buf);
    const t = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type);
    t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false;
    if (d.colorSpace) t.colorSpace = d.colorSpace;
    t.needsUpdate = true;
    const pm = new THREE.PMREMGenerator(renderer);
    t.mapping = THREE.EquirectangularReflectionMapping;
    out.env = pm.fromEquirectangular(t).texture; t.dispose(); pm.dispose(); tick();
  }).catch(() => {
    // no HDR (blocked or failed): fall back to a procedural studio environment
    try { const pm = new THREE.PMREMGenerator(renderer); out.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch { /* lights only */ }
    tick();
  }) : Promise.resolve().then(tick)));
  cache = Promise.all(jobs).then(() => out);
  return cache;
}

// Normalize a model: centre on XZ, sit on y=0, scale so its largest XZ extent = size (or height = h).
export function normalized(src, { size, height, fitW, fitD } = {}) {
  const o = src.clone(true);
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o);
  const s = new THREE.Vector3(); b.getSize(s);
  let k = 1;
  if (fitW && fitD) k = Math.min(fitW / Math.max(s.x, 1e-6), fitD / Math.max(s.z, 1e-6));
  else if (size) k = size / Math.max(s.x, s.z, s.y * 0.6, 1e-6);
  else if (height) k = height / Math.max(s.y, 1e-6);
  const c = new THREE.Vector3(); b.getCenter(c);
  const wrap = new THREE.Group();
  o.position.set(-c.x, -b.min.y, -c.z);
  wrap.add(o);
  wrap.scale.setScalar(k);
  wrap.userData.h = s.y * k; wrap.userData.w = s.x * k; wrap.userData.d = s.z * k;
  return wrap;
}
