"use client";
"use no memo"; // R3F mutates three.js objects in useFrame; keep the compiler out of it.
/* eslint-disable react-hooks/immutability */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CRANE, CRANE_H, D, FLOORS, H, MEASURE, OFFICE, STEPS, TOP, TRUCK, W, YARD, labels, stage } from "./siteWalk";
import type { Theme } from "./ui";

const HIVIS = new THREE.Color("#ff5b1f");
const START = 1.7; // scene clock starts on mount, a beat before the preloader lifts

const PALETTE = {
  dark: {
    bg: "#0a0a09", ground: "#0c0b0a", pad: "#13110e", grid: ["#2c2822", "#181612"],
    slab: "#36322c", col: "#4a453e", wall: "#2a2722", core: "#24211d",
    edge: "#f4f1ec", edgeA: 0.2, crane: "#f4f1ec", craneA: 0.32,
    body: "#9a9388", bag: "#4d4840", steel: "#7a7368", pile: "#302c26", cabin: "#2f2b26", truck: "#3d3933", cab: "#5a554d",
    glass: "#33424a", glassA: 0.72, lit: "#ffcf8a", scaffold: "#8a8277", scaffoldA: 0.42,
    sky: "#fff1e0", earth: "#0a0a09", hemi: 1.1, sun: 2.4, additive: true,
    levels: 16, dither: 0.06, grain: 0.035,
  },
  light: {
    bg: "#f1ede6", ground: "#ebe6de", pad: "#e2dcd2", grid: ["#cfc8bc", "#dcd6cc"],
    slab: "#f7f4ef", col: "#d2cbbf", wall: "#c9c1b4", core: "#bab2a5",
    edge: "#2a2620", edgeA: 0.38, crane: "#25221d", craneA: 0.62,
    body: "#3f3a33", bag: "#d8d0c2", steel: "#5f5950", pile: "#c2b8a8", cabin: "#d9d2c6", truck: "#4a453e", cab: "#ebe6de",
    glass: "#8fa3ad", glassA: 0.6, lit: "#ffb35c", scaffold: "#6b645a", scaffoldA: 0.5,
    sky: "#ffffff", earth: "#b9b0a2", hemi: 1.9, sun: 2.2, additive: false,
    levels: 9, dither: 0.11, grain: 0.05,
  },
};
type Pal = (typeof PALETTE)["dark"];

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 4);
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const scanY = (s: number) => -0.3 + s * (TOP + 0.9);

// Per-frame shared state, written by the Director before anything else reads it.
const S = { t: 0, intro: 0, c: -1, hold: 0, sweep: -99, vis: STEPS.map(() => 0), build: 0 };

// Construction schedule, as a share of the whole build (S.build, 0 to 1).
// Foundation first, then floor by floor (slab lowered in, columns rise), walls two floors behind, glass last.
const FLOOR0 = 0.1;
const FLOOR_STEP = 0.062;
const FLOOR_SPAN = 0.075;
const foundP = () => clamp01(S.build / FLOOR0);
const floorP = (i: number) => clamp01((S.build - (FLOOR0 + i * FLOOR_STEP)) / FLOOR_SPAN);
const wallP = (i: number) => clamp01((S.build - (0.2 + i * FLOOR_STEP)) / 0.06);
const glassP = (i: number) => clamp01((S.build - (0.86 + i * 0.009)) / 0.03);
const roofP = () => clamp01((S.build - (FLOOR0 + FLOORS * FLOOR_STEP)) / 0.04);
const litP = () => clamp01((S.build - 0.975) / 0.025);
/** Floors whose slab and columns are both finished. */
const floorsDone = () => {
  let n = 0;
  while (n < FLOORS && floorP(n) >= 1) n++;
  return n;
};
/** Height of the deck the crew is working on: the newest slab, or the roof once it is poured. */
const deckY = () => (roofP() > 0.5 ? TOP : Math.min(floorsDone(), FLOORS - 1) * H) + 0.045;
const building = () => S.build > 0.02 && S.build < 0.9;
const pointer = { x: 0, y: 0 };

