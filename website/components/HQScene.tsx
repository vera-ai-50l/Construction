"use client";
"use no memo"; // R3F mutates three.js objects in useFrame; keep the compiler out of it.
/* eslint-disable react-hooks/immutability */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

// The goal as a mountain. Altitude 0..1 is revenue 0..target: a tide of hi-vis floods the contours
// up to what's banked, camps sit on the trail at each phase target, the summit is the goal.

const BG = "#0a0a09";
const BONE = "#f4f1ec";
const HIVIS = "#ff5b1f";
const W = 36, D = 24, SX = 260, SZ = 175, PEAK_H = 5.4;
const PEAK_X = 6, PEAK_Z = -2, BASE_X = -11, BASE_Z = 5;

function raw(x: number, z: number) {
  const dx = x - PEAK_X, dz = z - PEAK_Z;
  const summit = Math.exp(-(dx * dx) / 38 - (dz * dz) / 16);
  const ridges = 0.32 * Math.exp(-((x + 3) ** 2) / 28 - ((z + 6) ** 2) / 10) + 0.24 * Math.exp(-((x - 12) ** 2) / 14 - ((z - 6) ** 2) / 16);
  const grain = 0.5 + 0.5 * Math.sin(x * 0.55 + Math.sin(z * 0.45) * 2.2) * Math.cos(z * 0.6 - x * 0.25);
  return summit + ridges + 0.05 * grain * (0.4 + summit);
}
const HP = raw(PEAK_X, PEAK_Z);
const height = (x: number, z: number) => raw(x, z) / HP;

/** The trail from base camp to summit, with the best altitude reached so far at each step. */
const TRAIL = (() => {
  const pts: THREE.Vector3[] = [];
  const alt: number[] = [];
  let best = 0;
  for (let i = 0; i <= 240; i++) {
    const t = i / 240;
    const x = BASE_X + (PEAK_X - BASE_X) * t + Math.sin(t * Math.PI * 2.4) * 1.4 * (1 - t);
    const z = BASE_Z + (PEAK_Z - BASE_Z) * t + Math.cos(t * Math.PI * 1.8) * 1.1 * (1 - t);
    const h = height(x, z);
    best = Math.max(best, h);
    alt.push(best);
    pts.push(new THREE.Vector3(x, h * PEAK_H + 0.05, z));
  }
  return { pts, alt };
})();
const at = (frac: number) => {
  const i = TRAIL.alt.findIndex((a) => a >= frac);
  return i < 0 ? TRAIL.pts.length - 1 : i;
};
const SUMMIT = TRAIL.pts.at(-1)!;

// Per-frame shared state, written by the Rig before anything else reads it.
const S = { level: 0, intro: 0, lamp: new THREE.Vector2(BASE_X, BASE_Z) };
const pointer = { x: 0, y: 0, moved: false };
const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 4);

const vertexShader = /* glsl */ `
  attribute float aH;
  varying float vH; varying float vFog; varying float vShade;
  varying vec3 vW; varying vec2 vUv;
  void main() {
    vH = aH; vUv = uv;
    vShade = max(dot(normal, normalize(vec3(-0.5, 0.8, 0.4))), 0.0);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec4 mv = viewMatrix * w;
    vFog = smoothstep(48.0, 16.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uLevel; uniform float uTime; uniform float uReveal;
  uniform vec2 uLamp; uniform vec2 uOrigin;
  uniform vec3 uBg; uniform vec3 uLine; uniform vec3 uHot;
  varying float vH; varying float vFog; varying float vShade;
  varying vec3 vW; varying vec2 vUv;
  float iso(float v) { return 1.0 - min(abs(fract(v - 0.5) - 0.5) / fwidth(v), 1.0); }
  void main() {
    float lamp = smoothstep(4.8, 0.0, distance(vW.xz, uLamp));
    float body = smoothstep(0.04, 0.07, vH); // the plains never flood, only the mountain
    float under = step(vH, uLevel) * body;
    float a = iso(vH * 30.0) * (0.06 + 0.4 * lamp) + iso(vH * 6.0) * (0.16 + 0.5 * lamp);
    float tide = (1.0 - min(abs(vH - uLevel) / (fwidth(vH) * 2.0), 1.0)) * body;
    vec3 col = uBg + vec3(0.012, 0.011, 0.01) * vShade
      + mix(uLine, uHot, under) * a
      + uHot * (under * 0.03 + lamp * 0.012 + tide * (0.7 + 0.3 * sin(uTime * 2.4)));
    float edge = smoothstep(0.5, 0.33, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
    float reveal = smoothstep(uReveal, uReveal - 5.0, distance(vW.xz, uOrigin));
    gl_FragColor = vec4(mix(uBg, col, edge * vFog * reveal), 1.0);
    #include <colorspace_fragment>
  }
`;