/** Scroll → camera path, view offset, fog, and the DOM labels pinned to 3D anchors. */
function Director({ progress, scan, mobile }: { progress: MotionValue<number>; scan: MotionValue<number>; mobile: boolean }) {
  const { scene } = useThree();
  const v = useMemo(
    () => ({
      heroPos: new THREE.Vector3(),
      heroLook: new THREE.Vector3(0.8, 4.6, 0),
      seqPos: new THREE.Vector3(),
      seqLook: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      curPos: null as THREE.Vector3 | null,
      curLook: new THREE.Vector3(),
      p: new THREE.Vector3(),
      sm: { x: 0, y: 0 },
      cams: STEPS.map((s) => ({ pos: new THREE.Vector3(...s.cam.pos), look: new THREE.Vector3(...s.cam.look) })),
      anchors: STEPS.map((s) => new THREE.Vector3(...s.anchor)),
    }),
    [],
  );

  useFrame(({ clock, camera, size }, dt) => {
    const t = clock.elapsedTime;
    const { intro, c } = stage(progress.get());
    const n = STEPS.length;
    S.t = t;
    S.intro = intro;
    S.c = c;
    S.hold = scan.get() * (1 - intro); // the hold-to-scan belongs to the hero; scrolling clears it
    for (let k = 0; k < n; k++) S.vis[k] = clamp01((c - k) / 0.3) * (k === n - 1 ? 1 : clamp01((k + 1.08 - c) / 0.16));
    S.sweep = c >= 0 && c < 1.05 ? -8 + 16 * smooth((c - 0.05) / 0.85) : -99;

    // The building grows through each step, from the last step's stage to this one's.
    const ci = c < 0 ? -1 : Math.min(Math.floor(c), n - 1);
    const b0 = ci <= 0 ? 0.02 : STEPS[ci - 1].build;
    const target = ci < 0 ? 0.02 * clamp01(intro * 3) : b0 + (STEPS[ci].build - b0) * smooth(clamp01((c - ci) / 0.85));
    S.build += (target - S.build) * (1 - Math.exp(-dt * 1.8));

    const k = 1 - Math.exp(-dt * 2.5);
    v.sm.x += (pointer.x - v.sm.x) * k;
    v.sm.y += (pointer.y - v.sm.y) * k;

    // Hero: a slow orbit with pointer parallax.
    const arrive = ease((t - START + 0.8) / 3);
    const a = 0.8 + t * 0.03 + v.sm.x * 0.45;
    const r = 33 + (1 - arrive) * 10;
    v.heroPos.set(Math.sin(a) * r, 6.5 + v.sm.y * 2.6 + (1 - arrive) * 6, Math.cos(a) * r);

    // Walk: glide from the previous step's camera to this one over the first half of each step.
    const i = c < 0 ? 0 : Math.min(Math.floor(c), n - 1);
    const tr = i === 0 ? 1 : smooth((c - i) / 0.5);
    const from = v.cams[Math.max(i - 1, 0)];
    const to = v.cams[i];
    v.seqPos.lerpVectors(from.pos, to.pos, tr);
    v.seqLook.lerpVectors(from.look, to.look, tr);
    v.seqPos.sub(v.seqLook).multiplyScalar(mobile ? 1.55 : 1).add(v.seqLook);
    v.seqPos.x += Math.sin(t * 0.21) * 0.3 + v.sm.x * 0.7;
    v.seqPos.y += Math.sin(t * 0.17) * 0.15 + v.sm.y * 0.4;
    v.seqPos.z += Math.cos(t * 0.19) * 0.3;

    const b = smooth(intro);
    v.pos.lerpVectors(v.heroPos, v.seqPos, b);
    v.look.lerpVectors(v.heroLook, v.seqLook, b);
    if (!v.curPos) {
      v.curPos = v.pos.clone();
      v.curLook.copy(v.look);
    }
    const d = 1 - Math.exp(-dt * 5);
    v.curPos.lerp(v.pos, d);
    v.curLook.lerp(v.look, d);
    camera.position.copy(v.curPos);
    camera.lookAt(v.curLook);

    // Hero pushes the building right (desktop) or up (mobile); the walk brings it to centre stage.
    const cam = camera as THREE.PerspectiveCamera;
    const wide = size.width > 900;
    cam.setViewOffset(
      size.width,
      size.height,
      wide ? -size.width * 0.2 * (1 - b) : 0,
      wide ? size.height * 0.03 * (1 - b) : size.height * (0.27 - 0.15 * b),
      size.width,
      size.height,
    );
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const dist = v.curPos.distanceTo(v.curLook);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = dist * 0.85;
      fog.far = dist * 2.4;
    }

    // Labels: show once the camera has arrived at each step.
    const half = mobile ? 118 : 138;
    v.anchors.forEach((anchor, j) => {
      const L = labels[j];
      if (!L.card || !L.dot) return;
      const fin = j === 0 ? clamp01((c - 0.32) / 0.14) : clamp01((c - j - 0.42) / 0.14);
      const fout = j === n - 1 ? 1 : clamp01((j + 1 - c) / 0.1);
      const o = fin * fout;
      L.card.style.opacity = L.dot.style.opacity = o.toFixed(3);
      if (o <= 0) return;
      v.p.copy(anchor).project(camera);
      const x = (v.p.x * 0.5 + 0.5) * size.width;
      const y = (-v.p.y * 0.5 + 0.5) * size.height;
      // Card sits above its dot; when the nav is in the way it moves beside it.
      const h = L.card.offsetHeight;
      const above = y - 46 - h >= 84;
      const side = x + 24 + 2 * half < size.width - 16 ? x + 24 + half : x - 24 - half;
      const cx = Math.min(Math.max(above ? x : side, half + 16), size.width - half - 16);
      const cy = above ? y - 46 : Math.max(y + h / 2, h + 84);
      L.dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      L.card.style.transform = `translate3d(${cx}px, ${cy + (1 - o) * 16}px, 0) scale(${0.95 + 0.05 * o})`;
    });
  }, -1);
  return null;
}

/** Grain + luminance dither on the objects; the empty background only gets a whisper of grain. */
const GRAIN = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uLevels: { value: 12 },
    uDither: { value: 0.08 },
    uGrain: { value: 0.04 },
    uCell: { value: 1 },
    uBg: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uLevels, uDither, uGrain, uCell;
    uniform vec3 uBg;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float n = hash(floor(gl_FragCoord.xy / uCell) + floor(uTime * 12.0) * 17.31) - 0.5;
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      float q = floor((l + n * uDither) * uLevels + 0.5) / uLevels;
      float obj = smoothstep(0.012, 0.06, distance(c.rgb, uBg));
      vec3 col = mix(c.rgb + n * uGrain * 0.35, c.rgb + (q - l) + n * uGrain, obj);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

const srgb = (hex: string) =>
  new THREE.Vector3(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

function Post({ P }: { P: Pal }) {
  const { gl, scene, camera, size } = useThree();
  const { composer, grain } = useMemo(() => {
    const composer = new EffectComposer(gl, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());
    const grain = new ShaderPass(GRAIN);
    composer.addPass(grain);
    return { composer, grain };
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    grain.uniforms.uCell.value = Math.max(1, Math.round(gl.getPixelRatio()));
  }, [composer, grain, gl, size]);
  useEffect(() => {
    grain.uniforms.uLevels.value = P.levels;
    grain.uniforms.uDither.value = P.dither;
    grain.uniforms.uGrain.value = P.grain;
    grain.uniforms.uBg.value = srgb(P.bg);
  }, [grain, P]);
  useEffect(() => () => composer.dispose(), [composer]);

  useFrame(({ clock }, dt) => {
    grain.uniforms.uTime.value = clock.elapsedTime;
    composer.render(dt);
  }, 1);
  return null;
}

// ─── The site ────────────────────────────────────────────────────────────────

const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
  new THREE.BoxGeometry(w, h, d).translate(x, y, z);

function useTowerGeo() {
  return useMemo(() => {
    const xs = [0, 1, 2, 3].map((k) => -W / 2 + (k * W) / 3);
    const zs = [0, 1, 2].map((k) => -D / 2 + (k * D) / 2);
    const colH = H - 0.09;
    const cols: THREE.BufferGeometry[] = [];
    const rebar: number[] = [];
    xs.forEach((x) =>
      zs.forEach((z) => {
        cols.push(box(0.13, colH, 0.13, x, 0.045 + colH / 2, z));
        rebar.push(x, 0.05, z, x, H * 0.8, z);
      }),
    );
    // Brickwork up to sill height between columns: the floors below are walled, the top ones open.
    const sill = H * 0.42;
    const walls: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++)
      [-D / 2, D / 2].forEach((z) => walls.push(box(W / 3 - 0.13, sill, 0.08, xs[k] + W / 6, 0.045 + sill / 2, z)));
    for (let k = 0; k < 2; k++)
      [-W / 2, W / 2].forEach((x) => walls.push(box(0.08, sill, D / 2 - 0.13, x, 0.045 + sill / 2, zs[k] + D / 4)));
    const slab = new THREE.BoxGeometry(W + 0.14, 0.09, D + 0.14);
    // Glazing band above the sill on all four faces.
    const g0 = 0.045 + sill;
    const gh = H - 0.09 - sill;
    const glass = mergeGeometries([
      box(W - 0.05, gh, 0.025, 0, g0 + gh / 2, D / 2 + 0.03),
      box(W - 0.05, gh, 0.025, 0, g0 + gh / 2, -D / 2 - 0.03),
      box(0.025, gh, D - 0.05, W / 2 + 0.03, g0 + gh / 2, 0),
      box(0.025, gh, D - 0.05, -W / 2 - 0.03, g0 + gh / 2, 0),
    ]);
    // Mullions: thin vertical lines across the glass.
    const mull: number[] = [];
    for (let k = 1; k < 9; k++) {
      const x = -W / 2 + (k * W) / 9;
      mull.push(x, g0, D / 2 + 0.045, x, g0 + gh, D / 2 + 0.045, x, g0, -D / 2 - 0.045, x, g0 + gh, -D / 2 - 0.045);
    }
    for (let k = 1; k < 6; k++) {
      const z = -D / 2 + (k * D) / 6;
      mull.push(W / 2 + 0.045, g0, z, W / 2 + 0.045, g0 + gh, z, -W / 2 - 0.045, g0, z, -W / 2 - 0.045, g0 + gh, z);
    }
    const parapet = mergeGeometries([
      box(W + 0.14, 0.22, 0.06, 0, 0.11, D / 2 + 0.04),
      box(W + 0.14, 0.22, 0.06, 0, 0.11, -D / 2 - 0.04),
      box(0.06, 0.22, D + 0.14, W / 2 + 0.04, 0.11, 0),
      box(0.06, 0.22, D + 0.14, -W / 2 - 0.04, 0.11, 0),
      box(0.9, 0.45, 0.7, -W / 2 + 0.6, 0.225, -D / 2 + 0.55),
    ]);
    return {
      slab,
      glass,
      mullions: new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(mull, 3)),
      parapet,
      slabEdges: new THREE.EdgesGeometry(slab),
      cols: mergeGeometries(cols),
      walls: mergeGeometries(walls),
      rebar: new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(rebar, 3)),
    };
  }, []);
}
type TowerGeo = ReturnType<typeof useTowerGeo>;

function floorGlow(i: number) {
  const y = i * H;
  const hs = S.hold;
  const hold = hs > 0.001 && hs < 0.999 ? Math.max(0, 1 - Math.abs(scanY(hs) - y) / 0.7) : 0;
  const sweep = S.sweep > -50 ? Math.max(0, 1 - Math.max(0, Math.abs(S.sweep) - W / 2) / 0.9) : 0;
  const talk = i === 4 ? S.vis[1] * (0.6 + 0.4 * Math.sin(S.t * 4)) : 0;
  return Math.max(hold, sweep, talk);
}

function Tower({ P, geo }: { P: Pal; geo: TowerGeo }) {
  const core = useRef<THREE.Group>(null!);
  const found = useRef<THREE.Group>(null!);
  const roof = useRef<THREE.Group>(null!);
  const coreH = TOP - H * 0.5;
  useFrame(() => {
    // Lift core climbs a little ahead of the slabs.
    const work = Math.min(floorsDone() + 1.4, FLOORS) * H;
    const target = S.build < FLOOR0 ? 0.001 : Math.min(work / coreH, 1);
    core.current.scale.y += (Math.max(target, 0.001) - core.current.scale.y) * 0.08;
    const f = ease(foundP());
    found.current.position.y = -0.32 * (1 - f);
    found.current.visible = f > 0.001;
    const r = ease(roofP());
    roof.current.visible = r > 0.001;
    roof.current.position.y = TOP + (1 - r) * 1.6;
  });
  return (
    <group>
      {/* Raft foundation and pile caps, pushed up out of the excavation. */}
      <group ref={found}>
        <mesh position-y={-0.02} receiveShadow castShadow>
          <boxGeometry args={[W + 0.9, 0.12, D + 0.9]} />
          <meshLambertMaterial color={P.core} />
        </mesh>
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * (W / 2 + 0.2), 0.04, sz * (D / 2 + 0.2)]} castShadow>
              <boxGeometry args={[0.5, 0.12, 0.5]} />
              <meshLambertMaterial color={P.col} />
            </mesh>
          )),
        )}
      </group>
      {Array.from({ length: FLOORS }, (_, i) => (
        <Floor key={i} i={i} P={P} geo={geo} />
      ))}
      <group ref={core} position={[-W / 2 + 0.55, 0, -D / 2 + 0.5]} scale-y={0.001}>
        <mesh position-y={coreH / 2} castShadow receiveShadow>
          <boxGeometry args={[0.9, coreH, 0.85]} />
          <meshLambertMaterial color={P.core} />
        </mesh>
      </group>
      <group ref={roof}>
        <mesh geometry={geo.slab} castShadow receiveShadow>
          <meshLambertMaterial color={P.slab} />
        </mesh>
        <lineSegments geometry={geo.slabEdges}>
          <lineBasicMaterial color={P.edge} transparent opacity={P.edgeA} />
        </lineSegments>
        <mesh geometry={geo.parapet} castShadow>
          <meshLambertMaterial color={P.col} />
        </mesh>
      </group>
    </group>
  );
}