function Terrain() {
  const [geo, mat] = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, D, SX, SZ);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const hs = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      hs[i] = height(p.getX(i), p.getZ(i));
      p.setY(i, hs[i] * PEAK_H);
    }
    g.setAttribute("aH", new THREE.BufferAttribute(hs, 1));
    g.computeVertexNormals();
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uLevel: { value: 0 },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uLamp: { value: S.lamp },
        uOrigin: { value: new THREE.Vector2(BASE_X, BASE_Z) },
        uBg: { value: new THREE.Color(BG) },
        uLine: { value: new THREE.Color(BONE) },
        uHot: { value: new THREE.Color(HIVIS) },
      },
    });
    return [g, m];
  }, []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uLevel.value = S.level;
    mat.uniforms.uReveal.value = S.intro * 48;
  });
  return <mesh geometry={geo} material={mat} />;
}

function Trail({ level }: { level: number }) {
  const [done, rest] = useMemo(() => {
    const i = at(level);
    const a = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(TRAIL.pts.slice(0, i + 1)),
      new THREE.LineBasicMaterial({ color: HIVIS }),
    );
    const b = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(TRAIL.pts.slice(i)),
      new THREE.LineDashedMaterial({ color: BONE, dashSize: 0.16, gapSize: 0.14, transparent: true, opacity: 0.5 }),
    );
    b.computeLineDistances();
    return [a, b];
  }, [level]);
  useEffect(
    () => () => [done, rest].forEach((l) => (l.geometry.dispose(), (l.material as THREE.Material).dispose())),
    [done, rest],
  );
  return (
    <>
      <primitive object={done} />
      <primitive object={rest} />
    </>
  );
}

/** A ring that keeps rippling outwards. */
function Pulse({ speed = 0.55, size = 2.2 }: { speed?: number; size?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const k = (clock.elapsedTime * speed) % 1;
    ref.current!.scale.setScalar(0.2 + k * size);
    (ref.current!.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={0.03}>
      <ringGeometry args={[0.92, 1, 48]} />
      <meshBasicMaterial color={HIVIS} transparent depthTest={false} depthWrite={false} />
    </mesh>
  );
}

export type Camp = { frac: number; cleared: boolean; active: boolean };

function Camps({ camps }: { camps: Camp[] }) {
  return camps.map((c, i) => (
    <group key={i} position={TRAIL.pts[at(c.frac)]}>
      <mesh position-y={0.45}>
        <cylinderGeometry args={[0.012, 0.012, 0.9, 6]} />
        <meshBasicMaterial color={c.cleared ? HIVIS : BONE} transparent opacity={0.6} />
      </mesh>
      <mesh position-y={0.93}>
        <sphereGeometry args={[0.065, 16, 16]} />
        <meshBasicMaterial color={c.cleared || c.active ? HIVIS : BONE} />
      </mesh>
      {c.active && <Pulse speed={0.4} size={1.4} />}
    </group>
  ));
}

function Summit() {
  return (
    <group position={SUMMIT}>
      <mesh position-y={0.7}>
        <cylinderGeometry args={[0.014, 0.014, 1.4, 6]} />
        <meshBasicMaterial color={BONE} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.22, 1.25, 0]}>
        <planeGeometry args={[0.42, 0.26]} />
        <meshBasicMaterial color={BONE} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** You are here: a hi-vis beacon with a light shaft, riding the trail at the banked altitude. */
function Beacon() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => ref.current!.position.copy(TRAIL.pts[at(S.level)]));
  return (
    <group ref={ref}>
      <mesh position-y={0.12}>
        <sphereGeometry args={[0.11, 20, 20]} />
        <meshBasicMaterial color={HIVIS} />
      </mesh>
      <mesh position-y={4}>
        <cylinderGeometry args={[0.018, 0.018, 8, 6, 1, true]} />
        <meshBasicMaterial color={HIVIS} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <Pulse />
    </group>
  );
}

function Dust() {
  const N = 420;
  const pts = useMemo(() => {
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) p.set([(Math.random() - 0.5) * 30, Math.random() * 8, (Math.random() - 0.5) * 20], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: BONE, size: 0.03, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
  }, []);
  useFrame((_, dt) => {
    const a = pts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) a.setY(i, (a.getY(i) + dt * (0.08 + (i % 7) * 0.02)) % 8);
    a.needsUpdate = true;
  });
  return <primitive object={pts} />;
}