function Floor({ i, P, geo }: { i: number; P: Pal; geo: TowerGeo }) {
  const g = useRef<THREE.Group>(null!);
  const slab = useRef<THREE.Group>(null!);
  const cols = useRef<THREE.Mesh>(null!);
  const bars = useRef<THREE.LineSegments>(null!);
  const walls = useRef<THREE.Mesh>(null!);
  const glass = useRef<THREE.Group>(null!);
  const m = useMemo(
    () => ({
      slab: new THREE.MeshLambertMaterial(),
      edge: new THREE.LineBasicMaterial({ transparent: true }),
      glass: new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false }),
      mull: new THREE.LineBasicMaterial({ transparent: true }),
    }),
    [],
  );
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  // Each floor's windows light up a touch differently once the building is handed over.
  const warm = useMemo(() => 0.55 + ((i * 37) % 10) / 22, [i]);

  useFrame(() => {
    const fp = floorP(i);
    g.current.visible = fp > 0.001;
    if (!g.current.visible) return;
    // Slab is lowered into place by the crane, then the columns rise from it.
    const sp = clamp01(fp / 0.5);
    slab.current.position.y = (1 - ease(sp)) * 1.6;
    const cp = clamp01((fp - 0.45) / 0.55);
    cols.current.scale.y = Math.max(ease(cp), 0.001);
    cols.current.visible = cp > 0.001;
    bars.current.visible = fp > 0.35 && fp < 0.98 && S.build < 0.86;
    const wp = wallP(i);
    walls.current.visible = wp > 0.001;
    walls.current.scale.y = Math.max(ease(wp), 0.001);
    const gp = glassP(i);
    glass.current.visible = gp > 0.001;
    glass.current.scale.y = Math.max(ease(gp), 0.001);

    const glow = floorGlow(i);
    m.slab.color.set(P.slab);
    m.slab.emissive.copy(HIVIS).multiplyScalar(glow * 0.4);
    m.edge.color.set(P.edge).lerp(HIVIS, glow);
    m.edge.opacity = P.edgeA + glow * (1 - P.edgeA);
    const lit = litP();
    m.glass.color.set(P.glass);
    m.glass.opacity = P.glassA * gp;
    // Once handed over, floors light up and go dark at their own times: people at work inside.
    // Period of 8 s (0.785 rad/s), so the looping video of the finished site joins up cleanly.
    const busy = smooth(clamp01(0.5 + 1.6 * Math.sin(S.t * 0.785 + i * 2.4)));
    m.glass.emissive.set(P.lit).multiplyScalar(lit * warm * (0.3 + 0.7 * busy) * (P.additive ? 0.6 : 0.28));
    m.mull.color.set(P.edge);
    m.mull.opacity = P.edgeA * 1.2 * gp;
  });

  return (
    <group ref={g} position-y={i * H}>
      <group ref={slab}>
        <mesh geometry={geo.slab} material={m.slab} castShadow receiveShadow />
        <lineSegments geometry={geo.slabEdges} material={m.edge} />
      </group>
      <lineSegments ref={bars} geometry={geo.rebar}>
        <lineBasicMaterial color={HIVIS} />
      </lineSegments>
      <mesh ref={cols} geometry={geo.cols} castShadow receiveShadow>
        <meshLambertMaterial color={P.col} />
      </mesh>
      <mesh ref={walls} geometry={geo.walls} castShadow receiveShadow>
        <meshLambertMaterial color={P.wall} />
      </mesh>
      <group ref={glass}>
        <mesh geometry={geo.glass} material={m.glass} />
        <lineSegments geometry={geo.mullions} material={m.mull} />
      </group>
    </group>
  );
}

/** The plan: every floor still to be built, drawn as a faint outline that fills in as the work arrives. */
function Ghosts({ geo }: { geo: TowerGeo }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const mats = useMemo(
    () => Array.from({ length: FLOORS + 1 }, () => new THREE.LineBasicMaterial({ color: HIVIS, transparent: true, opacity: 0 })),
    [],
  );
  const outline = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.14, TOP, D + 0.14)), []);
  useFrame(() => {
    const show = clamp01((S.intro - 0.2) / 0.5) + (S.c >= 0 ? 1 : 0);
    mats.forEach((mat, j) => {
      const left = j < FLOORS ? 1 - floorP(j) : 1 - roofP();
      mat.opacity = Math.min(show, 1) * left * 0.13;
      const g = refs.current[j];
      if (g) g.visible = mat.opacity > 0.003;
    });
  });
  return (
    <>
      <lineSegments geometry={outline} material={mats[FLOORS]} position-y={TOP / 2} />
      {mats.map((mat, j) => (
        <group key={j} ref={(el) => void (refs.current[j] = el)} position-y={j * H}>
          <lineSegments geometry={geo.slabEdges} material={mat} />
        </group>
      ))}
    </>
  );
}

/** Scaffold that climbs with the work: two storeys of tube around the floor being built. */
function Scaffold({ P }: { P: Pal }) {
  const g = useRef<THREE.Group>(null!);
  const { geo, mat } = useMemo(() => {
    const pts: number[] = [];
    const o = 0.32;
    const x0 = -W / 2 - o, x1 = W / 2 + o, z0 = -D / 2 - o, z1 = D / 2 + o;
    const hgt = 2 * H;
    const ring = (y: number) =>
      pts.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
    for (let k = 0; k <= 4; k++) ring((k * hgt) / 4);
    const nx = 9, nz = 6;
    for (let k = 0; k <= nx; k++) {
      const x = x0 + ((x1 - x0) * k) / nx;
      pts.push(x, 0, z0, x, hgt, z0, x, 0, z1, x, hgt, z1);
      if (k < nx) {
        const xn = x0 + ((x1 - x0) * (k + 1)) / nx;
        pts.push(x, 0, z1, xn, hgt / 2, z1, x, hgt / 2, z0, xn, hgt, z0);
      }
    }
    for (let k = 0; k <= nz; k++) {
      const z = z0 + ((z1 - z0) * k) / nz;
      pts.push(x0, 0, z, x0, hgt, z, x1, 0, z, x1, hgt, z);
    }
    return {
      geo: new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)),
      mat: new THREE.LineBasicMaterial({ transparent: true, opacity: 0 }),
    };
  }, []);
  useFrame(() => {
    const on = clamp01((S.build - FLOOR0) / 0.05) * (1 - clamp01((S.build - 0.84) / 0.05));
    mat.color.set(P.scaffold);
    mat.opacity = on * P.scaffoldA;
    g.current.visible = on > 0.01;
    const top = Math.min(floorsDone() + 1, FLOORS) * H;
    const y = Math.max(top - 2 * H, 0);
    g.current.position.y += (y - g.current.position.y) * 0.05;
  });
  return (
    <group ref={g}>
      <lineSegments geometry={geo} material={mat} />
    </group>
  );
}

/** Welding and grinding at the columns of the floor being built. */
function Sparks() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const N = 7;
  const mats = useMemo(
    () =>
      Array.from({ length: N }, () => {
        const m = new THREE.MeshBasicMaterial({ color: "#ffb36b", transparent: true, opacity: 0, depthWrite: false });
        m.blending = THREE.AdditiveBlending;
        return m;
      }),
    [],
  );
  const geo = useMemo(() => new THREE.SphereGeometry(0.035, 8, 8), []);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    [0, 1, 2, 3].forEach((k) => [-D / 2, 0, D / 2].forEach((z) => out.push([-W / 2 + (k * W) / 3, z])));
    return out;
  }, []);
  useFrame(() => {
    const on = building() && S.build > FLOOR0 ? 1 : 0;
    const y = Math.min(floorsDone(), FLOORS - 1) * H + H * 0.55;
    for (let k = 0; k < N; k++) {
      const mesh = refs.current[k];
      if (!mesh) continue;
      const slot = Math.floor(S.t * 2.2 + k * 1.37);
      const [x, z] = spots[(slot * 7 + k * 5) % spots.length];
      const flick = Math.max(0, Math.sin(S.t * (23 + k * 3) + k)) * Math.max(0, Math.sin(S.t * 1.9 + k * 2.1));
      mats[k].opacity = on * flick;
      mesh.position.set(x + Math.sin(S.t * 31 + k) * 0.05, y + Math.cos(S.t * 27 + k) * 0.06, z);
      mesh.scale.setScalar(0.6 + flick);
    }
  });
  return (
    <>
      {mats.map((m, k) => (
        <mesh key={k} ref={(el) => void (refs.current[k] = el)} geometry={geo} material={m} />
      ))}
    </>
  );
}

/** Measurement marks for the running bill: floor heights up the corner, the bay along the base. */
function Measure() {
  const vert = useRef<THREE.Group>(null!);
  const horiz = useRef<THREE.Group>(null!);
  const { mat, vGeo, hGeo } = useMemo(() => {
    const v: number[] = [0, 0, 0, 0, 4 * H, 0];
    for (let f = 0; f <= 4; f++) v.push(-0.14, f * H, 0, 0.14, f * H, 0);
    const h: number[] = [-W / 2, 0, 0, W / 2, 0, 0, -W / 2, 0, -0.14, -W / 2, 0, 0.14, W / 2, 0, -0.14, W / 2, 0, 0.14];
    const geo = (pts: number[]) => new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return { mat: new THREE.LineBasicMaterial({ color: HIVIS, transparent: true, opacity: 0 }), vGeo: geo(v), hGeo: geo(h) };
  }, []);
  useFrame(() => {
    const s = smooth(S.vis[4] * 1.3);
    mat.opacity = s;
    vert.current.scale.y = Math.max(s, 0.001);
    horiz.current.scale.x = Math.max(s, 0.001);
  });
  return (
    <>
      <group ref={vert} position={[MEASURE[0], 0.05, MEASURE[2]]}>
        <lineSegments geometry={vGeo} material={mat} />
      </group>
      <group ref={horiz} position={[0, 0.06, MEASURE[2]]}>
        <lineSegments geometry={hGeo} material={mat} />
      </group>
    </>
  );
}

// Leak hotspots: tower [x, floor, z] and yard points.
const LEAKS: [number, number, number][] = [
  [1.3, 2, 0.9],
  [-1.5, 4, -0.7],
  [0.5, 6, 1.15],
  [-0.9, 1, 1.2],
  [1.6, 8, -1.0],
  [-1.7, 5, 0.4],
];
const YARD_LEAKS: [number, number, number][] = [
  [YARD[0] + 1.15, 0.55, YARD[2]],
  [YARD[0] - 0.2, 0.75, YARD[2] - 1.35],
];

function Leaks({ P }: { P: Pal }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const pts = useMemo(() => [...LEAKS.map(([x, f, z]) => [x, f * H + 0.12, z] as const), ...YARD_LEAKS], []);
  const geo = useMemo(() => ({ core: new THREE.SphereGeometry(0.07, 16, 16), halo: new THREE.SphereGeometry(0.2, 20, 20) }), []);
  const mats = useMemo(
    () =>
      pts.map(() => ({
        core: new THREE.MeshBasicMaterial({ color: HIVIS, transparent: true, opacity: 0 }),
        halo: new THREE.MeshBasicMaterial({ color: HIVIS, transparent: true, opacity: 0, depthWrite: false }),
      })),
    [pts],
  );
  useEffect(() => {
    mats.forEach((m) => {
      m.halo.blending = P.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.halo.needsUpdate = true;
    });
  }, [mats, P]);

  useFrame(() => {
    const t = S.t;
    const y = scanY(S.hold);
    pts.forEach(([x, py], k) => {
      const yard = k >= LEAKS.length;
      const hold = !yard && S.hold > 0 && y >= py ? 1 : 0;
      // Step 1's sweep reveals the tower leaks; step 3 lights them all, yard included.
      const swept = !yard && S.c >= 0 && S.c < 1.2 && S.sweep > x ? 1 - S.vis[1] : 0;
      const built = yard || floorP(LEAKS[k][1]) >= 1 ? 1 : 0;
      const hit = Math.max(hold, swept, S.vis[2]) * built;
      const idle = yard ? 0 : ease((t - START - 2 - k * 0.2) / 1) * 0.4 * (1 - S.intro);
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + k * 1.7);
      mats[k].core.opacity = Math.max(idle * pulse * built, hit);
      mats[k].halo.opacity = hit * (0.1 + 0.12 * pulse) * (P.additive ? 1 : 0.9) + idle * 0.06 * pulse * built;
      refs.current[k]?.scale.setScalar(1 + hit * (yard ? 0.7 : 0.4) * pulse);
    });
  });

  return (
    <>
      {pts.map(([x, y, z], k) => (
        <group key={k} ref={(el) => void (refs.current[k] = el)} position={[x, y, z]}>
          <mesh geometry={geo.core} material={mats[k].core} />
          <mesh geometry={geo.halo} material={mats[k].halo} />
        </group>
      ))}
    </>
  );
}