/** Camera (intro fly-in, cursor parallax, scroll climb), the headlamp, the tide, and DOM labels pinned to 3D anchors. */
function Rig({
  level,
  scroll,
  anchors,
  labels,
}: {
  level: number;
  scroll: MotionValue<number>;
  anchors: THREE.Vector3[];
  labels: RefObject<(HTMLElement | null)[]>;
}) {
  const { camera, size } = useThree();
  const v = useMemo(
    () => ({
      look: new THREE.Vector3(1.5, 1.4, -0.5),
      lookTo: new THREE.Vector3(),
      p: new THREE.Vector3(),
      you: new THREE.Vector3(),
      hit: new THREE.Vector3(),
      lampTo: new THREE.Vector2(),
      ndc: new THREE.Vector2(),
      ray: new THREE.Raycaster(),
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2),
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }),
    [],
  );

  // Desktop: the mountain sits right of centre and a touch low, clear of the headline and the nav.
  // Phones: a wider lens, image nudged up above the copy.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const mobile = size.width < 768;
    cam.fov = mobile ? 68 : 40;
    if (mobile) cam.setViewOffset(size.width, size.height, 0, size.height * 0.235, size.width, size.height);
    else cam.setViewOffset(size.width, size.height, -size.width * 0.17, -size.height * 0.07, size.width, size.height);
    cam.updateProjectionMatrix();
  }, [camera, size]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / innerHeight) * 2 + 1;
      pointer.moved = e.pointerType === "mouse";
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 2.6);
    const s = scroll.get();
    const mobile = size.width < 768;
    S.intro = v.reduced ? 1 : ease(t / 3.2);
    S.level += (level * ease((t - 0.8) / 2.4) - S.level) * (v.reduced ? 1 : k);

    const sway = v.reduced ? 0 : Math.sin(t * 0.12) * 0.8;
    if (mobile) {
      // Phones are too narrow for the side view, so look straight up the trail from behind base camp.
      v.p.set(-21 + sway, 8.5 + s * 4 + (1 - S.intro) * 10, 9.8 - s * 3 + (1 - S.intro) * 8);
      v.lookTo.set(2, 2.4 + s * 1.2, -0.5);
    } else {
      v.p.set(-3 + pointer.x * 2.2 + sway, 8 + pointer.y * 1.1 + s * 5 + (1 - S.intro) * 10, 16 - s * 6 + (1 - S.intro) * 12);
      v.lookTo.set(1.5 + pointer.x * 0.6, 1.4 + s * 1.4, -0.5);
    }
    camera.position.lerp(v.p, k);
    v.look.lerp(v.lookTo, k);
    camera.lookAt(v.look);

    // Headlamp: where the cursor ray meets mid-altitude. Touch screens get a slow wander instead.
    if (pointer.moved) {
      v.ray.setFromCamera(v.ndc.set(pointer.x, pointer.y), camera);
      if (v.ray.ray.intersectPlane(v.plane, v.hit)) v.lampTo.set(v.hit.x, v.hit.z);
    } else v.lampTo.set(Math.sin(t * 0.3) * 7, Math.cos(t * 0.23) * 4);
    S.lamp.lerp(v.lampTo, 1 - Math.exp(-dt * 5));

    v.you.copy(TRAIL.pts[at(S.level)]).setY(TRAIL.pts[at(S.level)].y + 0.5);
    const fade = String(Math.min(1, Math.max(0, (t - 1.6) / 0.8)));
    labels.current.forEach((el, i) => {
      if (!el) return;
      v.p.copy(anchors[i] ?? v.you).project(camera);
      el.style.transform = `translate3d(${(v.p.x * 0.5 + 0.5) * size.width}px, ${(-v.p.y * 0.5 + 0.5) * size.height}px, 0)`;
      el.style.opacity = v.p.z < 1 ? fade : "0";
    });
  });
  return null;
}

/** Label order: one per camp, then the summit, then "you". */
export default function HQScene({
  level,
  camps,
  scroll,
  active,
  labels,
}: {
  level: number;
  camps: Camp[];
  scroll: MotionValue<number>;
  active: boolean;
  labels: RefObject<(HTMLElement | null)[]>;
}) {
  const anchors = [...camps.map((c) => TRAIL.pts[at(c.frac)].clone().setY(TRAIL.pts[at(c.frac)].y + 1)), SUMMIT.clone().setY(SUMMIT.y + 1.45)];
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 40, near: 0.1, far: 100, position: [-3, 18, 28] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 16, 42]} />
      <Terrain />
      <Trail level={level} />
      <Camps camps={camps} />
      <Summit />
      <Beacon />
      <Dust />
      <Rig level={level} scroll={scroll} anchors={anchors} labels={labels} />
    </Canvas>
  );
}