function ScanPlanes({ P }: { P: Pal }) {
  const hold = useRef<THREE.Group>(null!);
  const sweep = useRef<THREE.Group>(null!);
  const r = useMemo(() => {
    const floor = new THREE.PlaneGeometry(W + 1.8, D + 1.8);
    const wall = new THREE.PlaneGeometry(8.5, TOP + 1.6);
    const fill = () =>
      new THREE.MeshBasicMaterial({ color: HIVIS, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    return {
      floor,
      floorEdges: new THREE.EdgesGeometry(floor),
      wall,
      wallEdges: new THREE.EdgesGeometry(wall),
      fills: [fill(), fill()],
      line: new THREE.LineBasicMaterial({ color: HIVIS, transparent: true, opacity: 0 }),
      wline: new THREE.LineBasicMaterial({ color: HIVIS, transparent: true, opacity: 0 }),
    };
  }, []);
  useEffect(() => {
    r.fills.forEach((f) => {
      f.blending = P.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      f.needsUpdate = true;
    });
  }, [r, P]);

  useFrame(() => {
    const s = S.hold;
    const on = s > 0.001 && s < 0.999 ? 1 : 0;
    hold.current.position.y = scanY(s);
    r.fills[0].opacity = on * (P.additive ? 0.14 : 0.12);
    r.line.opacity = on;
    const sw = S.sweep > -50 ? clamp01((8 - Math.abs(S.sweep)) / 1.5) : 0;
    sweep.current.position.x = S.sweep;
    r.fills[1].opacity = sw * (P.additive ? 0.06 : 0.07);
    r.wline.opacity = sw;
  });

  return (
    <>
      <group ref={hold} rotation-x={-Math.PI / 2}>
        <mesh geometry={r.floor} material={r.fills[0]} />
        <lineSegments geometry={r.floorEdges} material={r.line} />
      </group>
      <group ref={sweep} position={[0, (TOP + 1.6) / 2 - 0.05, 0.2]} rotation-y={Math.PI / 2}>
        <mesh geometry={r.wall} material={r.fills[1]} />
        <lineSegments geometry={r.wallEdges} material={r.wline} />
      </group>
    </>
  );
}

/** Square lattice (crane mast/jib) along an axis, as line-segment positions. */
function lattice(len: number, w: number, axis: "x" | "y") {
  const pts: number[] = [];
  const n = Math.ceil(len / (w * 1.1));
  const h = w / 2;
  const P = (a: number, u: number, v: number) => (axis === "y" ? [u, a, v] : [a, u, v]);
  const c = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  c.forEach(([u, v]) => pts.push(...P(0, u, v), ...P(len, u, v)));
  for (let i = 0; i <= n; i++) {
    const a0 = (i * len) / n;
    const a1 = ((i + 1) * len) / n;
    for (let k = 0; k < 4; k++) {
      const [u0, v0] = c[k];
      const [u1, v1] = c[(k + 1) % 4];
      pts.push(...P(a0, u0, v0), ...P(a0, u1, v1));
      if (i < n) pts.push(...(i % 2 ? [...P(a0, u1, v1), ...P(a1, u0, v0)] : [...P(a0, u0, v0), ...P(a1, u1, v1)]));
    }
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}

// Where the crane works, as slew angle and trolley distance from the mast.
const angleTo = (x: number, z: number) => {
  const dx = x - CRANE[0];
  const dz = z - CRANE[2];
  return { a: Math.atan2(dz, -dx), d: Math.hypot(dx, dz) };
};
const PICK = angleTo(TRUCK[0] + 0.15, TRUCK[2] - 0.1);
const DROP = angleTo(0.4, 0.3);
const CYCLE = 10; // seconds per lift
const phase = (u: number, a: number, b: number) => smooth((u - a) / (b - a));

function Crane({ P }: { P: Pal }) {
  const jibL = 6.4;
  const slew = useRef<THREE.Group>(null!);
  const trolley = useRef<THREE.Group>(null!);
  const rope = useRef<THREE.Group>(null!);
  const load = useRef<THREE.Mesh>(null!);
  const hookBlock = useRef<THREE.Mesh>(null!);
  const parts = useMemo(() => {
    const ties = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 1.4, 0, -jibL, 0.15, 0, 0, 1.4, 0, 2.2, 0.15, 0], 3),
    );
    const hook = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, -1, 0], 3));
    return {
      mast: lattice(CRANE_H, 0.38, "y"),
      head: lattice(1.4, 0.3, "y"),
      jib: lattice(jibL, 0.3, "x"),
      counter: lattice(2.2, 0.3, "x"),
      ties,
      hook,
      line: new THREE.LineBasicMaterial({ transparent: true, opacity: 0 }),
    };
  }, []);
  const st = useRef({ a: 0.6, d: 3.9, L: 1.2 });

  useFrame((_, dt) => {
    const t = S.t;
    parts.line.color.set(P.crane);
    parts.line.opacity = ease((t - START - 0.9) / 1.6) * P.craneA;

    // One lift: slew to the truck, lower, hook on, lift, slew to the deck, lower, unhook, raise.
    const u = (((t - 2) % CYCLE) + CYCLE) % CYCLE / CYCLE;
    const high = 1.2;
    const toTruck = CRANE_H - 1.15;
    const toDeck = Math.max(CRANE_H - deckY() - 0.5, high);
    let a: number, d: number, L: number, carry: boolean;
    if (u < 0.25) {
      const k = phase(u, 0, 0.25);
      a = DROP.a + (PICK.a - DROP.a) * k;
      d = DROP.d + (PICK.d - DROP.d) * k;
      L = high;
      carry = false;
    } else if (u < 0.45) {
      a = PICK.a;
      d = PICK.d;
      L = u < 0.35 ? high + (toTruck - high) * phase(u, 0.25, 0.35) : toTruck + (high - toTruck) * phase(u, 0.35, 0.45);
      carry = u >= 0.35;
    } else if (u < 0.7) {
      const k = phase(u, 0.45, 0.7);
      a = PICK.a + (DROP.a - PICK.a) * k;
      d = PICK.d + (DROP.d - PICK.d) * k;
      L = high;
      carry = true;
    } else {
      a = DROP.a;
      d = DROP.d;
      L = u < 0.8 ? high + (toDeck - high) * phase(u, 0.7, 0.8) : u < 0.9 ? toDeck + (high - toDeck) * phase(u, 0.8, 0.9) : high;
      carry = u < 0.8;
    }
    if (!building()) {
      // Frame finished: the crane parks and idles.
      a = 0.55 + Math.sin(t * 0.11) * 0.25;
      d = 3.9 + Math.sin(t * 0.27) * 0.6;
      L = high;
      carry = false;
    }
    const k = 1 - Math.exp(-dt * 6);
    st.current.a += (a - st.current.a) * k;
    st.current.d += (d - st.current.d) * k;
    st.current.L += (L - st.current.L) * k;
    slew.current.rotation.y = st.current.a;
    trolley.current.position.x = -st.current.d;
    rope.current.scale.y = st.current.L;
    hookBlock.current.position.y = -st.current.L - 0.05;
    load.current.position.y = -st.current.L - 0.22;
    load.current.visible = carry;
  });

  return (
    <group position={CRANE}>
      <lineSegments geometry={parts.mast} material={parts.line} />
      <group ref={slew} position={[0, CRANE_H, 0]}>
        <lineSegments geometry={parts.head} material={parts.line} />
        <group rotation-y={Math.PI}>
          <lineSegments geometry={parts.jib} material={parts.line} />
        </group>
        <lineSegments geometry={parts.counter} material={parts.line} />
        <lineSegments geometry={parts.ties} material={parts.line} />
        <mesh position={[1.9, -0.32, 0]} castShadow>
          <boxGeometry args={[0.6, 0.45, 0.45]} />
          <meshLambertMaterial color={P.truck} />
        </mesh>
        <group ref={trolley}>
          <mesh position-y={-0.12}>
            <boxGeometry args={[0.32, 0.1, 0.3]} />
            <meshLambertMaterial color={P.truck} />
          </mesh>
          <group ref={rope}>
            <lineSegments geometry={parts.hook} material={parts.line} />
          </group>
          <mesh ref={hookBlock}>
            <boxGeometry args={[0.14, 0.12, 0.14]} />
            <meshLambertMaterial color={HIVIS} />
          </mesh>
          {/* The load: a bundle of steel or a slab panel. */}
          <mesh ref={load} castShadow>
            <boxGeometry args={[0.9, 0.16, 0.45]} />
            <meshLambertMaterial color={P.steel} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Cement bags, a steel bundle and an aggregate pile. The orange outline is the stock that never arrived. */
function Yard({ P }: { P: Pal }) {
  const bags = useRef<THREE.InstancedMesh>(null!);
  const bars = useRef<THREE.InstancedMesh>(null!);
  const gap = useRef<THREE.LineBasicMaterial>(null!);
  const walker = useRef<THREE.Group>(null!);
  const layout = useMemo(() => {
    const b: THREE.Vector3[] = [];
    [
      [5, 3],
      [4, 3],
      [3, 2],
      [2, 1],
    ].forEach(([nx, nz], ly) => {
      for (let x = 0; x < nx; x++)
        for (let z = 0; z < nz; z++) b.push(new THREE.Vector3((x - (nx - 1) / 2) * 0.36, 0.06 + ly * 0.115, (z - (nz - 1) / 2) * 0.24));
    });
    const s: THREE.Vector3[] = [];
    for (let k = 0; k < 16; k++) s.push(new THREE.Vector3(0, 0.04 + Math.floor(k / 8) * 0.07, (k % 8) * 0.075 - 0.26));
    return { b, s, gapBox: new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.36, 0.72)) };
  }, []);

  useEffect(() => {
    const o = new THREE.Object3D();
    layout.b.forEach((p, i) => {
      o.position.copy(p);
      o.rotation.set(0, (i % 3) * 0.04 - 0.04, 0);
      o.updateMatrix();
      bags.current.setMatrixAt(i, o.matrix);
    });
    bags.current.instanceMatrix.needsUpdate = true;
    o.rotation.set(0, 0, Math.PI / 2);
    layout.s.forEach((p, i) => {
      o.position.copy(p);
      o.updateMatrix();
      bars.current.setMatrixAt(i, o.matrix);
    });
    bars.current.instanceMatrix.needsUpdate = true;
  }, [layout]);

  useFrame(() => {
    gap.current.opacity = smooth(S.vis[2] * 1.4) * (0.55 + 0.45 * Math.sin(S.t * 5));
    walker.current.position.x = Math.sin(S.t * 0.35) * 1.3;
    walker.current.rotation.y = Math.cos(S.t * 0.35) > 0 ? Math.PI / 2 : -Math.PI / 2;
  });

  return (
    <group position={YARD}>
      <instancedMesh ref={bags} args={[undefined, undefined, layout.b.length]} castShadow receiveShadow>
        <boxGeometry args={[0.33, 0.11, 0.22]} />
        <meshLambertMaterial color={P.bag} />
      </instancedMesh>
      <lineSegments geometry={layout.gapBox} position={[1.15, 0.18, 0]}>
        <lineBasicMaterial ref={gap} color={HIVIS} transparent opacity={0} />
      </lineSegments>
      <instancedMesh ref={bars} args={[undefined, undefined, layout.s.length]} position={[0, 0, -1.35]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.6, 6]} />
        <meshLambertMaterial color={P.steel} />
      </instancedMesh>
      <mesh position={[2.3, 0.3, -1.4]} castShadow receiveShadow>
        <coneGeometry args={[0.85, 0.6, 28]} />
        <meshLambertMaterial color={P.pile} />
      </mesh>
      <group ref={walker} position={[0, 0, 0.9]}>
        <Worker P={P} />
      </group>
    </group>
  );
}

function Worker({ P }: { P: Pal }) {
  return (
    <group>
      <mesh position={[0, 0.17, 0]} castShadow>
        <capsuleGeometry args={[0.075, 0.17, 4, 8]} />
        <meshLambertMaterial color={P.body} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <sphereGeometry args={[0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshLambertMaterial color={HIVIS} />
      </mesh>
    </group>
  );
}

// Supervisors and crew; the first stands on the 4th floor and sends the voice note.
// [x, floor, z]: floor is a storey index, -1 for the ground, or "deck" for the newest slab.
const CREW: [number, number | "deck", number][] = [
  [1.25, 4, 1.05],
  [-1.0, "deck", 0.8],
  [0.7, "deck", -0.5],
  [2.9, -1, 1.9],
  [OFFICE[0] + 1.3, -1, OFFICE[2] + 0.9],
  [TRUCK[0] - 1.2, -1, TRUCK[2] + 0.6],
  [-0.4, 6, -0.9],
];

/** Each supervisor pings in when the 8 AM summary is being built. */
function Crew({ P }: { P: Pal }) {
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const people = useRef<(THREE.Group | null)[]>([]);
  const mats = useMemo(() => CREW.map(() => new THREE.MeshBasicMaterial({ color: HIVIS, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })), []);
  useFrame(() => {
    CREW.forEach(([x, f, z], k) => {
      const g = people.current[k];
      if (g) {
        if (f === "deck") {
          // Deck crew walk the newest slab while there is work on it.
          g.visible = S.build > FLOOR0 + 0.04;
          g.position.set(x + Math.sin(S.t * 0.5 + k * 2) * 0.9, deckY(), z + Math.cos(S.t * 0.37 + k) * 0.25);
          g.rotation.y = Math.cos(S.t * 0.5 + k * 2) > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          g.visible = f < 0 || floorP(f) >= 1;
          g.position.set(x, f < 0 ? 0 : f * H + 0.045, z);
        }
      }
      const ph = (S.t * 0.55 + k * 0.17) % 1;
      const ring = rings.current[k];
      if (ring) ring.scale.setScalar(1 + ph * 4);
      mats[k].opacity = S.vis[3] * (1 - ph) * 0.9;
    });
  });
  return (
    <>
      {CREW.map((_, k) => (
        <group key={k} ref={(el) => void (people.current[k] = el)} rotation-y={k * 1.3}>
          <Worker P={P} />
          <mesh ref={(el) => void (rings.current[k] = el)} rotation-x={-Math.PI / 2} position-y={0.02} material={mats[k]}>
            <ringGeometry args={[0.13, 0.16, 32]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Office({ P }: { P: Pal }) {
  const win = useRef<THREE.MeshLambertMaterial>(null!);
  useFrame(() => {
    const sw = S.sweep > -50 ? Math.max(0, 1 - Math.abs(S.sweep - OFFICE[0]) / 1.4) : 0;
    const read = S.vis[0] * (0.5 + 0.5 * Math.sin(S.t * 6));
    win.current.emissive.copy(HIVIS).multiplyScalar(Math.max(sw, read * 0.6, P.additive ? 0.25 : 0));
  });
  return (
    <group position={OFFICE}>
      <mesh position={[0, 0.39, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.78, 1]} />
        <meshLambertMaterial color={P.cabin} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[2.32, 0.05, 1.12]} />
        <meshLambertMaterial color={P.truck} />
      </mesh>
      <mesh position={[0.2, 0.48, 0.505]}>
        <boxGeometry args={[1.2, 0.22, 0.02]} />
        <meshLambertMaterial ref={win} color={P.truck} />
      </mesh>
      <mesh position={[-0.75, 0.33, 0.505]}>
        <boxGeometry args={[0.3, 0.56, 0.02]} />
        <meshLambertMaterial color={P.truck} />
      </mesh>
    </group>
  );
}

const TRUCK_CYCLE = 20;
const TRUCK_DIR = new THREE.Vector3(Math.cos(0.5), 0, -Math.sin(0.5));

function Truck({ P }: { P: Pal }) {
  const g = useRef<THREE.Group>(null!);
  const wheels = useRef<(THREE.Mesh | null)[]>([]);
  const prev = useRef(0);
  useFrame(() => {
    const u = ((S.t % TRUCK_CYCLE) + TRUCK_CYCLE) % TRUCK_CYCLE;
    // In over 3 s, parked for the crane, out over 3 s; parked for good once the frame is up.
    let off = 0;
    if (building()) {
      if (u < 3) off = 16 * Math.pow(1 - u / 3, 3);
      else if (u > 17) off = -16 * Math.pow((u - 17) / 3, 3);
    }
    g.current.position.set(TRUCK[0] + TRUCK_DIR.x * off, 0, TRUCK[2] + TRUCK_DIR.z * off);
    const roll = off - prev.current;
    prev.current = off;
    wheels.current.forEach((w) => w && (w.rotation.y -= roll / 0.18));
  });
  return (
    <group ref={g} position={TRUCK}>
      <group rotation-y={0.5}>
        <mesh position={[0, 0.28, 0]} castShadow>
          <boxGeometry args={[2.6, 0.12, 0.7]} />
          <meshLambertMaterial color={P.truck} />
        </mesh>
        <mesh position={[-0.3, 0.58, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.9, 0.48, 0.86]} />
          <meshLambertMaterial color={P.cabin} />
        </mesh>
        <mesh position={[0.98, 0.64, 0]} castShadow>
          <boxGeometry args={[0.64, 0.6, 0.86]} />
          <meshLambertMaterial color={P.cab} />
        </mesh>
        <mesh position={[-0.3, 0.86, 0]} castShadow>
          <boxGeometry args={[1.6, 0.1, 0.6]} />
          <meshLambertMaterial color={HIVIS} />
        </mesh>
        {[-0.9, -0.3, 0.95].map((x, xi) =>
          [-0.36, 0.36].map((z, zi) => (
            <group key={`${x}${z}`} position={[x, 0.18, z]} rotation-x={Math.PI / 2}>
              <mesh ref={(el) => void (wheels.current[xi * 2 + zi] = el)}>
                <cylinderGeometry args={[0.18, 0.18, 0.12, 14]} />
                <meshLambertMaterial color={P.truck} />
              </mesh>
            </group>
          )),
        )}
      </group>
    </group>
  );
}

function Ground({ P }: { P: Pal }) {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(60, 60, P.grid[0], P.grid[1]);
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = 0.7;
    return g;
  }, [P]);
  const plot = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(17.5, 11.5)), []);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshLambertMaterial color={P.ground} />
      </mesh>
      <primitive object={grid} position-y={-0.005} />
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[17.5, 0.04, 11.5]} />
        <meshLambertMaterial color={P.pad} />
      </mesh>
      <lineSegments geometry={plot} rotation-x={-Math.PI / 2} position-y={0.035}>
        <lineBasicMaterial color={HIVIS} transparent opacity={0.45} />
      </lineSegments>
    </>
  );
}

function Site({ P, mobile }: { P: Pal; mobile: boolean }) {
  const geo = useTowerGeo();
  return (
    <>
      <hemisphereLight args={[P.sky, P.earth, P.hemi]} />
      <directionalLight
        position={[9, 16, 7]}
        intensity={P.sun}
        castShadow
        shadow-mapSize-width={mobile ? 1024 : 2048}
        shadow-mapSize-height={mobile ? 1024 : 2048}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={48}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <Ground P={P} />
      <Tower P={P} geo={geo} />
      <Ghosts geo={geo} />
      <Scaffold P={P} />
      <Sparks />
      <Measure />
      <Crane P={P} />
      <Yard P={P} />
      <Office P={P} />
      <Truck P={P} />
      <Crew P={P} />
      <Leaks P={P} />
      <ScanPlanes P={P} />
    </>
  );
}

const NO_SCAN = { get: () => 0 } as unknown as MotionValue<number>;

export default function HeroScene({
  scan = NO_SCAN,
  progress,
  active,
  theme,
}: {
  scan?: MotionValue<number>;
  progress: MotionValue<number>;
  active: boolean;
  theme: Theme;
}) {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / innerHeight) * 2 - 1);
    };
    addEventListener("pointermove", move);
    return () => removeEventListener("pointermove", move);
  }, []);

  const mobile = useMemo(() => innerWidth < 768, []);
  const P = PALETTE[theme];

  return (
    <Canvas
      flat
      shadows
      frameloop={active ? "always" : "demand"}
      dpr={mobile ? [1, 1.5] : [1, 1.5]}
      camera={{ fov: mobile ? 36 : 32, position: [24, 14, 24], near: 0.1, far: 160 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[P.bg]} />
      <fog attach="fog" args={[P.bg, 24, 60]} />
      <Director progress={progress} scan={scan} mobile={mobile} />
      <Site P={P} mobile={mobile} />
      <Post P={P} />
    </Canvas>
  );
}
